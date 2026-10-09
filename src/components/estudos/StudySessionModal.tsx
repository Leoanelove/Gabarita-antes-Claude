import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  Sparkles, 
  Target, 
  X, 
  Minus, 
  SkipForward, 
  BookOpen, 
  Layers, 
  FileText, 
  AlertCircle 
} from 'lucide-react';
import { Disciplina, Assunto, StudySessionType } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';

export interface StudySessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  disciplinas: Disciplina[];
  assuntos: Assunto[];
  initialDisciplinaId?: string;
  initialAssuntoId?: string;
  initialDurationMinutes?: number;
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
  onAdvanceCycle?: (minutesStudied?: number) => Promise<void>;
}

type TimerMode = 'foco' | 'pausa_curta' | 'pausa_longa';

export interface ThemeNeonToken {
  accent: string;       // Hex da cor principal
  accentHover: string;  // Hex para hover
  glow: string;         // rgba para o neon glow (text-shadow e filter drop-shadow)
  subtleGlow: string;   // rgba suave para sombras e fundos
  borderGlow: string;   // rgba para bordas
  lightText: string;    // tom pastel ultra-claro para o efeito tubo fluorescente
}

export const THEME_NEON_TOKENS: Record<string, ThemeNeonToken> = {
  verde: {
    accent: '#10b981', // emerald-500
    accentHover: '#059669',
    glow: 'rgba(16, 185, 129, 0.65)',
    subtleGlow: 'rgba(16, 185, 129, 0.25)',
    borderGlow: 'rgba(16, 185, 129, 0.40)',
    lightText: '#ecfdf5',
  },
  azul: {
    accent: '#3b82f6', // blue-500
    accentHover: '#2563eb',
    glow: 'rgba(59, 130, 246, 0.65)',
    subtleGlow: 'rgba(59, 130, 246, 0.25)',
    borderGlow: 'rgba(59, 130, 246, 0.40)',
    lightText: '#eff6ff',
  },
  rosa: {
    accent: '#ec4899', // pink-500
    accentHover: '#db2777',
    glow: 'rgba(236, 72, 153, 0.65)',
    subtleGlow: 'rgba(236, 72, 153, 0.25)',
    borderGlow: 'rgba(236, 72, 153, 0.40)',
    lightText: '#fdf2f8',
  },
  roxo: {
    accent: '#a855f7', // purple-500
    accentHover: '#9333ea',
    glow: 'rgba(168, 85, 247, 0.65)',
    subtleGlow: 'rgba(168, 85, 247, 0.25)',
    borderGlow: 'rgba(168, 85, 247, 0.40)',
    lightText: '#faf5ff',
  },
  laranja: {
    accent: '#f97316', // orange-500
    accentHover: '#ea580c',
    glow: 'rgba(249, 115, 22, 0.65)',
    subtleGlow: 'rgba(249, 115, 22, 0.25)',
    borderGlow: 'rgba(249, 115, 22, 0.40)',
    lightText: '#fff7ed',
  },
};

// ============================================================================
// COMPONENTE DO WIDGET FLUTUANTE (CANTO INFERIOR DIREITO)
// ============================================================================
interface FloatingTimerWidgetProps {
  onRestore: () => void;
  formattedTime: string;
  isRunning: boolean;
  onTogglePlay: () => void;
  themeToken: ThemeNeonToken;
  currentMode: TimerMode;
  progressRatio: number;
}

