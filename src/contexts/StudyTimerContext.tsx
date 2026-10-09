import React, { createContext, useContext, useState, useCallback } from 'react';

interface StudyTimerContextType {
  isStudyTimerOpen: boolean;
  timerInitialDisciplinaId?: string;
  timerInitialAssuntoId?: string;
  timerInitialDurationMinutes?: number;
  openStudyTimer: (disciplinaId?: string, assuntoId?: string, durationMinutes?: number | string) => void;
  closeStudyTimer: () => void;
}

const StudyTimerContext = createContext<StudyTimerContextType | undefined>(undefined);

export const StudyTimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isStudyTimerOpen, setIsStudyTimerOpen] = useState(false);
  const [timerInitialDisciplinaId, setTimerInitialDisciplinaId] = useState<string | undefined>();
  const [timerInitialAssuntoId, setTimerInitialAssuntoId] = useState<string | undefined>();
  const [timerInitialDurationMinutes, setTimerInitialDurationMinutes] = useState<number | undefined>();

  // Auxiliar para converter duração numérica ou string (ex: "1h 13min", "45min", 73) em minutos
  const parseDurationToMinutes = (val?: number | string): number | undefined => {
    if (val === undefined || val === null) return undefined;
    if (typeof val === 'number') {
      return isNaN(val) || val <= 0 ? undefined : Math.round(val);
    }
    const str = String(val).trim().toLowerCase();
    if (!str) return undefined;

    // Se for string puramente numérica: "45"
    const purelyNumeric = parseInt(str, 10);
    if (!isNaN(purelyNumeric) && !str.includes('h') && !str.includes('m')) {
      return purelyNumeric > 0 ? purelyNumeric : undefined;
    }

    // Se contiver horas e/ou minutos: ex: "1h 13min", "1h", "46min"
    let total = 0;
    let found = false;
    const hoursMatch = str.match(/(\d+)\s*h/);
    if (hoursMatch) {
      total += parseInt(hoursMatch[1], 10) * 60;
      found = true;
    }
    const minsMatch = str.match(/(\d+)\s*m/);
    if (minsMatch) {
      total += parseInt(minsMatch[1], 10);
      found = true;
    }

    if (found && total > 0) return total;
    if (!isNaN(purelyNumeric) && purelyNumeric > 0) return purelyNumeric;
    return undefined;
  };

  const openStudyTimer = useCallback((disciplinaId?: string, assuntoId?: string, durationMinutes?: number | string) => {
    setTimerInitialDisciplinaId(disciplinaId);
    setTimerInitialAssuntoId(assuntoId);
    const parsedMins = parseDurationToMinutes(durationMinutes);
    setTimerInitialDurationMinutes(parsedMins);
    setIsStudyTimerOpen(true);
  }, []);

  const closeStudyTimer = useCallback(() => {
    setIsStudyTimerOpen(false);
  }, []);

  return (
    <StudyTimerContext.Provider
      value={{
        isStudyTimerOpen,
        timerInitialDisciplinaId,
        timerInitialAssuntoId,
        timerInitialDurationMinutes,
        openStudyTimer,
        closeStudyTimer,
      }}
    >
      {children}
    </StudyTimerContext.Provider>
  );
};

export const useStudyTimer = () => {
  const context = useContext(StudyTimerContext);
  if (!context) {
    throw new Error('useStudyTimer deve ser usado dentro de um StudyTimerProvider');
  }
  return context;
};
