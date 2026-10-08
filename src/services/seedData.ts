import { 
  UserProfile, 
  Concurso, 
  Disciplina, 
  Assunto, 
  Revisao, 
  RevisionSettings, 
  Questao, 
  Meta, 
  Notificacao, 
  Simulado, 
  Prova, 
  SessaoEstudo, 
  StudyPlan, 
  StudyCycle,
  RegistroBlocoQuestoes,
  ItemCadernoErros,
  Conquista,
  MarcoEstudo
} from '../types';

export const INITIAL_USER: UserProfile = {
  id: 'user_demo_01',
  email: 'usuario@gabarita.com.br',
  name: 'Concurseiro(a)',
  role: 'aluno',
  photoURL: '',
  bio: 'Foco total na aprovação e consistência diária nos estudos.',
  targetConcursoId: '',
  targetConcursoTitle: '',
  studyHoursPerDay: 4.0,
  streakDays: 0,
  lastStudyDate: '',
  xp: 0,
  level: 1,
  preferences: {
    theme: 'dark',
    notificationsEnabled: true,
    emailAlerts: true,
    pomodoroWorkMin: 50,
    pomodoroBreakMin: 10,
    soundEnabled: true,
    consentGiven: true,
    consentDate: new Date().toISOString(),
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const INITIAL_CONCURSOS: Concurso[] = [];

export const INITIAL_DISCIPLINAS: Disciplina[] = [];

export const INITIAL_ASSUNTOS: Assunto[] = [];

export const INITIAL_REVISION_SETTINGS: RevisionSettings = {
  autoScheduleOnStudy: true,
  autoScheduleOnQuestions: true,
  intervalDays: [1, 7, 15, 30, 60],
  performanceAdaptive: true,
  easeMultiplier: 1.8,
  hardPenaltyDays: 1,
};

export const INITIAL_REVISOES: Revisao[] = [];

export const INITIAL_METAS: Meta[] = [];

export const INITIAL_CONQUISTAS: Conquista[] = [];

export const INITIAL_MARCOS: MarcoEstudo[] = [];

export const INITIAL_QUESTOES: Questao[] = [];

export const INITIAL_SIMULADOS: Simulado[] = [];

export const INITIAL_PROVAS: Prova[] = [];

export const INITIAL_SESSOES: SessaoEstudo[] = [];

export const INITIAL_NOTIFICACOES: Notificacao[] = [];

export const INITIAL_STUDY_PLAN: StudyPlan = {
  id: 'plan_default',
  concursoId: '',
  concursoTitle: '',
  userId: 'user_demo_01',
  startDate: new Date().toISOString().split('T')[0],
  targetExamDate: new Date(Date.now() + 86400000 * 90).toISOString().split('T')[0],
  dailyAverageMinutes: 240,
  totalWeeks: 12,
  totalPlannedHours: 288,
  weeklyAvailability: {
    seg: 240,
    ter: 240,
    qua: 240,
    qui: 240,
    sex: 240,
    sab: 180,
    dom: 120,
  },
  disciplinasDistribution: [],
  sessions: [],
  conflicts: [],
  historyLogs: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const INITIAL_STUDY_CYCLE: StudyCycle = {
  id: 'cycle_default',
  userId: 'user_demo_01',
  concursoId: '',
  concursoTitle: 'Ciclo de Estudos Principal',
  currentBlockIndex: 0,
  completedCyclesCount: 0,
  totalCycleMinutes: 0,
  blocks: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const INITIAL_BLOCOS_QUESTOES: RegistroBlocoQuestoes[] = [];

export const INITIAL_CADERNO_ERROS: ItemCadernoErros[] = [];
