import { 
  Disciplina, 
  Assunto, 
  Revisao, 
  Questao, 
  StudyPlan, 
  PlannedSession, 
  WeeklyAvailability, 
  DayOfWeek, 
  PlanConflict, 
  DisciplinaAllocation, 
  PlanHistoryLog,
  PlanSessionType 
} from '../types';

export class PlannerService {
  static readonly DAYS_OF_WEEK: DayOfWeek[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

  static getDayOfWeekFromDate(date: Date): DayOfWeek {
    const day = date.getDay();
    const map: Record<number, DayOfWeek> = {
      0: 'dom',
      1: 'seg',
      2: 'ter',
      3: 'qua',
      4: 'qui',
      5: 'sex',
      6: 'sab',
    };
    return map[day];
  }

  static parseLocalDate(dateStr: string): Date {
    const parts = dateStr.split('-');
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }

  static formatLocalDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  static calculateDistribution(
    disciplinas: Disciplina[],
    assuntos: Assunto[],
    questoes: Questao[],
    weeklyTotalMinutes: number
  ): DisciplinaAllocation[] {
    if (disciplinas.length === 0) return [];
    interface ScoredDisc {
      disc: Disciplina;
      score: number;
      progressPercent: number;
      accuracyRate: number;
      difficulty: 'facil' | 'media' | 'dificil';
      importance: 'alta' | 'media' | 'baixa';
    }
    const scoredList: ScoredDisc[] = disciplinas.map(disc => {
      const discTopics = assuntos.filter(a => a.disciplinaId === disc.id);
      const totalTopics = discTopics.length || 1;
      const completedTopics = discTopics.filter(a => a.completed || a.status === 'dominado').length;
      const progressPercent = Math.round((completedTopics / totalTopics) * 100);

      const accuracyRate = discTopics.reduce((acc, t) => acc + (t.accuracyRate || 0), 0) / (discTopics.length || 1) || 75;
      const weightFactor = disc.weight || 2.0;

      const hardCount = discTopics.filter(t => t.difficulty === 'dificil').length;
      const easyCount = discTopics.filter(t => t.difficulty === 'facil').length;
      let difficultyFactor = 1.0;
      let avgDifficulty: 'facil' | 'media' | 'dificil' = 'media';
      if (hardCount >= discTopics.length * 0.4) {
        difficultyFactor = 1.35;
        avgDifficulty = 'dificil';
      } else if (easyCount >= discTopics.length * 0.5) {
        difficultyFactor = 0.8;
        avgDifficulty = 'facil';
      }

      const highImpCount = discTopics.filter(t => t.importance === 'alta').length;
      let importanceFactor = 1.0;
      if (highImpCount >= discTopics.length * 0.4) {
        importanceFactor = 1.3;
      } else if (discTopics.some(t => t.importance === 'baixa')) {
        importanceFactor = 0.85;
      }

      const progressFactor = Math.max(0.6, 1.3 - (progressPercent / 100) * 0.6);
      let performanceFactor = 1.0;
      if (accuracyRate < 60) {
        performanceFactor = 1.3;
      } else if (accuracyRate > 85) {
        performanceFactor = 0.85;
      }

      const totalScore = weightFactor * difficultyFactor * importanceFactor * progressFactor * performanceFactor;
      return {
        disc,
        score: totalScore,
        progressPercent,
        accuracyRate: Math.round(accuracyRate),
        difficulty: avgDifficulty,
        importance: 'alta',
      };
    });

    const sumScores = scoredList.reduce((acc, item) => acc + item.score, 0) || 1;
    return scoredList.map(item => {
      const share = item.score / sumScores;
      const allocatedMinutes = Math.round(weeklyTotalMinutes * share);
      return {
        disciplinaId: item.disc.id,
        disciplinaName: item.disc.name,
        color: item.disc.color,
        weight: item.disc.weight,
        difficulty: item.difficulty,
        importance: item.importance,
        progressPercent: item.progressPercent,
        accuracyRate: item.accuracyRate,
        allocatedMinutesPerWeek: allocatedMinutes,
        allocatedPercentage: Math.round(share * 100),
      };
    });
  }

  static generateSessions(
    planId: string,
    concursoId: string,
    startDateStr: string,
    targetExamDateStr: string,
    availability: WeeklyAvailability,
    disciplinas: Disciplina[],
    assuntos: Assunto[],
    revisoes: Revisao[],
    distribution: DisciplinaAllocation[],
    preservedSessions: PlannedSession[] = []
  ): { sessions: PlannedSession[]; conflicts: PlanConflict[] } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = this.parseLocalDate(startDateStr);
    const examDate = this.parseLocalDate(targetExamDateStr);

    const totalDays = Math.max(7, Math.ceil((examDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const SLOT_DURATION = 60;
    const finalSessions: PlannedSession[] = [...preservedSessions.filter(s => s.status === 'concluida')];

    const subjectQueue: DisciplinaAllocation[] = [];
    distribution.forEach(alloc => {
      const slotsCount = Math.max(1, Math.round(alloc.allocatedMinutesPerWeek / SLOT_DURATION));
      for (let i = 0; i < slotsCount; i++) {
        subjectQueue.push(alloc);
      }
    });

    const interleavedQueue = this.interleaveSubjects(subjectQueue);
    let queueIdx = 0;
    const pendingReviews = revisoes.filter(r => r.status === 'pendente');
    let reviewIdx = 0;

    const planningHorizonDays = Math.min(totalDays, 42);
    for (let dayOffset = 0; dayOffset < planningHorizonDays; dayOffset++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + dayOffset);
      const currentDateStr = this.formatLocalDate(currentDate);
      const dayOfWeek = this.getDayOfWeekFromDate(currentDate);
      const dailyMinutes = availability[dayOfWeek] || 0;
      if (dailyMinutes <= 0) continue;

      const slotsForDay = Math.floor(dailyMinutes / SLOT_DURATION);
      if (slotsForDay <= 0) continue;

      const existingForDay = finalSessions.filter(s => s.date === currentDateStr);
      let minutesUsedInDay = existingForDay.reduce((acc, s) => acc + s.durationMinutes, 0);
      let slotOrder = existingForDay.length + 1;

      for (let s = 0; s < slotsForDay; s++) {
        if (minutesUsedInDay + SLOT_DURATION > dailyMinutes) break;

        const shouldSlotReview = s === 0 && reviewIdx < pendingReviews.length;
        if (shouldSlotReview) {
          const rev = pendingReviews[reviewIdx];
          const discAlloc = distribution.find(d => d.disciplinaId === rev.disciplinaId) || distribution[0];
          if (discAlloc) {
            const isPast = currentDate < today;
            const newSession: PlannedSession = {
              id: `plan_ses_rev_${currentDateStr}_${slotOrder}`,
              planId,
              concursoId,
              disciplinaId: discAlloc.disciplinaId,
              disciplinaName: discAlloc.disciplinaName,
              disciplinaColor: discAlloc.color,
              assuntoName: rev.assuntoName,
              date: currentDateStr,
              dayOfWeek,
              startTime: this.getSlotStartTime(slotOrder),
              durationMinutes: 45,
              type: 'revisao',
              status: isPast ? 'atrasada' : 'pendente',
              revisaoId: rev.id,
              notes: `Revisão do método ${rev.method} (Curva de Esquecimento)`,
              order: slotOrder++,
            };
            finalSessions.push(newSession);
            minutesUsedInDay += 45;
            reviewIdx++;
            continue;
          }
        }

        if (interleavedQueue.length === 0) break;
        const currentAlloc = interleavedQueue[queueIdx % interleavedQueue.length];
        queueIdx++;

        const discTopics = assuntos.filter(a => a.disciplinaId === currentAlloc.disciplinaId);
        const unstudiedTopic = discTopics.find(t => t.status === 'nao_iniciado') ||
          discTopics.find(t => t.status === 'em_estudo') ||
          discTopics[0];

        let sessionType: PlanSessionType = 'teoria';
        if (dayOfWeek === 'sab' || dayOfWeek === 'dom') {
          sessionType = s === slotsForDay - 1 ? 'simulado' : 'questoes';
        } else if (unstudiedTopic && unstudiedTopic.status === 'em_estudo') {
          sessionType = 'questoes';
        }

        const isPast = currentDate < today;
        const newSession: PlannedSession = {
          id: `plan_ses_${currentDateStr}_${slotOrder}`,
          planId,
          concursoId,
          disciplinaId: currentAlloc.disciplinaId,
          disciplinaName: currentAlloc.disciplinaName,
          disciplinaColor: currentAlloc.color,
          assuntoId: unstudiedTopic?.id,
          assuntoName: unstudiedTopic?.name || 'Estudo Dirigido',
          date: currentDateStr,
          dayOfWeek,
          startTime: this.getSlotStartTime(slotOrder),
          durationMinutes: SLOT_DURATION,
          type: sessionType,
          status: isPast ? 'atrasada' : 'pendente',
          notes: unstudiedTopic?.notes || `Meta: avançar em tópicos com peso ${currentAlloc.weight.toFixed(1)}`,
          order: slotOrder++,
        };
        finalSessions.push(newSession);
        minutesUsedInDay += SLOT_DURATION;
      }
    }

    const conflicts = this.detectConflicts(finalSessions, availability, targetExamDateStr, assuntos);
    return { sessions: finalSessions, conflicts };
  }

  private static interleaveSubjects(items: DisciplinaAllocation[]): DisciplinaAllocation[] {
    if (items.length <= 1) return items;
    const groups: Record<string, DisciplinaAllocation[]> = {};
    items.forEach(item => {
      if (!groups[item.disciplinaId]) groups[item.disciplinaId] = [];
      groups[item.disciplinaId].push(item);
    });
    const result: DisciplinaAllocation[] = [];
    const keys = Object.keys(groups);
    let hasMore = true;
    let round = 0;
    while (hasMore) {
      hasMore = false;
      for (const k of keys) {
        if (groups[k].length > round) {
          result.push(groups[k][round]);
          hasMore = true;
        }
      }
      round++;
    }
    return result;
  }

  private static getSlotStartTime(slotOrder: number): string {
    const times = ['08:00', '09:15', '10:30', '14:00', '15:15', '19:00', '20:15'];
    return times[(slotOrder - 1) % times.length];
  }

  static detectConflicts(
    sessions: PlannedSession[],
    availability: WeeklyAvailability,
    examDateStr: string,
    assuntos: Assunto[]
  ): PlanConflict[] {
    const conflicts: PlanConflict[] = [];
    const todayStr = this.formatLocalDate(new Date());
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueSessions = sessions.filter(s => s.status === 'atrasada' || (s.date < todayStr && s.status === 'pendente'));
    if (overdueSessions.length > 0) {
      conflicts.push({
        id: 'conf_overdue',
        type: 'data_ultrapassada',
        severity: overdueSessions.length > 3 ? 'alta' : 'media',
        message: `${overdueSessions.length} sessão(ões) está(ão) atrasada(s) em relação ao cronograma previsto.`,
        suggestion: 'Utilize o botão "Reagendar Atrasadas" para redistribuir os blocos nos dias livres.',
        affectedSessionIds: overdueSessions.map(s => s.id),
      });
    }

    const sessionsByDate: Record<string, PlannedSession[]> = {};
    sessions.forEach(s => {
      if (!sessionsByDate[s.date]) sessionsByDate[s.date] = [];
      sessionsByDate[s.date].push(s);
    });

    Object.entries(sessionsByDate).forEach(([dateStr, daySessions]) => {
      const firstSes = daySessions[0];
      const limitMinutes = availability[firstSes.dayOfWeek] || 0;
      const totalPlanned = daySessions.reduce((acc, s) => acc + s.durationMinutes, 0);
      if (totalPlanned > limitMinutes && limitMinutes > 0) {
        conflicts.push({
          id: `conf_excess_${dateStr}`,
          type: 'carga_excessiva',
          severity: 'alta',
          date: dateStr,
          message: `Dia ${dateStr} possui ${totalPlanned} min planejados para um limite de ${limitMinutes} min (${firstSes.dayOfWeek.toUpperCase()}).`,
          suggestion: 'Mova uma das sessões para o final de semana.',
          affectedSessionIds: daySessions.map(s => s.id),
        });
      }
    });

    const examDate = this.parseLocalDate(examDateStr);
    const daysUntilExam = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const uncompletedTopics = assuntos.filter(a => !a.completed && a.status !== 'dominado').length;
    if (daysUntilExam > 0 && daysUntilExam < 30 && uncompletedTopics > 40) {
      conflicts.push({
        id: 'conf_tight_deadline',
        type: 'prazo_apertado',
        severity: 'alta',
        message: `Faltam apenas ${daysUntilExam} dias para a prova e restam ${uncompletedTopics} tópicos do edital.`,
        suggestion: 'Priorize tópicos de peso e importância "Alta" no edital.',
      });
    }

    return conflicts;
  }

  static recalculatePlan(
    currentPlan: StudyPlan,
    disciplinas: Disciplina[],
    assuntos: Assunto[],
    revisoes: Revisao[],
    questoes: Questao[],
    customAvailability?: WeeklyAvailability,
    newExamDate?: string
  ): StudyPlan {
    const now = new Date();
    const todayStr = this.formatLocalDate(now);
    const targetExamDate = newExamDate || currentPlan.targetExamDate;
    const availability = customAvailability || currentPlan.weeklyAvailability;
    const weeklyTotalMinutes = Object.values(availability).reduce((a, b) => a + b, 0);
    const dailyAverageMinutes = Math.round(weeklyTotalMinutes / 7);

    const preservedCompletedSessions = currentPlan.sessions.filter(s => s.status === 'concluida');
    const newDistribution = this.calculateDistribution(
      disciplinas,
      assuntos,
      questoes,
      weeklyTotalMinutes
    );

    const { sessions: newFutureSessions, conflicts } = this.generateSessions(
      currentPlan.id,
      currentPlan.concursoId,
      todayStr,
      targetExamDate,
      availability,
      disciplinas,
      assuntos,
      revisoes,
      newDistribution,
      preservedCompletedSessions
    );

    const newLog: PlanHistoryLog = {
      id: `log_recalc_${Date.now()}`,
      planId: currentPlan.id,
      action: 'recalculo',
      timestamp: now.toISOString(),
      description: `Plano recalculado com sucesso. ${preservedCompletedSessions.length} sessões concluídas mantidas intactas.`,
      preservedCompletedCount: preservedCompletedSessions.length,
      totalStudyMinutes: preservedCompletedSessions.reduce((acc, s) => acc + s.durationMinutes, 0),
    };

    const examDate = this.parseLocalDate(targetExamDate);
    const totalDays = Math.max(7, Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const totalWeeks = Math.ceil(totalDays / 7);

    return {
      ...currentPlan,
      targetExamDate,
      weeklyAvailability: availability,
      dailyAverageMinutes,
      totalWeeks,
      totalPlannedHours: Math.round((newFutureSessions.reduce((acc, s) => acc + s.durationMinutes, 0)) / 60),
      disciplinasDistribution: newDistribution,
      sessions: newFutureSessions,
      conflicts,
      historyLogs: [newLog, ...(currentPlan.historyLogs || [])],
      updatedAt: now.toISOString(),
    };
  }

  static redistributeOverdueSessions(
    plan: StudyPlan,
    mode: 'today' | 'spread' = 'spread',
    targetDateStr?: string
  ): { updatedSessions: PlannedSession[]; count: number } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = this.formatLocalDate(today);
    const destinationDate = targetDateStr || todayStr;

    const overdueSessions = plan.sessions.filter(s => 
      s.status === 'atrasada' || (s.status === 'pendente' && s.date < todayStr)
    );
    if (overdueSessions.length === 0) {
      return { updatedSessions: plan.sessions, count: 0 };
    }

    const overdueIds = new Set(overdueSessions.map(s => s.id));
    const nonOverdueSessions = plan.sessions.filter(s => !overdueIds.has(s.id));
    let rescheduledOverdue: PlannedSession[] = [];

    if (mode === 'today') {
      const parsedDest = this.parseLocalDate(destinationDate);
      const dayOfWeek = this.getDayOfWeekFromDate(parsedDest);
      rescheduledOverdue = overdueSessions.map(s => ({
        ...s,
        originalDate: s.originalDate || s.date,
        date: destinationDate,
        dayOfWeek,
        status: 'reagendada' as const,
        rescheduledReason: `Transferida para hoje (${destinationDate})`,
      }));
    } else {
      const dailyMinutesMap: Record<string, number> = {};
      nonOverdueSessions.forEach(s => {
        dailyMinutesMap[s.date] = (dailyMinutesMap[s.date] || 0) + s.durationMinutes;
      });
      let dayIndex = 0;
      rescheduledOverdue = overdueSessions.map(s => {
        let assignedDate = destinationDate;
        let assignedDayOfWeek = this.getDayOfWeekFromDate(this.parseLocalDate(destinationDate));
        for (let offset = 0; offset < 14; offset++) {
          const candidateDate = new Date(today);
          candidateDate.setDate(today.getDate() + (dayIndex + offset) % 14);
          const candidateStr = this.formatLocalDate(candidateDate);
          const dow = this.getDayOfWeekFromDate(candidateDate);
          const limit = plan.weeklyAvailability[dow] || 0;
          const currentLoad = dailyMinutesMap[candidateStr] || 0;
          if (currentLoad + s.durationMinutes <= limit || limit === 0) {
            assignedDate = candidateStr;
            assignedDayOfWeek = dow;
            dailyMinutesMap[candidateStr] = currentLoad + s.durationMinutes;
            dayIndex = (dayIndex + offset + 1) % 14;
            break;
          }
        }
        return {
          ...s,
          originalDate: s.originalDate || s.date,
          date: assignedDate,
          dayOfWeek: assignedDayOfWeek,
          status: 'reagendada' as const,
          rescheduledReason: `Redistribuída para ${assignedDate}`,
        };
      });
    }

    const mergedSessions = [...nonOverdueSessions, ...rescheduledOverdue].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.startTime || '00:00').localeCompare(b.startTime || '00:00');
    });

    return {
      updatedSessions: mergedSessions,
      count: overdueSessions.length,
    };
  }
}
