import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Plus, 
  Edit2, 
  Trash2, 
  Sparkles, 
  CalendarClock, 
  Repeat, 
  BarChart3, 
  CalendarDays, 
  Sliders, 
  History, 
  X,
  RotateCw,
  ChevronRight
} from 'lucide-react';
import { 
  StudyPlan, 
  PlannedSession, 
  WeeklyAvailability, 
  Concurso, 
  Disciplina, 
  Assunto, 
  DayOfWeek, 
  PlanSessionType, 
  PlanSessionStatus, 
  StudyCycle, 
  CycleBlock,
  StudyMethod
} from '../../types';
import { Card, CardHeader, CardBody } from '../../design-system/Card';
import { Button } from '../../design-system/Button';
import { Badge } from '../../design-system/Badge';
import { Modal } from '../../design-system/Modal';
import { PlannerService } from '../../services/plannerService';
import { DatabaseService } from '../../services/db';
import { CalendarView } from './CalendarView';
import { CicloView } from './CicloView';
import { CriarCicloModal } from './CriarCicloModal';
import { CriarCronogramaModal } from './CriarCronogramaModal';
import { MetodoEstudoModal } from './MetodoEstudoModal';
import { EmptyContestState } from '../common/EmptyContestState';
import { useTheme } from '../../contexts/ThemeContext';

interface PlanoViewProps {
  plan?: StudyPlan | null;
  cycle?: StudyCycle | null;
  concursos: Concurso[];
  disciplinas: Disciplina[];
  assuntos: Assunto[];
  activeConcursoId?: string;
  studyMethod?: StudyMethod;
  onNavigateTab?: (tab: any) => void;
  onSwitchMethod?: (method: StudyMethod) => Promise<void> | void;
  onRecalculatePlan: (customAvailability?: WeeklyAvailability, newExamDate?: string) => Promise<void>;
  onAddSession: (session: Omit<PlannedSession, 'id'>) => Promise<void>;
  onUpdateSession: (sessionId: string, partial: Partial<PlannedSession>) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onRescheduleSession: (sessionId: string, newDate: string, reason?: string) => Promise<void>;
  onBatchRescheduleOverdue: (targetDate?: string, mode?: 'today' | 'spread') => Promise<void>;
  onToggleSessionStatus: (sessionId: string, status: PlanSessionStatus) => Promise<void>;
  onOpenStudyTimer: (disciplinaId?: string, assuntoId?: string, durationMinutes?: number | string) => void;
  onAdvanceCycle?: (minutesStudied?: number) => Promise<void>;
  onRewindCycle?: () => Promise<void>;
  onRecordCycleProgress?: (additionalMinutes: number) => Promise<void>;
  onResetCycleLap?: () => Promise<void>;
  onRecalculateCycle?: (baseSlotDuration?: number) => Promise<void>;
  onUpdateCycleBlock?: (blockId: string, partial: Partial<CycleBlock>) => Promise<void>;
  onRemoveCycle?: () => Promise<void>;
  onSaveCycle?: (cycle: StudyCycle) => void;
}

