import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeSyllabusData, parseSyllabusLocally, ParsedSyllabusItem } from './src/services/editalParser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Gabarita - Plataforma de Estudos para Concursos',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/summary', (req, res) => {
  res.json({
    version: '1.0.0',
    capabilities: ['concursos', 'ciclo_estudos', 'repeticao_espacada', 'questoes', 'metas', 'edital_ia_parser'],
    status: 'active'
  });
});

// Endpoint: Payment checkout simulation / integration
app.post('/api/payment/checkout', (req, res) => {
  try {
    const { plan, gateway } = req.body;
    res.json({
      sessionId: `sess_${Date.now()}`,
      provider: gateway || 'stripe',
      status: 'success',
      checkoutUrl: '#',
      plan,
    });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao criar sessão de pagamento.' });
  }
});

// Endpoint: Edital parse via Gemini AI with heuristic fallback
app.post('/api/edital/parse', async (req, res) => {
  try {
    const { rawText, cargo, concursoTitle } = req.body;
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return res.status(400).json({ error: 'Texto do edital não fornecido.' });
    }
    const trimmedText = rawText.trim();
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const { GoogleGenAI, Type } = await import('@google/genai');
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const systemInstruction = `Você é um especialista em processar editais de concursos públicos brasileiros.
Sua única função é receber o texto bruto de conteúdo programático colado pelo usuário e convertê-lo em um array JSON estrito de matérias.

ESTRUTURA DE CADA OBJETO NO ARRAY:
- "nome": Nome exato da matéria (ex: "Língua Portuguesa", "Direito Constitucional", "Direito Administrativo").
- "sigla": Sigla curta de até 4 letras maiúsculas (ex: "PORT", "DCON", "DADM", "RLOG", "INFO").
- "topicos": Lista de strings com cada assunto daquela matéria, rigorosamente limpa de numerações e marcadores iniciais (ex: transformar "1.1 Sintaxe" em apenas "Sintaxe", "1 Compreensão e interpretação de textos" em apenas "Compreensão e interpretação de textos", "2. Atos administrativos" em apenas "Atos administrativos").

REGRAS RÍGIDAS DE EXTRAÇÃO:
1. NUNCA invente matérias ou tópicos que não constem expressamente no texto bruto colado. Extraia exclusivamente o que foi colado.
2. Ignore números de páginas, paginações e cabeçalhos genéricos de agrupamento do edital (ex: "CONHECIMENTOS BÁSICOS", "CONHECIMENTOS ESPECÍFICOS", "PROVA OBJETIVA", "CONTEÚDO PROGRAMÁTICO").
3. Remova números (1., 1.1, 2.), traços, pontos ou marcadores (•, -, *) no início de cada tópico.
4. Separe cada assunto em um item individual no array de tópicos.
5. Retorne APENAS o JSON válido.`;
        
        const prompt = `${systemInstruction}

Texto bruto do edital a ser processado (Cargo: "${cargo || 'Geral'}", Concurso: "${concursoTitle || 'Certame'}"):
${trimmedText.slice(0, 35000)}`;
        
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  nome: { type: Type.STRING },
                  sigla: { type: Type.STRING },
                  topicos: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: ['nome', 'sigla', 'topicos']
              }
            }
          }
        });

        if (response.text) {
          const parsedRaw = JSON.parse(response.text);
          const rawItemsArray = Array.isArray(parsedRaw) ? parsedRaw : (parsedRaw.disciplinas || parsedRaw.edital || parsedRaw.syllabus || []);
          const sanitizedSyllabus: ParsedSyllabusItem[] = sanitizeSyllabusData(rawItemsArray);

          if (sanitizedSyllabus.length > 0) {
            const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6'];
            const mappedDisciplinas = sanitizedSyllabus.map((item, idx) => {
              const upper = item.nome.toUpperCase();
              const isSpecific = upper.includes('ESPECÍF') || upper.includes('DIREITO') || upper.includes('CONTAB') || upper.includes('LEGISLAÇÃO');
              return {
                name: item.nome,
                sigla: item.sigla,
                code: item.sigla,
                weight: isSpecific ? 2.5 : 2.0,
                color: colors[idx % colors.length],
                topicos: item.topicos.map(tStr => ({
                  name: tStr,
                  importance: 'alta' as const,
                  difficulty: 'media' as const,
                  subtopicos: []
                }))
              };
            });

            return res.json({
              source: 'gemini-ai',
              syllabus: sanitizedSyllabus,
              disciplinas: mappedDisciplinas,
              data: {
                concursoTitle: concursoTitle || 'Concurso Identificado',
                cargo: cargo || 'Cargo em Disputa',
                syllabus: sanitizedSyllabus,
                disciplinas: mappedDisciplinas
              }
            });
          }
        }
      } catch (aiErr) {
        console.warn('Gabarita Server: Erro na chamada Gemini API, acionando parser inteligente de contingência:', aiErr);
      }
    }

    // Fallback local robusto via editalParser
    const sanitizedSyllabus = parseSyllabusLocally(trimmedText);
    const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6'];
    const mappedDisciplinas = sanitizedSyllabus.map((item, idx) => {
      const upper = item.nome.toUpperCase();
      const isSpecific = upper.includes('ESPECÍF') || upper.includes('DIREITO') || upper.includes('CONTAB') || upper.includes('LEGISLAÇÃO');
      return {
        name: item.nome,
        sigla: item.sigla,
        code: item.sigla,
        weight: isSpecific ? 2.5 : 2.0,
        color: colors[idx % colors.length],
        topicos: item.topicos.map(tStr => ({
          name: tStr,
          importance: 'alta' as const,
          difficulty: 'media' as const,
          subtopicos: []
        }))
      };
    });

    const structured = {
      concursoTitle: concursoTitle || 'Certame Importado',
      cargo: cargo || 'Cargo Geral',
      syllabus: sanitizedSyllabus,
      disciplinas: mappedDisciplinas
    };

    return res.json({
      source: 'heuristic-parser',
      syllabus: sanitizedSyllabus,
      disciplinas: mappedDisciplinas,
      data: structured
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno ao processar edital.';
    console.error('Erro no parser de edital:', err);
    return res.status(500).json({ error: msg });
  }
});

