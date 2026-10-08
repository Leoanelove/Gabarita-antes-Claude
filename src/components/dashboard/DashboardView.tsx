import React, { useState } from 'react';
import { 
  Flame, 
  Clock, 
  CheckCircle2, 
  Calendar, 
  BookOpen, 
  Play, 
  Check, 
  Award, 
  ChevronRight, 
  Target, 
  FileText, 
  AlertCircle, 
  Plus, 
  CalendarClock 
} from 'lucide-react';
import { 
  Concurso, 
  Disciplina, 
  Assunto, 
  Revisao, 
  Meta, 
  UserProfile, 
  NavigationTab, 
  SessaoEstudo, 
  StudyPlan 
} from '../../types';
import { Card, CardHeader, CardBody } from '../../design-system/Card';
import { Button } from '../../design-system/Button';
import { Badge } from '../../design-system/Badge';
import { StudyCharts } from './StudyCharts';
import { StreakCalendarModal } from './StreakCalendarModal';
import { EmptyContestState } from '../common/EmptyContestState';

interface DashboardViewProps {
  user: UserProfile;
  concursos: Concurso[];
  disciplinas: Disciplina[];
  assuntos: Assunto[];
  sessoes: SessaoEstudo[];
  revisoes: Revisao[];
  metas: Meta[];
  plan?: StudyPlan | null;
  isLoading?: boolean;
  errorMessage?: string | null;
  onNavigateTab: (tab: NavigationTab) => void;
  onOpenStudyTimer: (preSelectedDisciplinaId?: string, preSelectedAssuntoId?: string) => void;
  onCompleteRevisao: (id: string, rating: 'facil' | 'medio' | 'dificil') => void;
  onRetry?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  concursos,
  disciplinas,
  assuntos,
  sessoes,
  revisoes,
  metas,
  plan,
  isLoading = false,
  errorMessage = null,
  onNavigateTab,
  onOpenStudyTimer,
  onCompleteRevisao,
  onRetry,
}) => {
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
        <div className="h-44 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-rose-900 dark:text-rose-100">
          Não foi possível carregar os dados do painel
        </h3>
        <p className="text-sm text-rose-700 dark:text-rose-300">{errorMessage}</p>
        {onRetry && (
          <Button variant="primary" onClick={onRetry} size="md">
            Tentar Novamente
          </Button>
        )}
      </div>
    );
  }

  const activeConcurso = concursos.find(c => c.active) || 
    concursos.find(c => c.id === user.targetConcursoId) || 
    concursos[0] || null;

  if (!activeConcurso) {
    return (
      <EmptyContestState
        title="Você ainda não possui um concurso ativo"
        description="Cadastre seu concurso foco e importe o conteúdo programático do edital (com auxílio da Inteligência Artificial ou manualmente) para desbloquear seu Painel Geral de Estudos, métricas em tempo real, Ciclo Inteligente e Revisões Espaçadas."
        actionText="Cadastrar Concurso Foco"
        onAction={() => onNavigateTab('concursos')}
      />
    );
  }

  const getDaysRemaining = (examDate?: string) => {
    if (!examDate) return null;
    const exam = new Date(examDate).getTime();
    const now = new Date().getTime();
    return Math.ceil((exam - now) / (1000 * 60 * 60 * 24));
  };
  const daysRemaining = getDaysRemaining(activeConcurso?.examDate);

  const totalStudyMinutes = sessoes.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  const totalStudyHours = (totalStudyMinutes / 60).toFixed(1);

  const totalQuestionsAttempted = sessoes.reduce((acc, s) => acc + (s.questionsAttempted || 0), 0);
  const totalQuestionsCorrect = sessoes.reduce((acc, s) => acc + (s.questionsCorrect || 0), 0);
  const globalAccuracyRate = totalQuestionsAttempted > 0 
    ? Math.round((totalQuestionsCorrect / totalQuestionsAttempted) * 100) 
    : 0;

  const pendingRevisoes = revisoes.filter(r => r.status === 'pendente');

  const relevantAssuntos = activeConcurso 
    ? assuntos.filter(a => {
        const disc = disciplinas.find(d => d.id === a.disciplinaId);
        return disc && (!disc.concursoId || disc.concursoId === activeConcurso.id);
      })
    : assuntos;
  const completedTopicsCount = relevantAssuntos.filter(a => a.completed).length;
  const totalTopicsCount = relevantAssuntos.length;
  const editalProgressPercent = totalTopicsCount > 0 
    ? Math.round((completedTopicsCount / totalTopicsCount) * 100) 
    : 0;

  const nextAssuntoToStudy = relevantAssuntos.find(a => !a.completed) || relevantAssuntos[0];
  const nextDisciplina = nextAssuntoToStudy 
    ? disciplinas.find(d => d.id === nextAssuntoToStudy.disciplinaId) 
    : disciplinas[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {activeConcurso ? (
        <div className="card-banner banner-principal relative overflow-hidden rounded-2xl p-6 sm:p-8 text-white shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge-ativo px-2.5 py-0.5 rounded-full text-xs font-bold">
                  Concurso Ativo
                </span>
                <span className="text-xs font-semibold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                  Órgão: <strong className="text-white">{activeConcurso.organ}</strong>
                </span>
                <span className="text-xs font-semibold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                  Banca: <strong className="text-white">{activeConcurso.banca}</strong>
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
                {activeConcurso.title}
              </h2>
              <p className="text-sm text-slate-300">
                Cargo: <span className="cargo-destaque font-bold">{activeConcurso.role}</span> • Remuneração: {
                  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(activeConcurso.remuneration || 0)
                }
              </p>
              <div className="pt-2 max-w-lg space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300 flex items-center gap-1">
                    <Target className="progresso-icone w-3.5 h-3.5" />
                    Cobertura do Edital Verticalizado
                  </span>
                  <span className="progresso-texto font-bold">{editalProgressPercent}% ({completedTopicsCount}/{totalTopicsCount})</span>
                </div>
                <div className="progresso-trilho w-full h-2 bg-slate-800/80 rounded-full overflow-hidden border">
                  <div 
                    className="progresso-barra barra-progresso h-full rounded-full transition-all duration-700"
                    style={{ width: `${editalProgressPercent}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row md:flex-col items-start sm:items-center md:items-end gap-3 shrink-0">
              {daysRemaining !== null && (
                <div className="text-left md:text-right bg-slate-900/90 px-4 py-2.5 rounded-xl border border-white/20 backdrop-blur-sm dias-restantes-card shadow-lg">
                  <span className="text-[10px] uppercase tracking-wider text-white font-bold block opacity-95">
                    DIAS RESTANTES
                  </span>
                  <span className="text-2xl font-black font-mono text-white block">
                    {daysRemaining > 0 ? `${daysRemaining} dias` : daysRemaining === 0 ? 'É HOJE!' : 'Concluído'}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => onOpenStudyTimer()}
                  leftIcon={<Play className="w-4 h-4 fill-current" />}
                  className="shadow-md"
                >
                  Iniciar Estudo
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => onNavigateTab('concursos')}
                  className="btn-banner-secundario text-white !text-white border border-white/30 !border-white/30 hover:bg-white/10 hover:!bg-white/10"
                >
                  Mudar Concurso
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-center space-y-3 bg-white/50 dark:bg-slate-900/40">
          <Target className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Nenhum Concurso Definido como Alvo
          </h3>
          <Button
            variant="primary"
            size="md"
            onClick={() => onNavigateTab('concursos')}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Cadastrar Concurso Foco
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card hoverEffect className="card-metric-hours border-l-4">
          <CardBody className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Horas Estudadas</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">{totalStudyHours}h</h3>
              <p className="card-metric-hours-text text-[11px] font-medium mt-0.5">{sessoes.length} sessões</p>
            </div>
            <div className="card-metric-hours-icon-bg w-12 h-12 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </CardBody>
        </Card>
        <Card hoverEffect className="border-l-4 border-l-sky-500">
          <CardBody className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Questões & Acertos</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">{globalAccuracyRate}%</h3>
              <p className="text-[11px] text-sky-600 dark:text-sky-400 font-medium mt-0.5">{totalQuestionsCorrect}/{totalQuestionsAttempted} acertos</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-500">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardBody>
        </Card>
        <Card 
          hoverEffect 
          role="button"
          tabIndex={0}
          onClick={() => setIsStreakModalOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsStreakModalOpen(true);
            }
          }}
          className="border-l-4 border-l-orange-500 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-500/50"
        >
          <CardBody className="p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Sequência (Streak)</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 font-semibold">Ver histórico</span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">{user.streakDays} dias</h3>
              <p className="text-[11px] text-orange-600 dark:text-orange-400 font-medium mt-0.5">Ritmo contínuo • Clique para abrir</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
              <Flame className="w-6 h-6" />
            </div>
          </CardBody>
        </Card>
        <Card hoverEffect className="border-l-4 border-l-purple-500">
          <CardBody className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Revisões Pendentes</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">{pendingRevisoes.length}</h3>
              <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium mt-0.5">Para hoje</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
              <Award className="w-6 h-6" />
            </div>
          </CardBody>
        </Card>
      </div>

      {plan && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500">
              <CalendarClock className="w-5 h-5" />
            </span>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Cronograma Inteligente ({plan.concursoTitle})
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {plan.sessions.filter(s => s.status === 'concluida').length} de {plan.sessions.length} sessões concluídas
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateTab('plano')}
            rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
          >
            Acessar Plano
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {nextAssuntoToStudy && nextDisciplina && (
            <Card className="proximo-estudo-card border">
              <CardBody className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="proximo-estudo-tag text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                      Próximo Estudo Recomendado
                    </span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {nextDisciplina.name}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {nextAssuntoToStudy.name}
                  </h4>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => onOpenStudyTimer(nextDisciplina.id, nextAssuntoToStudy.id)}
                  leftIcon={<Play className="w-4 h-4 fill-current" />}
                  className="shrink-0"
                >
                  Estudar Agora
                </Button>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Rendimento & Histórico de Estudos" />
            <CardBody className="p-5">
              <StudyCharts sessoes={sessoes} disciplinas={disciplinas} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Fila de Revisões Espaçadas de Hoje"
              action={
                <Button size="sm" variant="ghost" onClick={() => onNavigateTab('revisoes')} rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>
                  Ver Todas
                </Button>
              }
            />
            <CardBody className="p-0 divide-y divide-slate-100 dark:divide-slate-800">
              {pendingRevisoes.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Nenhuma revisão pendente para hoje!
                  </p>
                </div>
              ) : (
                pendingRevisoes.slice(0, 4).map((rev) => (
                  <div key={rev.id} className="p-4 sm:p-5 flex items-center justify-between gap-3">
                    <div>
                      <Badge variant="purple" size="sm">Ciclo {rev.method}</Badge>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">{rev.assuntoName}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="primary" onClick={() => onCompleteRevisao(rev.id, 'facil')}>
                        Concluir
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Metas de Estudo"
              action={
                <Button size="sm" variant="ghost" onClick={() => onNavigateTab('metas')} rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>
                  Ver Metas
                </Button>
              }
            />
            <CardBody className="p-4 sm:p-5 space-y-4">
              {metas.slice(0, 3).map((meta) => {
                const percent = Math.min(100, Math.round((meta.currentValue / meta.targetValue) * 100));
                return (
                  <div key={meta.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="flex items-start justify-between">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{meta.title}</h4>
                      <Badge variant={percent >= 100 ? 'emerald' : 'amber'} size="sm">{percent}%</Badge>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Modal de Calendário de Constância (Streak) */}
      <StreakCalendarModal
        isOpen={isStreakModalOpen}
        onClose={() => setIsStreakModalOpen(false)}
        streakDays={user.streakDays}
        sessoes={sessoes}
      />
    </div>
  );
};
