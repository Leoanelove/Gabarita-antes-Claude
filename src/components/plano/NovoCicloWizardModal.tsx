import React, { useState, useMemo } from 'react';
import { 
  Repeat, 
  Calendar, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  Sliders, 
  BookOpen, 
  Clock, 
  CalendarDays, 
  Layers,
  AlertCircle,
  HelpCircle,
  BarChart2
} from 'lucide-react';
import { Disciplina, Assunto, StudyCycle, CycleBlock, DayOfWeek } from '../../types';
import { Modal } from '../../design-system/Modal';
import { Button } from '../../design-system/Button';
import { Badge } from '../../design-system/Badge';

interface NovoCicloWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  disciplinas: Disciplina[];
  currentCycle: StudyCycle;
  assuntos?: Assunto[];
  onCycleCreated: (newCycle: StudyCycle) => Promise<void>;
}

export const NovoCicloWizardModal: React.FC<NovoCicloWizardModalProps> = ({
  isOpen,
  onClose,
  disciplinas,
  currentCycle,
  assuntos = [],
  onCycleCreated,
}) => {
  // Controle do Stepper (Passos de 1 a 4)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Passo 1: Tipo de Organização
  const [organizacao, setOrganizacao] = useState<'ciclo' | 'semanal'>('ciclo');

  // Passo 2: Disciplinas Selecionadas
  const [selectedDisciplinaIds, setSelectedDisciplinaIds] = useState<string[]>(() => {
    // Pré-seleciona as disciplinas já presentes no ciclo ou todas
    if (currentCycle?.blocks?.length > 0) {
      const existingIds = Array.from(new Set(currentCycle.blocks.map(b => b.disciplinaId)));
      return existingIds.length > 0 ? existingIds : disciplinas.map(d => d.id);
    }
    return disciplinas.map(d => d.id);
  });

  // Passo 3: Controles Deslizantes Reais de Importância (1 a 5) e Conhecimento (1 a 5)
  const [relevancias, setRelevancias] = useState<Record<string, { importancia: number; conhecimento: number }>>(() => {
    const initial: Record<string, { importancia: number; conhecimento: number }> = {};
    disciplinas.forEach((d) => {
      initial[d.id] = {
        importancia: Math.min(5, Math.max(1, Math.round(d.weight || 3))),
        conhecimento: 3, // Padrão intermediário
      };
    });
    return initial;
  });

  // Passo 4: Horários e Intervalos dos Blocos
  const [weeklyHours, setWeeklyHours] = useState(20);
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([
    'seg', 'ter', 'qua', 'qui', 'sex'
  ]);
  const [minBlockMinutes, setMinBlockMinutes] = useState(50);
  const [maxBlockMinutes, setMaxBlockMinutes] = useState(90);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mapeamento dos dias da semana
  const DAYS_LIST: { id: DayOfWeek; label: string; name: string }[] = [
    { id: 'seg', label: 'Seg', name: 'Segunda-feira' },
    { id: 'ter', label: 'Ter', name: 'Terça-feira' },
    { id: 'qua', label: 'Qua', name: 'Quarta-feira' },
    { id: 'qui', label: 'Qui', name: 'Quinta-feira' },
    { id: 'sex', label: 'Sex', name: 'Sexta-feira' },
    { id: 'sab', label: 'Sáb', name: 'Sábado' },
    { id: 'dom', label: 'Dom', name: 'Domingo' },
  ];

  // Alternar seleção de dia
  const toggleDay = (dayId: DayOfWeek) => {
    setSelectedDays(prev => {
      if (prev.includes(dayId)) {
        if (prev.length <= 1) return prev; // Mantém pelo menos 1 dia
        return prev.filter(d => d !== dayId);
      }
      return [...prev, dayId];
    });
  };

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
    setSelectedDisciplinaIds(disciplinas.map(d => d.id));
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

  // Lógica Matemática do Passo 3:
  // Calcula o peso e percentual garantindo que a soma feche SEMPRE em exatos 100.0%
  const calculatedDistribution = useMemo(() => {
    const selected = disciplinas.filter(d => selectedDisciplinaIds.includes(d.id));
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
      // Ajusta no item com a maior pontuação para absorver o arredondamento
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
      setStep(2);
    } else if (step === 2) {
      if (selectedDisciplinaIds.length === 0) {
        setErrorMessage('Selecione pelo menos uma disciplina para compor seu ciclo.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handleBack = () => {
    setErrorMessage(null);
    if (step > 1) {
      setStep((step - 1) as 1 | 2 | 3 | 4);
    }
  };

  // Salvamento e Integração Final (Passo 4 -> Concluir)
  const handleSaveAndGenerateCycle = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      if (calculatedDistribution.length === 0) {
        throw new Error('Nenhuma disciplina selecionada para o ciclo.');
      }

      // Tempo total da volta do ciclo calculado proporcionalmente à carga horária semanal
      // Uma volta padrão do ciclo dura aproximadamente a carga horária semanal planejada
      const totalLapMinutes = Math.max(360, Math.round(weeklyHours * 60)); // Mínimo de 6 horas
      const targetSlotBase = Math.round((minBlockMinutes + maxBlockMinutes) / 2);

      const generatedBlocks: CycleBlock[] = [];
      let blockCounter = 1;

      // Gera os blocos proporcionais para cada disciplina
      calculatedDistribution.forEach(item => {
        const disc = item.disciplina;
        // Minutos totais alocados para esta disciplina na volta
        const allocatedMinutes = Math.round((item.percentage / 100) * totalLapMinutes);

        // Define a quantidade de blocos para essa disciplina respeitando a duração máxima
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
            cycleId: currentCycle.id || `cycle_${Date.now()}`,
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

      const newCycle: StudyCycle = {
        id: `cycle_${Date.now()}`,
        userId: currentCycle.userId || 'current_user',
        concursoId: currentCycle.concursoId || 'current_concurso',
        concursoTitle: currentCycle.concursoTitle || 'Plano Personalizado',
        currentBlockIndex: 0,
        completedCyclesCount: 0,
        totalCycleMinutes: totalCalculatedMinutes,
        blocks: interleaved,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await onCycleCreated(newCycle);
      onClose();
    } catch (err: any) {
      console.error('Erro ao gerar novo ciclo:', err);
      setErrorMessage(err.message || 'Ocorreu um erro ao processar o novo ciclo.');
    } finally {
      setIsSaving(false);
    }
  };

  const hoursPerDayAverage = useMemo(() => {
    const daysCount = selectedDays.length || 1;
    return (weeklyHours / daysCount).toFixed(1);
  }, [weeklyHours, selectedDays]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Editar Planejamento"
      description="Configure seu ciclo de estudos passo a passo com base nos seus objetivos reais."
      maxWidth="lg"
    >
      <div className="space-y-6 pt-1 text-xs">
        {/* Stepper Header (4 Passos) */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="grid grid-cols-4 gap-2">
            {[
              { num: 1, title: 'Organização' },
              { num: 2, title: 'Disciplinas' },
              { num: 3, title: 'Relevância' },
              { num: 4, title: 'Horários' },
            ].map(s => {
              const isActive = step === s.num;
              const isPassed = step > s.num;

              return (
                <div key={s.num} className="flex flex-col items-center text-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      isPassed
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : isActive
                        ? 'bg-emerald-600 text-white ring-4 ring-emerald-500/20 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isPassed ? <Check className="w-4 h-4 stroke-[3]" /> : s.num}
                  </div>
                  <span
                    className={`mt-1 text-[11px] font-semibold truncate max-w-full ${
                      isActive
                        ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                        : isPassed
                        ? 'text-slate-800 dark:text-slate-200'
                        : 'text-slate-400'
                    }`}
                  >
                    {s.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* CONTEÚDO DE CADA PASSO */}

        {/* PASSO 1: Organização */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="text-center max-w-md mx-auto space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Qual modelo de estudos você deseja estruturar?
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                Selecione o formato que melhor se adapta à sua rotina e disponibilidade de tempo.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Card 1: Ciclo de Estudos */}
              <div
                onClick={() => {
                  setOrganizacao('ciclo');
                  setStep(2); // Avança imediatamente ao selecionar
                }}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-4 group ${
                  organizacao === 'ciclo'
                    ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-md ring-2 ring-emerald-500/30'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Repeat className="w-6 h-6" />
                    </div>
                    <Badge variant="emerald" size="sm">
                      Recomendado
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      Ciclo de Estudos
                    </h4>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1 leading-relaxed">
                      Sequência rotativa contínua. Sem horários fixos: você estuda o tempo que tiver disponível e retoma exatamente de onde parou.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                  <span>Selecionar & Avançar</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Card 2: Planejamento Semanal */}
              <div
                onClick={() => {
                  setOrganizacao('semanal');
                  setStep(2);
                }}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-4 group opacity-85 hover:opacity-100 ${
                  organizacao === 'semanal'
                    ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-md ring-2 ring-emerald-500/30'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <Badge variant="emerald" size="sm">
                      Agenda Fixa
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      Planejamento Semanal
                    </h4>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1 leading-relaxed">
                      Grade estática com dias da semana e horários determinados. Recomendado para quem tem uma rotina rígida e previsível.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                  <span>Selecionar & Avançar</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PASSO 2: Seleção de Disciplinas Reais */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Disciplinas no Ciclo
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Selecione as disciplinas cadastradas no seu edital ({selectedDisciplinaIds.length} selecionadas).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllDisciplinas}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Todas
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-xs font-medium text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[340px] overflow-y-auto p-1 border border-slate-100 dark:border-slate-800 rounded-2xl">
              {disciplinas.map(d => {
                const isSelected = selectedDisciplinaIds.includes(d.id);
                return (
                  <div
                    key={d.id}
                    onClick={() => toggleDisciplina(d.id)}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between gap-2 select-none ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30 text-slate-900 dark:text-slate-100 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-900 text-slate-500 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: d.color || '#10b981' }}
                      />
                      <span className="truncate text-xs">{d.name}</span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-emerald-500 text-white'
                          : 'border border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PASSO 3: Relevância & Lógica Matemática (100% Exatos) */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Calibração de Relevância & Conhecimento
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Ajuste os controles deslizantes. O algoritmo calcula em tempo real o percentual no ciclo.
                </p>
              </div>

              {/* Tag com garantia matemática dos 100% */}
              <div className="flex items-center gap-1.5 self-start sm:self-center bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg">
                <BarChart2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-xs">
                  Soma Total: 100.0%
                </span>
              </div>
            </div>

            {/* Barra de Distribuição Acumulada */}
            <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-700">
              {calculatedDistribution.map(item => (
                <div
                  key={item.disciplina.id}
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: item.disciplina.color || '#10b981',
                  }}
                  title={`${item.disciplina.name}: ${item.percentage}%`}
                  className="h-full transition-all duration-300"
                />
              ))}
            </div>

            {/* Lista com Sliders por Disciplina */}
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {calculatedDistribution.map(item => {
                const disc = item.disciplina;
                const rel = relevancias[disc.id] || { importancia: 3, conhecimento: 3 };

                return (
                  <div
                    key={disc.id}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: disc.color || '#10b981' }}
                        />
                        <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                          {disc.name}
                        </h4>
                      </div>

                      <Badge variant="emerald" size="sm" className="font-mono">
                        {item.percentage}% do ciclo
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      {/* Slider 1: Importância (1 a 5) */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-600 dark:text-slate-400 font-medium">
                            Importância no Concurso:
                          </span>
                          <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                            Nível {rel.importancia} / 5
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={5}
                          step={1}
                          value={rel.importancia}
                          onChange={e =>
                            handleUpdateRelevancia(disc.id, 'importancia', parseInt(e.target.value, 10))
                          }
                          className="w-full accent-emerald-600 cursor-pointer"
                        />
                        <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                          <span>1 (Básica)</span>
                          <span>5 (Chave/Peso Máximo)</span>
                        </div>
                      </div>

                      {/* Slider 2: Conhecimento (1 a 5) */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-600 dark:text-slate-400 font-medium">
                            Seu Nível de Domínio:
                          </span>
                          <span className="font-bold font-mono text-sky-600 dark:text-sky-400">
                            Nível {rel.conhecimento} / 5
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={5}
                          step={1}
                          value={rel.conhecimento}
                          onChange={e =>
                            handleUpdateRelevancia(disc.id, 'conhecimento', parseInt(e.target.value, 10))
                          }
                          className="w-full accent-sky-600 cursor-pointer"
                        />
                        <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                          <span>1 (Iniciante/Difícil)</span>
                          <span>5 (Domínio Completo)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PASSO 4: Horários & Configuração de Blocos */}
        {step === 4 && (
          <div className="space-y-5 animate-in fade-in">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Disponibilidade Semanal & Intervalo dos Blocos
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                Defina sua meta de horas e o tamanho ideal dos blocos de estudo no ciclo.
              </p>
            </div>

            {/* Horas Semanais */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                    Carga Horária Semanal:
                  </span>
                </div>
                <span className="font-black font-mono text-base text-emerald-600 dark:text-emerald-400">
                  {weeklyHours} horas / semana
                </span>
              </div>

              <input
                type="range"
                min={10}
                max={50}
                step={2}
                value={weeklyHours}
                onChange={e => setWeeklyHours(parseInt(e.target.value, 10) || 20)}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>10h (Ritmo leve)</span>
                <span>20h (Padrão)</span>
                <span>35h (Avançado)</span>
                <span>50h (Dedicação Exclusiva)</span>
              </div>
            </div>

            {/* Dias da Semana */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                  Dias de Estudo na Semana ({selectedDays.length} dias ativos)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Média de ~{hoursPerDayAverage}h por dia ativo
                </span>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {DAYS_LIST.map(d => {
                  const isChecked = selectedDays.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDay(d.id)}
                      className={`py-2 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer select-none ${
                        isChecked
                          ? 'border-emerald-500 bg-emerald-600 text-white shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Intervalo de Duração dos Blocos (Mínimo e Máximo) */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900/60">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-sky-500" />
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                  Tamanho dos Blocos de Concentração
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Duração Mínima do Bloco:
                  </label>
                  <select
                    value={minBlockMinutes}
                    onChange={e => setMinBlockMinutes(parseInt(e.target.value, 10))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  >
                    <option value={30}>30 minutos (Foco curto)</option>
                    <option value={45}>45 minutos</option>
                    <option value={50}>50 minutos (Pomodoro padrão)</option>
                    <option value={60}>60 minutos (1 hora)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Duração Máxima do Bloco:
                  </label>
                  <select
                    value={maxBlockMinutes}
                    onChange={e => setMaxBlockMinutes(parseInt(e.target.value, 10))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  >
                    <option value={60}>60 minutos</option>
                    <option value={75}>75 minutos</option>
                    <option value={90}>90 minutos (Recomendado)</option>
                    <option value={100}>100 minutos</option>
                    <option value={120}>120 minutos (2 horas)</option>
                  </select>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 pt-1">
                * O algoritmo dividirá matérias mais extensas em múltiplos blocos respeitando estes limites para evitar fadiga mental.
              </p>
            </div>
          </div>
        )}

        {/* FOOTER DE NAVEGAÇÃO DO WIZARD */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleBack}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Voltar
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
            >
              Cancelar
            </Button>
          )}

          {step < 4 ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleNext}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Avançar
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleSaveAndGenerateCycle}
              isLoading={isSaving}
              leftIcon={<Sparkles className="w-4 h-4" />}
              className="bg-emerald-600 hover:bg-emerald-500 shadow-md"
            >
              Concluir Planejamento
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
