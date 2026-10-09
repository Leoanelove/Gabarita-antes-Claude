import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  BookOpen, 
  CheckCircle2, 
  Circle, 
  Copy, 
  Edit2, 
  Trash2, 
  Sparkles, 
  Filter, 
  ListTree,
  ChevronDown,
  Check,
  Target,
  HelpCircle,
  Layers,
  ChevronRight,
  TrendingUp,
  FolderOpen,
  Folder,
  Crown,
  ExternalLink,
  Link2
} from 'lucide-react';
import { 
  Concurso, 
  Disciplina, 
  Assunto, 
  Subtopico, 
  TopicStatus, 
  TopicDifficulty, 
  AssuntoImportance, 
  EditalAiImportPayload 
} from '../../types';
import { Card, CardHeader, CardBody } from '../../design-system/Card';
import { Button } from '../../design-system/Button';
import { Badge } from '../../design-system/Badge';
import { Input } from '../../design-system/Input';
import { Modal } from '../../design-system/Modal';
import { EditalImportModal } from './EditalImportModal';
import { EmptyContestState } from '../common/EmptyContestState';

interface DisciplinasViewProps {
  concursos: Concurso[];
  disciplinas: Disciplina[];
  assuntos: Assunto[];
  activeConcursoId?: string;
  onSetActiveConcurso?: (id: string) => Promise<void>;
  onNavigateTab?: (tab: any) => void;
  onAddDisciplina: (disciplina: Omit<Disciplina, 'id' | 'createdAt' | 'topicsCount' | 'completedTopicsCount' | 'totalStudyMinutes'>) => Promise<void>;
  onUpdateDisciplina: (id: string, partial: Partial<Disciplina>) => Promise<void>;
  onDeleteDisciplina: (id: string) => Promise<void>;
  onDuplicateDisciplina: (id: string) => Promise<void>;
  onAddAssunto: (assunto: Omit<Assunto, 'id' | 'createdAt' | 'masteryLevel' | 'totalQuestionsSolved' | 'correctQuestionsSolved' | 'accuracyRate'>) => Promise<void>;
  onUpdateAssunto: (id: string, partial: Partial<Assunto>) => Promise<void>;
  onDeleteAssunto: (id: string) => Promise<void>;
  onDuplicateAssunto: (id: string) => Promise<void>;
  onReorderAssuntos: (orderedIds: string[]) => Promise<void>;
  onUpdateAssuntoStatus: (id: string, status: TopicStatus) => Promise<void>;
  onAddSubtopico: (assuntoId: string, name: string) => Promise<void>;
  onUpdateSubtopico: (assuntoId: string, subId: string, partial: Partial<Subtopico>) => Promise<void>;
  onDeleteSubtopico: (assuntoId: string, subId: string) => Promise<void>;
  onImportEditalTree: (payload: EditalAiImportPayload, concursoId?: string, mode?: 'merge' | 'replace') => Promise<void>;
  onOpenStudyTimer?: (disciplinaId?: string, assuntoId?: string) => void;
}