const FloatingTimerWidget: React.FC<FloatingTimerWidgetProps> = ({
  onRestore,
  formattedTime,
  isRunning,
  onTogglePlay,
  themeToken,
  currentMode,
  progressRatio,
}) => {
  const widgetRadius = 46;
  const widgetCircumference = 2 * Math.PI * widgetRadius;
  const widgetStrokeDashoffset = widgetCircumference * (1 - progressRatio);

  return (
    <div 
      className="fixed bottom-6 right-6 z-50 animate-in fade-in zoom-in-95 duration-200 select-none"
      style={{ filter: 'drop-shadow(0 12px 28px rgba(0,0,0,0.85))' }}
    >
      <div
        onClick={() => onRestore()}
        className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-slate-950/95 backdrop-blur-md cursor-pointer flex flex-col items-center justify-center p-2 transition-all duration-300 hover:scale-105 group"
        style={{
          border: `2px solid ${themeToken.accent}55`,
          boxShadow: `0 0 24px ${themeToken.subtleGlow}, inset 0 0 16px ${themeToken.subtleGlow}`,
        }}
        title="Clique para expandir a sessão de estudo"
        role="button"
        tabIndex={0}
      >
        {/* Anel SVG de progresso neon rotacionado -90deg */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 transform pointer-events-none p-1.5" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r={widgetRadius}
            className="stroke-slate-800/80"
            strokeWidth="5"
            fill="transparent"
          />
          <circle
            cx="60"
            cy="60"
            r={widgetRadius}
            stroke={themeToken.accent}
            strokeWidth="5.5"
            strokeDasharray={widgetCircumference}
            strokeDashoffset={widgetStrokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{
              filter: `drop-shadow(0 0 6px ${themeToken.glow})`,
            }}
            className="transition-all duration-300"
          />
        </svg>

        {/* Halo interno sutil da cor do tema */}
        <div 
          className="absolute inset-2 rounded-full pointer-events-none opacity-40"
          style={{
            background: `radial-gradient(circle at center, ${themeToken.subtleGlow} 0%, transparent 75%)`
          }}
        />

        {/* Conteúdo Central: Modo, Tempo HH:MM:SS e Botão Play/Pause */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center -mt-0.5">
          <span 
            className="text-[9px] font-bold tracking-wider uppercase mb-0.5"
            style={{ color: themeToken.accent }}
          >
            {currentMode === 'foco' ? 'Foco' : 'Pausa'}
          </span>

          <div 
            className="text-xs sm:text-sm font-mono font-black tracking-tight text-white select-none leading-none px-1 py-0.5"
            style={{
              textShadow: `0 0 8px ${themeToken.glow}, 0 0 16px ${themeToken.glow}`,
            }}
          >
            {formattedTime}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePlay();
            }}
            className="mt-1.5 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-90 border hover:brightness-110"
            style={{
              borderColor: themeToken.accent,
              backgroundColor: `${themeToken.accent}25`,
              color: '#ffffff',
              boxShadow: `0 0 10px ${themeToken.subtleGlow}`,
            }}
            title={isRunning ? 'Pausar' : 'Retomar'}
            aria-label={isRunning ? 'Pausar cronômetro' : 'Retomar cronômetro'}
          >
            {isRunning ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL (MODAL DE SESSÃO DE ESTUDO)
// ============================================================================
export const StudySessionModal: React.FC<StudySessionModalProps> = ({
  isOpen,
  onClose,
  disciplinas,
  assuntos,
  initialDisciplinaId,
  initialAssuntoId,
  initialDurationMinutes,
  onSaveSession,
  onAdvanceCycle,
}) => {
  // Resolução dinâmica do Tema Ativo
  const { colorSkin, palette, effectiveTheme } = useTheme();
  const isDarkMode = effectiveTheme === 'dark';
  const normalizedSkin = 
    (colorSkin === 'purple' ? 'roxo' : colorSkin === 'orange' || colorSkin === 'dbz' ? 'laranja' : colorSkin) || 'verde';
  const themeToken = THEME_NEON_TOKENS[normalizedSkin] || THEME_NEON_TOKENS.verde;

  // Estados de exibição e controle
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentMode, setCurrentMode] = useState<TimerMode>('foco');
  const [pomodoroCycle, setPomodoroCycle] = useState<number>(1);
  const [focoMinutes, setFocoMinutes] = useState<number>(25);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(25 * 60);
  const [totalFocusSeconds, setTotalFocusSeconds] = useState<number>(0);

  // Metadados da sessão de estudo
  const [selectedDisciplinaId, setSelectedDisciplinaId] = useState<string>('');
  const [selectedAssuntoId, setSelectedAssuntoId] = useState<string>('');
  const [studyType, setStudyType] = useState<StudySessionType>('teoria');
  const [questionsAttempted, setQuestionsAttempted] = useState<string>('');
  const [questionsCorrect, setQuestionsCorrect] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Estados de confirmação
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [isFinishing, setIsFinishing] = useState<boolean>(false);

  // 1. INICIALIZAÇÃO SEGURA: Dispara ESTRITAMENTE quando o modal for aberto
  useEffect(() => {
    if (isOpen) {
      setIsMinimized(false);
      setShowResetConfirm(false);
      setIsRunning(false);

      const targetMinutes = (initialDurationMinutes && initialDurationMinutes > 0) ? initialDurationMinutes : 25;
      setFocoMinutes(targetMinutes);
      setSecondsRemaining(targetMinutes * 60);
      setTotalFocusSeconds(0);
      setCurrentMode('foco');
      setPomodoroCycle(1);

      const defaultDisc = initialDisciplinaId || (disciplinas && disciplinas[0]?.id) || '';
      setSelectedDisciplinaId(defaultDisc);
      setSelectedAssuntoId(initialAssuntoId || '');
      setNotes('');
      setQuestionsAttempted('');
      setQuestionsCorrect('');
    } else {
      setIsRunning(false);
      setIsMinimized(false);
    }
  }, [isOpen]);

  // 2. INTERVALO ISOLADO E BLINDADO: Depende ESTRITAMENTE de isRunning
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            if (interval) clearInterval(interval);
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
        setTotalFocusSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  // Filtragem de assuntos pela matéria selecionada
  const activeAssuntos = useMemo(() => {
    return assuntos.filter(a => a.disciplinaId === selectedDisciplinaId);
  }, [assuntos, selectedDisciplinaId]);

  // Total de segundos do modo ativo para percentual
  const currentTotalSeconds = useMemo(() => {
    if (currentMode === 'foco') return focoMinutes * 60;
    if (currentMode === 'pausa_curta') return 5 * 60;
    return 15 * 60;
  }, [currentMode, focoMinutes]);

  // Ações do Cronômetro
  const handleToggleTimer = () => {
    if (secondsRemaining <= 0) {
      handleSkipNext();
      return;
    }
    setIsRunning(prev => !prev);
  };

  const handleSelectMode = (mode: TimerMode) => {
    if (mode === currentMode) return;
    setCurrentMode(mode);
    setIsRunning(false);
    if (mode === 'foco') {
      setSecondsRemaining(focoMinutes * 60);
    } else if (mode === 'pausa_curta') {
      setSecondsRemaining(5 * 60);
    } else {
      setSecondsRemaining(15 * 60);
    }
  };

  const handleChangeFocoMinutes = (mins: number) => {
    setFocoMinutes(mins);
    if (currentMode === 'foco' && !isRunning) {
      setSecondsRemaining(mins * 60);
    }
  };

  const handleResetTimer = () => {
    setIsRunning(false);
    setShowResetConfirm(false);
    if (currentMode === 'foco') {
      setSecondsRemaining(focoMinutes * 60);
      setTotalFocusSeconds(0);
    } else if (currentMode === 'pausa_curta') {
      setSecondsRemaining(5 * 60);
    } else {
      setSecondsRemaining(15 * 60);
    }
  };

  const handleSkipNext = () => {
    setIsRunning(false);
    if (currentMode === 'foco') {
      const nextCycle = pomodoroCycle >= 4 ? 1 : pomodoroCycle + 1;
      const nextMode: TimerMode = pomodoroCycle >= 4 ? 'pausa_longa' : 'pausa_curta';
      setPomodoroCycle(nextCycle);
      setCurrentMode(nextMode);
      setSecondsRemaining(nextMode === 'pausa_longa' ? 15 * 60 : 5 * 60);
    } else {
      setCurrentMode('foco');
      setSecondsRemaining(focoMinutes * 60);
    }
  };

  const handleClose = () => {
    setIsRunning(false);
    setIsMinimized(false);
    onClose();
  };

  const handleFinish = async () => {
    setIsRunning(false);
    setIsFinishing(true);

    const durationMinutes = Math.max(1, Math.round(totalFocusSeconds / 60));

    try {
      await onSaveSession({
        disciplinaId: selectedDisciplinaId,
        assuntoId: selectedAssuntoId || undefined,
        durationMinutes,
        plannedMinutes: focoMinutes,
        type: studyType,
        questionsAttempted: questionsAttempted ? parseInt(questionsAttempted, 10) : undefined,
        questionsCorrect: questionsCorrect ? parseInt(questionsCorrect, 10) : undefined,
        notes,
      });

      if (onAdvanceCycle) {
        try {
          await onAdvanceCycle(durationMinutes);
        } catch (e) {
          console.warn('Erro ao avançar ciclo:', e);
        }
      }

      handleClose();
    } catch (err) {
      console.error('Erro ao salvar sessão de estudo:', err);
    } finally {
      setIsFinishing(false);
    }
  };

  // Formatação de tempo estrita em HH:MM:SS
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatWidgetTime = (totalSeconds: number) => {
    return formatTime(totalSeconds);
  };

  // Métricas da sessão
  const netMinutes = Math.max(0, Math.floor(totalFocusSeconds / 60));
  const questionsNum = questionsAttempted ? parseInt(questionsAttempted, 10) : 0;
  const correctNum = questionsCorrect ? parseInt(questionsCorrect, 10) : 0;
  const accuracyPercent = questionsNum > 0 ? Math.round((correctNum / questionsNum) * 100) : null;
  const xpEstimate = (netMinutes * 2) + (correctNum * 5);

  // Percentual para o anel de progresso circular
  const progressRatio = Math.max(0, Math.min(1, 1 - (secondsRemaining / (currentTotalSeconds || 1))));
  const circumference = 2 * Math.PI * 78;
  const strokeDashoffset = circumference * (1 - progressRatio);

  const angleInRotated = 2 * Math.PI * progressRatio;
  const handleX = 90 + 78 * Math.cos(angleInRotated);
  const handleY = 90 + 78 * Math.sin(angleInRotated);

  // Se não estiver aberto, não renderiza nada
  if (!isOpen) return null;

  // 3. SE ESTIVER MINIMIZADO: Renderiza o widget flutuante no canto inferior direito
  if (isMinimized) {
    return (
      <FloatingTimerWidget
        onRestore={() => setIsMinimized(false)}
        formattedTime={formatWidgetTime(secondsRemaining)}
        isRunning={isRunning}
        onTogglePlay={() => handleToggleTimer()}
        themeToken={themeToken}
        currentMode={currentMode}
        progressRatio={progressRatio}
      />
    );
  }

  // MODAL COMPLETO (EXPANDIDO)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={() => handleClose()}
      />

      {/* Caixa do Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[92vh]">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full border flex items-center justify-center shrink-0 transition-all duration-300"
              style={{
                backgroundColor: `${palette.primary}15`,
                borderColor: `${palette.primary}30`,
                color: palette.primary,
                boxShadow: isDarkMode ? `0 0 16px ${themeToken.subtleGlow}` : undefined,
              }}
            >
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white tracking-tight leading-tight">
                Sessão de estudo
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-normal">
                Mantenha o ritmo e registre seu progresso
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div 
              className="font-mono text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 font-semibold border transition-all duration-300"
              style={{
                backgroundColor: `${palette.primary}15`,
                borderColor: `${palette.primary}30`,
                color: isDarkMode ? themeToken.lightText : palette.primary,
                boxShadow: isDarkMode ? `0 0 10px ${themeToken.subtleGlow}` : undefined,
              }}
            >
              <span 
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ 
                  backgroundColor: palette.primary,
                  boxShadow: `0 0 6px ${palette.primary}`,
                }} 
              />
              <span>{pomodoroCycle} de 4</span>
            </div>

            {/* Botão Minimizar */}
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Minimizar cronômetro"
              aria-label="Minimizar cronômetro"
            >
              <Minus className="w-5 h-5" />
            </button>

            {/* Botão Fechar */}
            <button
              type="button"
              onClick={() => handleClose()}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Fechar janela"
              aria-label="Fechar janela"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo rolável */}
        <div className="overflow-y-auto p-4 sm:p-5 space-y-5 custom-scrollbar text-xs sm:text-sm">
          
          {/* Seletor de Modos (Foco | Pausa curta | Pausa longa) */}
          <div className="bg-slate-100 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 p-1 rounded-xl grid grid-cols-3 gap-1 shadow-inner">
            <button
              type="button"
              onClick={() => handleSelectMode('foco')}
              className={`py-2 px-3 rounded-lg text-xs sm:text-sm transition-all text-center cursor-pointer ${
                currentMode === 'foco'
                  ? 'text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/50'
              }`}
              style={currentMode === 'foco' ? {
                backgroundColor: palette.primary,
                boxShadow: isDarkMode ? `0 0 16px ${themeToken.subtleGlow}` : `0 2px 8px ${palette.primary}40`,
              } : undefined}
            >
              Foco
            </button>

            <button
              type="button"
              onClick={() => handleSelectMode('pausa_curta')}
              className={`py-2 px-3 rounded-lg text-xs sm:text-sm transition-all text-center cursor-pointer ${
                currentMode === 'pausa_curta'
                  ? 'text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/50'
              }`}
              style={currentMode === 'pausa_curta' ? {
                backgroundColor: palette.primary,
                boxShadow: isDarkMode ? `0 0 16px ${themeToken.subtleGlow}` : `0 2px 8px ${palette.primary}40`,
              } : undefined}
            >
              Pausa curta
            </button>

            <button
              type="button"
              onClick={() => handleSelectMode('pausa_longa')}
              className={`py-2 px-3 rounded-lg text-xs sm:text-sm transition-all text-center cursor-pointer ${
                currentMode === 'pausa_longa'
                  ? 'text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/50'
              }`}
              style={currentMode === 'pausa_longa' ? {
                backgroundColor: palette.primary,
                boxShadow: isDarkMode ? `0 0 16px ${themeToken.subtleGlow}` : `0 2px 8px ${palette.primary}40`,
              } : undefined}
            >
              Pausa longa
            </button>
          </div>

          {/* Display Central Neon / Card do Timer */}
          <div className="bg-slate-100/70 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 text-center relative overflow-hidden shadow-inner flex flex-col items-center">
            <div 
              className="absolute inset-0 pointer-events-none transition-all duration-500"
              style={{
                background: isDarkMode 
                  ? `radial-gradient(circle at center, ${themeToken.subtleGlow} 0%, transparent 70%)`
                  : `radial-gradient(circle at center, ${palette.primary}0a 0%, transparent 70%)`
              }} 
            />

            <div className="relative w-52 h-52 sm:w-56 sm:h-56 flex items-center justify-center my-2">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 180 180">
                <circle
                  cx="90"
                  cy="90"
                  r="78"
                  className="stroke-slate-300 dark:stroke-slate-800/80"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="90"
                  cy="90"
                  r="78"
                  stroke={palette.primary}
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-300"
                  style={{
                    filter: isDarkMode ? `drop-shadow(0 0 8px ${themeToken.glow})` : undefined,
                  }}
                />
                {progressRatio > 0 && (
                  <circle
                    cx={handleX}
                    cy={handleY}
                    r="5"
                    fill={isDarkMode ? "#ffffff" : palette.primary}
                    stroke={palette.primary}
                    strokeWidth="2.5"
                    className="transition-all duration-300"
                    style={{
                      filter: isDarkMode ? `drop-shadow(0 0 8px ${themeToken.glow})` : undefined,
                    }}
                  />
                )}
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span 
                  className="text-[10px] sm:text-xs font-bold tracking-widest uppercase mb-1 transition-colors"
                  style={{ color: palette.primary }}
                >
                  {currentMode === 'foco' ? 'Tempo de Foco' : currentMode === 'pausa_curta' ? 'Pausa Curta' : 'Pausa Longa'}
                </span>

                <div 
                  className="text-4xl sm:text-5xl font-mono font-black tracking-widest select-none transition-all duration-300 text-slate-900 dark:text-white"
                  style={isDarkMode ? {
                    color: '#ffffff',
                    textShadow: `0 0 10px ${themeToken.glow}, 0 0 20px ${themeToken.glow}, 0 0 40px ${themeToken.glow}`,
                  } : {
                    color: '#0f172a',
                  }}
                >
                  {formatTime(secondsRemaining)}
                </div>

                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <span 
                    className={`w-2 h-2 rounded-full transition-all ${
                      isRunning ? 'animate-ping' : ''
                    }`}
                    style={{ 
                      backgroundColor: isRunning ? palette.primary : '#64748b',
                      boxShadow: isRunning ? `0 0 6px ${palette.primary}` : undefined,
                    }} 
                  />
                  <span>{isRunning ? 'Em andamento' : secondsRemaining < currentTotalSeconds ? 'Pausado' : 'Pronto'}</span>
                </div>
              </div>
            </div>

            {/* Barra Linear de Meta */}
            <div className="w-full max-w-xs mx-auto space-y-1.5 mt-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                <span>Meta: {currentMode === 'foco' ? `${focoMinutes} min` : currentMode === 'pausa_curta' ? '5 min' : '15 min'}</span>
                <span style={{ color: palette.primary }} className="font-bold">
                  {Math.round(progressRatio * 100)}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-slate-700/60">
                <div 
                  className="h-full rounded-full transition-all duration-300"
                  style={{ 
                    width: `${Math.round(progressRatio * 100)}%`, 
                    backgroundColor: palette.primary,
                    boxShadow: isDarkMode ? `0 0 8px ${themeToken.glow}` : undefined,
                  }} 
                />
              </div>
            </div>

            {/* Controles: Reset, Play/Pause, Próximo */}
            <div className="flex items-center justify-center gap-3 mt-4 w-full max-w-xs">
              <button
                type="button"
                onClick={() => {
                  if (secondsRemaining < currentTotalSeconds || totalFocusSeconds > 0) {
                    setShowResetConfirm(true);
                  } else {
                    handleResetTimer();
                  }
                }}
                className="p-3 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-200 hover:bg-slate-300 dark:bg-slate-900/80 dark:hover:bg-slate-800 text-slate-700 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                title="Reiniciar tempo do bloco"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleToggleTimer()}
                className="flex-1 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all text-sm active:scale-95 cursor-pointer shadow-md hover:opacity-90"
                style={{
                  backgroundColor: palette.primary,
                  boxShadow: `0 4px 14px ${palette.primary}40`,
                }}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>{secondsRemaining < currentTotalSeconds ? 'Retomar' : currentMode === 'foco' ? 'Iniciar Foco' : 'Iniciar Pausa'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSkipNext()}
                className="p-3 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-200 hover:bg-slate-300 dark:bg-slate-900/80 dark:hover:bg-slate-800 text-slate-700 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                title="Pular para a próxima etapa"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {/* Confirmação de Zerar */}
            {showResetConfirm && (
              <div className="mt-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between w-full max-w-sm animate-in fade-in">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  Deseja reiniciar este bloco?
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleResetTimer()}
                    className="bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer"
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-md text-[11px] cursor-pointer"
                  >
                    Não
                  </button>
                </div>
              </div>
            )}

            {/* Presets de Minutos de Foco */}
            {currentMode === 'foco' && !isRunning && (
              <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap justify-center sm:justify-start">
                <span className="mr-1">Meta de Foco:</span>
                {Array.from(new Set([
                  ...(![25, 30, 45, 50, 60].includes(focoMinutes) && focoMinutes > 0 ? [focoMinutes] : []),
                  25, 30, 45, 50, 60
                ])).sort((a, b) => a - b).map(mins => {
                  const isSelected = focoMinutes === mins;
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleChangeFocoMinutes(mins)}
                      className={`px-2 py-1 rounded-md border text-[11px] transition-all cursor-pointer font-medium ${
                        isSelected 
                          ? 'text-white font-bold shadow-xs' 
                          : 'border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400 bg-white dark:bg-slate-900'
                      }`}
                      style={isSelected ? {
                        backgroundColor: palette.primary,
                        borderColor: palette.primary,
                      } : undefined}
                    >
                      {mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}m` : ''}` : `${mins}m`}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dados da Sessão: Disciplina, Tópico, Tipo e Questões */}
          <div className="space-y-3.5 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" style={{ color: palette.primary }} />
                  <span>Disciplina *</span>
                </label>
                <select
                  value={selectedDisciplinaId}
                  onChange={(e) => {
                    setSelectedDisciplinaId(e.target.value);
                    setSelectedAssuntoId('');
                  }}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                >
                  {disciplinas.length === 0 ? (
                    <option value="">Nenhuma disciplina cadastrada</option>
                  ) : (
                    disciplinas.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" style={{ color: palette.primary }} />
                  <span>Assunto / Tópico</span>
                </label>
                <select
                  value={selectedAssuntoId}
                  onChange={(e) => setSelectedAssuntoId(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                >
                  <option value="">Geral / Revisão da Matéria</option>
                  {activeAssuntos.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tipo de Estudo */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tipo de Estudo
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {[
                  { id: 'teoria', label: 'Teoria' },
                  { id: 'questoes', label: 'Questões' },
                  { id: 'revisao', label: 'Revisão' },
                  { id: 'lei_seca', label: 'Lei Seca' },
                  { id: 'resumo', label: 'Resumo' },
                ].map(item => {
                  const isSelected = studyType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setStudyType(item.id as StudySessionType)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                        isSelected 
                          ? 'text-white font-bold shadow-xs' 
                          : 'border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-700'
                      }`}
                      style={isSelected ? {
                        backgroundColor: palette.primary,
                        borderColor: palette.primary,
                      } : undefined}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Questões Resolvidas */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Questões na Sessão (Opcional)
                </span>
                {accuracyPercent !== null && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                    accuracyPercent >= 75
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-400'
                      : accuracyPercent >= 60
                      ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-400'
                      : 'bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-400'
                  }`}>
                    {accuracyPercent}% de acerto ({correctNum}/{questionsNum})
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    Questões Resolvidas
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ex: 20"
                    value={questionsAttempted}
                    onChange={(e) => setQuestionsAttempted(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    Acertos
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ex: 17"
                    value={questionsCorrect}
                    onChange={(e) => setQuestionsCorrect(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Anotações */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Anotações & Observações</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Dúvidas, tópicos que merecem revisão posterior, macetes..."
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs focus:outline-none resize-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Rodapé e Ações Finais */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs w-full sm:w-auto justify-between sm:justify-start">
            <div 
              className="flex items-center gap-1 font-bold transition-colors"
              style={{ color: palette.primary }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>+{xpEstimate} XP</span>
            </div>
            
            <div className="bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800/80 dark:text-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md text-[11px]">
              Tempo Líquido: <span className="font-mono font-bold text-slate-900 dark:text-white">{netMinutes} min</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => handleClose()}
              className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            >
              Fechar
            </button>

            <button
              type="button"
              onClick={() => handleFinish()}
              disabled={isFinishing}
              className="flex-1 sm:flex-none text-white font-bold px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 shadow-md hover:opacity-90"
              style={{
                backgroundColor: palette.primary,
                boxShadow: `0 4px 14px ${palette.primary}40`,
              }}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isFinishing ? 'Salvando...' : 'Finalizar e Salvar Estudo'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
