import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Briefcase, 
  Star, 
  Edit2, 
  Trash2, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink,
  CheckCircle,
  Sparkles,
  Target,
  Calendar,
  Layers,
  Zap,
  ArrowLeft,
  ChevronRight,
  BookOpen,
  Play,
  Clock,
  Circle,
  Check,
  X,
  Lock,
  ChevronDown,
  ChevronUp,
  BarChart2,
  FolderPlus
} from 'lucide-react';
import { 
  Concurso, 
  ConcursoSphere, 
  ConcursoStatus, 
  Prova, 
  UserProfile, 
  Disciplina, 
  Assunto, 
  TopicStatus 
} from '../../types';
import { Card, CardHeader, CardBody, CardFooter } from '../../design-system/Card';
import { Button } from '../../design-system/Button';
import { Input } from '../../design-system/Input';
import { Badge } from '../../design-system/Badge';
import { Modal } from '../../design-system/Modal';
import { NovoConcursoModal, ExtractedDiscipline } from './NovoConcursoModal';

const MAX_CONCURSOS = 3;

const PALETTE_COLORS = [
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#f97316', // Orange
  '#14b8a6', // Teal
];

interface ConcursosViewProps {
  concursos: Concurso[];
  provas: Prova[];
  user: UserProfile;
  disciplinas?: Disciplina[];
  assuntos?: Assunto[];
  onAddConcurso: (concurso: Omit<Concurso, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onAddConcursoWithDisciplinas?: (
    concurso: Omit<Concurso, 'id' | 'createdAt' | 'updatedAt'>,
    disciplinas: ExtractedDiscipline[]
  ) => Promise<void>;
  onUpdateConcurso: (id: string, partial: Partial<Concurso>) => Promise<void>;
  onDeleteConcurso: (id: string) => Promise<void>;
  onSetActiveConcurso: (id: string) => Promise<void>;
  onAddProva: (prova: Omit<Prova, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateProva: (id: string, partial: Partial<Prova>) => Promise<void>;
  onDeleteProva: (id: string) => Promise<void>;
  onAddDisciplina?: (disciplina: Omit<Disciplina, 'id' | 'createdAt' | 'topicsCount' | 'completedTopicsCount' | 'totalStudyMinutes'>) => Promise<void>;
  onUpdateDisciplina?: (id: string, partial: Partial<Disciplina>) => Promise<void>;
  onDeleteDisciplina?: (id: string) => Promise<void>;
  onAddAssunto?: (assunto: Omit<Assunto, 'id' | 'createdAt' | 'masteryLevel' | 'totalQuestionsSolved' | 'correctQuestionsSolved' | 'accuracyRate'>) => Promise<void>;
  onUpdateAssunto?: (id: string, partial: Partial<Assunto>) => Promise<void>;
  onDeleteAssunto?: (id: string) => Promise<void>;
  onUpdateAssuntoStatus?: (id: string, status: TopicStatus) => Promise<void>;
  onOpenStudyTimer?: (disciplinaId?: string, assuntoId?: string) => void;
  onNavigateTab?: (tab: any) => void;
}

export const ConcursosView: React.FC<ConcursosViewProps> = ({
  concursos,
  provas,
  user,
  disciplinas = [],
  assuntos = [],
  onAddConcurso,
  onAddConcursoWithDisciplinas,
  onUpdateConcurso,
  onDeleteConcurso,
  onSetActiveConcurso,
  onAddProva,
  onUpdateProva,
  onDeleteProva,
  onAddDisciplina,
  onUpdateDisciplina,
  onDeleteDisciplina,
  onAddAssunto,
  onUpdateAssunto,
  onDeleteAssunto,
  onUpdateAssuntoStatus,
  onOpenStudyTimer,
  onNavigateTab,
}) => {
  // Navigation: Hub vs Drill-Down (Painel do Concurso)
  const [selectedConcursoId, setSelectedConcursoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'concursos' | 'provas'>('concursos');
  const [searchTerm, setSearchTerm] = useState('');
  const [sphereFilter, setSphereFilter] = useState<'todas' | ConcursoSphere>('todas');
  
  // Modals state
  const [isNovoConcursoWizardOpen, setIsNovoConcursoWizardOpen] = useState(false);
  const [editingConcurso, setEditingConcurso] = useState<Concurso | null>(null);
  const [deletingConcursoId, setDeletingConcursoId] = useState<string | null>(null);
  const [isAddProvaModalOpen, setIsAddProvaModalOpen] = useState(false);
  const [deletingProvaId, setDeletingProvaId] = useState<string | null>(null);

  // Drill-down Disciplinas & Tópicos states
  const [expandedDisciplinas, setExpandedDisciplinas] = useState<Record<string, boolean>>({});
  const [isAddDisciplinaModalOpen, setIsAddDisciplinaModalOpen] = useState(false);
  const [editingDisciplina, setEditingDisciplina] = useState<Disciplina | null>(null);
  const [deletingDisciplinaId, setDeletingDisciplinaId] = useState<string | null>(null);
  const [newDiscName, setNewDiscName] = useState('');
  const [newDiscWeight, setNewDiscWeight] = useState('2.0');
  const [newDiscColor, setNewDiscColor] = useState('#10b981');
  const [newTopicInputs, setNewTopicInputs] = useState<Record<string, string>>({});
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicName, setEditingTopicName] = useState('');

  // Form Edit Concurso state
  const [title, setTitle] = useState('');
  const [organ, setOrgan] = useState('');
  const [banca, setBanca] = useState('');
  const [role, setRole] = useState('');
  const [sphere, setSphere] = useState<ConcursoSphere>('federal');
  const [remuneration, setRemuneration] = useState('');
  const [vacantPositions, setVacantPositions] = useState('1');
  const [examDate, setExamDate] = useState('');
  const [status, setStatus] = useState<ConcursoStatus>('previsto');

  // Form Prova state
  const [provaConcursoId, setProvaConcursoId] = useState('');
  const [provaOrgan, setProvaOrgan] = useState('');
  const [provaBanca, setProvaBanca] = useState('');
  const [provaRole, setProvaRole] = useState('');
  const [provaYear, setProvaYear] = useState(new Date().getFullYear().toString());
  const [provaQuestionsCount, setProvaQuestionsCount] = useState('100');
  const [provaDurationMinutes, setProvaDurationMinutes] = useState('240');

  // Loading & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const isLimitReached = concursos.length >= MAX_CONCURSOS;

  // Selected Concurso
  const selectedConcurso = useMemo(() => {
    if (!selectedConcursoId) return null;
    return concursos.find(c => c.id === selectedConcursoId) || null;
  }, [concursos, selectedConcursoId]);

  // Disciplinas for Selected Concurso
  const selectedConcursoDisciplinas = useMemo(() => {
    if (!selectedConcurso) return [];
    return disciplinas.filter(d => d.concursoId === selectedConcurso.id);
  }, [disciplinas, selectedConcurso]);

  // Assuntos for Selected Concurso
  const selectedConcursoAssuntos = useMemo(() => {
    if (!selectedConcursoDisciplinas.length) return [];
    const discIds = new Set(selectedConcursoDisciplinas.map(d => d.id));
    return assuntos.filter(a => discIds.has(a.disciplinaId));
  }, [assuntos, selectedConcursoDisciplinas]);

  // Overall Contest Progress
  const contestMetrics = useMemo(() => {
    if (!selectedConcurso) return { progressPercent: 0, totalTopicos: 0, dominadosCount: 0, totalMinutes: 0 };
    const totalTopicos = selectedConcursoAssuntos.length;
    const dominadosCount = selectedConcursoAssuntos.filter(
      a => a.completed || a.status === 'dominado' || a.status === 'revisado'
    ).length;
    const progressPercent = totalTopicos > 0 ? Math.round((dominadosCount / totalTopicos) * 100) : 0;
    const totalMinutes = selectedConcursoDisciplinas.reduce((acc, d) => acc + (d.totalStudyMinutes || 0), 0);
    return { progressPercent, totalTopicos, dominadosCount, totalMinutes };
  }, [selectedConcurso, selectedConcursoDisciplinas, selectedConcursoAssuntos]);

  // Handle Edit Concurso
  const handleOpenEditConcurso = (c: Concurso) => {
    setEditingConcurso(c);
    const resolvedTitle = c.titulo || (c.title && c.title.length > 1 ? c.title : '') || c.orgao || c.organ || c.title;
    const resolvedOrgan = c.orgao || c.organ || c.nome || '';
    setTitle(resolvedTitle);
    setOrgan(resolvedOrgan);
    setBanca(c.banca);
    setRole(c.role);
    setSphere(c.sphere);
    setRemuneration(c.remuneration ? c.remuneration.toString() : '');
    setVacantPositions(c.vacantPositions.toString());
    setExamDate(c.examDate ? c.examDate.split('T')[0] : '');
    setStatus(c.status);
  };

  const handleSaveEditConcurso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConcurso) return;
    setIsSubmitting(true);
    try {
      const cleanOrgan = organ.trim();
      const cleanRole = role.trim();
      const cleanTitle = title.trim() || (cleanRole ? `${cleanOrgan} - ${cleanRole}` : cleanOrgan);
      await onUpdateConcurso(editingConcurso.id, {
        title: cleanTitle,
        titulo: cleanTitle,
        organ: cleanOrgan,
        orgao: cleanOrgan,
        nome: cleanOrgan,
        banca: banca.trim(),
        role: cleanRole,
        sphere,
        remuneration: parseFloat(remuneration) || 0,
        vacantPositions: parseInt(vacantPositions, 10) || 1,
        examDate: examDate || undefined,
        status,
      });
      setEditingConcurso(null);
      showFeedback('success', 'Concurso atualizado com sucesso!');
    } catch {
      showFeedback('error', 'Falha ao atualizar dados do concurso.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveNewConcursoWithDisciplinas = async (
    concursoData: Omit<Concurso, 'id' | 'createdAt' | 'updatedAt'>,
    disciplinasData: ExtractedDiscipline[]
  ) => {
    if (onAddConcursoWithDisciplinas) {
      await onAddConcursoWithDisciplinas(concursoData, disciplinasData);
    } else {
      await onAddConcurso(concursoData);
    }
    showFeedback('success', `Concurso "${concursoData.title}" e ${disciplinasData.length} disciplinas cadastrados com sucesso!`);
  };

  const handleConfirmDeleteConcurso = async () => {
    if (!deletingConcursoId) return;
    setIsSubmitting(true);
    try {
      await onDeleteConcurso(deletingConcursoId);
      if (selectedConcursoId === deletingConcursoId) {
        setSelectedConcursoId(null);
      }
      setDeletingConcursoId(null);
      showFeedback('success', 'Concurso removido com sucesso.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivate = async (concursoId: string, concursoTitle: string) => {
    try {
      await onSetActiveConcurso(concursoId);
      showFeedback('success', `"${concursoTitle}" agora é o seu concurso ativo principal!`);
    } catch {
      showFeedback('error', 'Falha ao ativar concurso.');
    }
  };

  // Toggle Accordion
  const toggleDisciplinaExpanded = (discId: string) => {
    setExpandedDisciplinas(prev => ({
      ...prev,
      [discId]: !prev[discId]
    }));
  };

  // Handle Add Disciplina
  const handleSaveDisciplina = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConcurso || !newDiscName.trim()) return;
    setIsSubmitting(true);
    try {
      if (editingDisciplina && onUpdateDisciplina) {
        await onUpdateDisciplina(editingDisciplina.id, {
          name: newDiscName.trim(),
          weight: parseFloat(newDiscWeight) || 2.0,
          color: newDiscColor,
        });
        showFeedback('success', `Disciplina "${newDiscName.trim()}" atualizada!`);
        setEditingDisciplina(null);
      } else if (onAddDisciplina) {
        await onAddDisciplina({
          concursoId: selectedConcurso.id,
          name: newDiscName.trim(),
          weight: parseFloat(newDiscWeight) || 2.0,
          color: newDiscColor,
          order: selectedConcursoDisciplinas.length + 1,
        });
        showFeedback('success', `Disciplina "${newDiscName.trim()}" adicionada ao concurso!`);
      }
      setIsAddDisciplinaModalOpen(false);
      setNewDiscName('');
      setNewDiscWeight('2.0');
    } catch {
      showFeedback('error', 'Erro ao salvar disciplina.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteDisciplina = async () => {
    if (!deletingDisciplinaId || !onDeleteDisciplina) return;
    setIsSubmitting(true);
    try {
      await onDeleteDisciplina(deletingDisciplinaId);
      setDeletingDisciplinaId(null);
      showFeedback('success', 'Disciplina removida com sucesso!');
    } catch {
      showFeedback('error', 'Erro ao remover disciplina.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add Topic
  const handleAddTopicToDisciplina = async (disciplinaId: string) => {
    const text = (newTopicInputs[disciplinaId] || '').trim();
    if (!text || !onAddAssunto) return;

    try {
      const currentTopics = assuntos.filter(a => a.disciplinaId === disciplinaId);
      await onAddAssunto({
        disciplinaId,
        name: text,
        order: currentTopics.length + 1,
        importance: 'media',
        completed: false,
        status: 'nao_iniciado',
      });
      setNewTopicInputs(prev => ({ ...prev, [disciplinaId]: '' }));
      showFeedback('success', `Tópico "${text}" adicionado com sucesso!`);
    } catch {
      showFeedback('error', 'Erro ao adicionar tópico.');
    }
  };

  // Handle Inline Topic Edit
  const handleStartEditTopic = (topico: Assunto) => {
    setEditingTopicId(topico.id);
    setEditingTopicName(topico.name);
  };

  const handleSaveEditTopic = async (topicoId: string) => {
    const clean = editingTopicName.trim();
    if (!clean || !onUpdateAssunto) {
      setEditingTopicId(null);
      return;
    }
    try {
      await onUpdateAssunto(topicoId, { name: clean });
      setEditingTopicId(null);
      showFeedback('success', 'Tópico atualizado!');
    } catch {
      showFeedback('error', 'Erro ao atualizar tópico.');
    }
  };

  // Handle Topic Delete (Directly without window.confirm)
  const handleDeleteTopic = async (topicoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDeleteAssunto) return;
    try {
      await onDeleteAssunto(topicoId);
      showFeedback('success', 'Tópico removido com sucesso.');
    } catch {
      showFeedback('error', 'Erro ao remover tópico.');
    }
  };

  // Handle Topic Status Toggle
  const handleToggleTopicStatus = async (topico: Assunto, e: React.MouseEvent) => {
    e.stopPropagation();
    const cycle: Record<TopicStatus, TopicStatus> = {
      nao_iniciado: 'em_estudo',
      em_estudo: 'dominado',
      dominado: 'nao_iniciado',
      revisado: 'dominado'
    };
    const current = topico.status || (topico.completed ? 'dominado' : 'nao_iniciado');
    const nextStatus = cycle[current] || 'em_estudo';
    const isCompleted = nextStatus === 'dominado';

    try {
      if (onUpdateAssuntoStatus) {
        await onUpdateAssuntoStatus(topico.id, nextStatus);
      } else if (onUpdateAssunto) {
        await onUpdateAssunto(topico.id, { status: nextStatus, completed: isCompleted });
      }
    } catch {
      showFeedback('error', 'Erro ao alterar status do tópico.');
    }
  };

  // Handle Prova
  const handleSaveProva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provaOrgan.trim() || !provaBanca.trim() || !provaRole.trim()) {
      showFeedback('error', 'Preencha os campos obrigatórios da prova.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onAddProva({
        concursoId: provaConcursoId || undefined,
        organ: provaOrgan.trim(),
        banca: provaBanca.trim(),
        year: parseInt(provaYear, 10) || new Date().getFullYear(),
        role: provaRole.trim(),
        questionsCount: parseInt(provaQuestionsCount, 10) || 100,
        durationMinutes: parseInt(provaDurationMinutes, 10) || 240,
      });
      setIsAddProvaModalOpen(false);
      setProvaOrgan('');
      setProvaRole('');
      showFeedback('success', 'Prova anterior cadastrada com sucesso!');
    } catch {
      showFeedback('error', 'Falha ao cadastrar prova.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (st: ConcursoStatus) => {
    const map: Record<ConcursoStatus, { label: string; variant: any }> = {
      previsto: { label: 'Previsto', variant: 'slate' },
      autorizado: { label: 'Autorizado', variant: 'sky' },
      comissao_formada: { label: 'Comissão', variant: 'amber' },
      escolha_banca: { label: 'Banca', variant: 'purple' },
      edital_publicado: { label: 'Edital', variant: 'emerald' },
      inscricoes_abertas: { label: 'Inscrições Abertas', variant: 'emerald' },
      encerrado: { label: 'Encerrado', variant: 'slate' },
    };
    const item = map[st] || { label: st, variant: 'slate' };
    return <Badge variant={item.variant} size="sm">{item.label}</Badge>;
  };

  const filteredConcursos = concursos.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.organ.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.banca.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSphere = sphereFilter === 'todas' || c.sphere === sphereFilter;
    return matchesSearch && matchesSphere;
  });

  const filteredProvas = provas.filter(p => {
    return p.organ.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.banca.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.role.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // =========================================================================
  // VIEW: DRILL-DOWN / PAINEL DO CONCURSO (ESTILO ESTUDEI)
  // =========================================================================
  if (selectedConcurso) {
    const isSelectedActive = selectedConcurso.active || user.targetConcursoId === selectedConcurso.id;
    const diffDays = selectedConcurso.examDate 
      ? Math.ceil((new Date(selectedConcurso.examDate).getTime() - new Date().getTime()) / 86400000)
      : null;

    const fullTitle = selectedConcurso.orgao || selectedConcurso.nome || selectedConcurso.titulo || 
      (selectedConcurso.organ && selectedConcurso.title && selectedConcurso.title.length === 1 ? selectedConcurso.organ : selectedConcurso.title) || 
      selectedConcurso.organ;

    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
        {feedback && (
          <div className={`p-4 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-2 ${
            feedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Top Header / Breadcrumb */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <button
            onClick={() => setSelectedConcursoId(null)}
            className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-400 hover:text-white transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Voltar para Concursos</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            {!isSelectedActive ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleActivate(selectedConcurso.id, fullTitle)}
                leftIcon={<Star className="w-3.5 h-3.5 text-amber-400" />}
              >
                Definir como Ativo
              </Button>
            ) : (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> Foco Ativo
              </span>
            )}

            {onNavigateTab && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleActivate(selectedConcurso.id, fullTitle);
                  onNavigateTab('estudos');
                }}
                leftIcon={<BookOpen className="w-3.5 h-3.5 text-emerald-400" />}
              >
                Edital Verticalizado
              </Button>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingDisciplina(null);
                setNewDiscName('');
                setNewDiscWeight('2.0');
                setNewDiscColor('#10b981');
                setIsAddDisciplinaModalOpen(true);
              }}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="shadow-md shadow-emerald-500/20"
            >
              Nova Matéria
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenEditConcurso(selectedConcurso)}
              leftIcon={<Edit2 className="w-3.5 h-3.5" />}
            >
              Editar
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeletingConcursoId(selectedConcurso.id)}
              className="text-rose-500 hover:bg-rose-500/10"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Excluir
            </Button>
          </div>
        </div>

        {/* Contest Banner Card */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                {getStatusBadge(selectedConcurso.status)}
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                  {selectedConcurso.sphere}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  Banca: <strong className="text-slate-200">{selectedConcurso.banca}</strong>
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {fullTitle}
              </h1>
              <p className="text-sm font-semibold text-emerald-500 dark:text-emerald-400">
                Cargo: {selectedConcurso.role}
              </p>
            </div>

            {/* Exam Countdown & Summary */}
            <div className="flex items-center gap-4 bg-slate-100/70 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 w-full lg:w-auto justify-around lg:justify-start">
              <div className="text-center px-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Data da Prova</span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {selectedConcurso.examDate ? new Date(selectedConcurso.examDate).toLocaleDateString('pt-BR') : 'A definir'}
                </span>
              </div>
              <div className="h-8 w-px bg-slate-300 dark:bg-slate-700" />
              <div className="text-center px-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Tempo Restante</span>
                <span className={`text-base font-black ${diffDays !== null && diffDays <= 30 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {diffDays !== null ? (diffDays >= 0 ? `${diffDays} dias` : 'Realizada') : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics (Estilo Estudei) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-slate-100 dark:border-slate-800/80">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Progresso Geral</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-black text-emerald-500">{contestMetrics.progressPercent}%</span>
                <span className="text-xs text-slate-400 font-semibold">concluído</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${contestMetrics.progressPercent}%` }} 
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Disciplinas</span>
              <span className="text-xl font-black text-slate-900 dark:text-slate-100 block mt-1">
                {selectedConcursoDisciplinas.length}
              </span>
              <span className="text-[11px] text-slate-400">matérias cadastradas</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Tópicos do Edital</span>
              <span className="text-xl font-black text-slate-900 dark:text-slate-100 block mt-1">
                {contestMetrics.dominadosCount} <span className="text-xs font-normal text-slate-400">/ {contestMetrics.totalTopicos}</span>
              </span>
              <span className="text-[11px] text-slate-400">tópicos dominados</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Tempo Dedicado</span>
              <span className="text-xl font-black text-slate-900 dark:text-slate-100 block mt-1">
                {Math.floor(contestMetrics.totalMinutes / 60)}h {contestMetrics.totalMinutes % 60}m
              </span>
              <span className="text-[11px] text-slate-400">estudo acumulado</span>
            </div>
          </div>
        </div>

        {/* Disciplinas Panel Section (Estilo Estudei) */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-500" />
                Painel de Disciplinas ({selectedConcursoDisciplinas.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Acompanhe o domínio por matéria, inicie sessões de estudo e gerencie tópicos diretamente.
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingDisciplina(null);
                setNewDiscName('');
                setNewDiscWeight('2.0');
                setNewDiscColor('#10b981');
                setIsAddDisciplinaModalOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Adicionar Matéria
            </Button>
          </div>

          {selectedConcursoDisciplinas.length === 0 ? (
            <div className="p-8 sm:p-12 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center space-y-4 bg-white/50 dark:bg-slate-900/40">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <FolderPlus className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  Nenhuma disciplina cadastrada neste concurso
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cadastre as matérias do edital ou importe tópicos para começar a estudar.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => {
                  setEditingDisciplina(null);
                  setNewDiscName('');
                  setNewDiscWeight('2.0');
                  setNewDiscColor('#10b981');
                  setIsAddDisciplinaModalOpen(true);
                }}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Cadastrar Primeira Matéria
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedConcursoDisciplinas.map(disc => {
                const discTopics = assuntos.filter(a => a.disciplinaId === disc.id);
                const dominados = discTopics.filter(a => a.completed || a.status === 'dominado' || a.status === 'revisado').length;
                const percent = discTopics.length > 0 ? Math.round((dominados / discTopics.length) * 100) : 0;
                const isExpanded = !!expandedDisciplinas[disc.id];

                return (
                  <div 
                    key={disc.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 overflow-hidden shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                  >
                    {/* Header do Card da Matéria */}
                    <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span 
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" 
                            style={{ backgroundColor: disc.color || '#10b981' }} 
                          />
                          <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                              {disc.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] font-semibold text-slate-400">
                                Peso {disc.weight || 1}
                              </span>
                              <span className="text-slate-600 dark:text-slate-700">•</span>
                              <span className="text-[11px] font-semibold text-slate-400">
                                {disc.totalStudyMinutes ? `${Math.floor(disc.totalStudyMinutes / 60)}h ${disc.totalStudyMinutes % 60}m` : '0h estudadas'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingDisciplina(disc);
                              setNewDiscName(disc.name);
                              setNewDiscWeight(disc.weight.toString());
                              setNewDiscColor(disc.color || '#10b981');
                              setIsAddDisciplinaModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Editar Matéria"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingDisciplinaId(disc.id)}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Excluir Matéria"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Progresso da Disciplina */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-400">
                            {dominados} de {discTopics.length} tópicos dominados
                          </span>
                          <span className="text-emerald-500 font-bold">{percent}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-300"
                            style={{ 
                              width: `${percent}%`,
                              backgroundColor: disc.color || '#10b981'
                            }}
                          />
                        </div>
                      </div>

                      {/* Ações da Disciplina */}
                      <div className="flex items-center justify-between pt-1 gap-2">
                        {onOpenStudyTimer && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onOpenStudyTimer(disc.id)}
                            leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
                            className="text-xs font-bold"
                          >
                            Estudar Agora
                          </Button>
                        )}

                        <button
                          onClick={() => toggleDisciplinaExpanded(disc.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800/80 transition-colors ml-auto cursor-pointer"
                        >
                          <span>{isExpanded ? 'Recolher Tópicos' : `Ver Tópicos (${discTopics.length})`}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Gaveta Expandida de Tópicos */}
                    {isExpanded && (
                      <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 space-y-3 border-t border-slate-100 dark:border-slate-800">
                        {discTopics.length === 0 ? (
                          <p className="text-xs text-slate-500 text-center py-2">
                            Nenhum tópico cadastrado nesta matéria.
                          </p>
                        ) : (
                          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                            {discTopics.map(topic => {
                              const isCompleted = topic.completed || topic.status === 'dominado';
                              const isEmEstudo = topic.status === 'em_estudo';
                              const isEditing = editingTopicId === topic.id;

                              return (
                                <div
                                  key={topic.id}
                                  className="group flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200/60 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 text-xs transition-colors"
                                >
                                  {/* Status Circle */}
                                  <button
                                    onClick={(e) => handleToggleTopicStatus(topic, e)}
                                    className="shrink-0 cursor-pointer p-0.5 rounded-md hover:bg-slate-800"
                                    title="Alternar Status (Não Iniciado -> Em Estudo -> Dominado)"
                                  >
                                    {isCompleted ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-500/10" />
                                    ) : isEmEstudo ? (
                                      <Circle className="w-4 h-4 text-sky-400 fill-sky-400/20" />
                                    ) : (
                                      <Circle className="w-4 h-4 text-slate-500 hover:text-slate-300" />
                                    )}
                                  </button>

                                  {/* Topic Name / Inline Edit */}
                                  <div className="flex-1 min-w-0">
                                    {isEditing ? (
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="text"
                                          value={editingTopicName}
                                          onChange={(e) => setEditingTopicName(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveEditTopic(topic.id);
                                            if (e.key === 'Escape') setEditingTopicId(null);
                                          }}
                                          autoFocus
                                          className="w-full bg-slate-800 text-slate-100 px-2 py-1 rounded text-xs border border-emerald-500 focus:outline-hidden"
                                        />
                                        <button
                                          onClick={() => handleSaveEditTopic(topic.id)}
                                          className="p-1 text-emerald-400 hover:bg-slate-800 rounded"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => setEditingTopicId(null)}
                                          className="p-1 text-slate-400 hover:bg-slate-800 rounded"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ) : (
                                      <span className={`font-medium truncate block ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200'}`}>
                                        {topic.name}
                                      </span>
                                    )}
                                  </div>

                                  {/* Actions on Topic */}
                                  {!isEditing && (
                                    <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                                      {onOpenStudyTimer && (
                                        <button
                                          onClick={() => onOpenStudyTimer(disc.id, topic.id)}
                                          className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                                          title="Estudar Tópico"
                                        >
                                          <Play className="w-3 h-3" />
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleStartEditTopic(topic)}
                                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                        title="Editar Tópico"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={(e) => handleDeleteTopic(topic.id, e)}
                                        className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                        title="Excluir Tópico"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Quick Add Topic Input */}
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            placeholder="Adicionar novo tópico nesta matéria..."
                            value={newTopicInputs[disc.id] || ''}
                            onChange={(e) => setNewTopicInputs(prev => ({ ...prev, [disc.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddTopicToDisciplina(disc.id);
                            }}
                            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 px-3 py-1.5 rounded-xl text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddTopicToDisciplina(disc.id)}
                            leftIcon={<Plus className="w-3 h-3" />}
                            className="text-xs py-1.5 px-3 shrink-0"
                          >
                            Adicionar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal: Adicionar / Editar Matéria */}
        <Modal
          isOpen={isAddDisciplinaModalOpen}
          onClose={() => {
            setIsAddDisciplinaModalOpen(false);
            setEditingDisciplina(null);
          }}
          title={editingDisciplina ? 'Editar Matéria' : 'Nova Matéria do Concurso'}
          maxWidth="md"
        >
          <form onSubmit={handleSaveDisciplina} className="space-y-4 text-xs">
            <Input
              label="Nome da Disciplina *"
              placeholder="Ex: Direito Administrativo"
              value={newDiscName}
              onChange={(e) => setNewDiscName(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Peso da Disciplina"
                type="number"
                step="0.5"
                min="0.5"
                max="10"
                value={newDiscWeight}
                onChange={(e) => setNewDiscWeight(e.target.value)}
                required
              />
              <div>
                <label className="block text-slate-400 font-semibold mb-1.5">Cor de Identificação</label>
                <div className="flex items-center gap-1.5">
                  {PALETTE_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewDiscColor(c)}
                      className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${newDiscColor === c ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setIsAddDisciplinaModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" isLoading={isSubmitting}>
                {editingDisciplina ? 'Salvar Alterações' : 'Adicionar Matéria'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Confirmar Exclusão de Matéria */}
        <Modal
          isOpen={deletingDisciplinaId !== null}
          onClose={() => setDeletingDisciplinaId(null)}
          title="Excluir Matéria"
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600 dark:text-slate-300">
              Tem certeza de que deseja remover esta disciplina? Todos os tópicos vinculados a ela serão excluídos.
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setDeletingDisciplinaId(null)}>Cancelar</Button>
              <Button type="button" variant="danger" onClick={handleConfirmDeleteDisciplina} isLoading={isSubmitting}>
                Confirmar Exclusão
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal: Editar Concurso Existente */}
        <Modal
          isOpen={editingConcurso !== null}
          onClose={() => setEditingConcurso(null)}
          title="Editar Dados do Concurso"
          maxWidth="lg"
        >
          <form onSubmit={handleSaveEditConcurso} className="space-y-4 text-xs">
            <Input
              label="Título do Concurso *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Órgão *" value={organ} onChange={(e) => setOrgan(e.target.value)} required />
              <Input label="Banca *" value={banca} onChange={(e) => setBanca(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Cargo *" value={role} onChange={(e) => setRole(e.target.value)} required />
              <Input label="Remuneração (R$)" type="number" value={remuneration} onChange={(e) => setRemuneration(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Data da Prova" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
              <Input label="Vagas" type="number" value={vacantPositions} onChange={(e) => setVacantPositions(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setEditingConcurso(null)}>Cancelar</Button>
              <Button type="submit" variant="primary" isLoading={isSubmitting}>Salvar Alterações</Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Confirmar Exclusão de Concurso */}
        <Modal
          isOpen={deletingConcursoId !== null}
          onClose={() => setDeletingConcursoId(null)}
          title="Excluir Concurso"
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600 dark:text-slate-300">
              Tem certeza de que deseja remover este concurso? As matérias, tópicos e provas associadas a ele também serão excluídos.
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setDeletingConcursoId(null)}>Cancelar</Button>
              <Button type="button" variant="danger" onClick={handleConfirmDeleteConcurso} isLoading={isSubmitting}>
                Confirmar Exclusão
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // =========================================================================
  // VIEW: HUB DE CONCURSOS (MEUS CONCURSOS COM TRAVA DE 3 PLANOS)
  // =========================================================================
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {feedback && (
        <div className={`p-4 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-2 ${
          feedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-emerald-500" />
            Concursos & Provas
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Hub de concursos foco (máx. 3), painel de matérias e gerenciamento de provas anteriores.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('concursos')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'concursos' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
            }`}
          >
            Concursos ({concursos.length}/{MAX_CONCURSOS})
          </button>
          <button
            onClick={() => setActiveTab('provas')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'provas' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
            }`}
          >
            Provas ({provas.length})
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Buscar por cargo, órgão ou banca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        {activeTab === 'concursos' ? (
          <div className="flex items-center gap-2">
            {isLimitReached && (
              <span className="text-[11px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Limite de 3 concursos atingido
              </span>
            )}
            <Button
              variant={isLimitReached ? 'outline' : 'primary'}
              disabled={isLimitReached}
              onClick={() => {
                if (!isLimitReached) setIsNovoConcursoWizardOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
              className={!isLimitReached ? 'shadow-md shadow-emerald-500/20' : 'opacity-60 cursor-not-allowed'}
            >
              Novo Concurso
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            onClick={() => setIsAddProvaModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            className="shadow-md shadow-emerald-500/20"
          >
            Nova Prova
          </Button>
        )}
      </div>

      {/* Tab: Concursos (Hub de Cards) */}
      {activeTab === 'concursos' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Cards dos Concursos Cadastrados */}
            {filteredConcursos.map(concurso => {
              const isActive = concurso.active || user.targetConcursoId === concurso.id;
              const diffDays = concurso.examDate 
                ? Math.ceil((new Date(concurso.examDate).getTime() - new Date().getTime()) / 86400000)
                : null;

              // Contagem de disciplinas e tópicos vinculados
              const discCount = disciplinas.filter(d => d.concursoId === concurso.id).length;
              const discIds = new Set(disciplinas.filter(d => d.concursoId === concurso.id).map(d => d.id));
              const topicosCount = assuntos.filter(a => discIds.has(a.disciplinaId)).length;

              const fullTitle = concurso.orgao || concurso.nome || concurso.titulo || 
                (concurso.organ && concurso.title && concurso.title.length === 1 ? concurso.organ : concurso.title) || 
                concurso.organ;

              return (
                <Card 
                  key={concurso.id} 
                  hoverEffect 
                  className={`relative overflow-hidden flex flex-col justify-between transition-all ${
                    isActive ? 'ring-2 ring-emerald-500 border-emerald-500 shadow-emerald-500/10' : ''
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-bl-lg flex items-center gap-1 shadow-xs">
                      <Star className="w-3 h-3 fill-current" /> Ativo
                    </div>
                  )}

                  <CardBody className="p-5 space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(concurso.status)}
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          {concurso.sphere}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                        {fullTitle}
                      </h3>
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        Cargo: {concurso.role}
                      </p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Matérias</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {discCount} disciplinas
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Tópicos</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {topicosCount} tópicos
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Dias Prova</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {diffDays !== null ? (diffDays >= 0 ? `${diffDays} dias` : 'Realizada') : '-'}
                        </span>
                      </div>
                    </div>
                  </CardBody>

                  <CardFooter className="flex flex-col gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                    <Button 
                      variant="primary" 
                      size="sm" 
                      onClick={() => setSelectedConcursoId(concurso.id)}
                      className="w-full justify-center font-bold text-xs"
                      rightIcon={<ChevronRight className="w-4 h-4" />}
                    >
                      Abrir Painel do Concurso
                    </Button>

                    <div className="flex items-center justify-between w-full pt-1">
                      {!isActive ? (
                        <button
                          onClick={() => handleActivate(concurso.id, fullTitle)}
                          className="text-xs font-semibold text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Star className="w-3.5 h-3.5" /> Definir Ativo
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Foco Ativo
                        </span>
                      )}

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditConcurso(concurso)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Editar Concurso"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingConcursoId(concurso.id)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Excluir Concurso"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </CardFooter>
                </Card>
              );
            })}

            {/* Card de Ação Rápida: Cadastrar Novo Concurso com Trava de 3 Concursos */}
            {!isLimitReached ? (
              <div
                onClick={() => setIsNovoConcursoWizardOpen(true)}
                className="group relative rounded-2xl border-2 border-dashed border-emerald-500/30 hover:border-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[220px]"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 flex items-center justify-center mb-3 transition-transform shadow-inner">
                  <Plus className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-400 transition-colors">
                  + Cadastrar Novo Concurso
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                  Importe disciplinas e tópicos do edital via Inteligência Artificial.
                </p>
                <span className="mt-3 text-[11px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                  {concursos.length} de {MAX_CONCURSOS} cadastrados
                </span>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-900/30 p-6 flex flex-col items-center justify-center text-center min-h-[220px] opacity-75">
                <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-3">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
                  Limite de 3 Concursos Atingido
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                  Você já atingiu a cota máxima de 3 concursos cadastrados. Para adicionar um novo certame, exclua um concurso existente.
                </p>
                <span className="mt-3 text-[11px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                  3/3 Planos Utilizados
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Provas Anteriores */}
      {activeTab === 'provas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredProvas.length === 0 ? (
            <div className="col-span-2 p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-500">
              Nenhuma prova anterior cadastrada. Clique em "Nova Prova" para registrar.
            </div>
          ) : (
            filteredProvas.map(prova => (
              <Card key={prova.id} hoverEffect>
                <CardHeader title={`${prova.organ} (${prova.year})`} subtitle={`Cargo: ${prova.role}`} />
                <CardBody className="p-5">
                  <p className="text-xs text-slate-500">
                    {prova.questionsCount} questões • {prova.durationMinutes} min • Banca: {prova.banca}
                  </p>
                </CardBody>
                <CardFooter className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setDeletingProvaId(prova.id)} className="text-rose-500">
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Wizard Modal: Novo Concurso + Extração IA */}
      <NovoConcursoModal
        isOpen={isNovoConcursoWizardOpen}
        onClose={() => setIsNovoConcursoWizardOpen(false)}
        onSaveConcursoWithDisciplinas={handleSaveNewConcursoWithDisciplinas}
      />

      {/* Modal: Editar Concurso Existente */}
      <Modal
        isOpen={editingConcurso !== null}
        onClose={() => setEditingConcurso(null)}
        title="Editar Dados do Concurso"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveEditConcurso} className="space-y-4 text-xs">
          <Input
            label="Título do Concurso *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Órgão *" value={organ} onChange={(e) => setOrgan(e.target.value)} required />
            <Input label="Banca *" value={banca} onChange={(e) => setBanca(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Cargo *" value={role} onChange={(e) => setRole(e.target.value)} required />
            <Input label="Remuneração (R$)" type="number" value={remuneration} onChange={(e) => setRemuneration(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data da Prova" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
            <Input label="Vagas" type="number" value={vacantPositions} onChange={(e) => setVacantPositions(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setEditingConcurso(null)}>Cancelar</Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>Salvar Alterações</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Nova Prova Anterior */}
      <Modal
        isOpen={isAddProvaModalOpen}
        onClose={() => setIsAddProvaModalOpen(false)}
        title="Cadastrar Prova Anterior"
        maxWidth="md"
      >
        <form onSubmit={handleSaveProva} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Órgão *" placeholder="Ex: TJ-SP" value={provaOrgan} onChange={(e) => setProvaOrgan(e.target.value)} required />
            <Input label="Banca *" placeholder="Ex: Vunesp" value={provaBanca} onChange={(e) => setProvaBanca(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Cargo *" placeholder="Ex: Escrevente" value={provaRole} onChange={(e) => setProvaRole(e.target.value)} required />
            <Input label="Ano" type="number" value={provaYear} onChange={(e) => setProvaYear(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Qtd. Questões" type="number" value={provaQuestionsCount} onChange={(e) => setProvaQuestionsCount(e.target.value)} />
            <Input label="Duração (min)" type="number" value={provaDurationMinutes} onChange={(e) => setProvaDurationMinutes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsAddProvaModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>Salvar Prova</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Confirmação de Exclusão de Concurso */}
      <Modal
        isOpen={deletingConcursoId !== null}
        onClose={() => setDeletingConcursoId(null)}
        title="Excluir Concurso"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Tem certeza de que deseja remover este concurso? As matérias, tópicos e provas associadas a ele também serão excluídos.
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setDeletingConcursoId(null)}>Cancelar</Button>
            <Button type="button" variant="danger" onClick={handleConfirmDeleteConcurso} isLoading={isSubmitting}>
              Confirmar Exclusão
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Confirmação de Exclusão de Prova */}
      <Modal
        isOpen={deletingProvaId !== null}
        onClose={() => setDeletingProvaId(null)}
        title="Excluir Prova Anterior"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Tem certeza de que deseja remover esta prova anterior?
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setDeletingProvaId(null)}>Cancelar</Button>
            <Button 
              type="button" 
              variant="danger" 
              onClick={async () => {
                if (deletingProvaId) {
                  await onDeleteProva(deletingProvaId);
                  setDeletingProvaId(null);
                  showFeedback('success', 'Prova anterior removida.');
                }
              }}
            >
              Confirmar Exclusão
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
