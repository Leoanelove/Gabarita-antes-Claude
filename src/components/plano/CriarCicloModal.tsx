import React, { useState, useMemo, useEffect } from 'react';
import { 
  Repeat, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  Sliders, 
  BookOpen, 
  Clock, 
  Layers,
  AlertCircle,
  HelpCircle,
  BarChart2
} from 'lucide-react';
import { Disciplina, Assunto, StudyCycle, CycleBlock, Concurso } from '../../types';
import { Modal } from '../../design-system/Modal';
import { Button } from '../../design-system/Button';
import { Badge } from '../../design-system/Badge';
import { DatabaseService } from '../../services/db';

export interface CriarCicloModalProps {
  isOpen: boolean;
  onClose: () => void;
  disciplinas: Disciplina[];
  currentCycle?: StudyCycle | null;
  assuntos?: Assunto[];
  activeConcursoId?: string;
  concursos?: Concurso[];
  onCycleCreated: (newCycle: StudyCycle) => Promise<void>;
}

export const CriarCicloModal: React.FC<CriarCicloModalProps> = ({
  isOpen,
  onClose,
  disciplinas,
  currentCycle,
  assuntos = [],
  activeConcursoId,
  concursos = [],
  onCycleCreated,
}) => {
  // Concurso ativo resolvido
  const resolvedActiveConcursoId = useMemo(() => {
    if (activeConcursoId) return activeConcursoId;
    if (concursos && concursos.length > 0) {
      const active = concursos.find(c => c.active);
      if (active) return active.id;
      return concursos[0].id;
    }
    if (currentCycle?.concursoId) return currentCycle.concursoId;
    return disciplinas[0]?.concursoId || '';
  }, [activeConcursoId, concursos, currentCycle, disciplinas]);

  // Filtro estrito de disciplinas pelo concurso ativo
  const materiasDoConcursoAtivo = useMemo(() => {
    if (!resolvedActiveConcursoId) {
      const firstConcursoId = disciplinas.find(d => d.concursoId)?.concursoId;
      if (firstConcursoId) {
        return disciplinas.filter(d => d.concursoId === firstConcursoId);
      }
      return disciplinas;
    }
    return disciplinas.filter(d => d.concursoId === resolvedActiveConcursoId);
  }, [disciplinas, resolvedActiveConcursoId]);

  // Stepper: Inicia DIRETAMENTE no Passo 1 (Seleção de Disciplinas), pulando Organização
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Passo 1: Disciplinas Selecionadas (apenas do concurso ativo)
  const [selectedDisciplinaIds, setSelectedDisciplinaIds] = useState<string[]>(() => {
    if (currentCycle?.blocks && currentCycle.blocks.length > 0 && currentCycle.concursoId === resolvedActiveConcursoId) {
      const existingIds = Array.from(new Set(currentCycle.blocks.map(b => b.disciplinaId)));
      const valid = existingIds.filter(id => materiasDoConcursoAtivo.some(m => m.id === id));
      if (valid.length > 0) return valid;
    }
    return materiasDoConcursoAtivo.map(d => d.id);
  });

  // Passo 2: Controles Deslizantes Reais de Importância (1 a 5) e Conhecimento (1 a 5)
  const [relevancias, setRelevancias] = useState<Record<string, { importancia: number; conhecimento: number }>>(() => {
    const initial: Record<string, { importancia: number; conhecimento: number }> = {};
    materiasDoConcursoAtivo.forEach((d) => {
      initial[d.id] = {
        importancia: Math.min(5, Math.max(1, Math.round(d.weight || 3))),
        conhecimento: 3, // Padrão intermediário
      };
    });
    return initial;
  });

  // Passo 3: Horários e Intervalos dos Blocos
  const [weeklyHours, setWeeklyHours] = useState(20);
  const [minBlockMinutes, setMinBlockMinutes] = useState(50);
  const [maxBlockMinutes, setMaxBlockMinutes] = useState(90);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setErrorMessage(null);
      setIsSaving(false);
      if (currentCycle?.blocks && currentCycle.blocks.length > 0 && currentCycle.concursoId === resolvedActiveConcursoId) {
        const existingIds = Array.from(new Set(currentCycle.blocks.map(b => b.disciplinaId)));
        const valid = existingIds.filter(id => materiasDoConcursoAtivo.some(m => m.id === id));
        if (valid.length > 0) {
          setSelectedDisciplinaIds(valid);
        } else {
          setSelectedDisciplinaIds(materiasDoConcursoAtivo.map(d => d.id));
        }
      } else {
        setSelectedDisciplinaIds(materiasDoConcursoAtivo.map(d => d.id));
      }
    }
  }, [isOpen, currentCycle, resolvedActiveConcursoId, materiasDoConcursoAtivo]);

  // Alternar seleção de disciplina
  const toggleDisciplina = (discId: string) => {
    setSelectedDisciplinaIds(prev => {
      if (prev.includes(discId)) {
        return prev.filter(id => id !== discId);
      }
      return [...prev, discId];
    });
  };

  const selectAllDisciplinas = () => {
    setSelectedDisciplinaIds(materiasDoConcursoAtivo.map(d => d.id));
  };

  const clearSelection = () => {
    setSelectedDisciplinaIds([]);
  };

  // Atualizar controle deslizante de importância ou conhecimento
  const handleUpdateRelevancia = (
    discId: string, 
    field: 'importancia' | 'conhecimento', 
    value: number
  ) => {
    setRelevancias(prev => ({
      ...prev,
      [discId]: {
        ...(prev[discId] || { importancia: 3, conhecimento: 3 }),
        [field]: value,
      },
    }));
  };

  // Lógica Matemática do Passo 2 (Relevância):
  // Calcula o peso e percentual garantindo que a soma feche SEMPRE em exatos 100.0%
  const calculatedDistribution = useMemo(() => {
    const selected = materiasDoConcursoAtivo.filter(d => selectedDisciplinaIds.includes(d.id));
    if (selected.length === 0) return [];

    // Fator de Necessidade: menor conhecimento = maior necessidade de estudo (6 - conhecimento)
    // Pontuação: Importância * Necessidade
    const items = selected.map(d => {
      const rel = relevancias[d.id] || { importancia: 3, conhecimento: 3 };
      const imp = rel.importancia;
      const con = rel.conhecimento;
      const necessidade = 6 - con; // varia de 1 a 5
      const rawScore = imp * necessidade; // varia de 1 a 25
      return {
        disciplina: d,
        importancia: imp,
        conhecimento: con,
        score: rawScore,
        percentage: 0,
      };
    });

    const totalScore = items.reduce((acc, curr) => acc + curr.score, 0) || 1;

    // Cálculo preliminar com 1 casa decimal
    let accumulatedSum = 0;
    const withPercentages = items.map(item => {
      const rawPct = (item.score / totalScore) * 100;
      const pct = Math.round(rawPct * 10) / 10;
      accumulatedSum += pct;
      return {
        ...item,
        percentage: pct,
      };
    });

    // Compensação matemática exata para fechar em 100.0%
    const diff = Number((100.0 - accumulatedSum).toFixed(1));
    if (diff !== 0 && withPercentages.length > 0) {
      let maxIdx = 0;
      for (let i = 1; i < withPercentages.length; i++) {
        if (withPercentages[i].score > withPercentages[maxIdx].score) {
          maxIdx = i;
        }
      }
      withPercentages[maxIdx].percentage = Number(
        (withPercentages[maxIdx].percentage + diff).toFixed(1)
      );
    }

    return withPercentages;
  }, [disciplinas, selectedDisciplinaIds, relevancias]);

  // Avançar nos passos
  const handleNext = () => {
    setErrorMessage(null);
    if (step === 1) {
      if (selectedDisciplinaIds.length === 0) {
        setErrorMessage('Selecione pelo menos uma disciplina para compor seu ciclo.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    setErrorMessage(null);
    if (step > 1) {
      setStep((step - 1) as 1 | 2 | 3);
    }
  };

  // Salvamento e Integração Final (Passo 3 -> Concluir)
  const handleSaveAndGenerateCycle = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      if (calculatedDistribution.length === 0) {
        throw new Error('Nenhuma disciplina selecionada para o ciclo.');
      }

      // Tempo total da volta do ciclo
      const totalLapMinutes = Math.max(360, Math.round(weeklyHours * 60)); // Mínimo de 6 horas
      const targetSlotBase = Math.round((minBlockMinutes + maxBlockMinutes) / 2);

      const generatedBlocks: CycleBlock[] = [];
      let blockCounter = 1;

      // Gera os blocos proporcionais para cada disciplina
      calculatedDistribution.forEach(item => {
        const disc = item.disciplina;
        const allocatedMinutes = Math.round((item.percentage / 100) * totalLapMinutes);
        const numBlocks = Math.max(1, Math.round(allocatedMinutes / targetSlotBase));
        const blockDuration = Math.min(
          maxBlockMinutes,
          Math.max(minBlockMinutes, Math.round(allocatedMinutes / numBlocks))
        );

        // Tópicos sugeridos da disciplina
        const discAssuntos = assuntos.filter(a => a.disciplinaId === disc.id);
        const unstudiedTopics = discAssuntos.filter(a => a.status === 'nao_iniciado');

        for (let b = 0; b < numBlocks; b++) {
          const suggestedTopic = unstudiedTopics[b] || discAssuntos[b % (discAssuntos.length || 1)];
          const topicName = suggestedTopic?.name || 
            (b === 0 ? 'Estudo Teórico Dirigido' : b === 1 ? 'Resolução de Questões de Fixação' : 'Revisão Tática & Lei Seca');

          generatedBlocks.push({
            id: `blk_${Date.now()}_${blockCounter++}`,
            cycleId: currentCycle?.id || `cycle_${Date.now()}`,
            disciplinaId: disc.id,
            disciplinaName: disc.name,
            disciplinaColor: disc.color || '#10b981',
            order: 0,
            durationMinutes: blockDuration,
            weight: item.importancia,
            assuntoSugeridoId: suggestedTopic?.id,
            assuntoSugeridoName: topicName,
            status: 'aguardando',
            elapsedMinutes: 0,
          });
        }
      });

      // Intercalamento de matérias (Round-Robin Interleaving):
      // Garante que o estudante nunca estude a mesma matéria em dois blocos consecutivos
      const byDisc: Record<string, CycleBlock[]> = {};
      generatedBlocks.forEach(blk => {
        if (!byDisc[blk.disciplinaId]) byDisc[blk.disciplinaId] = [];
        byDisc[blk.disciplinaId].push(blk);
      });

      const interleaved: CycleBlock[] = [];
      const keys = Object.keys(byDisc);
      let round = 0;
      let hasRemaining = true;

      while (hasRemaining) {
        hasRemaining = false;
        for (const k of keys) {
          if (byDisc[k].length > round) {
            interleaved.push(byDisc[k][round]);
            hasRemaining = true;
          }
        }
        round++;
      }

      // Ordenação final e marcação do primeiro bloco como 'em_andamento'
      interleaved.forEach((blk, idx) => {
        blk.order = idx + 1;
        blk.status = idx === 0 ? 'em_andamento' : 'aguardando';
      });

      const totalCalculatedMinutes = interleaved.reduce((acc, b) => acc + b.durationMinutes, 0);

      const activeMatch = concursos.find(c => c.id === resolvedActiveConcursoId);
      const resolvedTitle = activeMatch
        ? `${activeMatch.organ || activeMatch.orgao || activeMatch.title} - ${activeMatch.role}`
        : currentCycle?.concursoTitle || 'Plano Personalizado';

      const newCycle: StudyCycle = {
        id: `cycle_${resolvedActiveConcursoId || Date.now()}`,
        userId: currentCycle?.userId || 'current_user',
        concursoId: resolvedActiveConcursoId || currentCycle?.concursoId || 'current_concurso',
        concursoTitle: resolvedTitle,
        currentBlockIndex: 0,
        completedCyclesCount: 0,
        totalCycleMinutes: totalCalculatedMinutes,
        blocks: interleaved,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Salva no banco de dados e atualiza estado global
      await DatabaseService.saveStudyCycle(newCycle);
      await onCycleCreated(newCycle);
      onClose();
    } catch (err: any) {
      console.error('Erro ao gerar novo ciclo:', err);
      setErrorMessage(err.message || 'Ocorreu um erro ao processar o novo ciclo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Criar Novo Ciclo de Estudos"
      description="Configure as disciplinas, relevância e parâmetros do seu ciclo contínuo."
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Barra de Progresso / Stepper Visual (3 Passos) */}
        <div className="relative">
          <div className="flex items-center justify-between">
            {/* Passo 1 */}
            <div className="flex flex-col items-center z-10">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                  step === 1
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20 ring-4 ring-emerald-500/20'
                    : step > 1
                    ? 'bg-emerald-500 text-white cursor-pointer'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {step > 1 ? <Check className="w-4 h-4 stroke-[3]" /> : '1'}
              </button>
              <span className={`text-[11px] font-bold mt-1.5 ${step === 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                Disciplinas
              </span>
            </div>

            {/* Passo 2 */}
            <div className="flex flex-col items-center z-10">
              <button
                type="button"
                onClick={() => { if (selectedDisciplinaIds.length > 0) setStep(2); }}
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                  step === 2
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20 ring-4 ring-emerald-500/20'
                    : step > 2
                    ? 'bg-emerald-500 text-white cursor-pointer'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {step > 2 ? <Check className="w-4 h-4 stroke-[3]" /> : '2'}
              </button>
              <span className={`text-[11px] font-bold mt-1.5 ${step === 2 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                Relevância (100%)
              </span>
            </div>

            {/* Passo 3 */}
            <div className="flex flex-col items-center z-10">
              <button
                type="button"
                onClick={() => { if (selectedDisciplinaIds.length > 0) setStep(3); }}
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                  step === 3
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20 ring-4 ring-emerald-500/20'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                }`}
              >
                3
              </button>
              <span className={`text-[11px] font-bold mt-1.5 ${step === 3 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                Horários & Blocos
              </span>
            </div>
          </div>

          {/* Linha de Conexão do Stepper */}
          <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 dark:bg-slate-800 -z-0">
            <div 
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
            />
          </div>
        </div>

        {/* Mensagem de Erro / Alerta */}
        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* CONTEÚDO DOS PASSOS */}

        {/* PASSO 1: Seleção Real de Disciplinas */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-500" />
                  Selecione as Matérias para o Ciclo
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Escolha as disciplinas do seu edital que farão parte da rotação.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllDisciplinas}
                  className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                >
                  Selecionar Todas
                </button>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium cursor-pointer"
                >
                  Limpar
                </button>
              </div>
            </div>

            {/* Grid de Cards de Disciplinas */}
            {materiasDoConcursoAtivo.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 bg-slate-50/50 dark:bg-slate-900/40">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="max-w-sm mx-auto space-y-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Nenhuma matéria encontrada para o concurso ativo.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cadastre ou ative um concurso primeiro no menu "Concursos & Provas" para gerar o seu ciclo.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto p-1 pr-2">
                {materiasDoConcursoAtivo.map((disc) => {
                  const isSelected = selectedDisciplinaIds.includes(disc.id);
                  const discAssuntosCount = assuntos.filter(a => a.disciplinaId === disc.id).length;
                  return (
                    <button
                      key={disc.id}
                      type="button"
                      onClick={() => toggleDisciplina(disc.id)}
                      className={`p-3 rounded-xl border text-left transition-all flex items-start justify-between cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 pr-2">
                        <span 
                          className="w-3.5 h-3.5 rounded-full mt-0.5 shrink-0" 
                          style={{ backgroundColor: disc.color || '#10b981' }} 
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block truncate">
                            {disc.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {discAssuntosCount} tópicos • Peso base: {(disc.weight || 2.0).toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'bg-emerald-500 text-white' : 'border border-slate-300 dark:border-slate-700'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500">Matérias selecionadas:</span>
              <Badge variant="emerald" size="sm">
                {selectedDisciplinaIds.length} de {materiasDoConcursoAtivo.length} disciplinas
              </Badge>
            </div>
          </div>
        )}

        {/* PASSO 2: Relevância com Cálculo Matemático em Tempo Real (100% Exato) */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-500" />
                  Importância & Nível de Conhecimento
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Ajuste os fatores de cada matéria. O algoritmo equilibra o tempo em exatamente 100%.
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-600 dark:text-emerald-400 text-xs font-mono font-black">
                <BarChart2 className="w-3.5 h-3.5" />
                <span>100.0% Fechado</span>
              </div>
            </div>

            {/* Barra de Distribuição Visual Proporcional Empilhada */}
            <div className="space-y-1.5">
              <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-slate-800 flex overflow-hidden shadow-inner">
                {calculatedDistribution.map((item) => (
                  <div
                    key={item.disciplina.id}
                    title={`${item.disciplina.name}: ${item.percentage}%`}
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.disciplina.color || '#10b981',
                    }}
                    className="h-full transition-all duration-300 hover:brightness-110"
                  />
                ))}
              </div>
            </div>

            {/* Lista de Controles Deslizantes Reais */}
            <div className="space-y-3 max-h-72 overflow-y-auto p-1 pr-2">
              {calculatedDistribution.map((item) => {
                const disc = item.disciplina;
                const rel = relevancias[disc.id] || { importancia: 3, conhecimento: 3 };

                return (
                  <div 
                    key={disc.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-3 h-3 rounded-full shrink-0" 
                          style={{ backgroundColor: disc.color || '#10b981' }} 
                        />
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {disc.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                          {item.percentage}% do ciclo
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      {/* Slider 1: Importância no Edital (1 a 5) */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Importância no Edital:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {rel.importancia === 1 ? '1 - Baixa' :
                             rel.importancia === 2 ? '2 - Moderada' :
                             rel.importancia === 3 ? '3 - Importante' :
                             rel.importancia === 4 ? '4 - Alta' : '5 - Crítica'}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          step="1"
                          value={rel.importancia}
                          onChange={(e) => handleUpdateRelevancia(disc.id, 'importancia', parseInt(e.target.value, 10))}
                          className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>

                      {/* Slider 2: Domínio Atual (1 a 5) */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Seu Nível / Domínio:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {rel.conhecimento === 1 ? '1 - Básico' :
                             rel.conhecimento === 2 ? '2 - Iniciante' :
                             rel.conhecimento === 3 ? '3 - Intermediário' :
                             rel.conhecimento === 4 ? '4 - Avançado' : '5 - Dominado'}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          step="1"
                          value={rel.conhecimento}
                          onChange={(e) => handleUpdateRelevancia(disc.id, 'conhecimento', parseInt(e.target.value, 10))}
                          className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PASSO 3: Horários, Duração dos Blocos e Conclusão */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-500" />
                Carga Horária & Intervalos dos Blocos
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Defina o ritmo e a duração dos blocos para o cálculo automático da volta do ciclo.
              </p>
            </div>

            <div className="space-y-4">
              {/* Horas Semanais */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Carga Horária Semanal:</span>
                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                    {weeklyHours} horas / semana
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="1"
                  value={weeklyHours}
                  onChange={(e) => setWeeklyHours(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>5h (Leve)</span>
                  <span>20h (Padrão)</span>
                  <span>40h (Intensivo)</span>
                  <span>60h (Dedicado)</span>
                </div>
              </div>

              {/* Duração Mínima e Máxima dos Blocos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                    Duração Mínima do Bloco
                  </label>
                  <select
                    value={minBlockMinutes}
                    onChange={(e) => setMinBlockMinutes(parseInt(e.target.value, 10))}
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value={30}>30 minutos</option>
                    <option value={45}>45 minutos</option>
                    <option value={50}>50 minutos (Pomodoro)</option>
                    <option value={60}>60 minutos (1 hora)</option>
                  </select>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                    Duração Máxima do Bloco
                  </label>
                  <select
                    value={maxBlockMinutes}
                    onChange={(e) => setMaxBlockMinutes(parseInt(e.target.value, 10))}
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value={60}>60 minutos</option>
                    <option value={75}>75 minutos</option>
                    <option value={90}>90 minutos (Recomendado)</option>
                    <option value={120}>120 minutos (2 horas)</option>
                  </select>
                </div>
              </div>

              {/* Resumo da Volta Calculada */}
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  <span>Resumo do Novo Ciclo Calculado:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 dark:text-slate-300 pt-1">
                  <div>
                    <span className="block text-slate-400">Total da Volta:</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-slate-100">{weeklyHours} horas</span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Blocos Estimados:</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
                      ~{Math.round((weeklyHours * 60) / ((minBlockMinutes + maxBlockMinutes) / 2))} blocos
                    </span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Disciplinas:</span>
                    <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
                      {selectedDisciplinaIds.length} matérias
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BOTÕES DE NAVEGAÇÃO DO MODAL */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <div>
            {step > 1 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBack}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
                disabled={isSaving}
              >
                Voltar
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancelar
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step < 3 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={handleNext}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Próximo Passo
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveAndGenerateCycle}
                isLoading={isSaving}
                leftIcon={<Check className="w-4 h-4" />}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Concluir & Criar Ciclo
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
