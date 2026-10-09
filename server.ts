import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeSyllabusData, parseSyllabusLocally, type ParsedSyllabusItem } from './src/services/editalParser.ts';

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

        const systemInstruction = `Você é um analisador semântico especializado em conteúdo programático de concursos públicos brasileiros (Cebraspe, FGV, FCC, Vunesp, Cesgranrio, AOCP, etc.).
Sua missão é ler o texto bruto colado pelo candidato e convertê-lo em uma estrutura hierárquica limpa: Disciplinas -> Tópicos.

REGRAS DE EXTRAÇÃO UNIVERSAL:

1. PROIBIÇÃO DE MATÉRIA GENÉRICA:
- É terminantemente PROIBIDO criar matérias com nomes genéricos como "Conhecimentos do Edital", "Geral", "Matérias", "Conteúdo Programático" ou "Conhecimentos Comuns/Específicos".
- Um edital DEVE conter múltiplas disciplinas autônomas (Língua Portuguesa, Raciocínio Lógico, História e Geografia, Noções de Direito Constitucional, etc.).
- NUNCA agrupe o edital inteiro dentro de uma única matéria fictícia.

2. INTEGRIDADE DO NOME DA DISCIPLINA:
- Preposições e complementos contidos na mesma linha do título pertencem integralmente ao nome da matéria (ex: "HISTÓRIA E GEOGRAFIA DE GOIÁS" deve ser "História e Geografia de Goiás", e JAMAIS "História e Geografia" com "DE GOIÁS..." caindo como primeiro tópico).
- Mantenha a denominação territorial ou institucional completa (ex: "História e Geografia de Goiás", "Legislação do Município de Goiânia", "Direito da Criança e do Adolescente").
- Limpe informações de prova e pesos entre parênteses do nome da disciplina (ex: "(15 questões)", "(peso 1)", "(5 questões)", "(10 itens)" são descartados).
- Normalize o nome da matéria em Title Case (ex: "Língua Portuguesa", "História e Geografia de Goiás", "Legislação Complementar", "Noções de Direito Constitucional").

3. FALSOS POSITIVOS NO MEIO DE FRASES (PROTEÇÃO CRÍTICA):
- Um ramo do conhecimento só é considerado início de NOVA DISCIPLINA se estiver como cabeçalho ou linha ISOLADA no texto.
- Um título de disciplina NUNCA pode ser criado a partir de uma menção temática que esteja sintaticamente no meio de uma frase (ex: "Normas relativas à Administração Pública", "...sobre Direito Tributário...", "...conforme Código Civil..."). Termos que surjam no meio de uma frase gramatical pertencem estritamente ao tópico da disciplina corrente e JAMAIS abrem uma nova disciplina!

4. DEMARCADORES DE PROVA E DISCIPLINAS QUE NUNCA DEVEM VIRAR TÓPICOS:
- Nomes de cargos e áreas (ex: 'ANALISTA JUDICIÁRIO – ÁREA...', 'TÉCNICO...', 'CARGO 1:', 'CARGO 2:') são demarcadores de prova, JAMAIS devem se tornar tópicos de estudo de nenhuma disciplina.
- Cabeçalhos que introduzem áreas autônomas de saber ou leis (ex: "LEGISLAÇÃO COMPLEMENTAR (10 questões)", "NOÇÕES DE INFORMÁTICA", "DIREITO ADMINISTRATIVO") encerram imediatamente a matéria anterior e DEVEM abrir um novo objeto dentro do array "disciplinas". Jamais os insira como tópicos da matéria anterior!

5. CRITÉRIO RIGOROSO PARA TÓPICOS:
- Cada tópico deve representar uma unidade temática e gramatical completa com sentido pleno.
- Se houver numeração explícita ("1.", "1.1", "a)", "•", "-"): separe pelos marcadores, removendo a numeração prefixada.
- Se o texto for corrido ou contínuo: divida pelo sentido sintático dos conceitos, guiando-se por pontos finais (.) ou pontos e vírgulas (;).
- NUNCA quebre um tópico no meio de uma locução verbal, sintagma preposicional ou citação explicativa. Frases explicativas entre parênteses pertencem integralmente ao tópico pai e jamais devem virar tópicos isolados.
- NUNCA crie tópicos que comecem ou terminem com conectivos ou preposições soltas ("da", "de", "do", "e", "para", "em", "com").

6. EXPURGO DE RUÍDOS DE PÁGINA:
- Descarte sumariamente: cabeçalhos de bloco ("CONHECIMENTOS COMUNS", "CONHECIMENTOS ESPECÍFICOS", nomes de cargos), carimbos de processos eletrônicos (ex: "Nº Processo PROAD...", "Processo SEI nº..."), assinaturas digitais ("Assinado digitalmente por...", "Para validar este documento...") e hashes/códigos de validação.

7. EXEMPLO PRÁTICO DE ENTRADA E SAÍDA (FEW-SHOT):

Texto de Entrada Bruto:
"""
CONHECIMENTOS COMUNS
LÍNGUA PORTUGUESA (15 questões)
Leitura e interpretação de textos. Ortografia oficial. Pontuação. Concordância nominal e verbal.
HISTÓRIA E GEOGRAFIA DE GOIÁS (5 questões)
Povoamento e formação territorial. Economia e sociedade no século XX.
LEGISLAÇÃO COMPLEMENTAR (10 questões)
Regime jurídico dos servidores públicos civis. Estatuto dos Servidores.
CONHECIMENTOS ESPECÍFICOS
NOÇÕES DE DIREITO CONSTITUCIONAL
Direitos e garantias fundamentais. Princípios constitucionais relativos à Administração Pública. Remédios constitucionais.
Nº Processo PROAD 98765/2024 - Assinado digitalmente por Desembargador Presidente. Para validar este documento acesse o link https://tjgo.jus.br/validar
"""

Saída JSON Obrigatória:
{
  "disciplinas": [
    {
      "name": "Língua Portuguesa",
      "topicos": [
        "Leitura e interpretação de textos",
        "Ortografia oficial",
        "Pontuação",
        "Concordância nominal e verbal"
      ]
    },
    {
      "name": "História e Geografia de Goiás",
      "topicos": [
        "Povoamento e formação territorial",
        "Economia e sociedade no século XX"
      ]
    },
    {
      "name": "Legislação Complementar",
      "topicos": [
        "Regime jurídico dos servidores públicos civis",
        "Estatuto dos Servidores"
      ]
    },
    {
      "name": "Noções de Direito Constitucional",
      "topicos": [
        "Direitos e garantias fundamentais",
        "Princípios constitucionais relativos à Administração Pública",
        "Remédios constitucionais"
      ]
    }
  ]
}

SCHEMA JSON DE SAÍDA:
{
  "disciplinas": [
    {
      "name": "Nome da Matéria",
      "topicos": ["Tópico 1", "Tópico 2"]
    }
  ]
}`;
        
        const prompt = `${systemInstruction}

TEXTO BRUTO DO EDITAL A SER ANALISADO (Cargo: "${cargo || 'Geral'}", Concurso: "${concursoTitle || 'Certame'}"):
\"\"\"
${trimmedText.slice(0, 45000)}
\"\"\"

ATENÇÃO RIGOROSA:
- É expressamente PROIBIDO criar matérias com nomes genéricos como "Conhecimentos do Edital", "Geral", "Matérias" ou "Conteúdo Programático".
- Preserve o nome integral da disciplina com seu território/ramo (ex: "História e Geografia de Goiás", e NÃO cortar em "DE GOIÁS").
- "Legislação Complementar" é uma matéria independente e NÃO pode virar tópico de outra matéria.
- Frases no meio do texto mencionando "...relativas à Administração Pública..." pertencem ao tópico atual e NÃO abrem nova matéria.
- Remova e descarte carimbos ("Nº Processo PROAD...", "Assinado digitalmente por...") e metadados de questões ("(15 questões)").`;
        
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                disciplinas: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      topicos: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                      }
                    },
                    required: ['name', 'topicos']
                  }
                }
              },
              required: ['disciplinas']
            }
          }
        });

        if (response.text) {
          const parsedRaw = JSON.parse(response.text);
          const rawItemsArray = Array.isArray(parsedRaw)
            ? parsedRaw
            : (parsedRaw.disciplinas || parsedRaw.edital || parsedRaw.syllabus || []);
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
