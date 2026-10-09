import { 
  UserProfile, 
  Concurso, 
  Disciplina, 
  Assunto, 
  SessaoEstudo, 
  Revisao, 
  Questao, 
  Meta, 
  Simulado, 
  Notificacao, 
  Prova, 
  Subtopico, 
  TopicStatus, 
  TopicDifficulty, 
  AssuntoImportance,
  EditalAiImportPayload, 
  StudyPlan, 
  PlannedSession, 
  WeeklyAvailability, 
  PlanSessionStatus, 
  StudyCycle, 
  CycleBlock,
  RegistroBlocoQuestoes,
  ItemCadernoErros,
  MotivoErro,
  ErroStatusRevisao,
  RevisionSettings,
  RevisionRating,
  SimuladoQuestao,
  SimuladoDesempenhoDisciplina,
  SimuladoDisciplinaConfig,
  SimuladoStatus,
  Conquista,
  MarcoEstudo,
  EstatisticasProgressoReal,
  StudyMethod
} from '../types';
import { 
  INITIAL_USER, 
  INITIAL_CONCURSOS, 
  INITIAL_DISCIPLINAS, 
  INITIAL_ASSUNTOS, 
  INITIAL_REVISOES, 
  INITIAL_REVISION_SETTINGS, 
  INITIAL_QUESTOES, 
  INITIAL_METAS, 
  INITIAL_CONQUISTAS, 
  INITIAL_MARCOS, 
  INITIAL_SIMULADOS, 
  INITIAL_NOTIFICACOES, 
  INITIAL_PROVAS, 
  INITIAL_SESSOES, 
  INITIAL_STUDY_PLAN, 
  INITIAL_STUDY_CYCLE,
  INITIAL_BLOCOS_QUESTOES,
  INITIAL_CADERNO_ERROS 
} from './seedData';
import { PlannerService } from './plannerService';
import { CycleService } from './cycleService';
import { db, isFirebaseInitialized, handleFirestoreError, OperationType } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const STORAGE_KEYS = {
  USER: 'gabarita_user',
  CONCURSOS: 'gabarita_concursos',
  ACTIVE_CONTEST: 'gabarita_active_contest',
  DISCIPLINAS: 'gabarita_disciplinas',
  ASSUNTOS: 'gabarita_assuntos',
  SESSOES: 'gabarita_sessoes',
  REVISOES: 'gabarita_revisoes',
  REVISION_SETTINGS: 'gabarita_revision_settings',
  QUESTOES: 'gabarita_questoes',
  BLOCOS_QUESTOES: 'gabarita_blocos_questoes',
  CADERNO_ERROS: 'gabarita_caderno_erros',
  METAS: 'gabarita_metas',
  CONQUISTAS: 'gabarita_conquistas',
  MARCOS: 'gabarita_marcos',
  SIMULADOS: 'gabarita_simulados',
  NOTIFICACOES: 'gabarita_notificacoes',
  PROVAS: 'gabarita_provas',
  STUDY_PLAN: 'gabarita_study_plan',
  STUDY_CYCLE: 'gabarita_study_cycle',
};

// Limpeza automática de dados fictícios legados, disciplinas órfãs ou sem concursoId válido
function checkLegacyCleanup() {
  try {
    const rawConcursos = localStorage.getItem(STORAGE_KEYS.CONCURSOS);
    const rawUser = localStorage.getItem(STORAGE_KEYS.USER);
    if (
      (rawConcursos && rawConcursos.includes('conc_tcu_2026')) ||
      (rawUser && rawUser.includes('conc_tcu_2026'))
    ) {
      Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('gabarita_active_contest');
      return;
    }

    // Regra estrita de isolamento e higienização:
    // Remove qualquer matéria de exemplo pré-carregada ou órfã que não pertença a um concurso existente
    const concursos: Concurso[] = rawConcursos ? JSON.parse(rawConcursos) : [];
    const validConcursoIds = new Set(concursos.map(c => c.id).filter(Boolean));

    const rawDisciplinas = localStorage.getItem(STORAGE_KEYS.DISCIPLINAS);
    if (rawDisciplinas) {
      const disciplinas: Disciplina[] = JSON.parse(rawDisciplinas);
      // Mantém exclusivamente matérias que possuam concursoId válido pertencente à lista de concursos cadastrados
      const cleanedDisciplinas = disciplinas.filter(d => Boolean(d.concursoId && validConcursoIds.has(d.concursoId)));
      
      if (cleanedDisciplinas.length !== disciplinas.length) {
        localStorage.setItem(STORAGE_KEYS.DISCIPLINAS, JSON.stringify(cleanedDisciplinas));
        
        // Remove também assuntos órfãos de disciplinas que foram excluídas
        const validDiscIds = new Set(cleanedDisciplinas.map(d => d.id));
        const rawAssuntos = localStorage.getItem(STORAGE_KEYS.ASSUNTOS);
        if (rawAssuntos) {
          const assuntos: Assunto[] = JSON.parse(rawAssuntos);
          const cleanedAssuntos = assuntos.filter(a => validDiscIds.has(a.disciplinaId));
          localStorage.setItem(STORAGE_KEYS.ASSUNTOS, JSON.stringify(cleanedAssuntos));
        }
      }
    }
  } catch (err) {
    console.warn('Gabarita: Falha na limpeza de dados legados:', err);
  }
}
checkLegacyCleanup();

function loadStored<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) {
      localStorage.setItem(key, JSON.stringify(defaultValue));
      return defaultValue;
    }
    return JSON.parse(item) as T;
  } catch {
    return defaultValue;
  }
}

function saveStored<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn(`Gabarita: Erro ao persistir dados locais para a chave ${key}`, err);
  }
}

export class DatabaseService {
  // --- USER PROFILE & DATA ISOLATION ---
  static async getUserProfile(userId: string): Promise<UserProfile> {
    if (isFirebaseInitialized && db) {
      try {
        const userDocRef = doc(db, 'users', userId);
        const snapshot = await getDoc(userDocRef);
        if (snapshot.exists()) {
          return snapshot.data() as UserProfile;
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${userId}`);
      }
    }
    const current = loadStored<UserProfile>(STORAGE_KEYS.USER, INITIAL_USER);
    if (current && current.id !== userId && userId) {
      return { ...current, id: userId };
    }
    return current;
  }

  static async updateUserProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
    const current = loadStored<UserProfile>(STORAGE_KEYS.USER, INITIAL_USER);
    const updated: UserProfile = {
      ...current,
      ...profile,
      updatedAt: new Date().toISOString(),
    };
    saveStored(STORAGE_KEYS.USER, updated);
    if (isFirebaseInitialized && db) {
      try {
        const userDocRef = doc(db, 'users', updated.id);
        await setDoc(userDocRef, updated, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${updated.id}`);
      }
    }
    return updated;
  }

  // --- ACCOUNT DELETION (Prompt 18 Requirement) ---
  static async deleteAccountData(userId: string): Promise<void> {
    try {
      // Clear localStorage items
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      localStorage.removeItem('gabarita_auth_session');

      if (isFirebaseInitialized && db) {
        const userDocRef = doc(db, 'users', userId);
        await deleteDoc(userDocRef);
      }
    } catch (err) {
      console.warn('Erro ao excluir dados da conta:', err);
    }
  }

  // --- DATA EXPORT (Prompt 18 Requirement) ---
  static async exportUserData(userId: string): Promise<string> {
    const [user, concursos, disciplinas, assuntos, sessoes, revisoes, questoes, metas, simulados, caderno] = await Promise.all([
      this.getUserProfile(userId),
      this.getConcursos(),
      this.getDisciplinas(),
      this.getAssuntos(),
      this.getSessoes(),
      this.getRevisoes(),
      this.getQuestoes(),
      this.getMetas(),
      this.getSimulados(),
      this.getCadernoErros(),
    ]);

    const exportBundle = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      user,
      concursos,
      disciplinas,
      assuntos,
      sessoes,
      revisoes,
      questoes,
      metas,
      simulados,
      cadernoErros: caderno,
    };

