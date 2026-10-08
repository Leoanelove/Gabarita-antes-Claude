import React, { useState, useMemo, useEffect } from 'react';
import { 
  RotateCcw, 
  Play, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  Layers, 
  Check, 
  Trophy, 
  Trash2,
  AlertTriangle,
  Info,
  Plus,
  PieChart,
  Edit3
} from 'lucide-react';
import { StudyCycle, CycleBlock, Disciplina, Assunto, StudyMethod } from '../../types';
import { Card, CardHeader, CardBody } from '../../design-system/Card';
import { Button } from '../../design-system/Button';
import { Badge } from '../../design-system/Badge';
import { Modal } from '../../design-system/Modal';
import { DatabaseService } from '../../services/db';
import { CriarCicloModal } from './CriarCicloModal';
import { useTheme } from '../../contexts/ThemeContext';

interface CicloViewProps {
  cycle: StudyCycle;
  disciplinas: Disciplina[];
  assuntos?: Assunto[];
  onAdvanceCycle: (minutesStudied?: number) => Promise<void>;
  onRewindCycle: () => Promise<void>;
  onRecordCycleProgress: (additionalMinutes: number) => Promise<void>;
  onResetCycleLap: () => Promise<void>;
  onRecalculateCycle: (baseSlotDuration?: number) => Promise<void>;
  onUpdateCycleBlock: (blockId: string, partial: Partial<CycleBlock>) => Promise<void>;
  onOpenStudyTimer: (disciplinaId?: string, assuntoId?: string) => void;
  onSaveNewCycle?: (newCycle: StudyCycle) => Promise<void>;
  onSwitchMethod?: (method: StudyMethod) => Promise<void> | void;
  onRemoveCycle?: () => Promise<void>;
  onReplan?: () => void;
}

