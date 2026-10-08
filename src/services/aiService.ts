import { DatabaseService } from './db';
import { Disciplina } from '../types';

export interface AIAssistantResponse {
  reply: string;
  source: 'gemini-ai' | 'heuristic-fallback';
}

export class AIService {
  static async queryAssistant(userQuery: string, userId: string = 'user_demo_01'): Promise<AIAssistantResponse> {
    try {
      const [stats, revisoes, caderno, sessoes, disciplinas, assuntos] = await Promise.all([
        DatabaseService.getEstatisticasProgressoReal(userId),
        DatabaseService.getRevisoes(),
        DatabaseService.getCadernoErros(),
        DatabaseService.getSessoes(),
        DatabaseService.getDisciplinas(),
        DatabaseService.getAssuntos(),
      ]);

      const userData = {
        stats,
        revisoes: revisoes.slice(0, 30),
        cadernoErros: caderno.slice(0, 20),
        disciplinas: disciplinas.map((d: Disciplina) => ({ name: d.name, weight: d.weight })),
        sessoesRecentesCount: sessoes.length,
      };

      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userQuery, userData }),
      });

      if (!response.ok) {
        throw new Error('Falha na comunicação com o servidor de IA.');
      }
      const json = await response.json();
      return {
        reply: json.reply || 'Não foi possível gerar a resposta no momento.',
        source: json.source || 'heuristic-fallback',
      };
    } catch (err) {
      console.warn('Erro no AIService:', err);
      return {
        reply: '### ⚠️ Indisponibilidade Temporal\n\nNão foi possível conectar ao servidor de IA neste momento. Tente novamente em instantes.',
        source: 'heuristic-fallback',
      };
    }
  }
}
