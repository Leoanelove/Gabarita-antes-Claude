import React, { useState, useMemo } from 'react';
import { 
  HelpCircle, 
  CheckCircle2, 
  XCircle, 
  BookOpen, 
  Filter, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Edit2, 
  BarChart3, 
  History, 
  Target, 
  BookX, 
  Percent 
} from 'lucide-react';
import { 
  Questao, 
  Disciplina, 
  Assunto, 
  RegistroBlocoQuestoes, 
  QuestionDifficulty, 
  ItemCadernoErros, 
  ErroStatusRevisao 
} from '../../types';
import { Card, CardHeader, CardBody } from '../../design-system/Card';
import { Button } from '../../design-system/Button';
import { Badge } from '../../design-system/Badge';
import { Modal } from '../../design-system/Modal';
import { PlannerService } from '../../services/plannerService';
import { CadernoErrosView } from './CadernoErrosView';
import { EmptyContestState } from '../common/EmptyContestState';

interface QuestoesViewProps {
  questoes: Questao[];
  disciplinas: Disciplina[];
  assuntos: Assunto[];
  blocosQuestoes: RegistroBlocoQuestoes[];
  cadernoErros?: ItemCadernoErros[];
  onNavigateTab?: (tab: any) => void;
  onRecordBlocoQuestoes: (bloco: Omit<RegistroBlocoQuestoes, 'id' | 'createdAt' | 'wrongAnswers' | 'accuracyRate'>) => Promise<void>;
  onDeleteBlocoQuestoes: (blocoId: string) => Promise<void>;
  onUpdateBlocoQuestoes: (blocoId: string, partial: Partial<RegistroBlocoQuestoes>) => Promise<void>;
  onAddCadernoErro?: (item: Omit<ItemCadernoErros, 'id' | 'createdAt' | 'updatedAt' | 'reincidenciaCount'> & { reincidenciaCount?: number }) => Promise<void>;
  onUpdateCadernoErro?: (id: string, partial: Partial<ItemCadernoErros>) => Promise<void>;
  onDeleteCadernoErro?: (id: string) => Promise<void>;
  onIncrementarReincidencia?: (id: string) => Promise<void>;
  onMarcarStatusRevisao?: (id: string, status: ErroStatusRevisao) => Promise<void>;
  onIniciarRevisaoAssunto?: (disciplinaId: string, assuntoName: string, notes?: string) => Promise<void>;
  onOpenStudyTimer?: (disciplinaId?: string, assuntoId?: string) => void;
}

type QuestoesTab = 'registro' | 'historico' | 'caderno' | 'desempenho';

