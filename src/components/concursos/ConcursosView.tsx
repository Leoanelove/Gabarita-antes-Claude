import React, { useState } from 'react';
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
  Zap
} from 'lucide-react';
import { Concurso, ConcursoSphere, ConcursoStatus, Prova, UserProfile } from '../../types';
import { Card, CardHeader, CardBody, CardFooter } from '../../design-system/Card';
import { Button } from '../../design-system/Button';
import { Input } from '../../design-system/Input';
import { Badge } from '../../design-system/Badge';
import { Modal } from '../../design-system/Modal';
import { NovoConcursoModal, ExtractedDiscipline } from './NovoConcursoModal';

interface ConcursosViewProps {
  concursos: Concurso[];
  provas: Prova[];
  user: UserProfile;
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
}

export const ConcursosView: React.FC<ConcursosViewProps> = ({
  concursos,
  provas,
  user,
  onAddConcurso,
  onAddConcursoWithDisciplinas,
  onUpdateConcurso,
  onDeleteConcurso,
  onSetActiveConcurso,
  onAddProva,
  onUpdateProva,
  onDeleteProva,
}) => {
  const [activeTab, setActiveTab] = useState<'concursos' | 'provas'>('concursos');
  const [searchTerm, setSearchTerm] = useState('');
  const [sphereFilter, setSphereFilter] = useState<'todas' | ConcursoSphere>('todas');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [isNovoConcursoWizardOpen, setIsNovoConcursoWizardOpen] = useState(false);
  const [editingConcurso, setEditingConcurso] = useState<Concurso | null>(null);
  const [deletingConcursoId, setDeletingConcursoId] = useState<string | null>(null);

  const [isAddProvaModalOpen, setIsAddProvaModalOpen] = useState(false);
  const [editingProva, setEditingProva] = useState<Prova | null>(null);
  const [deletingProvaId, setDeletingProvaId] = useState<string | null>(null);

  // Edit Concurso form fields
  const [title, setTitle] = useState('');
  const [organ, setOrgan] = useState('');
  const [banca, setBanca] = useState('');
  const [role, setRole] = useState('');
  const [sphere, setSphere] = useState<ConcursoSphere>('federal');
  const [remuneration, setRemuneration] = useState('');
  const [vacantPositions, setVacantPositions] = useState('1');
  const [status, setStatus] = useState<ConcursoStatus>('autorizado');
  const [examDate, setExamDate] = useState('');
  const [editalUrl, setEditalUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prova form fields
  const [provaConcursoId, setProvaConcursoId] = useState('');
  const [provaOrgan, setProvaOrgan] = useState('');
  const [provaBanca, setProvaBanca] = useState('');
  const [provaYear, setProvaYear] = useState(new Date().getFullYear().toString());
  const [provaRole, setProvaRole] = useState('');
  const [provaQuestionsCount, setProvaQuestionsCount] = useState('100');
  const [provaDurationMinutes, setProvaDurationMinutes] = useState('240');

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleOpenAddConcurso = () => {
    setIsNovoConcursoWizardOpen(true);
  };

  const handleOpenEditConcurso = (c: Concurso) => {
    setEditingConcurso(c);
    setTitle(c.title);
    setOrgan(c.organ);
    setBanca(c.banca);
    setRole(c.role);
    setSphere(c.sphere);
    setRemuneration(c.remuneration ? c.remuneration.toString() : '');
    setVacantPositions(c.vacantPositions ? c.vacantPositions.toString() : '1');
    setStatus(c.status);
    setExamDate(c.examDate || '');
    setEditalUrl(c.editalUrl || '');
    setNotes(c.notes || '');
  };

  const handleSaveEditConcurso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConcurso) return;
    if (!title.trim() || !organ.trim() || !banca.trim() || !role.trim()) {
      showFeedback('error', 'Preencha todos os campos obrigatórios.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onUpdateConcurso(editingConcurso.id, {
        title,
        organ,
        banca,
        role,
        sphere,
        remuneration: parseFloat(remuneration) || 0,
        vacantPositions: parseInt(vacantPositions, 10) || 1,
        status,
        examDate: examDate || undefined,
        editalUrl: editalUrl || undefined,
        notes,
      });
      setEditingConcurso(null);
      showFeedback('success', `Concurso "${title}" atualizado com sucesso!`);
    } catch (err: unknown) {
      showFeedback('error', err instanceof Error ? err.message : 'Falha ao atualizar concurso.');
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
            Gestão de Concursos & Provas
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Cadastre seu concurso foco, importe disciplinas via IA e gerencie provas anteriores.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('concursos')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'concursos' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
            }`}
          >
            Concursos ({concursos.length})
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
        <Button
          variant="primary"
          onClick={() => {
            if (activeTab === 'concursos') handleOpenAddConcurso();
            else setIsAddProvaModalOpen(true);
          }}
          leftIcon={<Plus className="w-4 h-4" />}
          className="shadow-md shadow-emerald-500/20"
        >
          {activeTab === 'concursos' ? 'Novo Concurso' : 'Nova Prova'}
        </Button>
      </div>

      {/* Concursos List */}
      {activeTab === 'concursos' && (
        <>
          {concursos.length === 0 ? (
            <div className="p-8 sm:p-12 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center space-y-5 bg-white/50 dark:bg-slate-900/40 backdrop-blur-xs">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto shadow-inner">
                <Target className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
                  Nenhum Concurso Cadastrado
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Clique no botão abaixo para cadastrar seu primeiro certame e extrair as matérias do edital com auxílio de Inteligência Artificial!
                </p>
              </div>
              <Button
                variant="primary"
                size="lg"
                onClick={handleOpenAddConcurso}
                leftIcon={<Plus className="w-5 h-5" />}
                className="shadow-lg shadow-emerald-500/20 px-6 py-3 font-bold text-sm"
              >
                Cadastrar Concurso Foco com IA
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredConcursos.map(concurso => {
                const isActive = concurso.active || user.targetConcursoId === concurso.id;
                const diffDays = concurso.examDate 
                  ? Math.ceil((new Date(concurso.examDate).getTime() - new Date().getTime()) / 86400000)
                  : null;
                return (
                  <Card key={concurso.id} hoverEffect className={`relative overflow-hidden ${isActive ? 'ring-2 ring-brand ring-[var(--primary-color)] border-brand !border-[var(--primary-color)]' : ''}`}>
                    {isActive && (
                      <div className="absolute top-0 right-0 bg-brand bg-[var(--primary-color)] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-bl-lg flex items-center gap-1 shadow-xs">
                        <Star className="w-3 h-3 fill-current" /> Ativo
                      </div>
                    )}
                    <CardBody className="p-5 space-y-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(concurso.status)}
                          <span className="text-[11px] font-bold text-slate-400 uppercase">{concurso.sphere}</span>
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">{concurso.title}</h3>
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Cargo: {concurso.role}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Órgão</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{concurso.organ}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Banca</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{concurso.banca}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Dias Prova</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{diffDays !== null ? `${diffDays} dias` : '-'}</span>
                        </div>
                      </div>
                    </CardBody>
                    <CardFooter className="flex items-center justify-between">
                      {!isActive ? (
                        <Button variant="outline" size="sm" onClick={() => handleActivate(concurso.id, concurso.title)}>
                          Definir como Ativo
                        </Button>
                      ) : (
                        <span className="text-xs font-bold text-brand text-[var(--primary-color)] dark:text-[var(--primary-text-dark)] flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Foco Ativo
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEditConcurso(concurso)}>Editar</Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeletingConcursoId(concurso.id)} className="text-rose-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Provas Anteriores List */}
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
                  <p className="text-xs text-slate-500">{prova.questionsCount} questões • {prova.durationMinutes} min • Banca: {prova.banca}</p>
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

      {/* Modal: Confirmação de Exclusão */}
      <Modal
        isOpen={deletingConcursoId !== null}
        onClose={() => setDeletingConcursoId(null)}
        title="Excluir Concurso"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Tem certeza de que deseja remover este concurso? As provas associadas a ele também serão excluídas.
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
};