export const PlanoView: React.FC<PlanoViewProps> = ({
  plan,
  cycle,
  concursos,
  disciplinas,
  assuntos,
  activeConcursoId,
  studyMethod = 'ciclo',
  onSwitchMethod,
  onRecalculatePlan,
  onAddSession,
  onUpdateSession,
  onDeleteSession,
  onRescheduleSession,
  onBatchRescheduleOverdue,
  onToggleSessionStatus,
  onOpenStudyTimer,
  onAdvanceCycle = async () => {},
  onRewindCycle = async () => {},
  onRecordCycleProgress = async () => {},
  onResetCycleLap = async () => {},
  onRecalculateCycle = async () => {},
  onUpdateCycleBlock = async () => {},
  onRemoveCycle,
  onNavigateTab,
  onSaveCycle,
}) => {
  const { palette } = useTheme();
  const effectiveActiveConcursoId = useMemo(() => {
    return activeConcursoId || concursos.find(c => c.active)?.id || concursos[0]?.id || '';
  }, [activeConcursoId, concursos]);

  const activeConcurso = useMemo(() => {
    return concursos.find(c => c.id === effectiveActiveConcursoId) || concursos[0] || null;
  }, [concursos, effectiveActiveConcursoId]);

  const activeDisciplinas = useMemo(() => {
    if (!effectiveActiveConcursoId) return disciplinas;
    return disciplinas.filter(d => d.concursoId === effectiveActiveConcursoId);
  }, [disciplinas, effectiveActiveConcursoId]);

  const activeAssuntos = useMemo(() => {
    const discIds = new Set(activeDisciplinas.map(d => d.id));
    return assuntos.filter(a => discIds.has(a.disciplinaId));
  }, [assuntos, activeDisciplinas]);

  if (concursos.length === 0) {
    return (
      <EmptyContestState
        title="Você ainda não possui um concurso ativo"
        description="Cadastre seu concurso foco e importe o conteúdo programático do edital com auxílio da IA para liberar a montagem do seu Ciclo de Estudos e Cronograma Semanal."
        actionText="Cadastrar Concurso Foco"
        onAction={() => onNavigateTab ? onNavigateTab('concursos') : null}
      />
    );
  }

  if (activeDisciplinas.length === 0) {
    return (
      <EmptyContestState
        title="Nenhuma disciplina cadastrada no concurso ativo"
        description="Extraia as disciplinas do edital com IA ou adicione manualmente no menu 'Concursos & Provas' para iniciar o Ciclo de Estudos."
        actionText="Importar Matérias do Concurso"
        onAction={() => onNavigateTab ? onNavigateTab('concursos') : null}
      />
    );
  }

  // Leitura síncrona imediata do localStorage para o concurso ativo
  const readStoredCycle = (targetConcursoId: string): StudyCycle | null => {
    if (!targetConcursoId) return null;
    try {
      const raw = localStorage.getItem(`gabarita_ciclo_estudos_${targetConcursoId}`) ||
                  localStorage.getItem(`gabarita_ciclo_${targetConcursoId}`) ||
                  localStorage.getItem(`gabarita_study_cycle_${targetConcursoId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Erro ao ler ciclo do concurso ativo no localStorage:', e);
    }
    return null;
  };

  const [currentCycle, setCurrentCycle] = useState<StudyCycle | null>(() => {
    if (cycle && cycle.concursoId === effectiveActiveConcursoId && cycle.blocks && cycle.blocks.length > 0) {
      return cycle;
    }
    return readStoredCycle(effectiveActiveConcursoId);
  });

  // Carrega o ciclo estritamente quando o concurso ativo muda
  useEffect(() => {
    if (!effectiveActiveConcursoId) return;

    try {
      const stored = readStoredCycle(effectiveActiveConcursoId);
      if (stored) {
        setCurrentCycle(stored);
        return;
      }

      DatabaseService.getStudyCycle(effectiveActiveConcursoId).then((c) => {
        if (c && c.concursoId === effectiveActiveConcursoId && c.blocks && c.blocks.length > 0) {
          setCurrentCycle(c);
        } else {
          setCurrentCycle(null);
        }
      }).catch((err) => {
        console.error("Erro ao buscar ciclo no DatabaseService:", err);
      });
    } catch (err) {
      console.error("Erro ao carregar ciclo:", err);
    }
  }, [effectiveActiveConcursoId]);

  const effectivePlan: StudyPlan = useMemo(() => {
    if (plan && (!effectiveActiveConcursoId || plan.concursoId === effectiveActiveConcursoId)) {
      return plan;
    }
    const resolvedTitle = activeConcurso
      ? `${activeConcurso.organ || activeConcurso.orgao || activeConcurso.title} - ${activeConcurso.role}`
      : concursos[0]?.title || '';
    return {
      id: `plan_${effectiveActiveConcursoId || 'fallback'}`,
      concursoId: effectiveActiveConcursoId || concursos[0]?.id || '',
      concursoTitle: resolvedTitle,
      userId: 'user_demo_01',
      startDate: new Date().toISOString().split('T')[0],
      targetExamDate: activeConcurso?.examDate ? activeConcurso.examDate.split('T')[0] : new Date(Date.now() + 86400000 * 90).toISOString().split('T')[0],
      dailyAverageMinutes: 240,
      totalWeeks: 12,
      totalPlannedHours: 288,
      weeklyAvailability: { seg: 240, ter: 240, qua: 240, qui: 240, sex: 240, sab: 180, dom: 120 },
      disciplinasDistribution: [],
      sessions: [],
      conflicts: [],
      historyLogs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [plan, effectiveActiveConcursoId, activeConcurso, concursos]);

  const [activeTab, setActiveTab] = useState<'ciclo' | 'cronograma'>(studyMethod === 'cronograma' ? 'cronograma' : 'ciclo');
  const [isMethodModalOpen, setIsMethodModalOpen] = useState(false);
  const [isCreateCycleModalOpen, setIsCreateCycleModalOpen] = useState(false);
  const [isCreateScheduleModalOpen, setIsCreateScheduleModalOpen] = useState(false);
  const [isAddSessionModalOpen, setIsAddSessionModalOpen] = useState(false);
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<PlannedSession | null>(null);

  useEffect(() => {
    if (studyMethod) {
      setActiveTab(studyMethod === 'cronograma' ? 'cronograma' : 'ciclo');
    }
  }, [studyMethod]);

  useEffect(() => {
    const hasCycleBlocks = cycle && cycle.blocks && cycle.blocks.length > 0;
    const hasPlanSessions = effectivePlan && effectivePlan.sessions && effectivePlan.sessions.length > 0;
    if (!hasCycleBlocks && !hasPlanSessions) {
      setIsMethodModalOpen(true);
    }
  }, []);

  const [formDisciplinaId, setFormDisciplinaId] = useState(disciplinas[0]?.id || '');
  const [formAssuntoId, setFormAssuntoId] = useState('');
  const [formAssuntoName, setFormAssuntoName] = useState('');
  const [formDate, setFormDate] = useState(PlannerService.formatLocalDate(new Date()));
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formDurationMinutes, setFormDurationMinutes] = useState(60);
  const [formType, setFormType] = useState<PlanSessionType>('teoria');
  const [formNotes, setFormNotes] = useState('');

  const [tempAvailability, setTempAvailability] = useState<WeeklyAvailability>({ ...effectivePlan.weeklyAvailability });
  const [tempExamDate, setTempExamDate] = useState(effectivePlan.targetExamDate);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const todayStr = useMemo(() => PlannerService.formatLocalDate(new Date()), []);

  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const examDate = PlannerService.parseLocalDate(effectivePlan.targetExamDate);
    const daysUntilExam = Math.max(0, Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    const totalSessions = effectivePlan.sessions.length;
    const completedSessions = effectivePlan.sessions.filter(s => s.status === 'concluida').length;
    const overdueSessions = effectivePlan.sessions.filter(s => s.status === 'atrasada' || (s.date < todayStr && s.status === 'pendente')).length;
    const todaySessions = effectivePlan.sessions.filter(s => s.date === todayStr);
    const weeklyMinutes = Object.values(effectivePlan.weeklyAvailability).reduce((a, b) => a + b, 0);
    const weeklyHours = (weeklyMinutes / 60).toFixed(1);
    const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
    return {
      daysUntilExam,
      totalSessions,
      completedSessions,
      overdueSessions,
      todaySessionsCount: todaySessions.length,
      weeklyHours,
      weeklyMinutes,
      completionRate,
      conflictsCount: effectivePlan.conflicts.length,
    };
  }, [effectivePlan, todayStr]);

  const handleOpenAddSession = (presetDate?: string) => {
    setFormDisciplinaId(disciplinas[0]?.id || '');
    setFormAssuntoId('');
    setFormAssuntoName('');
    setFormDate(presetDate || todayStr);
    setFormStartTime('08:00');
    setFormDurationMinutes(60);
    setFormType('teoria');
    setFormNotes('');
    setEditingSession(null);
    setIsAddSessionModalOpen(true);
  };

  const handleOpenEditSession = (session: PlannedSession) => {
    setEditingSession(session);
    setFormDisciplinaId(session.disciplinaId);
    setFormAssuntoId(session.assuntoId || '');
    setFormAssuntoName(session.assuntoName || '');
    setFormDate(session.date);
    setFormStartTime(session.startTime || '08:00');
    setFormDurationMinutes(session.durationMinutes);
    setFormType(session.type);
    setFormNotes(session.notes || '');
    setIsAddSessionModalOpen(true);
  };

  const handleSaveSessionForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const disc = disciplinas.find(d => d.id === formDisciplinaId);
    if (!disc) return;
    setIsSubmitting(true);
    try {
      const parsedDate = PlannerService.parseLocalDate(formDate);
      const dayOfWeek = PlannerService.getDayOfWeekFromDate(parsedDate);
      const topicMatch = assuntos.find(a => a.id === formAssuntoId);
      const assuntoLabel = formAssuntoName.trim() || topicMatch?.name || 'Tópico Geral';

      if (editingSession) {
        await onUpdateSession(editingSession.id, {
          disciplinaId: disc.id,
          disciplinaName: disc.name,
          disciplinaColor: disc.color,
          assuntoId: formAssuntoId || undefined,
          assuntoName: assuntoLabel,
          date: formDate,
          dayOfWeek,
          startTime: formStartTime,
          durationMinutes: Number(formDurationMinutes),
          type: formType,
          notes: formNotes,
        });
        showFeedback('success', 'Sessão atualizada com sucesso!');
      } else {
        await onAddSession({
          planId: effectivePlan.id,
          concursoId: effectivePlan.concursoId,
          disciplinaId: disc.id,
          disciplinaName: disc.name,
          disciplinaColor: disc.color,
          assuntoId: formAssuntoId || undefined,
          assuntoName: assuntoLabel,
          date: formDate,
          dayOfWeek,
          startTime: formStartTime,
          durationMinutes: Number(formDurationMinutes),
          type: formType,
          status: formDate < todayStr ? 'atrasada' : 'pendente',
          notes: formNotes,
          order: 99,
        });
        showFeedback('success', 'Nova sessão agendada!');
      }
      setIsAddSessionModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler para escolha de método no Modal de Setup
  const handleSelectMethod = async (newMethod: StudyMethod) => {
    setIsMethodModalOpen(false);
    await DatabaseService.setStudyMethod(newMethod);
    if (onSwitchMethod) {
      await onSwitchMethod(newMethod);
    }
    if (newMethod === 'ciclo') {
      setIsCreateCycleModalOpen(true);
    } else {
      setIsCreateScheduleModalOpen(true);
    }
  };

  const handleCycleCreated = async (newCycle: StudyCycle) => {
    setCurrentCycle(newCycle);
    if (onRecalculateCycle) {
      await onRecalculateCycle();
    }
    setActiveTab('ciclo');
    if (onSwitchMethod) {
      await onSwitchMethod('ciclo');
    }
    showFeedback('success', 'Novo Ciclo de Estudos gerado e ativo com sucesso!');
  };

  const handleScheduleCreated = async (newPlan: StudyPlan) => {
    await onRecalculatePlan(newPlan.weeklyAvailability, newPlan.targetExamDate);
    setActiveTab('cronograma');
    if (onSwitchMethod) {
      await onSwitchMethod('cronograma');
    }
    showFeedback('success', 'Novo Cronograma gerado e integrado com sucesso!');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {feedback && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-xl">
          {feedback.message}
        </div>
      )}

      {/* Barra Superior com Título de Seção e Botão Replanejar Método */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Formato de Estudo
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Selecione entre rotação contínua proporcional ou grade semanal fixa
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMethodModalOpen(true)}
            leftIcon={<Sliders className="w-4 h-4" style={{ color: palette.primary }} />}
            className="cursor-pointer font-semibold border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 shadow-xs"
          >
            Replanejar Método
          </Button>
        </div>
      </div>

      {/* Dois Grandes Cards Seletores (Banners de Modo) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card 1: CICLO DE ESTUDOS */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('ciclo');
            if (onSwitchMethod) onSwitchMethod('ciclo');
          }}
          className={`card-seletor-modo relative overflow-hidden rounded-2xl p-4 sm:p-5 text-left transition-all duration-300 cursor-pointer flex items-center justify-between gap-4 group ${
            activeTab === 'ciclo'
              ? 'bg-gradient-to-r from-primary via-primary-600 to-primary-700 text-white shadow-lg shadow-primary/20 border border-transparent'
              : 'bg-white hover:bg-slate-50 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 shadow-xs text-slate-800 dark:text-slate-200'
          }`}
          style={activeTab === 'ciclo' ? {
            background: `linear-gradient(135deg, ${palette.primaryHover || palette.primary} 0%, ${palette.primary} 50%, ${palette.secondary || palette.primary} 100%)`,
            boxShadow: `0 10px 25px -5px ${palette.glowColor || `${palette.primary}40`}`
          } : undefined}
        >
          {/* Efeito decorativo de fundo translúcido para o card ativo */}
          {activeTab === 'ciclo' && (
            <div className="absolute -right-4 -bottom-4 w-28 h-28 rounded-full bg-white/10 pointer-events-none blur-[1px]" />
          )}

          <div className="relative z-10 flex items-center gap-4 min-w-0">
            {/* Container do Ícone à esquerda */}
            <div 
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 card-seletor-icon ${
                activeTab === 'ciclo'
                  ? 'bg-white/20 backdrop-blur-sm border border-white/30 card-seletor-icon-active'
                  : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {activeTab === 'ciclo' ? (
                <RotateCw className="w-6 h-6 text-white stroke-[2.2]" />
              ) : (
                <RotateCw className="text-slate-500 dark:text-slate-400 w-6 h-6 stroke-[2]" />
              )}
            </div>

            <div className="min-w-0">
              <h3 className={`text-sm sm:text-base font-bold tracking-wide ${
                activeTab === 'ciclo' ? 'text-white' : 'text-slate-800 dark:text-slate-200'
              }`}>
                CICLO DE ESTUDOS
              </h3>
              <p className={`text-xs font-medium leading-relaxed mt-0.5 ${
                activeTab === 'ciclo' ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'
              }`}>
                Estude de forma inteligente, com base no seu desempenho e nas prioridades.
              </p>
            </div>
          </div>

          <div className="relative z-10 shrink-0 pl-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all group-hover:translate-x-0.5 ${
              activeTab === 'ciclo' 
                ? 'bg-white/20 border border-white/30 text-white' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
            }`}>
              <ChevronRight className="w-5 h-5" />
            </div>
          </div>
        </button>

        {/* Card 2: CRONOGRAMA */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('cronograma');
            if (onSwitchMethod) onSwitchMethod('cronograma');
          }}
          className={`card-seletor-modo relative overflow-hidden rounded-2xl p-4 sm:p-5 text-left transition-all duration-300 cursor-pointer flex items-center justify-between gap-4 group ${
            activeTab === 'cronograma'
              ? 'bg-gradient-to-r from-primary via-primary-600 to-primary-700 text-white shadow-lg shadow-primary/20 border border-transparent'
              : 'bg-white hover:bg-slate-50 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 shadow-xs text-slate-800 dark:text-slate-200'
          }`}
          style={activeTab === 'cronograma' ? {
            background: `linear-gradient(135deg, ${palette.primaryHover || palette.primary} 0%, ${palette.primary} 50%, ${palette.secondary || palette.primary} 100%)`,
            boxShadow: `0 10px 25px -5px ${palette.glowColor || `${palette.primary}40`}`
          } : undefined}
        >
          {/* Efeito decorativo de fundo translúcido para o card ativo */}
          {activeTab === 'cronograma' && (
            <div className="absolute -right-4 -bottom-4 w-28 h-28 rounded-full bg-white/10 pointer-events-none blur-[1px]" />
          )}

          <div className="relative z-10 flex items-center gap-4 min-w-0">
            {/* Container do Ícone à esquerda */}
            <div 
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 card-seletor-icon ${
                activeTab === 'cronograma'
                  ? 'bg-white/20 backdrop-blur-sm border border-white/30 card-seletor-icon-active'
                  : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {activeTab === 'cronograma' ? (
                <Calendar className="w-6 h-6 text-white stroke-[2.2]" />
              ) : (
                <Calendar className="text-slate-500 dark:text-slate-400 w-6 h-6 stroke-[2]" />
              )}
            </div>

            <div className="min-w-0">
              <h3 className={`text-sm sm:text-base font-bold tracking-wide ${
                activeTab === 'cronograma' ? 'text-white' : 'text-slate-800 dark:text-slate-200'
              }`}>
                CRONOGRAMA
              </h3>
              <p className={`text-xs font-medium leading-relaxed mt-0.5 ${
                activeTab === 'cronograma' ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'
              }`}>
                Veja seu plano de estudos, organize seu tempo e mantenha o foco.
              </p>
            </div>
          </div>

          <div className="relative z-10 shrink-0 pl-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all group-hover:translate-x-0.5 ${
              activeTab === 'cronograma' 
                ? 'bg-white/20 border border-white/30 text-white' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
            }`}>
              <ChevronRight className="w-5 h-5" />
            </div>
          </div>
        </button>
      </div>

      {/* Conteúdo da Aba Ativa */}
      {activeTab === 'ciclo' ? (
        <CicloView
          cycle={currentCycle || cycle || {
            id: `cycle_${effectiveActiveConcursoId}`,
            userId: 'user',
            concursoId: effectiveActiveConcursoId || '',
            concursoTitle: activeConcurso ? `${activeConcurso.organ || activeConcurso.orgao || activeConcurso.title} - ${activeConcurso.role}` : 'Plano Personalizado',
            currentBlockIndex: 0,
            completedCyclesCount: 0,
            totalCycleMinutes: 0,
            blocks: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          disciplinas={activeDisciplinas}
          assuntos={activeAssuntos}
          activeConcursoId={effectiveActiveConcursoId}
          concursos={concursos}
          onAdvanceCycle={onAdvanceCycle}
          onRewindCycle={onRewindCycle}
          onRecordCycleProgress={onRecordCycleProgress}
          onResetCycleLap={onResetCycleLap}
          onRecalculateCycle={onRecalculateCycle}
          onUpdateCycleBlock={onUpdateCycleBlock}
          onOpenStudyTimer={onOpenStudyTimer}
          onSaveNewCycle={async (newC) => {
            setCurrentCycle(newC);
            if (onSaveCycle) onSaveCycle(newC);
          }}
          onSwitchMethod={onSwitchMethod}
          onRemoveCycle={async () => {
            if (onRemoveCycle) await onRemoveCycle();
            const cleared = await DatabaseService.removeStudyCycle();
            setCurrentCycle(cleared);
            if (onSaveCycle) onSaveCycle(cleared);
          }}
          onReplan={() => setIsMethodModalOpen(true)}
        />
      ) : (
        <div className="space-y-6">
          {/* Header do Cronograma Fixo */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-[var(--primary-light)] text-[var(--primary-color)] dark:text-[var(--primary-text-dark)]">
                    <CalendarClock className="w-6 h-6" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">
                        Cronograma Fixo de Estudos
                      </h1>
                      <Badge variant="sky" size="sm">{effectivePlan.concursoTitle || 'Concurso Foco'}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Grade semanal e distribuição em calendário com horários e dias fixos.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMethodModalOpen(true)}
                  leftIcon={<Sliders className="w-4 h-4 text-[var(--primary-color)] dark:text-[var(--primary-text-dark)]" />}
                  className="cursor-pointer font-semibold"
                >
                  Replanejar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateScheduleModalOpen(true)}
                  leftIcon={<RefreshCw className="w-4 h-4 text-[var(--primary-color)] dark:text-[var(--primary-text-dark)]" />}
                  className="cursor-pointer"
                >
                  Recalcular
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleOpenAddSession()}
                  leftIcon={<Plus className="w-4 h-4" />}
                  className="cursor-pointer"
                >
                  Nova Sessão
                </Button>
              </div>
            </div>

            {/* Métricas do Cronograma */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-medium block text-[11px]">Contagem Regressiva</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono">{metrics.daysUntilExam}</span>
                  <span className="text-slate-500 text-xs font-semibold">dias para a prova</span>
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-medium block text-[11px]">Carga Semanal</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{metrics.weeklyHours}h</span>
                  <span className="text-slate-500 text-xs font-semibold">/ semana</span>
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-medium block text-[11px]">Progresso do Plano</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-black text-[var(--primary-color)] dark:text-[var(--primary-text-dark)] font-mono">{metrics.completionRate}%</span>
                  <span className="text-slate-500 text-xs font-semibold">({metrics.completedSessions}/{metrics.totalSessions})</span>
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-medium block text-[11px]">Status</span>
                <div className="flex items-center gap-1.5 mt-1">
                  {metrics.overdueSessions > 0 ? (
                    <Badge variant="rose" size="sm">{metrics.overdueSessions} atrasada(s)</Badge>
                  ) : (
                    <Badge variant="emerald" size="sm">Em dia</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Visualização de Calendário Executível */}
          <CalendarView
            plan={effectivePlan}
            disciplinas={activeDisciplinas}
            assuntos={activeAssuntos}
            concursos={concursos}
            onRescheduleSession={onRescheduleSession}
            onBatchRescheduleOverdue={onBatchRescheduleOverdue}
            onToggleSessionStatus={onToggleSessionStatus}
            onOpenStudyTimer={onOpenStudyTimer}
            onOpenEditSession={handleOpenEditSession}
            onOpenAddSession={handleOpenAddSession}
            onDeleteSession={onDeleteSession}
            onSwitchMethod={handleSelectMethod}
            onPlanCreated={handleScheduleCreated}
          />
        </div>
      )}

      {/* Modal: Adicionar/Editar Sessão */}
      <Modal
        isOpen={isAddSessionModalOpen}
        onClose={() => setIsAddSessionModalOpen(false)}
        title={editingSession ? "Editar Sessão" : "Nova Sessão de Estudos"}
        maxWidth="md"
      >
        <form onSubmit={handleSaveSessionForm} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold mb-1">Disciplina *</label>
            <select
              value={formDisciplinaId}
              onChange={(e) => setFormDisciplinaId(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              required
            >
              {disciplinas.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-bold mb-1">Tópico</label>
            <input
              type="text"
              value={formAssuntoName}
              onChange={(e) => setFormAssuntoName(e.target.value)}
              placeholder="Ex: Licitações"
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1">Data *</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                required
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Duração (min)</label>
              <select
                value={formDurationMinutes}
                onChange={(e) => setFormDurationMinutes(parseInt(e.target.value, 10))}
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value={30}>30 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
                <option value={120}>120 min</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsAddSessionModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>Salvar</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Setup do Plano (Escolha Obrigatória de Método com os dois cards grandes) */}
      <MetodoEstudoModal
        isOpen={isMethodModalOpen}
        onClose={() => setIsMethodModalOpen(false)}
        currentMethod={activeTab}
        onSelectMethod={handleSelectMethod}
        title="Setup do Plano: Escolha seu Método de Estudo"
        description="Selecione o método de estudo ideal para sua rotina antes de prosseguir com o planejamento."
      />

      {/* Modal: Criar / Replanejar Ciclo (Passos 1, 2 e 3) */}
      <CriarCicloModal
        isOpen={isCreateCycleModalOpen}
        onClose={() => setIsCreateCycleModalOpen(false)}
        disciplinas={disciplinas}
        currentCycle={currentCycle || cycle}
        assuntos={assuntos}
        activeConcursoId={effectiveActiveConcursoId}
        concursos={concursos}
        onCycleCreated={handleCycleCreated}
      />

      {/* Modal: Criar / Replanejar Cronograma (Passos 1, 2 e 3) */}
      <CriarCronogramaModal
        isOpen={isCreateScheduleModalOpen}
        onClose={() => setIsCreateScheduleModalOpen(false)}
        plan={effectivePlan}
        disciplinas={disciplinas}
        assuntos={assuntos}
        concursos={concursos}
        activeConcursoId={effectiveActiveConcursoId}
        onPlanCreated={handleScheduleCreated}
      />
    </div>
  );
};
