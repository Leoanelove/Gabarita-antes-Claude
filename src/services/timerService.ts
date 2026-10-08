import { StudySessionType } from '../types';

export interface ActiveTimerState {
  isRunning: boolean;
  lastStartTimestamp: number | null;
  accumulatedSeconds: number;
  plannedMinutes: number;
  disciplinaId: string;
  disciplinaName: string;
  disciplinaColor: string;
  assuntoId?: string;
  assuntoName?: string;
  type: StudySessionType;
  mode: 'livre' | 'pomodoro' | 'regressivo';
  pomodoroPhase: 'foco' | 'pausa_curta' | 'pausa_longa';
  pomodoroCyclesCompleted: number;
  notes: string;
  questionsAttempted: number;
  questionsCorrect: number;
  plannedSessionId?: string;
  cycleBlockId?: string;
}

const TIMER_STORAGE_KEY = 'gabarita_active_timer_state';

export class TimerService {
  static getActiveTimer(): ActiveTimerState | null {
    try {
      const raw = localStorage.getItem(TIMER_STORAGE_KEY);
      if (!raw) return null;
      const state = JSON.parse(raw) as ActiveTimerState;
      if (!state) return null;

      if (state.isRunning && state.lastStartTimestamp) {
        const now = Date.now();
        const deltaSeconds = Math.max(0, Math.floor((now - state.lastStartTimestamp) / 1000));
        if (deltaSeconds < 24 * 3600) {
          state.accumulatedSeconds += deltaSeconds;
          state.lastStartTimestamp = now;
        } else {
          state.isRunning = false;
          state.lastStartTimestamp = null;
        }
        this.saveActiveTimer(state);
      }
      return state;
    } catch (err) {
      console.warn('Erro ao recuperar timer ativo:', err);
      return null;
    }
  }

  static saveActiveTimer(state: ActiveTimerState | null): void {
    try {
      if (!state) {
        localStorage.removeItem(TIMER_STORAGE_KEY);
      } else {
        localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
      }
    } catch (err) {
      console.warn('Erro ao salvar timer ativo:', err);
    }
  }

  static startTimer(params: {
    disciplinaId: string;
    disciplinaName: string;
    disciplinaColor?: string;
    assuntoId?: string;
    assuntoName?: string;
    plannedMinutes?: number;
    type?: StudySessionType;
    mode?: 'livre' | 'pomodoro' | 'regressivo';
    plannedSessionId?: string;
    cycleBlockId?: string;
  }): ActiveTimerState {
    const existing = this.getActiveTimer();
    if (existing && existing.disciplinaId === params.disciplinaId && existing.assuntoId === params.assuntoId) {
      if (!existing.isRunning) {
        existing.isRunning = true;
        existing.lastStartTimestamp = Date.now();
        this.saveActiveTimer(existing);
      }
      return existing;
    }

    const newState: ActiveTimerState = {
      isRunning: true,
      lastStartTimestamp: Date.now(),
      accumulatedSeconds: 0,
      plannedMinutes: params.plannedMinutes || 60,
      disciplinaId: params.disciplinaId,
      disciplinaName: params.disciplinaName,
      disciplinaColor: params.disciplinaColor || '#10b981',
      assuntoId: params.assuntoId,
      assuntoName: params.assuntoName || 'Estudo Dirigido',
      type: params.type || 'teoria',
      mode: params.mode || 'livre',
      pomodoroPhase: 'foco',
      pomodoroCyclesCompleted: 0,
      notes: '',
      questionsAttempted: 0,
      questionsCorrect: 0,
      plannedSessionId: params.plannedSessionId,
      cycleBlockId: params.cycleBlockId,
    };
    this.saveActiveTimer(newState);
    return newState;
  }

  static pauseTimer(): ActiveTimerState | null {
    const state = this.getActiveTimer();
    if (!state) return null;
    if (state.isRunning && state.lastStartTimestamp) {
      const deltaSeconds = Math.max(0, Math.floor((Date.now() - state.lastStartTimestamp) / 1000));
      state.accumulatedSeconds += deltaSeconds;
    }
    state.isRunning = false;
    state.lastStartTimestamp = null;
    this.saveActiveTimer(state);
    return state;
  }

  static resumeTimer(): ActiveTimerState | null {
    const state = this.getActiveTimer();
    if (!state) return null;
    state.isRunning = true;
    state.lastStartTimestamp = Date.now();
    this.saveActiveTimer(state);
    return state;
  }

  static updateTimerMetadata(partial: Partial<ActiveTimerState>): ActiveTimerState | null {
    const state = this.getActiveTimer();
    if (!state) return null;
    const updated = { ...state, ...partial };
    this.saveActiveTimer(updated);
    return updated;
  }

  static clearTimer(): void {
    this.saveActiveTimer(null);
  }

  static formatSeconds(totalSeconds: number): string {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
