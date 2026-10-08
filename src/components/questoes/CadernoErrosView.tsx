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
  ExternalLink 
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

interface CadernoErrosViewProps {
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

export const MOTIVOS_CONFIG: Record<MotivoErro, { label: string; color: string; bg: string; border: string; desc: string; icon: string }> = {
  falta_atencao: { label: 'Falta de Atenção', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', desc: 'Leitura descuidada', icon: '⚠️' },
  desconhecimento_teoria: { label: 'Desconhecimento da Teoria', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', desc: 'Conceito não estudado', icon: '📖' },
  pegadinha_banca: { label: 'Pegadinha da Banca', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', desc: 'Casca de banana', icon: '🍌' },
  esquecimento_lei_seca: { label: 'Esquecimento de Lei Seca', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', desc: 'Prazo ou artigo', icon: '⚖️' },
  jurisprudencia: { label: 'Jurisprudência / Súmula', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', desc: 'STF ou STJ', icon: '🏛️' },
  interpretacao: { label: 'Interpretação Textual', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200', desc: 'Contexto', icon: '📝' },
  calculo_tempo: { label: 'Pressão de Tempo', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', desc: 'Cálculo ou pressa', icon: '⏱️' },
  outro: { label: 'Outro Motivo', color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200', desc: 'Particular', icon: '📌' },
};

export const CadernoErrosView: React.FC<CadernoErrosViewProps> = ({
  cadernoErros,
  disciplinas,
  assuntos,
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
        onAction={() => onNavigateTab ? onNavigateTab('concursos') : null}
      />
    );
  }

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemCadernoErros | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDisciplina, setFilterDisciplina] = useState('todas');
  const [filterMotivo, setFilterMotivo] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [feedback, setFeedback] = useState<string | null>(null);

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

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const availableAssuntos = useMemo(() => {
    return assuntos.filter(a => a.disciplinaId === formDisciplinaId);
  }, [assuntos, formDisciplinaId]);

  const summary = useMemo(() => {
    const total = cadernoErros.length;
    const pendentes = cadernoErros.filter(e => e.statusRevisao === 'pendente').length;
    const emRevisao = cadernoErros.filter(e => e.statusRevisao === 'em_revisao').length;
    const dominados = cadernoErros.filter(e => e.statusRevisao === 'dominado').length;
    const reincidentes = cadernoErros.filter(e => e.reincidenciaCount > 1).length;
    return { total, pendentes, emRevisao, dominados, reincidentes };
  }, [cadernoErros]);

  const filteredItems = useMemo(() => {
    return cadernoErros.filter(item => {
      const matchDisc = filterDisciplina === 'todas' || item.disciplinaId === filterDisciplina;
      const matchMotivo = filterMotivo === 'todos' || item.motivo === filterMotivo;
      const matchStatus = filterStatus === 'todos' || item.statusRevisao === filterStatus;
      const query = searchTerm.toLowerCase().trim();
      const matchSearch = !query || item.statementOrExcerpt.toLowerCase().includes(query) || item.observation.toLowerCase().includes(query);
      return matchDisc && matchMotivo && matchStatus && matchSearch;
    });
  }, [cadernoErros, filterDisciplina, filterMotivo, filterStatus, searchTerm]);

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
          banca: formBanca,
          difficulty: formDifficulty,
          motivo: formMotivo,
          statementOrExcerpt: formStatement.trim(),
          observation: formObservation.trim(),
          correctAnswer: formCorrectAnswer.trim() || undefined,
          questionUrl: formQuestionUrl.trim() || undefined,
          statusRevisao: formStatus,
        });
        showFeedback('Erro atualizado com sucesso!');
      } else {
        await onAddCadernoErro({
          userId: 'user_demo_01',
          disciplinaId: formDisciplinaId,
          disciplinaName: disc?.name || 'Geral',
          assuntoId: formAssuntoId || undefined,
          assuntoName: top?.name || 'Geral',
          banca: formBanca,
          difficulty: formDifficulty,
          motivo: formMotivo,
          statementOrExcerpt: formStatement.trim(),
          observation: formObservation.trim(),
          correctAnswer: formCorrectAnswer.trim() || undefined,
          questionUrl: formQuestionUrl.trim() || undefined,
          statusRevisao: formStatus,
        });
        showFeedback('Adicionado ao Caderno de Erros!');
      }
      setIsAddModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="p-3.5 rounded-xl text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 bg-white dark:bg-slate-900 border rounded-2xl">
          <span className="text-slate-400 text-xs">Total</span>
          <div className="text-2xl font-black font-mono">{summary.total}</div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-rose-200 rounded-2xl">
          <span className="text-rose-500 text-xs font-semibold">Pendentes</span>
          <div className="text-2xl font-black font-mono text-rose-500">{summary.pendentes}</div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-amber-200 rounded-2xl">
          <span className="text-amber-500 text-xs font-semibold">Em Revisão</span>
          <div className="text-2xl font-black font-mono text-amber-500">{summary.emRevisao}</div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl theme-primary-border">
          <span className="text-emerald-500 theme-primary-text text-xs font-semibold">Dominados</span>
          <div className="text-2xl font-black font-mono text-emerald-500 theme-primary-text">{summary.dominados}</div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-orange-200 rounded-2xl col-span-2 sm:col-span-1">
          <span className="text-orange-500 text-xs font-semibold">Reincidentes</span>
          <div className="text-2xl font-black font-mono text-orange-500">{summary.reincidentes}</div>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Caderno de Erros & Reincidências"
          action={
            <Button size="sm" variant="primary" onClick={handleOpenNewModal} leftIcon={<Plus className="w-4 h-4" />}>
              Novo Erro
            </Button>
          }
        />
        <CardBody className="p-4 space-y-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar nos erros..."
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border rounded-lg text-xs"
              />
            </div>
            <select
              value={filterDisciplina}
              onChange={(e) => setFilterDisciplina(e.target.value)}
              className="p-2 rounded-lg border bg-white dark:bg-slate-900 text-xs"
            >
              <option value="todas">Todas as Disciplinas</option>
              {disciplinas.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div className="space-y-3">
            {filteredItems.map(item => {
              const motivoCfg = MOTIVOS_CONFIG[item.motivo] || MOTIVOS_CONFIG.outro;
              const disc = disciplinas.find(d => d.id === item.disciplinaId);
              const isDominado = item.statusRevisao === 'dominado';
              return (
                <div key={item.id} className="p-4 rounded-2xl border bg-white dark:bg-slate-900 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: disc?.color || '#10b981' }} />
                      <span className="font-bold">{item.disciplinaName} • {item.assuntoName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded font-bold ${motivoCfg.bg} ${motivoCfg.color}`}>{motivoCfg.icon} {motivoCfg.label}</span>
                      <Badge variant={isDominado ? 'primary' : 'rose'} size="sm">{item.statusRevisao}</Badge>
                    </div>
                  </div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{item.statementOrExcerpt}</p>
                  <p className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 p-2.5 rounded-xl">{item.observation}</p>
                  
                  {item.questionUrl && (
                    <div className="pt-0.5">
                      <a
                        href={item.questionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 theme-primary-text hover:underline transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Link da Questão Original</span>
                      </a>
                    </div>
                  )}

                  <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button size="sm" variant="ghost" onClick={() => handleOpenEditModal(item)} leftIcon={<Edit2 className="w-3.5 h-3.5" />}>
                      Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onIncrementarReincidencia(item.id)} leftIcon={<Flame className="w-3.5 h-3.5 text-orange-500" />}>
                      Errei de novo (+1)
                    </Button>
                    {!isDominado ? (
                      <Button size="sm" variant="primary" onClick={() => onMarcarStatusRevisao(item.id, 'dominado')} leftIcon={<Check className="w-3.5 h-3.5" />}>
                        Marcar Dominado
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => onMarcarStatusRevisao(item.id, 'em_revisao')}>
                        Reabrir
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => onDeleteCadernoErro(item.id)} className="text-rose-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={editingItem ? "Editar Registro no Caderno de Erros" : "Novo Registro no Caderno de Erros"}
        maxWidth="md"
      >
        <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold mb-1">Disciplina *</label>
            <select
              value={formDisciplinaId}
              onChange={(e) => setFormDisciplinaId(e.target.value)}
              className="w-full p-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              {disciplinas.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-bold mb-1">Motivo do Erro *</label>
            <select
              value={formMotivo}
              onChange={(e) => setFormMotivo(e.target.value as MotivoErro)}
              className="w-full p-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              {Object.entries(MOTIVOS_CONFIG).map(([k, cfg]) => <option key={k} value={k}>{cfg.icon} {cfg.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-bold mb-1">Link da Questão (URL)</label>
            <input
              type="url"
              value={formQuestionUrl}
              onChange={(e) => setFormQuestionUrl(e.target.value)}
              placeholder="Ex: https://www.qconcursos.com/questoes-de-concursos/questoes/..."
              className="w-full p-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>
          <div>
            <label className="block font-bold mb-1">Enunciado ou Trecho da Questão *</label>
            <textarea
              rows={3}
              value={formStatement}
              onChange={(e) => setFormStatement(e.target.value)}
              placeholder="Cole o trecho da questão..."
              className="w-full p-2.5 rounded border bg-white dark:bg-slate-900"
              required
            />
          </div>
          <div>
            <label className="block font-bold mb-1">Análise: Por que errei e qual a regra? *</label>
            <textarea
              rows={3}
              value={formObservation}
              onChange={(e) => setFormObservation(e.target.value)}
              placeholder="Descreva o ponto de atenção..."
              className="w-full p-2.5 rounded border bg-white dark:bg-slate-900"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>Salvar Erro</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