function parseEditalHeuristic(rawText: string, cargo?: string, concursoTitle?: string) {
  // 4. RESTAURAÇÃO DE ESPAÇOS: Corrige nomes de disciplinas colados comuns vindos de extração de PDF
  let sanitized = rawText
    .replace(/\bDIREITOCONSTITUCIONAL\b/gi, 'DIREITO CONSTITUCIONAL')
    .replace(/\bDIREITOADMINISTRATIVO\b/gi, 'DIREITO ADMINISTRATIVO')
    .replace(/\bLÍNGUAPORTUGUESA\b/gi, 'LÍNGUA PORTUGUESA')
    .replace(/\bLINGUAPORTUGUESA\b/gi, 'LÍNGUA PORTUGUESA')
    .replace(/\bLEIORGÂNICADODISTRITOFEDERAL\b/gi, 'LEI ORGÂNICA DO DISTRITO FEDERAL')
    .replace(/\bLEIORGANICADODISTRITOFEDERAL\b/gi, 'LEI ORGÂNICA DO DISTRITO FEDERAL')
    .replace(/\bLEIORGÂNICA\b/gi, 'LEI ORGÂNICA')
    .replace(/\bDIREITOPENAL\b/gi, 'DIREITO PENAL')
    .replace(/\bDIREITOPROCESSUALPENAL\b/gi, 'DIREITO PROCESSUAL PENAL')
    .replace(/\bDIREITOPROCESSUALCIVIL\b/gi, 'DIREITO PROCESSUAL CIVIL')
    .replace(/\bDIREITOTRIBUTÁRIO\b/gi, 'DIREITO TRIBUTÁRIO')
    .replace(/\bDIREITOCIVIL\b/gi, 'DIREITO CIVIL')
    .replace(/\bRACIOCÍNIOLÓGICO\b/gi, 'RACIOCÍNIO LÓGICO')
    .replace(/\bRACIOCINIOLOGICO\b/gi, 'RACIOCÍNIO LÓGICO')
    .replace(/\bNOÇÕESDEINFORMÁTICA\b/gi, 'NOÇÕES DE INFORMÁTICA')
    .replace(/\bADMINISTRAÇÃOPÚBLICA\b/gi, 'ADMINISTRAÇÃO PÚBLICA')
    .replace(/\bCONTABILIDADEGERAL\b/gi, 'CONTABILIDADE GERAL');

  // 3. ANTI-AGLUTINAÇÃO: Quebra disciplina colada com primeiro tópico (ex: "LÍNGUAPORTUGUESA1Compreensão" ou "LÍNGUA PORTUGUESA1Compreensão")
  sanitized = sanitized
    .replace(/([A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,})(\d+(?:\.\d+)*\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç])/g, '$1\n$2')
    .replace(/([A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,}):(\d)/g, '$1:\n$2');

  const lines = sanitized.split('\n').map(l => l.trim()).filter(Boolean);
  const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6'];
  
  const editalItems: { disciplina: string; topicos: string[] }[] = [];
  let currentEditalItem: { disciplina: string; topicos: string[] } | null = null;

  // 5. LIMPEZA DE CABEÇALHOS: Ignora numerações estruturais como "15.2.2 CONHECIMENTOS BÁSICOS"
  const isStructuralHeader = (line: string) => {
    const cleaned = line.replace(/^[0-9\.\-\)\s]+/, '').trim().toUpperCase();
    return /^(?:CONHECIMENTOS\s+(?:BÁSICOS|ESPECÍFICOS|GERAIS|COMPLEMENTARES)|CONTEÚDO\s+PROGRAMÁTICO|DOS\s+OBJETOS\s+DE\s+AVALIAÇÃO|PROVA\s+OBJETIVA|CARGO\s*\d*)/i.test(cleaned);
  };

  // 1. HIERARQUIA ABSOLUTA: Reconhece cabeçalho de disciplina isolando a disciplina e sem juntar o primeiro tópico
  const isDisciplinaHeader = (line: string): { isHeader: boolean; cleanTitle: string; remainderTopic?: string } => {
    if (isStructuralHeader(line)) {
      return { isHeader: false, cleanTitle: '' };
    }

    // Caso de linha com tópico emendado: "LÍNGUA PORTUGUESA: 1 Compreensão..." ou "LEI ORGÂNICA DO DISTRITO FEDERAL 1 Fundamentos..."
    const gluedMatch = line.match(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{3,45}?)(?::|\s*-)?\s*(\d+(?:\.\d+)*\s+.*)$/);
    if (gluedMatch) {
      const candidateTitle = gluedMatch[1].replace(/^[0-9\.\-\)\s]+/, '').trim();
      if (candidateTitle.length >= 3 && candidateTitle === candidateTitle.toUpperCase()) {
        return { isHeader: true, cleanTitle: candidateTitle.toUpperCase(), remainderTopic: gluedMatch[2].trim() };
      }
    }

    const upper = line.toUpperCase().replace(/^[0-9\.\-\)\s]+/, '').trim();
    const knownDisciplinas = [
      'LÍNGUA PORTUGUESA', 'PORTUGUÊS', 'DIREITO CONSTITUCIONAL', 'DIREITO ADMINISTRATIVO', 
      'LEI ORGÂNICA DO DISTRITO FEDERAL', 'LEI ORGÂNICA', 'RACIOCÍNIO LÓGICO', 'RACIOCÍNIO LÓGICO-MATEMÁTICO', 
      'DIREITO TRIBUTÁRIO', 'CONTABILIDADE GERAL', 'CONTABILIDADE PÚBLICA', 'CONTABILIDADE', 'AUDITORIA', 
      'ADMINISTRAÇÃO PÚBLICA', 'ADMINISTRAÇÃO GERAL', 'DIREITO PENAL', 'DIREITO PROCESSUAL PENAL', 
      'DIREITO PROCESSUAL CIVIL', 'DIREITO CIVIL', 'LEGISLAÇÃO ESPECÍFICA', 'LEGISLAÇÃO ESPECIAL', 
      'INFORMÁTICA', 'NOÇÕES DE INFORMÁTICA', 'DIREITO FINANCEIRO', 'ÉTICA NO SERVIÇO PÚBLICO', 
      'NORMAS DA CORREGEDORIA'
    ];

    const matchedKnown = knownDisciplinas.find(k => upper === k || upper.startsWith(k + ':') || upper.startsWith(k + ' -') || upper.startsWith(k + '.'));
    if (matchedKnown) {
      const rest = upper.slice(matchedKnown.length).replace(/^[:\-\.]\s*/, '').trim();
      return { isHeader: true, cleanTitle: matchedKnown, remainderTopic: rest || undefined };
    }

    // Se a linha for totalmente em maiúsculas (sem pontuação final, sem ser frase descritiva longa e sem iniciar com numeração de tópico)
    if (line.length <= 50 && line === line.toUpperCase() && !/^\d+[\.\)]\s/.test(line) && !line.endsWith('.')) {
      const clean = line.replace(/^[0-9\.\-\)\s]+/, '').replace(/[:\-]$/, '').trim();
      if (clean.length >= 3 && !isStructuralHeader(clean)) {
        return { isHeader: true, cleanTitle: clean };
      }
    }

    return { isHeader: false, cleanTitle: '' };
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Pula cabeçalhos estruturais puros
    if (isStructuralHeader(line) && !line.includes(':') && !/\d+\s+[A-Za-z]/.test(line)) {
      continue;
    }

    const headerCheck = isDisciplinaHeader(line);

    if (headerCheck.isHeader) {
      // 1. HIERARQUIA ABSOLUTA: Nova disciplina sempre fecha a anterior e inicia uma nova na raiz
      currentEditalItem = {
        disciplina: headerCheck.cleanTitle.toUpperCase(),
        topicos: []
      };
      editalItems.push(currentEditalItem);

      if (headerCheck.remainderTopic) {
        const subSegments = headerCheck.remainderTopic.split(/(?=\b\d+(?:\.\d+)*[\.\)\-\s])/).map(s => s.trim()).filter(Boolean);
        for (const seg of subSegments) {
          currentEditalItem.topicos.push(seg);
        }
      }
      continue;
    }

    if (!currentEditalItem) {
      currentEditalItem = {
        disciplina: 'CONHECIMENTOS GERAIS',
        topicos: []
      };
      editalItems.push(currentEditalItem);
    }

    // 2. IDENTIFICAÇÃO DE TÓPICOS: Qualquer frase que inicie com número é um tópico
    const numberedMatches = line.split(/(?=\b\d+(?:\.\d+)*[\.\)]\s+)/).map(s => s.trim()).filter(Boolean);
    if (numberedMatches.length > 1) {
      for (const seg of numberedMatches) {
        currentEditalItem.topicos.push(seg);
      }
    } else {
      currentEditalItem.topicos.push(line);
    }
  }

  if (editalItems.length === 0 || editalItems.every(e => e.topicos.length === 0)) {
    editalItems.push({
      disciplina: 'CONTEÚDO PROGRAMÁTICO',
      topicos: ['1 Disposições gerais e tópicos do edital', '2 Fundamentos e matérias para estudo']
    });
  }

  const disciplinas = editalItems.map((item, idx) => {
    const isSpecific = item.disciplina.includes('ESPECÍF') || item.disciplina.includes('DIREITO') || item.disciplina.includes('CONTAB');
    return {
      name: item.disciplina,
      weight: isSpecific ? 2.5 : 2.0,
      color: colors[idx % colors.length],
      code: item.disciplina.replace(/[^A-Z]/g, '').slice(0, 4) || 'MAT',
      topicos: item.topicos.map(t => ({
        name: t.replace(/^\d+(?:\.\d+)*[\.\)\-\s]+/, '').trim() || t,
        rawText: t,
        importance: 'alta' as const,
        difficulty: 'media' as const,
        notes: '',
        subtopicos: []
      }))
    };
  });

  return {
    concursoTitle: concursoTitle || 'Certame Importado',
    cargo: cargo || 'Cargo Geral',
    edital: editalItems,
    disciplinas
  };
}