export const QuestoesView: React.FC<QuestoesViewProps> = ({
  questoes,
  disciplinas,
  assuntos,
  blocosQuestoes,
  cadernoErros = [],
  onRecordBlocoQuestoes,
  onDeleteBlocoQuestoes,
  onUpdateBlocoQuestoes,
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
        description="Cadastre seu concurso foco e adicione ou importe as matérias do edital para registrar simulados e blocos de resolução de questões."
        actionText="Cadastrar Concurso e Matérias"
        onAction={() => onNavigateTab ? onNavigateTab('concursos') : null}
      />
    );
  }

  const [activeTab, setActiveTab] = useState<QuestoesTab>('registro');
  const [formDisciplinaId, setFormDisciplinaId] = useState(disciplinas[0]?.id || '');
  const [formAssuntoId, setFormAssuntoId] = useState('');
  const [formBanca, setFormBanca] = useState('FGV');
  const [formDifficulty, setFormDifficulty] = useState<QuestionDifficulty>('media');
  const [formTotalQuestions, setFormTotalQuestions] = useState<number>(20);
  const [formCorrectAnswers, setFormCorrectAnswers] = useState<number>(16);
  const [formDoubtCount, setFormDoubtCount] = useState<number>(2);
  const [formDate, setFormDate] = useState(PlannerService.formatLocalDate(new Date()));
  const [formDurationMinutes, setFormDurationMinutes] = useState<number>(40);
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingBloco, setEditingBloco] = useState<RegistroBlocoQuestoes | null>(null);
  const [editCorrect, setEditCorrect] = useState<number>(0);
  const [editTotal, setEditTotal] = useState<number>(0);
  const [editDoubts, setEditDoubts] = useState<number>(0);
  const [editNotes, setEditNotes] = useState('');

  const [feedback, setFeedback] = useState<string | null>(null);
  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const calculatedWrongs = Math.max(0, formTotalQuestions - formCorrectAnswers);
  const liveAccuracy = formTotalQuestions > 0 ? Math.round((formCorrectAnswers / formTotalQuestions) * 100) : 0;

  const availableAssuntos = useMemo(() => {
    return assuntos.filter(a => a.disciplinaId === formDisciplinaId);
  }, [assuntos, formDisciplinaId]);

  const metrics = useMemo(() => {
    const totalQuestions = blocosQuestoes.reduce((acc, b) => acc + b.totalQuestions, 0);
    const totalCorrect = blocosQuestoes.reduce((acc, b) => acc + b.correctAnswers, 0);
    const totalWrong = blocosQuestoes.reduce((acc, b) => acc + b.wrongAnswers, 0);
    const totalDoubts = blocosQuestoes.reduce((acc, b) => acc + (b.doubtCount || 0), 0);
    const overallAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    return { totalQuestions, totalCorrect, totalWrong, totalDoubts, overallAccuracy };
  }, [blocosQuestoes]);

  const statsByDisciplina = useMemo(() => {
    const map: Record<string, { name: string; total: number; correct: number; color: string }> = {};
    disciplinas.forEach(d => {
      map[d.id] = { name: d.name, total: 0, correct: 0, color: d.color };
    });
    blocosQuestoes.forEach(b => {
      if (map[b.disciplinaId]) {
        map[b.disciplinaId].total += b.totalQuestions;
        map[b.disciplinaId].correct += b.correctAnswers;
      }
    });
    return Object.entries(map).map(([id, val]) => ({
      id,
      name: val.name,
      color: val.color,
      total: val.total,
      correct: val.correct,
      rate: val.total > 0 ? Math.round((val.correct / val.total) * 100) : 0,
    })).filter(item => item.total > 0);
  }, [disciplinas, blocosQuestoes]);

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const disc = disciplinas.find(d => d.id === formDisciplinaId);
    if (!disc) return;
    setIsSubmitting(true);
    try {
      const top = assuntos.find(a => a.id === formAssuntoId);
      await onRecordBlocoQuestoes({
        userId: 'user_demo_01',
        disciplinaId: disc.id,
        disciplinaName: disc.name,
        assuntoId: top?.id,
        assuntoName: top?.name || 'Estudo Geral',
        banca: formBanca,
        difficulty: formDifficulty,
        totalQuestions: Number(formTotalQuestions),
        correctAnswers: Number(formCorrectAnswers),
        doubtCount: Number(formDoubtCount) || 0,
        date: formDate,
        durationMinutes: formDurationMinutes > 0 ? Number(formDurationMinutes) : undefined,
        notes: formNotes,
      });
      showFeedback(`Bateria de ${formTotalQuestions} questões registrada!`);
      setFormNotes('');
      setActiveTab('historico');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {feedback && (
        <div className="p-3.5 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-400">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 bg-white dark:bg-slate-900 border rounded-2xl">
          <span className="text-slate-400 text-xs">Resolvidas</span>
          <div className="text-2xl font-black font-mono">{metrics.totalQuestions}</div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-emerald-200 rounded-2xl">
          <span className="text-emerald-500 text-xs font-semibold">Acertos</span>
          <div className="text-2xl font-black font-mono text-emerald-500">{metrics.totalCorrect}</div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-rose-200 rounded-2xl">
          <span className="text-rose-500 text-xs font-semibold">Erros</span>
          <div className="text-2xl font-black font-mono text-rose-500">{metrics.totalWrong}</div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-amber-200 rounded-2xl">
          <span className="text-amber-500 text-xs font-semibold">Dúvidas</span>
          <div className="text-2xl font-black font-mono text-amber-500">{metrics.totalDoubts}</div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-purple-200 rounded-2xl col-span-2 sm:col-span-1">
          <span className="text-purple-500 text-xs font-semibold">Aproveitamento</span>
          <div className="text-2xl font-black font-mono text-purple-500">{metrics.overallAccuracy}%</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto text-xs">
        <button onClick={() => setActiveTab('registro')} className={`px-4 py-2 rounded-lg font-bold cursor-pointer transition-all ${activeTab === 'registro' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'}`}>Registrar Bloco</button>
        <button onClick={() => setActiveTab('historico')} className={`px-4 py-2 rounded-lg font-bold cursor-pointer transition-all ${activeTab === 'historico' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'}`}>Histórico ({blocosQuestoes.length})</button>
        <button onClick={() => setActiveTab('caderno')} className={`px-4 py-2 rounded-lg font-bold cursor-pointer transition-all ${activeTab === 'caderno' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-500 hover:text-rose-700'}`}>Caderno de Erros ({cadernoErros.length})</button>
        <button onClick={() => setActiveTab('desempenho')} className={`px-4 py-2 rounded-lg font-bold cursor-pointer transition-all ${activeTab === 'desempenho' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'}`}>Desempenho</button>
      </div>

      {activeTab === 'registro' && (
        <Card>
          <CardHeader title="Lançamento Rápido de Bateria de Questões" />
          <CardBody className="p-6">
            <form onSubmit={handleSaveBatch} className="space-y-4 max-w-2xl text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Disciplina *</label>
                  <select
                    value={formDisciplinaId}
                    onChange={(e) => setFormDisciplinaId(e.target.value)}
                    className="w-full p-2.5 rounded border bg-white dark:bg-slate-900"
                  >
                    {disciplinas.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Banca</label>
                  <select
                    value={formBanca}
                    onChange={(e) => setFormBanca(e.target.value)}
                    className="w-full p-2.5 rounded border bg-white dark:bg-slate-900"
                  >
                    <option value="FGV">FGV</option>
                    <option value="Cebraspe">Cebraspe</option>
                    <option value="FCC">FCC</option>
                    <option value="Vunesp">Vunesp</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <div>
                  <label className="block font-bold mb-1">Total Questões</label>
                  <input
                    type="number"
                    value={formTotalQuestions}
                    onChange={(e) => setFormTotalQuestions(parseInt(e.target.value, 10) || 0)}
                    className="w-full p-2 rounded border bg-white dark:bg-slate-900 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-emerald-600 mb-1">Acertos</label>
                  <input
                    type="number"
                    value={formCorrectAnswers}
                    onChange={(e) => setFormCorrectAnswers(parseInt(e.target.value, 10) || 0)}
                    className="w-full p-2 rounded border border-emerald-400 bg-white dark:bg-slate-900 font-mono font-bold text-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-rose-600 mb-1">Erros</label>
                  <div className="p-2 font-mono font-bold text-rose-600">{calculatedWrongs}</div>
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Anotações</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full p-2 rounded border bg-white dark:bg-slate-900 resize-none"
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" variant="primary" isLoading={isSubmitting}>Registrar Bateria</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {activeTab === 'historico' && (
        <Card>
          <CardHeader title="Histórico de Treinos" />
          <CardBody className="p-0 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {blocosQuestoes.map(b => (
              <div key={b.id} className="p-4 flex items-center justify-between">
                <div>
                  <span className="font-bold">{b.disciplinaName}</span> • <span className="text-purple-600">{b.banca}</span>
                  <p className="text-slate-500">{b.assuntoName}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono">{b.correctAnswers}/{b.totalQuestions} ({b.accuracyRate}%)</span>
                  <button onClick={() => onDeleteBlocoQuestoes(b.id)} className="text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {activeTab === 'caderno' && (
        <CadernoErrosView
          cadernoErros={cadernoErros}
          disciplinas={disciplinas}
          assuntos={assuntos}
          questoes={questoes}
          blocosQuestoes={blocosQuestoes}
          onAddCadernoErro={onAddCadernoErro || (async () => {})}
          onUpdateCadernoErro={onUpdateCadernoErro || (async () => {})}
          onDeleteCadernoErro={onDeleteCadernoErro || (async () => {})}
          onIncrementarReincidencia={onIncrementarReincidencia || (async () => {})}
          onMarcarStatusRevisao={onMarcarStatusRevisao || (async () => {})}
          onIniciarRevisaoAssunto={onIniciarRevisaoAssunto}
          onOpenStudyTimer={onOpenStudyTimer}
        />
      )}

      {activeTab === 'desempenho' && (
        <Card>
          <CardHeader title="Desempenho por Matéria" />
          <CardBody className="p-5 space-y-3">
            {statsByDisciplina.map(item => (
              <div key={item.id} className="space-y-1 text-xs">
                <div className="flex justify-between font-bold">
                  <span>{item.name}</span>
                  <span>{item.correct}/{item.total} ({item.rate}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${item.rate}%` }} />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
};
