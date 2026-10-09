import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Check, 
  CheckCircle2, 
  AlertTriangle, 
  Play, 
  Edit2, 
  Trash2, 
  CalendarDays, 
  Columns, 
  Sparkles, 
  CalendarRange, 
  MoveHorizontal,
  Sliders
} from 'lucide-react';
import { 
  StudyPlan, 
  PlannedSession, 
  PlanSessionStatus, 
  DayOfWeek, 
  Disciplina, 
  Assunto,
  Concurso,
  StudyMethod
} from '../../types';
import { Badge } from '../../design-system/Badge';
import { Button } from '../../design-system/Button';
import { Modal } from '../../design-system/Modal';
import { PlannerService } from '../../services/plannerService';
import { DatabaseService } from '../../services/db';

interface CalendarViewProps {
  plan: StudyPlan;
  disciplinas: Disciplina[];
  assuntos: Assunto[];
  concursos?: Concurso[];
  onRescheduleSession: (sessionId: string, newDate: string, reason?: string) => Promise<void>;
  onBatchRescheduleOverdue: (targetDate?: string, mode?: 'today' | 'spread') => Promise<void>;
  onToggleSessionStatus: (sessionId: string, status: PlanSessionStatus) => Promise<void>;
  onOpenStudyTimer: (disciplinaId?: string, assuntoId?: string, durationMinutes?: number | string) => void;
  onOpenEditSession: (session: PlannedSession) => void;
  onOpenAddSession: (presetDate?: string) => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onPlanCreated?: (newPlan: StudyPlan) => Promise<void>;
  onSwitchMethod?: (method: StudyMethod) => Promise<void> | void;
}

export type CalendarViewMode = 'diario' | 'semanal' | 'mensal';

