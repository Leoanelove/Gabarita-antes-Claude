export type UserRole = 'aluno' | 'mentor' | 'admin';
export type UserPlan = 'gratuito' | 'teste' | 'mensal' | 'anual';

export interface SubscriptionDetails {
  plan: UserPlan;
  status: 'ativo' | 'trial' | 'expirado' | 'cancelado';
  startDate: string;
  expiresAt: string;
  gateway?: 'stripe' | 'mercadopago' | 'none';
  gatewaySubscriptionId?: string;
}

export interface NotificationEventPreferences {
  estudoProgramado: boolean;
  revisao: boolean;
  meta: boolean;
  simulado: boolean;
  provaProxima: boolean;
  sessaoAtrasada: boolean;
  conquistas: boolean;
}

export interface NotificationPreferences {
  inApp: NotificationEventPreferences;
  push: NotificationEventPreferences;
}

export type ColorSkin = 'verde' | 'azul' | 'rosa' | 'roxo' | 'purple' | 'laranja' | 'orange' | 'dbz';

export type StudyMethod = 'ciclo' | 'cronograma';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  colorSkin?: ColorSkin;
  studyMethod?: StudyMethod;
  notificationsEnabled: boolean;
  emailAlerts: boolean;
  pomodoroWorkMin: number;
  pomodoroBreakMin: number;
  soundEnabled: boolean;
  notificationPreferences?: NotificationPreferences;
  consentGiven?: boolean;
  consentDate?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  subscription?: SubscriptionDetails;
  photoURL?: string;
  bio?: string;
  targetConcursoId?: string;
  targetConcursoTitle?: string;
  studyHoursPerDay: number;
  streakDays: number;
  lastStudyDate?: string;
  xp: number;
  level: number;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export type ConcursoSphere = 'federal' | 'estadual' | 'municipal';
export type ConcursoStatus = 
  | 'previsto'
  | 'autorizado'
  | 'comissao_formada'
  | 'escolha_banca'
  | 'edital_publicado'
  | 'inscricoes_abertas'
  | 'encerrado';

