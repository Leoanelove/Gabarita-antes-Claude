import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  Clock, 
  BookOpen, 
  Sparkles, 
  Award, 
  HelpCircle, 
  Target, 
  Flame, 
  Plus, 
  Check, 
  X, 
  Calendar, 
  FileText, 
  TrendingUp, 
  BarChart2, 
  Trash2, 
  Edit3, 
  Layers, 
  ArrowRight,
  AlertCircle,
  History 
} from 'lucide-react';
import { 
  Disciplina, 
  Assunto, 
  StudySessionType, 
  SessaoEstudo, 
  StudyPlan, 
  StudyCycle, 
  UserProfile 
} from '../../types';
import { Card, CardHeader, CardBody } from '../../design-system/Card';
import { Button } from '../../design-system/Button';
import { Badge } from '../../design-system/Badge';
import { Modal } from '../../design-system/Modal';
import { Input } from '../../design-system/Input';
import { TimerService, ActiveTimerState } from '../../services/timerService';
import { PlannerService } from '../../services/plannerService';

interface SessaoEstudoViewProps {
  user: UserProfile;
  disciplinas: Disciplina[];
  assuntos: Assunto[];
  sessoes: SessaoEstudo[];
  plan?: StudyPlan | null;
  cycle?: StudyCycle | null;
  initialDisciplinaId?: string;
  initialAssuntoId?: string;
  onSaveSession: (session: {
    disciplinaId: string;
    assuntoId?: string;
    durationMinutes: number;
    plannedMinutes?: number;
    type: StudySessionType;
    questionsAttempted?: number;
    questionsCorrect?: number;
    notes?: string;
  }) => Promise<void>;
  onDeleteSession?: (sessionId: string) => Promise<void>;
  onAdvanceCycle?: (minutesStudied?: number) => Promise<void>;
  onTogglePlanSession?: (sessionId: string, status: 'concluida') => Promise<void>;
  onOpenStudyTimer?: (disciplinaId?: string, assuntoId?: string) => void;
}

type TabMode = 'foco' | 'manual' | 'historico';

