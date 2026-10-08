import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  Sparkles 
} from 'lucide-react';
import { Disciplina, Assunto, StudySessionType } from '../../types';
import { Modal } from '../../design-system/Modal';
import { Button } from '../../design-system/Button';
import { TimerService } from '../../services/timerService';

interface StudySessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  disciplinas: Disciplina[];
  assuntos: Assunto[];
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
}

export const StudySessionModal: React.FC<StudySessionModalProps> = ({
  isOpen,
  onClose,
  disciplinas,
  assuntos,
  initialDisciplinaId,
  initialAssuntoId,
  onSaveSession,
}) => {
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState(
    initialDisciplinaId || disciplinas[0]?.id || ''
  );
  const [selectedAssuntoId, setSelectedAssuntoId] = useState(initialAssuntoId || '');
  const [sessionType, setSessionType] = useState<StudySessionType>('pomodoro');
  const [plannedMinutes, setPlannedMinutes] = useState(60);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [notes, setNotes] = useState('');
  const [questionsAttempted, setQuestionsAttempted] = useState('');
  const [questionsCorrect, setQuestionsCorrect] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const active = TimerService.getActiveTimer();
      if (active) {
        setSelectedDisciplinaId(active.disciplinaId);
        setSelectedAssuntoId(active.assuntoId || '');
        setSessionType(active.type);
        setPlannedMinutes(active.plannedMinutes);
        setNotes(active.notes);
        setQuestionsAttempted(active.questionsAttempted ? String(active.questionsAttempted) : '');
        setQuestionsCorrect(active.questionsCorrect ? String(active.questionsCorrect) : '');
        setIsActive(active.isRunning);
        setSeconds(active.accumulatedSeconds);
      } else {
        setSelectedDisciplinaId(initialDisciplinaId || disciplinas[0]?.id || '');
        setSelectedAssuntoId(initialAssuntoId || '');
        setSeconds(0);
        setIsActive(false);
        setNotes('');
        setQuestionsAttempted('');
        setQuestionsCorrect('');
      }
    }
  }, [isOpen, initialDisciplinaId, initialAssuntoId, disciplinas]);

  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      interval = setInterval(() => {
        setSeconds(prev => {
          const next = prev + 1;
          const active = TimerService.getActiveTimer();
          if (active && active.isRunning) {
            TimerService.saveActiveTimer({
              ...active,
              accumulatedSeconds: next,
            });
          }
          return next;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  const activeAssuntos = assuntos.filter(a => a.disciplinaId === selectedDisciplinaId);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleTimer = () => {
    const disc = disciplinas.find(d => d.id === selectedDisciplinaId);
    const top = assuntos.find(a => a.id === selectedAssuntoId);
    if (!isActive) {
      TimerService.startTimer({
        disciplinaId: selectedDisciplinaId,
        disciplinaName: disc?.name || 'Geral',
        disciplinaColor: disc?.color || '#10b981',
        assuntoId: selectedAssuntoId || undefined,
        assuntoName: top?.name,
        plannedMinutes,
        type: sessionType,
      });
      setIsActive(true);
    } else {
      TimerService.pauseTimer();
      setIsActive(false);
    }
  };

  const handleFinish = async () => {
    setIsActive(false);
    setIsFinishing(true);
    const durationMinutes = Math.max(1, Math.round(seconds / 60));
    try {
      await onSaveSession({
        disciplinaId: selectedDisciplinaId,
        assuntoId: selectedAssuntoId || undefined,
        durationMinutes,
        plannedMinutes,
        type: sessionType,
        questionsAttempted: questionsAttempted ? parseInt(questionsAttempted, 10) : undefined,
        questionsCorrect: questionsCorrect ? parseInt(questionsCorrect, 10) : undefined,
        notes,
      });
      TimerService.clearTimer();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsFinishing(false);
    }
  };

  const progressPercent = Math.min(100, Math.round((seconds / (plannedMinutes * 60)) * 100));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sessão de Estudo em Foco"
      description="Cronometre suas horas líquidas para acumular XP e manter seu ritmo."
      maxWidth="md"
    >
      <div className="space-y-5 text-xs">
        <div className="text-center py-6 px-4 bg-slate-950 rounded-2xl border border-slate-800 text-white relative overflow-hidden shadow-inner space-y-3 timer-focus-box">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Tempo Líquido</span>
            <div className="flex items-center gap-1 text-emerald-400 font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              +{(Math.max(1, Math.round(seconds / 60)) * 2)} XP
            </div>
          </div>
          <div className="text-4xl sm:text-5xl font-mono font-black tracking-wider text-emerald-400">
            {formatTime(seconds)}
          </div>
          <div className="space-y-1 max-w-xs mx-auto">
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>Meta: {plannedMinutes} min</span>
              <span className="text-emerald-400 font-bold">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant={isActive ? 'secondary' : 'primary'}
              size="md"
              onClick={handleToggleTimer}
              leftIcon={isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              className={isActive ? '' : 'bg-emerald-600 hover:bg-emerald-500 font-bold'}
            >
              {isActive ? 'Pausar' : seconds > 0 ? 'Retomar' : 'Iniciar Foco'}
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                setSeconds(0);
                setIsActive(false);
                TimerService.clearTimer();
              }}
              leftIcon={<RotateCcw className="w-4 h-4" />}
            >
              Zerar
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Disciplina *
              </label>
              <select
                value={selectedDisciplinaId}
                onChange={(e) => {
                  setSelectedDisciplinaId(e.target.value);
                  setSelectedAssuntoId('');
                }}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                {disciplinas.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Assunto / Tópico
              </label>
              <select
                value={selectedAssuntoId}
                onChange={(e) => setSelectedAssuntoId(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                <option value="">Geral / Revisão da Matéria</option>
                {activeAssuntos.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Observações & Anotações
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Dúvidas, tópicos que merecem revisão posterior..."
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button variant="outline" onClick={onClose}>
            Fechar Janela
          </Button>
          <Button
            variant="primary"
            onClick={handleFinish}
            isLoading={isFinishing}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
            className="bg-emerald-600 hover:bg-emerald-500 font-bold"
          >
            Finalizar e Salvar Estudo
          </Button>
        </div>
      </div>
    </Modal>
  );
};
