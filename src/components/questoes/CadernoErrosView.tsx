import React, { useState, useMemo } from 'react';
import { 
  BookX, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Edit2, 
  Search, 
  Flame, 
  Check, 
  X, 
  Calendar, 
  Zap, 
  CheckCheck,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Filter,
  BarChart3,
  SlidersHorizontal,
  Table as TableIcon,
  LayoutGrid,
  Clock,
  ArrowUpDown,
  Sparkles,
  BookOpen,
  HelpCircle,
  Info,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { 
  ItemCadernoErros, 
  Disciplina, 
  Assunto, 
  MotivoErro, 
  ErroStatusRevisao, 
  QuestionDifficulty, 
  Questao, 
  RegistroBlocoQuestoes 
} from '../../types';
import { Card, CardHeader, CardBody } from '../../design-system/Card';
import { Button } from '../../design-system/Button';
import { Badge } from '../../design-system/Badge';
import { Modal } from '../../design-system/Modal';
import { EmptyContestState } from '../common/EmptyContestState';

export interface CadernoErrosViewProps {
  cadernoErros: ItemCadernoErros[];
  disciplinas: Disciplina[];
  assuntos: Assunto[];
  questoes?: Questao[];
  blocosQuestoes?: RegistroBlocoQuestoes[];
  onNavigateTab?: (tab: any) => void;
  onAddCadernoErro: (item: Omit<ItemCadernoErros, 'id' | 'createdAt' | 'updatedAt' | 'reincidenciaCount'> & { reincidenciaCount?: number }) => Promise<void>;
  onUpdateCadernoErro: (id: string, partial: Partial<ItemCadernoErros>) => Promise<void>;
  onDeleteCadernoErro: (id: string) => Promise<void>;
  onIncrementarReincidencia: (id: string) => Promise<void>;
  onMarcarStatusRevisao: (id: string, status: ErroStatusRevisao) => Promise<void>;
  onIniciarRevisaoAssunto?: (disciplinaId: string, assuntoName: string, notes?: string) => Promise<void>;
  onOpenStudyTimer?: (disciplinaId?: string, assuntoId?: string) => void;
}

export const MOTIVOS_CONFIG: Record<MotivoErro, { label: string; color: string; bg: string; border: string; desc: string; icon: string; barColor: string }> = {
  falta_atencao: { 
    label: 'Falta de Atenção', 
    color: 'text-amber-700 dark:text-amber-400', 
    bg: 'bg-amber-50 dark:bg-amber-950/40', 
    border: 'border-amber-200 dark:border-amber-800/60', 
    desc: 'Leitura descuidada / distração', 
    icon: '⚠️',
    barColor: 'bg-amber-500'
  },
  desconhecimento_teoria: { 
    label: 'Desconhecimento da Teoria', 
    color: 'text-purple-700 dark:text-purple-400', 
    bg: 'bg-purple-50 dark:bg-purple-950/40', 
    border: 'border-purple-200 dark:border-purple-800/60', 
    desc: 'Conceito doutrinário não estudado', 
    icon: '📖',
    barColor: 'bg-purple-500'
  },
  pegadinha_banca: { 
    label: 'Pegadinha da Banca', 
    color: 'text-rose-700 dark:text-rose-400', 
    bg: 'bg-rose-50 dark:bg-rose-950/40', 
    border: 'border-rose-200 dark:border-rose-800/60', 
    desc: 'Casca de banana ou pegadinha sutil', 
    icon: '🍌',
    barColor: 'bg-rose-500'
  },
  esquecimento_lei_seca: { 
    label: 'Esquecimento de Lei Seca', 
    color: 'text-blue-700 dark:text-blue-400', 
    bg: 'bg-blue-50 dark:bg-blue-950/40', 
    border: 'border-blue-200 dark:border-blue-800/60', 
    desc: 'Prazo, literalidade ou exceção legal', 
    icon: '⚖️',
    barColor: 'bg-blue-500'
  },
  jurisprudencia: { 
    label: 'Jurisprudência / Súmula', 
    color: 'text-indigo-700 dark:text-indigo-400', 
    bg: 'bg-indigo-50 dark:bg-indigo-950/40', 
    border: 'border-indigo-200 dark:border-indigo-800/60', 
    desc: 'Entendimento de STF, STJ ou TST', 
    icon: '🏛️',
    barColor: 'bg-indigo-500'
  },
  interpretacao: { 
    label: 'Interpretação Textual', 
    color: 'text-teal-700 dark:text-teal-400', 
    bg: 'bg-teal-50 dark:bg-teal-950/40', 
    border: 'border-teal-200 dark:border-teal-800/60', 
    desc: 'Sentido do texto ou inferência errada', 
    icon: '📝',
    barColor: 'bg-teal-500'
  },
  calculo_tempo: { 
    label: 'Pressão de Tempo / Cálculo', 
    color: 'text-orange-700 dark:text-orange-400', 
    bg: 'bg-orange-50 dark:bg-orange-950/40', 
    border: 'border-orange-200 dark:border-orange-800/60', 
    desc: 'Apressamento ou erro de conta', 
    icon: '⏱️',
    barColor: 'bg-orange-500'
  },
  outro: { 
    label: 'Outro Motivo', 
    color: 'text-slate-700 dark:text-slate-400', 
    bg: 'bg-slate-100 dark:bg-slate-800', 
    border: 'border-slate-200 dark:border-slate-700', 
    desc: 'Particularidade do candidato', 
    icon: '📌',
    barColor: 'bg-slate-500'
  },
};

type ViewMode = 'table' | 'cards';
type SortField = 'recentes' | 'reincidentes' | 'disciplina' | 'status';

export const CadernoErrosView: React.FC<CadernoErrosViewProps> = ({
  cadernoErros,
  disciplinas,
  assuntos,
  questoes = [],
  blocosQuestoes = [],
  onAddCadernoErro,
  onUpdateCadernoErro,
  onDeleteCadernoErro,
  onIncrementarReincidencia,
  onMarcarStatusRevisao,
  onIniciarRevisaoAssunto,
  onOpenStudyTimer,
  onNavigateTab,
}) => {
  if (disciplinas.length === 0) {
    return (
      <EmptyContestState
        title="Você ainda não possui disciplinas cadastradas"
        description="Cadastre seu concurso foco e adicione ou importe as matérias para registrar questões erradas e mapear suas armadilhas com o Caderno de Erros Inteligente."
        actionText="Cadastrar Concurso e Matérias"
        onAction={() => (onNavigateTab ? onNavigateTab('concursos') : null)}
      />
    );
  }

  // Modals & form state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemCadernoErros | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [showAnalyticsPanel, setShowAnalyticsPanel] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [feedback, setFeedback] = useState<{ msg: string; type: 'success' | 'info' } | null>(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDisciplina, setFilterDisciplina] = useState('todas');
  const [filterMotivo, setFilterMotivo] = useState('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterBanca, setFilterBanca] = useState('todas');
  const [sortBy, setSortBy] = useState<SortField>('recentes');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Form states
  const [formDisciplinaId, setFormDisciplinaId] = useState(disciplinas[0]?.id || '');
  const [formAssuntoId, setFormAssuntoId] = useState('');
  const [formBanca, setFormBanca] = useState('FGV');
  const [formDifficulty, setFormDifficulty] = useState<QuestionDifficulty>('media');
  const [formMotivo, setFormMotivo] = useState<MotivoErro>('esquecimento_lei_seca');
  const [formStatement, setFormStatement] = useState('');
  const [formObservation, setFormObservation] = useState('');
  const [formCorrectAnswer, setFormCorrectAnswer] = useState('');
  const [formQuestionUrl, setFormQuestionUrl] = useState('');
  const [formStatus, setFormStatus] = useState<ErroStatusRevisao>('pendente');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showFeedback = (msg: string, type: 'success' | 'info' = 'success') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const availableAssuntos = useMemo(() => {
    return assuntos.filter(a => a.disciplinaId === formDisciplinaId);
  }, [assuntos, formDisciplinaId]);

  // Unique bancas for filtering
  const availableBancas = useMemo(() => {
    const set = new Set<string>();
    cadernoErros.forEach(item => {
      if (item.banca && item.banca.trim()) {
        set.add(item.banca.trim().toUpperCase());
      }
    });
    return Array.from(set).sort();
  }, [cadernoErros]);

  // Analytical metrics summary
  const summary = useMemo(() => {
    const total = cadernoErros.length;
    const pendentes = cadernoErros.filter(e => e.statusRevisao === 'pendente').length;
    const emRevisao = cadernoErros.filter(e => e.statusRevisao === 'em_revisao').length;
    const dominados = cadernoErros.filter(e => e.statusRevisao === 'dominado').length;
    const reincidentes = cadernoErros.filter(e => (e.reincidenciaCount || 0) > 1).length;
    const taxaDominio = total > 0 ? Math.round((dominados / total) * 100) : 0;
    
    // Motivos aggregation
    const motivosCounts: Record<MotivoErro, number> = {
      falta_atencao: 0,
      desconhecimento_teoria: 0,
      pegadinha_banca: 0,
      esquecimento_lei_seca: 0,
      jurisprudencia: 0,
      interpretacao: 0,
      calculo_tempo: 0,
      outro: 0,
    };

    cadernoErros.forEach(e => {
      if (motivosCounts[e.motivo] !== undefined) {
        motivosCounts[e.motivo]++;
      } else {
        motivosCounts.outro++;
      }
    });

    // Disciplinas aggregation
    const discMap: Record<string, { id: string; name: string; count: number; dominados: number; color?: string }> = {};
    disciplinas.forEach(d => {
      discMap[d.id] = { id: d.id, name: d.name, count: 0, dominados: 0, color: d.color };
    });

    cadernoErros.forEach(e => {
      if (!discMap[e.disciplinaId]) {
        discMap[e.disciplinaId] = {
          id: e.disciplinaId,
          name: e.disciplinaName || 'Geral',
          count: 0,
          dominados: 0
        };
      }
      discMap[e.disciplinaId].count++;
      if (e.statusRevisao === 'dominado') {
        discMap[e.disciplinaId].dominados++;
      }
    });

    const discStats = Object.values(discMap)
      .filter(d => d.count > 0)
      .sort((a, b) => b.count - a.count);

    // Highest offending motive
    let topMotivo: { motivo: MotivoErro; count: number } | null = null;
    for (const m of Object.keys(motivosCounts) as MotivoErro[]) {
      const cnt = motivosCounts[m];
      if (!topMotivo || cnt > topMotivo.count) {
        topMotivo = { motivo: m, count: cnt };
      }
    }

    return { 
      total, 
      pendentes, 
      emRevisao, 
      dominados, 
      reincidentes, 
      taxaDominio, 
      motivosCounts, 
      discStats,
      topMotivo: topMotivo && topMotivo.count > 0 ? topMotivo : null
    };
  }, [cadernoErros, disciplinas]);

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    let list = cadernoErros.filter(item => {
      const matchDisc = filterDisciplina === 'todas' || item.disciplinaId === filterDisciplina;
      const matchMotivo = filterMotivo === 'todos' || item.motivo === filterMotivo;
      
      let matchStatus = true;
      if (filterStatus === 'reincidente') {
        matchStatus = (item.reincidenciaCount || 0) > 1;
      } else if (filterStatus !== 'todos') {
        matchStatus = item.statusRevisao === filterStatus;
      }

      const matchBanca = filterBanca === 'todas' || (item.banca && item.banca.trim().toUpperCase() === filterBanca);

      const query = searchTerm.toLowerCase().trim();
      const matchSearch = !query || 
        item.statementOrExcerpt.toLowerCase().includes(query) || 
        item.observation.toLowerCase().includes(query) ||
        item.disciplinaName.toLowerCase().includes(query) ||
        item.assuntoName.toLowerCase().includes(query) ||
        (item.correctAnswer && item.correctAnswer.toLowerCase().includes(query)) ||
        (item.banca && item.banca.toLowerCase().includes(query));

      return matchDisc && matchMotivo && matchStatus && matchBanca && matchSearch;
    });

    // Sorting
    list = [...list].sort((a, b) => {
      if (sortBy === 'reincidentes') {
        return (b.reincidenciaCount || 0) - (a.reincidenciaCount || 0);
      }
      if (sortBy === 'disciplina') {
        return (a.disciplinaName || '').localeCompare(b.disciplinaName || '');
      }
      if (sortBy === 'status') {
        const priority: Record<string, number> = { pendente: 1, em_revisao: 2, dominado: 3 };
        return (priority[a.statusRevisao] || 99) - (priority[b.statusRevisao] || 99);
      }
      // 'recentes' default
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      return dateB - dateA;
    });

    return list;
  }, [cadernoErros, filterDisciplina, filterMotivo, filterStatus, filterBanca, searchTerm, sortBy]);

  // Pagination logic
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const handleOpenNewModal = () => {
    setEditingItem(null);
    setFormDisciplinaId(disciplinas[0]?.id || '');
    setFormAssuntoId('');
    setFormBanca('FGV');
    setFormDifficulty('media');
    setFormMotivo('esquecimento_lei_seca');
    setFormStatement('');
    setFormObservation('');
    setFormCorrectAnswer('');
    setFormQuestionUrl('');
    setFormStatus('pendente');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (item: ItemCadernoErros) => {
    setEditingItem(item);
    setFormDisciplinaId(item.disciplinaId);
    setFormAssuntoId(item.assuntoId || '');
    setFormBanca(item.banca || 'FGV');
    setFormDifficulty(item.difficulty || 'media');
    setFormMotivo(item.motivo);
    setFormStatement(item.statementOrExcerpt);
    setFormObservation(item.observation);
    setFormCorrectAnswer(item.correctAnswer || '');
    setFormQuestionUrl(item.questionUrl || '');
    setFormStatus(item.statusRevisao);
    setIsAddModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStatement.trim() || !formObservation.trim()) return;
    const disc = disciplinas.find(d => d.id === formDisciplinaId);
    const top = assuntos.find(a => a.id === formAssuntoId);
    setIsSubmitting(true);
    try {
      if (editingItem) {
        await onUpdateCadernoErro(editingItem.id, {
          disciplinaId: formDisciplinaId,
          disciplinaName: disc?.name || 'Geral',
          assuntoId: formAssuntoId || undefined,
          assuntoName: top?.name || 'Geral',
          banca: formBanca.trim() || undefined,
          difficulty: formDifficulty,
          motivo: formMotivo,
          statementOrExcerpt: formStatement.trim(),
          observation: formObservation.trim(),
          correctAnswer: formCorrectAnswer.trim() || undefined,
          questionUrl: formQuestionUrl.trim() || undefined,
          statusRevisao: formStatus,
        });
        showFeedback('Registro atualizado com sucesso!');
      } else {
        await onAddCadernoErro({
          userId: 'user_demo_01',
          disciplinaId: formDisciplinaId,
          disciplinaName: disc?.name || 'Geral',
          assuntoId: formAssuntoId || undefined,
          assuntoName: top?.name || 'Geral',
          banca: formBanca.trim() || undefined,
          difficulty: formDifficulty,
          motivo: formMotivo,
          statementOrExcerpt: formStatement.trim(),
          observation: formObservation.trim(),
          correctAnswer: formCorrectAnswer.trim() || undefined,
          questionUrl: formQuestionUrl.trim() || undefined,
          statusRevisao: formStatus,
        });
        showFeedback('Questão adicionada ao Caderno de Erros!');
      }
      setIsAddModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirmed = async (id: string) => {
    await onDeleteCadernoErro(id);
    setDeletingId(null);
    showFeedback('Erro excluído do caderno.', 'info');
  };

  const handleQuickStatusChange = async (id: string, currentStatus: ErroStatusRevisao) => {
    const nextStatus: ErroStatusRevisao = 
      currentStatus === 'pendente' ? 'em_revisao' :
      currentStatus === 'em_revisao' ? 'dominado' : 'pendente';
    await onMarcarStatusRevisao(id, nextStatus);
    showFeedback(`Status alterado para: ${nextStatus.replace('_', ' ').toUpperCase()}`);
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setFilterDisciplina('todas');
    setFilterMotivo('todos');
    setFilterStatus('todos');
    setFilterBanca('todas');
    setSortBy('recentes');
    setCurrentPage(1);
  };

  const hasActiveFilters = 
    searchTerm.trim() !== '' || 
    filterDisciplina !== 'todas' || 
    filterMotivo !== 'todos' || 
    filterStatus !== 'todos' || 
    filterBanca !== 'todas' || 
    sortBy !== 'recentes';

  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      {/* Toast Feedback */}
      {feedback && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between shadow-lg border transition-all ${
          feedback.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
            : 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
        }`}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{feedback.msg}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header com Apresentação Visual */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
              <BookX className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                Caderno de Erros & Reincidências
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Mapeie causas-raízes, neutralize pegadinhas e converta pontos fracos em aprovação definitiva.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:self-auto">
          {/* Toggle Diagnóstico */}
          <button
            onClick={() => setShowAnalyticsPanel(!showAnalyticsPanel)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
              showAnalyticsPanel 
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700' 
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
            title="Alternar gráficos analíticos"
          >
            <BarChart3 className="w-4 h-4 text-emerald-500" />
            <span className="hidden sm:inline">Diagnóstico</span>
          </button>

          {/* Toggle Modo Tabela / Cards */}
          <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Visualização em Tabela"
            >
              <TableIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Tabela</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Visualização em Cartões"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>

          {/* Botão Novo Erro */}
          <Button
            size="md"
            variant="primary"
            onClick={handleOpenNewModal}
            leftIcon={<Plus className="w-4 h-4" />}
            className="shadow-sm"
          >
            Novo Erro
          </Button>
        </div>
      </div>

      {/* Grid de 5 KPIs / Métricas Analíticas Avançadas */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs transition-hover hover:border-slate-300 dark:hover:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Erros</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <BookX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-slate-100">{summary.total}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Cadastrados no banco</div>
        </div>

        {/* Pendentes */}
        <div 
          onClick={() => { setFilterStatus('pendente'); setCurrentPage(1); }}
          className={`p-4 bg-white dark:bg-slate-900 border rounded-2xl shadow-xs cursor-pointer transition-all hover:scale-[1.01] ${
            filterStatus === 'pendente' 
              ? 'border-rose-400 ring-2 ring-rose-400/20 bg-rose-50/10' 
              : 'border-rose-200 dark:border-rose-900/40 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Pendentes</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-rose-600 dark:text-rose-400">{summary.pendentes}</div>
          <div className="text-[11px] text-rose-500/80 mt-0.5">Prioridade de estudo</div>
        </div>

        {/* Em Revisão */}
        <div 
          onClick={() => { setFilterStatus('em_revisao'); setCurrentPage(1); }}
          className={`p-4 bg-white dark:bg-slate-900 border rounded-2xl shadow-xs cursor-pointer transition-all hover:scale-[1.01] ${
            filterStatus === 'em_revisao' 
              ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/10' 
              : 'border-amber-200 dark:border-amber-900/40 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Em Revisão</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-amber-600 dark:text-amber-400">{summary.emRevisao}</div>
          <div className="text-[11px] text-amber-500/80 mt-0.5">Em fixação ativa</div>
        </div>

        {/* Dominados */}
        <div 
          onClick={() => { setFilterStatus('dominado'); setCurrentPage(1); }}
          className={`p-4 bg-white dark:bg-slate-900 border rounded-2xl shadow-xs cursor-pointer transition-all hover:scale-[1.01] ${
            filterStatus === 'dominado' 
              ? 'border-emerald-400 ring-2 ring-emerald-400/20 bg-emerald-50/10' 
              : 'border-emerald-200 dark:border-emerald-900/40 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 !text-emerald-600 dark:!text-emerald-400">Dominados</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center !text-emerald-600 dark:!text-emerald-400 !bg-emerald-100 dark:!bg-emerald-900/60">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 !text-emerald-600 dark:!text-emerald-400" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 !text-emerald-600 dark:!text-emerald-400">{summary.dominados}</div>
          <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Taxa: {summary.taxaDominio}% do banco</div>
        </div>

        {/* Reincidentes Críticos */}
        <div 
          onClick={() => { setFilterStatus('reincidente'); setCurrentPage(1); }}
          className={`p-4 bg-white dark:bg-slate-900 border rounded-2xl shadow-xs cursor-pointer transition-all hover:scale-[1.01] col-span-2 lg:col-span-1 ${
            filterStatus === 'reincidente' 
              ? 'border-orange-400 ring-2 ring-orange-400/20 bg-orange-50/10' 
              : 'border-orange-200 dark:border-orange-900/40 hover:border-orange-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">Reincidentes</span>
            <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-orange-600 dark:text-orange-400">{summary.reincidentes}</div>
          <div className="text-[11px] text-orange-500/80 mt-0.5">Erros repetidos 2x ou +</div>
        </div>
      </div>

      {/* Painel Analítico & Gráficos de Diagnóstico (Expansível) */}
      {showAnalyticsPanel && summary.total > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Gráfico de Diagnóstico por Causa Raiz */}
          <Card className="lg:col-span-2">
            <CardHeader
              title={
                <div className="flex items-center gap-2 text-sm sm:text-base font-bold">
                  <BarChart3 className="w-4 h-4 text-emerald-500" />
                  <span>Diagnóstico por Causa Raiz (Motivo do Erro)</span>
                </div>
              }
              subtitle={
                summary.topMotivo 
                  ? `Ofensor Principal: ${MOTIVOS_CONFIG[summary.topMotivo.motivo]?.label} (${summary.topMotivo.count} falhas)`
                  : 'Distribuição dos gatilhos que levaram ao erro'
              }
            />
            <CardBody className="p-4 sm:p-5 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(Object.entries(MOTIVOS_CONFIG) as [MotivoErro, typeof MOTIVOS_CONFIG[MotivoErro]][]).map(([key, cfg]) => {
                  const count = summary.motivosCounts[key] || 0;
                  const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
                  const isTop = summary.topMotivo?.motivo === key && count > 0;
                  const isSelected = filterMotivo === key;

                  return (
                    <div 
                      key={key}
                      onClick={() => {
                        setFilterMotivo(filterMotivo === key ? 'todos' : key);
                        setCurrentPage(1);
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 ring-1 ring-emerald-500/30' 
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">
                          <span>{cfg.icon}</span>
                          <span className="truncate">{cfg.label}</span>
                          {isTop && (
                            <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 shrink-0">
                              Top 1
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0">
                          {count} <span className="text-[10px] font-normal text-slate-400">({pct}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${cfg.barColor} transition-all duration-500 rounded-full`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 text-right">
                * Dica: clique sobre uma causa raiz para filtrar a lista instantaneamente.
              </p>
            </CardBody>
          </Card>

          {/* Concentração por Disciplina */}
          <Card>
            <CardHeader
              title={
                <div className="flex items-center gap-2 text-sm sm:text-base font-bold">
                  <FolderOpen className="w-4 h-4 text-emerald-500" />
                  <span>Vulnerabilidade por Matéria</span>
                </div>
              }
              subtitle="Concentração de erros cadastrados"
            />
            <CardBody className="p-4 sm:p-5 space-y-3">
              {summary.discStats.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Nenhum erro registrado por matéria ainda.
                </div>
              ) : (
                <div className="space-y-3">
                  {summary.discStats.slice(0, 5).map(stat => {
                    const pct = Math.round((stat.count / summary.total) * 100);
                    const isSelected = filterDisciplina === stat.id;
                    return (
                      <div 
                        key={stat.id}
                        onClick={() => {
                          setFilterDisciplina(filterDisciplina === stat.id ? 'todas' : stat.id);
                          setCurrentPage(1);
                        }}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20'
                            : 'border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20 hover:border-slate-200 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-2 truncate font-bold text-slate-800 dark:text-slate-200 pr-2">
                            <span 
                              className="w-2.5 h-2.5 rounded-full shrink-0" 
                              style={{ backgroundColor: stat.color || '#10b981' }} 
                            />
                            <span className="truncate">{stat.name}</span>
                          </div>
                          <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                            {stat.count} erros
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500" 
                            style={{ 
                              width: `${pct}%`,
                              backgroundColor: stat.color || '#10b981' 
                            }} 
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                          <span>{pct}% do total de falhas</span>
                          <span>{stat.dominados} dominados</span>
                        </div>
                      </div>
                    );
                  })}
                  {summary.discStats.length > 5 && (
                    <div className="text-[11px] text-center text-slate-400 pt-1">
                      + {summary.discStats.length - 5} outras matérias registradas
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Barra de Controle & Filtros Combinados */}
      <Card>
        <CardBody className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Campo de Busca em Tempo Real */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Buscar por enunciado, anotação, assunto, gabarito ou banca..."
                className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filtros em Dropdown */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              {/* Disciplina */}
              <select
                value={filterDisciplina}
                onChange={(e) => {
                  setFilterDisciplina(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="todas">Todas as Disciplinas</option>
                {disciplinas.map(d => {
                  const cnt = cadernoErros.filter(e => e.disciplinaId === d.id).length;
                  return (
                    <option key={d.id} value={d.id}>
                      {d.name} {cnt > 0 ? `(${cnt})` : ''}
                    </option>
                  );
                })}
              </select>

              {/* Motivo */}
              <select
                value={filterMotivo}
                onChange={(e) => {
                  setFilterMotivo(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="todos">Todos os Motivos</option>
                {(Object.entries(MOTIVOS_CONFIG) as [MotivoErro, typeof MOTIVOS_CONFIG[MotivoErro]][]).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.icon} {cfg.label}
                  </option>
                ))}
              </select>

              {/* Banca (se houver) */}
              {availableBancas.length > 0 && (
                <select
                  value={filterBanca}
                  onChange={(e) => {
                    setFilterBanca(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="todas">Todas as Bancas</option>
                  {availableBancas.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              )}

              {/* Ordenação */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortField)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="recentes">Mais Recentes</option>
                <option value="reincidentes">Mais Reincidentes</option>
                <option value="disciplina">Disciplina (A-Z)</option>
                <option value="status">Status (Pendente Primeiro)</option>
              </select>
            </div>
          </div>

          {/* Chips de Status & Barra de Informação */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400 font-semibold mr-1">Status:</span>
              {[
                { id: 'todos', label: 'Todos', count: summary.total },
                { id: 'pendente', label: 'Pendentes', count: summary.pendentes, color: 'text-rose-500' },
                { id: 'em_revisao', label: 'Em Revisão', count: summary.emRevisao, color: 'text-amber-500' },
                { id: 'dominado', label: 'Dominados', count: summary.dominados, color: 'text-emerald-500' },
                { id: 'reincidente', label: 'Reincidentes (2x+)', count: summary.reincidentes, color: 'text-orange-500' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setFilterStatus(tab.id);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    filterStatus === tab.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label} <span className="opacity-70 text-[10px]">({tab.count})</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">
                {filteredItems.length} {filteredItems.length === 1 ? 'erro encontrado' : 'erros encontrados'}
              </span>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Limpar filtros
                </button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Conteúdo Principal: Tabela ou Cards */}
      {filteredItems.length === 0 ? (
        <Card className="text-center py-12 px-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
            <BookX className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
            Nenhum erro encontrado
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            {hasActiveFilters 
              ? 'Nenhum registro corresponde aos filtros e termos de busca informados. Tente ajustar os parâmetros.'
              : 'Seu Caderno de Erros está limpo! Cadastre seus erros para que o algoritmo monitore suas vulnerabilidades.'}
          </p>
          {hasActiveFilters ? (
            <Button size="sm" variant="outline" onClick={clearAllFilters}>
              Limpar Filtros
            </Button>
          ) : (
            <Button size="sm" variant="primary" onClick={handleOpenNewModal} leftIcon={<Plus className="w-4 h-4" />}>
              Adicionar Primeiro Erro
            </Button>
          )}
        </Card>
      ) : viewMode === 'table' ? (
        /* Visualização em Tabela Estruturada */
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4">Disciplina & Tópico</th>
                  <th className="py-3.5 px-4 min-w-[280px]">Enunciado & Diagnóstico</th>
                  <th className="py-3.5 px-4">Causa Raiz (Motivo)</th>
                  <th className="py-3.5 px-4 text-center">Reincidência</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {paginatedItems.map((item) => {
                  const motivoCfg = MOTIVOS_CONFIG[item.motivo] || MOTIVOS_CONFIG.outro;
                  const disc = disciplinas.find(d => d.id === item.disciplinaId);
                  const isDominado = item.statusRevisao === 'dominado';
                  const isEmRevisao = item.statusRevisao === 'em_revisao';
                  const reincCount = item.reincidenciaCount || 1;
                  const isExpanded = expandedRowId === item.id;

                  return (
                    <React.Fragment key={item.id}>
                      <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        {/* Disciplina & Tópico */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
                              <span 
                                className="w-2.5 h-2.5 rounded-full shrink-0" 
                                style={{ backgroundColor: disc?.color || '#10b981' }} 
                              />
                              <span className="truncate max-w-[160px]">{item.disciplinaName}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                              {item.assuntoName}
                            </div>
                            {item.banca && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {item.banca}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Enunciado & Análise */}
                        <td className="py-3.5 px-4 align-top space-y-1.5">
                          <p className={`font-medium text-slate-800 dark:text-slate-200 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                            {item.statementOrExcerpt}
                          </p>

                          <div className="p-2 rounded-lg bg-rose-50/70 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-700 dark:text-rose-300 text-[11px]">
                            <div className="font-bold flex items-center gap-1 mb-0.5">
                              <span>💡 Diagnóstico / Regra:</span>
                            </div>
                            <p className={isExpanded ? '' : 'line-clamp-2'}>{item.observation}</p>
                          </div>

                          {/* Informações adicionais se expandido */}
                          {isExpanded && item.correctAnswer && (
                            <div className="p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300 text-[11px]">
                              <span className="font-bold">✅ Gabarito / Fundamento: </span>
                              {item.correctAnswer}
                            </div>
                          )}

                          <div className="flex items-center gap-3 pt-0.5 text-[11px]">
                            {item.questionUrl && (
                              <a
                                href={item.questionUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Link da Questão</span>
                              </a>
                            )}
                            <button
                              onClick={() => setExpandedRowId(isExpanded ? null : item.id)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold"
                            >
                              {isExpanded ? 'Ver menos' : 'Ver mais detalhes'}
                            </button>
                          </div>
                        </td>

                        {/* Causa Raiz */}
                        <td className="py-3.5 px-4 align-top">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border text-[11px] ${motivoCfg.bg} ${motivoCfg.color} ${motivoCfg.border}`}>
                            <span>{motivoCfg.icon}</span>
                            <span>{motivoCfg.label}</span>
                          </span>
                        </td>

                        {/* Reincidência */}
                        <td className="py-3.5 px-4 align-top text-center">
                          {reincCount > 1 ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="px-2 py-0.5 rounded-lg font-black text-xs bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400 border border-orange-200 dark:border-orange-800 flex items-center gap-1">
                                <Flame className="w-3.5 h-3.5 animate-pulse" />
                                {reincCount}x
                              </span>
                              <span className="text-[10px] text-orange-500 font-semibold mt-0.5">Reincidente</span>
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-xs text-slate-500 font-semibold bg-slate-100 dark:bg-slate-800">
                              1x
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 align-top text-center">
                          <button
                            onClick={() => handleQuickStatusChange(item.id, item.statusRevisao)}
                            title="Clique para alternar o status da revisão"
                            className="inline-block transition-transform active:scale-95"
                          >
                            {isDominado ? (
                              <span className="px-2.5 py-1 rounded-lg font-bold text-[11px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 cursor-pointer">
                                <Check className="w-3 h-3" /> Dominado
                              </span>
                            ) : isEmRevisao ? (
                              <span className="px-2.5 py-1 rounded-lg font-bold text-[11px] bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1 cursor-pointer">
                                <RotateCcw className="w-3 h-3" /> Em Revisão
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg font-bold text-[11px] bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1 cursor-pointer">
                                <AlertTriangle className="w-3 h-3" /> Pendente
                              </span>
                            )}
                          </button>
                        </td>

                        {/* Ações Rápidas */}
                        <td className="py-3.5 px-4 align-top text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Incrementar Reincidência */}
                            <button
                              onClick={() => onIncrementarReincidencia(item.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/40 transition-colors"
                              title="Errei de novo (+1 reincidência)"
                            >
                              <Flame className="w-4 h-4 text-orange-500" />
                            </button>

                            {/* Alternar Dominado */}
                            <button
                              onClick={() => onMarcarStatusRevisao(item.id, isDominado ? 'em_revisao' : 'dominado')}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isDominado 
                                  ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40' 
                                  : 'text-emerald-600 dark:text-emerald-400 !text-emerald-600 dark:!text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                              }`}
                              title={isDominado ? 'Reabrir estudo' : 'Marcar como Dominado'}
                            >
                              {isDominado ? <RotateCcw className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                            </button>

                            {/* Abrir Cronômetro no Assunto */}
                            {onOpenStudyTimer && (
                              <button
                                onClick={() => onOpenStudyTimer(item.disciplinaId, item.assuntoId)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                                title="Estudar agora com cronômetro"
                              >
                                <Zap className="w-4 h-4 text-emerald-500" />
                              </button>
                            )}

                            {/* Editar */}
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                              title="Editar registro"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Excluir com confirmação inline */}
                            {deletingId === item.id ? (
                              <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 p-1 rounded-lg border border-rose-200">
                                <button
                                  onClick={() => handleDeleteConfirmed(item.id)}
                                  className="text-[10px] font-bold text-rose-600 hover:underline px-1"
                                >
                                  Sim
                                </button>
                                <button
                                  onClick={() => setDeletingId(null)}
                                  className="text-[10px] text-slate-400 hover:text-slate-600 px-1"
                                >
                                  Não
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeletingId(item.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                title="Excluir erro"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* Visualização em Cartões Detalhados */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paginatedItems.map((item) => {
            const motivoCfg = MOTIVOS_CONFIG[item.motivo] || MOTIVOS_CONFIG.outro;
            const disc = disciplinas.find(d => d.id === item.disciplinaId);
            const isDominado = item.statusRevisao === 'dominado';
            const reincCount = item.reincidenciaCount || 1;

            return (
              <div 
                key={item.id} 
                className="p-5 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-3.5 text-xs shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Topo do Card */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <span 
                        className="w-3 h-3 rounded-full shrink-0" 
                        style={{ backgroundColor: disc?.color || '#10b981' }} 
                      />
                      <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                        {item.disciplinaName} • {item.assuntoName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {reincCount > 1 && (
                        <span className="px-2 py-0.5 rounded-lg font-bold text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400 flex items-center gap-1">
                          <Flame className="w-3 h-3" /> {reincCount}x
                        </span>
                      )}
                      <Badge variant={isDominado ? 'primary' : item.statusRevisao === 'em_revisao' ? 'amber' : 'rose'} size="sm">
                        {item.statusRevisao.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>

                  {/* Motivo Badge */}
                  <div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-bold text-[11px] ${motivoCfg.bg} ${motivoCfg.color}`}>
                      <span>{motivoCfg.icon}</span>
                      <span>{motivoCfg.label}</span>
                    </span>
                  </div>

                  {/* Enunciado */}
                  <p className="font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                    {item.statementOrExcerpt}
                  </p>

                  {/* Diagnóstico */}
                  <div className="text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 p-3 rounded-xl space-y-1">
                    <div className="font-bold text-[11px] flex items-center gap-1">
                      <span>💡 Por que errei e qual a regra?</span>
                    </div>
                    <p className="leading-relaxed">{item.observation}</p>
                  </div>

                  {/* Gabarito Comentado (se houver) */}
                  {item.correctAnswer && (
                    <div className="text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 p-2.5 rounded-xl text-[11px]">
                      <span className="font-bold">✅ Gabarito / Fundamento: </span>
                      <span>{item.correctAnswer}</span>
                    </div>
                  )}

                  {/* Link da questão */}
                  {item.questionUrl && (
                    <div className="pt-0.5">
                      <a
                        href={item.questionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Link da Questão Original</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Rodapé e Ações do Card */}
                <div className="flex flex-wrap justify-between items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => onIncrementarReincidencia(item.id)} 
                      leftIcon={<Flame className="w-3.5 h-3.5 text-orange-500" />}
                    >
                      Errei de novo (+1)
                    </Button>
                    {!isDominado ? (
                      <Button 
                        size="sm" 
                        variant="primary" 
                        onClick={() => onMarcarStatusRevisao(item.id, 'dominado')} 
                        leftIcon={<Check className="w-3.5 h-3.5" />}
                      >
                        Dominar
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => onMarcarStatusRevisao(item.id, 'em_revisao')}
                        leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                      >
                        Reabrir
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {onOpenStudyTimer && (
                      <button
                        onClick={() => onOpenStudyTimer(item.disciplinaId, item.assuntoId)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 transition-colors"
                        title="Cronômetro"
                      >
                        <Zap className="w-4 h-4 text-emerald-500" />
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenEditModal(item)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteCadernoErro(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Paginação Estruturada */}
      {filteredItems.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl text-xs">
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
            <span>
              Exibindo <span className="font-bold text-slate-900 dark:text-slate-100">{(currentPage - 1) * itemsPerPage + 1}</span> a{' '}
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {Math.min(currentPage * itemsPerPage, filteredItems.length)}
              </span>{' '}
              de <span className="font-bold text-slate-900 dark:text-slate-100">{filteredItems.length}</span> erros
            </span>

            <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-slate-200 dark:border-slate-800">
              <span>Por página:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title="Página Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Números das páginas */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && p - prev > 1;

                return (
                  <React.Fragment key={p}>
                    {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                    <button
                      onClick={() => setCurrentPage(p)}
                      className={`min-w-[32px] h-8 px-2 rounded-xl font-bold transition-all ${
                        currentPage === p
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                          : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                );
              })}

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title="Próxima Página"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal Moderno "Novo / Editar Erro" */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={editingItem ? "Editar Registro no Caderno de Erros" : "Novo Registro no Caderno de Erros"}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Disciplina */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Disciplina *
              </label>
              <select
                value={formDisciplinaId}
                onChange={(e) => {
                  setFormDisciplinaId(e.target.value);
                  setFormAssuntoId('');
                }}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                required
              >
                {disciplinas.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Assunto */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tópico / Assunto
              </label>
              <select
                value={formAssuntoId}
                onChange={(e) => setFormAssuntoId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">Geral / Tópico Não Especificado</option>
                {availableAssuntos.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Banca */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Banca Examinadora
              </label>
              <input
                type="text"
                value={formBanca}
                onChange={(e) => setFormBanca(e.target.value)}
                placeholder="Ex: FGV, Cebraspe, FCC..."
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>

            {/* Dificuldade */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Dificuldade
              </label>
              <select
                value={formDifficulty}
                onChange={(e) => setFormDifficulty(e.target.value as QuestionDifficulty)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              >
                <option value="facil">Fácil</option>
                <option value="media">Média</option>
                <option value="dificil">Difícil</option>
              </select>
            </div>

            {/* Status Inicial */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Status Inicial
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as ErroStatusRevisao)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              >
                <option value="pendente">Pendente (Precisa de Revisão)</option>
                <option value="em_revisao">Em Revisão (Fixação Ativa)</option>
                <option value="dominado">Dominado (Superado)</option>
              </select>
            </div>
          </div>

          {/* Causa Raiz */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Causa Raiz / Motivo do Erro *
            </label>
            <select
              value={formMotivo}
              onChange={(e) => setFormMotivo(e.target.value as MotivoErro)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            >
              {(Object.entries(MOTIVOS_CONFIG) as [MotivoErro, typeof MOTIVOS_CONFIG[MotivoErro]][]).map(([k, cfg]) => (
                <option key={k} value={k}>
                  {cfg.icon} {cfg.label} — {cfg.desc}
                </option>
              ))}
            </select>
          </div>

          {/* Link da Questão */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Link da Questão Original (URL Opcional)
            </label>
            <input
              type="url"
              value={formQuestionUrl}
              onChange={(e) => setFormQuestionUrl(e.target.value)}
              placeholder="Ex: https://www.qconcursos.com/questoes-de-concursos/questoes/..."
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>

          {/* Enunciado */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Enunciado ou Trecho da Questão *
            </label>
            <textarea
              rows={3}
              value={formStatement}
              onChange={(e) => setFormStatement(e.target.value)}
              placeholder="Cole o trecho ou a afirmação que levou à dúvida/erro..."
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              required
            />
          </div>

          {/* Análise / Por que errei? */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Diagnóstico: Por que errei e qual a regra / pegadinha? *
            </label>
            <textarea
              rows={3}
              value={formObservation}
              onChange={(e) => setFormObservation(e.target.value)}
              placeholder="Descreva o ponto cego: 'Confundi o prazo de 15 dias com 30 dias...' ou 'A banca usou 'sempre' quando a lei permite exceção...'"
              className="w-full p-2.5 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              required
            />
          </div>

          {/* Gabarito / Fundamento Legal */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Gabarito Correto & Fundamento Legal / Doutrinário (Opcional)
            </label>
            <textarea
              rows={2}
              value={formCorrectAnswer}
              onChange={(e) => setFormCorrectAnswer(e.target.value)}
              placeholder="Ex: Art. 5º, inciso LXVIII da CF/88. Gabarito Letra C."
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>

          {/* Rodapé do Modal */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              {editingItem ? "Salvar Alterações" : "Salvar no Caderno"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// Aliases para máxima compatibilidade modular
export const CadernoErros = CadernoErrosView;