export const DisciplinasView: React.FC<DisciplinasViewProps> = ({
  concursos,
  disciplinas: propDisciplinas,
  assuntos: propAssuntos,
  activeConcursoId,
  onSetActiveConcurso,
  onAddDisciplina,
  onUpdateDisciplina,
  onDeleteDisciplina,
  onDuplicateDisciplina,
  onAddAssunto,
  onUpdateAssunto,
  onDeleteAssunto,
  onDuplicateAssunto,
  onReorderAssuntos,
  onUpdateAssuntoStatus,
  onAddSubtopico,
  onUpdateSubtopico,
  onDeleteSubtopico,
  onImportEditalTree,
  onOpenStudyTimer: _onOpenStudyTimer,
  onNavigateTab,
}) => {
  // Estado local gerenciado para permitir atualizações instantâneas e otimistas
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>(propDisciplinas);
  const [assuntos, setAssuntos] = useState<Assunto[]>(propAssuntos);

  useEffect(() => {
    setDisciplinas(propDisciplinas);
  }, [propDisciplinas]);

  useEffect(() => {
    setAssuntos(propAssuntos);
  }, [propAssuntos]);

  if (concursos.length === 0) {
    return (
      <EmptyContestState
        title="Você ainda não possui um concurso ativo"
        description="Cadastre seu concurso foco e importe o conteúdo programático do edital para desbloquear a matriz do Edital Verticalizado e monitorar seu domínio tópico a tópico."
        actionText="Cadastrar Concurso Foco"
        onAction={() => onNavigateTab ? onNavigateTab('concursos') : null}
      />
    );
  }

  // 1. ISOLAMENTO TOTAL POR CONCURSO:
  // Sincroniza o concurso selecionado priorizando o concurso ativo
  const initialTargetId = activeConcursoId || concursos.find(c => c.active)?.id || concursos[0]?.id || '';
  const [selectedConcursoId, setSelectedConcursoId] = useState<string>(initialTargetId);

  useEffect(() => {
    if (activeConcursoId && concursos.some(c => c.id === activeConcursoId)) {
      setSelectedConcursoId(activeConcursoId);
    } else if (!selectedConcursoId || !concursos.some(c => c.id === selectedConcursoId)) {
      setSelectedConcursoId(concursos[0]?.id || '');
    }
  }, [activeConcursoId, concursos]);

  const selectedConcurso = useMemo(() => {
    return concursos.find(c => c.id === selectedConcursoId) || 
      concursos.find(c => c.id === activeConcursoId) || 
      concursos[0];
  }, [concursos, selectedConcursoId, activeConcursoId]);

  // FILTRO ESTRITO: As matérias e tópicos exibidos DEVEM pertencer EXCLUSIVAMENTE ao Concurso ativo/selecionado
  const currentConcursoDisciplinas = useMemo(() => {
    const targetId = selectedConcurso?.id;
    if (!targetId) return [];
    return disciplinas.filter(d => d.concursoId === targetId);
  }, [disciplinas, selectedConcurso]);

  const currentConcursoDiscIds = useMemo(() => {
    return new Set(currentConcursoDisciplinas.map(d => d.id));
  }, [currentConcursoDisciplinas]);

  const currentConcursoAssuntos = useMemo(() => {
    return assuntos.filter(a => currentConcursoDiscIds.has(a.disciplinaId));
  }, [assuntos, currentConcursoDiscIds]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'concluidos' | 'pendentes'>('todos');
  
  // Accordion state: record of expanded disciplina IDs
  const [expandedDisciplinas, setExpandedDisciplinas] = useState<Record<string, boolean>>({});
  
  // Feedback alert state
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [isAddDisciplinaOpen, setIsAddDisciplinaOpen] = useState(false);
  const [editingDisciplina, setEditingDisciplina] = useState<Disciplina | null>(null);

  const [isAddAssuntoOpen, setIsAddAssuntoOpen] = useState(false);
  const [editingAssunto, setEditingAssunto] = useState<Assunto | null>(null);
  const [targetDisciplinaIdForAssunto, setTargetDisciplinaIdForAssunto] = useState<string>('');

  useEffect(() => {
    if (currentConcursoDisciplinas.length > 0 && (!targetDisciplinaIdForAssunto || !currentConcursoDiscIds.has(targetDisciplinaIdForAssunto))) {
      setTargetDisciplinaIdForAssunto(currentConcursoDisciplinas[0].id);
    }
  }, [currentConcursoDisciplinas, targetDisciplinaIdForAssunto, currentConcursoDiscIds]);

  const [isAiImportModalOpen, setIsAiImportModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Disciplina form fields
  const [discName, setDiscName] = useState('');
  const [discCode, setDiscCode] = useState('');
  const [discWeight, setDiscWeight] = useState('2.0');
  const [discColor, setDiscColor] = useState('#10b981');

  // Assunto form fields
  const [topicName, setTopicName] = useState('');
  const [topicImportance, setTopicImportance] = useState<AssuntoImportance>('alta');
  const [topicDifficulty, setTopicDifficulty] = useState<TopicDifficulty>('media');
  const [topicStatus, setTopicStatus] = useState<TopicStatus>('nao_iniciado');
  const [topicNotes, setTopicNotes] = useState('');
  const [topicLink, setTopicLink] = useState('');

  // Link Modal state (Atalho para Banco de Questões)
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [targetAssuntoForLink, setTargetAssuntoForLink] = useState<Assunto | null>(null);
  const [linkInputValue, setLinkInputValue] = useState('');

  // Expand the first discipline by default upon loading
  useEffect(() => {
    if (currentConcursoDisciplinas.length > 0 && Object.keys(expandedDisciplinas).length === 0) {
      setExpandedDisciplinas({ [currentConcursoDisciplinas[0].id]: true });
    }
  }, [currentConcursoDisciplinas]);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Overall edital stats calculadas estritamente com dados do concurso selecionado
  const editalStats = useMemo(() => {
    const totalTopics = currentConcursoAssuntos.length;
    const dominados = currentConcursoAssuntos.filter(a => a.completed || a.status === 'dominado' || a.status === 'revisado').length;
    const progressPct = totalTopics > 0 ? Math.round((dominados / totalTopics) * 100) : 0;
    const totalQuestions = currentConcursoAssuntos.reduce((acc, a) => acc + (a.totalQuestionsSolved || 0), 0);
    const correctQuestions = currentConcursoAssuntos.reduce((acc, a) => acc + (a.correctQuestionsSolved || 0), 0);
    const accuracyPct = totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0;

    return {
      totalTopics,
      dominados,
      progressPct,
      totalQuestions,
      accuracyPct,
    };
  }, [currentConcursoAssuntos]);

  // Toggle single accordion
  const toggleDisciplinaAccordion = (id: string) => {
    setExpandedDisciplinas(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Expand all / Collapse all
  const toggleAllDisciplinas = (expand: boolean) => {
    const nextState: Record<string, boolean> = {};
    currentConcursoDisciplinas.forEach(d => {
      nextState[d.id] = expand;
    });
    setExpandedDisciplinas(nextState);
  };

  // Auto-expand accordions when searching
  useEffect(() => {
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      const nextState: Record<string, boolean> = {};
      currentConcursoDisciplinas.forEach(d => {
        const matchesDisc = d.name.toLowerCase().includes(lower);
        const matchesTopic = currentConcursoAssuntos.some(a => a.disciplinaId === d.id && a.name.toLowerCase().includes(lower));
        if (matchesDisc || matchesTopic) {
          nextState[d.id] = true;
        }
      });
      setExpandedDisciplinas(prev => ({ ...prev, ...nextState }));
    }
  }, [searchTerm, currentConcursoDisciplinas, currentConcursoAssuntos]);

  // Lógica dinâmica de gamificação e cores para o Percentual de Acerto
  // Regras obrigatórias:
  // - Acerto <= 50%: Vermelha (indicando estado de alerta/atenção) -> Solid: bg-red-600 text-white
  // - Acerto > 50% e <= 75%: Amarela -> Solid: bg-amber-400 text-slate-950 font-black
  // - Acerto > 75% e <= 90%: Verde Claro -> Solid: bg-emerald-500 text-white
  // - Acerto > 90% e <= 100%: Verde Escuro + Ícone de Coroa (👑) -> Solid: bg-emerald-800 text-white
  const getAccuracyConfig = (rate: number, total: number) => {
    const hasData = (total > 0) || (rate > 0);
    if (!hasData) {
      return {
        rate: 0,
        hasData: false,
        hasCrown: false,
        label: 'Sem dados',
        shortLabel: '—',
        badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/80 font-medium',
        solidBadgeClass: 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold',
        textClass: 'text-slate-500 dark:text-slate-400',
        tier: 'sem_dados' as const,
      };
    }

    const formattedRate = Number.isInteger(rate) ? `${rate}%` : `${Number(rate.toFixed(1))}%`;

    // 1. Acerto <= 50%: Vermelha (indicando estado de alerta/atenção)
    if (rate <= 50) {
      return {
        rate,
        hasData: true,
        hasCrown: false,
        label: formattedRate,
        shortLabel: formattedRate,
        badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-300 dark:border-red-800/80 font-bold',
        solidBadgeClass: 'bg-red-600 text-white font-bold',
        textClass: 'text-red-600 dark:text-red-400',
        tier: 'alerta' as const,
      };
    }
    // 2. Acerto > 50% e <= 75%: Amarela
    if (rate <= 75) {
      return {
        rate,
        hasData: true,
        hasCrown: false,
        label: formattedRate,
        shortLabel: formattedRate,
        badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800/80 font-bold',
        solidBadgeClass: 'bg-amber-400 text-slate-950 font-black',
        textClass: 'text-amber-600 dark:text-amber-400',
        tier: 'medio' as const,
      };
    }
    // 3. Acerto > 75% e <= 90%: Verde Claro (classes absolutas green- para imunidade contra skins de tema)
    if (rate <= 90) {
      return {
        rate,
        hasData: true,
        hasCrown: false,
        label: formattedRate,
        shortLabel: formattedRate,
        badgeClass: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-300 dark:border-green-600/70 font-bold',
        solidBadgeClass: 'bg-green-500 text-white font-bold',
        textClass: 'text-green-600 dark:text-green-400',
        tier: 'bom' as const,
      };
    }
    // 4. Acerto > 90% e <= 100%: Verde Escuro + Coroa (👑)
    return {
      rate,
      hasData: true,
      hasCrown: true,
      label: formattedRate,
      shortLabel: formattedRate,
      badgeClass: 'bg-emerald-900/20 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-600/50 dark:border-emerald-500/50 font-black shadow-xs ring-1 ring-emerald-500/30',
      solidBadgeClass: 'bg-emerald-800 text-white font-black',
      textClass: 'text-emerald-800 dark:text-emerald-300',
      tier: 'excelente' as const,
    };
  };

  // Open link modal
  const handleOpenLinkModal = (assunto: Assunto) => {
    setTargetAssuntoForLink(assunto);
    setLinkInputValue(assunto.link || '');
    setIsLinkModalOpen(true);
  };

  // Save topic link (Atalho para Banco de Questões)
  const handleSaveTopicLink = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!targetAssuntoForLink) return;

    const trimmed = linkInputValue.trim();
    const formatted = trimmed 
      ? (trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`) 
      : '';

    setIsSubmitting(true);
    try {
      await onUpdateAssunto(targetAssuntoForLink.id, {
        link: formatted || undefined
      });
      showFeedback('success', formatted ? `Link salvo para "${targetAssuntoForLink.name}"!` : 'Link removido.');
      setIsLinkModalOpen(false);
      setTargetAssuntoForLink(null);
    } catch (err) {
      console.error(err);
      showFeedback('error', 'Erro ao salvar link do tópico.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle topic completion checkbox
  const handleToggleAssuntoCompletion = async (assunto: Assunto) => {
    const isCurrentlyCompleted = assunto.completed || assunto.status === 'dominado' || assunto.status === 'revisado';
    const newStatus: TopicStatus = isCurrentlyCompleted ? 'nao_iniciado' : 'dominado';
    try {
      await onUpdateAssuntoStatus(assunto.id, newStatus);
      await onUpdateAssunto(assunto.id, {
        completed: !isCurrentlyCompleted,
        status: newStatus,
      });
      showFeedback('success', !isCurrentlyCompleted ? `"${assunto.name}" marcado como concluído!` : `"${assunto.name}" marcado como pendente.`);
    } catch (err) {
      console.error(err);
      showFeedback('error', 'Erro ao atualizar status do tópico.');
    }
  };

  // 1. EXCLUSÃO DE TÓPICO INDIVIDUAL COM PERSISTÊNCIA REAL NO LOCALSTORAGE
  const handleDeleteTopico = async (disciplinaId: string, topicoIdOuNome: string) => {
    // Encontra o tópico por ID ou Nome
    const targetAssunto = assuntos.find(a => 
      (a.id === topicoIdOuNome || a.name === topicoIdOuNome) && 
      (!disciplinaId || a.disciplinaId === disciplinaId)
    ) || assuntos.find(a => a.id === topicoIdOuNome || a.name === topicoIdOuNome);

    const targetId = targetAssunto ? targetAssunto.id : topicoIdOuNome;
    const targetName = targetAssunto ? targetAssunto.name : 'Tópico';
    const discId = targetAssunto?.disciplinaId || disciplinaId;

    // 1. Atualiza estado local imediatamente (reatividade instantânea)
    const updatedAssuntos = assuntos.filter(a => a.id !== targetId);
    setAssuntos(updatedAssuntos);

    setDisciplinas(prev => prev.map(d => {
      if (d.id === discId) {
        const remainingTopics = updatedAssuntos.filter(a => a.disciplinaId === d.id);
        const dominados = remainingTopics.filter(a => a.completed || a.status === 'dominado' || a.status === 'revisado').length;
        return {
          ...d,
          topicsCount: remainingTopics.length,
          completedTopicsCount: dominados,
        };
      }
      return d;
    }));

    // 2. Persistência imediata no localStorage
    try {
      // gabarita_assuntos
      const rawAssuntos = localStorage.getItem('gabarita_assuntos');
      if (rawAssuntos) {
        const stored: Assunto[] = JSON.parse(rawAssuntos);
        const filtered = stored.filter(a => a.id !== targetId);
        localStorage.setItem('gabarita_assuntos', JSON.stringify(filtered));
      }

      // gabarita_disciplinas (atualiza contagem de tópicos)
      const rawDisc = localStorage.getItem('gabarita_disciplinas');
      if (rawDisc) {
        const storedDisc: Disciplina[] = JSON.parse(rawDisc);
        const updatedDisc = storedDisc.map(d => {
          if (d.id === discId) {
            const discTopics = updatedAssuntos.filter(a => a.disciplinaId === d.id);
            const dom = discTopics.filter(a => a.completed || a.status === 'dominado' || a.status === 'revisado').length;
            return {
              ...d,
              topicsCount: discTopics.length,
              completedTopicsCount: dom,
            };
          }
          return d;
        });
        localStorage.setItem('gabarita_disciplinas', JSON.stringify(updatedDisc));
      }

      // gabarita_active_contest
      const rawActive = localStorage.getItem('gabarita_active_contest');
      if (rawActive) {
        const bundle = JSON.parse(rawActive);
        if (bundle?.disciplinas) {
          bundle.disciplinas = bundle.disciplinas.map((d: any) => {
            if (d.id === discId && d.assuntos) {
              const filteredAssuntos = d.assuntos.filter((a: any) => a.id !== targetId && a.name !== topicoIdOuNome);
              return {
                ...d,
                assuntos: filteredAssuntos,
                topicsCount: filteredAssuntos.length,
                completedTopicsCount: filteredAssuntos.filter((a: any) => a.completed || a.status === 'dominado' || a.status === 'revisado').length,
              };
            }
            return d;
          });
          bundle.updatedAt = new Date().toISOString();
          localStorage.setItem('gabarita_active_contest', JSON.stringify(bundle));
        }
      }
    } catch (storageErr) {
      console.warn('Erro ao atualizar localStorage na exclusão do tópico:', storageErr);
    }

    // 3. Callback assíncrono para persistência no banco / parent
    try {
      if (onDeleteAssunto) {
        await onDeleteAssunto(targetId);
      }
    } catch (err) {
      console.error('Erro ao deletar assunto:', err);
    }

    showFeedback('success', `Tópico "${targetName}" excluído com sucesso.`);
  };

  // 2. EXCLUSÃO DE DISCIPLINA COMPLETA COM PERSISTÊNCIA REAL NO LOCALSTORAGE
  const handleDeleteDisciplina = async (disciplinaId: string) => {
    const discToDelete = disciplinas.find(d => d.id === disciplinaId);
    const discName = discToDelete ? discToDelete.name : 'Disciplina';

    // 1. Atualiza estado local imediatamente
    const updatedDisciplinas = disciplinas.filter(d => d.id !== disciplinaId);
    const updatedAssuntos = assuntos.filter(a => a.disciplinaId !== disciplinaId);
    setDisciplinas(updatedDisciplinas);
    setAssuntos(updatedAssuntos);

    // 2. Persistência imediata no localStorage
    try {
      const rawDisc = localStorage.getItem('gabarita_disciplinas');
      if (rawDisc) {
        const stored: Disciplina[] = JSON.parse(rawDisc);
        const filtered = stored.filter(d => d.id !== disciplinaId);
        localStorage.setItem('gabarita_disciplinas', JSON.stringify(filtered));
      }

      const rawAssuntos = localStorage.getItem('gabarita_assuntos');
      if (rawAssuntos) {
        const stored: Assunto[] = JSON.parse(rawAssuntos);
        const filtered = stored.filter(a => a.disciplinaId !== disciplinaId);
        localStorage.setItem('gabarita_assuntos', JSON.stringify(filtered));
      }

      const rawActive = localStorage.getItem('gabarita_active_contest');
      if (rawActive) {
        const bundle = JSON.parse(rawActive);
        if (bundle?.disciplinas) {
          bundle.disciplinas = bundle.disciplinas.filter((d: any) => d.id !== disciplinaId);
          bundle.updatedAt = new Date().toISOString();
          localStorage.setItem('gabarita_active_contest', JSON.stringify(bundle));
        }
      }
    } catch (storageErr) {
      console.warn('Erro ao atualizar localStorage na exclusão da matéria:', storageErr);
    }

    // 3. Callback assíncrono para persistência no banco / parent
    try {
      if (onDeleteDisciplina) {
        await onDeleteDisciplina(disciplinaId);
      }
    } catch (err) {
      console.error('Erro ao deletar disciplina:', err);
    }

    showFeedback('success', `Disciplina "${discName}" e todos os seus tópicos foram removidos.`);
  };

  // Save Disciplina
  const handleSaveDisciplina = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discName.trim()) return;
    setIsSubmitting(true);
    try {
      if (editingDisciplina) {
        await onUpdateDisciplina(editingDisciplina.id, {
          name: discName.trim(),
          code: discCode.trim() || undefined,
          weight: parseFloat(discWeight) || 2.0,
          color: discColor,
        });
        setEditingDisciplina(null);
        showFeedback('success', 'Disciplina atualizada com sucesso!');
      } else {
        await onAddDisciplina({
          concursoId: selectedConcurso.id,
          name: discName.trim(),
          code: discCode.trim() || undefined,
          weight: parseFloat(discWeight) || 2.0,
          order: currentConcursoDisciplinas.length + 1,
          color: discColor,
        });
        setIsAddDisciplinaOpen(false);
        showFeedback('success', 'Nova disciplina adicionada ao Edital!');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save Assunto
  const handleCloseAssuntoModal = () => {
    setIsAddAssuntoOpen(false);
    setEditingAssunto(null);
  };

  const handleSaveAssunto = async (e: React.FormEvent) => {
    e.preventDefault();
    const discId = targetDisciplinaIdForAssunto || currentConcursoDisciplinas[0]?.id;
    if (!topicName.trim() || !discId) return;
    setIsSubmitting(true);
    try {
      if (editingAssunto) {
        const assuntoId = editingAssunto.id;
        const updatedFields = {
          disciplinaId: discId,
          name: topicName.trim(),
          importance: topicImportance,
          difficulty: topicDifficulty,
          status: topicStatus,
          notes: topicNotes,
          link: topicLink.trim() || undefined,
          completed: topicStatus === 'dominado' || topicStatus === 'revisado',
        };

        await onUpdateAssunto(assuntoId, updatedFields);

        // Atualização do estado local React de forma imutável
        setAssuntos(prev => prev.map(a => a.id === assuntoId ? { ...a, ...updatedFields } : a));

        // Persistência imediata no localStorage
        try {
          const rawAssuntos = localStorage.getItem('gabarita_assuntos');
          if (rawAssuntos) {
            const stored: Assunto[] = JSON.parse(rawAssuntos);
            const updated = stored.map(a => a.id === assuntoId ? { ...a, ...updatedFields } : a);
            localStorage.setItem('gabarita_assuntos', JSON.stringify(updated));
          }

          const rawActive = localStorage.getItem('gabarita_active_contest');
          if (rawActive) {
            const bundle = JSON.parse(rawActive);
            if (bundle?.disciplinas) {
              bundle.disciplinas = bundle.disciplinas.map((d: any) => {
                if (d.assuntos) {
                  d.assuntos = d.assuntos.map((a: any) => a.id === assuntoId ? { ...a, ...updatedFields } : a);
                }
                return d;
              });
              bundle.updatedAt = new Date().toISOString();
              localStorage.setItem('gabarita_active_contest', JSON.stringify(bundle));
            }
          }
        } catch (storageErr) {
          console.warn('Erro ao atualizar localStorage na edição do tópico:', storageErr);
        }

        // FECHO COMPLETO E LIMPEZA DOS MODAIS
        setIsAddAssuntoOpen(false);
        setEditingAssunto(null);
        showFeedback('success', 'Tópico atualizado com sucesso!');
      } else {
        const discTopics = currentConcursoAssuntos.filter(a => a.disciplinaId === discId);
        await onAddAssunto({
          disciplinaId: discId,
          name: topicName.trim(),
          order: discTopics.length + 1,
          importance: topicImportance,
          difficulty: topicDifficulty,
          status: topicStatus,
          completed: topicStatus === 'dominado' || topicStatus === 'revisado',
          notes: topicNotes,
          link: topicLink.trim() || undefined,
          subtopicos: [],
        });
        setIsAddAssuntoOpen(false);
        setEditingAssunto(null);
        // Expand the target disciplina
        setExpandedDisciplinas(prev => ({ ...prev, [discId]: true }));
        showFeedback('success', 'Novo tópico cadastrado!');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Disciplinas pertencentes estritamente ao concurso ativo
  const filteredDisciplinas = useMemo(() => {
    if (!searchTerm.trim()) return currentConcursoDisciplinas;
    const lower = searchTerm.toLowerCase();
    return currentConcursoDisciplinas.filter(d => {
      const matchName = d.name.toLowerCase().includes(lower);
      const matchCode = d.code?.toLowerCase().includes(lower);
      const hasMatchingTopics = currentConcursoAssuntos.some(a => a.disciplinaId === d.id && a.name.toLowerCase().includes(lower));
      return matchName || matchCode || hasMatchingTopics;
    });
  }, [currentConcursoDisciplinas, currentConcursoAssuntos, searchTerm]);

  const areAllExpanded = useMemo(() => {
    if (currentConcursoDisciplinas.length === 0) return false;
    return currentConcursoDisciplinas.every(d => !!expandedDisciplinas[d.id]);
  }, [currentConcursoDisciplinas, expandedDisciplinas]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {feedback && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-semibold rounded-xl">
          {feedback.message}
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider flex-wrap">
              <ListTree className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Edital Verticalizado</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              {concursos.length > 1 ? (
                <select
                  value={selectedConcurso?.id || ''}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedConcursoId(newId);
                    if (onSetActiveConcurso) {
                      onSetActiveConcurso(newId);
                    }
                  }}
                  className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-0.5 text-xs text-slate-900 dark:text-slate-100 font-semibold cursor-pointer outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {concursos.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.title} {c.active ? '(Ativo)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                selectedConcurso?.title && (
                  <span className="text-emerald-600 dark:text-emerald-400 lowercase font-medium">
                    {selectedConcurso.title}
                  </span>
                )
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Matérias & Tópicos do Concurso
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Acompanhamento minucioso por disciplina com lista expansível e controle de questões resolvidas.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAiImportModalOpen(true)}
              leftIcon={<Sparkles className="w-4 h-4 text-purple-400" />}
              className="cursor-pointer"
            >
              Importar por IA
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDiscName('');
                setDiscCode('');
                setDiscWeight('2.0');
                setDiscColor('#10b981');
                setEditingDisciplina(null);
                setIsAddDisciplinaOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4 text-emerald-500" />}
              className="cursor-pointer"
            >
              Nova Disciplina
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setTargetDisciplinaIdForAssunto(currentConcursoDisciplinas[0]?.id || '');
                setTopicName('');
                setTopicImportance('alta');
                setTopicDifficulty('media');
                setTopicStatus('nao_iniciado');
                setTopicNotes('');
                setEditingAssunto(null);
                setIsAddAssuntoOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
              className="theme-btn-primary font-bold shadow-xs cursor-pointer"
            >
              Novo Tópico
            </Button>
          </div>
        </div>

        {/* Global Summary Statistics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 font-medium block text-[11px]">Progresso do Edital</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono">
                {editalStats.progressPct}%
              </span>
              <span className="text-slate-500 text-[11px]">
                ({editalStats.dominados}/{editalStats.totalTopics} tópicos)
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-2">
              <div 
                className="h-full bg-emerald-500 transition-all duration-500" 
                style={{ width: `${editalStats.progressPct}%` }} 
              />
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 font-medium block text-[11px]">Total de Matérias</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono">
                {currentConcursoDisciplinas.length}
              </span>
              <span className="text-slate-500 text-[11px]">cadastradas</span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 font-medium block text-[11px]">Questões Resolvidas</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono">
                {editalStats.totalQuestions}
              </span>
              <span className="text-slate-500 text-[11px]">no total</span>
            </div>
          </div>

          {(() => {
            const globalAccStyle = getAccuracyConfig(editalStats.accuracyPct, editalStats.totalQuestions);
            return (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-medium block text-[11px]">Taxa Geral de Acerto</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className={`text-xl font-black font-mono flex items-center gap-1.5 ${globalAccStyle.textClass}`}>
                    {globalAccStyle.hasCrown && (
                      <span title="Excelência (>90%)" className="inline-flex">
                        <Crown className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0 drop-shadow-xs" />
                      </span>
                    )}
                    <span>{globalAccStyle.hasData ? `${editalStats.accuracyPct}%` : '—'}</span>
                  </span>
                  <span className="text-slate-500 text-[11px]">média</span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Toolbar: Search, Filters, Gamification Legend & Expand All Button */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Pesquisar matéria ou tópico do edital..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
            {/* Status filter toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
              <button
                onClick={() => setStatusFilter('todos')}
                className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-all ${
                  statusFilter === 'todos'
                    ? 'bg-white dark:bg-slate-700 shadow-xs text-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setStatusFilter('concluidos')}
                className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-all ${
                  statusFilter === 'concluidos'
                    ? 'bg-white dark:bg-slate-700 shadow-xs text-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Concluídos
              </button>
              <button
                onClick={() => setStatusFilter('pendentes')}
                className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-all ${
                  statusFilter === 'pendentes'
                    ? 'bg-white dark:bg-slate-700 shadow-xs text-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Pendentes
              </button>
            </div>

            {/* Toggle All Accordions button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => toggleAllDisciplinas(!areAllExpanded)}
              leftIcon={areAllExpanded ? <Folder className="w-4 h-4" /> : <FolderOpen className="w-4 h-4 text-emerald-500" />}
              className="cursor-pointer font-medium text-xs whitespace-nowrap"
            >
              {areAllExpanded ? 'Recolher Todos' : 'Expandir Todos'}
            </Button>
          </div>
        </div>

        {/* Legenda de Gamificação do Percentual de Acerto */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-600 dark:text-slate-300">Faixas de Acerto:</span>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 font-bold border border-red-500/20">
              <span className="w-2 h-2 rounded-full bg-red-600 dark:bg-red-400 shrink-0" />
              <span>&le;50% Alerta</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
              <span className="w-2 h-2 rounded-full bg-amber-600 dark:bg-amber-400 shrink-0" />
              <span>51-75% Médio</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-green-500/15 text-green-600 dark:text-green-400 font-bold border border-green-400/30">
              <span className="w-2 h-2 rounded-full bg-green-500 dark:bg-green-400 shrink-0" />
              <span>76-90% Bom</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-900/20 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-black border border-emerald-600/40">
              <Crown className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 fill-amber-400/80 shrink-0" />
              <span>&gt;90% Excelente</span>
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ACCORDION DE DISCIPLINAS (LISTA EXPANSÍVEL / SANFONA)
          ========================================================================= */}
      {filteredDisciplinas.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-4">
          <BookOpen className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
            {currentConcursoDisciplinas.length === 0 
              ? `Nenhuma disciplina cadastrada para ${selectedConcurso?.title || 'este concurso'}`
              : 'Nenhuma disciplina encontrada com os filtros atuais'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {currentConcursoDisciplinas.length === 0
              ? 'Importe a grade programática do edital com auxílio da IA ou adicione matérias manualmente usando o botão "Nova Disciplina".'
              : 'Tente ajustar os termos de pesquisa ou remover os filtros.'}
          </p>
          {currentConcursoDisciplinas.length === 0 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAiImportModalOpen(true)}
                leftIcon={<Sparkles className="w-4 h-4 text-purple-400" />}
                className="cursor-pointer"
              >
                Importar Edital com IA
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setDiscName('');
                  setDiscCode('');
                  setDiscWeight('2.0');
                  setDiscColor('#10b981');
                  setEditingDisciplina(null);
                  setIsAddDisciplinaOpen(true);
                }}
                leftIcon={<Plus className="w-4 h-4" />}
                className="theme-btn-primary font-bold cursor-pointer"
              >
                Nova Disciplina
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDisciplinas.map((disc) => {
            // Se o nome da disciplina estiver vazio ou sem letras válidas, descarte esse item
            const cleanDiscName = (disc.name || '').trim();
            if (!cleanDiscName || !/[a-zA-ZáéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/.test(cleanDiscName)) {
              return null;
            }

            // Tópicos isolados estritamente pertencentes a esta disciplina no concurso ativo
            const discAssuntos = currentConcursoAssuntos.filter(a => a.disciplinaId === disc.id);
            const validAssuntos = discAssuntos.filter(a => {
              const nameClean = (a.name || '').trim();
              return nameClean.length > 0;
            });

            const isExpanded = !!expandedDisciplinas[disc.id];
            
            // Filtered topics based on status filter & search
            const visibleAssuntos = validAssuntos.filter(a => {
              const isDone = a.completed || a.status === 'dominado' || a.status === 'revisado';
              if (statusFilter === 'concluidos' && !isDone) return false;
              if (statusFilter === 'pendentes' && isDone) return false;
              if (searchTerm.trim()) {
                const lower = searchTerm.toLowerCase();
                const matchTopic = a.name.toLowerCase().includes(lower);
                const matchDisc = disc.name.toLowerCase().includes(lower);
                if (!matchTopic && !matchDisc) return false;
              }
              return true;
            });

            // Discipline stats baseadas nos tópicos válidos
            const totalTopicsCount = validAssuntos.length;
            const completedTopicsCount = validAssuntos.filter(a => a.completed || a.status === 'dominado' || a.status === 'revisado').length;
            const progressPct = totalTopicsCount > 0 ? Math.round((completedTopicsCount / totalTopicsCount) * 100) : 0;
            const totalQuestionsSolved = validAssuntos.reduce((acc, a) => acc + (a.totalQuestionsSolved || 0), 0);
            const correctQuestionsSolved = validAssuntos.reduce((acc, a) => acc + (a.correctQuestionsSolved || 0), 0);
            const accuracyPct = totalQuestionsSolved > 0 ? Math.round((correctQuestionsSolved / totalQuestionsSolved) * 100) : 0;
            const accuracyStyle = getAccuracyConfig(accuracyPct, totalQuestionsSolved);

            return (
              <div 
                key={disc.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700"
              >
                {/* 1. VISÃO RECOLHIDA: Card da Matéria (Barra lateral fina colorida, Nome, Estatísticas, Barra de Progresso e Chevron) */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleDisciplinaAccordion(disc.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleDisciplinaAccordion(disc.id);
                    }
                  }}
                  className="p-4 sm:p-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 select-none relative transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                >
                  {/* Barra lateral fina colorida no topo/esquerda do card para identificação */}
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-1.5 transition-all"
                    style={{ backgroundColor: disc.color || '#10b981' }}
                  />

                  {/* Informações da matéria e estatísticas */}
                  <div className="pl-3 sm:pl-4 flex-1 space-y-2.5 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{disc.name}</span>
                        {disc.code && (
                          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            {disc.code}
                          </span>
                        )}
                      </h3>
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                        ({completedTopicsCount}/{totalTopicsCount} tópicos dominados)
                      </span>
                    </div>

                    {/* Estatísticas discretas logo abaixo do nome */}
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs">
                      {/* Questões Resolvidas */}
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-medium border border-slate-200/60 dark:border-slate-700/60">
                        <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                        <span>Questões Resolvidas:</span>
                        <strong className="font-extrabold text-slate-900 dark:text-slate-100">{totalQuestionsSolved}</strong>
                      </div>

                      {/* Percentual de Acerto */}
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium border ${accuracyStyle.badgeClass}`}>
                        <Target className="w-3.5 h-3.5 shrink-0" />
                        <span>Percentual de Acerto:</span>
                        <strong className="font-extrabold inline-flex items-center gap-1">
                          {accuracyStyle.hasCrown && (
                            <span title="Excelência (>90%)" className="inline-flex">
                              <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0 drop-shadow-xs" />
                            </span>
                          )}
                          <span>{accuracyStyle.label}</span>
                        </strong>
                      </div>
                    </div>

                    {/* Barra de Progresso Horizontal */}
                    <div className="space-y-1 pt-0.5 max-w-xl">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        <span>Conclusão dos Tópicos</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {progressPct}% ({completedTopicsCount} de {totalTopicsCount})
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${progressPct}%`, 
                            backgroundColor: disc.color || '#10b981' 
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Controles à direita: Ações de gerenciar e Seta (Chevron) animada */}
                  <div className="flex items-center gap-2 self-end md:self-center pl-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTargetDisciplinaIdForAssunto(disc.id);
                        setTopicName('');
                        setTopicImportance('alta');
                        setTopicDifficulty('media');
                        setTopicStatus('nao_iniciado');
                        setTopicNotes('');
                        setEditingAssunto(null);
                        setIsAddAssuntoOpen(true);
                      }}
                      className="p-2 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                      title="Adicionar Novo Tópico a esta matéria"
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingDisciplina(disc);
                        setDiscName(disc.name);
                        setDiscCode(disc.code || '');
                        setDiscWeight(String(disc.weight || 2.0));
                        setDiscColor(disc.color || '#10b981');
                        setIsAddDisciplinaOpen(true);
                      }}
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Editar Disciplina"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDisciplina(disc.id);
                      }}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Excluir Disciplina"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Seta (Chevron) com animação de rotação */}
                    <div 
                      className={`p-2 rounded-xl transition-all duration-300 cursor-pointer ${
                        isExpanded 
                          ? 'rotate-180 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' 
                          : 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <ChevronDown className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* 3. VISÃO EXPANDIDA (Lista de Tópicos pertencentes àquela disciplina) */}
                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 sm:p-5 space-y-2.5">
                    {/* Cabeçalho da grade expandida */}
                    <div className="flex items-center justify-between pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800/80 px-2 sm:px-3">
                      <span>Tópicos da Disciplina ({visibleAssuntos.length})</span>
                      <div className="flex items-center gap-4 sm:gap-6">
                        <span className="w-16 sm:w-20 text-right">Questões</span>
                        <span className="w-20 sm:w-24 text-center">% Acerto</span>
                        <span className="w-24 sm:w-28 text-center">Link</span>
                        <span className="w-16 text-center">Ações</span>
                      </div>
                    </div>

                    {visibleAssuntos.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 space-y-2">
                        <p>Nenhum tópico encontrado com os filtros atuais nesta matéria.</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setTargetDisciplinaIdForAssunto(disc.id);
                            setTopicName('');
                            setTopicImportance('alta');
                            setTopicDifficulty('media');
                            setTopicStatus('nao_iniciado');
                            setTopicNotes('');
                            setTopicLink('');
                            setEditingAssunto(null);
                            setIsAddAssuntoOpen(true);
                          }}
                          leftIcon={<Plus className="w-3.5 h-3.5" />}
                          className="cursor-pointer mx-auto"
                        >
                          Adicionar Tópico
                        </Button>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60 space-y-1">
                        {visibleAssuntos.map((assunto) => {
                          const isCompleted = assunto.completed || assunto.status === 'dominado' || assunto.status === 'revisado';
                          const topicQuestions = assunto.totalQuestionsSolved ?? 0;
                          const rawAccuracy = (assunto.accuracyRate !== undefined && assunto.accuracyRate !== null && Number(assunto.accuracyRate) > 0)
                            ? Number(assunto.accuracyRate)
                            : (topicQuestions > 0 && assunto.correctQuestionsSolved != null 
                                ? Math.round((assunto.correctQuestionsSolved / topicQuestions) * 100) 
                                : (Number(assunto.accuracyRate) || 0));
                          const topicAccuracy = Number(rawAccuracy);
                          const topicAccStyle = getAccuracyConfig(topicAccuracy, topicQuestions);

                          return (
                            <div
                              key={assunto.id}
                              className={`py-3 px-2 sm:px-3 rounded-xl flex items-center justify-between gap-3 transition-colors ${
                                isCompleted 
                                  ? 'bg-emerald-500/5 dark:bg-emerald-950/15' 
                                  : 'hover:bg-white/80 dark:hover:bg-slate-900/60'
                              }`}
                            >
                              {/* Checkbox (para marcar como concluído) + Nome do Tópico */}
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleAssuntoCompletion(assunto)}
                                  className="shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-md transition-transform active:scale-95"
                                  title={isCompleted ? 'Desmarcar conclusão do tópico' : 'Marcar tópico como concluído'}
                                >
                                  {isCompleted ? (
                                    <div className="w-5 h-5 rounded-md bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    </div>
                                  ) : (
                                    <div className="w-5 h-5 rounded-md border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500 dark:hover:border-emerald-400 bg-white dark:bg-slate-900 transition-colors" />
                                  )}
                                </button>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span 
                                      className={`text-sm font-semibold truncate transition-colors ${
                                        isCompleted 
                                          ? 'text-slate-600 dark:text-slate-400 line-through decoration-emerald-500/60' 
                                          : 'text-slate-900 dark:text-slate-100'
                                      }`}
                                      title={assunto.name}
                                    >
                                      {assunto.name}
                                    </span>
                                    {assunto.importance && (
                                      <span 
                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                          assunto.importance === 'alta'
                                            ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60'
                                            : assunto.importance === 'media'
                                            ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700/60'
                                        }`}
                                      >
                                        {assunto.importance === 'alta' ? 'Alta' : assunto.importance === 'media' ? 'Média' : 'Baixa'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Colunas minimalistas à direita: Questões, % de Acerto, Link e Ações */}
                              <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                                {/* Total Resolvidas */}
                                <div className="w-16 sm:w-20 text-right">
                                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                                    {topicQuestions}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-medium">
                                    resolvidas
                                  </div>
                                </div>

                                {/* % de Acerto: Badge encapsulado (quadradinho com bordas levemente arredondadas) com fundo totalmente preenchido */}
                                <div className="w-20 sm:w-24 flex justify-center">
                                  <span className={`inline-flex items-center justify-center gap-1 min-w-[54px] px-2.5 py-1 rounded-md text-xs font-mono shadow-xs ${topicAccStyle.solidBadgeClass}`}>
                                    {topicAccStyle.hasCrown && (
                                      <span title="Excelência (>90%)" className="inline-flex">
                                        <Crown className="w-3.5 h-3.5 text-amber-300 fill-amber-300 shrink-0 drop-shadow-xs" />
                                      </span>
                                    )}
                                    <span>{topicAccStyle.shortLabel}</span>
                                  </span>
                                </div>

                                {/* Coluna 'Link' (Atalho para Banco de Questões) */}
                                <div className="w-24 sm:w-28 text-center flex justify-center items-center">
                                  {assunto.link && assunto.link.trim() ? (
                                    <div className="flex items-center justify-center gap-1.5 group">
                                      <a
                                        href={assunto.link.startsWith('http://') || assunto.link.startsWith('https://') ? assunto.link : `https://${assunto.link}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors cursor-pointer"
                                        title={`Abrir link de questões: ${assunto.link}`}
                                      >
                                        <span>Visualizar</span>
                                        <ExternalLink className="w-3 h-3 text-blue-500 shrink-0" />
                                      </a>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenLinkModal(assunto);
                                        }}
                                        className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 opacity-0 group-hover:opacity-100 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 transition-all cursor-pointer"
                                        title="Editar link de questões"
                                      >
                                        <Edit2 className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenLinkModal(assunto);
                                      }}
                                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                                      title="Adicionar link para este assunto"
                                    >
                                      <Plus className="w-3 h-3 text-slate-400" />
                                      <span>Adicionar</span>
                                    </button>
                                  )}
                                </div>

                                {/* Ações do Tópico: Editar e excluir */}
                                <div className="w-16 flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsAddAssuntoOpen(false);
                                      setEditingAssunto(assunto);
                                      setTargetDisciplinaIdForAssunto(assunto.disciplinaId);
                                      setTopicName(assunto.name);
                                      setTopicImportance(assunto.importance || 'alta');
                                      setTopicDifficulty(assunto.difficulty || 'media');
                                      setTopicStatus(assunto.status || 'nao_iniciado');
                                      setTopicNotes(assunto.notes || '');
                                      setTopicLink(assunto.link || '');
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                    title="Editar Tópico"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteTopico(disc.id, assunto.id);
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                    title="Excluir Tópico"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Cadastrar / Editar Disciplina */}
      <Modal
        isOpen={isAddDisciplinaOpen || editingDisciplina !== null}
        onClose={() => { 
          setIsAddDisciplinaOpen(false); 
          setEditingDisciplina(null); 
        }}
        title={editingDisciplina ? "Editar Disciplina" : "Cadastrar Nova Disciplina"}
        maxWidth="md"
      >
        <form onSubmit={handleSaveDisciplina} className="space-y-4 text-xs">
          <Input 
            label="Nome da Matéria *" 
            placeholder="Ex: Direito Constitucional"
            value={discName} 
            onChange={(e) => setDiscName(e.target.value)} 
            required 
          />
          <Input 
            label="Código / Sigla" 
            placeholder="Ex: DCO"
            value={discCode} 
            onChange={(e) => setDiscCode(e.target.value)} 
          />
          <div className="grid grid-cols-2 gap-3">
            <Input 
              label="Peso / Importância" 
              type="number" 
              step="0.5" 
              value={discWeight} 
              onChange={(e) => setDiscWeight(e.target.value)} 
            />
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Cor Identificadora
              </label>
              <div className="flex items-center gap-2">
                <input 
                  type="color" 
                  value={discColor} 
                  onChange={(e) => setDiscColor(e.target.value)}
                  className="w-10 h-8 rounded-lg cursor-pointer bg-transparent border border-slate-300 dark:border-slate-700" 
                />
                <span className="font-mono text-xs text-slate-500">{discColor}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={() => { 
                setIsAddDisciplinaOpen(false); 
                setEditingDisciplina(null); 
              }}
            >
              Cancelar
            </Button>
            <Button 
              variant="primary" 
              type="submit" 
              isLoading={isSubmitting}
            >
              {editingDisciplina ? "Salvar Alterações" : "Adicionar Disciplina"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Cadastrar / Editar Tópico */}
      <Modal
        isOpen={isAddAssuntoOpen || editingAssunto !== null}
        onClose={handleCloseAssuntoModal}
        title={editingAssunto ? "Editar Tópico" : "Cadastrar Novo Tópico"}
        maxWidth="md"
      >
        <form onSubmit={handleSaveAssunto} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Disciplina / Matéria *
            </label>
            <select
              value={targetDisciplinaIdForAssunto}
              onChange={(e) => setTargetDisciplinaIdForAssunto(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            >
              {currentConcursoDisciplinas.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.code ? `(${d.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          <Input 
            label="Nome do Tópico *" 
            placeholder="Ex: Direitos e Garantias Fundamentais"
            value={topicName} 
            onChange={(e) => setTopicName(e.target.value)} 
            required 
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Relevância no Edital
              </label>
              <select
                value={topicImportance}
                onChange={(e) => setTopicImportance(e.target.value as AssuntoImportance)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="alta">Alta Relevância</option>
                <option value="media">Média Relevância</option>
                <option value="baixa">Baixa Relevância</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Dificuldade Pessoal
              </label>
              <select
                value={topicDifficulty}
                onChange={(e) => setTopicDifficulty(e.target.value as TopicDifficulty)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="facil">Fácil</option>
                <option value="media">Médio</option>
                <option value="dificil">Difícil</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Status do Estudo
            </label>
            <select
              value={topicStatus}
              onChange={(e) => setTopicStatus(e.target.value as TopicStatus)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="nao_iniciado">Não Iniciado</option>
              <option value="em_estudo">Em Estudo</option>
              <option value="revisado">Revisado</option>
              <option value="dominado">Dominado / Concluído</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Observações / Artigos da Lei
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Focar no Art. 5º, incisos X a XXV e súmulas vinculantes."
              value={topicNotes}
              onChange={(e) => setTopicNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-2.5 text-xs focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Link de Questões (Atalho para Banco de Questões)
            </label>
            <div className="relative">
              <input
                type="url"
                placeholder="https://www.qconcursos.com/... ou https://tecconcursos.com.br/..."
                value={topicLink}
                onChange={(e) => setTopicLink(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 pl-8 pr-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <Link2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Atalho direto para o banco de questões online deste assunto.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button 
              variant="outline" 
              type="button"
              onClick={handleCloseAssuntoModal}
            >
              Cancelar
            </Button>
            <Button 
              variant="primary" 
              type="submit" 
              isLoading={isSubmitting}
            >
              {editingAssunto ? "Salvar Alterações" : "Adicionar Tópico"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Adicionar / Editar Link para Banco de Questões */}
      <Modal
        isOpen={isLinkModalOpen}
        onClose={() => {
          setIsLinkModalOpen(false);
          setTargetAssuntoForLink(null);
        }}
        title="Link para Banco de Questões"
        maxWidth="md"
      >
        <form onSubmit={handleSaveTopicLink} className="space-y-4 text-xs">
          <div>
            <p className="text-slate-500 dark:text-slate-400 mb-2">
              Adicione ou atualize o atalho direto para o banco de questões deste assunto (ex: QConcursos, Tec Concursos, Gran Questões, etc.).
            </p>
            {targetAssuntoForLink && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assunto / Tópico</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block text-sm">
                  {targetAssuntoForLink.name}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              URL do Banco de Questões *
            </label>
            <div className="relative">
              <input
                type="url"
                placeholder="https://www.qconcursos.com/questoes-de-concursos/disciplinas/..."
                value={linkInputValue}
                onChange={(e) => setLinkInputValue(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 pl-9 pr-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                autoFocus
                required
              />
              <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Cole o link do seu filtro salvo. Ao salvar, a palavra <strong>"Visualizar"</strong> será exibida na coluna Link.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            {targetAssuntoForLink?.link ? (
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  if (targetAssuntoForLink) {
                    await onUpdateAssunto(targetAssuntoForLink.id, { link: undefined });
                    showFeedback('success', 'Link removido com sucesso!');
                    setIsLinkModalOpen(false);
                    setTargetAssuntoForLink(null);
                  }
                }}
                className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/60 dark:hover:bg-rose-950/40 text-xs cursor-pointer"
              >
                Remover Link
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button 
                type="button"
                variant="outline" 
                onClick={() => { 
                  setIsLinkModalOpen(false); 
                  setTargetAssuntoForLink(null); 
                }}
              >
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                type="submit" 
                isLoading={isSubmitting}
              >
                Salvar Link
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal: Importar Edital com IA */}
      <EditalImportModal
        isOpen={isAiImportModalOpen}
        onClose={() => setIsAiImportModalOpen(false)}
        concursos={concursos}
        selectedConcursoId={selectedConcurso?.id}
        hasExistingDisciplinas={currentConcursoDisciplinas.length > 0}
        onConfirmImport={async (payload, concursoId, mode) => {
          await onImportEditalTree(payload, concursoId, mode);
          showFeedback('success', 'Edital importado e estruturado com sucesso!');
        }}
      />
    </div>
  );
};