    return JSON.stringify(exportBundle, null, 2);
  }

  // --- CONCURSOS ---
  static async getConcursos(): Promise<Concurso[]> {
    let rawList: Concurso[] = [];
    if (isFirebaseInitialized && db) {
      try {
        const querySnapshot = await getDocs(collection(db, 'concursos'));
        if (!querySnapshot.empty) {
          rawList = querySnapshot.docs.map(d => d.data() as Concurso);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'concursos');
      }
    }
    if (rawList.length === 0) {
      rawList = loadStored<Concurso[]>(STORAGE_KEYS.CONCURSOS, INITIAL_CONCURSOS);
    }
    return rawList.map(c => {
      const organ = (c.organ || c.orgao || c.nome || '').trim();
      const title = (c.title && c.title.length === 1 && organ.length > 1)
        ? (c.role ? `${organ} - ${c.role}` : organ)
        : (c.title || c.titulo || organ);
      return {
        ...c,
        organ: organ || c.organ,
        orgao: organ || c.orgao,
        nome: organ || c.nome,
        title: title || c.title,
        titulo: title || c.titulo,
      };
    });
  }

  static async addConcurso(concurso: Omit<Concurso, 'id' | 'createdAt' | 'updatedAt'>): Promise<Concurso> {
    const list = await this.getConcursos();
    const organ = (concurso.organ || concurso.orgao || concurso.nome || '').trim();
    const title = (concurso.title && concurso.title.length === 1 && organ.length > 1)
      ? (concurso.role ? `${organ} - ${concurso.role}` : organ)
      : (concurso.title || concurso.titulo || organ);

    const newConcurso: Concurso = {
      ...concurso,
      organ: organ || concurso.organ,
      orgao: organ || concurso.orgao,
      nome: organ || concurso.nome,
      title: title || concurso.title,
      titulo: title || concurso.titulo,
      id: `conc_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [newConcurso, ...list];
    saveStored(STORAGE_KEYS.CONCURSOS, updated);
    if (isFirebaseInitialized && db) {
      try {
        await setDoc(doc(db, 'concursos', newConcurso.id), newConcurso);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `concursos/${newConcurso.id}`);
      }
    }
    return newConcurso;
  }

  static async updateConcurso(id: string, partial: Partial<Concurso>): Promise<Concurso> {
    const list = await this.getConcursos();
    let updatedItem: Concurso | null = null;
    const updatedList = list.map(c => {
      if (c.id === id) {
        updatedItem = {
          ...c,
          ...partial,
          updatedAt: new Date().toISOString(),
        };
        return updatedItem;
      }
      return c;
    });
    if (!updatedItem) throw new Error('Concurso não encontrado para atualização.');
    saveStored(STORAGE_KEYS.CONCURSOS, updatedList);
    if ((partial.title || partial.role) && (updatedItem as Concurso).active) {
      await this.updateUserProfile({
        targetConcursoTitle: `${(updatedItem as Concurso).organ} - ${(updatedItem as Concurso).role}`,
      });
    }
    if (isFirebaseInitialized && db) {
      try {
        await setDoc(doc(db, 'concursos', id), updatedItem, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `concursos/${id}`);
      }
    }
    return updatedItem;
  }

  static async deleteConcurso(id: string): Promise<Concurso[]> {
    const list = await this.getConcursos();
    const updatedList = list.filter(c => c.id !== id);
    saveStored(STORAGE_KEYS.CONCURSOS, updatedList);
    const provas = await this.getProvas();
    const updatedProvas = provas.filter(p => p.concursoId !== id);
    saveStored(STORAGE_KEYS.PROVAS, updatedProvas);

    // Limpeza estrita em cascata: remove todas as disciplinas e tópicos associados a este concurso
    const disciplinas = await this.getDisciplinas();
    const discIdsToDelete = new Set(disciplinas.filter(d => d.concursoId === id).map(d => d.id));
    const updatedDisciplinas = disciplinas.filter(d => d.concursoId !== id);
    saveStored(STORAGE_KEYS.DISCIPLINAS, updatedDisciplinas);

    const assuntos = await this.getAssuntos();
    const updatedAssuntos = assuntos.filter(a => !discIdsToDelete.has(a.disciplinaId));
    saveStored(STORAGE_KEYS.ASSUNTOS, updatedAssuntos);

    await this.syncActiveContestStorage();
    return updatedList;
  }

  static async getActiveConcurso(): Promise<Concurso | null> {
    const list = await this.getConcursos();
    if (list.length === 0) return null;
    const active = list.find(c => c.active);
    if (active) return active;
    const user = await this.getUserProfile('user_demo_01');
    if (user?.targetConcursoId) {
      const match = list.find(c => c.id === user.targetConcursoId);
      if (match) return match;
    }
    return list[0] || null;
  }

  static async setActiveConcurso(id: string): Promise<{ concursos: Concurso[]; activeConcurso: Concurso }> {
    const list = await this.getConcursos();
    let activeConcurso: Concurso | null = null;
    const updatedList = list.map(c => {
      const isActive = c.id === id;
      if (isActive) activeConcurso = { ...c, active: true };
      return { ...c, active: isActive };
    });
    if (!activeConcurso) throw new Error('Concurso não encontrado para ativação.');
    saveStored(STORAGE_KEYS.CONCURSOS, updatedList);
    await this.updateUserProfile({
      targetConcursoId: (activeConcurso as Concurso).id,
      targetConcursoTitle: `${(activeConcurso as Concurso).organ} - ${(activeConcurso as Concurso).role}`,
    });
    await this.syncActiveContestStorage();
    return { concursos: updatedList, activeConcurso: activeConcurso as Concurso };
  }

  // --- SINGLE SOURCE OF TRUTH (gabarita_active_contest) ---
  static async syncActiveContestStorage(): Promise<any> {
    const concursos = await this.getConcursos();
    const active = concursos.find(c => c.active) || concursos[0];
    if (!active) {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_CONTEST);
      return null;
    }
    const allDisciplinas = await this.getDisciplinas();
    const allAssuntos = await this.getAssuntos();
    const activeDisciplinas = allDisciplinas
      .filter(d => d.concursoId === active.id)
      .map(d => ({
        ...d,
        assuntos: allAssuntos.filter(a => a.disciplinaId === d.id),
      }));

    const bundle = {
      concurso: active,
      disciplinas: activeDisciplinas,
      updatedAt: new Date().toISOString(),
    };
    saveStored(STORAGE_KEYS.ACTIVE_CONTEST, bundle);
    return bundle;
  }

  static async getActiveContestBundle(): Promise<{
    concurso: Concurso;
    disciplinas: (Disciplina & { assuntos: Assunto[] })[];
    updatedAt: string;
  } | null> {
    const bundle = loadStored<any>(STORAGE_KEYS.ACTIVE_CONTEST, null);
    if (bundle && bundle.concurso) {
      return bundle;
    }
    return this.syncActiveContestStorage();
  }

  static async addConcursoWithDisciplinas(
    concursoData: Omit<Concurso, 'id' | 'createdAt' | 'updatedAt'>,
    disciplinasList: Array<{
      name: string;
      weight?: number;
      color?: string;
      code?: string;
      icon?: string;
      topicos?: Array<{
        name: string;
        importance?: AssuntoImportance;
        difficulty?: TopicDifficulty;
        subtopicos?: string[];
        notes?: string;
      }>;
    }>
  ): Promise<{ concurso: Concurso; disciplinas: Disciplina[]; assuntos: Assunto[] }> {
    // 1. Criar e ativar Concurso
    const newConcurso = await this.addConcurso({
      ...concursoData,
      active: true,
    });
    await this.setActiveConcurso(newConcurso.id);

    const createdDisciplinas: Disciplina[] = [];
    const createdAssuntos: Assunto[] = [];

    // 2. Criar Disciplinas e Tópicos vinculados
    const currentDisciplinas = await this.getDisciplinas();
    const currentAssuntos = await this.getAssuntos();

    const newDisciplinasList = [...currentDisciplinas];
    const newAssuntosList = [...currentAssuntos];

    for (let i = 0; i < disciplinasList.length; i++) {
      const discInput = disciplinasList[i];
      const discId = `disc_${Date.now()}_${i}`;
      const newDisc: Disciplina = {
        id: discId,
        concursoId: newConcurso.id,
        name: discInput.name,
        code: discInput.code || discInput.name.slice(0, 4).toUpperCase(),
        color: discInput.color || '#10b981',
        icon: discInput.icon || 'BookOpen',
        weight: discInput.weight || 2.0,
        order: newDisciplinasList.length + 1,
        topicsCount: discInput.topicos?.length || 0,
        completedTopicsCount: 0,
        totalStudyMinutes: 0,
        createdAt: new Date().toISOString(),
      };
      newDisciplinasList.push(newDisc);
      createdDisciplinas.push(newDisc);

      if (discInput.topicos && discInput.topicos.length > 0) {
        for (let j = 0; j < discInput.topicos.length; j++) {
          const topInput = discInput.topicos[j];
          const assId = `ass_${Date.now()}_${i}_${j}`;
          const newAssunto: Assunto = {
            id: assId,
            disciplinaId: discId,
            name: topInput.name,
            order: j + 1,
            masteryLevel: 0,
            totalQuestionsSolved: 0,
            correctQuestionsSolved: 0,
            accuracyRate: 0,
            completed: false,
            status: 'nao_iniciado',
            difficulty: topInput.difficulty || 'media',
            importance: topInput.importance || 'alta',
            notes: topInput.notes || '',
            subtopicos: (topInput.subtopicos || []).map((subName, sIdx) => ({
              id: `sub_${Date.now()}_${i}_${j}_${sIdx}`,
              assuntoId: assId,
              name: subName,
              order: sIdx + 1,
              status: 'nao_iniciado',
              completed: false,
              createdAt: new Date().toISOString(),
            })),
            createdAt: new Date().toISOString(),
          };
          newAssuntosList.push(newAssunto);
          createdAssuntos.push(newAssunto);
        }
      }
    }

    saveStored(STORAGE_KEYS.DISCIPLINAS, newDisciplinasList);
    saveStored(STORAGE_KEYS.ASSUNTOS, newAssuntosList);

    // 3. Sincronizar o JSON Gabarita Active Contest Single Source of Truth
    await this.syncActiveContestStorage();

    return {
      concurso: newConcurso,
      disciplinas: createdDisciplinas,
      assuntos: createdAssuntos,
    };
  }

  // --- PROVAS ANTERIORES CRUD ---
  static async getProvas(concursoId?: string): Promise<Prova[]> {
    const list = loadStored<Prova[]>(STORAGE_KEYS.PROVAS, INITIAL_PROVAS);
    if (concursoId) {
      return list.filter(p => p.concursoId === concursoId);
    }
    return list;
  }

  static async addProva(prova: Omit<Prova, 'id' | 'createdAt'>): Promise<Prova> {
    const list = await this.getProvas();
    const newProva: Prova = {
      ...prova,
      id: `prova_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [newProva, ...list];
    saveStored(STORAGE_KEYS.PROVAS, updated);
    return newProva;
  }

  static async updateProva(id: string, partial: Partial<Prova>): Promise<Prova> {
    const list = await this.getProvas();
    let updatedItem: Prova | null = null;
    const updated = list.map(p => {
      if (p.id === id) {
        updatedItem = { ...p, ...partial };
        return updatedItem;
      }
      return p;
    });
    if (!updatedItem) throw new Error('Prova não encontrada.');
    saveStored(STORAGE_KEYS.PROVAS, updated);
    return updatedItem;
  }

  static async deleteProva(id: string): Promise<Prova[]> {
    const list = await this.getProvas();
    const updated = list.filter(p => p.id !== id);
    saveStored(STORAGE_KEYS.PROVAS, updated);
    return updated;
  }

  // --- DISCIPLINAS & ASSUNTOS ---
  static async getDisciplinas(concursoId?: string): Promise<Disciplina[]> {
    const list = loadStored<Disciplina[]>(STORAGE_KEYS.DISCIPLINAS, INITIAL_DISCIPLINAS);
    if (concursoId) {
      return list.filter(d => d.concursoId === concursoId);
    }
    return list;
  }

  static async addDisciplina(disciplina: Omit<Disciplina, 'id' | 'createdAt' | 'topicsCount' | 'completedTopicsCount' | 'totalStudyMinutes'>): Promise<Disciplina> {
    const list = await this.getDisciplinas();
    let targetConcursoId = disciplina.concursoId;
    if (!targetConcursoId) {
      const active = await this.getActiveConcurso();
      targetConcursoId = active?.id || '';
    }
    const newDisc: Disciplina = {
      ...disciplina,
      concursoId: targetConcursoId,
      id: `disc_${Date.now()}`,
      topicsCount: 0,
      completedTopicsCount: 0,
      totalStudyMinutes: 0,
      createdAt: new Date().toISOString(),
    };
    const updated = [...list, newDisc];
    saveStored(STORAGE_KEYS.DISCIPLINAS, updated);
    await this.syncActiveContestStorage();
    return newDisc;
  }

  static async updateDisciplina(id: string, partial: Partial<Disciplina>): Promise<Disciplina> {
    const list = await this.getDisciplinas();
    let updatedItem: Disciplina | null = null;
    const updated = list.map(d => {
      if (d.id === id) {
        updatedItem = { ...d, ...partial };
        return updatedItem;
      }
      return d;
    });
    if (!updatedItem) throw new Error('Disciplina não encontrada.');
    saveStored(STORAGE_KEYS.DISCIPLINAS, updated);
    await this.syncActiveContestStorage();
    return updatedItem;
  }

  static async deleteDisciplina(id: string): Promise<Disciplina[]> {
    const list = await this.getDisciplinas();
    const updated = list.filter(d => d.id !== id);
    saveStored(STORAGE_KEYS.DISCIPLINAS, updated);
    const assuntos = await this.getAssuntos();
    const updatedAssuntos = assuntos.filter(a => a.disciplinaId !== id);
    saveStored(STORAGE_KEYS.ASSUNTOS, updatedAssuntos);
    await this.syncActiveContestStorage();
    return updated;
  }

  static async duplicateDisciplina(id: string): Promise<{ disciplina: Disciplina; assuntos: Assunto[] }> {
    const disciplinas = await this.getDisciplinas();
    const originalDisc = disciplinas.find(d => d.id === id);
    if (!originalDisc) throw new Error('Disciplina original não encontrada.');
    const newDiscId = `disc_${Date.now()}`;
    const clonedDisc: Disciplina = {
      ...originalDisc,
      id: newDiscId,
      name: `${originalDisc.name} (Cópia)`,
      order: disciplinas.length + 1,
      createdAt: new Date().toISOString(),
    };
    saveStored(STORAGE_KEYS.DISCIPLINAS, [...disciplinas, clonedDisc]);
    const allAssuntos = await this.getAssuntos();
    const discAssuntos = allAssuntos.filter(a => a.disciplinaId === id);
    const clonedAssuntos: Assunto[] = discAssuntos.map((a, idx) => ({
      ...a,
      id: `ass_${Date.now()}_${idx}`,
      disciplinaId: newDiscId,
      subtopicos: a.subtopicos?.map((s, sIdx) => ({
        ...s,
        id: `sub_${Date.now()}_${idx}_${sIdx}`,
      })),
      createdAt: new Date().toISOString(),
    }));
    saveStored(STORAGE_KEYS.ASSUNTOS, [...allAssuntos, ...clonedAssuntos]);
    await this.syncActiveContestStorage();
    return { disciplina: clonedDisc, assuntos: clonedAssuntos };
  }

  static async getAssuntos(disciplinaId?: string): Promise<Assunto[]> {
    const list = loadStored<Assunto[]>(STORAGE_KEYS.ASSUNTOS, INITIAL_ASSUNTOS);
    const seedMap = new Map(INITIAL_ASSUNTOS.filter(a => a.link).map(a => [a.id, a.link]));
    const hydrated = list.map(a => {
      if (a.link === undefined && seedMap.has(a.id)) {
        return { ...a, link: seedMap.get(a.id) };
      }
      return a;
    });
    if (disciplinaId) {
      return hydrated.filter(a => a.disciplinaId === disciplinaId).sort((a, b) => a.order - b.order);
    }
    return hydrated.sort((a, b) => a.order - b.order);
  }

  static async addAssunto(assunto: Omit<Assunto, 'id' | 'createdAt' | 'masteryLevel' | 'totalQuestionsSolved' | 'correctQuestionsSolved' | 'accuracyRate'>): Promise<Assunto> {
    const list = await this.getAssuntos();
    const discAssuntos = list.filter(a => a.disciplinaId === assunto.disciplinaId);
    const newAssunto: Assunto = {
      ...assunto,
      id: `ass_${Date.now()}`,
      order: assunto.order || discAssuntos.length + 1,
      masteryLevel: 0,
      totalQuestionsSolved: 0,
      correctQuestionsSolved: 0,
      accuracyRate: 0,
      status: assunto.status || 'nao_iniciado',
      difficulty: assunto.difficulty || 'media',
      subtopicos: assunto.subtopicos || [],
      createdAt: new Date().toISOString(),
    };
    const updated = [...list, newAssunto];
    saveStored(STORAGE_KEYS.ASSUNTOS, updated);
    await this.syncActiveContestStorage();
    return newAssunto;
  }

  static async updateAssunto(id: string, partial: Partial<Assunto>): Promise<Assunto> {
    const list = await this.getAssuntos();
    let updatedItem: Assunto | null = null;
    const updated = list.map(a => {
      if (a.id === id) {
        updatedItem = { ...a, ...partial };
        if (partial.status) {
          updatedItem.completed = partial.status === 'dominado' || partial.status === 'revisado';
        }
        return updatedItem;
      }
      return a;
    });
    if (!updatedItem) throw new Error('Assunto não encontrado.');
    saveStored(STORAGE_KEYS.ASSUNTOS, updated);
    await this.syncActiveContestStorage();
    return updatedItem;
  }

  static async deleteAssunto(id: string): Promise<Assunto[]> {
    const list = await this.getAssuntos();
    const target = list.find(a => a.id === id);
    const updated = list.filter(a => a.id !== id);
    saveStored(STORAGE_KEYS.ASSUNTOS, updated);
    if (target) {
      const discList = await this.getDisciplinas();
      const discAssuntos = updated.filter(a => a.disciplinaId === target.disciplinaId);
      const dominados = discAssuntos.filter(a => a.completed || a.status === 'dominado' || a.status === 'revisado').length;
      const updatedDisc = discList.map(d => {
        if (d.id === target.disciplinaId) {
          return {
            ...d,
            topicsCount: discAssuntos.length,
            completedTopicsCount: dominados,
          };
        }
        return d;
      });
      saveStored(STORAGE_KEYS.DISCIPLINAS, updatedDisc);
    }
    await this.syncActiveContestStorage();
    return updated;
  }

  static async duplicateAssunto(id: string): Promise<Assunto> {
    const list = await this.getAssuntos();
    const original = list.find(a => a.id === id);
    if (!original) throw new Error('Assunto original não encontrado.');
    const newId = `ass_${Date.now()}`;
    const cloned: Assunto = {
      ...original,
      id: newId,
      name: `${original.name} (Cópia)`,
      order: original.order + 1,
      subtopicos: original.subtopicos?.map((s, idx) => ({
        ...s,
        id: `sub_${Date.now()}_${idx}`,
        assuntoId: newId,
      })),
      createdAt: new Date().toISOString(),
    };
    const updated = [...list, cloned];
    saveStored(STORAGE_KEYS.ASSUNTOS, updated);
    await this.syncActiveContestStorage();
    return cloned;
  }

  static async reorderAssuntos(orderedIds: string[]): Promise<Assunto[]> {
    const list = await this.getAssuntos();
    const updated = list.map(a => {
      const idx = orderedIds.indexOf(a.id);
      if (idx !== -1) {
        return { ...a, order: idx + 1 };
      }
      return a;
    });
    saveStored(STORAGE_KEYS.ASSUNTOS, updated);
    await this.syncActiveContestStorage();
    return updated;
  }

  static async updateAssuntoStatus(id: string, status: TopicStatus): Promise<Assunto> {
    const completed = status === 'dominado' || status === 'revisado';
    return this.updateAssunto(id, {
      status,
      completed,
      lastStudiedAt: new Date().toISOString(),
    });
  }

  // --- SUBTÓPICOS ---
  static async addSubtopico(assuntoId: string, name: string): Promise<Assunto> {
    const list = await this.getAssuntos();
    let updatedAssunto: Assunto | null = null;
    const updated = list.map(a => {
      if (a.id === assuntoId) {
        const subs = a.subtopicos || [];
        const newSub: Subtopico = {
          id: `sub_${Date.now()}`,
          assuntoId,
          name,
          order: subs.length + 1,
          status: 'nao_iniciado',
          difficulty: 'media',
          completed: false,
          createdAt: new Date().toISOString(),
        };
        updatedAssunto = {
          ...a,
          subtopicos: [...subs, newSub],
        };
        return updatedAssunto;
      }
      return a;
    });
    if (!updatedAssunto) throw new Error('Assunto pai não encontrado.');
    saveStored(STORAGE_KEYS.ASSUNTOS, updated);
    return updatedAssunto;
  }

  static async updateSubtopico(assuntoId: string, subtopicoId: string, partial: Partial<Subtopico>): Promise<Assunto> {
    const list = await this.getAssuntos();
    let updatedAssunto: Assunto | null = null;
    const updated = list.map(a => {
      if (a.id === assuntoId) {
        const subs = (a.subtopicos || []).map(s => {
          if (s.id === subtopicoId) {
            const upd = { ...s, ...partial };
            if (partial.status) {
              upd.completed = partial.status === 'dominado' || partial.status === 'revisado';
            }
            return upd;
          }
          return s;
        });
        updatedAssunto = { ...a, subtopicos: subs };
        return updatedAssunto;
      }
      return a;
    });
    if (!updatedAssunto) throw new Error('Assunto ou subtópico não encontrado.');
    saveStored(STORAGE_KEYS.ASSUNTOS, updated);
    return updatedAssunto;
  }

  static async deleteSubtopico(assuntoId: string, subtopicoId: string): Promise<Assunto> {
    const list = await this.getAssuntos();
    let updatedAssunto: Assunto | null = null;
    const updated = list.map(a => {
      if (a.id === assuntoId) {
        const subs = (a.subtopicos || []).filter(s => s.id !== subtopicoId);
        updatedAssunto = { ...a, subtopicos: subs };
        return updatedAssunto;
      }
      return a;
    });
    if (!updatedAssunto) throw new Error('Assunto ou subtópico não encontrado.');
    saveStored(STORAGE_KEYS.ASSUNTOS, updated);
    return updatedAssunto;
  }

  static async toggleAssuntoCompleted(assuntoId: string): Promise<Assunto[]> {
    const list = await this.getAssuntos();
    const updated = list.map(a => {
      if (a.id === assuntoId) {
        const nextCompleted = !a.completed;
        const nextStatus: TopicStatus = nextCompleted ? 'dominado' : 'nao_iniciado';
        return {
          ...a,
          completed: nextCompleted,
          status: nextStatus,
          lastStudiedAt: new Date().toISOString(),
        };
      }
      return a;
    });
    saveStored(STORAGE_KEYS.ASSUNTOS, updated);
    return updated;
  }

  // --- IMPORTAÇÃO DE EDITAL ---
  static async importEditalTree(
    payload: EditalAiImportPayload,
    concursoId?: string,
    mode: 'merge' | 'replace' = 'merge'
  ): Promise<{ disciplinas: Disciplina[]; assuntos: Assunto[] }> {
    const activeConcurso = await this.getActiveConcurso();
    const targetConcursoId = concursoId || activeConcurso?.id || '';
    let currentDisciplinas = await this.getDisciplinas();
    let currentAssuntos = await this.getAssuntos();

    if (mode === 'replace') {
      if (targetConcursoId) {
        const discIdsToRemove = currentDisciplinas.filter(d => d.concursoId === targetConcursoId).map(d => d.id);
        currentDisciplinas = currentDisciplinas.filter(d => d.concursoId !== targetConcursoId);
        currentAssuntos = currentAssuntos.filter(a => !discIdsToRemove.includes(a.disciplinaId));
      } else {
        currentDisciplinas = [];
        currentAssuntos = [];
      }
    }

    const newDisciplinas: Disciplina[] = [];
    const newAssuntos: Assunto[] = [];
    const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

    payload.disciplinas.forEach((discData, dIdx) => {
      let targetDisc = mode === 'merge' 
        ? currentDisciplinas.find(d => d.name.trim().toLowerCase() === discData.name.trim().toLowerCase() && d.concursoId === targetConcursoId)
        : null;
      let discId = targetDisc ? targetDisc.id : `disc_ai_${Date.now()}_${dIdx}`;
      if (!targetDisc) {
        const newDisc: Disciplina = {
          id: discId,
          concursoId: targetConcursoId,
          name: discData.name,
          code: discData.name.substring(0, 4).toUpperCase(),
          color: discData.color || colors[dIdx % colors.length],
          weight: discData.weight || 2.0,
          order: currentDisciplinas.length + newDisciplinas.length + 1,
          topicsCount: discData.topicos.length,
          completedTopicsCount: 0,
          totalStudyMinutes: 0,
          createdAt: new Date().toISOString(),
        };
        newDisciplinas.push(newDisc);
      }

      discData.topicos.forEach((topData, tIdx) => {
        const assId = `ass_ai_${Date.now()}_${dIdx}_${tIdx}`;
        const subs: Subtopico[] = (topData.subtopicos || []).map((subName, sIdx) => ({
          id: `sub_ai_${Date.now()}_${dIdx}_${tIdx}_${sIdx}`,
          assuntoId: assId,
          name: subName,
          order: sIdx + 1,
          status: 'nao_iniciado',
          difficulty: topData.difficulty || 'media',
          completed: false,
          createdAt: new Date().toISOString(),
        }));
        const newAss: Assunto = {
          id: assId,
          disciplinaId: discId,
          name: topData.name,
          order: (targetDisc ? currentAssuntos.filter(a => a.disciplinaId === discId).length : 0) + tIdx + 1,
          importance: topData.importance || 'alta',
          difficulty: topData.difficulty || 'media',
          status: 'nao_iniciado',
          masteryLevel: 0,
          totalQuestionsSolved: 0,
          correctQuestionsSolved: 0,
          accuracyRate: 0,
          completed: false,
          notes: topData.notes || '',
          subtopicos: subs,
          createdAt: new Date().toISOString(),
        };
        newAssuntos.push(newAss);
      });
    });

    const allDisciplinas = [...currentDisciplinas, ...newDisciplinas];
    const allAssuntos = [...currentAssuntos, ...newAssuntos];
    saveStored(STORAGE_KEYS.DISCIPLINAS, allDisciplinas);
    saveStored(STORAGE_KEYS.ASSUNTOS, allAssuntos);
    return { disciplinas: allDisciplinas, assuntos: allAssuntos };
  }

  // --- SESSÕES DE ESTUDO ---
  static async getSessoes(): Promise<SessaoEstudo[]> {
    return loadStored<SessaoEstudo[]>(STORAGE_KEYS.SESSOES, INITIAL_SESSOES);
  }

  static async recordStudySession(session: Omit<SessaoEstudo, 'id' | 'createdAt'>): Promise<SessaoEstudo> {
    const list = await this.getSessoes();
    const disciplinas = await this.getDisciplinas();
    const assuntos = await this.getAssuntos();
    const disc = disciplinas.find(d => d.id === session.disciplinaId);
    const assunto = assuntos.find(a => a.id === session.assuntoId);

    const accuracyRate = (session.questionsAttempted && session.questionsAttempted > 0 && typeof session.questionsCorrect === 'number')
      ? Math.round((session.questionsCorrect / session.questionsAttempted) * 100)
      : undefined;

    const newSession: SessaoEstudo = {
      ...session,
      disciplinaName: session.disciplinaName || disc?.name || 'Geral',
      assuntoName: session.assuntoName || assunto?.name || 'Estudo Dirigido',
      accuracyRate: accuracyRate ?? session.accuracyRate,
      id: `sess_${Date.now()}`,
      createdAt: new Date().toISOString(),
      completedAt: session.completedAt || new Date().toISOString(),
    };

    const updated = [newSession, ...list];
    saveStored(STORAGE_KEYS.SESSOES, updated);

    if (disc) {
      const updatedDisciplinas = disciplinas.map(d => {
        if (d.id === session.disciplinaId) {
          return {
            ...d,
            totalStudyMinutes: (d.totalStudyMinutes || 0) + session.durationMinutes,
          };
        }
        return d;
      });
      saveStored(STORAGE_KEYS.DISCIPLINAS, updatedDisciplinas);
    }

    if (assunto) {
      const updatedAssuntos = assuntos.map(a => {
        if (a.id === session.assuntoId) {
          const newTotalQ = (a.totalQuestionsSolved || 0) + (session.questionsAttempted || 0);
          const newCorrectQ = (a.correctQuestionsSolved || 0) + (session.questionsCorrect || 0);
          const newAcc = newTotalQ > 0 ? Math.round((newCorrectQ / newTotalQ) * 100) : a.accuracyRate || 0;
          return {
            ...a,
            lastStudiedAt: new Date().toISOString(),
            status: a.status === 'nao_iniciado' ? ('em_estudo' as const) : a.status,
            totalQuestionsSolved: newTotalQ,
            correctQuestionsSolved: newCorrectQ,
            accuracyRate: newAcc,
          };
        }
        return a;
      });
      saveStored(STORAGE_KEYS.ASSUNTOS, updatedAssuntos);
    }

    const user = await this.getUserProfile(session.userId);
    const addedXp = Math.floor(session.durationMinutes * 2) + ((session.questionsCorrect || 0) * 5);
    await this.updateUserProfile({
      xp: (user.xp || 0) + addedXp,
      level: Math.floor(((user.xp || 0) + addedXp) / 1000) + 1,
      lastStudyDate: new Date().toISOString(),
    });

    return newSession;
  }

  static async deleteStudySession(sessionId: string): Promise<SessaoEstudo[]> {
    const list = await this.getSessoes();
    const updated = list.filter(s => s.id !== sessionId);
    saveStored(STORAGE_KEYS.SESSOES, updated);
    return updated;
  }

  static async updateStudySession(sessionId: string, partial: Partial<SessaoEstudo>): Promise<SessaoEstudo> {
    const list = await this.getSessoes();
    let updatedItem: SessaoEstudo | null = null;
    const updated = list.map(s => {
      if (s.id === sessionId) {
        updatedItem = { ...s, ...partial };
        return updatedItem;
      }
      return s;
    });
    if (!updatedItem) throw new Error('Sessão não encontrada.');
    saveStored(STORAGE_KEYS.SESSOES, updated);
    return updatedItem;
  }

  // --- REVISÕES & SRS ---
  static async getRevisionSettings(): Promise<RevisionSettings> {
    return loadStored<RevisionSettings>(STORAGE_KEYS.REVISION_SETTINGS, INITIAL_REVISION_SETTINGS);
  }

  static async updateRevisionSettings(partial: Partial<RevisionSettings>): Promise<RevisionSettings> {
    const current = await this.getRevisionSettings();
    const updated: RevisionSettings = { ...current, ...partial };
    saveStored(STORAGE_KEYS.REVISION_SETTINGS, updated);
    return updated;
  }

  static async getRevisoes(): Promise<Revisao[]> {
    const list = loadStored<Revisao[]>(STORAGE_KEYS.REVISOES, INITIAL_REVISOES);
    const todayStr = PlannerService.formatLocalDate(new Date());
    let changed = false;
    const updatedList = list.map(r => {
      const scheduledDateStr = r.scheduledFor.includes('T') ? r.scheduledFor.split('T')[0] : r.scheduledFor;
      if (r.status === 'pendente' && scheduledDateStr < todayStr) {
        changed = true;
        return { ...r, status: 'atrasada' as const };
      }
      return r;
    });
    if (changed) {
      saveStored(STORAGE_KEYS.REVISOES, updatedList);
    }
    return updatedList;
  }

  static async addRevisao(rev: Omit<Revisao, 'id' | 'createdAt'>): Promise<Revisao> {
    const list = await this.getRevisoes();
    const disciplinas = await this.getDisciplinas();
    const disc = disciplinas.find(d => d.id === rev.disciplinaId);
    const newRev: Revisao = {
      ...rev,
      id: `rev_${Date.now()}`,
      disciplinaName: rev.disciplinaName || disc?.name || 'Geral',
      createdAt: new Date().toISOString(),
    };
    const updated = [newRev, ...list];
    saveStored(STORAGE_KEYS.REVISOES, updated);
    return newRev;
  }

  static async updateRevisao(id: string, partial: Partial<Revisao>): Promise<Revisao> {
    const list = await this.getRevisoes();
    let updatedItem: Revisao | null = null;
    const updated = list.map(r => {
      if (r.id === id) {
        updatedItem = { ...r, ...partial, updatedAt: new Date().toISOString() };
        return updatedItem;
      }
      return r;
    });
    if (!updatedItem) throw new Error('Revisão não encontrada.');
    saveStored(STORAGE_KEYS.REVISOES, updated);
    return updatedItem;
  }

  static async deleteRevisao(id: string): Promise<Revisao[]> {
    const list = await this.getRevisoes();
    const updated = list.filter(r => r.id !== id);
    saveStored(STORAGE_KEYS.REVISOES, updated);
    return updated;
  }

  static async completeRevisaoWithPerformance(
    revisaoId: string,
    rating: RevisionRating,
    accuracyRate?: number,
    questionsAttempted?: number,
    questionsCorrect?: number,
    notes?: string
  ): Promise<{ completed: Revisao; nextRevision?: Revisao; allRevisoes: Revisao[] }> {
    const list = await this.getRevisoes();
    const settings = await this.getRevisionSettings();
    const target = list.find(r => r.id === revisaoId);
    if (!target) throw new Error('Revisão não encontrada.');
    const now = new Date();
    const nowIso = now.toISOString();

    const completedRev: Revisao = {
      ...target,
      status: 'concluida',
      rating,
      completedAt: nowIso,
      accuracyRate: accuracyRate ?? (questionsAttempted && questionsAttempted > 0 ? Math.round(((questionsCorrect || 0) / questionsAttempted) * 100) : target.accuracyRate),
      questionsAttempted: questionsAttempted ?? target.questionsAttempted,
      questionsCorrect: questionsCorrect ?? target.questionsCorrect,
      notes: notes !== undefined ? notes : target.notes,
      updatedAt: nowIso,
    };

    let nextRevision: Revisao | undefined = undefined;
    const currentStage = target.stage || 1;
    const intervals = settings.intervalDays && settings.intervalDays.length > 0 
      ? settings.intervalDays 
      : [1, 7, 15, 30, 60];
    const totalStages = target.totalStages || intervals.length;
    let nextDays = 0;
    let nextStage = currentStage;
    let shouldScheduleNext = false;

    if (rating === 'errei' || rating === 'dificil') {
      nextDays = settings.hardPenaltyDays || 1;
      nextStage = 1;
      shouldScheduleNext = true;
    } else if (currentStage < totalStages) {
      nextStage = currentStage + 1;
      const baseInterval = intervals[nextStage - 1] || (intervals[intervals.length - 1] * 2);
      if (rating === 'facil' && settings.performanceAdaptive) {
        nextDays = Math.round(baseInterval * (settings.easeMultiplier || 1.8));
      } else {
        nextDays = baseInterval;
      }
      shouldScheduleNext = true;
    }

    if (shouldScheduleNext && nextDays > 0) {
      const nextDate = new Date(now.getTime() + nextDays * 86400000);
      const nextDateStr = PlannerService.formatLocalDate(nextDate);
      nextRevision = {
        id: `rev_srs_${Date.now()}`,
        userId: target.userId,
        disciplinaId: target.disciplinaId,
        disciplinaName: target.disciplinaName,
        assuntoId: target.assuntoId,
        assuntoName: target.assuntoName,
        method: nextDays <= 1 ? '24h' : nextDays <= 7 ? '7d' : nextDays <= 15 ? '15d' : nextDays <= 30 ? '30d' : '60d',
        stage: nextStage,
        totalStages,
        intervalDays: nextDays,
        scheduledFor: nextDateStr,
        status: 'pendente',
        isAutomatic: true,
        notes: `SRS Etapa ${nextStage}/${totalStages} (${nextDays}d após rating ${rating.toUpperCase()}).`,
        createdAt: nowIso,
      };
      completedRev.nextRevisionId = nextRevision.id;
    }

    const updatedList = list.map(r => r.id === revisaoId ? completedRev : r);
    if (nextRevision) {
      updatedList.unshift(nextRevision);
    }
    saveStored(STORAGE_KEYS.REVISOES, updatedList);

    if (target.assuntoId) {
      const assuntos = await this.getAssuntos();
      const updatedAssuntos = assuntos.map(a => {
        if (a.id === target.assuntoId) {
          return {
            ...a,
            lastStudiedAt: nowIso,
            status: a.status === 'nao_iniciado' ? ('em_estudo' as const) : a.status,
          };
        }
        return a;
      });
      saveStored(STORAGE_KEYS.ASSUNTOS, updatedAssuntos);
    }

    const user = await this.getUserProfile(target.userId);
    const bonusXp = (questionsCorrect || 0) * 5;
    const addedXp = 30 + bonusXp;
    await this.updateUserProfile({
      xp: (user.xp || 0) + addedXp,
      level: Math.floor(((user.xp || 0) + addedXp) / 1000) + 1,
      lastStudyDate: nowIso,
    });

    return {
      completed: completedRev,
      nextRevision,
      allRevisoes: updatedList,
    };
  }

  static async batchRescheduleOverdueRevisoes(targetDateStr?: string): Promise<Revisao[]> {
    const list = await this.getRevisoes();
    const todayStr = targetDateStr || PlannerService.formatLocalDate(new Date());
    const updated = list.map(r => {
      const sDate = r.scheduledFor.includes('T') ? r.scheduledFor.split('T')[0] : r.scheduledFor;
      if (r.status === 'atrasada' || (r.status === 'pendente' && sDate < todayStr)) {
        return {
          ...r,
          scheduledFor: todayStr,
          status: 'pendente' as const,
          notes: r.notes ? `${r.notes} (Reagendada para hoje)` : 'Reagendada para hoje.',
          updatedAt: new Date().toISOString(),
        };
      }
      return r;
    });
    saveStored(STORAGE_KEYS.REVISOES, updated);
    return updated;
  }

  static async gerarCicloCompletoRevisao(
    userId: string,
    disciplinaId: string,
    assuntoId?: string,
    assuntoName?: string
  ): Promise<Revisao[]> {
    const list = await this.getRevisoes();
    const settings = await this.getRevisionSettings();
    const disciplinas = await this.getDisciplinas();
    const disc = disciplinas.find(d => d.id === disciplinaId);
    const intervals = settings.intervalDays && settings.intervalDays.length > 0 
      ? settings.intervalDays 
      : [1, 7, 15, 30, 60];
    const firstDays = intervals[0] || 1;
    const firstDate = new Date(Date.now() + firstDays * 86400000);
    const firstDateStr = PlannerService.formatLocalDate(firstDate);
    const firstRev: Revisao = {
      id: `rev_srs_${Date.now()}`,
      userId,
      disciplinaId,
      disciplinaName: disc?.name || 'Geral',
      assuntoId,
      assuntoName: assuntoName || 'Geral',
      method: firstDays <= 1 ? '24h' : '7d',
      stage: 1,
      totalStages: intervals.length,
      intervalDays: firstDays,
      scheduledFor: firstDateStr,
      status: 'pendente',
      isAutomatic: true,
      notes: `SRS Ciclo Inicial 24h para fixação de ${assuntoName || 'conteúdo'}.`,
      createdAt: new Date().toISOString(),
    };
    const updated = [firstRev, ...list];
    saveStored(STORAGE_KEYS.REVISOES, updated);
    return updated;
  }

  // --- QUESTÕES & BLOCOS ---
  static async getQuestoes(): Promise<Questao[]> {
    return loadStored<Questao[]>(STORAGE_KEYS.QUESTOES, INITIAL_QUESTOES);
  }

  static async getBlocosQuestoes(): Promise<RegistroBlocoQuestoes[]> {
    return loadStored<RegistroBlocoQuestoes[]>(STORAGE_KEYS.BLOCOS_QUESTOES, INITIAL_BLOCOS_QUESTOES);
  }

  static async recordBlocoQuestoes(
    bloco: Omit<RegistroBlocoQuestoes, 'id' | 'createdAt' | 'wrongAnswers' | 'accuracyRate'>
  ): Promise<RegistroBlocoQuestoes> {
    const list = await this.getBlocosQuestoes();
    const disciplinas = await this.getDisciplinas();
    const assuntos = await this.getAssuntos();
    const disc = disciplinas.find(d => d.id === bloco.disciplinaId);
    const assunto = assuntos.find(a => a.id === bloco.assuntoId);
    const wrongAnswers = Math.max(0, bloco.totalQuestions - bloco.correctAnswers);
    const accuracyRate = bloco.totalQuestions > 0 
      ? Math.round((bloco.correctAnswers / bloco.totalQuestions) * 100) 
      : 0;

    const newBloco: RegistroBlocoQuestoes = {
      ...bloco,
      disciplinaName: bloco.disciplinaName || disc?.name || 'Geral',
      assuntoName: bloco.assuntoName || assunto?.name || 'Geral',
      wrongAnswers,
      accuracyRate,
      id: `bloco_q_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [newBloco, ...list];
    saveStored(STORAGE_KEYS.BLOCOS_QUESTOES, updated);

    if (assunto) {
      const updatedAssuntos = assuntos.map(a => {
        if (a.id === bloco.assuntoId) {
          const newTotalQ = (a.totalQuestionsSolved || 0) + bloco.totalQuestions;
          const newCorrectQ = (a.correctQuestionsSolved || 0) + bloco.correctAnswers;
          const newAcc = newTotalQ > 0 ? Math.round((newCorrectQ / newTotalQ) * 100) : a.accuracyRate || 0;
          return {
            ...a,
            lastStudiedAt: new Date().toISOString(),
            totalQuestionsSolved: newTotalQ,
            correctQuestionsSolved: newCorrectQ,
            accuracyRate: newAcc,
            status: a.status === 'nao_iniciado' ? ('em_estudo' as const) : a.status,
          };
        }
        return a;
      });
      saveStored(STORAGE_KEYS.ASSUNTOS, updatedAssuntos);
    }

    if (bloco.durationMinutes && bloco.durationMinutes > 0 && disc) {
      const updatedDisciplinas = disciplinas.map(d => {
        if (d.id === bloco.disciplinaId) {
          return {
            ...d,
            totalStudyMinutes: (d.totalStudyMinutes || 0) + (bloco.durationMinutes || 0),
          };
        }
        return d;
      });
      saveStored(STORAGE_KEYS.DISCIPLINAS, updatedDisciplinas);
    }

    const user = await this.getUserProfile(bloco.userId);
    const addedXp = (bloco.correctAnswers * 5) + (bloco.totalQuestions * 1);
    await this.updateUserProfile({
      xp: (user.xp || 0) + addedXp,
      level: Math.floor(((user.xp || 0) + addedXp) / 1000) + 1,
      lastStudyDate: new Date().toISOString(),
    });

    return newBloco;
  }

  static async deleteBlocoQuestoes(blocoId: string): Promise<RegistroBlocoQuestoes[]> {
    const list = await this.getBlocosQuestoes();
    const updated = list.filter(b => b.id !== blocoId);
    saveStored(STORAGE_KEYS.BLOCOS_QUESTOES, updated);
    return updated;
  }

  static async updateBlocoQuestoes(
    blocoId: string, 
    partial: Partial<RegistroBlocoQuestoes>
  ): Promise<RegistroBlocoQuestoes> {
    const list = await this.getBlocosQuestoes();
    let updatedItem: RegistroBlocoQuestoes | null = null;
    const updated = list.map(b => {
      if (b.id === blocoId) {
        const merged = { ...b, ...partial };
        if (typeof partial.totalQuestions === 'number' || typeof partial.correctAnswers === 'number') {
          merged.wrongAnswers = Math.max(0, merged.totalQuestions - merged.correctAnswers);
          merged.accuracyRate = merged.totalQuestions > 0 
            ? Math.round((merged.correctAnswers / merged.totalQuestions) * 100) 
            : 0;
        }
        updatedItem = merged;
        return merged;
      }
      return b;
    });
    if (!updatedItem) throw new Error('Bloco de questões não encontrado.');
    saveStored(STORAGE_KEYS.BLOCOS_QUESTOES, updated);
    return updatedItem;
  }

  // --- CADERNO DE ERROS ---
  static async getCadernoErros(): Promise<ItemCadernoErros[]> {
    return loadStored<ItemCadernoErros[]>(STORAGE_KEYS.CADERNO_ERROS, INITIAL_CADERNO_ERROS);
  }

  static async addCadernoErro(
    item: Omit<ItemCadernoErros, 'id' | 'createdAt' | 'updatedAt' | 'reincidenciaCount'> & { reincidenciaCount?: number }
  ): Promise<ItemCadernoErros> {
    const list = await this.getCadernoErros();
    const disciplinas = await this.getDisciplinas();
    const assuntos = await this.getAssuntos();
    const disc = disciplinas.find(d => d.id === item.disciplinaId);
    const assunto = assuntos.find(a => a.id === item.assuntoId);
    const now = new Date().toISOString();
    const newErro: ItemCadernoErros = {
      ...item,
      id: `err_${Date.now()}`,
      disciplinaName: item.disciplinaName || disc?.name || 'Geral',
      assuntoName: item.assuntoName || assunto?.name || 'Geral',
      reincidenciaCount: Math.max(1, item.reincidenciaCount || 1),
      statusRevisao: item.statusRevisao || 'pendente',
      createdAt: now,
      updatedAt: now,
    };
    const updated = [newErro, ...list];
    saveStored(STORAGE_KEYS.CADERNO_ERROS, updated);
    return newErro;
  }

  static async updateCadernoErro(id: string, partial: Partial<ItemCadernoErros>): Promise<ItemCadernoErros> {
    const list = await this.getCadernoErros();
    let updatedItem: ItemCadernoErros | null = null;
    const updated = list.map(e => {
      if (e.id === id) {
        updatedItem = {
          ...e,
          ...partial,
          updatedAt: new Date().toISOString(),
        };
        return updatedItem;
      }
      return e;
    });
    if (!updatedItem) throw new Error('Item do Caderno de Erros não encontrado.');
    saveStored(STORAGE_KEYS.CADERNO_ERROS, updated);
    return updatedItem;
  }

  static async deleteCadernoErro(id: string): Promise<ItemCadernoErros[]> {
    const list = await this.getCadernoErros();
    const updated = list.filter(e => e.id !== id);
    saveStored(STORAGE_KEYS.CADERNO_ERROS, updated);
    return updated;
  }

  static async incrementarReincidenciaErro(id: string): Promise<ItemCadernoErros> {
    const list = await this.getCadernoErros();
    let updatedItem: ItemCadernoErros | null = null;
    const updated = list.map(e => {
      if (e.id === id) {
        updatedItem = {
          ...e,
          reincidenciaCount: (e.reincidenciaCount || 1) + 1,
          statusRevisao: 'pendente',
          updatedAt: new Date().toISOString(),
        };
        return updatedItem;
      }
      return e;
    });
    if (!updatedItem) throw new Error('Item do Caderno de Erros não encontrado.');
    saveStored(STORAGE_KEYS.CADERNO_ERROS, updated);
    return updatedItem;
  }

  static async marcarStatusRevisaoErro(id: string, novoStatus: ErroStatusRevisao): Promise<ItemCadernoErros> {
    const list = await this.getCadernoErros();
    let updatedItem: ItemCadernoErros | null = null;
    const updated = list.map(e => {
      if (e.id === id) {
        updatedItem = {
          ...e,
          statusRevisao: novoStatus,
          lastReviewedAt: novoStatus !== 'pendente' ? new Date().toISOString() : e.lastReviewedAt,
          updatedAt: new Date().toISOString(),
        };
        return updatedItem;
      }
      return e;
    });
    if (!updatedItem) throw new Error('Item do Caderno de Erros não encontrado.');
    saveStored(STORAGE_KEYS.CADERNO_ERROS, updated);
    return updatedItem;
  }

  static async agendarRevisaoDoAssunto(
    userId: string,
    disciplinaId: string, 
    assuntoName: string, 
    method: '24h' | '7d' | '30d' = '24h',
    notes?: string
  ): Promise<Revisao> {
    const list = await this.getRevisoes();
    const disciplinas = await this.getDisciplinas();
    const disc = disciplinas.find(d => d.id === disciplinaId);
    const newRev: Revisao = {
      id: `rev_err_${Date.now()}`,
      userId,
      disciplinaId,
      disciplinaName: disc?.name || 'Geral',
      assuntoName,
      method,
      scheduledFor: new Date().toISOString().split('T')[0],
      status: 'pendente',
      notes: notes || `Revisão focada gerada a partir do Caderno de Erros.`,
      createdAt: new Date().toISOString(),
    };
    const updated = [newRev, ...list];
    saveStored(STORAGE_KEYS.REVISOES, updated);
    return newRev;
  }

  // --- METAS, CONQUISTAS, MARCOS & ESTATÍSTICAS REAIS ---
  static async getMetas(): Promise<Meta[]> {
    const list = loadStored<Meta[]>(STORAGE_KEYS.METAS, INITIAL_METAS);
    const stats = await this.getEstatisticasProgressoReal('user_demo_01');
    const nowIso = new Date().toISOString();
    const updated = list.map(m => {
      let calcValue = m.currentValue;
      if (m.targetType === 'horas' || m.targetType === 'horas_semanais') {
        if (m.period === 'diaria') calcValue = stats.horasHoje;
        else if (m.period === 'semanal') calcValue = stats.horasSemana;
        else if (m.period === 'mensal') calcValue = stats.horasMes;
      } else if (m.targetType === 'questoes' || m.targetType === 'questoes_resolvidas') {
        if (m.period === 'diaria') calcValue = stats.questoesHoje;
        else if (m.period === 'semanal') calcValue = stats.questoesSemana;
        else if (m.period === 'mensal') calcValue = stats.questoesMes;
      } else if (m.targetType === 'revisoes') {
        if (m.period === 'diaria') calcValue = stats.revisoesHoje;
        else if (m.period === 'semanal') calcValue = stats.revisoesSemana;
        else if (m.period === 'mensal') calcValue = stats.revisoesMes;
      } else if (m.targetType === 'taxa_acerto') {
        calcValue = stats.taxaAcertoGeral;
      } else if (m.targetType === 'topicos_concluidos') {
        calcValue = stats.topicosConcluidos;
      }
      const isCompleted = calcValue >= m.targetValue;
      return {
        ...m,
        currentValue: calcValue,
        status: isCompleted ? ('concluida' as const) : m.status === 'concluida' ? ('concluida' as const) : ('em_progresso' as const),
        completedAt: isCompleted && !m.completedAt ? nowIso : m.completedAt,
      };
    });
    saveStored(STORAGE_KEYS.METAS, updated);
    return updated;
  }

  static async addMeta(meta: Omit<Meta, 'id' | 'createdAt'>): Promise<Meta> {
    const list = await this.getMetas();
    const newMeta: Meta = {
      ...meta,
      id: `meta_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [newMeta, ...list];
    saveStored(STORAGE_KEYS.METAS, updated);
    return newMeta;
  }

  static async updateMeta(id: string, partial: Partial<Meta>): Promise<Meta> {
    const list = await this.getMetas();
    let updatedMeta: Meta | null = null;
    const updated = list.map(m => {
      if (m.id === id) {
        updatedMeta = { ...m, ...partial };
        return updatedMeta;
      }
      return m;
    });
    if (!updatedMeta) throw new Error('Meta não encontrada');
    saveStored(STORAGE_KEYS.METAS, updated);
    return updatedMeta;
  }

  static async deleteMeta(id: string): Promise<Meta[]> {
    const list = await this.getMetas();
    const updated = list.filter(m => m.id !== id);
    saveStored(STORAGE_KEYS.METAS, updated);
    return updated;
  }

  static async getConquistas(): Promise<Conquista[]> {
    const list = loadStored<Conquista[]>(STORAGE_KEYS.CONQUISTAS, INITIAL_CONQUISTAS);
    const stats = await this.getEstatisticasProgressoReal('user_demo_01');
    const simulados = await this.getSimulados();
    const caderno = await this.getCadernoErros();
    const nowIso = new Date().toISOString();
    const finishedSimulados = simulados.filter(s => s.status === 'finalizado');
    const errosDominados = caderno.filter(e => e.statusRevisao === 'dominado').length;

    const updated = list.map(ach => {
      let current = ach.currentValue;
      if (ach.id === 'ach_first_step') {
        current = stats.horasTotal > 0 ? 1 : 0;
      } else if (ach.id === 'ach_centuriao_questoes') {
        current = stats.questoesTotal;
      } else if (ach.id === 'ach_mestre_questoes') {
        current = stats.questoesTotal;
      } else if (ach.id === 'ach_ritmo_aco') {
        current = stats.streakDias;
      } else if (ach.id === 'ach_habito_inabalavel') {
        current = stats.streakDias;
      } else if (ach.id === 'ach_revisor_implacavel') {
        current = stats.revisoesTotal;
      } else if (ach.id === 'ach_gabaritando_alto') {
        current = stats.taxaAcertoGeral;
      } else if (ach.id === 'ach_caderno_limpo') {
        current = errosDominados;
      } else if (ach.id === 'ach_simulado_real') {
        current = finishedSimulados.length;
      }
      const shouldUnlock = current >= ach.requiredValue;
      return {
        ...ach,
        currentValue: current,
        unlocked: ach.unlocked || shouldUnlock,
        unlockedAt: ach.unlocked ? ach.unlockedAt : shouldUnlock ? nowIso : undefined,
      };
    });
    saveStored(STORAGE_KEYS.CONQUISTAS, updated);
    return updated;
  }

  static async getMarcos(): Promise<MarcoEstudo[]> {
    const list = loadStored<MarcoEstudo[]>(STORAGE_KEYS.MARCOS, INITIAL_MARCOS);
    const stats = await this.getEstatisticasProgressoReal('user_demo_01');
    const simulados = await this.getSimulados();
    const finishedSimulados = simulados.filter(s => s.status === 'finalizado').length;
    const nowIso = new Date().toISOString();

    const updated = list.map(marco => {
      let current = marco.currentValue;
      if (marco.category === 'simulados') {
        current = finishedSimulados;
      } else if (marco.category === 'horas') {
        current = stats.horasTotal;
      } else if (marco.category === 'questoes') {
        current = stats.questoesTotal;
      } else if (marco.category === 'edital') {
        current = stats.percentualEdital;
      }
      const isCompleted = current >= marco.targetValue;
      return {
        ...marco,
        currentValue: current,
        isCompleted: marco.isCompleted || isCompleted,
        completedAt: marco.isCompleted ? marco.completedAt : isCompleted ? nowIso : undefined,
      };
    });
    saveStored(STORAGE_KEYS.MARCOS, updated);
    return updated;
  }

  static async getEstatisticasProgressoReal(userId: string): Promise<EstatisticasProgressoReal> {
    const [
      user,
      sessoes,
      blocosQuestoes,
      revisoes,
      assuntos,
      simulados
    ] = await Promise.all([
      this.getUserProfile(userId),
      this.getSessoes(),
      this.getBlocosQuestoes(),
      this.getRevisoes(),
      this.getAssuntos(),
      this.getSimulados()
    ]);

    const now = new Date();
    const todayStr = PlannerService.formatLocalDate(now);
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const mondayStr = PlannerService.formatLocalDate(monday);
    const firstDayMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`;

    let minutosHoje = 0;
    let minutosSemana = 0;
    let minutosMes = 0;
    let minutosTotal = 0;

    sessoes.forEach((s: SessaoEstudo) => {
      const sDate = s.completedAt ? s.completedAt.split('T')[0] : (s.createdAt ? s.createdAt.split('T')[0] : '');
      const min = s.durationMinutes || 0;
      minutosTotal += min;
      if (sDate === todayStr) minutosHoje += min;
      if (sDate >= mondayStr) minutosSemana += min;
      if (sDate >= firstDayMonthStr) minutosMes += min;
    });

    simulados.filter((sim: Simulado) => sim.status === 'finalizado').forEach((sim: Simulado) => {
      const simDate = sim.finishedAt ? sim.finishedAt.split('T')[0] : (sim.startedAt ? sim.startedAt.split('T')[0] : '');
      const simMin = Math.round((sim.elapsedSeconds || (sim.durationMinutes * 60)) / 60);
      minutosTotal += simMin;
      if (simDate === todayStr) minutosHoje += simMin;
      if (simDate >= mondayStr) minutosSemana += simMin;
      if (simDate >= firstDayMonthStr) minutosMes += simMin;
    });

    let questoesHoje = 0;
    let questoesSemana = 0;
    let questoesMes = 0;
    let questoesTotal = 0;
    let acertosTotal = 0;

    blocosQuestoes.forEach((b: RegistroBlocoQuestoes) => {
      const bDate = b.date || (b.createdAt ? b.createdAt.split('T')[0] : '');
      const tot = b.totalQuestions || 0;
      const cor = b.correctAnswers || 0;
      questoesTotal += tot;
      acertosTotal += cor;
      if (bDate === todayStr) questoesHoje += tot;
      if (bDate >= mondayStr) questoesSemana += tot;
      if (bDate >= firstDayMonthStr) questoesMes += tot;
    });

    simulados.filter((sim: Simulado) => sim.status === 'finalizado').forEach((sim: Simulado) => {
      const simDate = sim.finishedAt ? sim.finishedAt.split('T')[0] : '';
      const tot = sim.questionsCount || (sim.questoes?.length || 0);
      const cor = sim.totalCorrect || 0;
      questoesTotal += tot;
      acertosTotal += cor;
      if (simDate === todayStr) questoesHoje += tot;
      if (simDate >= mondayStr) questoesSemana += tot;
      if (simDate >= firstDayMonthStr) questoesMes += tot;
    });

    const taxaAcertoGeral = questoesTotal > 0 ? Math.round((acertosTotal / questoesTotal) * 100) : 80;

    let revisoesHoje = 0;
    let revisoesSemana = 0;
    let revisoesMes = 0;
    let revisoesTotal = 0;

    revisoes.filter((r: Revisao) => r.status === 'concluida').forEach((r: Revisao) => {
      const rDate = r.completedAt ? r.completedAt.split('T')[0] : (r.scheduledFor ? r.scheduledFor.split('T')[0] : '');
      revisoesTotal++;
      if (rDate === todayStr) revisoesHoje++;
      if (rDate >= mondayStr) revisoesSemana++;
      if (rDate >= firstDayMonthStr) revisoesMes++;
    });

    const activeDatesSet = new Set<string>();
    sessoes.forEach((s: SessaoEstudo) => {
      const d = s.completedAt ? s.completedAt.split('T')[0] : (s.createdAt ? s.createdAt.split('T')[0] : '');
      if (d) activeDatesSet.add(d);
    });
    blocosQuestoes.forEach((b: RegistroBlocoQuestoes) => {
      const d = b.date || (b.createdAt ? b.createdAt.split('T')[0] : '');
      if (d) activeDatesSet.add(d);
    });
    revisoes.filter((r: Revisao) => r.status === 'concluida').forEach((r: Revisao) => {
      const d = r.completedAt ? r.completedAt.split('T')[0] : '';
      if (d) activeDatesSet.add(d);
    });
    simulados.filter((s: Simulado) => s.status === 'finalizado').forEach((s: Simulado) => {
      const d = s.finishedAt ? s.finishedAt.split('T')[0] : '';
      if (d) activeDatesSet.add(d);
    });

    let streakCount = 0;
    let checkDate = new Date(now);
    const hasToday = activeDatesSet.has(todayStr);
    if (!hasToday) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    while (true) {
      const dStr = PlannerService.formatLocalDate(checkDate);
      if (activeDatesSet.has(dStr)) {
        streakCount++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    if (hasToday && streakCount === 0) streakCount = 1;
    const finalStreak = Math.max(streakCount, user.streakDays || 1);

    const diasSemanaNomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const diasAtivosUltimaSemana = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dStr = PlannerService.formatLocalDate(d);
      const diaNome = diasSemanaNomes[d.getDay()];
      let minNoDia = 0;
      sessoes.filter((s: SessaoEstudo) => (s.completedAt ? s.completedAt.split('T')[0] : (s.createdAt ? s.createdAt.split('T')[0] : '')) === dStr).forEach((s: SessaoEstudo) => minNoDia += s.durationMinutes || 0);
      simulados.filter((s: Simulado) => s.status === 'finalizado' && s.finishedAt?.split('T')[0] === dStr).forEach((s: Simulado) => minNoDia += Math.round((s.elapsedSeconds || 0) / 60));
      diasAtivosUltimaSemana.push({
        data: dStr,
        diaSemana: diaNome,
        estudou: activeDatesSet.has(dStr) || minNoDia > 0,
        minutos: minNoDia,
      });
    }

    const totalTopicos = assuntos.length || 1;
    const topicosConcluidos = assuntos.filter((a: Assunto) => a.status === 'dominado' || a.status === 'revisado').length;
    const percentualEdital = Math.round((topicosConcluidos / totalTopicos) * 100);

    const xpTotal = user.xp || 3420;
    const nivelAtual = Math.floor(xpTotal / 1000) + 1;
    const xpNivelAtual = xpTotal % 1000;
    const xpProximoNivel = 1000;
    const percentualNivel = Math.round((xpNivelAtual / xpProximoNivel) * 100);
    const titulosPorNivel = [
      'Iniciante Concurseiro',
      'Estudante Comprometido',
      'Gabaritador em Ascensão',
      'Especialista em Editais',
      'Futuro Servidor de Elite',
      'Mestre da Aprovação'
    ];
    const tituloNivel = titulosPorNivel[Math.min(nivelAtual - 1, titulosPorNivel.length - 1)];

    return {
      horasHoje: Math.round((minutosHoje / 60) * 10) / 10,
      horasSemana: Math.round((minutosSemana / 60) * 10) / 10,
      horasMes: Math.round((minutosMes / 60) * 10) / 10,
      horasTotal: Math.round((minutosTotal / 60) * 10) / 10,
      questoesHoje,
      questoesSemana,
      questoesMes,
      questoesTotal,
      acertosTotal,
      taxaAcertoGeral,
      revisoesHoje,
      revisoesSemana,
      revisoesMes,
      revisoesTotal,
      streakDias: finalStreak,
      melhorStreakDias: Math.max(finalStreak, 21),
      diasAtivosUltimaSemana,
      topicosConcluidos,
      topicosTotal: totalTopicos,
      percentualEdital,
      xpTotal,
      nivelAtual,
      tituloNivel,
      xpProximoNivel,
      xpNivelAtual,
      percentualNivel,
    };
  }

  // --- SIMULADOS ---
  static async getSimulados(): Promise<Simulado[]> {
    const list = loadStored<Simulado[]>(STORAGE_KEYS.SIMULADOS, INITIAL_SIMULADOS);
    if (!list || list.length === 0 || (list.length < 3 && !list.some(s => s.id === 'sim_05'))) {
      saveStored(STORAGE_KEYS.SIMULADOS, INITIAL_SIMULADOS);
      return INITIAL_SIMULADOS;
    }
    return list;
  }

  static async getSimuladoById(id: string): Promise<Simulado | null> {
    const list = await this.getSimulados();
    return list.find(s => s.id === id) || null;
  }

  static async createSimulado(data: {
    userId: string;
    concursoId?: string;
    concursoName?: string;
    title: string;
    description?: string;
    banca?: string;
    modalidade?: 'multipla_escolha' | 'certo_errado';
    cebraspePenalty?: boolean;
    durationMinutes: number;
    disciplinasConfig?: SimuladoDisciplinaConfig[];
    status?: SimuladoStatus;
    customQuestoes?: SimuladoQuestao[];
    questionsCount?: number;
    totalCorrect?: number;
    totalWrong?: number;
    totalBlank?: number;
    accuracyRate?: number;
    score?: number;
    maxScore?: number;
    desempenhoPorDisciplina?: SimuladoDesempenhoDisciplina[];
    finishedAt?: string;
    createdAt?: string;
  }): Promise<Simulado> {
    const list = await this.getSimulados();
    const modalidade = data.modalidade || 'multipla_escolha';
    const createdAt = data.createdAt || new Date().toISOString();
    const finishedAt = data.finishedAt || (data.status === 'finalizado' ? createdAt : undefined);

    // Se já é um simulado registrado com desempenho por disciplina
    if (data.desempenhoPorDisciplina && data.desempenhoPorDisciplina.length > 0) {
      const questionsCount = data.questionsCount || data.desempenhoPorDisciplina.reduce((acc, d) => acc + (d.totalQuestoes || 0), 0);
      const totalCorrect = data.totalCorrect !== undefined ? data.totalCorrect : data.desempenhoPorDisciplina.reduce((acc, d) => acc + (d.acertos || 0), 0);
      const totalWrong = data.totalWrong !== undefined ? data.totalWrong : data.desempenhoPorDisciplina.reduce((acc, d) => acc + (d.erros || 0), 0);
      const totalBlank = data.totalBlank !== undefined ? data.totalBlank : data.desempenhoPorDisciplina.reduce((acc, d) => acc + (d.brancos || 0), 0);
      const accuracyRate = data.accuracyRate !== undefined 
        ? data.accuracyRate 
        : questionsCount > 0 ? Math.round((totalCorrect / questionsCount) * 100) : 0;
      const score = data.score !== undefined ? data.score : (totalCorrect - totalWrong);

      const newSimulado: Simulado = {
        id: `sim_${Date.now()}`,
        userId: data.userId,
        concursoId: data.concursoId,
        concursoName: data.concursoName,
        title: data.title,
        description: data.description || '',
        banca: data.banca || 'FGV',
        modalidade,
        cebraspePenalty: data.cebraspePenalty || false,
        questionsCount,
        durationMinutes: data.durationMinutes || 180,
        elapsedSeconds: (data.durationMinutes || 180) * 60,
        score,
        maxScore: data.maxScore || questionsCount,
        accuracyRate,
        totalCorrect,
        totalWrong,
        totalBlank,
        desempenhoPorDisciplina: data.desempenhoPorDisciplina,
        status: data.status || 'finalizado',
        createdAt,
        finishedAt,
        updatedAt: new Date().toISOString(),
      };

      const updated = [newSimulado, ...list];
      saveStored(STORAGE_KEYS.SIMULADOS, updated);
      return newSimulado;
    }

    const allDisciplinas = await this.getDisciplinas();
    const allAssuntos = await this.getAssuntos();
    const allBancoQuestoes = await this.getQuestoes();
    let questionsCount = 0;
    const questoes: SimuladoQuestao[] = [];

    if (data.customQuestoes && data.customQuestoes.length > 0) {
      questoes.push(...data.customQuestoes.map((q, idx) => ({ ...q, numero: idx + 1 })));
      questionsCount = questoes.length;
    } else if (data.disciplinasConfig && data.disciplinasConfig.length > 0) {
      let numeroAtual = 1;
      for (const discConfig of data.disciplinasConfig) {
        const disc = allDisciplinas.find(d => d.id === discConfig.disciplinaId);
        const discName = discConfig.disciplinaName || disc?.name || 'Disciplina Geral';
        const discAssuntos = allAssuntos.filter(a => a.disciplinaId === discConfig.disciplinaId);
        const bancoMatching = allBancoQuestoes.filter(q => q.disciplinaId === discConfig.disciplinaId);

        for (let i = 0; i < discConfig.questionsCount; i++) {
          const matchingQuestao = bancoMatching[i % Math.max(1, bancoMatching.length)];
          const targetAssunto = discAssuntos.length > 0 ? discAssuntos[i % discAssuntos.length] : undefined;

          if (matchingQuestao && modalidade === 'multipla_escolha') {
            questoes.push({
              id: `sq_${Date.now()}_${numeroAtual}`,
              numero: numeroAtual,
              disciplinaId: discConfig.disciplinaId,
              disciplinaName: discName,
              assuntoId: matchingQuestao.assuntoId || targetAssunto?.id,
              assuntoName: matchingQuestao.assuntoName || targetAssunto?.name || 'Tópicos Gerais',
              banca: matchingQuestao.banca || data.banca || 'FGV',
              statement: matchingQuestao.statement,
              options: matchingQuestao.options.map(o => ({ id: o.id, text: o.text })),
              correctOptionId: matchingQuestao.correctOptionId,
              explanation: matchingQuestao.explanation,
              difficulty: matchingQuestao.difficulty,
            });
          } else if (modalidade === 'certo_errado') {
            const isCerto = i % 2 === 0;
            const assuntoTitle = targetAssunto?.name || 'Normas e Jurisprudência';
            questoes.push({
              id: `sq_${Date.now()}_${numeroAtual}`,
              numero: numeroAtual,
              disciplinaId: discConfig.disciplinaId,
              disciplinaName: discName,
              assuntoId: targetAssunto?.id,
              assuntoName: assuntoTitle,
              banca: data.banca || 'Cebraspe',
              statement: `(${data.banca || 'Cebraspe'} - Auditor/Analista) No que tange a ${assuntoTitle}, julgue o item a seguir com base na legislação e jurisprudência aplicáveis: ${
                isCerto 
                  ? `A atuação do órgão fiscalizador obedece estritamente aos preceitos da legalidade e publicidade, sendo admitida a auditoria operacional concomitante.`
                  : `É prescindível a observância do contraditório e da ampla defesa nos processos disciplinares de que possa resultar sanção gravosa.`
              }`,
              options: [
                { id: 'C', text: 'CERTO' },
                { id: 'E', text: 'ERRADO' }
              ],
              correctOptionId: isCerto ? 'C' : 'E',
              explanation: isCerto 
                ? 'Gabarito CERTO: Em perfeita consonância com os princípios constitucionais fundamentais da Administração Pública e normas de auditoria governamental.'
                : 'Gabarito ERRADO: O contraditório e a ampla defesa são garantias constitucionais expressas e inafastáveis (Art. 5º, LV, CF/88).',
              difficulty: i % 3 === 0 ? 'dificil' : 'media',
            });
          } else {
            const assuntoTitle = targetAssunto?.name || 'Conceitos Fundamentais';
            questoes.push({
              id: `sq_${Date.now()}_${numeroAtual}`,
              numero: numeroAtual,
              disciplinaId: discConfig.disciplinaId,
              disciplinaName: discName,
              assuntoId: targetAssunto?.id,
              assuntoName: assuntoTitle,
              banca: data.banca || 'FGV',
              statement: `Em relação à disciplina de ${discName}, especificamente sobre o tópico "${assuntoTitle}", assinale a alternativa que apresenta a assertiva juridicamente e tecnicamente correta segundo a doutrina e normas vigentes:`,
              options: [
                { id: 'opt_a', text: `A competência para a prática do ato administrativo relativo a ${assuntoTitle} é delegável em sua totalidade, sem qualquer ressalva legal.` },
                { id: 'opt_b', text: `Os procedimentos formais e prazos de análise aplicáveis ao tema ${assuntoTitle} devem observar rigorosamente os princípios da motivação, razoabilidade e devido processo legal.` },
                { id: 'opt_c', text: `É vedada qualquer forma de fiscalização ou controle prévio pelos órgãos centrais de controle interno.` },
                { id: 'opt_d', text: `A discricionariedade administrativa é absoluta e imune a qualquer exame de proporcionalidade pelo Poder Judiciário.` },
                { id: 'opt_e', text: `Os efeitos da decisão proferida em sede recursal produzem efeitos meramente prospectivos e sem força executiva.` }
              ],
              correctOptionId: 'opt_b',
              explanation: 'Gabarito B: A motivação explícita, a razoabilidade e a observância do devido processo legal constituem garantias estruturantes indispensáveis na ordem jurídica.',
              difficulty: i % 2 === 0 ? 'media' : 'dificil',
            });
          }
          numeroAtual++;
        }
      }
      questionsCount = questoes.length;
    } else {
      questionsCount = data.questionsCount || 0;
    }

    const newSimulado: Simulado = {
      id: `sim_${Date.now()}`,
      userId: data.userId,
      concursoId: data.concursoId,
      concursoName: data.concursoName,
      title: data.title,
      description: data.description || '',
      banca: data.banca || 'FGV',
      modalidade,
      cebraspePenalty: data.cebraspePenalty || false,
      questionsCount,
      durationMinutes: data.durationMinutes || 120,
      timeRemainingSeconds: (data.durationMinutes || 120) * 60,
      elapsedSeconds: 0,
      disciplinasConfig: data.disciplinasConfig,
      questoes,
      maxScore: questionsCount,
      status: data.status || 'agendado',
      createdAt,
      finishedAt,
      updatedAt: new Date().toISOString(),
    };

    const updated = [newSimulado, ...list];
    saveStored(STORAGE_KEYS.SIMULADOS, updated);
    return newSimulado;
  }

  static async updateSimulado(id: string, partial: Partial<Simulado>): Promise<Simulado> {
    const list = await this.getSimulados();
    let updatedItem: Simulado | null = null;
    const updated = list.map(s => {
      if (s.id === id) {
        updatedItem = {
          ...s,
          ...partial,
          updatedAt: new Date().toISOString(),
        };
        return updatedItem;
      }
      return s;
    });
    if (!updatedItem) throw new Error('Simulado não encontrado.');
    saveStored(STORAGE_KEYS.SIMULADOS, updated);
    return updatedItem;
  }

  static async deleteSimulado(id: string): Promise<Simulado[]> {
    const list = await this.getSimulados();
    const updated = list.filter(s => s.id !== id);
    saveStored(STORAGE_KEYS.SIMULADOS, updated);
    return updated;
  }

  static async saveSimuladoProgress(
    id: string, 
    data: {
      answers?: Record<number, string>;
      doubting?: Record<number, boolean>;
      timeRemainingSeconds?: number;
      elapsedSeconds?: number;
      status?: SimuladoStatus
    }
  ): Promise<Simulado> {
    const simulado = await this.getSimuladoById(id);
    if (!simulado) throw new Error('Simulado não encontrado.');
    const updatedQuestoes = (simulado.questoes || []).map(q => {
      const ans = data.answers ? data.answers[q.numero] : q.userAnswer;
      const dbt = data.doubting ? data.doubting[q.numero] : q.isDoubting;
      return {
        ...q,
        userAnswer: ans,
        isDoubting: dbt,
      };
    });
    return this.updateSimulado(id, {
      questoes: updatedQuestoes,
      timeRemainingSeconds: data.timeRemainingSeconds !== undefined ? data.timeRemainingSeconds : simulado.timeRemainingSeconds,
      elapsedSeconds: data.elapsedSeconds !== undefined ? data.elapsedSeconds : simulado.elapsedSeconds,
      status: data.status || simulado.status,
    });
  }

  static async finishSimulado(
    id: string,
    payload: {
      answers: Record<number, string>;
      doubting?: Record<number, boolean>;
      elapsedSeconds: number;
    }
  ): Promise<Simulado> {
    const simulado = await this.getSimuladoById(id);
    if (!simulado) throw new Error('Simulado não encontrado.');
    const allDisciplinas = await this.getDisciplinas();
    const allAssuntos = await this.getAssuntos();
    const nowIso = new Date().toISOString();

    let totalCorrect = 0;
    let totalWrong = 0;
    let totalBlank = 0;

    const discStatsMap = new Map<string, {
      disciplinaId: string;
      disciplinaName: string;
      total: number;
      correct: number;
      wrong: number;
      blank: number;
      assuntosMap: Map<string, { total: number; correct: number; wrong: number; assuntoId?: string }>;
    }>();

    const evaluatedQuestoes: SimuladoQuestao[] = (simulado.questoes || []).map(q => {
      const userAnswer = payload.answers[q.numero] || undefined;
      const isDoubting = payload.doubting ? !!payload.doubting[q.numero] : false;
      const isCorrect = userAnswer ? (userAnswer.trim().toLowerCase() === q.correctOptionId.trim().toLowerCase()) : false;
      const isBlank = !userAnswer || userAnswer.trim() === '';

      if (isBlank) {
        totalBlank++;
      } else if (isCorrect) {
        totalCorrect++;
      } else {
        totalWrong++;
      }

      const discKey = q.disciplinaId || 'disc_geral';
      if (!discStatsMap.has(discKey)) {
        discStatsMap.set(discKey, {
          disciplinaId: discKey,
          disciplinaName: q.disciplinaName,
          total: 0,
          correct: 0,
          wrong: 0,
          blank: 0,
          assuntosMap: new Map(),
        });
      }
      const discStat = discStatsMap.get(discKey)!;
      discStat.total++;
      if (isBlank) discStat.blank++;
      else if (isCorrect) discStat.correct++;
      else discStat.wrong++;

      const assuntoKey = q.assuntoName || 'Geral';
      if (!discStat.assuntosMap.has(assuntoKey)) {
        discStat.assuntosMap.set(assuntoKey, { total: 0, correct: 0, wrong: 0, assuntoId: q.assuntoId });
      }
      const assStat = discStat.assuntosMap.get(assuntoKey)!;
      assStat.total++;
      if (isCorrect) assStat.correct++;
      else if (!isBlank) assStat.wrong++;

      return {
        ...q,
        userAnswer,
        isCorrect: isBlank ? false : isCorrect,
        isDoubting,
      };
    });

    const totalQuestions = evaluatedQuestoes.length || simulado.questionsCount || 1;
    let finalScore = totalCorrect;
    if (simulado.cebraspePenalty) {
      finalScore = Math.max(0, totalCorrect - totalWrong);
    }
    const accuracyRate = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    const desempenhoPorDisciplina: SimuladoDesempenhoDisciplina[] = Array.from(discStatsMap.values()).map(d => {
      const discTaxa = d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0;
      const liquidScore = simulado.cebraspePenalty ? Math.max(0, d.correct - d.wrong) : d.correct;
      const desempenhoAssuntos = Array.from(d.assuntosMap.entries()).map(([assName, assVal]) => ({
        assuntoId: assVal.assuntoId,
        assuntoName: assName,
        totalQuestoes: assVal.total,
        acertos: assVal.correct,
        erros: assVal.wrong,
        taxaAcerto: assVal.total > 0 ? Math.round((assVal.correct / assVal.total) * 100) : 0,
      }));
      return {
        disciplinaId: d.disciplinaId,
        disciplinaName: d.disciplinaName,
        totalQuestoes: d.total,
        acertos: d.correct,
        erros: d.wrong,
        brancos: d.blank,
        taxaAcerto: discTaxa,
        pontuacaoLiquida: liquidScore,
        desempenhoAssuntos,
      };
    });

    const updatedAssuntos = allAssuntos.map(ass => {
      let addedTotal = 0;
      let addedCorrect = 0;
      evaluatedQuestoes.forEach(q => {
        if (q.assuntoId === ass.id || q.assuntoName === ass.name) {
          addedTotal++;
          if (q.isCorrect) addedCorrect++;
        }
      });
      if (addedTotal > 0) {
        const newTotalQ = (ass.totalQuestionsSolved || 0) + addedTotal;
        const newCorrectQ = (ass.correctQuestionsSolved || 0) + addedCorrect;
        const newAcc = newTotalQ > 0 ? Math.round((newCorrectQ / newTotalQ) * 100) : ass.accuracyRate || 0;
        return {
          ...ass,
          lastStudiedAt: nowIso,
          totalQuestionsSolved: newTotalQ,
          correctQuestionsSolved: newCorrectQ,
          accuracyRate: newAcc,
          status: ass.status === 'nao_iniciado' ? ('em_estudo' as const) : ass.status,
        };
      }
      return ass;
    });
    saveStored(STORAGE_KEYS.ASSUNTOS, updatedAssuntos);

    const durationMinutesGasto = Math.max(1, Math.round(payload.elapsedSeconds / 60));
    const updatedDisciplinas = allDisciplinas.map(disc => {
      const matchInSim = desempenhoPorDisciplina.find(d => d.disciplinaId === disc.id);
      if (matchInSim) {
        const discRatio = matchInSim.totalQuestoes / totalQuestions;
        const addedMin = Math.round(durationMinutesGasto * discRatio);
        return {
          ...disc,
          totalStudyMinutes: (disc.totalStudyMinutes || 0) + addedMin,
        };
      }
      return disc;
    });
    saveStored(STORAGE_KEYS.DISCIPLINAS, updatedDisciplinas);

    const user = await this.getUserProfile(simulado.userId);
    const addedXp = (totalCorrect * 15) + 50;
    await this.updateUserProfile({
      xp: (user.xp || 0) + addedXp,
      level: Math.floor(((user.xp || 0) + addedXp) / 1000) + 1,
      lastStudyDate: nowIso,
    });

    const finishedSimulado: Simulado = {
      ...simulado,
      questoes: evaluatedQuestoes,
      score: finalScore,
      maxScore: totalQuestions,
      accuracyRate,
      totalCorrect,
      totalWrong,
      totalBlank,
      elapsedSeconds: payload.elapsedSeconds,
      timeRemainingSeconds: 0,
      desempenhoPorDisciplina,
      status: 'finalizado',
      finishedAt: nowIso,
      startedAt: simulado.startedAt || nowIso,
      updatedAt: nowIso,
    };

    const list = await this.getSimulados();
    const updatedSimulados = list.map(s => s.id === id ? finishedSimulado : s);
    saveStored(STORAGE_KEYS.SIMULADOS, updatedSimulados);
    return finishedSimulado;
  }

  static async addSimuladoQuestaoToCadernoErros(
    simuladoId: string, 
    questaoId: string, 
    motivo: MotivoErro = 'falta_atencao', 
    observation?: string
  ): Promise<ItemCadernoErros> {
    const simulado = await this.getSimuladoById(simuladoId);
    if (!simulado) throw new Error('Simulado não encontrado.');
    const q = (simulado.questoes || []).find(item => item.id === questaoId);
    if (!q) throw new Error('Questão não encontrada no simulado.');

    const correctOpt = q.options.find(o => o.id === q.correctOptionId);
    const userOpt = q.options.find(o => o.id === q.userAnswer);

    const fullObservation = observation || [
      `Erro no Simulado: "${simulado.title}".`,
      userOpt ? `Marcou: (${userOpt.id.toUpperCase()}) ${userOpt.text}` : 'Não respondeu / deixou em branco.',
      correctOpt ? `Gabarito Oficial: (${correctOpt.id.toUpperCase()}) ${correctOpt.text}` : '',
      q.explanation ? `\nFundamentação: ${q.explanation}` : ''
    ].filter(Boolean).join('\n');

    const createdErro = await this.addCadernoErro({
      userId: simulado.userId,
      statementOrExcerpt: `[${simulado.banca || 'Simulado'} - Q${q.numero}] ${q.statement}`,
      disciplinaId: q.disciplinaId,
      disciplinaName: q.disciplinaName,
      assuntoId: q.assuntoId,
      assuntoName: q.assuntoName || 'Geral',
      banca: q.banca || simulado.banca || 'FGV',
      difficulty: q.difficulty || 'media',
      motivo,
      observation: fullObservation,
      correctAnswer: correctOpt ? `(${correctOpt.id.toUpperCase()}) ${correctOpt.text}` : q.correctOptionId,
      statusRevisao: 'pendente',
    });

    const updatedQuestoes = (simulado.questoes || []).map(item => 
      item.id === questaoId ? { ...item, addedToCadernoErros: true } : item
    );
    await this.updateSimulado(simuladoId, { questoes: updatedQuestoes });
    return createdErro;
  }

  // --- NOTIFICAÇÕES ---
  static async getNotificacoes(): Promise<Notificacao[]> {
    return loadStored<Notificacao[]>(STORAGE_KEYS.NOTIFICACOES, INITIAL_NOTIFICACOES);
  }

  static async markNotificationAsRead(id: string): Promise<Notificacao[]> {
    const list = await this.getNotificacoes();
    const updated = list.map(n => n.id === id ? { ...n, read: true } : n);
    saveStored(STORAGE_KEYS.NOTIFICACOES, updated);
    return updated;
  }

  static async markAllNotificationsAsRead(): Promise<Notificacao[]> {
    const list = await this.getNotificacoes();
    const updated = list.map(n => ({ ...n, read: true }));
    saveStored(STORAGE_KEYS.NOTIFICACOES, updated);
    return updated;
  }

  // --- STUDY PLAN & CRONOGRAMA ---
  static async getStudyPlan(concursoId?: string): Promise<StudyPlan> {
    const current = loadStored<StudyPlan>(STORAGE_KEYS.STUDY_PLAN, INITIAL_STUDY_PLAN);
    if (concursoId && current.concursoId !== concursoId) {
      const concursos = await this.getConcursos();
      const target = concursos.find(c => c.id === concursoId);
      if (target) {
        return this.recalculateStudyPlan(concursoId);
      }
    }
    return current;
  }

  static async saveStudyPlan(plan: StudyPlan): Promise<StudyPlan> {
    saveStored(STORAGE_KEYS.STUDY_PLAN, plan);
    if (isFirebaseInitialized && db) {
      try {
        await setDoc(doc(db, 'study_plans', plan.id), plan, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `study_plans/${plan.id}`);
      }
    }
    return plan;
  }

  static async recalculateStudyPlan(
    concursoId?: string,
    customAvailability?: WeeklyAvailability,
    newExamDate?: string
  ): Promise<StudyPlan> {
    const currentPlan = await this.getStudyPlan();
    const activeConcursoId = concursoId || currentPlan.concursoId;
    const [allDisciplinas, assuntos, revisoes, questoes, concursos] = await Promise.all([
      this.getDisciplinas(),
      this.getAssuntos(),
      this.getRevisoes(),
      this.getQuestoes(),
      this.getConcursos(),
    ]);
    const disciplinas = allDisciplinas.filter(d => !activeConcursoId || !d.concursoId || d.concursoId === activeConcursoId);
    const activeConcurso = concursos.find(c => c.id === activeConcursoId) || concursos[0];
    const examDate = newExamDate || activeConcurso?.examDate?.split('T')[0] || currentPlan.targetExamDate;
    const recalculated = PlannerService.recalculatePlan(
      {
        ...currentPlan,
        concursoId: activeConcurso?.id || currentPlan.concursoId,
        concursoTitle: activeConcurso ? `${activeConcurso.organ} - ${activeConcurso.role}` : currentPlan.concursoTitle,
      },
      disciplinas,
      assuntos,
      revisoes,
      questoes,
      customAvailability,
      examDate
    );
    return this.saveStudyPlan(recalculated);
  }

  static async addPlannedSession(session: Omit<PlannedSession, 'id'>): Promise<{ plan: StudyPlan; newSession: PlannedSession }> {
    const plan = await this.getStudyPlan();
    const newSession: PlannedSession = {
      ...session,
      id: `plan_ses_custom_${Date.now()}`,
    };
    const updatedSessions = [...plan.sessions, newSession];
    const assuntos = await this.getAssuntos();
    const conflicts = PlannerService.detectConflicts(updatedSessions, plan.weeklyAvailability, plan.targetExamDate, assuntos);
    const updatedPlan: StudyPlan = {
      ...plan,
      sessions: updatedSessions,
      conflicts,
      historyLogs: [
        {
          id: `log_add_${Date.now()}`,
          planId: plan.id,
          action: 'edicao_manual',
          timestamp: new Date().toISOString(),
          description: `Sessão manual adicionada para ${newSession.disciplinaName} em ${newSession.date} (${newSession.durationMinutes} min).`,
          preservedCompletedCount: plan.sessions.filter(s => s.status === 'concluida').length,
          totalStudyMinutes: plan.sessions.filter(s => s.status === 'concluida').reduce((acc, s) => acc + s.durationMinutes, 0),
        },
        ...(plan.historyLogs || []),
      ],
      updatedAt: new Date().toISOString(),
    };
    await this.saveStudyPlan(updatedPlan);
    return { plan: updatedPlan, newSession };
  }

  static async updatePlannedSession(sessionId: string, partial: Partial<PlannedSession>): Promise<StudyPlan> {
    const plan = await this.getStudyPlan();
    const updatedSessions = plan.sessions.map(s => {
      if (s.id === sessionId) {
        return { ...s, ...partial };
      }
      return s;
    });
    const assuntos = await this.getAssuntos();
    const conflicts = PlannerService.detectConflicts(updatedSessions, plan.weeklyAvailability, plan.targetExamDate, assuntos);
    const updatedPlan: StudyPlan = {
      ...plan,
      sessions: updatedSessions,
      conflicts,
      updatedAt: new Date().toISOString(),
    };
    return this.saveStudyPlan(updatedPlan);
  }

  static async deletePlannedSession(sessionId: string): Promise<StudyPlan> {
    const plan = await this.getStudyPlan();
    const updatedSessions = plan.sessions.filter(s => s.id !== sessionId);
    const assuntos = await this.getAssuntos();
    const conflicts = PlannerService.detectConflicts(updatedSessions, plan.weeklyAvailability, plan.targetExamDate, assuntos);
    const updatedPlan: StudyPlan = {
      ...plan,
      sessions: updatedSessions,
      conflicts,
      updatedAt: new Date().toISOString(),
    };
    return this.saveStudyPlan(updatedPlan);
  }

  static async reschedulePlannedSession(sessionId: string, newDateStr: string, reason?: string): Promise<StudyPlan> {
    const plan = await this.getStudyPlan();
    const parsedNewDate = PlannerService.parseLocalDate(newDateStr);
    const dayOfWeek = PlannerService.getDayOfWeekFromDate(parsedNewDate);
    let sessionName = '';
    const updatedSessions = plan.sessions.map(s => {
      if (s.id === sessionId) {
        sessionName = s.disciplinaName;
        return {
          ...s,
          originalDate: s.originalDate || s.date,
          date: newDateStr,
          dayOfWeek,
          status: 'reagendada' as PlanSessionStatus,
          rescheduledReason: reason || 'Reagendada pelo estudante.',
        };
      }
      return s;
    });
    const assuntos = await this.getAssuntos();
    const conflicts = PlannerService.detectConflicts(updatedSessions, plan.weeklyAvailability, plan.targetExamDate, assuntos);
    const updatedPlan: StudyPlan = {
      ...plan,
      sessions: updatedSessions,
      conflicts,
      historyLogs: [
        {
          id: `log_reschedule_${Date.now()}`,
          planId: plan.id,
          action: 'reagendamento',
          timestamp: new Date().toISOString(),
          description: `Sessão de ${sessionName} reagendada para ${newDateStr}. Motivo: ${reason || 'Ajuste de rotina'}.`,
          preservedCompletedCount: plan.sessions.filter(s => s.status === 'concluida').length,
          totalStudyMinutes: plan.sessions.filter(s => s.status === 'concluida').reduce((acc, s) => acc + s.durationMinutes, 0),
        },
        ...(plan.historyLogs || []),
      ],
      updatedAt: new Date().toISOString(),
    };
    return this.saveStudyPlan(updatedPlan);
  }

  static async batchRescheduleOverdue(targetDateStr?: string, mode: 'today' | 'spread' = 'spread'): Promise<StudyPlan> {
    const plan = await this.getStudyPlan();
    const destinationDate = targetDateStr || PlannerService.formatLocalDate(new Date());
    const { updatedSessions, count } = PlannerService.redistributeOverdueSessions(plan, mode, destinationDate);
    const assuntos = await this.getAssuntos();
    const conflicts = PlannerService.detectConflicts(updatedSessions, plan.weeklyAvailability, plan.targetExamDate, assuntos);
    const updatedPlan: StudyPlan = {
      ...plan,
      sessions: updatedSessions,
      conflicts,
      historyLogs: [
        {
          id: `log_batch_${Date.now()}`,
          planId: plan.id,
          action: 'reagendamento',
          timestamp: new Date().toISOString(),
          description: mode === 'today'
            ? `Reagendamento em lote: ${count} sessões atrasadas transferidas para ${destinationDate}.`
            : `Redistribuição equilibrada em lote: ${count} sessões perdidas distribuídas nos próximos dias livres.`,
          preservedCompletedCount: plan.sessions.filter(s => s.status === 'concluida').length,
          totalStudyMinutes: plan.sessions.filter(s => s.status === 'concluida').reduce((acc, s) => acc + s.durationMinutes, 0),
        },
        ...(plan.historyLogs || []),
      ],
      updatedAt: new Date().toISOString(),
    };
    return this.saveStudyPlan(updatedPlan);
  }

  static async togglePlanSessionStatus(sessionId: string, status: PlanSessionStatus): Promise<StudyPlan> {
    const plan = await this.getStudyPlan();
    let completedItem: PlannedSession | null = null;
    const updatedSessions = plan.sessions.map(s => {
      if (s.id === sessionId) {
        const isCompleting = status === 'concluida';
        completedItem = {
          ...s,
          status,
          completedAt: isCompleting ? new Date().toISOString() : undefined,
        };
        return completedItem;
      }
      return s;
    });

    if (status === 'concluida' && completedItem) {
      const item = completedItem as PlannedSession;
      await this.recordStudySession({
        userId: plan.userId,
        disciplinaId: item.disciplinaId,
        assuntoId: item.assuntoId,
        durationMinutes: item.durationMinutes,
        type: item.type === 'questoes' ? 'questoes' : item.type === 'revisao' ? 'revisao' : item.type === 'simulado' ? 'simulado' : 'teoria',
        notes: `Sessão planejada concluída: ${item.assuntoName || item.disciplinaName}`,
        completedAt: new Date().toISOString(),
      });
    }

    const assuntos = await this.getAssuntos();
    const conflicts = PlannerService.detectConflicts(updatedSessions, plan.weeklyAvailability, plan.targetExamDate, assuntos);
    const updatedPlan: StudyPlan = {
      ...plan,
      sessions: updatedSessions,
      conflicts,
      updatedAt: new Date().toISOString(),
    };
    return this.saveStudyPlan(updatedPlan);
  }

  // --- STUDY CYCLE ---
  static async getStudyCycle(concursoId?: string): Promise<StudyCycle> {
    const targetId = concursoId || (await this.getActiveConcurso())?.id;
    if (targetId) {
      // 1. Tentar ler da chave oficial gabarita_ciclo_estudos_${targetId}
      try {
        const raw = localStorage.getItem(`gabarita_ciclo_estudos_${targetId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
            saveStored(STORAGE_KEYS.STUDY_CYCLE, parsed);
            return parsed;
          }
        }
      } catch (e) {
        console.warn('Erro ao ler gabarita_ciclo_estudos_' + targetId, e);
      }

      // 2. Tentar ler de gabarita_study_cycle_${targetId}
      const savedForConcurso = loadStored<StudyCycle | null>(`gabarita_study_cycle_${targetId}`, null);
      if (savedForConcurso && savedForConcurso.concursoId === targetId && savedForConcurso.blocks && savedForConcurso.blocks.length > 0) {
        saveStored(STORAGE_KEYS.STUDY_CYCLE, savedForConcurso);
        try {
          localStorage.setItem(`gabarita_ciclo_estudos_${targetId}`, JSON.stringify(savedForConcurso));
        } catch {}
        return savedForConcurso;
      }
    }

    const current = loadStored<StudyCycle>(STORAGE_KEYS.STUDY_CYCLE, INITIAL_STUDY_CYCLE);
    if (targetId && current.concursoId === targetId && current.blocks && current.blocks.length > 0) {
      return current;
    }

    return {
      id: `cycle_${targetId || 'empty'}`,
      userId: 'user_demo_01',
      concursoId: targetId || '',
      concursoTitle: 'Ciclo de Estudos',
      currentBlockIndex: 0,
      completedCyclesCount: 0,
      totalCycleMinutes: 0,
      blocks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  static async saveStudyCycle(cycle: StudyCycle): Promise<StudyCycle> {
    saveStored(STORAGE_KEYS.STUDY_CYCLE, cycle);
    if (cycle.concursoId) {
      try {
        localStorage.setItem(`gabarita_ciclo_estudos_${cycle.concursoId}`, JSON.stringify(cycle));
        localStorage.setItem(`gabarita_study_cycle_${cycle.concursoId}`, JSON.stringify(cycle));
      } catch (err) {
        console.warn('Erro ao salvar ciclo no localStorage:', err);
      }
      saveStored(`gabarita_study_cycle_${cycle.concursoId}`, cycle);
    }
    if (isFirebaseInitialized && db) {
      try {
        await setDoc(doc(db, 'study_cycles', cycle.id), cycle, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `study_cycles/${cycle.id}`);
      }
    }
    return cycle;
  }

  static async advanceStudyCycle(minutesStudied?: number): Promise<StudyCycle> {
    const cycle = await this.getStudyCycle();
    const currBlock = cycle.blocks[cycle.currentBlockIndex];
    const advanced = CycleService.advanceBlock(cycle, minutesStudied);
    if (currBlock && minutesStudied && minutesStudied > 0) {
      await this.recordStudySession({
        userId: cycle.userId,
        disciplinaId: currBlock.disciplinaId,
        assuntoId: currBlock.assuntoSugeridoId,
        durationMinutes: minutesStudied,
        type: 'teoria',
        notes: `Bloco do Ciclo concluído: ${currBlock.disciplinaName} (${minutesStudied} min)`,
        completedAt: new Date().toISOString(),
      });
    }
    return this.saveStudyCycle(advanced);
  }

  static async rewindStudyCycle(): Promise<StudyCycle> {
    const cycle = await this.getStudyCycle();
    const rewound = CycleService.rewindBlock(cycle);
    return this.saveStudyCycle(rewound);
  }

  static async recordCycleProgress(additionalMinutes: number): Promise<StudyCycle> {
    const cycle = await this.getStudyCycle();
    const updated = CycleService.recordBlockProgress(cycle, additionalMinutes);
    const currBlock = cycle.blocks[cycle.currentBlockIndex];
    if (currBlock && additionalMinutes > 0) {
      await this.recordStudySession({
        userId: cycle.userId,
        disciplinaId: currBlock.disciplinaId,
        assuntoId: currBlock.assuntoSugeridoId,
        durationMinutes: additionalMinutes,
        type: 'teoria',
        notes: `Tempo de estudo no Ciclo: ${currBlock.disciplinaName} (+${additionalMinutes} min)`,
        completedAt: new Date().toISOString(),
      });
    }
    return this.saveStudyCycle(updated);
  }

  static async resetCycleCurrentLap(): Promise<StudyCycle> {
    const cycle = await this.getStudyCycle();
    const reset = CycleService.resetCurrentLap(cycle);
    return this.saveStudyCycle(reset);
  }

  static async recalculateStudyCycle(concursoId?: string, baseSlotDuration: number = 60): Promise<StudyCycle> {
    const currentCycle = await this.getStudyCycle();
    const targetConcursoId = concursoId || currentCycle.concursoId;
    const [allDisciplinas, assuntos, concursos] = await Promise.all([
      this.getDisciplinas(),
      this.getAssuntos(),
      this.getConcursos(),
    ]);
    const concursoMatch = concursos.find(c => c.id === targetConcursoId) || concursos[0];
    const concursoTitle = concursoMatch ? `${concursoMatch.organ} - ${concursoMatch.role}` : currentCycle.concursoTitle;
    const disciplinas = targetConcursoId 
      ? allDisciplinas.filter(d => d.concursoId === targetConcursoId) 
      : allDisciplinas;
    const newCycle = CycleService.generateCycle(
      currentCycle.userId,
      targetConcursoId,
      concursoTitle,
      disciplinas,
      assuntos,
      baseSlotDuration
    );
    newCycle.completedCyclesCount = currentCycle.completedCyclesCount;
    return this.saveStudyCycle(newCycle);
  }

  static async updateCycleBlock(blockId: string, partial: Partial<CycleBlock>): Promise<StudyCycle> {
    const cycle = await this.getStudyCycle();
    const updatedBlocks = cycle.blocks.map(b => {
      if (b.id === blockId) {
        return { ...b, ...partial };
      }
      return b;
    });
    const totalCycleMinutes = updatedBlocks.reduce((acc, b) => acc + b.durationMinutes, 0);
    const updatedCycle: StudyCycle = {
      ...cycle,
      blocks: updatedBlocks,
      totalCycleMinutes,
      updatedAt: new Date().toISOString(),
    };
    return this.saveStudyCycle(updatedCycle);
  }

  static async getStudyMethod(): Promise<StudyMethod> {
    try {
      const stored = localStorage.getItem('gabarita_study_method');
      if (stored === 'cronograma' || stored === 'ciclo') {
        return stored;
      }
      const profile = await this.getUserProfile('user_demo_01');
      if (profile.preferences?.studyMethod) {
        return profile.preferences.studyMethod;
      }
    } catch {
      // Fallback
    }
    return 'ciclo';
  }

  static async setStudyMethod(method: StudyMethod): Promise<StudyMethod> {
    try {
      localStorage.setItem('gabarita_study_method', method);
      const profile = await this.getUserProfile('user_demo_01');
      if (profile) {
        await this.updateUserProfile({
          preferences: {
            ...profile.preferences,
            studyMethod: method,
          }
        });
      }
    } catch (err) {
      console.warn('Erro ao persistir preferência de método:', err);
    }
    return method;
  }

  static async resetStudyCycle(clearCompletedCyclesCount: boolean = false): Promise<StudyCycle> {
    const cycle = await this.getStudyCycle();
    const updatedBlocks = cycle.blocks.map((b, idx) => ({
      ...b,
      status: (idx === 0 ? 'em_andamento' : 'aguardando') as CycleBlock['status'],
      elapsedMinutes: 0,
      completedAt: undefined,
    }));
    const resetCycle: StudyCycle = {
      ...cycle,
      currentBlockIndex: 0,
      completedCyclesCount: clearCompletedCyclesCount ? 0 : cycle.completedCyclesCount,
      blocks: updatedBlocks,
      updatedAt: new Date().toISOString(),
    };
    return this.saveStudyCycle(resetCycle);
  }

  static async removeStudyCycle(): Promise<StudyCycle> {
    const cycle = await this.getStudyCycle();
    if (cycle.concursoId) {
      try {
        localStorage.removeItem(`gabarita_ciclo_estudos_${cycle.concursoId}`);
        localStorage.removeItem(`gabarita_study_cycle_${cycle.concursoId}`);
      } catch (err) {
        console.warn('Erro ao remover ciclo do concurso no localStorage:', err);
      }
    }
    const clearedCycle: StudyCycle = {
      ...cycle,
      currentBlockIndex: 0,
      completedCyclesCount: 0,
      totalCycleMinutes: 0,
      blocks: [],
      updatedAt: new Date().toISOString(),
    };
    return this.saveStudyCycle(clearedCycle);
  }
}
