import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layers, 
  Plus, 
  Sparkles, 
  BrainCircuit, 
  Clock, 
  CheckCircle2, 
  BookOpen, 
  FolderPlus, 
  Search, 
  ChevronRight, 
  RotateCw,
  Eye,
  EyeOff,
  Flame,
  Scale,
  Shield,
  Filter,
  Check,
  X,
  ArrowLeft,
  GraduationCap,
  Sparkle,
  TrendingUp,
  Target
} from 'lucide-react';
import { Flashcard, Deck, Disciplina, Assunto, NavigationTab } from '../../types';
import { Button } from '../../design-system/Button';
import { Modal } from '../../design-system/Modal';
import { FlashcardPlayer, ReviewSessionStats } from './FlashcardPlayer';

export interface FlashcardsProps {
  disciplinas?: Disciplina[];
  assuntos?: Assunto[];
  onNavigateTab?: (tab: NavigationTab) => void;
}

const STORAGE_KEY_FLASHCARDS = '@gabarita:flashcards';
const STORAGE_KEY_DECKS = '@gabarita:decks';

// Mock inicial inteligente caso o usuário ainda não possua dados no localStorage
const INITIAL_DECKS: Deck[] = [
  {
    id: 'deck-1',
    disciplina: 'Direito Constitucional',
    nome: 'Direitos e Garantias Fundamentais (Art. 5º)',
    totalCards: 2,
    pendentesHoje: 2,
    icone: 'Scale',
  },
  {
    id: 'deck-2',
    disciplina: 'Língua Portuguesa',
    nome: 'Crase & Regência Gramatical',
    totalCards: 1,
    pendentesHoje: 1,
    icone: 'BookOpen',
  },
  {
    id: 'deck-3',
    disciplina: 'Direito Administrativo',
    nome: 'Princípios Expressos (LIMPE)',
    totalCards: 1,
    pendentesHoje: 1,
    icone: 'Shield',
  },
];

const INITIAL_FLASHCARDS: Flashcard[] = [
  {
    id: 'card-1',
    deckId: 'deck-1',
    disciplina: 'Direito Constitucional',
    topico: 'Direitos Individuais e Coletivos',
    frente: 'O que prevê o princípio da inafastabilidade da jurisdição (art. 5º, XXXV da CF/88)?',
    verso: 'A lei não excluirá da apreciação do Poder Judiciário lesão ou ameaça a direito (princípio do livre acesso à Justiça).',
    dificuldade: 'bom',
    intervaloDias: 1,
    proximaRevisao: new Date().toISOString(),
    criadoEm: new Date().toISOString(),
    revisoesTotal: 2,
  },
  {
    id: 'card-2',
    deckId: 'deck-1',
    disciplina: 'Direito Constitucional',
    topico: 'Remédios Constitucionais',
    frente: 'Qual é o remédio constitucional adequado para assegurar o conhecimento de informações relativas à pessoa do impetrante constantes de registros públicos?',
    verso: 'Habeas Data (art. 5º, LXXII, "a" da CF/88).',
    dificuldade: 'facil',
    intervaloDias: 3,
    proximaRevisao: new Date().toISOString(),
    criadoEm: new Date().toISOString(),
    revisoesTotal: 3,
  },
  {
    id: 'card-3',
    deckId: 'deck-2',
    disciplina: 'Língua Portuguesa',
    topico: 'Crase',
    frente: 'Quais são as principais situações proibitivas de ocorrência da crase?',
    verso: '1. Antes de palavras masculinas;\n2. Antes de verbos;\n3. Diante da maioria dos pronomes (pessoais, indefinidos, de tratamento);\n4. Em expressões de palavras repetidas (dia a dia).',
    dificuldade: 'bom',
    intervaloDias: 1,
    proximaRevisao: new Date().toISOString(),
    criadoEm: new Date().toISOString(),
    revisoesTotal: 1,
  },
  {
    id: 'card-4',
    deckId: 'deck-3',
    disciplina: 'Direito Administrativo',
    topico: 'Princípios Expressos',
    frente: 'Quais são os 5 princípios expressos da Administração Pública no caput do art. 37 da CF/88 (LIMPE)?',
    verso: 'Legalidade, Impessoalidade, Moralidade, Publicidade e Eficiência.',
    dificuldade: 'bom',
    intervaloDias: 1,
    proximaRevisao: new Date().toISOString(),
    criadoEm: new Date().toISOString(),
    revisoesTotal: 2,
  },
];

