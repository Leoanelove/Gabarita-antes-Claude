import React, { useState, useMemo } from 'react';
import { 
  Repeat, 
  Calendar, 
  Check, 
  Clock, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  BookOpen, 
  Filter, 
  Sliders, 
  RotateCcw, 
  Zap, 
  Smile, 
  Meh, 
  Frown, 
  Target, 
  CalendarClock, 
  CheckCheck 
} from 'lucide-react';
import { 
  Revisao, 
  Disciplina, 
  Assunto, 
  RevisionSettings, 
  RevisionRating, 
  RevisionMethod 
} from '../../types';
import { Card, CardHeader, CardBody } from '../../design-system/Card';
import { Button } from '../../design-system/Button';
import { Badge } from '../../design-system/Badge';
import { Modal } from '../../design-system/Modal';
import { PlannerService } from '../../services/plannerService';
import { EmptyContestState } from '../common/EmptyContestState';

interface RevisoesViewProps {
  revisoes: Revisao[];
  disciplinas: Disciplina[];
  assuntos?: Assunto[];
  settings?: RevisionSettings;
  onNavigateTab?: (tab: any) => void;
  onCompleteRevisao: (
    id: string, 
    rating: RevisionRating, 
    accuracyRate?: number, 
    questionsAttempted?: number, 
    questionsCorrect?: number, 
    notes?: string
  ) => Promise<void>;
  onAddRevisao: (rev: {
    disciplinaId: string;
    assuntoId?: string;
    assuntoName: string;
    method: RevisionMethod;
    scheduledFor: string;
    notes?: string;
    isAutomatic?: boolean;
    stage?: number;
    intervalDays?: number;
  }) => Promise<void>;
  onUpdateRevisao?: (id: string, partial: Partial<Revisao>) => Promise<void>;
  onDeleteRevisao?: (id: string) => Promise<void>;
  onBatchRescheduleOverdue?: (targetDateStr?: string) => Promise<void>;
  onUpdateSettings?: (settings: Partial<RevisionSettings>) => Promise<void>;
  onOpenStudyTimer?: (disciplinaId?: string, assuntoId?: string) => void;
}

type TimelineTab = 'hoje' | 'atrasadas' | 'proximas' | 'concluidas' | 'config';