export const CicloView: React.FC<CicloViewProps> = ({
  cycle,
  disciplinas,
  assuntos = [],
  onAdvanceCycle,
  onRewindCycle,
  onRecordCycleProgress,
  onResetCycleLap,
  onRecalculateCycle,
  onUpdateCycleBlock,
  onOpenStudyTimer,
  onSaveNewCycle,
  onSwitchMethod,
  onRemoveCycle,
  onReplan,
}) => {
  const [activeCycle, setActiveCycle] = useState<StudyCycle>(cycle);
  const [internalAssuntos, setInternalAssuntos] = useState<Assunto[]>(assuntos);

  useEffect(() => {
    if (cycle) {
      setActiveCycle(cycle);
    }
  }, [cycle]);

  useEffect(() => {
    if (!assuntos || assuntos.length === 0) {
      DatabaseService.getAssuntos().then(setInternalAssuntos);
    } else {
      setInternalAssuntos(assuntos);
    }
  }, [assuntos]);

  // Modais de Controle
  const [isResetLapModalOpen, setIsResetLapModalOpen] = useState(false);
  const [isRemoveCycleModalOpen, setIsRemoveCycleModalOpen] = useState(false);
  const [isEditBlockModalOpen, setIsEditBlockModalOpen] = useState(false);
  const [isCreateCycleModalOpen, setIsCreateCycleModalOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<CycleBlock | null>(null);

  const [editDuration, setEditDuration] = useState(60);
  const [editTopicName, setEditTopicName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [hoveredSliceIndex, setHoveredSliceIndex] = useState<number | null>(null);

  const { palette } = useTheme();

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const currentBlock = activeCycle.blocks[activeCycle.currentBlockIndex] || activeCycle.blocks[0];
  const completedBlocksInCurrentLap = activeCycle.blocks.filter(b => b.status === 'concluido').length;
  const currentLapProgressPercent = activeCycle.blocks.length > 0 
    ? Math.round((completedBlocksInCurrentLap / activeCycle.blocks.length) * 100) 
    : 0;

  // Processamento e dados do Gráfico de Rosca (Donut Chart)
  const chartData = useMemo(() => {
    const map = new Map<string, { name: string; minutes: number; color: string }>();

    activeCycle.blocks.forEach((b) => {
      const key = b.disciplinaName;
      const existing = map.get(key);
      const assignedColor = (!b.disciplinaColor || b.disciplinaColor === '#10b981')
        ? (palette.chartColors[map.size % palette.chartColors.length] || '#f97316')
        : b.disciplinaColor;

      if (existing) {
        existing.minutes += b.durationMinutes;
      } else {
        map.set(key, {
          name: b.disciplinaName,
          minutes: b.durationMinutes,
          color: assignedColor,
        });
      }
    });

    const list = Array.from(map.values());
    return list;
  }, [activeCycle.blocks, palette]);

  const totalChartMinutes = useMemo(() => {
    return chartData.reduce((acc, d) => acc + d.minutes, 0);
  }, [chartData]);

  // Tempo total formatado no centro da rosca (ex: '19h00min')
  const formattedCycleTotalTime = useMemo(() => {
    const hours = Math.floor(totalChartMinutes / 60);
    const mins = totalChartMinutes % 60;
    return `${hours}h${String(mins).padStart(2, '0')}min`;
  }, [totalChartMinutes]);

  // Formatar relação de tempo para o formato solicitado (ex: '0min / 0h30min' ou '15min / 1h30min')
  const formatTimeRelation = (elapsedMinutes: number = 0, durationMinutes: number) => {
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const durationFormatted = `${hours}h${String(mins).padStart(2, '0')}min`;
    return `${elapsedMinutes}min / ${durationFormatted}`;
  };

  // Ação: Recomeçar Ciclo
  const handleConfirmResetCycle = async () => {
    setIsSubmitting(true);
    try {
      const reset = await DatabaseService.resetStudyCycle(false);
      setActiveCycle(reset);
      setIsResetLapModalOpen(false);
      showFeedback('Ciclo reiniciado com sucesso! Ponteiro reposicionado no Bloco 1.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ação: Remover Ciclo
  const handleConfirmRemoveCycle = async () => {
    setIsSubmitting(true);
    try {
      if (onRemoveCycle) {
        await onRemoveCycle();
      } else {
        const cleared = await DatabaseService.removeStudyCycle();
        setActiveCycle(cleared);
      }
      setIsRemoveCycleModalOpen(false);
      showFeedback('Ciclo de estudos removido com sucesso.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ação: Replanejar (Troca de método ou ajuste de ciclo)
  const handleConfirmReplanMethod = async (newMethod: StudyMethod) => {
    await DatabaseService.setStudyMethod(newMethod);
    if (onSwitchMethod) {
      await onSwitchMethod(newMethod);
    }
    if (newMethod === 'ciclo') {
      setIsCreateCycleModalOpen(true);
    }
    showFeedback(newMethod === 'ciclo' ? 'Modo Ciclo de Estudos ativo!' : 'Modo Cronograma Fixo ativado!');
  };

  const handleOpenEditBlock = (block: CycleBlock) => {
    setSelectedBlock(block);
    setEditDuration(block.durationMinutes);
    setEditTopicName(block.assuntoSugeridoName || '');
    setIsEditBlockModalOpen(true);
  };

  const handleSaveBlockEdit = async () => {
    if (!selectedBlock) return;
    setIsSubmitting(true);
    try {
      await onUpdateCycleBlock(selectedBlock.id, {
        durationMinutes: Number(editDuration),
        assuntoSugeridoName: editTopicName.trim() || undefined,
      });

      setActiveCycle(prev => ({
        ...prev,
        blocks: prev.blocks.map(b => b.id === selectedBlock.id ? {
          ...b,
          durationMinutes: Number(editDuration),
          assuntoSugeridoName: editTopicName.trim() || undefined,
        } : b),
        totalCycleMinutes: prev.blocks.reduce((acc, b) => acc + (b.id === selectedBlock.id ? Number(editDuration) : b.durationMinutes), 0)
      }));

      setIsEditBlockModalOpen(false);
      showFeedback('Bloco atualizado com sucesso!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCycleCreated = async (newCycle: StudyCycle) => {
    setActiveCycle(newCycle);
    await DatabaseService.saveStudyCycle(newCycle);
    if (onSaveNewCycle) {
      await onSaveNewCycle(newCycle);
    }
    showFeedback('Novo Ciclo de Estudos gerado e ativo com sucesso!');
  };

  // Parâmetros geométricos do Donut Chart SVG
  const radius = 95;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercent = 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Feedback */}
      {feedback && (
        <div className="p-3.5 rounded-xl text-xs font-semibold bg-[var(--primary-light)] border border-[var(--primary-light-border)] text-[var(--primary-text)] dark:text-[var(--primary-text-dark)] animate-in fade-in flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* =========================================================================
          1. TOPO: Painel Gerencial & Botões de Ação ('Recomeçar Ciclo', 'Replanejar', 'Remover')
          ========================================================================= */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2.5 rounded-xl bg-[var(--primary-light)] text-[var(--primary-color)] dark:text-[var(--primary-text-dark)]">
                <RotateCcw className="w-6 h-6" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                    Ciclo de Estudos
                  </h1>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Painel gerencial de rotação contínua proporcional por disciplina e peso.
                </p>
              </div>
            </div>
          </div>

          {/* Botões de Ação do Topo */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Recomeçar Ciclo */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsResetLapModalOpen(true)}
              leftIcon={<RotateCcw className="w-4 h-4 text-[var(--primary-color)] dark:text-[var(--primary-text-dark)]" />}
              className="border-[var(--primary-light-border)] hover:bg-[var(--primary-light)] text-slate-700 dark:text-slate-200 cursor-pointer font-semibold"
            >
              Recomeçar Ciclo
            </Button>

            {/* Remover */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRemoveCycleModalOpen(true)}
              leftIcon={<Trash2 className="w-4 h-4 text-rose-500" />}
              className="border-rose-500/30 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 cursor-pointer font-semibold"
            >
              Remover
            </Button>
          </div>
        </div>

        {/* Bloco Atual em Destaque Executivo */}
        {currentBlock && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--primary-light)] p-4 rounded-xl border border-[var(--primary-light-border)]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full animate-ping" style={{ backgroundColor: currentBlock.disciplinaColor || 'var(--primary-color)' }} />
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-[var(--primary-text)] dark:text-[var(--primary-text-dark)]">
                  Próxima Disciplina da Fila
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  (Bloco {activeCycle.currentBlockIndex + 1} de {activeCycle.blocks.length})
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: currentBlock.disciplinaColor || 'var(--primary-color)' }} />
                {currentBlock.disciplinaName}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Tópico sugerido: <strong className="text-slate-900 dark:text-slate-100">{currentBlock.assuntoSugeridoName || 'Estudo Dirigido'}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await onRewindCycle();
                  const updated = await DatabaseService.getStudyCycle();
                  setActiveCycle(updated);
                }}
                leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
                className="cursor-pointer"
              >
                Voltar
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => onOpenStudyTimer(currentBlock.disciplinaId, currentBlock.assuntoSugeridoId)}
                leftIcon={<Play className="w-4 h-4 fill-current" />}
                className="font-bold shadow-md cursor-pointer"
              >
                Estudar Agora
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await onAdvanceCycle(currentBlock.durationMinutes);
                  const updated = await DatabaseService.getStudyCycle();
                  setActiveCycle(updated);
                }}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                className="cursor-pointer"
              >
                Avançar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          2. CENTRO: Grande Gráfico de Rosca (Doughnut Chart) com carga horária total no centro
          ========================================================================= */}
      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
        <CardBody className="p-6 md:p-8 flex flex-col items-center justify-center">
          <div className="text-center space-y-1 mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Distribuição Proporcional das Disciplinas
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cada fatia representa o tempo dedicado por matéria na volta completa.
            </p>
          </div>

          {/* Gráfico de Rosca SVG Ampliado */}
          <div className="relative w-72 h-72 sm:w-80 sm:h-80 my-2 flex items-center justify-center">
            <svg viewBox="0 0 260 260" className="w-full h-full transform -rotate-90">
              {/* Trilha de base cinza suave */}
              <circle
                cx="130"
                cy="130"
                r={radius}
                fill="transparent"
                stroke="currentColor"
                strokeWidth="28"
                className="text-slate-100 dark:text-slate-800/80"
              />

              {/* Fatias proporcionais do ciclo */}
              {chartData.map((item, idx) => {
                const percent = item.minutes / totalChartMinutes;
                const dashLength = percent * circumference;
                const spaceLength = circumference - dashLength;
                const offset = cumulativePercent * circumference;
                cumulativePercent += percent;

                const isHovered = hoveredSliceIndex === idx;

                return (
                  <circle
                    key={item.name}
                    cx="130"
                    cy="130"
                    r={radius}
                    fill="transparent"
                    stroke={item.color}
                    strokeWidth={isHovered ? 34 : 28}
                    strokeDasharray={`${dashLength} ${spaceLength}`}
                    strokeDashoffset={-offset}
                    className="transition-all duration-300 cursor-pointer drop-shadow-xs"
                    onMouseEnter={() => setHoveredSliceIndex(idx)}
                    onMouseLeave={() => setHoveredSliceIndex(null)}
                  />
                );
              })}
            </svg>

            {/* Centro Vazado do Gráfico: Carga Horária Total (ex: '19h00min') */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-4">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest leading-none">
                Carga Horária Total
              </span>
              <span className="text-3xl sm:text-4xl font-black font-mono text-[var(--primary-color)] dark:text-[var(--primary-text-dark)] mt-1 tracking-tight">
                {formattedCycleTotalTime}
              </span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
                {activeCycle.blocks.length} blocos na esteira
              </span>
            </div>
          </div>

          {/* Legenda visual compacta das disciplinas sob o gráfico */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 max-w-2xl">
            {chartData.map((item, idx) => {
              const percent = Math.round((item.minutes / totalChartMinutes) * 100);
              const isHovered = hoveredSliceIndex === idx;
              return (
                <div
                  key={item.name}
                  onMouseEnter={() => setHoveredSliceIndex(idx)}
                  onMouseLeave={() => setHoveredSliceIndex(null)}
                  className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                    isHovered ? 'bg-[var(--primary-light)] ring-1 ring-[var(--primary-light-border)]' : 'bg-slate-50 dark:bg-slate-800/40'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="font-medium text-slate-700 dark:text-slate-300">{item.name}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{percent}%</span>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* =========================================================================
          3. RESUMO: Dois Cards ('Ciclos Completos' e 'Progresso')
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card: Ciclos Completos */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block">
              Ciclos Completos
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black font-mono text-[var(--primary-color)] dark:text-[var(--primary-text-dark)]">
                {activeCycle.completedCyclesCount || 0}
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {activeCycle.completedCyclesCount === 1 ? 'volta finalizada' : 'voltas finalizadas'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Total de rotações completas de todas as matérias do edital.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--primary-light)] text-[var(--primary-color)] dark:text-[var(--primary-text-dark)] shrink-0">
            <Trophy className="w-8 h-8" />
          </div>
        </div>

        {/* Card: Progresso */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
              Progresso
            </span>
            <span className="text-lg font-black font-mono text-slate-900 dark:text-slate-100">
              {currentLapProgressPercent}%
            </span>
          </div>

          {/* Barra Horizontal de Evolução com Gradiente Dinâmico */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(0, currentLapProgressPercent))}%`,
                background: 'linear-gradient(to right, var(--primary-color), var(--primary-hover))'
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span>
              <strong>{completedBlocksInCurrentLap}</strong> de <strong>{activeCycle.blocks.length}</strong> blocos concluídos
            </span>
            <span>Volta atual nº {(activeCycle.completedCyclesCount || 0) + 1}</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          4. RODAPÉ: Lista em Formato de Sequência (Timeline)
             - Cor correspondente da disciplina no gráfico
             - Nome da matéria
             - Relação de tempo (ex: '0min / 0h30min')
          ========================================================================= */}
      <Card className="border border-slate-200 dark:border-slate-800 shadow-xs">
        <CardHeader
          title="Sequência de Execução do Ciclo (Timeline)"
          subtitle="Acompanhe a ordem contínua dos blocos de estudo e retome de onde parou."
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateCycleModalOpen(true)}
                leftIcon={<Plus className="w-3.5 h-3.5 text-[var(--primary-color)] dark:text-[var(--primary-text-dark)]" />}
                className="cursor-pointer"
              >
                Novo Ciclo
              </Button>
            </div>
          }
        />
        <CardBody className="p-6 space-y-4">
          {activeCycle.blocks.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <RotateCcw className="w-10 h-10 text-[var(--primary-color)] dark:text-[var(--primary-text-dark)] mx-auto opacity-50" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                Nenhum bloco cadastrado no ciclo atual.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateCycleModalOpen(true)}
                className="font-bold cursor-pointer"
              >
                Gerar Ciclo Automático
              </Button>
            </div>
          ) : (
            <div className="relative pl-6 space-y-4 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
              {activeCycle.blocks.map((block, idx) => {
                const isCurrent = idx === activeCycle.currentBlockIndex;
                const isDone = block.status === 'concluido';
                const timeRelation = formatTimeRelation(block.elapsedMinutes || 0, block.durationMinutes);

                return (
                  <div
                    key={block.id}
                    className={`relative p-4 rounded-xl border transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isCurrent
                        ? 'border-[var(--primary-color)] bg-[var(--primary-light)] shadow-md ring-2 ring-[var(--primary-light-border)]'
                        : isDone
                        ? 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 opacity-75'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Indicador de Timeline da Disciplina */}
                    <div
                      className="absolute -left-[31px] top-5 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 shadow-xs flex items-center justify-center"
                      style={{ backgroundColor: block.disciplinaColor || 'var(--primary-color)' }}
                    >
                      {isDone && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                    </div>

                    {/* Matéria, Cor e Tópico */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: block.disciplinaColor || 'var(--primary-color)' }}
                        />
                        <span className="font-mono text-[10px] font-bold text-slate-400">
                          Bloco #{idx + 1}
                        </span>
                        <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">
                          {block.disciplinaName}
                        </h4>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold theme-btn-primary shadow-xs">
                            Em Andamento
                          </span>
                        )}
                        {isDone && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Concluído
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-5">
                        Tópico: {block.assuntoSugeridoName || 'Estudo Dirigido'}
                      </p>
                    </div>

                    {/* Relação de Tempo Exata (ex: '0min / 0h30min') e Ações */}
                    <div className="flex items-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Tempo do Bloco
                        </span>
                        <span className="font-mono font-extrabold text-xs text-[var(--primary-text)] dark:text-[var(--primary-text-dark)]">
                          {timeRelation}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditBlock(block)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer text-[11px]"
                          title="Ajustar tempo ou tópico"
                        >
                          Ajustar
                        </button>
                        {isCurrent && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onOpenStudyTimer(block.disciplinaId, block.assuntoSugeridoId)}
                            leftIcon={<Play className="w-3 h-3 fill-current" />}
                            className="font-bold cursor-pointer"
                          >
                            Estudar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* =========================================================================
          MODAIS: 'Recomeçar Ciclo', 'Replanejar', 'Remover' e 'Ajustar Bloco'
          ========================================================================= */}
      
      {/* Modal: Recomeçar Ciclo */}
      <Modal
        isOpen={isResetLapModalOpen}
        onClose={() => setIsResetLapModalOpen(false)}
        title="Recomeçar Ciclo de Estudos"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Deseja reiniciar a volta atual do ciclo? O ponteiro será reposicionado no <strong>Bloco #1</strong> com todos os blocos reiniciados para nova execução. O número total de ciclos completados será preservado.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setIsResetLapModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmResetCycle}
              isLoading={isSubmitting}
              className="font-bold cursor-pointer"
            >
              Confirmar Reinício
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Remover Ciclo */}
      <Modal
        isOpen={isRemoveCycleModalOpen}
        onClose={() => setIsRemoveCycleModalOpen(false)}
        title="Remover Ciclo de Estudos"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Atenção: Esta ação limpará os blocos do ciclo atual. Você poderá criar um novo ciclo a qualquer momento através do botão 'Novo Ciclo' ou 'Replanejar'.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setIsRemoveCycleModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmRemoveCycle}
              isLoading={isSubmitting}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              Remover Ciclo
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Ajustar Bloco Individual */}
      <Modal
        isOpen={isEditBlockModalOpen}
        onClose={() => setIsEditBlockModalOpen(false)}
        title="Ajustar Bloco do Ciclo"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-bold mb-1 text-slate-800 dark:text-slate-200">
              Duração (minutos)
            </label>
            <input
              type="number"
              value={editDuration}
              onChange={(e) => setEditDuration(parseInt(e.target.value, 10) || 60)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold"
            />
          </div>
          <div>
            <label className="block font-bold mb-1 text-slate-800 dark:text-slate-200">
              Tópico Sugerido
            </label>
            <input
              type="text"
              value={editTopicName}
              onChange={(e) => setEditTopicName(e.target.value)}
              placeholder="Ex: Teoria Geral, Controle de Constitucionalidade..."
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setIsEditBlockModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveBlockEdit}
              isLoading={isSubmitting}
              className="font-bold cursor-pointer"
            >
              Salvar Alterações
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Criar Novo Ciclo */}
      <CriarCicloModal
        isOpen={isCreateCycleModalOpen}
        onClose={() => setIsCreateCycleModalOpen(false)}
        disciplinas={disciplinas}
        currentCycle={activeCycle}
        assuntos={internalAssuntos}
        onCycleCreated={handleCycleCreated}
      />
    </div>
  );
};
