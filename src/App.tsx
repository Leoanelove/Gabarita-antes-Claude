import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { 
  NavigationTab, 
  Concurso, 
  Disciplina, 
  Assunto, 
  Revisao, 
  Questao, 
  Meta, 
  Simulado, 
  UserProfile,
  StudySessionType,
  Prova,
  SessaoEstudo,
  TopicStatus,
  Subtopico,
  EditalAiImportPayload,
  StudyPlan,
  PlannedSession,
  WeeklyAvailability,
  PlanSessionStatus,
  StudyCycle,
  CycleBlock,
  RegistroBlocoQuestoes,
  ItemCadernoErros,
  ErroStatusRevisao,
  MotivoErro,
  RevisionSettings,
  RevisionRating,
  RevisionMethod,
  Conquista,
  MarcoEstudo,
  EstatisticasProgressoReal,
  UserPlan,
  StudyMethod
} from './types';
import { DatabaseService } from './services/db';
import { AuthPage } from './components/auth/AuthPage';
import { GezinhoLogo } from './components/common/GezinhoLogo';
import { Sidebar } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { MobileNav } from './components/layout/MobileNav';
import { DashboardView } from './components/dashboard/DashboardView';
import { SessaoEstudoView } from './components/estudos/SessaoEstudoView';
import { ConcursosView } from './components/concursos/ConcursosView';
import { PlanoView } from './components/plano/PlanoView';
import { DisciplinasView } from './components/disciplinas/DisciplinasView';
import { RevisoesView } from './components/revisoes/RevisoesView';
import { FlashcardsView } from './components/flashcards/FlashcardsView';
import { QuestoesView } from './components/questoes/QuestoesView';
import { CadernoErrosView } from './components/questoes/CadernoErrosView';
import { MetasView } from './components/metas/MetasView';
import { SimuladosView } from './components/simulados/SimuladosView';
import { PerfilView } from './components/perfil/PerfilView';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { AIAssistantView } from './components/ai/AIAssistantView';
import { AdminView } from './components/admin/AdminView';
import { PlanosAssinaturaView } from './components/planos/PlanosAssinaturaView';
import { StudySessionModal } from './components/estudos/StudySessionModal';
import { StudyTimerProvider, useStudyTimer } from './contexts/StudyTimerContext';
import { Loader2 } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, isAuthenticated, isLoading, refreshProfile } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const {
    isStudyTimerOpen,
    timerInitialDisciplinaId,
    timerInitialAssuntoId,
    timerInitialDurationMinutes,
    openStudyTimer,
    closeStudyTimer,
  } = useStudyTimer();

  const [concursos, setConcursos] = useState<Concurso[]>([]);
  const [provas, setProvas] = useState<Prova[]>([]);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [assuntos, setAssuntos] = useState<Assunto[]>([]);
  const [sessoes, setSessoes] = useState<SessaoEstudo[]>([]);
  const [revisoes, setRevisoes] = useState<Revisao[]>([]);
  const [revisionSettings, setRevisionSettings] = useState<RevisionSettings | null>(null);
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [blocosQuestoes, setBlocosQuestoes] = useState<RegistroBlocoQuestoes[]>([]);
  const [cadernoErros, setCadernoErros] = useState<ItemCadernoErros[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [conquistas, setConquistas] = useState<Conquista[]>([]);
  const [marcos, setMarcos] = useState<MarcoEstudo[]>([]);
  const [stats, setStats] = useState<EstatisticasProgressoReal | null>(null);
  const [simulados, setSimulados] = useState<Simulado[]>([]);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [cycle, setCycle] = useState<StudyCycle | null>(null);
  const [studyMethod, setStudyMethod] = useState<StudyMethod>('ciclo');

  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const loadData = () => {
    setIsDataLoading(true);
    setDataError(null);
    Promise.all([
      DatabaseService.getConcursos(),
      DatabaseService.getProvas(),
      DatabaseService.getDisciplinas(),
      DatabaseService.getAssuntos(),
      DatabaseService.getSessoes(),
      DatabaseService.getRevisoes(),
      DatabaseService.getRevisionSettings(),
      DatabaseService.getQuestoes(),
      DatabaseService.getBlocosQuestoes(),
      DatabaseService.getCadernoErros(),
      DatabaseService.getMetas(),
      DatabaseService.getConquistas(),
      DatabaseService.getMarcos(),
      DatabaseService.getEstatisticasProgressoReal(user?.id || 'user_demo_01'),
      DatabaseService.getSimulados(),
      DatabaseService.getStudyPlan(),
      DatabaseService.getStudyCycle(),
      DatabaseService.getStudyMethod(),
    ]).then(([c, p, d, a, ses, r, srsSettings, q, bq, errs, m, achs, mrcs, st, s, pl, cy, sm]) => {
      setConcursos(c);
      setProvas(p);
      setDisciplinas(d);
      setAssuntos(a);
      setSessoes(ses);
      setRevisoes(r);
      setRevisionSettings(srsSettings);
      setQuestoes(q);
      setBlocosQuestoes(bq);
      setCadernoErros(errs);
      setMetas(m);
      setConquistas(achs);
      setMarcos(mrcs);
      setStats(st);
      setSimulados(s);
      setPlan(pl);
      const activeC = c.find(item => item.active) || c[0];
      const targetId = activeC?.id || '';
      if (targetId && cy && cy.concursoId !== targetId) {
        DatabaseService.getStudyCycle(targetId).then(setCycle);
      } else {
        setCycle(cy);
      }
      setStudyMethod(sm || 'ciclo');
      setIsDataLoading(false);
    }).catch(err => {
      console.error('Erro ao carregar dados do Gabarita:', err);
      setDataError('Falha na sincronização dos dados locais e em nuvem.');
      setIsDataLoading(false);
    });
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <GezinhoLogo size={52} className="mb-4 animate-pulse drop-shadow-2xl" />
        <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Carregando Gabarita...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <AuthPage />;
  }

  const activeConcurso = concursos.find(c => c.active) || 
    concursos.find(c => c.id === user.targetConcursoId) || 
    concursos[0] || null;
  const activeConcursoId = activeConcurso?.id || '';

  const handleOpenStudyTimer = (disciplinaId?: string, assuntoId?: string, durationMinutes?: number | string) => {
    openStudyTimer(disciplinaId, assuntoId, durationMinutes);
  };

  const handleUpdateSubscription = async (plan: UserPlan) => {
    if (!user) return;
    const expires = new Date();
    if (plan === 'mensal') expires.setMonth(expires.getMonth() + 1);
    else if (plan === 'anual') expires.setFullYear(expires.getFullYear() + 1);
    else if (plan === 'teste') expires.setDate(expires.getDate() + 7);
    else expires.setDate(expires.getDate() + 1);

    const subscription = {
      plan,
      status: plan === 'gratuito' ? ('expirado' as const) : ('ativo' as const),
      startDate: new Date().toISOString(),
      expiresAt: expires.toISOString(),
      gateway: 'stripe' as const,
    };
    await DatabaseService.updateUserProfile({ subscription });
    refreshProfile({ subscription });
  };

  const handleAddConcurso = async (newConcurso: Omit<Concurso, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created = await DatabaseService.addConcurso(newConcurso);
    setConcursos(prev => [created, ...prev]);
  };

  const handleAddConcursoWithDisciplinas = async (
    concursoData: Omit<Concurso, 'id' | 'createdAt' | 'updatedAt'>,
    disciplinasData: any[]
  ) => {
    const result = await DatabaseService.addConcursoWithDisciplinas(concursoData, disciplinasData);
    setConcursos(prev => [result.concurso, ...prev.map(c => ({ ...c, active: false }))]);
    setDisciplinas(prev => [...prev, ...result.disciplinas]);
    setAssuntos(prev => [...prev, ...result.assuntos]);
    refreshProfile({
      targetConcursoId: result.concurso.id,
      targetConcursoTitle: `${result.concurso.organ} - ${result.concurso.role}`,
    });
    loadData();
  };

  const handleUpdateConcurso = async (id: string, partial: Partial<Concurso>) => {
    const updated = await DatabaseService.updateConcurso(id, partial);
    setConcursos(prev => prev.map(c => c.id === id ? updated : c));
  };

  const handleDeleteConcurso = async (id: string) => {
    const updatedList = await DatabaseService.deleteConcurso(id);
    setConcursos(updatedList);
    const updatedProvas = await DatabaseService.getProvas();
    setProvas(updatedProvas);
  };

  const handleSetActiveConcurso = async (id: string) => {
    const { concursos: updatedList, activeConcurso } = await DatabaseService.setActiveConcurso(id);
    setConcursos(updatedList);
    refreshProfile({
      targetConcursoId: activeConcurso.id,
      targetConcursoTitle: `${activeConcurso.organ} - ${activeConcurso.role}`,
    });
    try {
      const [newCycle, newPlan] = await Promise.all([
        DatabaseService.getStudyCycle(activeConcurso.id),
        DatabaseService.getStudyPlan(activeConcurso.id),
      ]);
      setCycle(newCycle);
      setPlan(newPlan);
    } catch (e) {
      console.warn('Erro ao atualizar ciclo e plano do concurso ativo:', e);
    }
  };

  const handleAddProva = async (newProva: Omit<Prova, 'id' | 'createdAt'>) => {
    const created = await DatabaseService.addProva(newProva);
    setProvas(prev => [created, ...prev]);
  };

  const handleUpdateProva = async (id: string, partial: Partial<Prova>) => {
    const updated = await DatabaseService.updateProva(id, partial);
    setProvas(prev => prev.map(p => p.id === id ? updated : p));
  };

  const handleDeleteProva = async (id: string) => {
    const updated = await DatabaseService.deleteProva(id);
    setProvas(updated);
  };

  const handleAddDisciplina = async (newDisc: Omit<Disciplina, 'id' | 'createdAt' | 'topicsCount' | 'completedTopicsCount' | 'totalStudyMinutes'>) => {
    const created = await DatabaseService.addDisciplina({
      ...newDisc,
      concursoId: newDisc.concursoId || activeConcursoId,
    });
    setDisciplinas(prev => [...prev, created]);
  };

  const handleUpdateDisciplina = async (id: string, partial: Partial<Disciplina>) => {
    const updated = await DatabaseService.updateDisciplina(id, partial);
    setDisciplinas(prev => prev.map(d => d.id === id ? updated : d));
  };

  const handleDeleteDisciplina = async (id: string) => {
    const updatedList = await DatabaseService.deleteDisciplina(id);
    setDisciplinas(updatedList);
    const updatedAssuntos = await DatabaseService.getAssuntos();
    setAssuntos(updatedAssuntos);
  };

  const handleDuplicateDisciplina = async (id: string) => {
    const { disciplina, assuntos: clonedAssuntos } = await DatabaseService.duplicateDisciplina(id);
    setDisciplinas(prev => [...prev, disciplina]);
    setAssuntos(prev => [...prev, ...clonedAssuntos]);
  };

  const handleAddAssunto = async (newAssunto: Omit<Assunto, 'id' | 'createdAt' | 'masteryLevel' | 'totalQuestionsSolved' | 'correctQuestionsSolved' | 'accuracyRate'>) => {
    const created = await DatabaseService.addAssunto(newAssunto);
    setAssuntos(prev => [...prev, created]);
  };

  const handleUpdateAssunto = async (id: string, partial: Partial<Assunto>) => {
    const updated = await DatabaseService.updateAssunto(id, partial);
    setAssuntos(prev => prev.map(a => a.id === id ? updated : a));
  };

  const handleDeleteAssunto = async (id: string) => {
    const updatedList = await DatabaseService.deleteAssunto(id);
    setAssuntos(updatedList);
    const updatedDisciplinas = await DatabaseService.getDisciplinas();
    setDisciplinas(updatedDisciplinas);
  };

  const handleDuplicateAssunto = async (id: string) => {
    const cloned = await DatabaseService.duplicateAssunto(id);
    setAssuntos(prev => [...prev, cloned]);
  };

  const handleReorderAssuntos = async (orderedIds: string[]) => {
    const updatedList = await DatabaseService.reorderAssuntos(orderedIds);
    setAssuntos(updatedList);
  };

  const handleUpdateAssuntoStatus = async (id: string, status: TopicStatus) => {
    const updated = await DatabaseService.updateAssuntoStatus(id, status);
    setAssuntos(prev => prev.map(a => a.id === id ? updated : a));
  };

  const handleAddSubtopico = async (assuntoId: string, name: string) => {
    const updatedAssunto = await DatabaseService.addSubtopico(assuntoId, name);
    setAssuntos(prev => prev.map(a => a.id === assuntoId ? updatedAssunto : a));
  };

  const handleUpdateSubtopico = async (assuntoId: string, subId: string, partial: Partial<Subtopico>) => {
    const updatedAssunto = await DatabaseService.updateSubtopico(assuntoId, subId, partial);
    setAssuntos(prev => prev.map(a => a.id === assuntoId ? updatedAssunto : a));
  };

  const handleDeleteSubtopico = async (assuntoId: string, subId: string) => {
    const updatedAssunto = await DatabaseService.deleteSubtopico(assuntoId, subId);
    setAssuntos(prev => prev.map(a => a.id === assuntoId ? updatedAssunto : a));
  };

  const handleImportEditalTree = async (
    payload: EditalAiImportPayload, 
    concursoId?: string, 
    mode: 'merge' | 'replace' = 'merge'
  ) => {
    const { disciplinas: updatedDisc, assuntos: updatedAss } = await DatabaseService.importEditalTree(payload, concursoId, mode);
    setDisciplinas(updatedDisc);
    setAssuntos(updatedAss);
  };

  const handleRecalculatePlan = async (customAvailability?: WeeklyAvailability, newExamDate?: string) => {
    const updated = await DatabaseService.recalculateStudyPlan(user.targetConcursoId, customAvailability, newExamDate);
    setPlan(updated);
  };

  const handleAddPlanSession = async (session: Omit<PlannedSession, 'id'>) => {
    const { plan: updated } = await DatabaseService.addPlannedSession(session);
    setPlan(updated);
  };

  const handleUpdatePlanSession = async (sessionId: string, partial: Partial<PlannedSession>) => {
    const updated = await DatabaseService.updatePlannedSession(sessionId, partial);
    setPlan(updated);
  };

  const handleDeletePlanSession = async (sessionId: string) => {
    const updated = await DatabaseService.deletePlannedSession(sessionId);
    setPlan(updated);
  };

  const handleReschedulePlanSession = async (sessionId: string, newDate: string, reason?: string) => {
    const updated = await DatabaseService.reschedulePlannedSession(sessionId, newDate, reason);
    setPlan(updated);
  };

  const handleBatchRescheduleOverdue = async (targetDate?: string, mode?: 'today' | 'spread') => {
    const updated = await DatabaseService.batchRescheduleOverdue(targetDate, mode);
    setPlan(updated);
  };

  const handleTogglePlanSessionStatus = async (sessionId: string, status: PlanSessionStatus) => {
    const updated = await DatabaseService.togglePlanSessionStatus(sessionId, status);
    setPlan(updated);
    if (status === 'concluida') {
      const updatedSessoes = await DatabaseService.getSessoes();
      setSessoes(updatedSessoes);
    }
  };

  const handleAdvanceCycle = async (minutesStudied?: number) => {
    const updated = await DatabaseService.advanceStudyCycle(minutesStudied);
    setCycle(updated);
    const updatedSessoes = await DatabaseService.getSessoes();
    setSessoes(updatedSessoes);
  };

  const handleRewindCycle = async () => {
    const updated = await DatabaseService.rewindStudyCycle();
    setCycle(updated);
  };

  const handleRecordCycleProgress = async (additionalMinutes: number) => {
    const updated = await DatabaseService.recordCycleProgress(additionalMinutes);
    setCycle(updated);
    const updatedSessoes = await DatabaseService.getSessoes();
    setSessoes(updatedSessoes);
  };

  const handleResetCycleLap = async () => {
    const updated = await DatabaseService.resetCycleCurrentLap();
    setCycle(updated);
  };

  const handleRecalculateCycle = async (baseSlotDuration?: number) => {
    const updated = await DatabaseService.recalculateStudyCycle(plan?.concursoId, baseSlotDuration);
    setCycle(updated);
  };

  const handleUpdateCycleBlock = async (blockId: string, partial: Partial<CycleBlock>) => {
    const updated = await DatabaseService.updateCycleBlock(blockId, partial);
    setCycle(updated);
  };

  const handleCompleteRevisao = async (
    revisaoId: string, 
    rating: RevisionRating, 
    accuracyRate?: number, 
    questionsAttempted?: number, 
    questionsCorrect?: number, 
    notes?: string
  ) => {
    const { allRevisoes } = await DatabaseService.completeRevisaoWithPerformance(
      revisaoId, 
      rating, 
      accuracyRate, 
      questionsAttempted, 
      questionsCorrect, 
      notes
    );
    setRevisoes(allRevisoes);
    const [profile, updatedAss] = await Promise.all([
      DatabaseService.getUserProfile(user.id),
      DatabaseService.getAssuntos(),
    ]);
    refreshProfile(profile);
    setAssuntos(updatedAss);
  };

  const handleAddRevisao = async (revData: {
    disciplinaId: string;
    assuntoId?: string;
    assuntoName: string;
    method: RevisionMethod;
    scheduledFor: string;
    notes?: string;
    isAutomatic?: boolean;
    stage?: number;
    intervalDays?: number;
  }) => {
    const created = await DatabaseService.addRevisao({
      ...revData,
      userId: user.id,
      status: 'pendente',
    });
    setRevisoes(prev => [created, ...prev]);
  };

  const handleUpdateRevisao = async (id: string, partial: Partial<Revisao>) => {
    const updated = await DatabaseService.updateRevisao(id, partial);
    setRevisoes(prev => prev.map(r => r.id === id ? updated : r));
  };

  const handleDeleteRevisao = async (id: string) => {
    const updated = await DatabaseService.deleteRevisao(id);
    setRevisoes(updated);
  };

  const handleBatchRescheduleOverdueRevisoes = async (targetDateStr?: string) => {
    const updated = await DatabaseService.batchRescheduleOverdueRevisoes(targetDateStr);
    setRevisoes(updated);
  };

  const handleUpdateRevisionSettings = async (settingsPartial: Partial<RevisionSettings>) => {
    const updated = await DatabaseService.updateRevisionSettings(settingsPartial);
    setRevisionSettings(updated);
  };

  const handleAddMeta = async (newMeta: Omit<Meta, 'id' | 'createdAt'>) => {
    await DatabaseService.addMeta({
      ...newMeta,
      userId: user.id,
    });
    const [updatedMetas, updatedStats, updatedAchs, updatedMarcos] = await Promise.all([
      DatabaseService.getMetas(),
      DatabaseService.getEstatisticasProgressoReal(user.id),
      DatabaseService.getConquistas(),
      DatabaseService.getMarcos(),
    ]);
    setMetas(updatedMetas);
    setStats(updatedStats);
    setConquistas(updatedAchs);
    setMarcos(updatedMarcos);
  };

  const handleUpdateMeta = async (id: string, partial: Partial<Meta>) => {
    await DatabaseService.updateMeta(id, partial);
    const updatedMetas = await DatabaseService.getMetas();
    setMetas(updatedMetas);
  };

  const handleDeleteMeta = async (id: string) => {
    const updatedMetas = await DatabaseService.deleteMeta(id);
    setMetas(updatedMetas);
  };

  const handleSaveStudySession = async (session: {
    disciplinaId: string;
    assuntoId?: string;
    durationMinutes: number;
    plannedMinutes?: number;
    type: StudySessionType;
    questionsAttempted?: number;
    questionsCorrect?: number;
    notes?: string;
  }) => {
    const recorded = await DatabaseService.recordStudySession({
      userId: user.id,
      ...session,
      completedAt: new Date().toISOString(),
    });
    setSessoes(prev => [recorded, ...prev]);

    if (session.assuntoId && (revisionSettings?.autoScheduleOnStudy ?? true)) {
      const top = assuntos.find(a => a.id === session.assuntoId);
      const updatedRevisoes = await DatabaseService.gerarCicloCompletoRevisao(
        user.id, 
        session.disciplinaId, 
        session.assuntoId, 
        top?.name
      );
      setRevisoes(updatedRevisoes);
    }

    const [updatedDiscs, updatedAss] = await Promise.all([
      DatabaseService.getDisciplinas(),
      DatabaseService.getAssuntos(),
    ]);
    setDisciplinas(updatedDiscs);
    setAssuntos(updatedAss);

    const profile = await DatabaseService.getUserProfile(user.id);
    refreshProfile(profile);
  };

  const handleDeleteStudySession = async (sessionId: string) => {
    const updated = await DatabaseService.deleteStudySession(sessionId);
    setSessoes(updated);
  };

  const handleRecordBlocoQuestoes = async (bloco: Omit<RegistroBlocoQuestoes, 'id' | 'createdAt' | 'wrongAnswers' | 'accuracyRate'>) => {
    const recorded = await DatabaseService.recordBlocoQuestoes(bloco);
    setBlocosQuestoes(prev => [recorded, ...prev]);

    const [updatedDiscs, updatedAss] = await Promise.all([
      DatabaseService.getDisciplinas(),
      DatabaseService.getAssuntos(),
    ]);
    setDisciplinas(updatedDiscs);
    setAssuntos(updatedAss);

    const profile = await DatabaseService.getUserProfile(user.id);
    refreshProfile(profile);
  };

  const handleDeleteBlocoQuestoes = async (blocoId: string) => {
    const updated = await DatabaseService.deleteBlocoQuestoes(blocoId);
    setBlocosQuestoes(updated);
  };

  const handleUpdateBlocoQuestoes = async (blocoId: string, partial: Partial<RegistroBlocoQuestoes>) => {
    const updated = await DatabaseService.updateBlocoQuestoes(blocoId, partial);
    setBlocosQuestoes(prev => prev.map(b => b.id === blocoId ? updated : b));
  };

  const handleAddCadernoErro = async (
    item: Omit<ItemCadernoErros, 'id' | 'createdAt' | 'updatedAt' | 'reincidenciaCount'> & { reincidenciaCount?: number }
  ) => {
    const created = await DatabaseService.addCadernoErro(item);
    setCadernoErros(prev => [created, ...prev]);
  };

  const handleUpdateCadernoErro = async (id: string, partial: Partial<ItemCadernoErros>) => {
    const updated = await DatabaseService.updateCadernoErro(id, partial);
    setCadernoErros(prev => prev.map(e => e.id === id ? updated : e));
  };

  const handleDeleteCadernoErro = async (id: string) => {
    const updated = await DatabaseService.deleteCadernoErro(id);
    setCadernoErros(updated);
  };

  const handleIncrementarReincidencia = async (id: string) => {
    const updated = await DatabaseService.incrementarReincidenciaErro(id);
    setCadernoErros(prev => prev.map(e => e.id === id ? updated : e));
  };

  const handleMarcarStatusRevisao = async (id: string, status: ErroStatusRevisao) => {
    const updated = await DatabaseService.marcarStatusRevisaoErro(id, status);
    setCadernoErros(prev => prev.map(e => e.id === id ? updated : e));
  };

  const handleIniciarRevisaoAssunto = async (disciplinaId: string, assuntoName: string, notes?: string) => {
    const newRev = await DatabaseService.agendarRevisaoDoAssunto(user.id, disciplinaId, assuntoName, '24h', notes);
    setRevisoes(prev => [newRev, ...prev]);
    const top = assuntos.find(a => a.disciplinaId === disciplinaId && a.name === assuntoName);
    handleOpenStudyTimer(disciplinaId, top?.id);
  };

  const handleCreateSimulado = async (data: any) => {
    const created = await DatabaseService.createSimulado({
      ...data,
      userId: user.id,
    });
    setSimulados(prev => [created, ...prev]);
    return created;
  };

  const handleDeleteSimulado = async (id: string) => {
    const updated = await DatabaseService.deleteSimulado(id);
    setSimulados(updated);
  };

  const handlePauseSimulado = async (
    id: string, 
    answers: Record<number, string>, 
    doubting: Record<number, boolean>, 
    timeRemaining: number, 
    elapsedSeconds: number
  ) => {
    const updated = await DatabaseService.saveSimuladoProgress(id, {
      answers,
      doubting,
      timeRemainingSeconds: timeRemaining,
      elapsedSeconds,
      status: 'pausado',
    });
    setSimulados(prev => prev.map(s => s.id === id ? updated : s));
  };

  const handleFinishSimulado = async (
    id: string, 
    answers: Record<number, string>, 
    doubting: Record<number, boolean>, 
    elapsedSeconds: number
  ) => {
    const finished = await DatabaseService.finishSimulado(id, {
      answers,
      doubting,
      elapsedSeconds,
    });
    setSimulados(prev => prev.map(s => s.id === id ? finished : s));

    const [updatedDiscs, updatedAss, updatedProfile] = await Promise.all([
      DatabaseService.getDisciplinas(),
      DatabaseService.getAssuntos(),
      DatabaseService.getUserProfile(user.id),
    ]);
    setDisciplinas(updatedDiscs);
    setAssuntos(updatedAss);
    refreshProfile(updatedProfile);
    return finished;
  };

  const handleAddSimuladoQuestaoToCadernoErros = async (
    simuladoId: string, 
    questaoId: string, 
    motivo: MotivoErro, 
    observation?: string
  ) => {
    const createdErro = await DatabaseService.addSimuladoQuestaoToCadernoErros(
      simuladoId, 
      questaoId, 
      motivo, 
      observation
    );
    setCadernoErros(prev => [createdErro, ...prev]);
    const updatedSims = await DatabaseService.getSimulados();
    setSimulados(updatedSims);
    return createdErro;
  };

  const handleUpdateProfile = async (updated: Partial<UserProfile>) => {
    const res = await DatabaseService.updateUserProfile(updated);
    refreshProfile(res);
  };

  const handleSwitchStudyMethod = async (newMethod: StudyMethod) => {
    await DatabaseService.setStudyMethod(newMethod);
    setStudyMethod(newMethod);
    if (currentTab === 'ciclo' || currentTab === 'cronograma' || currentTab === 'plano') {
      setCurrentTab(newMethod === 'ciclo' ? 'ciclo' : 'cronograma');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        studyMethod={studyMethod}
        concursos={concursos}
        activeConcursoId={activeConcursoId}
        onSetActiveConcurso={handleSetActiveConcurso}
      />

      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <Navbar
          currentTab={currentTab}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenStudyTimer={() => setCurrentTab('sessao')}
          onNavigateTab={setCurrentTab}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-12 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardView
              user={user}
              concursos={concursos}
              disciplinas={disciplinas}
              assuntos={assuntos}
              sessoes={sessoes}
              revisoes={revisoes}
              metas={metas}
              plan={plan}
              isLoading={isDataLoading}
              errorMessage={dataError}
              onNavigateTab={setCurrentTab}
              onOpenStudyTimer={handleOpenStudyTimer}
              onCompleteRevisao={handleCompleteRevisao}
              onRetry={loadData}
            />
          )}

          {currentTab === 'sessao' && (
            <SessaoEstudoView
              user={user}
              disciplinas={disciplinas}
              assuntos={assuntos}
              sessoes={sessoes}
              plan={plan}
              cycle={cycle}
              initialDisciplinaId={timerInitialDisciplinaId}
              initialAssuntoId={timerInitialAssuntoId}
              onSaveSession={handleSaveStudySession}
              onDeleteSession={handleDeleteStudySession}
              onAdvanceCycle={handleAdvanceCycle}
              onTogglePlanSession={(id) => handleTogglePlanSessionStatus(id, 'concluida')}
              onOpenStudyTimer={handleOpenStudyTimer}
            />
          )}

          {currentTab === 'concursos' && (
            <ConcursosView
              concursos={concursos}
              provas={provas}
              user={user}
              disciplinas={disciplinas}
              assuntos={assuntos}
              onAddConcurso={handleAddConcurso}
              onAddConcursoWithDisciplinas={handleAddConcursoWithDisciplinas}
              onUpdateConcurso={handleUpdateConcurso}
              onDeleteConcurso={handleDeleteConcurso}
              onSetActiveConcurso={handleSetActiveConcurso}
              onAddProva={handleAddProva}
              onUpdateProva={handleUpdateProva}
              onDeleteProva={handleDeleteProva}
              onAddDisciplina={handleAddDisciplina}
              onUpdateDisciplina={handleUpdateDisciplina}
              onDeleteDisciplina={handleDeleteDisciplina}
              onAddAssunto={handleAddAssunto}
              onUpdateAssunto={handleUpdateAssunto}
              onDeleteAssunto={handleDeleteAssunto}
              onUpdateAssuntoStatus={handleUpdateAssuntoStatus}
              onOpenStudyTimer={handleOpenStudyTimer}
              onNavigateTab={setCurrentTab}
            />
          )}

          {(currentTab === 'plano' || currentTab === 'ciclo' || currentTab === 'cronograma') && (
            <PlanoView
              plan={plan}
              cycle={cycle}
              concursos={concursos}
              disciplinas={disciplinas}
              assuntos={assuntos}
              activeConcursoId={activeConcursoId}
              studyMethod={currentTab === 'ciclo' ? 'ciclo' : currentTab === 'cronograma' ? 'cronograma' : studyMethod}
              onNavigateTab={setCurrentTab}
              onSwitchMethod={handleSwitchStudyMethod}
              onRecalculatePlan={handleRecalculatePlan}
              onAddSession={handleAddPlanSession}
              onUpdateSession={handleUpdatePlanSession}
              onDeleteSession={handleDeletePlanSession}
              onRescheduleSession={handleReschedulePlanSession}
              onBatchRescheduleOverdue={handleBatchRescheduleOverdue}
              onToggleSessionStatus={handleTogglePlanSessionStatus}
              onOpenStudyTimer={handleOpenStudyTimer}
              onAdvanceCycle={handleAdvanceCycle}
              onRewindCycle={handleRewindCycle}
              onRecordCycleProgress={handleRecordCycleProgress}
              onResetCycleLap={handleResetCycleLap}
              onRecalculateCycle={handleRecalculateCycle}
              onUpdateCycleBlock={handleUpdateCycleBlock}
              onRemoveCycle={async () => {
                const cleared = await DatabaseService.removeStudyCycle();
                setCycle(cleared);
              }}
              onSaveCycle={setCycle}
            />
          )}

          {currentTab === 'estudos' && (
            <DisciplinasView
              concursos={concursos}
              disciplinas={disciplinas}
              assuntos={assuntos}
              activeConcursoId={activeConcursoId}
              onSetActiveConcurso={handleSetActiveConcurso}
              onNavigateTab={setCurrentTab}
              onAddDisciplina={handleAddDisciplina}
              onUpdateDisciplina={handleUpdateDisciplina}
              onDeleteDisciplina={handleDeleteDisciplina}
              onDuplicateDisciplina={handleDuplicateDisciplina}
              onAddAssunto={handleAddAssunto}
              onUpdateAssunto={handleUpdateAssunto}
              onDeleteAssunto={handleDeleteAssunto}
              onDuplicateAssunto={handleDuplicateAssunto}
              onReorderAssuntos={handleReorderAssuntos}
              onUpdateAssuntoStatus={handleUpdateAssuntoStatus}
              onAddSubtopico={handleAddSubtopico}
              onUpdateSubtopico={handleUpdateSubtopico}
              onDeleteSubtopico={handleDeleteSubtopico}
              onImportEditalTree={handleImportEditalTree}
              onOpenStudyTimer={handleOpenStudyTimer}
            />
          )}

          {currentTab === 'revisoes' && (
            <RevisoesView
              revisoes={revisoes}
              disciplinas={disciplinas}
              assuntos={assuntos}
              settings={revisionSettings || undefined}
              onNavigateTab={setCurrentTab}
              onCompleteRevisao={handleCompleteRevisao}
              onAddRevisao={handleAddRevisao}
              onUpdateRevisao={handleUpdateRevisao}
              onDeleteRevisao={handleDeleteRevisao}
              onBatchRescheduleOverdue={handleBatchRescheduleOverdueRevisoes}
              onUpdateSettings={handleUpdateRevisionSettings}
              onOpenStudyTimer={handleOpenStudyTimer}
            />
          )}

          {currentTab === 'flashcards' && (
            <FlashcardsView
              disciplinas={disciplinas}
              assuntos={assuntos}
              onNavigateTab={setCurrentTab}
            />
          )}

          {currentTab === 'questoes' && (
            <QuestoesView
              questoes={questoes}
              disciplinas={disciplinas}
              assuntos={assuntos}
              blocosQuestoes={blocosQuestoes}
              cadernoErros={cadernoErros}
              onNavigateTab={setCurrentTab}
              onRecordBlocoQuestoes={handleRecordBlocoQuestoes}
              onDeleteBlocoQuestoes={handleDeleteBlocoQuestoes}
              onUpdateBlocoQuestoes={handleUpdateBlocoQuestoes}
              onAddCadernoErro={handleAddCadernoErro}
              onUpdateCadernoErro={handleUpdateCadernoErro}
              onDeleteCadernoErro={handleDeleteCadernoErro}
              onIncrementarReincidencia={handleIncrementarReincidencia}
              onMarcarStatusRevisao={handleMarcarStatusRevisao}
              onIniciarRevisaoAssunto={handleIniciarRevisaoAssunto}
              onOpenStudyTimer={handleOpenStudyTimer}
            />
          )}

          {currentTab === 'caderno_erros' && (
            <div className="max-w-7xl mx-auto pb-12">
              <CadernoErrosView
                cadernoErros={cadernoErros}
                disciplinas={disciplinas}
                assuntos={assuntos}
                questoes={questoes}
                blocosQuestoes={blocosQuestoes}
                onNavigateTab={setCurrentTab}
                onAddCadernoErro={handleAddCadernoErro}
                onUpdateCadernoErro={handleUpdateCadernoErro}
                onDeleteCadernoErro={handleDeleteCadernoErro}
                onIncrementarReincidencia={handleIncrementarReincidencia}
                onMarcarStatusRevisao={handleMarcarStatusRevisao}
                onIniciarRevisaoAssunto={handleIniciarRevisaoAssunto}
                onOpenStudyTimer={handleOpenStudyTimer}
              />
            </div>
          )}

          {currentTab === 'metas' && (
            <MetasView
              metas={metas}
              conquistas={conquistas}
              marcos={marcos}
              stats={stats || {
                horasHoje: 0,
                horasSemana: 0,
                horasMes: 0,
                horasTotal: 0,
                questoesHoje: 0,
                questoesSemana: 0,
                questoesMes: 0,
                questoesTotal: 0,
                acertosTotal: 0,
                taxaAcertoGeral: 0,
                revisoesHoje: 0,
                revisoesSemana: 0,
                revisoesMes: 0,
                revisoesTotal: 0,
                streakDias: user?.streakDays || 0,
                melhorStreakDias: 0,
                diasAtivosUltimaSemana: [
                  { data: '', diaSemana: 'Seg', estudou: false, minutos: 0 },
                  { data: '', diaSemana: 'Ter', estudou: false, minutos: 0 },
                  { data: '', diaSemana: 'Qua', estudou: false, minutos: 0 },
                  { data: '', diaSemana: 'Qui', estudou: false, minutos: 0 },
                  { data: '', diaSemana: 'Sex', estudou: false, minutos: 0 },
                  { data: '', diaSemana: 'Sáb', estudou: false, minutos: 0 },
                  { data: '', diaSemana: 'Dom', estudou: false, minutos: 0 },
                ],
                topicosConcluidos: 0,
                topicosTotal: 0,
                percentualEdital: 0,
                xpTotal: user?.xp || 0,
                nivelAtual: user?.level || 1,
                tituloNivel: 'Iniciante Focado',
                xpProximoNivel: 1000,
                xpNivelAtual: (user?.xp || 0) % 1000,
                percentualNivel: Math.round(((user?.xp || 0) % 1000) / 10),
              }}
              onAddMeta={handleAddMeta}
              onUpdateMeta={handleUpdateMeta}
              onDeleteMeta={handleDeleteMeta}
            />
          )}

          {currentTab === 'analytics' && (
            <AnalyticsView
              disciplinas={disciplinas}
              assuntos={assuntos}
              sessoes={sessoes}
              blocosQuestoes={blocosQuestoes}
              revisoes={revisoes}
              simulados={simulados}
              stats={stats || {
                horasHoje: 0,
                horasSemana: 0,
                horasMes: 0,
                horasTotal: 0,
                questoesHoje: 0,
                questoesSemana: 0,
                questoesMes: 0,
                questoesTotal: 0,
                acertosTotal: 0,
                taxaAcertoGeral: 0,
                revisoesHoje: 0,
                revisoesSemana: 0,
                revisoesMes: 0,
                revisoesTotal: 0,
                streakDias: user?.streakDays || 0,
                melhorStreakDias: 0,
                diasAtivosUltimaSemana: [
                  { data: '', diaSemana: 'Seg', estudou: false, minutos: 0 },
                  { data: '', diaSemana: 'Ter', estudou: false, minutos: 0 },
                  { data: '', diaSemana: 'Qua', estudou: false, minutos: 0 },
                  { data: '', diaSemana: 'Qui', estudou: false, minutos: 0 },
                  { data: '', diaSemana: 'Sex', estudou: false, minutos: 0 },
                  { data: '', diaSemana: 'Sáb', estudou: false, minutos: 0 },
                  { data: '', diaSemana: 'Dom', estudou: false, minutos: 0 },
                ],
                topicosConcluidos: 0,
                topicosTotal: 0,
                percentualEdital: 0,
                xpTotal: user?.xp || 0,
                nivelAtual: user?.level || 1,
                tituloNivel: 'Iniciante Focado',
                xpProximoNivel: 1000,
                xpNivelAtual: (user?.xp || 0) % 1000,
                percentualNivel: Math.round(((user?.xp || 0) % 1000) / 10),
              }}
            />
          )}

          {currentTab === 'ai_assistant' && (
            <AIAssistantView />
          )}

          {currentTab === 'simulados' && (
            <SimuladosView
              simulados={simulados}
              concursos={concursos}
              disciplinas={disciplinas}
              assuntos={assuntos}
              onNavigateTab={setCurrentTab}
              onCreateSimulado={handleCreateSimulado}
              onDeleteSimulado={handleDeleteSimulado}
              onPauseSimulado={handlePauseSimulado}
              onFinishSimulado={handleFinishSimulado}
              onAddToCadernoErros={handleAddSimuladoQuestaoToCadernoErros}
            />
          )}

          {currentTab === 'perfil' && (
            <PerfilView
              user={user}
              concursos={concursos}
              onUpdateProfile={handleUpdateProfile}
            />
          )}

          {currentTab === 'admin' && (
            <AdminView
              user={user}
              concursos={concursos}
              disciplinas={disciplinas}
              assuntos={assuntos}
              studyCycles={[]}
            />
          )}

          {currentTab === 'planos_assinatura' && (
            <PlanosAssinaturaView
              user={user}
              onUpdateSubscription={handleUpdateSubscription}
            />
          )}
        </main>

        <MobileNav
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          studyMethod={studyMethod}
        />
      </div>

      <StudySessionModal
        isOpen={isStudyTimerOpen}
        onClose={closeStudyTimer}
        disciplinas={disciplinas}
        assuntos={assuntos}
        initialDisciplinaId={timerInitialDisciplinaId}
        initialAssuntoId={timerInitialAssuntoId}
        initialDurationMinutes={timerInitialDurationMinutes}
        onSaveSession={handleSaveStudySession}
        onAdvanceCycle={handleAdvanceCycle}
      />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <StudyTimerProvider>
          <MainApp />
        </StudyTimerProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
