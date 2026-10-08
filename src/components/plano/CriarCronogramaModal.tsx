import React, { useState, useMemo, useEffect } from 'react';
import { 
  CalendarDays, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  Sliders, 
  BookOpen, 
  Clock, 
  Plus, 
  Minus, 
  AlertCircle,
  BarChart2
} from 'lucide-react';
import { 
  Disciplina, 
  Assunto, 
  StudyPlan, 
  WeeklyAvailability, 
  DayOfWeek, 
  DisciplinaAllocation, 
  Concurso 
} from '../../types';
import { Modal } from '../../design-system/Modal';
import { Button } from '../../design-system/Button';
import { Badge } from '../../design-system/Badge';
import { PlannerService } from '../../services/plannerService';
import { DatabaseService } from '../../services/db';

export interface CriarCronogramaModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: StudyPlan;
  disciplinas: Disciplina[];
  assuntos?: Assunto[];
  concursos?: Concurso[];
  activeConcursoId?: string;
  onPlanCreated: (newPlan: StudyPlan) => Promise<void>;
}

interface DayConfig {
  id: DayOfWeek;
  label: string;
  name: string;
  enabled: boolean;
  hours: number;
}

export const CriarCronogramaModal: React.FC<CriarCronogramaModalProps> = ({
  isOpen,
  onClose,
  plan,
  disciplinas,
  assuntos = [],
  concursos = [],
  activeConcursoId,
  onPlanCreated,
}) => {
  // Concurso ativo resolvido
  const resolvedActiveConcursoId = useMemo(() => {
    if (activeConcursoId) return activeConcursoId;
    if (concursos && concursos.length > 0) {
      const active = concursos.find(c => c.active);
      if (active) return active.id;
      return concursos[0].id;
    }
    if (plan?.concursoId) return plan.concursoId;
    return disciplinas[0]?.concursoId || '';
  }, [activeConcursoId, concursos, plan, disciplinas]);

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

  // Stepper com os 3 passos solicitados: Seleção de Disciplinas, Relevância e Horários
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Passo 1: Seleção de Disciplinas Reais
  const [selectedDisciplinaIds, setSelectedDisciplinaIds] = useState<string[]>(() => {
    if (plan?.disciplinasDistribution && plan.disciplinasDistribution.length > 0 && plan.concursoId === resolvedActiveConcursoId) {
      const existingIds = plan.disciplinasDistribution.map(d => d.disciplinaId);
      const valid = existingIds.filter(id => materiasDoConcursoAtivo.some(m => m.id === id));
      if (valid.length > 0) return valid;
    }
    return materiasDoConcursoAtivo.map(d => d.id);
  });

  // Passo 2: Relevância com Sliders Reais de Importância (1 a 5) e Conhecimento (1 a 5)
  const [relevancias, setRelevancias] = useState<Record<string, { importancia: number; conhecimento: number }>>(() => {
    const initial: Record<string, { importancia: number; conhecimento: number }> = {};
    materiasDoConcursoAtivo.forEach((d) => {
      initial[d.id] = {
        importancia: Math.min(5, Math.max(1, Math.round(d.weight || 3))),
        conhecimento: 3,
      };
    });
    return initial;
  });

  // Passo 3: Horários (Checkboxes de DOM a SÁB com seletor numérico de incremento/decremento + e -)
  const [daysConfig, setDaysConfig] = useState<DayConfig[]>(() => {
    const currentAvail = plan?.weeklyAvailability || {
      dom: 180,
      seg: 240,
      ter: 240,
      qua: 240,
      qui: 240,
      sex: 240,
      sab: 240,
    };

    const daysOrder: { id: DayOfWeek; label: string; name: string }[] = [
      { id: 'dom', label: 'DOM', name: 'Domingo' },
      { id: 'seg', label: 'SEG', name: 'Segunda-feira' },
      { id: 'ter', label: 'TER', name: 'Terça-feira' },
      { id: 'qua', label: 'QUA', name: 'Quarta-feira' },
      { id: 'qui', label: 'QUI', name: 'Quinta-feira' },
      { id: 'sex', label: 'SEX', name: 'Sexta-feira' },
      { id: 'sab', label: 'SÁB', name: 'Sábado' },
    ];

    return daysOrder.map(d => {
      const mins = currentAvail[d.id] || 0;
      const hours = Math.max(1, Math.round(mins / 60)) || 3;
      return {
        ...d,
        enabled: mins > 0 || (d.id !== 'dom'), // Padrão ativo nos dias úteis e sábado
        hours: mins > 0 ? Math.round(mins / 60) : 3,
      };
    });
  });

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setErrorMessage(null);
      setIsSaving(false);
      if (plan?.disciplinasDistribution && plan.disciplinasDistribution.length > 0 && plan.concursoId === resolvedActiveConcursoId) {
        const existingIds = plan.disciplinasDistribution.map(d => d.disciplinaId);
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
  }, [isOpen, plan, resolvedActiveConcursoId, materiasDoConcursoAtivo]);

  // Manipulação de Seleção de Disciplinas (Passo 1)
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

  // Manipulação de Relevância (Passo 2)
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

  // Lógica Matemática do Passo 2:
  // Calcula o percentual fechando em exatos 100.0%
  const calculatedDistribution = useMemo(() => {
    const selected = materiasDoConcursoAtivo.filter(d => selectedDisciplinaIds.includes(d.id));
    if (selected.length === 0) return [];

    const items = selected.map(d => {
      const rel = relevancias[d.id] || { importancia: 3, conhecimento: 3 };
      const imp = rel.importancia;
      const con = rel.conhecimento;
      const necessidade = 6 - con;
      const rawScore = imp * necessidade;
      return {
        disciplina: d,
        importancia: imp,
        conhecimento: con,
        score: rawScore,
        percentage: 0,
      };
    });

    const totalScore = items.reduce((acc, curr) => acc + curr.score, 0) || 1;

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

  // Manipulação de Horários (Passo 3): Checkboxes e Incremento/Decremento
  const handleToggleDay = (dayId: DayOfWeek) => {
    setDaysConfig(prev => prev.map(d => {
      if (d.id === dayId) {
        return { ...d, enabled: !d.enabled };
      }
      return d;
    }));
  };

  const handleIncrementHours = (dayId: DayOfWeek) => {
    setDaysConfig(prev => prev.map(d => {
      if (d.id === dayId) {
        return { ...d, hours: Math.min(14, d.hours + 1) };
      }
      return d;
    }));
  };

  const handleDecrementHours = (dayId: DayOfWeek) => {
    setDaysConfig(prev => prev.map(d => {
      if (d.id === dayId) {
        return { ...d, hours: Math.max(1, d.hours - 1) };
      }
      return d;
    }));
  };

  // Total de horas semanais calculadas em tempo real
  const totalWeeklyHours = useMemo(() => {
    return daysConfig
      .filter(d => d.enabled)
      .reduce((acc, d) => acc + d.hours, 0);
  }, [daysConfig]);

  const activeDaysCount = useMemo(() => {
    return daysConfig.filter(d => d.enabled).length;
  }, [daysConfig]);

  // Avançar nos passos
  const handleNext = () => {
    setErrorMessage(null);
    if (step === 1) {
      if (selectedDisciplinaIds.length === 0) {
        setErrorMessage('Selecione pelo menos uma disciplina para o cronograma.');
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

  // Concluir e Gerar Cronograma Real
  const handleSaveAndGeneratePlan = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      if (selectedDisciplinaIds.length === 0) {
        throw new Error('Selecione ao menos uma disciplina.');
      }
      if (totalWeeklyHours === 0 || activeDaysCount === 0) {
        throw new Error('Marque pelo menos um dia da semana com horas de estudo.');
      }

      // 1. Constrói nova disponibilidade semanal em minutos
      const newAvailability: WeeklyAvailability = {
        dom: 0,
        seg: 0,
        ter: 0,
        qua: 0,
        qui: 0,
        sex: 0,
        sab: 0,
      };

      daysConfig.forEach(d => {
        newAvailability[d.id] = d.enabled ? d.hours * 60 : 0;
      });

      const totalWeeklyMinutes = totalWeeklyHours * 60;

      // 2. Constrói a distribuição proporcional baseada nos percentuais fechados em 100%
      const newDistribution: DisciplinaAllocation[] = calculatedDistribution.map(item => {
        const disc = item.disciplina;
        const allocatedMinutes = Math.round((item.percentage / 100) * totalWeeklyMinutes);
        return {
          disciplinaId: disc.id,
          disciplinaName: disc.name,
          color: disc.color || '#10b981',
          weight: item.importancia,
          difficulty: item.conhecimento <= 2 ? 'dificil' : item.conhecimento === 3 ? 'media' : 'facil',
          importance: item.importancia >= 4 ? 'alta' : 'media',
          progressPercent: 0,
          accuracyRate: 75,
          allocatedMinutesPerWeek: allocatedMinutes,
          allocatedPercentage: Math.round(item.percentage),
        };
      });

      // 3. Recupera dados complementares para gerar as sessões reais
      const [revisoes, questoes] = await Promise.all([
        DatabaseService.getRevisoes(),
        DatabaseService.getQuestoes(),
      ]);

      const selectedDisciplinasList = materiasDoConcursoAtivo.filter(d => selectedDisciplinaIds.includes(d.id));
      const todayStr = PlannerService.formatLocalDate(new Date());

      // 4. Gera as novas sessões do calendário preservando sessões concluídas existentes
      const preservedCompleted = plan?.sessions ? plan.sessions.filter(s => s.status === 'concluida') : [];
      const generated = PlannerService.generateSessions(
        plan?.id || `plan_${Date.now()}`,
        resolvedActiveConcursoId || plan?.concursoId || 'concurso_default',
        todayStr,
        plan?.targetExamDate || '2026-12-31',
        newAvailability,
        selectedDisciplinasList,
        assuntos,
        revisoes,
        newDistribution,
        preservedCompleted
      );

      const activeMatch = concursos.find(c => c.id === resolvedActiveConcursoId);
      const resolvedTitle = activeMatch 
        ? `${activeMatch.organ || activeMatch.orgao || activeMatch.title} - ${activeMatch.role}`
        : plan?.concursoTitle || 'Plano Personalizado';

      // 5. Monta o objeto StudyPlan final completo
      const updatedPlan: StudyPlan = {
        ...plan,
        concursoId: resolvedActiveConcursoId || plan.concursoId,
        concursoTitle: resolvedTitle,
        weeklyAvailability: newAvailability,
        disciplinasDistribution: newDistribution,
        sessions: generated.sessions,
        conflicts: generated.conflicts,
        historyLogs: [
          {
            id: `log_cronograma_${Date.now()}`,
            planId: plan.id,
            action: 'recalculo',
            timestamp: new Date().toISOString(),
            description: `Cronograma recalculado: ${activeDaysCount} dias ativos, ${totalWeeklyHours}h semanais em ${selectedDisciplinasList.length} disciplinas.`,
            preservedCompletedCount: preservedCompleted.length,
            totalStudyMinutes: preservedCompleted.reduce((acc, s) => acc + s.durationMinutes, 0),
          },
          ...(plan?.historyLogs || []),
        ],
        updatedAt: new Date().toISOString(),
      };

      // 6. Salva no banco e notifica a aplicação para renderização imediata do calendário
      await DatabaseService.saveStudyPlan(updatedPlan);
      await onPlanCreated(updatedPlan);
      onClose();
    } catch (err: any) {
      console.error('Erro ao gerar cronograma:', err);
      setErrorMessage(err.message || 'Ocorreu um erro ao processar o cronograma.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Criar Cronograma de Estudos"
      description="Configure suas disciplinas, importância e dias com horários para sua agenda."
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
                Horários (DOM a SÁB)
              </span>
            </div>
          </div>

          <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 dark:bg-slate-800 -z-0">
            <div 
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
            />
          </div>
        </div>

        {/* Alerta de Erro */}
        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* PASSO 1: Seleção de Disciplinas */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-500" />
                  Disciplinas no Cronograma
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Escolha as matérias que serão agendadas na grade semanal.
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
                    Cadastre ou ative um concurso primeiro no menu "Concursos & Provas" para gerar o seu cronograma.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto p-1 pr-2">
                {materiasDoConcursoAtivo.map((disc) => {
                  const isSelected = selectedDisciplinaIds.includes(disc.id);
                  const topicsCount = assuntos.filter(a => a.disciplinaId === disc.id).length;
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
                            {topicsCount} tópicos cadastrados
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
              <span className="text-slate-500">Disciplinas ativas:</span>
              <Badge variant="emerald" size="sm">
                {selectedDisciplinaIds.length} de {materiasDoConcursoAtivo.length} selecionada(s)
              </Badge>
            </div>
          </div>
        )}

        {/* PASSO 2: Relevância (Importância / Conhecimento com 100%) */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-500" />
                  Balanceamento de Carga (100%)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Ajuste a prioridade no edital e seu domínio. O tempo semanal é balanceado matematicamente.
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-600 dark:text-emerald-400 text-xs font-mono font-black">
                <BarChart2 className="w-3.5 h-3.5" />
                <span>100.0% Fechado</span>
              </div>
            </div>

            {/* Barra Visual de Distribuição */}
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

            {/* Sliders das Disciplinas */}
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
                      <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        {item.percentage}% da semana
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Peso no Edital:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {rel.importancia === 1 ? '1 - Baixo' :
                             rel.importancia === 2 ? '2 - Moderado' :
                             rel.importancia === 3 ? '3 - Importante' :
                             rel.importancia === 4 ? '4 - Alto' : '5 - Crítico'}
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

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">Seu Conhecimento:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {rel.conhecimento === 1 ? '1 - Básico' :
                             rel.conhecimento === 2 ? '2 - Iniciante' :
                             rel.conhecimento === 3 ? '3 - Médio' :
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

        {/* PASSO 3: Horários (Checkboxes DOM a SÁB com seletor numérico + e -) */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-emerald-500" />
                  Disponibilidade Diária (DOM a SÁB)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Marque os dias de estudo e use os botões (+) e (-) para definir as horas diárias.
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-700 dark:text-emerald-300 text-xs font-bold font-mono">
                <Clock className="w-3.5 h-3.5" />
                <span>{totalWeeklyHours}h / semana</span>
              </div>
            </div>

            {/* Lista dos Dias da Semana de DOM a SÁB com Checkboxes e Seletor Numérico + e - */}
            <div className="space-y-2 max-h-72 overflow-y-auto p-1 pr-2">
              {daysConfig.map((day) => (
                <div
                  key={day.id}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                    day.enabled
                      ? 'border-emerald-500/40 bg-white dark:bg-slate-900/80 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30 opacity-60'
                  }`}
                >
                  {/* Checkbox do Dia */}
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={day.enabled}
                      onChange={() => handleToggleDay(day.id)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700 cursor-pointer accent-emerald-500"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                          {day.label}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          ({day.name})
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {day.enabled ? `${day.hours} hora(s) programadas` : 'Dia de descanso / livre'}
                      </span>
                    </div>
                  </label>

                  {/* Seletor Numérico com Botões + e - */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!day.enabled || day.hours <= 1}
                      onClick={() => handleDecrementHours(day.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-95"
                      title="Diminuir 1 hora"
                      aria-label={`Diminuir horas de ${day.name}`}
                    >
                      <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>

                    <div className="w-16 py-1 px-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-center font-mono font-black text-xs text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700">
                      {day.enabled ? `${day.hours}h` : '0h'}
                    </div>

                    <button
                      type="button"
                      disabled={!day.enabled || day.hours >= 14}
                      onClick={() => handleIncrementHours(day.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-95"
                      title="Aumentar 1 hora"
                      aria-label={`Aumentar horas de ${day.name}`}
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Painel Informativo Resumo */}
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs space-y-1">
              <div className="flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-300">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  Meta Semanal Total:
                </span>
                <span className="font-mono text-sm">{totalWeeklyHours} horas ({totalWeeklyHours * 60} min)</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Distribuídas em {activeDaysCount} dia(s) na semana. As matérias serão intercaladas automaticamente na grade.
              </p>
            </div>
          </div>
        )}

        {/* NAVEGAÇÃO DOS PASSOS */}
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
                onClick={handleSaveAndGeneratePlan}
                isLoading={isSaving}
                leftIcon={<Check className="w-4 h-4" />}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Concluir & Gerar Cronograma
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
