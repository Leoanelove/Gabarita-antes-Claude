import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Check,
  RotateCw, 
  Clock, 
  Flame, 
  Trophy, 
  CheckCircle2, 
  AlertCircle, 
  ThumbsUp, 
  Sparkles, 
  ArrowRight,
  Maximize2,
  Minimize2,
  BookOpen
} from 'lucide-react';
import { Flashcard, Deck } from '../../types';
import { Button } from '../../design-system/Button';
import { DatabaseService } from '../../services/db';

export interface FlashcardPlayerProps {
  cards: Flashcard[];
  deckName?: string;
  disciplinaName?: string;
  onFinish: (stats: ReviewSessionStats) => void;
  onClose: () => void;
}

export interface ReviewSessionStats {
  totalReviewed: number;
  countErrei: number;
  countDificil: number;
  countBom: number;
  countFacil: number;
  timeSpentSeconds: number;
  xpEarned: number;
}

export const FlashcardPlayer: React.FC<FlashcardPlayerProps> = ({
  cards,
  deckName,
  disciplinaName,
  onFinish,
  onClose,
}) => {
  // Fila de cartões ativos (permite que 'Errei' adicione o cartão no final da fila da sessão atual)
  const [queue, setQueue] = useState<Flashcard[]>(() => [...cards]);
  const [initialCount] = useState<number>(cards.length);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [isSessionFinished, setIsSessionFinished] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Estatísticas da sessão
  const [stats, setStats] = useState<{
    errei: number;
    dificil: number;
    bom: number;
    facil: number;
    totalAnswers: number;
  }>({
    errei: 0,
    dificil: 0,
    bom: 0,
    facil: 0,
    totalAnswers: 0,
  });

  // Cronômetro decorrido
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Formatação do tempo mm:ss
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentCard = queue[currentIndex];

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSessionFinished) return;

      // Barra de espaço ou Enter para virar o cartão
      if ((e.code === 'Space' || e.code === 'Enter') && !isFlipped) {
        e.preventDefault();
        setIsFlipped(true);
      } else if (isFlipped) {
        // Atalhos 1, 2, 3, 4 para as notas
        if (e.key === '1') handleRate('errei');
        else if (e.key === '2') handleRate('dificil');
        else if (e.key === '3') handleRate('bom');
        else if (e.key === '4') handleRate('facil');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, currentIndex, queue, isSessionFinished]);

  // Ação ao avaliar o cartão
  const handleRate = (rating: 'errei' | 'dificil' | 'bom' | 'facil') => {
    if (!currentCard) return;

    // 1. Atualizar estatísticas locais
    setStats((prev) => ({
      ...prev,
      [rating]: prev[rating] + 1,
      totalAnswers: prev.totalAnswers + 1,
    }));

    // 2. Calcular próximo intervalo (Algoritmo SRS / Anki adaptado)
    let nextInterval = 1;
    let nextReviewDate = new Date();

    if (rating === 'errei') {
      nextInterval = 1;
      // Re-agenda para daqui a 10 minutos ou amanhã
      nextReviewDate.setMinutes(nextReviewDate.getMinutes() + 10);
    } else if (rating === 'dificil') {
      nextInterval = 1;
      nextReviewDate.setDate(nextReviewDate.getDate() + 1);
    } else if (rating === 'bom') {
      nextInterval = 3;
      nextReviewDate.setDate(nextReviewDate.getDate() + 3);
    } else if (rating === 'facil') {
      nextInterval = 8;
      nextReviewDate.setDate(nextReviewDate.getDate() + 8);
    }

    // 3. Atualizar cartão no localStorage (@gabarita:flashcards)
    try {
      const stored = localStorage.getItem('@gabarita:flashcards');
      if (stored) {
        const parsed: Flashcard[] = JSON.parse(stored);
        const updated = parsed.map((c) => {
          if (c.id === currentCard.id) {
            return {
              ...c,
              dificuldade: rating,
              intervaloDias: nextInterval,
              revisoesTotal: (c.revisoesTotal || 0) + 1,
              proximaRevisao: nextReviewDate.toISOString(),
            };
          }
          return c;
        });
        localStorage.setItem('@gabarita:flashcards', JSON.stringify(updated));
      }

      // Se respondeu bom ou fácil, diminuir a contagem de pendências do baralho em @gabarita:decks
      if (rating === 'bom' || rating === 'facil') {
        const storedDecks = localStorage.getItem('@gabarita:decks');
        if (storedDecks) {
          const parsedDecks: Deck[] = JSON.parse(storedDecks);
          const updatedDecks = parsedDecks.map((d) => {
            if (d.id === currentCard.deckId) {
              return {
                ...d,
                pendentesHoje: Math.max(0, (d.pendentesHoje || 0) - 1),
              };
            }
            return d;
          });
          localStorage.setItem('@gabarita:decks', JSON.stringify(updatedDecks));
        }
      }
    } catch (e) {
      console.warn('Erro ao atualizar flashcard no storage:', e);
    }

    // 4. Se 'errei', recoloca no final da fila da sessão atual para fixação imediata
    let newQueue = [...queue];
    if (rating === 'errei') {
      newQueue.push(currentCard);
      setQueue(newQueue);
    }

    // 5. Próximo cartão ou finalizar sessão
    const nextIndex = currentIndex + 1;
    if (nextIndex < newQueue.length) {
      setCurrentIndex(nextIndex);
      setIsFlipped(false);
    } else {
      // Concluiu todos os cartões da fila
      if (timerRef.current) clearInterval(timerRef.current);
      completeSession();
    }
  };

  // Concluir e pontuar XP
  const completeSession = async () => {
    setIsSessionFinished(true);

    const totalAnswered = stats.totalAnswers + 1;
    const xp = Math.max(10, totalAnswered * 5 + 15); // Ex: 5 cards = 40 XP

    try {
      // Atribuir XP ao perfil do usuário
      const rawUser = localStorage.getItem('gabarita_user');
      if (rawUser) {
        const userObj = JSON.parse(rawUser);
        const updatedXP = (userObj.xp || 0) + xp;
        await DatabaseService.updateUserProfile({
          id: userObj.id,
          xp: updatedXP,
        });
      }
    } catch (e) {
      console.warn('Erro ao conceder XP da sessão:', e);
    }
  };

  const handleFinishAndExit = () => {
    const totalAnswered = stats.totalAnswers;
    const xp = Math.max(10, totalAnswered * 5 + 15);

    onFinish({
      totalReviewed: totalAnswered,
      countErrei: stats.errei,
      countDificil: stats.dificil,
      countBom: stats.bom,
      countFacil: stats.facil,
      timeSpentSeconds: secondsElapsed,
      xpEarned: xp,
    });
  };

  // Taxa de acerto/retenção da sessão (Bom + Fácil vs Total)
  const accuracyRate =
    stats.totalAnswers > 0
      ? Math.round(((stats.bom + stats.facil) / stats.totalAnswers) * 100)
      : 100;

  // Progresso relativo ao número de cartões originais
  const progressPercent = Math.min(
    100,
    Math.round(((currentIndex) / Math.max(1, queue.length)) * 100)
  );

  return (
    <div className={`fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col justify-between p-3 sm:p-6 transition-all duration-300 ${isFullscreen ? 'p-0' : ''}`}>
      {/* 1. CABEÇALHO DO MODO DE FOCO */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200/80 dark:border-slate-800 rounded-2xl px-4 sm:px-6 py-3 shadow-lg">
        {/* Lado Esquerdo: Disciplina & Progresso */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                {disciplinaName || currentCard?.disciplina || 'Revisão Ativa'}
              </span>
              {deckName && (
                <>
                  <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
                  <span className="text-xs text-slate-500 font-medium truncate max-w-[200px] hidden sm:inline">
                    {deckName}
                  </span>
                </>
              )}
            </div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Card {Math.min(currentIndex + 1, queue.length)} de {queue.length}
              {queue.length > initialCount && (
                <span className="text-[11px] font-normal text-amber-500 ml-1.5">
                  (+{queue.length - initialCount} para reforço)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Lado Direito: Cronômetro & Controles */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs font-bold">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>{formatTime(secondsElapsed)}</span>
          </div>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Reduzir tela' : 'Tela cheia'}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer hidden sm:block"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onClose}
            title="Sair da sessão"
            className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* BARRA DE PROGRESSO SUPERIOR */}
      <div className="w-full max-w-4xl mx-auto my-2 px-1">
        <div className="h-1.5 w-full bg-slate-800/40 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 2. CORPO CENTRAL: CARD 3D FLIP */}
      <div className="flex-1 w-full max-w-3xl mx-auto flex flex-col justify-center my-2 sm:my-4">
        {currentCard && !isSessionFinished ? (
          <div className="perspective-1000 w-full min-h-[360px] sm:min-h-[420px] flex flex-col">
            <div
              className={`relative w-full flex-1 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-10 flex flex-col justify-between transition-all duration-500`}
            >
              {/* Topo do Card: Tópico / Badge */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-black tracking-wider uppercase text-primary bg-primary/10 px-3 py-1 rounded-full">
                  {!isFlipped ? '❓ PERGUNTA' : '💡 RESPOSTA'}
                </span>
                {currentCard.topico && (
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 truncate max-w-[240px]">
                    {currentCard.topico}
                  </span>
                )}
              </div>

              {/* Miolo do Card: Pergunta ou Resposta */}
              <div className="py-6 sm:py-8 flex-1 flex flex-col justify-center">
                {!isFlipped ? (
                  <div className="space-y-4 animate-fadeIn text-center sm:text-left">
                    <h3 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-snug tracking-tight">
                      {currentCard.frente}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium pt-2">
                      Pressione <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-[11px] font-mono">Espaço</kbd> ou clique abaixo para ver a resposta.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 animate-fadeIn text-center sm:text-left">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Resposta & Explicação:
                    </div>
                    <div className="text-base sm:text-xl font-medium text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line bg-slate-50/80 dark:bg-slate-800/40 p-4 sm:p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                      {currentCard.verso}
                    </div>
                  </div>
                )}
              </div>

              {/* Botão de Revelar se a resposta ainda não estiver exibida */}
              {!isFlipped && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => setIsFlipped(true)}
                    className="w-full justify-center font-bold py-3.5 rounded-2xl shadow-lg hover:scale-[1.01] transition-transform text-sm sm:text-base"
                    leftIcon={<RotateCw className="w-4 h-4" />}
                  >
                    Mostrar Resposta
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* 3. RODAPÉ DE REPETIÇÃO ESPAÇADA (SRS / ANKI - 4 BOTÕES) */}
      <div className="w-full max-w-4xl mx-auto pb-2">
        {isFlipped && !isSessionFinished && (
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl animate-fadeIn">
            <div className="text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
              COMO FOI SUA RECORDAÇÃO? (SELECIONE OU USE AS TECLAS 1, 2, 3, 4)
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-1">
              {/* 🔴 Errei (Tecla 1) - Estilo Vermelho Vibrante Fixo */}
              <button
                type="button"
                onClick={() => handleRate('errei')}
                className="flex flex-col items-center justify-between p-4 rounded-2xl border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-b from-red-700 to-red-500 border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)] h-44 text-white cursor-pointer select-none"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white shadow-md border border-white/40 mb-2 shrink-0">
                  <X className="w-6 h-6 text-red-600 stroke-[3]" />
                </div>
                <div className="text-center flex-1 flex flex-col justify-center">
                  <span className="font-bold text-lg md:text-xl block text-white drop-shadow-sm">Errei</span>
                  <span className="text-xs text-white/80 block mt-0.5">&lt; 1 min (rever hoje)</span>
                </div>
                <div className="mt-2 w-5 h-5 flex items-center justify-center rounded bg-red-950/80 border border-white/10 text-[10px] font-bold text-white/90">
                  1
                </div>
              </button>

              {/* 🟡 Difícil (Tecla 2) - Estilo Laranja/Amarelo Fixo */}
              <button
                type="button"
                onClick={() => handleRate('dificil')}
                className="flex flex-col items-center justify-between p-4 rounded-2xl border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-b from-amber-600 to-amber-500 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)] h-44 text-white cursor-pointer select-none"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white shadow-md border border-white/40 mb-2 shrink-0">
                  <span className="text-amber-500 font-black text-2xl leading-none select-none">~</span>
                </div>
                <div className="text-center flex-1 flex flex-col justify-center">
                  <span className="font-bold text-lg md:text-xl block text-white drop-shadow-sm">Difícil</span>
                  <span className="text-xs text-white/80 block mt-0.5">1 dia (+1d)</span>
                </div>
                <div className="mt-2 w-5 h-5 flex items-center justify-center rounded bg-amber-950/80 border border-white/10 text-[10px] font-bold text-white/90">
                  2
                </div>
              </button>

              {/* 🔵 Bom (Tecla 3) - Estilo Azul Fixo */}
              <button
                type="button"
                onClick={() => handleRate('bom')}
                className="flex flex-col items-center justify-between p-4 rounded-2xl border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-b from-blue-700 to-blue-500 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.4)] h-44 text-white cursor-pointer select-none"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white shadow-md border border-white/40 mb-2 shrink-0">
                  <Check className="w-6 h-6 text-blue-600 stroke-[3]" />
                </div>
                <div className="text-center flex-1 flex flex-col justify-center">
                  <span className="font-bold text-lg md:text-xl block text-white drop-shadow-sm">Bom</span>
                  <span className="text-xs text-white/80 block mt-0.5">3 dias (+3d)</span>
                </div>
                <div className="mt-2 w-5 h-5 flex items-center justify-center rounded bg-blue-950/80 border border-white/10 text-[10px] font-bold text-white/90">
                  3
                </div>
              </button>

              {/* 🟢 Fácil (Tecla 4) - Estilo Verde Fixo e Vibrante */}
              <button
                type="button"
                onClick={() => handleRate('facil')}
                style={{
                  background: 'linear-gradient(to bottom, #047857, #10b981)',
                  borderColor: '#34d399',
                  boxShadow: '0 0 15px rgba(16, 185, 129, 0.45)'
                }}
                className="flex flex-col items-center justify-between p-4 rounded-2xl border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-b from-emerald-700 to-emerald-500 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.45)] h-44 text-white cursor-pointer select-none !text-white"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white shadow-md border border-white/40 mb-2 shrink-0">
                  <Sparkles 
                    className="w-6 h-6 shrink-0" 
                    style={{ color: '#059669', fill: 'rgba(5, 150, 105, 0.25)', stroke: '#059669' }} 
                  />
                </div>
                <div className="text-center flex-1 flex flex-col justify-center">
                  <span className="font-bold text-lg md:text-xl block text-white drop-shadow-sm">Fácil</span>
                  <span className="text-xs text-white/80 block mt-0.5">8 dias (+8d)</span>
                </div>
                <div 
                  style={{ backgroundColor: 'rgba(2, 44, 34, 0.8)' }}
                  className="mt-2 w-5 h-5 flex items-center justify-center rounded bg-emerald-950/80 border border-white/10 text-[10px] font-bold text-white/90"
                >
                  4
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. MODAL DE FINALIZAÇÃO DA SESSÃO */}
      {isSessionFinished && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 animate-scaleUp text-center">
            {/* Ícone de Conquista com Brilho */}
            <div className="relative mx-auto w-20 h-20 rounded-3xl bg-primary/10 text-primary flex items-center justify-center">
              <Trophy className="w-10 h-10 animate-bounce" />
              <div className="absolute inset-0 rounded-3xl bg-primary/20 blur-xl -z-10" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                Sessão Concluída! 🎉
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Você reforçou seus conhecimentos e fortaleceu sua memória de longo prazo.
              </p>
            </div>

            {/* Grid de Estatísticas Resumidas */}
            <div className="grid grid-cols-3 gap-2.5 py-2">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Revisados
                </span>
                <span className="text-lg font-black text-slate-900 dark:text-slate-100">
                  {stats.totalAnswers}
                </span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Precisão
                </span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  {accuracyRate}%
                </span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Tempo
                </span>
                <span className="text-lg font-black text-slate-900 dark:text-slate-100">
                  {formatTime(secondsElapsed)}
                </span>
              </div>
            </div>

            {/* Recompensa de Gamificação (XP) */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center gap-2">
              <Flame className="w-5 h-5 fill-current" />
              <span className="text-sm font-bold">
                +{Math.max(10, stats.totalAnswers * 5 + 15)} XP adicionados ao seu perfil!
              </span>
            </div>

            {/* Ação de Conclusão */}
            <Button
              variant="primary"
              size="lg"
              onClick={handleFinishAndExit}
              className="w-full justify-center font-black py-3.5 rounded-2xl shadow-lg hover:scale-[1.01] transition-transform text-sm tracking-wide"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Concluir e Voltar aos Baralhos
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
