import { StudyCycle, CycleBlock, Disciplina, Assunto } from '../types';

export class CycleService {
  static generateCycle(
    userId: string,
    concursoId: string,
    concursoTitle: string,
    disciplinas: Disciplina[],
    assuntos: Assunto[],
    baseSlotDuration: number = 60
  ): StudyCycle {
    if (disciplinas.length === 0) {
      return {
        id: `cycle_${concursoId}_${Date.now()}`,
        userId,
        concursoId,
        concursoTitle,
        currentBlockIndex: 0,
        completedCyclesCount: 0,
        totalCycleMinutes: 0,
        blocks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    const blocks: CycleBlock[] = [];
    let blockIdCounter = 1;

    disciplinas.forEach(disc => {
      const discTopics = assuntos.filter(a => a.disciplinaId === disc.id);
      const unstudiedTopic = discTopics.find(t => t.status === 'nao_iniciado') ||
        discTopics.find(t => t.status === 'em_estudo') ||
        discTopics[0];

      const weight = disc.weight || 2.0;
      let duration = baseSlotDuration;
      if (weight >= 3.0) {
        duration = Math.max(90, baseSlotDuration * 1.5);
      } else if (weight >= 2.5) {
        duration = Math.max(75, baseSlotDuration * 1.25);
      } else if (weight <= 1.5) {
        duration = Math.min(45, baseSlotDuration * 0.75);
      }

      blocks.push({
        id: `blk_${blockIdCounter++}`,
        cycleId: `cycle_${concursoId}`,
        disciplinaId: disc.id,
        disciplinaName: disc.name,
        disciplinaColor: disc.color,
        order: blocks.length + 1,
        durationMinutes: duration,
        weight,
        assuntoSugeridoId: unstudiedTopic?.id,
        assuntoSugeridoName: unstudiedTopic?.name || 'Estudo Dirigido',
        status: 'aguardando',
        elapsedMinutes: 0,
      });

      if (weight >= 2.5) {
        const secondTopic = discTopics.filter(t => t.id !== unstudiedTopic?.id)[0] || unstudiedTopic;
        blocks.push({
          id: `blk_${blockIdCounter++}`,
          cycleId: `cycle_${concursoId}`,
          disciplinaId: disc.id,
          disciplinaName: disc.name,
          disciplinaColor: disc.color,
          order: blocks.length + 1,
          durationMinutes: duration,
          weight,
          assuntoSugeridoId: secondTopic?.id,
          assuntoSugeridoName: secondTopic?.name || 'Exercícios de Aprofundamento',
          status: 'aguardando',
          elapsedMinutes: 0,
        });
      }
    });

    const interleavedBlocks = this.interleaveBlocks(blocks);
    interleavedBlocks.forEach((blk, idx) => {
      blk.order = idx + 1;
      blk.status = idx === 0 ? 'em_andamento' : 'aguardando';
    });

    const totalMinutes = interleavedBlocks.reduce((acc, b) => acc + b.durationMinutes, 0);

    return {
      id: `cycle_${concursoId}_${Date.now()}`,
      userId,
      concursoId,
      concursoTitle,
      currentBlockIndex: 0,
      completedCyclesCount: 0,
      totalCycleMinutes: totalMinutes,
      blocks: interleavedBlocks,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private static interleaveBlocks(blocks: CycleBlock[]): CycleBlock[] {
    if (blocks.length <= 1) return blocks;
    const byDisc: Record<string, CycleBlock[]> = {};
    blocks.forEach(b => {
      if (!byDisc[b.disciplinaId]) byDisc[b.disciplinaId] = [];
      byDisc[b.disciplinaId].push(b);
    });
    const result: CycleBlock[] = [];
    const keys = Object.keys(byDisc);
    let hasMore = true;
    let round = 0;
    while (hasMore) {
      hasMore = false;
      for (const k of keys) {
        if (byDisc[k].length > round) {
          result.push(byDisc[k][round]);
          hasMore = true;
        }
      }
      round++;
    }
    return result;
  }

  static advanceBlock(cycle: StudyCycle, minutesStudied?: number): StudyCycle {
    if (cycle.blocks.length === 0) return cycle;
    const currIdx = cycle.currentBlockIndex;
    const currentBlock = cycle.blocks[currIdx];
    const updatedBlocks = [...cycle.blocks];

    updatedBlocks[currIdx] = {
      ...currentBlock,
      status: 'concluido',
      elapsedMinutes: minutesStudied || currentBlock.durationMinutes,
      completedAt: new Date().toISOString(),
    };

    const nextIdx = (currIdx + 1) % cycle.blocks.length;
    let completedCycles = cycle.completedCyclesCount;

    if (nextIdx === 0) {
      completedCycles += 1;
      updatedBlocks.forEach((b, idx) => {
        b.status = idx === 0 ? 'em_andamento' : 'aguardando';
        b.elapsedMinutes = 0;
      });
    } else {
      updatedBlocks[nextIdx] = {
        ...updatedBlocks[nextIdx],
        status: 'em_andamento',
      };
    }

    return {
      ...cycle,
      currentBlockIndex: nextIdx,
      completedCyclesCount: completedCycles,
      blocks: updatedBlocks,
      updatedAt: new Date().toISOString(),
    };
  }

  static rewindBlock(cycle: StudyCycle): StudyCycle {
    if (cycle.blocks.length === 0) return cycle;
    const prevIdx = cycle.currentBlockIndex > 0 
      ? cycle.currentBlockIndex - 1 
      : cycle.blocks.length - 1;
    const updatedBlocks = cycle.blocks.map((b, idx) => {
      if (idx === prevIdx) {
        return { ...b, status: 'em_andamento' as const };
      }
      if (idx === cycle.currentBlockIndex) {
        return { ...b, status: 'aguardando' as const };
      }
      return b;
    });
    return {
      ...cycle,
      currentBlockIndex: prevIdx,
      blocks: updatedBlocks,
      updatedAt: new Date().toISOString(),
    };
  }

  static recordBlockProgress(cycle: StudyCycle, additionalMinutes: number): StudyCycle {
    if (cycle.blocks.length === 0) return cycle;
    const currIdx = cycle.currentBlockIndex;
    const currentBlock = cycle.blocks[currIdx];
    const newElapsed = (currentBlock.elapsedMinutes || 0) + additionalMinutes;

    if (newElapsed >= currentBlock.durationMinutes) {
      return this.advanceBlock(cycle, newElapsed);
    }

    const updatedBlocks = [...cycle.blocks];
    updatedBlocks[currIdx] = {
      ...currentBlock,
      elapsedMinutes: newElapsed,
      status: 'em_andamento',
    };

    return {
      ...cycle,
      blocks: updatedBlocks,
      updatedAt: new Date().toISOString(),
    };
  }

  static resetCurrentLap(cycle: StudyCycle): StudyCycle {
    const updatedBlocks = cycle.blocks.map((b, idx) => ({
      ...b,
      status: idx === 0 ? ('em_andamento' as const) : ('aguardando' as const),
      elapsedMinutes: 0,
      completedAt: undefined,
    }));
    return {
      ...cycle,
      currentBlockIndex: 0,
      blocks: updatedBlocks,
      updatedAt: new Date().toISOString(),
    };
  }
}