export interface Concurso {
  id: string;
  title: string;
  organ: string;
  banca: string;
  role: string;
  sphere: ConcursoSphere;
  remuneration: number;
  vacantPositions: number;
  status: ConcursoStatus;
  examDate?: string;
  registrationStartDate?: string;
  registrationEndDate?: string;
  editalUrl?: string;
  active: boolean;
  userId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Edital {
  id: string;
  concursoId: string;
  title: string;
  publicationDate: string;
  version: string;
  status: 'vigente' | 'retificado' | 'revogado';
  attachmentUrl?: string;
  notes?: string;
  createdAt: string;
}

export interface Prova {
  id: string;
  concursoId?: string;
  organ: string;
  banca: string;
  year: number;
  role: string;
  questionsCount: number;
  durationMinutes: number;
  fileUrl?: string;
  templateFileUrl?: string;
  createdAt: string;
}

export interface Disciplina {
  id: string;
  concursoId?: string;
  name: string;
  code?: string;
  color: string;
  icon?: string;
  weight: number;
  order: number;
  topicsCount: number;
  completedTopicsCount: number;
  totalStudyMinutes: number;
  createdAt: string;
}

export type AssuntoImportance = 'alta' | 'media' | 'baixa';
export type TopicStatus = 'nao_iniciado' | 'em_estudo' | 'revisado' | 'dominado';
export type TopicDifficulty = 'facil' | 'media' | 'dificil';

export interface Subtopico {
  id: string;
  assuntoId: string;
  name: string;
  order: number;
  status: TopicStatus;
  difficulty?: TopicDifficulty;
  completed: boolean;
  notes?: string;
  createdAt?: string;
}

export interface Assunto {
  id: string;
  disciplinaId: string;
  name: string;
  order: number;
  importance: AssuntoImportance;
  difficulty?: TopicDifficulty;
  status?: TopicStatus;
  masteryLevel: number;
  totalQuestionsSolved: number;
  correctQuestionsSolved: number;
  accuracyRate: number;
  completed: boolean;
  link?: string;
  notes?: string;
  lastStudiedAt?: string;
  subtopicos?: Subtopico[];
  createdAt: string;
}

export interface EditalAiImportPayload {
  concursoTitle: string;
  cargo: string;
  disciplinas: {
    name: string;
    weight: number;
    color?: string;
    topicos: {
      name: string;
      importance: AssuntoImportance;
      difficulty: TopicDifficulty;
      subtopicos?: string[];
      notes?: string;
    }[];
  }[];
}

export type StudySessionType = 'teoria' | 'questoes' | 'revisao' | 'simulado' | 'pomodoro' | 'jurisprudencia' | 'lei_seca';

export interface SessaoEstudo {
  id: string;
  userId: string;
  disciplinaId: string;
  assuntoId?: string;
  disciplinaName?: string;
  assuntoName?: string;
  durationMinutes: number;
  plannedMinutes?: number;
  type: StudySessionType;
  questionsAttempted?: number;
  questionsCorrect?: number;
  accuracyRate?: number;
  notes?: string;
  completedAt: string;
  createdAt: string;
}

export type RevisionMethod = '24h' | '7d' | '15d' | '30d' | '60d' | 'personalizado' | 'intervalada' | 'adaptativo_desempenho';
export type RevisionStatus = 'pendente' | 'concluida' | 'atrasada';
export type RevisionRating = 'dificil' | 'medio' | 'facil' | 'errei';

export interface RevisionSettings {
  autoScheduleOnStudy: boolean;
  autoScheduleOnQuestions: boolean;
  intervalDays: number[];
  performanceAdaptive: boolean;
  easeMultiplier: number;
  hardPenaltyDays: number;
}

export interface Revisao {
  id: string;
  userId: string;
  disciplinaId: string;
  assuntoId?: string;
  disciplinaName?: string;
  assuntoName?: string;
  method: RevisionMethod;
  stage?: number;
  totalStages?: number;
  intervalDays?: number;
  scheduledFor: string;
  completedAt?: string;
  status: RevisionStatus;
  rating?: RevisionRating;
  accuracyRate?: number;
  questionsAttempted?: number;
  questionsCorrect?: number;
  notes?: string;
  isAutomatic?: boolean;
  nextRevisionId?: string;
  createdAt: string;
  updatedAt?: string;
}

export type QuestionDifficulty = 'facil' | 'media' | 'dificil';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Questao {
  id: string;
  disciplinaId: string;
  assuntoId?: string;
  disciplinaName?: string;
  assuntoName?: string;
  banca: string;
  year: number;
  organ: string;
  code?: string;
  statement: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation: string;
  difficulty: QuestionDifficulty;
  tags: string[];
  createdAt: string;
}

export interface RegistroBlocoQuestoes {
  id: string;
  userId: string;
  disciplinaId: string;
  disciplinaName: string;
  assuntoId?: string;
  assuntoName?: string;
  banca: string;
  difficulty: QuestionDifficulty;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  doubtCount?: number;
  accuracyRate: number;
  date: string;
  durationMinutes?: number;
  notes?: string;
  createdAt: string;
}

export type MotivoErro = 
  | 'falta_atencao'
  | 'desconhecimento_teoria'
  | 'pegadinha_banca'
  | 'esquecimento_lei_seca'
  | 'jurisprudencia'
  | 'interpretacao'
  | 'calculo_tempo'
  | 'outro';

export type ErroStatusRevisao = 
  | 'pendente'
  | 'em_revisao'
  | 'dominado';

export interface ItemCadernoErros {
  id: string;
  userId: string;
  questaoId?: string;
  blocoQuestoesId?: string;
  statementOrExcerpt: string;
  disciplinaId: string;
  disciplinaName: string;
  assuntoId?: string;
  assuntoName: string;
  banca?: string;
  difficulty: QuestionDifficulty;
  motivo: MotivoErro;
  observation: string;
  correctAnswer?: string;
  questionUrl?: string;
  statusRevisao: ErroStatusRevisao;
  reincidenciaCount: number;
  lastReviewedAt?: string;
  nextReviewAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type TargetType = 
  | 'horas'
  | 'questoes'
  | 'revisoes'
  | 'taxa_acerto'
  | 'topicos_concluidos'
  | 'horas_semanais'
  | 'questoes_resolvidas';

export type TargetPeriod = 'diaria' | 'semanal' | 'mensal';
export type TargetStatus = 'em_progresso' | 'concluida' | 'expirada';

export interface Meta {
  id: string;
  userId: string;
  title: string;
  targetType: TargetType;
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline: string;
  period: TargetPeriod;
  status: TargetStatus;
  autoCalculate?: boolean;
  completedAt?: string;
  createdAt: string;
}

export type ConquistaCategoria = 'estudos' | 'questoes' | 'revisoes' | 'simulados' | 'constancia' | 'erros';

export interface Conquista {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: ConquistaCategoria;
  requiredValue: number;
  currentValue: number;
  unit: string;
  xpReward: number;
  unlocked: boolean;
  unlockedAt?: string;
}

export type MarcoCategoria = 'edital' | 'questoes' | 'horas' | 'revisoes' | 'simulados';

export interface MarcoEstudo {
  id: string;
  title: string;
  description: string;
  category: MarcoCategoria;
  targetValue: number;
  currentValue: number;
  unit: string;
  isCompleted: boolean;
  completedAt?: string;
  xpReward?: number;
}

export interface EstatisticasProgressoReal {
  horasHoje: number;
  horasSemana: number;
  horasMes: number;
  horasTotal: number;
  questoesHoje: number;
  questoesSemana: number;
  questoesMes: number;
  questoesTotal: number;
  acertosTotal: number;
  taxaAcertoGeral: number;
  revisoesHoje: number;
  revisoesSemana: number;
  revisoesMes: number;
  revisoesTotal: number;
  streakDias: number;
  melhorStreakDias: number;
  diasAtivosUltimaSemana: { data: string; diaSemana: string; estudou: boolean; minutos: number }[];
  topicosConcluidos: number;
  topicosTotal: number;
  percentualEdital: number;
  xpTotal: number;
  nivelAtual: number;
  tituloNivel: string;
  xpProximoNivel: number;
  xpNivelAtual: number;
  percentualNivel: number;
}

export type SimuladoStatus = 'agendado' | 'em_andamento' | 'pausado' | 'finalizado';
export type SimuladoModalidade = 'multipla_escolha' | 'certo_errado';

export interface SimuladoDisciplinaConfig {
  disciplinaId: string;
  disciplinaName: string;
  questionsCount: number;
  weight: number;
  assuntosIds?: string[];
}

export interface SimuladoQuestaoOption {
  id: string;
  text: string;
}

export interface SimuladoQuestao {
  id: string;
  numero: number;
  disciplinaId: string;
  disciplinaName: string;
  assuntoId?: string;
  assuntoName?: string;
  banca?: string;
  statement: string;
  options: SimuladoQuestaoOption[];
  correctOptionId: string;
  explanation?: string;
  difficulty?: QuestionDifficulty;
  userAnswer?: string;
  isCorrect?: boolean;
  isDoubting?: boolean;
  timeSpentSeconds?: number;
  addedToCadernoErros?: boolean;
}

export interface SimuladoDesempenhoAssunto {
  assuntoId?: string;
  assuntoName: string;
  totalQuestoes: number;
  acertos: number;
  erros: number;
  taxaAcerto: number;
}

export interface SimuladoDesempenhoDisciplina {
  disciplinaId: string;
  disciplinaName: string;
  totalQuestoes: number;
  acertos: number;
  erros: number;
  brancos: number;
  taxaAcerto: number;
  pontuacaoLiquida: number;
  desempenhoAssuntos?: SimuladoDesempenhoAssunto[];
}

export interface Simulado {
  id: string;
  userId: string;
  concursoId?: string;
  concursoName?: string;
  title: string;
  description?: string;
  banca?: string;
  modalidade: SimuladoModalidade;
  cebraspePenalty?: boolean;
  questionsCount: number;
  durationMinutes: number;
  timeRemainingSeconds?: number;
  elapsedSeconds?: number;
  disciplinasConfig?: SimuladoDisciplinaConfig[];
  questoes?: SimuladoQuestao[];
  score?: number;
  maxScore: number;
  accuracyRate?: number;
  totalCorrect?: number;
  totalWrong?: number;
  totalBlank?: number;
  status: SimuladoStatus;
  startedAt?: string;
  finishedAt?: string;
  desempenhoPorDisciplina?: SimuladoDesempenhoDisciplina[];
  feedback?: string;
  createdAt: string;
  updatedAt?: string;
}

export type DayOfWeek = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';

export interface WeeklyAvailability {
  seg: number;
  ter: number;
  qua: number;
  qui: number;
  sex: number;
  sab: number;
  dom: number;
}

export type PlanSessionType = 'teoria' | 'questoes' | 'revisao' | 'simulado';
export type PlanSessionStatus = 'pendente' | 'concluida' | 'atrasada' | 'reagendada' | 'conflito';

export interface PlannedSession {
  id: string;
  planId: string;
  concursoId: string;
  disciplinaId: string;
  disciplinaName: string;
  disciplinaColor: string;
  assuntoId?: string;
  assuntoName?: string;
  date: string;
  dayOfWeek: DayOfWeek;
  startTime?: string;
  durationMinutes: number;
  type: PlanSessionType;
  status: PlanSessionStatus;
  notes?: string;
  completedAt?: string;
  originalDate?: string;
  rescheduledReason?: string;
  conflictReason?: string;
  revisaoId?: string;
  order: number;
}

export interface PlanConflict {
  id: string;
  type: 'carga_excessiva' | 'data_ultrapassada' | 'revisao_acumulada' | 'prazo_apertado';
  severity: 'alta' | 'media' | 'baixa';
  date?: string;
  message: string;
  suggestion: string;
  affectedSessionIds?: string[];
}

export interface PlanHistoryLog {
  id: string;
  planId: string;
  action: 'criacao' | 'recalculo' | 'reagendamento' | 'edicao_manual' | 'conclusao_sessao';
  timestamp: string;
  description: string;
  preservedCompletedCount: number;
  totalStudyMinutes: number;
}

export interface DisciplinaAllocation {
  disciplinaId: string;
  disciplinaName: string;
  color: string;
  weight: number;
  difficulty: TopicDifficulty;
  importance: AssuntoImportance;
  progressPercent: number;
  accuracyRate: number;
  allocatedMinutesPerWeek: number;
  allocatedPercentage: number;
}

export interface StudyPlan {
  id: string;
  userId: string;
  concursoId: string;
  concursoTitle: string;
  targetExamDate: string;
  startDate: string;
  weeklyAvailability: WeeklyAvailability;
  dailyAverageMinutes: number;
  totalWeeks: number;
  totalPlannedHours: number;
  disciplinasDistribution: DisciplinaAllocation[];
  sessions: PlannedSession[];
  conflicts: PlanConflict[];
  historyLogs: PlanHistoryLog[];
  createdAt: string;
  updatedAt: string;
}

export type CycleBlockStatus = 'aguardando' | 'em_andamento' | 'concluido';

export interface CycleBlock {
  id: string;
  cycleId: string;
  disciplinaId: string;
  disciplinaName: string;
  disciplinaColor: string;
  order: number;
  durationMinutes: number;
  weight: number;
  assuntoSugeridoId?: string;
  assuntoSugeridoName?: string;
  status: CycleBlockStatus;
  elapsedMinutes: number;
  completedAt?: string;
}

export interface StudyCycle {
  id: string;
  userId: string;
  concursoId: string;
  concursoTitle: string;
  currentBlockIndex: number;
  completedCyclesCount: number;
  totalCycleMinutes: number;
  blocks: CycleBlock[];
  createdAt: string;
  updatedAt: string;
}

export type CalendarViewMode = 'diario' | 'semanal' | 'mensal';
export type NotificationType = 'revisao' | 'meta' | 'concurso' | 'sistema' | 'plano';

export interface Notificacao {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

export type NavigationTab = 
  | 'dashboard'
  | 'sessao'
  | 'concursos'
  | 'plano'
  | 'ciclo'
  | 'cronograma'
  | 'estudos'
  | 'revisoes'
  | 'questoes'
  | 'caderno_erros'
  | 'metas'
  | 'analytics'
  | 'ai_assistant'
  | 'simulados'
  | 'perfil'
  | 'admin'
  | 'planos_assinatura';