// Endpoint: AI Assistant with sanitized user data handling
app.post('/api/ai/assistant', async (req, res) => {
  try {
    const { query, userData } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Pergunta não fornecida.' });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });
        const prompt = `Você é o Assistente Especialista de Inteligência Artificial do "Gabarita", uma plataforma de estudos avançada para concursos públicos. Analise rigorosamente os DADOS REAIS DO USUÁRIO abaixo e responda à pergunta do usuário de forma clara, objetiva, motivadora e fundamentada exclusivamente nos dados. DADOS REAIS DO USUÁRIO (JSON): ${JSON.stringify(userData || {}, null, 2)} PERGUNTA DO USUÁRIO: "${query}" DIRETRIZES: 1. Responda estritamente com base nos dados fornecidos (horas, questões, revisões atrasadas, caderno de erros, evolução semanal, distribuição de tempo). 2. NUNCA invente dados ou suposições que não estejam presentes nos dados reais. Se faltarem dados, informe claramente. 3. Formate a resposta em Markdown limpo.`;
        
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        });
        if (response.text) {
          return res.json({ reply: response.text, source: 'gemini-ai' });
        }
      } catch (aiErr) {
        console.warn('Gabarita Server: Erro no Gemini Assistant, usando fallback analítico:', aiErr);
      }
    }

    const fallbackReply = generateHeuristicAssistantReply(query, userData);
    return res.json({ reply: fallbackReply, source: 'heuristic-fallback' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno no assistente IA.';
    return res.status(500).json({ error: msg });
  }
});