// Helper para selecionar ícone temático conforme a disciplina
const getDisciplinaIcon = (disciplinaNome: string) => {
  const norm = (disciplinaNome || '').toLowerCase();
  if (norm.includes('constitucional') || norm.includes('juríd') || norm.includes('direito')) {
    return Scale;
  }
  if (norm.includes('portug') || norm.includes('redação') || norm.includes('gramát')) {
    return BookOpen;
  }
  if (norm.includes('administrativ') || norm.includes('gestão') || norm.includes('públic')) {
    return Shield;
  }
  if (norm.includes('lógic') || norm.includes('matemát') || norm.includes('estatíst')) {
    return BrainCircuit;
  }
  return Layers;
};

export const Flashcards: React.FC<FlashcardsProps> = ({
  disciplinas = [],
  assuntos = [],
}) => {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [filterDisciplina, setFilterDisciplina] = useState<string>('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Modo de Revisão / Prática Interativa
  const [isReviewSessionActive, setIsReviewSessionActive] = useState(false);
  const [reviewDeckId, setReviewDeckId] = useState<string | null>(null);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [cardRevealedIds, setCardRevealedIds] = useState<Record<string, boolean>>({});

  // Formulário do Modal de Criação
  const [formDisciplina, setFormDisciplina] = useState('');
  const [formDeckMode, setFormDeckMode] = useState<'existente' | 'novo'>('existente');
  const [formDeckId, setFormDeckId] = useState('');
  const [formNewDeckName, setFormNewDeckName] = useState('');
  const [formTopico, setFormTopico] = useState('');
  const [formFrente, setFormFrente] = useState('');
  const [formVerso, setFormVerso] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // 1. Carregamento inicial do localStorage com fallback
  useEffect(() => {
    try {
      const storedCards = localStorage.getItem(STORAGE_KEY_FLASHCARDS);
      const storedDecks = localStorage.getItem(STORAGE_KEY_DECKS);

      if (storedCards) {
        setFlashcards(JSON.parse(storedCards));
      } else {
        localStorage.setItem(STORAGE_KEY_FLASHCARDS, JSON.stringify(INITIAL_FLASHCARDS));
        setFlashcards(INITIAL_FLASHCARDS);
      }

      if (storedDecks) {
        setDecks(JSON.parse(storedDecks));
      } else {
        localStorage.setItem(STORAGE_KEY_DECKS, JSON.stringify(INITIAL_DECKS));
        setDecks(INITIAL_DECKS);
      }
    } catch (e) {
      console.error('Erro ao ler flashcards do localStorage:', e);
      setFlashcards(INITIAL_FLASHCARDS);
      setDecks(INITIAL_DECKS);
    }
  }, []);

  // Timer para sumir toast de sucesso
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => {
        setSuccessToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // Persistência
  const saveDecksToStorage = (updatedDecks: Deck[]) => {
    setDecks(updatedDecks);
    localStorage.setItem(STORAGE_KEY_DECKS, JSON.stringify(updatedDecks));
  };

  const saveCardsToStorage = (updatedCards: Flashcard[]) => {
    setFlashcards(updatedCards);
    localStorage.setItem(STORAGE_KEY_FLASHCARDS, JSON.stringify(updatedCards));
  };

  // Nomes de disciplinas unificados (do plano de estudos + dos baralhos existentes)
  const availableDisciplinasList = useMemo(() => {
    const setNames = new Set<string>();
    disciplinas.forEach(d => {
      if (d.name?.trim()) setNames.add(d.name.trim());
    });
    decks.forEach(deck => {
      if (deck.disciplina?.trim()) setNames.add(deck.disciplina.trim());
    });
    if (setNames.size === 0) {
      setNames.add('Direito Constitucional');
      setNames.add('Direito Administrativo');
      setNames.add('Língua Portuguesa');
    }
    return Array.from(setNames);
  }, [disciplinas, decks]);

  // Tópicos sugeridos baseados na disciplina selecionada no formulário
  const suggestedTopics = useMemo(() => {
    if (!formDisciplina) return [];
    const discObj = disciplinas.find(
      d => d.name.toLowerCase() === formDisciplina.toLowerCase()
    );
    if (!discObj) return [];
    return assuntos
      .filter(a => a.disciplinaId === discObj.id)
      .map(a => a.name);
  }, [disciplinas, assuntos, formDisciplina]);

  // Métricas do Hub
  const totalCards = flashcards.length;
  const totalDecks = decks.length;
  const pendentesHoje = useMemo(() => {
    return decks.reduce((acc, d) => acc + (d.pendentesHoje || 0), 0);
  }, [decks]);

  // Taxa de precisão / retenção calculada
  const precisaoCalculada = useMemo(() => {
    if (flashcards.length === 0) return 92;
    const cardsComRevisao = flashcards.filter(c => (c.revisoesTotal || 0) > 0);
    if (cardsComRevisao.length === 0) return 90;
    const cardsDominados = cardsComRevisao.filter(
      c => c.dificuldade === 'facil' || c.dificuldade === 'bom'
    );
    return Math.round((cardsDominados.length / cardsComRevisao.length) * 100);
  }, [flashcards]);

  // Baralhos filtrados por busca e disciplina
  const filteredDecks = useMemo(() => {
    let result = decks;
    if (filterDisciplina !== 'todas') {
      result = result.filter(d => d.disciplina.toLowerCase() === filterDisciplina.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d => 
        d.nome.toLowerCase().includes(q) || 
        d.disciplina.toLowerCase().includes(q)
      );
    }
    return result;
  }, [decks, filterDisciplina, searchQuery]);

  // Agrupamento dos baralhos por Disciplina
  const decksGroupedByDisciplina = useMemo(() => {
    const groups: Record<string, Deck[]> = {};
    filteredDecks.forEach(deck => {
      const disc = deck.disciplina || 'Outros';
      if (!groups[disc]) {
        groups[disc] = [];
      }
      groups[disc].push(deck);
    });
    return groups;
  }, [filteredDecks]);

  // Baralho ativo selecionado para visualização detalhada
  const activeDeck = useMemo(() => {
    return decks.find(d => d.id === selectedDeckId);
  }, [decks, selectedDeckId]);

  const activeCards = useMemo(() => {
    if (!selectedDeckId) return [];
    return flashcards.filter(c => c.deckId === selectedDeckId);
  }, [flashcards, selectedDeckId]);

  // Cards para sessão de revisão interativa
  const cardsParaRevisar = useMemo(() => {
    if (!reviewDeckId) {
      // Revisão geral diária: cards com pendência hoje ou todos os pendentes
      return flashcards.filter(c => (c.intervaloDias || 1) <= 2 || c.dificuldade !== 'facil');
    }
    return flashcards.filter(c => c.deckId === reviewDeckId);
  }, [flashcards, reviewDeckId]);

  // Abertura do modal de criação (com pré-seleção inteligente)
  const handleOpenCreateModal = (preselectedDeck?: Deck, preselectedDisciplina?: string) => {
    setFormErrors({});
    if (preselectedDeck) {
      setFormDisciplina(preselectedDeck.disciplina);
      setFormDeckId(preselectedDeck.id);
      setFormDeckMode('existente');
      setFormNewDeckName('');
    } else if (preselectedDisciplina) {
      setFormDisciplina(preselectedDisciplina);
      const firstDeckOfDisc = decks.find(d => d.disciplina.toLowerCase() === preselectedDisciplina.toLowerCase());
      if (firstDeckOfDisc) {
        setFormDeckId(firstDeckOfDisc.id);
        setFormDeckMode('existente');
      } else {
        setFormDeckMode('novo');
        setFormDeckId('');
      }
      setFormNewDeckName('');
    } else {
      const defaultDisc = availableDisciplinasList[0] || 'Direito Constitucional';
      setFormDisciplina(defaultDisc);
      const defaultDeck = decks.find(d => d.disciplina === defaultDisc) || decks[0];
      if (defaultDeck) {
        setFormDeckId(defaultDeck.id);
        setFormDeckMode('existente');
      } else {
        setFormDeckMode('novo');
        setFormDeckId('');
      }
      setFormNewDeckName('');
    }

    setFormTopico('');
    setFormFrente('');
    setFormVerso('');
    setIsCreateModalOpen(true);
  };

  // Salvar novo flashcard com validação
  const handleSaveFlashcard = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formDisciplina.trim()) {
      errors.disciplina = 'Selecione ou informe a disciplina.';
    }
    if (formDeckMode === 'novo' && !formNewDeckName.trim()) {
      errors.deck = 'Informe o nome do novo baralho.';
    }
    if (formDeckMode === 'existente' && !formDeckId) {
      errors.deck = 'Selecione um baralho existente.';
    }
    if (!formFrente.trim()) {
      errors.frente = 'A pergunta/frente do cartão é obrigatória.';
    }
    if (!formVerso.trim()) {
      errors.verso = 'A resposta/verso do cartão é obrigatória.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    let targetDeckId = formDeckId;
    let targetDeckName = '';

    // Se for criar novo baralho
    if (formDeckMode === 'novo') {
      targetDeckId = `deck-${Date.now()}`;
      targetDeckName = formNewDeckName.trim();
      const newDeck: Deck = {
        id: targetDeckId,
        nome: targetDeckName,
        disciplina: formDisciplina.trim(),
        totalCards: 1,
        pendentesHoje: 1,
      };
      const updatedDecks = [newDeck, ...decks];
      saveDecksToStorage(updatedDecks);
    } else {
      // Atualizar estatísticas do baralho existente
      const curDeck = decks.find(d => d.id === targetDeckId);
      targetDeckName = curDeck ? curDeck.nome : 'Baralho';
      const updatedDecks = decks.map(d => {
        if (d.id === targetDeckId) {
          return {
            ...d,
            totalCards: (d.totalCards || 0) + 1,
            pendentesHoje: (d.pendentesHoje || 0) + 1,
          };
        }
        return d;
      });
      saveDecksToStorage(updatedDecks);
    }

    // Criar o cartão
    const newFlashcard: Flashcard = {
      id: `card-${Date.now()}`,
      deckId: targetDeckId,
      disciplina: formDisciplina.trim(),
      topico: formTopico.trim() || undefined,
      frente: formFrente.trim(),
      verso: formVerso.trim(),
      dificuldade: 'bom',
      intervaloDias: 1,
      proximaRevisao: new Date().toISOString(),
      criadoEm: new Date().toISOString(),
      revisoesTotal: 0,
    };

    saveCardsToStorage([newFlashcard, ...flashcards]);

    // Limpar campos
    setFormFrente('');
    setFormVerso('');
    setFormTopico('');
    setFormErrors({});
    setIsCreateModalOpen(false);

    // Feedback de sucesso
    setSuccessToast(`Flashcard adicionado com sucesso ao baralho "${targetDeckName}"! 🎉`);
  };

  // Iniciar sessão de revisão
  const handleStartReview = (deckId?: string) => {
    setReviewDeckId(deckId || null);
    setCurrentReviewIndex(0);
    setIsCardFlipped(false);
    setIsReviewSessionActive(true);
  };

  // Callback de finalização da sessão no FlashcardPlayer
  const handleFinishReviewSession = (sessionStats: ReviewSessionStats) => {
    setIsReviewSessionActive(false);
    setReviewDeckId(null);

    // Recarregar flashcards e decks atualizados do localStorage
    try {
      const storedCards = localStorage.getItem(STORAGE_KEY_FLASHCARDS);
      if (storedCards) setFlashcards(JSON.parse(storedCards));
      const storedDecks = localStorage.getItem(STORAGE_KEY_DECKS);
      if (storedDecks) setDecks(JSON.parse(storedDecks));
    } catch (e) {
      console.warn('Erro ao atualizar estados locais após revisão:', e);
    }

    setSuccessToast(
      `Sessão concluída! ${sessionStats.totalReviewed} revisões realizadas • +${sessionStats.xpEarned} XP conquistados! 🏆`
    );
  };

  const toggleCardReveal = (cardId: string) => {
    setCardRevealedIds(prev => ({ ...prev, [cardId]: !prev[cardId] }));
  };

  return (
    <div className="space-y-6">
      {/* Toast de Feedback de Sucesso */}
      {successToast && (
        <div className="fixed top-20 right-6 z-50 animate-bounce flex items-center gap-3 px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-lg border border-emerald-500">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm font-semibold">{successToast}</span>
          <button 
            onClick={() => setSuccessToast(null)}
            className="ml-2 hover:opacity-80 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Barra Superior / Cabeçalho Principal no padrão Gabarita PRO */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary-600 dark:text-primary-400">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Hub de Flashcards
                <span className="text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary-700 dark:text-primary-300 border border-primary/30">
                  SM-2 Ativo
                </span>
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Memorização ativa de alto rendimento por disciplinas e repetição inteligente.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => handleOpenCreateModal()}
            className="shadow-sm font-bold text-sm tracking-wide"
          >
            Criar Flashcard
          </Button>
        </div>
      </div>

      {/* 2. Barra Superior com Estatísticas / Métricas Resumidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Baralhos Ativos */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Baralhos Ativos
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                {totalDecks}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                decks
              </span>
            </div>
          </div>
        </div>

        {/* Total Cards */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Total Cards
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                {totalCards}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                memorizados
              </span>
            </div>
          </div>
        </div>

        {/* Para Revisar Hoje */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Para Revisar Hoje
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
                {pendentesHoje}
              </span>
              <span className="text-xs text-amber-600/80 dark:text-amber-400/80 font-medium">
                pendentes
              </span>
            </div>
          </div>
        </div>

        {/* Progresso / Precisão */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center gap-3.5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Progresso / Precisão
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {precisaoCalculada}%
              </span>
              <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-medium">
                retenção
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Banner / Card de Destaque da "Revisão Diária" */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/25 dark:border-primary/20 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-full bg-primary text-white shadow-xs">
                <Flame className="w-3.5 h-3.5 fill-current" />
                META DO DIA
              </span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Algoritmo SuperMemo 2
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
              Revisão Diária de Flashcards
            </h2>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {pendentesHoje > 0 ? (
                <>
                  Você possui <strong className="text-slate-900 dark:text-white font-bold">{pendentesHoje} {pendentesHoje === 1 ? 'cartão agendado' : 'cartões agendados'}</strong> para hoje. Revise-os agora para fixar na memória de longo prazo e evitar a curva do esquecimento.
                </>
              ) : (
                'Excelente trabalho! Todos os seus flashcards programados para hoje já foram revisados. Você pode iniciar um treino livre em qualquer baralho abaixo.'
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full lg:w-auto">
            <Button
              variant="primary"
              size="lg"
              leftIcon={<Flame className="w-5 h-5 fill-current" />}
              onClick={() => handleStartReview()}
              disabled={pendentesHoje === 0 && flashcards.length === 0}
              className="font-black text-sm tracking-wide shadow-md hover:scale-[1.02] transition-transform w-full sm:w-auto justify-center"
            >
              Iniciar Revisão ({pendentesHoje} pendentes)
            </Button>
          </div>
        </div>

        {/* Efeito decorativo de fundo */}
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 4. Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar baralho ou conteúdo..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0 font-medium">
            <Filter className="w-3.5 h-3.5" /> Filtrar:
          </div>
          <select
            value={filterDisciplina}
            onChange={(e) => setFilterDisciplina(e.target.value)}
            className="text-xs font-semibold px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="todas">Todas as Disciplinas</option>
            {availableDisciplinasList.map(disc => (
              <option key={disc} value={disc}>{disc}</option>
            ))}
          </select>

          {selectedDeckId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDeckId(null)}
              className="text-xs shrink-0"
              leftIcon={<ArrowLeft className="w-3 h-3" />}
            >
              Voltar aos Baralhos
            </Button>
          )}
        </div>
      </div>

      {/* 5. Grade / Lista de Baralhos agrupados por Disciplina OU Detalhes do Baralho */}
      {!selectedDeckId ? (
        <div className="space-y-8">
          {Object.keys(decksGroupedByDisciplina).length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <Layers className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  Nenhum baralho encontrado
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  {searchQuery || filterDisciplina !== 'todas'
                    ? 'Tente ajustar os filtros ou a busca para localizar seus baralhos.'
                    : 'Crie seu primeiro flashcard para organizar seus estudos por disciplina.'}
                </p>
              </div>
              <Button
                variant="primary"
                size="md"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => handleOpenCreateModal()}
              >
                + Criar Primeiro Flashcard
              </Button>
            </div>
          ) : (
            Object.entries(decksGroupedByDisciplina).map(([disciplinaNome, disciplinaDecks]) => {
              const IconComp = getDisciplinaIcon(disciplinaNome);
              const totalCardsDaDisciplina = disciplinaDecks.reduce(
                (acc, d) => acc + (d.totalCards || 0), 0
              );
              const pendentesDaDisciplina = disciplinaDecks.reduce(
                (acc, d) => acc + (d.pendentesHoje || 0), 0
              );

              return (
                <div key={disciplinaNome} className="space-y-4">
                  {/* Cabeçalho da Disciplina Agrupadora */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base font-black text-slate-900 dark:text-slate-100">
                          {disciplinaNome}
                        </h2>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {disciplinaDecks.length} {disciplinaDecks.length === 1 ? 'baralho' : 'baralhos'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span>Total: <strong className="text-slate-700 dark:text-slate-300 font-bold">{totalCardsDaDisciplina} cards</strong></span>
                      {pendentesDaDisciplina > 0 && (
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          • {pendentesDaDisciplina} para hoje
                        </span>
                      )}
                      <button
                        onClick={() => handleOpenCreateModal(undefined, disciplinaNome)}
                        className="text-primary hover:underline font-bold text-xs flex items-center gap-1 cursor-pointer ml-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Novo card nesta matéria
                      </button>
                    </div>
                  </div>

                  {/* Grade de Cards de Baralhos da Disciplina */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {disciplinaDecks.map((deck) => {
                      const deckCards = flashcards.filter(c => c.deckId === deck.id);
                      return (
                        <div
                          key={deck.id}
                          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between hover:border-primary/50 dark:hover:border-primary/50 transition-all shadow-xs hover:shadow-md group"
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 truncate max-w-[170px]">
                                {deck.disciplina}
                              </span>

                              {deck.pendentesHoje > 0 ? (
                                <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0">
                                  {deck.pendentesHoje} hoje
                                </span>
                              ) : (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                                  Em dia
                                </span>
                              )}
                            </div>

                            <div>
                              <h3 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors text-base line-clamp-2">
                                {deck.nome}
                              </h3>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {deckCards.length} {deckCards.length === 1 ? 'cartão cadastrado' : 'cartões cadastrados'}
                              </p>
                            </div>
                          </div>

                          {/* Rodapé do Card do Baralho */}
                          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                            <button
                              onClick={() => setSelectedDeckId(deck.id)}
                              className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" /> Ver Cards ({deckCards.length})
                            </button>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleOpenCreateModal(deck)}
                                title="Adicionar flashcard neste baralho"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleStartReview(deck.id)}
                                className="text-xs font-bold"
                                rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                              >
                                Revisar
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Visualização Detalhada dos Cards do Baralho Selecionado */
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedDeckId(null)}
                  className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar aos Baralhos
                </button>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {activeDeck?.disciplina}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {activeDeck?.nome}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {activeCards.length} {activeCards.length === 1 ? 'cartão cadastrado' : 'cartões cadastrados'} neste baralho
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenCreateModal(activeDeck)}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                + Adicionar ao Baralho
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleStartReview(activeDeck?.id)}
                leftIcon={<Flame className="w-3.5 h-3.5 fill-current" />}
              >
                Revisar Agora
              </Button>
            </div>
          </div>

          {activeCards.length === 0 ? (
            <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
              <Layers className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Nenhum cartão neste baralho ainda.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleOpenCreateModal(activeDeck)}
              >
                + Criar Primeiro Cartão
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeCards.map((card, idx) => {
                const isRevealed = !!cardRevealedIds[card.id];
                return (
                  <div
                    key={card.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between space-y-4 shadow-xs"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                        <span className="font-mono font-bold"># {idx + 1}</span>
                        {card.topico && (
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-medium">
                            {card.topico}
                          </span>
                        )}
                      </div>

                      {/* Frente do Flashcard */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          FRENTE (PERGUNTA)
                        </span>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">
                          {card.frente}
                        </p>
                      </div>

                      {/* Verso do Flashcard (Resposta) */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
                        <span className="text-[10px] font-black uppercase tracking-wider text-primary-600 dark:text-primary-400 block mb-1">
                          VERSO (RESPOSTA)
                        </span>
                        {isRevealed ? (
                          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                            {card.verso}
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleCardReveal(card.id)}
                            className="w-full py-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> Clique para revelar resposta
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Intervalo: {card.intervaloDias || 1}d
                      </span>
                      {isRevealed && (
                        <button
                          type="button"
                          onClick={() => toggleCardReveal(card.id)}
                          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          Ocultar resposta
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: CRIAR FLASHCARD */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Criar Flashcard"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveFlashcard} className="space-y-4">
          {/* Seleção de Disciplina */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Disciplina do Edital / Plano *
            </label>
            <select
              value={formDisciplina}
              onChange={(e) => {
                const val = e.target.value;
                setFormDisciplina(val);
                // Ajustar baralhos existentes para essa disciplina
                const discDecks = decks.filter(d => d.disciplina.toLowerCase() === val.toLowerCase());
                if (discDecks.length > 0) {
                  setFormDeckId(discDecks[0].id);
                  setFormDeckMode('existente');
                } else {
                  setFormDeckMode('novo');
                  setFormDeckId('');
                }
              }}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-900 dark:text-slate-100"
            >
              {availableDisciplinasList.map(dName => (
                <option key={dName} value={dName}>
                  {dName}
                </option>
              ))}
            </select>
            {formErrors.disciplina && (
              <span className="text-[11px] text-rose-500 font-semibold mt-1 block">
                {formErrors.disciplina}
              </span>
            )}
          </div>

          {/* Seleção de Baralho (Existente ou Novo) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Baralho (Deck) *
              </label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setFormDeckMode('existente')}
                  className={`px-2 py-0.5 rounded cursor-pointer font-semibold ${
                    formDeckMode === 'existente'
                      ? 'bg-primary text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Existente
                </button>
                <button
                  type="button"
                  onClick={() => setFormDeckMode('novo')}
                  className={`px-2 py-0.5 rounded cursor-pointer font-semibold ${
                    formDeckMode === 'novo'
                      ? 'bg-primary text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  + Novo Baralho
                </button>
              </div>
            </div>

            {formDeckMode === 'existente' ? (
              <select
                value={formDeckId}
                onChange={(e) => setFormDeckId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-900 dark:text-slate-100"
              >
                {decks
                  .filter(d => !formDisciplina || d.disciplina.toLowerCase() === formDisciplina.toLowerCase())
                  .map(d => (
                    <option key={d.id} value={d.id}>
                      {d.nome} ({d.totalCards || 0} cards)
                    </option>
                  ))}
                {decks.filter(d => !formDisciplina || d.disciplina.toLowerCase() === formDisciplina.toLowerCase()).length === 0 && (
                  <option value="" disabled>Nenhum baralho cadastrado nesta disciplina</option>
                )}
              </select>
            ) : (
              <input
                type="text"
                value={formNewDeckName}
                onChange={(e) => setFormNewDeckName(e.target.value)}
                placeholder="Ex: Direitos Individuais (Art. 5º)"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-900 dark:text-slate-100"
              />
            )}
            {formErrors.deck && (
              <span className="text-[11px] text-rose-500 font-semibold mt-1 block">
                {formErrors.deck}
              </span>
            )}
          </div>

          {/* Campo de Tópico / Assunto (opcional ou busca/sugestão) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tópico / Assunto do Edital (Opcional)
            </label>
            <input
              type="text"
              list="topicos-sugestoes"
              value={formTopico}
              onChange={(e) => setFormTopico(e.target.value)}
              placeholder="Ex: Habeas Corpus, Crase, Atos Administrativos..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-slate-100"
            />
            {suggestedTopics.length > 0 && (
              <datalist id="topicos-sugestoes">
                {suggestedTopics.map(t => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            )}
          </div>

          {/* Pergunta (Frente) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Pergunta / Conceito (Frente) *
            </label>
            <textarea
              rows={3}
              value={formFrente}
              onChange={(e) => setFormFrente(e.target.value)}
              placeholder="Digite o conceito central, pergunta-chave ou caso prático para recordar..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-900 dark:text-slate-100 resize-none"
            />
            {formErrors.frente && (
              <span className="text-[11px] text-rose-500 font-semibold mt-1 block">
                {formErrors.frente}
              </span>
            )}
          </div>

          {/* Resposta / Explicação (Verso) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Resposta / Explicação (Verso) *
            </label>
            <textarea
              rows={3}
              value={formVerso}
              onChange={(e) => setFormVerso(e.target.value)}
              placeholder="Digite a resposta objetiva, fundamentação legal, súmula ou mnemônico..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-900 dark:text-slate-100 resize-none"
            />
            {formErrors.verso && (
              <span className="text-[11px] text-rose-500 font-semibold mt-1 block">
                {formErrors.verso}
              </span>
            )}
          </div>

          {/* Ações do Formulário */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              leftIcon={<Check className="w-4 h-4" />}
            >
              Salvar Flashcard
            </Button>
          </div>
        </form>
      </Modal>

      {/* PLAYER INTERATIVO DE REVISÃO ATIVA (SUPERMEMO SRS / ANKI) */}
      {isReviewSessionActive && (
        <FlashcardPlayer
          cards={cardsParaRevisar.length > 0 ? cardsParaRevisar : flashcards}
          deckName={activeDeck?.nome || (reviewDeckId ? decks.find(d => d.id === reviewDeckId)?.nome : 'Revisão Diária')}
          disciplinaName={activeDeck?.disciplina || (reviewDeckId ? decks.find(d => d.id === reviewDeckId)?.disciplina : 'Flashcards')}
          onFinish={handleFinishReviewSession}
          onClose={() => setIsReviewSessionActive(false)}
        />
      )}
    </div>
  );
};

export const FlashcardsView = Flashcards;