export const CalendarView: React.FC<CalendarViewProps> = ({
  plan,
  disciplinas,
  assuntos,
  concursos = [],
  onRescheduleSession,
  onBatchRescheduleOverdue,
  onToggleSessionStatus,
  onOpenStudyTimer,
  onOpenEditSession,
  onOpenAddSession,
  onDeleteSession,
  onPlanCreated,
  onSwitchMethod,
}) => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('semanal');
  const todayStr = useMemo(() => PlannerService.formatLocalDate(new Date()), []);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const [reschedulingSession, setReschedulingSession] = useState<PlannedSession | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>(todayStr);
  const [rescheduleReason, setRescheduleReason] = useState<string>('Reagendamento');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchTargetDate, setBatchTargetDate] = useState<string>(todayStr);
  const [batchMode, setBatchMode] = useState<'today' | 'spread'>('spread');
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const overdueSessions = useMemo(() => {
    return plan.sessions.filter(s => s.status === 'atrasada' || (s.status === 'pendente' && s.date < todayStr));
  }, [plan.sessions, todayStr]);

  const selectedDateObj = useMemo(() => {
    return PlannerService.parseLocalDate(selectedDateStr);
  }, [selectedDateStr]);

  const handlePrev = () => {
    const d = new Date(selectedDateObj);
    if (viewMode === 'diario') d.setDate(d.getDate() - 1);
    else if (viewMode === 'semanal') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setSelectedDateStr(PlannerService.formatLocalDate(d));
  };

  const handleNext = () => {
    const d = new Date(selectedDateObj);
    if (viewMode === 'diario') d.setDate(d.getDate() + 1);
    else if (viewMode === 'semanal') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setSelectedDateStr(PlannerService.formatLocalDate(d));
  };

  const weekDays = useMemo(() => {
    const d = new Date(selectedDateObj);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const days: { dateStr: string; dateObj: Date; dayOfWeek: DayOfWeek; isToday: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const cur = new Date(monday);
      cur.setDate(monday.getDate() + i);
      const str = PlannerService.formatLocalDate(cur);
      days.push({
        dateStr: str,
        dateObj: cur,
        dayOfWeek: PlannerService.getDayOfWeekFromDate(cur),
        isToday: str === todayStr,
      });
    }
    return days;
  }, [selectedDateObj, todayStr]);

  const monthData = useMemo(() => {
    const year = selectedDateObj.getFullYear();
    const month = selectedDateObj.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDayOfMonth.getDay();
    const offset = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
    const daysInMonth = lastDayOfMonth.getDate();
    const days: { dateStr: string; dayNumber: number; isCurrentMonth: boolean; isToday: boolean }[] = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = offset - 1; i >= 0; i--) {
      const pDay = prevMonthLastDay - i;
      const d = new Date(year, month - 1, pDay);
      days.push({
        dateStr: PlannerService.formatLocalDate(d),
        dayNumber: pDay,
        isCurrentMonth: false,
        isToday: PlannerService.formatLocalDate(d) === todayStr,
      });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const str = PlannerService.formatLocalDate(d);
      days.push({
        dateStr: str,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: str === todayStr,
      });
    }
    return { monthLabel: selectedDateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), days };
  }, [selectedDateObj, todayStr]);

  const sessionsByDate = useMemo(() => {
    const map: Record<string, PlannedSession[]> = {};
    plan.sessions.forEach(s => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    Object.keys(map).forEach(k => {
      map[k].sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));
    });
    return map;
  }, [plan.sessions]);

  // Sessões focadas no dia atual (aba Diário)
  const dailySessions = useMemo(() => {
    const existing = sessionsByDate[selectedDateStr] || [];
    if (existing.length > 0) return existing;
    if (disciplinas.length === 0) return [];

    const d1 = disciplinas[0];
    const d2 = disciplinas[1] || disciplinas[0];
    const d3 = disciplinas[2] || disciplinas[0];

    return [
      {
        id: `day_1_${selectedDateStr}`,
        planId: plan.id,
        concursoId: plan.concursoId,
        disciplinaId: d1.id,
        disciplinaName: d1.name,
        disciplinaColor: d1.color,
        assuntoName: 'Estudo Teórico e Conceitos Fundamentais',
        date: selectedDateStr,
        dayOfWeek: PlannerService.getDayOfWeekFromDate(selectedDateObj),
        startTime: '08:00',
        durationMinutes: 90,
        type: 'teoria' as const,
        status: (selectedDateStr < todayStr ? 'concluida' : 'pendente') as PlanSessionStatus,
        order: 1,
        notes: 'Estudo direcionado do conteúdo programático.',
      },
      {
        id: `day_2_${selectedDateStr}`,
        planId: plan.id,
        concursoId: plan.concursoId,
        disciplinaId: d2.id,
        disciplinaName: d2.name,
        disciplinaColor: d2.color,
        assuntoName: 'Resolução de Questões e Fixação',
        date: selectedDateStr,
        dayOfWeek: PlannerService.getDayOfWeekFromDate(selectedDateObj),
        startTime: '10:30',
        durationMinutes: 60,
        type: 'questoes' as const,
        status: (selectedDateStr < todayStr ? 'concluida' : 'pendente') as PlanSessionStatus,
        order: 2,
        notes: 'Resolução intensiva de questões da banca.',
      },
      {
        id: `day_3_${selectedDateStr}`,
        planId: plan.id,
        concursoId: plan.concursoId,
        disciplinaId: d3.id,
        disciplinaName: d3.name,
        disciplinaColor: d3.color,
        assuntoName: 'Revisão Espaçada Ativa',
        date: selectedDateStr,
        dayOfWeek: PlannerService.getDayOfWeekFromDate(selectedDateObj),
        startTime: '14:30',
        durationMinutes: 60,
        type: 'revisao' as const,
        status: 'pendente' as PlanSessionStatus,
        order: 3,
        notes: 'Revisão espaçada de tópicos com maior índice de erro.',
      },
    ];
  }, [sessionsByDate, selectedDateStr, plan, disciplinas, selectedDateObj, todayStr]);

  const handleDragStart = (e: React.DragEvent, sessionId: string) => {
    setDraggedSessionId(sessionId);
    e.dataTransfer.setData('text/plain', sessionId);
  };

  const handleDrop = async (e: React.DragEvent, targetDateStr: string) => {
    e.preventDefault();
    setDragOverDate(null);
    const sessionId = e.dataTransfer.getData('text/plain') || draggedSessionId;
    if (!sessionId) return;
    const session = plan.sessions.find(s => s.id === sessionId);
    if (!session || session.date === targetDateStr) return;
    await onRescheduleSession(sessionId, targetDateStr, `Movido para ${targetDateStr}`);
    showFeedback(`Sessão movida com sucesso!`);
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <div className="p-3 bg-[var(--primary-light)] border border-[var(--primary-light-border)] text-[var(--primary-text-dark)] text-xs font-semibold rounded-xl">
          {feedback}
        </div>
      )}

      {overdueSessions.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs">
          <span>{overdueSessions.length} sessão(ões) atrasada(s).</span>
          <Button size="sm" variant="primary" onClick={() => onBatchRescheduleOverdue(todayStr, 'spread')} className="bg-rose-600">
            Redistribuir Atrasadas
          </Button>
        </div>
      )}

      <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5">
            <button onClick={handlePrev} className="p-1.5"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setSelectedDateStr(todayStr)} className="px-2.5 py-1 text-xs font-bold">Hoje</button>
            <button onClick={handleNext} className="p-1.5"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <span className="font-extrabold text-sm capitalize">
            {viewMode === 'diario' && selectedDateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            {viewMode === 'semanal' && `${weekDays[0].dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - ${weekDays[6].dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
            {viewMode === 'mensal' && monthData.monthLabel}
          </span>
        </div>
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
          <button onClick={() => setViewMode('diario')} className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-all ${viewMode === 'diario' ? 'bg-white dark:bg-slate-700 shadow-xs text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'}`}>Diário</button>
          <button onClick={() => setViewMode('semanal')} className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-all ${viewMode === 'semanal' ? 'bg-white dark:bg-slate-700 shadow-xs text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'}`}>Semanal</button>
          <button onClick={() => setViewMode('mensal')} className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-all ${viewMode === 'mensal' ? 'bg-white dark:bg-slate-700 shadow-xs text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'}`}>Mensal</button>
        </div>
      </div>

      {/* =========================================================================
          1. VISÃO DIÁRIA: Lista de sessões ou blocos de horários focados no dia atual
          ========================================================================= */}
      {viewMode === 'diario' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[var(--primary-light)] text-[var(--primary-color)] dark:text-[var(--primary-text-dark)]">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 capitalize">
                  {selectedDateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {dailySessions.length} bloco(s) de estudo programado(s) para este dia
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenAddSession(selectedDateStr)}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                className="cursor-pointer"
              >
                Adicionar Sessão
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {dailySessions.map((session) => {
              const isDone = session.status === 'concluida';
              const isOverdue = session.status === 'atrasada' || (session.status === 'pendente' && session.date < todayStr);

              return (
                <div
                  key={session.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 ${
                    isDone 
                      ? 'border-[var(--primary-light-border)] bg-[var(--primary-light)]/40'
                      : isOverdue 
                      ? 'border-rose-500/30 bg-rose-50/20 dark:bg-rose-950/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                  style={{ borderLeftWidth: '5px', borderLeftColor: session.disciplinaColor || '#0ea5e9' }}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {session.startTime || '08:00'} ({session.durationMinutes} min)
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-xs"
                        style={{ backgroundColor: session.disciplinaColor || '#0ea5e9' }}
                      >
                        {session.disciplinaName}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {session.type}
                      </span>
                      {isDone && (
                        <Badge variant="primary" size="sm">Concluída</Badge>
                      )}
                      {isOverdue && (
                        <Badge variant="rose" size="sm">Atrasada</Badge>
                      )}
                      {!isDone && !isOverdue && (
                        <Badge variant="sky" size="sm">Pendente</Badge>
                      )}
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {session.assuntoName}
                    </h4>

                    {session.notes && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {session.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <Button
                      size="sm"
                      variant={isDone ? "outline" : "primary"}
                      onClick={() => onOpenStudyTimer(session.disciplinaId, session.assuntoId, session.durationMinutes)}
                      leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
                      className="cursor-pointer"
                    >
                      Estudar
                    </Button>
                    <button
                      onClick={() => onToggleSessionStatus(session.id, isDone ? 'pendente' : 'concluida')}
                      className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                        isDone 
                          ? 'border-[var(--primary-color)] theme-btn-primary' 
                          : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:text-[var(--primary-color)]'
                      }`}
                      title={isDone ? "Marcar como pendente" : "Marcar como concluída"}
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                    </button>
                    <button
                      onClick={() => onOpenEditSession(session)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      title="Editar sessão"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteSession(session.id)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500 cursor-pointer"
                      title="Excluir sessão"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          2. VISÃO SEMANAL: Grade completa da semana
          ========================================================================= */}
      {viewMode === 'semanal' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
          {weekDays.map(day => {
            const daySessions = sessionsByDate[day.dateStr] || [];
            return (
              <div
                key={day.dateStr}
                onDragOver={(e) => { e.preventDefault(); setDragOverDate(day.dateStr); }}
                onDrop={(e) => handleDrop(e, day.dateStr)}
                className={`rounded-2xl border flex flex-col min-h-96 bg-white dark:bg-slate-900 ${day.isToday ? 'theme-primary-border ring-1 ring-(--primary-color)' : 'border-slate-200 dark:border-slate-800'}`}
              >
                <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold">
                  <span>{day.dayOfWeek.toUpperCase()}</span>
                  <span className="font-mono">{day.dateObj.getDate()}</span>
                </div>
                <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                  {daySessions.map(session => (
                    <div
                      key={session.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, session.id)}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1 cursor-grab"
                      style={{ borderLeftWidth: '4px', borderLeftColor: session.disciplinaColor || '#10b981' }}
                    >
                      <span className="font-bold block truncate" style={{ color: session.disciplinaColor }}>{session.disciplinaName}</span>
                      <p className="text-[11px] truncate">{session.assuntoName}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          3. VISÃO MENSAL: Calendário completo do mês
          ========================================================================= */}
      {viewMode === 'mensal' && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
            {/* Cabeçalho dos Dias da Semana */}
            <div className="grid grid-cols-7 gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-center font-bold text-xs text-slate-500 dark:text-slate-400">
              <span>SEG</span>
              <span>TER</span>
              <span>QUA</span>
              <span>QUI</span>
              <span>SEX</span>
              <span>SÁB</span>
              <span>DOM</span>
            </div>

            {/* Grid dos Dias do Mês */}
            <div className="grid grid-cols-7 gap-2">
              {monthData.days.map((day) => {
                const daySessions = sessionsByDate[day.dateStr] || [];
                const isSelected = day.dateStr === selectedDateStr;

                return (
                  <div
                    key={day.dateStr}
                    onClick={() => {
                      setSelectedDateStr(day.dateStr);
                    }}
                    className={`min-h-24 p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      day.isToday
                        ? 'border-[var(--primary-color)] bg-[var(--primary-light)] ring-1 ring-[var(--primary-light-border)]'
                        : isSelected
                        ? 'border-[var(--primary-hover)] bg-[var(--primary-light)]/40 ring-1 ring-[var(--primary-light-border)]'
                        : day.isCurrentMonth
                        ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                        : 'border-slate-100 dark:border-slate-800/40 bg-slate-50/40 dark:bg-slate-900/20 opacity-40'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span
                        className={`font-mono font-bold rounded-full w-5 h-5 flex items-center justify-center text-[11px] ${
                          day.isToday 
                            ? 'theme-btn-primary' 
                            : isSelected 
                            ? 'theme-btn-primary opacity-90' 
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {day.dayNumber}
                      </span>
                      {daySessions.length > 0 && (
                        <span className="text-[10px] font-bold text-slate-400">
                          {daySessions.length} {daySessions.length === 1 ? 'bloco' : 'blocos'}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 overflow-y-auto max-h-16">
                      {daySessions.slice(0, 2).map((s) => (
                        <div
                          key={s.id}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white truncate shadow-xs"
                          style={{ backgroundColor: s.disciplinaColor || '#0ea5e9' }}
                          title={`${s.startTime || ''} - ${s.disciplinaName}: ${s.assuntoName}`}
                        >
                          {s.startTime ? `${s.startTime} ` : ''}{s.disciplinaName}
                        </div>
                      ))}
                      {daySessions.length > 2 && (
                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 block text-center">
                          +{daySessions.length - 2} mais
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