export const SessaoEstudoView: React.FC<SessaoEstudoViewProps> = ({
  user,
  disciplinas,
  assuntos,
  sessoes,
  plan,
  cycle,
  initialDisciplinaId,
  initialAssuntoId,
  onSaveSession,
  onDeleteSession,
  onAdvanceCycle,
  onTogglePlanSession,
  onOpenStudyTimer,
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>('foco');
  const [timerState, setTimerState] = useState<ActiveTimerState | null>(() => TimerService.getActiveTimer());
  const [currentSeconds, setCurrentSeconds] = useState<number>(() => {
    const active = TimerService.getActiveTimer();
    return active ? active.accumulatedSeconds : 0;
  });

  const [manualDisciplinaId, setManualDisciplinaId] = useState(disciplinas[0]?.id || '');
  const [manualAssuntoId, setManualAssuntoId] = useState('');
  const [manualDurationMinutes, setManualDurationMinutes] = useState(60);
  const [manualType, setManualType] = useState<StudySessionType>('teoria');
  const [manualDate, setManualDate] = useState(PlannerService.formatLocalDate(new Date()));
  const [manualQuestionsAttempted, setManualQuestionsAttempted] = useState<number | ''>('');
  const [manualQuestionsCorrect, setManualQuestionsCorrect] = useState<number | ''>('');
  const [manualNotes, setManualNotes] = useState('');
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);

  const [completedSummary, setCompletedSummary] = useState<{
    disciplinaName: string;
    assuntoName: string;
    durationMinutes: number;
    xpGained: number;
    questionsCount?: number;
    accuracyRate?: number;
  } | null>(null);

  const [historyDiscFilter, setHistoryDiscFilter] = useState('todos');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('todos');
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const active = TimerService.getActiveTimer();
      if (active && active.isRunning && active.lastStartTimestamp) {
        const delta = Math.floor((Date.now() - active.lastStartTimestamp) / 1000);
        setCurrentSeconds(active.accumulatedSeconds + delta);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (initialDisciplinaId && (!timerState || !timerState.isRunning)) {
      const disc = disciplinas.find(d => d.id === initialDisciplinaId);
      const top = assuntos.find(a => a.id === initialAssuntoId);
      if (disc) {
        const started = TimerService.startTimer({
          disciplinaId: disc.id,
          disciplinaName: disc.name,
          disciplinaColor: disc.color,
          assuntoId: top?.id,
          assuntoName: top?.name,
          plannedMinutes: 60,
        });
        setTimerState(started);
        setCurrentSeconds(0);
      }
    }
  }, [initialDisciplinaId, initialAssuntoId, disciplinas, assuntos]);

  const nextStudyRecommendation = useMemo(() => {
    if (cycle && cycle.blocks && cycle.blocks.length > 0) {
      const currentBlock = cycle.blocks[cycle.currentBlockIndex] || cycle.blocks[0];
      const disc = disciplinas.find(d => d.id === currentBlock.disciplinaId);
      return {
        source: 'Ciclo de Estudos Dinâmico',
        sourceDetail: `Bloco ${cycle.currentBlockIndex + 1} de ${cycle.blocks.length}`,
        disciplinaId: currentBlock.disciplinaId,
        disciplinaName: currentBlock.disciplinaName,
        disciplinaColor: currentBlock.disciplinaColor || disc?.color || '#10b981',
        assuntoId: currentBlock.assuntoSugeridoId,
        assuntoName: currentBlock.assuntoSugeridoName || 'Estudo Dirigido',
        plannedMinutes: currentBlock.durationMinutes || 60,
        weight: currentBlock.weight || 2.0,
        cycleBlockId: currentBlock.id,
      };
    }
    const sortedDiscs = [...disciplinas].sort((a, b) => (b.weight || 2.0) - (a.weight || 2.0));
    const targetDisc = sortedDiscs[0];
    const targetAssunto = assuntos.find(a => a.disciplinaId === targetDisc?.id);
    return {
      source: 'Prioridade do Edital',
      sourceDetail: 'Disciplina de alto peso',
      disciplinaId: targetDisc?.id || '',
      disciplinaName: targetDisc?.name || 'Geral',
      disciplinaColor: targetDisc?.color || '#10b981',
      assuntoId: targetAssunto?.id,
      assuntoName: targetAssunto?.name || 'Estudo Dirigido',
      plannedMinutes: 60,
      weight: targetDisc?.weight || 2.0,
    };
  }, [cycle, disciplinas, assuntos]);

  const activeDiscId = timerState?.disciplinaId || nextStudyRecommendation.disciplinaId;
  const availableAssuntos = useMemo(() => {
    return assuntos.filter(a => a.disciplinaId === activeDiscId);
  }, [assuntos, activeDiscId]);

  const handleStartRecommendation = () => {
    if (onOpenStudyTimer) {
      onOpenStudyTimer(nextStudyRecommendation.disciplinaId, nextStudyRecommendation.assuntoId);
      return;
    }
    const started = TimerService.startTimer({
      disciplinaId: nextStudyRecommendation.disciplinaId,
      disciplinaName: nextStudyRecommendation.disciplinaName,
      disciplinaColor: nextStudyRecommendation.disciplinaColor,
      assuntoId: nextStudyRecommendation.assuntoId,
      assuntoName: nextStudyRecommendation.assuntoName,
      plannedMinutes: nextStudyRecommendation.plannedMinutes,
      plannedSessionId: 'plannedSessionId' in nextStudyRecommendation ? (nextStudyRecommendation as any).plannedSessionId : undefined,
      cycleBlockId: 'cycleBlockId' in nextStudyRecommendation ? (nextStudyRecommendation as any).cycleBlockId : undefined,
    });
    setTimerState(started);
    setCurrentSeconds(0);
    showFeedback(`Sessão de foco iniciada: ${nextStudyRecommendation.disciplinaName}`);
  };

  const handleTogglePauseResume = () => {
    if (!timerState) {
      handleStartRecommendation();
      return;
    }
    if (timerState.isRunning) {
      const paused = TimerService.pauseTimer();
      setTimerState(paused);
    } else {
      const resumed = TimerService.resumeTimer();
      setTimerState(resumed);
    }
  };

  const handleResetTimer = () => {
    TimerService.clearTimer();
    setTimerState(null);
    setCurrentSeconds(0);
    showFeedback('Cronômetro zerado.');
  };

  const handleUpdateTimerMetadata = (partial: Partial<ActiveTimerState>) => {
    const updated = TimerService.updateTimerMetadata(partial);
    if (updated) {
      setTimerState(updated);
    }
  };

  const handleFinishTimerSession = async () => {
    if (!timerState) return;
    const durationMinutes = Math.max(1, Math.round(currentSeconds / 60));
    const xp = durationMinutes * 2 + (timerState.questionsCorrect || 0) * 5;
    try {
      await onSaveSession({
        disciplinaId: timerState.disciplinaId,
        assuntoId: timerState.assuntoId,
        durationMinutes,
        plannedMinutes: timerState.plannedMinutes,
        type: timerState.type,
        questionsAttempted: timerState.questionsAttempted > 0 ? timerState.questionsAttempted : undefined,
        questionsCorrect: timerState.questionsAttempted > 0 ? timerState.questionsCorrect : undefined,
        notes: timerState.notes,
      });

      if (cycle && onAdvanceCycle) {
        await onAdvanceCycle(durationMinutes);
      }
      if (timerState.plannedSessionId && onTogglePlanSession) {
        await onTogglePlanSession(timerState.plannedSessionId, 'concluida');
      }

      setCompletedSummary({
        disciplinaName: timerState.disciplinaName,
        assuntoName: timerState.assuntoName || 'Estudo Regular',
        durationMinutes,
        xpGained: xp,
        questionsCount: timerState.questionsAttempted,
        accuracyRate: timerState.questionsAttempted > 0 
          ? Math.round((timerState.questionsCorrect / timerState.questionsAttempted) * 100) 
          : undefined,
      });

      TimerService.clearTimer();
      setTimerState(null);
      setCurrentSeconds(0);
    } catch (err) {
      console.error('Erro ao salvar sessão:', err);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const disc = disciplinas.find(d => d.id === manualDisciplinaId);
    if (!disc) return;
    setIsManualSubmitting(true);
    try {
      const top = assuntos.find(a => a.id === manualAssuntoId);
      await onSaveSession({
        disciplinaId: disc.id,
        assuntoId: top?.id,
        durationMinutes: Number(manualDurationMinutes),
        type: manualType,
        questionsAttempted: typeof manualQuestionsAttempted === 'number' ? manualQuestionsAttempted : undefined,
        questionsCorrect: typeof manualQuestionsCorrect === 'number' ? manualQuestionsCorrect : undefined,
        notes: manualNotes,
      });
      showFeedback(`Lançamento de ${manualDurationMinutes} min em ${disc.name} registrado!`);
      setManualNotes('');
      setManualQuestionsAttempted('');
      setManualQuestionsCorrect('');
      setActiveTab('historico');
    } finally {
      setIsManualSubmitting(false);
    }
  };

  const metrics = useMemo(() => {
    const todayStr = PlannerService.formatLocalDate(new Date());
    const todaySessions = sessoes.filter(s => s.completedAt.startsWith(todayStr));
    const todayMinutes = todaySessions.reduce((acc, s) => acc + s.durationMinutes, 0);
    const totalMinutes = sessoes.reduce((acc, s) => acc + s.durationMinutes, 0);
    const totalHours = (totalMinutes / 60).toFixed(1);
    const totalQuestions = sessoes.reduce((acc, s) => acc + (s.questionsAttempted || 0), 0);
    const totalCorrect = sessoes.reduce((acc, s) => acc + (s.questionsCorrect || 0), 0);
    const avgAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    return {
      todayMinutes,
      todayHours: (todayMinutes / 60).toFixed(1),
      totalHours,
      totalQuestions,
      avgAccuracy,
    };
  }, [sessoes]);

  const filteredHistory = useMemo(() => {
    return sessoes.filter(s => {
      const matchDisc = historyDiscFilter === 'todos' || s.disciplinaId === historyDiscFilter;
      const matchType = historyTypeFilter === 'todos' || s.type === historyTypeFilter;
      return matchDisc && matchType;
    });
  }, [sessoes, historyDiscFilter, historyTypeFilter]);

  const plannedSeconds = (timerState?.plannedMinutes || 60) * 60;
  const progressPercent = Math.min(100, Math.round((currentSeconds / plannedSeconds) * 100));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {feedback && (
        <div className="p-3.5 rounded-xl text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-1">
          <span className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-500" /> Hoje (Líquido)
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">{metrics.todayHours}h</span>
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-1">
          <span className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-purple-500" /> Total Acumulado
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">{metrics.totalHours}h</span>
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-1">
          <span className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-sky-500" /> Questões Treinadas
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black font-mono text-sky-600 dark:text-sky-400">{metrics.totalQuestions}</span>
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-1">
          <span className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-500" /> Desempenho Médio
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">{metrics.avgAccuracy}%</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('foco')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'foco' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
          }`}
        >
          <Play className="w-4 h-4 text-emerald-500 fill-current" />
          <span>Próximo Estudo & Cronômetro em Foco</span>
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'manual' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
          }`}
        >
          <Plus className="w-4 h-4 text-sky-500" />
          <span>Lançamento Manual de Horas</span>
        </button>
        <button
          onClick={() => setActiveTab('historico')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'historico' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
          }`}
        >
          <History className="w-4 h-4 text-purple-500" />
          <span>Histórico de Sessões ({sessoes.length})</span>
        </button>
      </div>

      {activeTab === 'foco' && (
        <div className="space-y-6">
          {(!timerState || !timerState.isRunning) && (
            <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent border-2 border-emerald-500/40 shadow-sm relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="emerald" size="sm" dot>Recomendação Inteligente</Badge>
                    <span className="text-xs text-slate-400 font-medium">{nextStudyRecommendation.source}</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                    {nextStudyRecommendation.disciplinaName}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    Tópico recomendado: <strong className="text-slate-900 dark:text-slate-100">{nextStudyRecommendation.assuntoName}</strong>
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleStartRecommendation}
                  leftIcon={<Play className="w-5 h-5 fill-current" />}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 shadow-md"
                >
                  Iniciar Próximo Estudo
                </Button>
              </div>
            </div>
          )}

          <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
            <CardBody className="p-6 sm:p-8 space-y-6">
              <div className="py-8 px-4 rounded-3xl bg-slate-950 text-white text-center space-y-4 relative overflow-hidden shadow-inner border border-slate-800 timer-focus-box">
                <div className="flex items-center justify-between text-xs px-2 text-slate-400">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" /> Tempo Líquido Estudado
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">Meta: {timerState?.plannedMinutes || 60} min</span>
                </div>
                <div className="text-5xl sm:text-7xl font-mono font-black tracking-widest text-emerald-400 py-2">
                  {TimerService.formatSeconds(currentSeconds)}
                </div>
                <div className="space-y-1.5 max-w-md mx-auto">
                  <div className="flex justify-between text-[11px] font-mono text-slate-400">
                    <span>Progresso</span>
                    <span className="text-emerald-400 font-bold">{progressPercent}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-center gap-3 pt-4 flex-wrap">
                  <Button
                    variant={timerState?.isRunning ? 'secondary' : 'primary'}
                    size="lg"
                    onClick={handleTogglePauseResume}
                    leftIcon={timerState?.isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                    className={`font-bold px-8 shadow-lg ${timerState?.isRunning ? '' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                  >
                    {timerState?.isRunning ? 'Pausar' : currentSeconds > 0 ? 'Continuar Estudo' : 'Iniciar Foco'}
                  </Button>
                  {currentSeconds > 0 && (
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={handleFinishTimerSession}
                      leftIcon={<CheckCircle2 className="w-5 h-5" />}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 shadow-lg"
                    >
                      Finalizar Sessão
                    </Button>
                  )}
                  {currentSeconds > 0 && (
                    <Button
                      variant="outline"
                      size="md"
                      onClick={handleResetTimer}
                      leftIcon={<RotateCcw className="w-4 h-4" />}
                      className="text-xs text-slate-400 border-slate-700 hover:text-white"
                    >
                      Zerar
                    </Button>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {activeTab === 'manual' && (
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader title="Lançamento Manual de Horas Líquidas" />
          <CardBody className="p-6">
            <form onSubmit={handleManualSubmit} className="space-y-4 max-w-2xl text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Disciplina *</label>
                  <select
                    value={manualDisciplinaId}
                    onChange={(e) => setManualDisciplinaId(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                  >
                    {disciplinas.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tempo Líquido (minutos) *</label>
                  <input
                    type="number"
                    min="1"
                    value={manualDurationMinutes}
                    onChange={(e) => setManualDurationMinutes(parseInt(e.target.value, 10) || 0)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Observações</label>
                <textarea
                  rows={3}
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Capítulo do livro, aula assistida..."
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 resize-none"
                />
              </div>
              <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button type="submit" variant="primary" isLoading={isManualSubmitting} leftIcon={<Check className="w-4 h-4" />}>
                  Registrar Horas
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {activeTab === 'historico' && (
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader title="Histórico Completo de Sessões" />
          <CardBody className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {sessoes.map(sess => (
                <div key={sess.id} className="p-4 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{sess.disciplinaName}</span>
                    <p className="text-slate-500">{sess.assuntoName}</p>
                  </div>
                  <span className="font-mono font-bold text-emerald-600">{sess.durationMinutes} min</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <Modal
        isOpen={!!completedSummary}
        onClose={() => setCompletedSummary(null)}
        title="Sessão Concluída com Sucesso!"
        description="Seu esforço foi computado nas estatísticas."
        maxWidth="sm"
      >
        <div className="space-y-4 text-center py-2">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto animate-bounce">
            <Sparkles className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              +{completedSummary?.xpGained} XP Acumulados
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Você estudou <strong>{completedSummary?.durationMinutes} minutos</strong> de <strong className="text-emerald-600">{completedSummary?.disciplinaName}</strong>.
            </p>
          </div>
          <Button variant="primary" onClick={() => setCompletedSummary(null)} className="w-full bg-emerald-600">
            Continuar Jornada
          </Button>
        </div>
      </Modal>
    </div>
  );
};
