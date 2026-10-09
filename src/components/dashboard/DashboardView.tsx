import React, { useState, useMemo, useEffect } from 'react';
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
  CalendarClock,
  Pencil 
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
import { Modal } from '../../design-system/Modal';
import { useTheme } from '../../contexts/ThemeContext';
import { PlannerService } from '../../services/plannerService';
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
  const { palette } = useTheme();
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Identificação do concurso ativo para persistência de metas
  const activeConcursoId = useMemo(() => {
    return concursos.find(c => c.active)?.id || 
      concursos.find(c => c.id === user.targetConcursoId)?.id || 
      concursos[0]?.id || 'default';
  }, [concursos, user.targetConcursoId]);

  // Metas semanais persistidas no localStorage por concurso (padrão: 12h e 500 questões)
  const [weeklyGoals, setWeeklyGoals] = useState<{ hours: number; questions: number }>(() => {
    try {
      const activeId = concursos.find(c => c.active)?.id || 
        concursos.find(c => c.id === user.targetConcursoId)?.id || 
        concursos[0]?.id || 'default';
      const saved = localStorage.getItem(`gabarita_metas_semanais_${activeId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          hours: Number(parsed.hours) || 12,
          questions: Number(parsed.questions) || 500,
        };
      }
    } catch {
      // fallback padrão
    }
    return { hours: 12, questions: 500 };
  });

  const [modalHours, setModalHours] = useState<string>(() => String(weeklyGoals.hours));
  const [modalQuestions, setModalQuestions] = useState<string>(() => String(weeklyGoals.questions));

  // Sincroniza metas quando o concurso ativo mudar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`gabarita_metas_semanais_${activeConcursoId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const next = {
          hours: Number(parsed.hours) || 12,
          questions: Number(parsed.questions) || 500,
        };
        setWeeklyGoals(next);
        setModalHours(String(next.hours));
        setModalQuestions(String(next.questions));
        return;
      }
    } catch {
      // ignore
    }
    setWeeklyGoals({ hours: 12, questions: 500 });
    setModalHours('12');
    setModalQuestions('500');
  }, [activeConcursoId]);

  // Cálculo dinâmico das horas e questões realizadas na semana atual (iniciando na segunda-feira)
  const { minutosSemana, questoesSemana } = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const mondayStr = PlannerService.formatLocalDate(monday);

    let mins = 0;
    let questions = 0;

    sessoes.forEach((s) => {
      const sDate = s.completedAt ? s.completedAt.split('T')[0] : (s.createdAt ? s.createdAt.split('T')[0] : '');
      if (sDate >= mondayStr) {
        mins += s.durationMinutes || 0;
        questions += s.questionsAttempted || 0;
      }
    });

    try {
      const rawBlocos = localStorage.getItem('gabarita_blocos_questoes');
      if (rawBlocos) {
        const blocos = JSON.parse(rawBlocos);
        if (Array.isArray(blocos)) {
          blocos.forEach((b: any) => {
            const bDate = b.date || (b.createdAt ? b.createdAt.split('T')[0] : '');
            if (bDate >= mondayStr) {
              questions += Number(b.totalQuestions) || 0;
            }
          });
        }
      }
    } catch {
      // ignore
    }

    return { minutosSemana: mins, questoesSemana: questions };
  }, [sessoes]);
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

  const formatHorasMinutos = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = Math.floor(totalMinutes % 60);
    return `${h}h${m.toString().padStart(2, '0')}min`;
  };

  const percentHoras = weeklyGoals.hours > 0 
    ? Math.min(100, Math.round((minutosSemana / (weeklyGoals.hours * 60)) * 100)) 
    : 0;
  const percentQuestoes = weeklyGoals.questions > 0 
    ? Math.min(100, Math.round((questoesSemana / weeklyGoals.questions) * 100)) 
    : 0;

  const handleOpenEditModal = () => {
    setModalHours(String(weeklyGoals.hours));
    setModalQuestions(String(weeklyGoals.questions));
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setModalHours(String(weeklyGoals.hours));
    setModalQuestions(String(weeklyGoals.questions));
    setIsEditModalOpen(false);
  };

  const handleSaveMetas = (e: React.FormEvent) => {
    e.preventDefault();
    const numHours = Math.max(1, Number(modalHours) || 12);
    const numQuestions = Math.max(1, Number(modalQuestions) || 500);
    const newGoals = { hours: numHours, questions: numQuestions };
    setWeeklyGoals(newGoals);
    try {
      localStorage.setItem(`gabarita_metas_semanais_${activeConcursoId}`, JSON.stringify(newGoals));
    } catch (err) {
      console.warn('Erro ao salvar metas semanais no localStorage:', err);
    }
    setIsEditModalOpen(false);
  };

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
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
            <div className="p-4 sm:p-5 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                METAS DE ESTUDO SEMANAL
              </h3>
              <button
                type="button"
                onClick={handleOpenEditModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Editar Metas Semanais"
                aria-label="Editar Metas Semanais"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-5">
              {/* Barra 1: Horas de Estudo */}
              <div className="space-y-1.5">
                <div className="flex items-center text-xs">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    {formatHorasMinutos(minutosSemana)} / {formatHorasMinutos(weeklyGoals.hours * 60)}
                  </span>
                  <span className="font-bold text-xs ml-1" style={{ color: palette.primary }}>
                    • {percentHoras}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800/90 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentHoras}%`,
                        backgroundColor: palette.primary,
                      }}
                    />
                  </div>
                  <span className="text-slate-700 dark:text-slate-300 font-semibold text-xs shrink-0 min-w-[100px] text-right">
                    Horas de Estudo
                  </span>
                </div>
              </div>

              {/* Barra 2: Questões */}
              <div className="space-y-1.5">
                <div className="flex items-center text-xs">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    {questoesSemana} / {weeklyGoals.questions}
                  </span>
                  <span className="font-bold text-xs ml-1" style={{ color: palette.primary }}>
                    • {percentQuestoes}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800/90 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentQuestoes}%`,
                        backgroundColor: palette.primary,
                      }}
                    />
                  </div>
                  <span className="text-slate-700 dark:text-slate-300 font-semibold text-xs shrink-0 min-w-[100px] text-right">
                    Questões
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Calendário de Constância (Streak) */}
      <StreakCalendarModal
        isOpen={isStreakModalOpen}
        onClose={() => setIsStreakModalOpen(false)}
        streakDays={user.streakDays}
        sessoes={sessoes}
      />

      {/* Modal de Configuração de Metas Semanais (Sem sair da página) */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        title="Configurar Metas de Estudo Semanal"
        description="Defina suas metas de horas líquidas e questões para a semana atual."
        maxWidth="md"
      >
        <form onSubmit={handleSaveMetas} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Meta Semanal de Horas
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                min="1"
                max="168"
                step="1"
                value={modalHours}
                onChange={(e) => setModalHours(e.target.value)}
                placeholder="12"
                required
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Meta de Horas Líquidas para a Semana
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Meta Semanal de Questões
            </label>
            <div className="relative">
              <Target className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                min="1"
                max="5000"
                step="1"
                value={modalQuestions}
                onChange={(e) => setModalQuestions(e.target.value)}
                placeholder="500"
                required
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Total de questões para resolver na semana
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleCloseEditModal}
            >
              Cancelar
            </Button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all shadow-md hover:brightness-110 active:scale-95 cursor-pointer"
              style={{
                backgroundColor: palette.primary,
                boxShadow: `0 0 12px ${palette.glowColor || 'rgba(16, 185, 129, 0.4)'}`
              }}
            >
              Salvar Metas
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