function generateHeuristicAssistantReply(query: string, data: any): string {
  const q = query.toLowerCase();
  const stats = data?.stats || {};
  const revisoes = data?.revisoes || [];
  const caderno = data?.cadernoErros || [];
  const revisoesAtrasadas = revisoes.filter((r: any) => r.status === 'atrasada' || r.status === 'pendente').length;
  const totalErros = caderno.length;

  if (q.includes('estudar hoje') || q.includes('hoje')) {
    return `### 📚 O que estudar hoje\n\nCom base no seu ritmo atual:\n- **Horas hoje:** ${stats.horasHoje || 0}h registradas.\n- **Revisões pendentes/atrasadas:** ${revisoesAtrasadas} itens aguardando fixação na sua curva de esquecimento.\n\n*Recomendação:* Foque em concluir suas revisões espaçadas prioritárias do dia e dedique pelo menos 2 horas a uma disciplina de maior peso no seu edital.`;
  }
  if (q.includes('atrasada') || q.includes('revisões')) {
    return `### ⏰ Revisões & Matérias Atrasadas\n\n- Você possui **${revisoesAtrasadas} revisões** pendentes ou em atraso.\n- **Taxa de acerto global:** ${stats.taxaAcertoGeral || 0}%.\n\n*Recomendação:* Acesse a aba de **Revisões Espaçadas** para zerar sua fila e evitar o esquecimento de conteúdo acumulado.`;
  }
  if (q.includes('erros') || q.includes('questões')) {
    return `### ❌ Assuntos com Mais Erros\n\n- **Total no Caderno de Erros:** ${totalErros} itens reincidentes.\n- **Questões resolvidas no total:** ${stats.questoesTotal || 0} questões.\n\n*Recomendação:* Revise os fundamentos dos tópicos cadastrados no seu Caderno de Erros antes de realizar novos simulados.`;
  }
  if (q.includes('evolução') || q.includes('semanal') || q.includes('tempo')) {
    return `### 📈 Evolução Semanal & Distribuição de Tempo\n\n- **Horas na Semana:** ${stats.horasSemana || 0}h (Meta semanal em andamento).\n- **Sequência (Streak):** ${stats.streakDias || 0} dias consecutivos de estudos.\n- **Cobertura do Edital:** ${stats.percentualEdital || 0}%.\n\n*Recomendação:* Mantenha sua constância diária para proteger seu nível (${stats.tituloNivel || 'Concurseiro'}).`;
  }
  return `### 💡 Gabarita Assistant\n\nAnalisei seus dados atuais:\n- **Horas totais:** ${stats.horasTotal || 0}h\n- **Questões resolvidas:** ${stats.questoesTotal || 0}q\n- **Sequência:** ${stats.streakDias || 0} dias\n\nComo posso te ajudar especificamente hoje? (Pergunte sobre: o que estudar hoje, revisões atrasadas, assuntos com mais erros ou evolução semanal).`;
}

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const portNumber = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
  app.listen(portNumber, '0.0.0.0', () => {
    console.log(`Gabarita server rodando em http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Erro ao iniciar servidor Gabarita:', err);
});

export default app;