export const RevisoesView: React.FC<RevisoesViewProps> = ({
  revisoes,
  disciplinas,
  assuntos = [],
  settings = {
    autoScheduleOnStudy: true,
    autoScheduleOnQuestions: true,
    intervalDays: [1, 7, 15, 30, 60],
    performanceAdaptive: true,
    easeMultiplier: 1.8,
    hardPenaltyDays: 1,
  },
  onCompleteRevisao,
  onAddRevisao,
  onBatchRescheduleOverdue,
  onUpdateSettings,
  onOpenStudyTimer,
  onNavigateTab,
}) => {
  if (disciplinas.length === 0) {
    return (
      <EmptyContestState
        title="Você ainda não possui disciplinas para revisão"
        description="Cadastre seu concurso foco e importe as matérias para ativar o motor inteligente de Repetição Espaçada (SRS 24h, 7d, 15d, 30d)."
        actionText="Cadastrar Concurso e Matérias"
        onAction={() => onNavigateTab ? onNavigateTab('concursos') : null}
      />
    );
  }

  const [activeTab, setActiveTab] = useState<TimelineTab>('hoje');
  const [selectedDiscFilter, setSelectedDiscFilter] = useState('todas');
  const [feedback, setFeedback] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [completingRev, setCompletingRev] = useState<Revisao | null>(null);

  const [formDisciplinaId, setFormDisciplinaId] = useState(disciplinas[0]?.id || '');
  const [formAssuntoId, setFormAssuntoId] = useState('');
  const [formAssuntoName, setFormAssuntoName] = useState('');
  const [formMethod, setFormMethod] = useState<RevisionMethod>('24h');
  const [formScheduledFor, setFormScheduledFor] = useState(PlannerService.formatLocalDate(new Date()));
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [completionRating, setCompletionRating] = useState<RevisionRating>('facil');
  const [qAttempted, setQAttempted] = useState<number>(0);
  const [qCorrect, setQCorrect] = useState<number>(0);
  const [completionNotes, setCompletionNotes] = useState('');

  const [configAutoStudy, setConfigAutoStudy] = useState(settings.autoScheduleOnStudy);
  const [configAutoQuestions, setConfigAutoQuestions] = useState(settings.autoScheduleOnQuestions);
  const [configAdaptive, setConfigAdaptive] = useState(settings.performanceAdaptive);
  const [configIntervalsStr, setConfigIntervalsStr] = useState(settings.intervalDays.join(', '));
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const todayStr = PlannerService.formatLocalDate(new Date());

  const availableAssuntos = useMemo(() => {
    return assuntos.filter(a => a.disciplinaId === formDisciplinaId);
  }, [assuntos, formDisciplinaId]);

  const categorized = useMemo(() => {
    const list = revisoes.filter(r => {
      if (selectedDiscFilter === 'todas') return true;
      return r.disciplinaId === selectedDiscFilter;
    });
    const hoje: Revisao[] = [];
    const atrasadas: Revisao[] = [];
    const proximas: Revisao[] = [];
    const concluidas: Revisao[] = [];

    list.forEach(r => {
      const sDate = r.scheduledFor.includes('T') ? r.scheduledFor.split('T')[0] : r.scheduledFor;
      if (r.status === 'concluida') concluidas.push(r);
      else if (r.status === 'atrasada' || sDate < todayStr) atrasadas.push(r);
      else if (sDate === todayStr) hoje.push(r);
      else proximas.push(r);
    });
    return { hoje, atrasadas, proximas, concluidas };
  }, [revisoes, selectedDiscFilter, todayStr]);

  const srsStats = useMemo(() => {
    const total = revisoes.length;
    const totalConcluidas = revisoes.filter(r => r.status === 'concluida').length;
    const totalHoje = categorized.hoje.length;
    const totalAtrasadas = categorized.atrasadas.length;
    const totalProximas = categorized.proximas.length;
    const rated = revisoes.filter(r => r.status === 'concluida' && r.rating);
    const easyOrMed = rated.filter(r => r.rating === 'facil' || r.rating === 'medio').length;
    const retentionRate = rated.length > 0 ? Math.round((easyOrMed / rated.length) * 100) : 100;
    return { total, totalConcluidas, totalHoje, totalAtrasadas, totalProximas, retentionRate };
  }, [revisoes, categorized]);

  const handleConfirmCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingRev) return;
    setIsSubmitting(true);
    try {
      const accRate = qAttempted > 0 ? Math.round((qCorrect / qAttempted) * 100) : undefined;
      await onCompleteRevisao(
        completingRev.id,
        completionRating,
        accRate,
        qAttempted > 0 ? qAttempted : undefined,
        qAttempted > 0 ? qCorrect : undefined,
        completionNotes.trim() || undefined
      );
      showFeedback('Revisão concluída com sucesso! +30 XP.');
      setCompletingRev(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAddModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalAssunto = formAssuntoName.trim() || (assuntos.find(a => a.id === formAssuntoId)?.name) || 'Revisão Geral';
    setIsSubmitting(true);
    try {
      let intervalDays = 1;
      if (formMethod === '7d') intervalDays = 7;
      if (formMethod === '15d') intervalDays = 15;
      if (formMethod === '30d') intervalDays = 30;
      if (formMethod === '60d') intervalDays = 60;

      await onAddRevisao({
        disciplinaId: formDisciplinaId,
        assuntoId: formAssuntoId || undefined,
        assuntoName: finalAssunto,
        method: formMethod,
        scheduledFor: formScheduledFor,
        notes: formNotes.trim() || undefined,
        isAutomatic: false,
        stage: 1,
        intervalDays,
      });
      showFeedback('Revisão agendada com sucesso!');
      setIsAddModalOpen(false);
      setFormAssuntoName('');
      setFormNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateSettings) return;
    setIsSavingConfig(true);
    try {
      const parsedIntervals = configIntervalsStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
      await onUpdateSettings({
        autoScheduleOnStudy: configAutoStudy,
        autoScheduleOnQuestions: configAutoQuestions,
        performanceAdaptive: configAdaptive,
        intervalDays: parsedIntervals.length > 0 ? parsedIntervals : [1, 7, 15, 30, 60],
      });
      showFeedback('Configurações atualizadas!');
    } finally {
      setIsSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {feedback && (
        <div className="p-3.5 rounded-xl text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
          {feedback}
        </div>
      )}

      <div className="revisoes-banner bg-gradient-to-r from-purple-950/50 via-slate-900 to-emerald-950/40 border border-purple-800/40 rounded-3xl p-6 text-white shadow-md space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="revisoes-pill flex items-center gap-2">
              <Repeat className="revisoes-pill-icon w-4 h-4 text-purple-400" />
              <span className="revisoes-pill-text text-xs font-bold uppercase tracking-wider text-purple-300">Repetição Espaçada (SRS)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">Retenção Ativa & Curva de Esquecimento</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setActiveTab('config')} className="bg-white/10 text-white border-white/20 text-xs">
              Configurar
            </Button>
            <Button variant="primary" size="sm" onClick={() => setIsAddModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
              Agendar Revisão
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          <div className="p-3.5 bg-slate-900/80 border border-slate-700/60 rounded-2xl">
            <span className="text-sky-400 text-[11px] font-medium">Hoje</span>
            <div className="text-2xl font-black font-mono text-sky-400">{srsStats.totalHoje}</div>
          </div>
          <div className="p-3.5 bg-slate-900/80 border border-rose-900/50 rounded-2xl">
            <span className="text-rose-400 text-[11px] font-medium">Atrasadas</span>
            <div className="text-2xl font-black font-mono text-rose-400">{srsStats.totalAtrasadas}</div>
          </div>
          <div className="p-3.5 bg-slate-900/80 border border-slate-700/60 rounded-2xl">
            <span className="text-purple-300 text-[11px] font-medium">Próximas</span>
            <div className="text-2xl font-black font-mono text-purple-300">{srsStats.totalProximas}</div>
          </div>
          <div className="p-3.5 bg-slate-900/80 border border-emerald-900/50 rounded-2xl">
            <span className="text-emerald-400 text-[11px] font-medium">Concluídas</span>
            <div className="text-2xl font-black font-mono text-emerald-400">{srsStats.totalConcluidas}</div>
          </div>
          <div className="p-3.5 bg-slate-900/80 border border-slate-700/60 rounded-2xl col-span-2 sm:col-span-1">
            <span className="text-amber-300 text-[11px] font-medium">Retenção</span>
            <div className="text-2xl font-black font-mono text-amber-400">{srsStats.retentionRate}%</div>
          </div>
        </div>
      </div>

      <div className="revisoes-nav-tabs flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto text-xs">
        <button onClick={() => setActiveTab('hoje')} className={`px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${activeTab === 'hoje' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Hoje ({categorized.hoje.length})</button>
        <button onClick={() => setActiveTab('atrasadas')} className={`px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${activeTab === 'atrasadas' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Atrasadas ({categorized.atrasadas.length})</button>
        <button onClick={() => setActiveTab('proximas')} className={`px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${activeTab === 'proximas' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Próximas ({categorized.proximas.length})</button>
        <button onClick={() => setActiveTab('concluidas')} className={`px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${activeTab === 'concluidas' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Concluídas</button>
        <button onClick={() => setActiveTab('config')} className={`px-4 py-2 rounded-lg font-bold transition-all cursor-pointer ${activeTab === 'config' ? 'bg-slate-900 text-white shadow-xs revisao-tab-active-dark' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Configurações</button>
      </div>

      {activeTab === 'config' && (
        <Card>
          <CardHeader title="Configuração de Intervalos SRS" />
          <CardBody className="p-6">
            <form onSubmit={handleSaveSettings} className="space-y-4 max-w-lg text-xs">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={configAutoStudy} onChange={(e) => setConfigAutoStudy(e.target.checked)} />
                <span>Gerar revisão 24h automaticamente ao concluir sessão de estudo</span>
              </label>
              <div>
                <label className="block font-bold mb-1">Dias dos Ciclos (separados por vírgula)</label>
                <input type="text" value={configIntervalsStr} onChange={(e) => setConfigIntervalsStr(e.target.value)} className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
              </div>
              <Button type="submit" variant="primary" isLoading={isSavingConfig}>Salvar Configurações</Button>
            </form>
          </CardBody>
        </Card>
      )}

      {activeTab === 'hoje' && (
        <Card>
          <CardHeader title="Revisões para Hoje" />
          <CardBody className="p-0 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {categorized.hoje.length === 0 ? (
              <div className="p-12 text-center text-slate-400">Tudo em dia para hoje!</div>
            ) : (
              categorized.hoje.map(rev => (
                <div key={rev.id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{rev.disciplinaName}</span>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">{rev.assuntoName}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    {onOpenStudyTimer && (
                      <Button size="sm" variant="outline" onClick={() => onOpenStudyTimer(rev.disciplinaId, rev.assuntoId)} leftIcon={<Zap className="w-3.5 h-3.5" />}>
                        Estudar
                      </Button>
                    )}
                    <Button size="sm" variant="primary" onClick={() => setCompletingRev(rev)} leftIcon={<Check className="w-3.5 h-3.5" />}>
                      Concluir
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === 'atrasadas' && (
        <Card>
          <CardHeader title="Revisões Atrasadas" action={
            categorized.atrasadas.length > 0 && onBatchRescheduleOverdue ? (
              <Button size="sm" variant="primary" onClick={() => onBatchRescheduleOverdue(todayStr)} className="bg-rose-600">
                Reagendar para Hoje
              </Button>
            ) : undefined
          } />
          <CardBody className="p-0 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {categorized.atrasadas.length === 0 ? (
              <div className="p-12 text-center text-slate-400">Nenhuma revisão atrasada!</div>
            ) : (
              categorized.atrasadas.map(rev => (
                <div key={rev.id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{rev.disciplinaName}</span>
                    <h4 className="font-bold text-sm">{rev.assuntoName}</h4>
                  </div>
                  <Button size="sm" variant="primary" onClick={() => setCompletingRev(rev)}>Concluir</Button>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === 'proximas' && (
        <Card>
          <CardHeader title="Próximas Revisões" />
          <CardBody className="p-0 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {categorized.proximas.map(rev => (
              <div key={rev.id} className="p-4 flex items-center justify-between">
                <div>
                  <span className="font-bold">{rev.disciplinaName}</span>
                  <p className="text-slate-500">{rev.assuntoName}</p>
                </div>
                <span className="font-mono text-purple-600">{rev.scheduledFor}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {activeTab === 'concluidas' && (
        <Card>
          <CardHeader title="Histórico de Concluídas" />
          <CardBody className="p-0 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {categorized.concluidas.map(rev => (
              <div key={rev.id} className="p-4 flex items-center justify-between">
                <div>
                  <span className="font-bold">{rev.disciplinaName}</span>
                  <p className="text-slate-500">{rev.assuntoName}</p>
                </div>
                <Badge variant="emerald" size="sm">Concluída</Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Modal
        isOpen={!!completingRev}
        onClose={() => setCompletingRev(null)}
        title="Concluir Revisão SRS"
        maxWidth="md"
      >
        <form onSubmit={handleConfirmCompletion} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold mb-2">Como foi sua retenção?</label>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setCompletionRating('facil')} className={`p-3 rounded-xl border text-center ${completionRating === 'facil' ? 'border-emerald-500 bg-emerald-50' : ''}`}>
                <Smile className="w-6 h-6 mx-auto text-emerald-500" />
                <span className="font-bold">Fácil</span>
              </button>
              <button type="button" onClick={() => setCompletionRating('medio')} className={`p-3 rounded-xl border text-center ${completionRating === 'medio' ? 'border-amber-500 bg-amber-50' : ''}`}>
                <Meh className="w-6 h-6 mx-auto text-amber-500" />
                <span className="font-bold">Médio</span>
              </button>
              <button type="button" onClick={() => setCompletionRating('dificil')} className={`p-3 rounded-xl border text-center ${completionRating === 'dificil' ? 'border-rose-500 bg-rose-50' : ''}`}>
                <Frown className="w-6 h-6 mx-auto text-rose-500" />
                <span className="font-bold">Difícil</span>
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCompletingRev(null)}>Cancelar</Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>Confirmar</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Agendar Nova Revisão"
        maxWidth="md"
      >
        <form onSubmit={handleSaveAddModal} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold mb-1">Disciplina *</label>
            <select
              value={formDisciplinaId}
              onChange={(e) => setFormDisciplinaId(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              {disciplinas.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-bold mb-1">Assunto / Tópico *</label>
            <input
              type="text"
              value={formAssuntoName}
              onChange={(e) => setFormAssuntoName(e.target.value)}
              placeholder="Ex: Controle de Constitucionalidade"
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1">Método</label>
              <select
                value={formMethod}
                onChange={(e) => setFormMethod(e.target.value as RevisionMethod)}
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="24h">24 Horas</option>
                <option value="7d">7 Dias</option>
                <option value="15d">15 Dias</option>
                <option value="30d">30 Dias</option>
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">Data *</label>
              <input
                type="date"
                value={formScheduledFor}
                onChange={(e) => setFormScheduledFor(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>Agendar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
