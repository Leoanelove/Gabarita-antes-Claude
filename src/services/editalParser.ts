/**
 * Gabarita - Módulo Especialista de Extração e Sanitização de Editais
 * Implementa estrutura rigorosa de dados, filtros contra ruídos e proteção de hierarquia.
 */

export interface ParsedSyllabusItem {
  nome: string;
  sigla: string;
  nomeDisciplina: string;
  topicos: string[];
}

/**
 * Gera uma sigla curta de até 4 letras maiúsculas para a matéria.
 * Ex: "Língua Portuguesa" -> "PORT", "Direito Constitucional" -> "DCON"
 */
export function generateSigla(name: string): string {
  if (!name) return 'MAT';
  const clean = name.replace(/[^a-zA-ZáéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ\s]/g, '').trim();
  const words = clean.split(/\s+/).filter(w => {
    const lower = w.toLowerCase();
    return !['de', 'do', 'da', 'dos', 'das', 'e', 'para', 'em', 'no', 'na', 'do', 'ao', 'aos'].includes(lower);
  });
  if (words.length >= 2) {
    if (words[0].toLowerCase() === 'direito' && words.length >= 2) {
      return ('D' + words[1].slice(0, 3)).toUpperCase();
    }
    const initials = words.map(w => w[0]).join('').slice(0, 4).toUpperCase();
    if (initials.length >= 2) return initials;
  }
  return clean.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'MAT';
}

// Cabeçalhos genéricos de agrupamento típicos de editais que NÃO são disciplinas nem tópicos
export const GENERIC_GROUPING_HEADERS = [
  'CONHECIMENTOS BÁSICOS E ESPECÍFICOS PARA O CARGO',
  'CONHECIMENTOS BÁSICOS E ESPECÍFICOS',
  'CONHECIMENTOS BÁSICOS',
  'CONHECIMENTOS ESPECÍFICOS',
  'CONHECIMENTOS GERAIS',
  'CONHECIMENTOS COMPLEMENTARES',
  'CONHECIMENTOS COMUNS',
  'CONHECIMENTOS TRANSVERSAIS',
  'CONTEÚDO PROGRAMÁTICO',
  'DOS OBJETOS DE AVALIAÇÃO',
  'OBJETOS DE AVALIAÇÃO',
  'PROVA OBJETIVA',
  'PROVAS OBJETIVAS',
  'PROGRAMA DE PROVA',
  'PROGRAMA DA PROVA',
  'QUADRO DE MATÉRIAS',
  'DISCIPLINAS DO CARGO',
  'DISCIPLINAS DO CONCURSO',
  'CARGO DE NÍVEL SUPERIOR',
  'CARGO DE NÍVEL MÉDIO',
  'ANEXO DO EDITAL',
  'HABILIDADES E CONHECIMENTOS'
];

/**
 * Verifica se uma string corresponde a um cabeçalho estrutural genérico do edital.
 */
export function isGenericGroupingHeader(text: string): boolean {
  if (!text) return false;
  const clean = text
    .replace(/^(?:[0-9\.\-\)\/\s]+)+/, '')
    .replace(/[\:\;\-\.\–\—\s]+$/, '')
    .trim()
    .toUpperCase();

  if (!clean) return true;

  if (GENERIC_GROUPING_HEADERS.some(h => clean === h || clean.startsWith(h))) {
    return true;
  }

  // Padrões regex para cabeçalhos estruturais comuns
  if (/^CONHECIMENTOS\s+(?:BÁSICOS|ESPECÍFICOS|GERAIS|COMPLEMENTARES|COMUNS|TRANSVERSAIS)/i.test(clean)) {
    return true;
  }
  if (/^CONHECIMENTOS\s+.*(?:CARGO|ÁREA|ESPECIALIDADE|PROVA)/i.test(clean)) {
    return true;
  }
  if (/^(?:PROVAS?\s+OBJETIVAS?|CONTEÚDO\s+PROGRAMÁTICO|DOS\s+OBJETOS\s+DE\s+AVALIAÇÃO|OBJETOS\s+DE\s+AVALIAÇÃO|HABILIDADES\s+E\s+CONHECIMENTOS|PROGRAMA\s+DAS?\s+PROVAS?|DISCIPLINAS\s+DO\s+CONCURSO)/i.test(clean)) {
    return true;
  }

  return false;
}

/**
 * Restaura espaçamento de disciplinas aglutinadas por extrações de PDF.
 */
export function restoreGluedDisciplineNames(text: string): string {
  return text
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
    .replace(/\bRACIOCÍNIOLÓGICOMATEMÁTICO\b/gi, 'RACIOCÍNIO LÓGICO-MATEMÁTICO')
    .replace(/\bNOÇÕESDEINFORMÁTICA\b/gi, 'NOÇÕES DE INFORMÁTICA')
    .replace(/\bADMINISTRAÇÃOPÚBLICA\b/gi, 'ADMINISTRAÇÃO PÚBLICA')
    .replace(/\bCONTABILIDADEGERAL\b/gi, 'CONTABILIDADE GERAL');
}

/**
 * Limpa o nome da disciplina: remove números iniciais e pontuações finais (ex: "1. LÍNGUA PORTUGUESA:" -> "LÍNGUA PORTUGUESA").
 */
export function cleanDisciplineName(rawName: string): string {
  if (!rawName) return '';
  let cleaned = restoreGluedDisciplineNames(rawName);

  // Remove números isolados ou prefixos ordinais no início (ex: "1. ", "1 - ", "1/ ")
  cleaned = cleaned.replace(/^(?:[0-9\.\-\)\/\s]+)+/, '').trim();

  // Remove pontuação final desnecessária (ex: ":", "-", ".", ";")
  cleaned = cleaned.replace(/[\:\;\-\.\–\—\s]+$/, '').trim();

  return cleaned;
}

/**
 * Sanitiza a string de um tópico individual.
 * Remove números ordinais no início, marcadores e pontuações finais (ex: "1.1 Sintaxe" -> "Sintaxe", "1 Compreensão" -> "Compreensão").
 */
export function sanitizeTopicString(rawTopic: string): string | null {
  if (!rawTopic || typeof rawTopic !== 'string') return null;

  let cleaned = rawTopic.trim();

  // 1. Remove marcação de marcadores ou numeração ordinal inicial do tópico (ex: "1.1 Sintaxe" -> "Sintaxe", "1 Compreensão" -> "Compreensão", "1. ", "• ", "- ")
  cleaned = cleaned.replace(/^(?:[\•\-\*\>\–\—\/\#\№\º\ª\■\□\▪\▫\+]\s*|\d+(?:\.\d+)*[\.\)\-\s\/\:]+)+/, '').trim();

  // 2. Remove pontuação solta ou final
  cleaned = cleaned.replace(/[\;\.\,\:\s]+$/, '').trim();

  // 3. Validação rigorosa de ruídos:
  // Descarta se ficou vazio
  if (!cleaned) return null;

  // Descarta se não contém nenhuma letra (elimina "133/", "1.", "1.1", "133/2021" isolado, "/", "-", "...")
  if (!/[a-zA-ZáéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/.test(cleaned)) {
    return null;
  }

  // Descarta se for ruído de paginação (ex: "Pág. 12", "Página 4", "Fls. 13")
  if (/^(?:p[áa]g(?:ina)?\.?|fls?\.?)\s*\d+$/i.test(cleaned)) {
    return null;
  }
  if (/^\d+\s*\/\s*\d+$/.test(cleaned)) {
    return null;
  }

  // Descarta se for cabeçalho genérico disfarçado de tópico
  if (isGenericGroupingHeader(cleaned)) {
    return null;
  }

  // Descarta se for excessivamente curto e não for sigla válida (menos de 2 caracteres)
  if (cleaned.length < 2) {
    return null;
  }

  return cleaned;
}

/**
 * Sanitiza e normaliza qualquer lista de disciplinas/tópicos (seja da IA, do fallback local ou de upload de JSON).
 * Retorna OBRIGATORIAMENTE o array tipado com { nome, sigla, nomeDisciplina, topicos }.
 */
export function sanitizeSyllabusData(rawItems: any[]): ParsedSyllabusItem[] {
  if (!Array.isArray(rawItems)) return [];

  const sanitizedList: ParsedSyllabusItem[] = [];

  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') continue;

    // Extrai o nome da disciplina de múltiplos formatos suportados
    const rawDiscName = raw.nome || raw.nomeDisciplina || raw.disciplina || raw.name || '';
    const cleanName = cleanDisciplineName(rawDiscName);

    // Validações da Disciplina:
    // 1. Deve possuir ao menos 2 letras
    if (!cleanName || !/[a-zA-ZáéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]{2,}/.test(cleanName)) {
      continue;
    }

    // 2. Não pode ser cabeçalho de agrupamento genérico
    if (isGenericGroupingHeader(cleanName)) {
      continue;
    }

    // Extrai e sanitiza os tópicos
    const rawTopics: any[] = Array.isArray(raw.topicos) ? raw.topicos : [];
    const validTopics: string[] = [];
    const seenTopics = new Set<string>();

    for (const item of rawTopics) {
      const topicStr = typeof item === 'string' ? item : (item?.name || item?.rawText || '');
      const cleanTopic = sanitizeTopicString(topicStr);

      if (cleanTopic && !seenTopics.has(cleanTopic.toLowerCase())) {
        seenTopics.add(cleanTopic.toLowerCase());
        validTopics.push(cleanTopic);
      }
    }

    // 4. PROTEÇÃO: Se a disciplina ficou sem tópicos válidos após a limpeza de ruídos, descarte o item
    if (validTopics.length === 0) {
      continue;
    }

    const rawSigla = raw.sigla || raw.code || '';
    const cleanSigla = (rawSigla ? rawSigla.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() : '') || generateSigla(cleanName);

    sanitizedList.push({
      nome: cleanName,
      sigla: cleanSigla,
      nomeDisciplina: cleanName,
      topicos: validTopics
    });
  }

  return sanitizedList;
}

/**
 * Limpa o texto bruto do edital antes do processamento:
 * Remove cabeçalhos de agrupamento genéricos e descola strings coladas de PDF.
 */
export function sanitizeSyllabusText(rawText: string): string {
  if (!rawText) return '';

  let sanitized = restoreGluedDisciplineNames(rawText);

  // Descola strings coladas como "LÍNGUAPORTUGUESA1Compreensão" -> "LÍNGUA PORTUGUESA\n1. Compreensão"
  // e "LÍNGUA PORTUGUESA1Compreensão" -> "LÍNGUA PORTUGUESA\n1 Compreensão"
  sanitized = sanitized
    .replace(/([A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,})(\d+(?:\.\d+)*\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç])/g, '$1\n$2')
    .replace(/([A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,}):(\d)/g, '$1:\n$2')
    .replace(/(^|\n|\s|:)(\d+(?:\.\d+)*)([A-ZÁÉÍÓÚÂÊÔÃÕÇa-z])/g, '$1$2 $3');

  // Processa linha a linha para eliminar cabeçalhos genéricos e ruídos
  const lines = sanitized.split('\n');
  const cleanLines: string[] = [];

  for (const line of lines) {
    let trimmed = line.trim();
    if (!trimmed) continue;

    // Se a linha não contém nenhuma letra (elimina "133/", "1.", "1.1", "/", "---")
    if (!/[a-zA-ZáéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/.test(trimmed)) {
      continue;
    }

    // Se a linha inteira for exclusivamente um cabeçalho de agrupamento genérico
    if (isGenericGroupingHeader(trimmed)) {
      continue;
    }

    // Se a linha começar com cabeçalho genérico seguido de dois pontos ou traço
    // (ex: "CONHECIMENTOS ESPECÍFICOS - CARGO AUDITOR FEDERAL: DIREITO ADMINISTRATIVO: 1...")
    for (const genHeader of GENERIC_GROUPING_HEADERS) {
      const genRegex = new RegExp(`^(?:\\d+(?:\\.\\d+)*[\\.\\)\\-\\s\\/]+)?${genHeader}[\\s\\-\\–\\—\\:]+`, 'i');
      if (genRegex.test(trimmed)) {
        trimmed = trimmed.replace(genRegex, '').trim();
      }
    }

    const genericPrefixRegex = /^(?:CONHECIMENTOS\s+(?:BÁSICOS|ESPECÍFICOS|GERAIS|COMPLEMENTARES|COMUNS)|CONTEÚDO\s+PROGRAMÁTICO|PROVAS?\s+OBJETIVAS?)[^:]*:\s*/i;
    if (genericPrefixRegex.test(trimmed)) {
      trimmed = trimmed.replace(genericPrefixRegex, '').trim();
    }

    if (trimmed && !isGenericGroupingHeader(trimmed)) {
      cleanLines.push(trimmed);
    }
  }

  return cleanLines.join('\n');
}

/**
 * Parser estruturado local de alta fidelidade:
 * Extrai disciplinas e tópicos de texto bruto respeitando hierarquia e regras de sanitização.
 */
export function parseSyllabusLocally(rawText: string): ParsedSyllabusItem[] {
  const sanitized = sanitizeSyllabusText(rawText);
  if (!sanitized.trim()) return [];

  const rawDisciplineItems: { nomeDisciplina: string; topicos: string[] }[] = [];
  let currentItem: { nomeDisciplina: string; topicos: string[] } | null = null;

  // Lista de disciplinas conhecidas para detecção prioritária
  const KNOWN_DISCIPLINAS = [
    'LÍNGUA PORTUGUESA', 'PORTUGUÊS', 'DIREITO CONSTITUCIONAL', 'DIREITO ADMINISTRATIVO',
    'LEI ORGÂNICA DO DISTRITO FEDERAL', 'LEI ORGÂNICA', 'RACIOCÍNIO LÓGICO', 'RACIOCÍNIO LÓGICO-MATEMÁTICO',
    'DIREITO TRIBUTÁRIO', 'CONTABILIDADE GERAL', 'CONTABILIDADE PÚBLICA', 'CONTABILIDADE', 'AUDITORIA',
    'ADMINISTRAÇÃO PÚBLICA', 'ADMINISTRAÇÃO GERAL', 'DIREITO PENAL', 'DIREITO PROCESSUAL PENAL',
    'DIREITO PROCESSUAL CIVIL', 'DIREITO CIVIL', 'LEGISLAÇÃO ESPECÍFICA', 'LEGISLAÇÃO ESPECIAL',
    'INFORMÁTICA', 'NOÇÕES DE INFORMÁTICA', 'DIREITO FINANCEIRO', 'ÉTICA NO SERVIÇO PÚBLICO',
    'NORMAS DA CORREGEDORIA'
  ];

  // Helper para detectar se uma linha ou trecho é um cabeçalho de disciplina
  const detectDisciplineHeader = (line: string): { isHeader: boolean; title: string; remainderText?: string } => {
    const cleanLine = line.trim();
    if (!cleanLine) return { isHeader: false, title: '' };

    // Se a linha começar com cabeçalho genérico e tiver dois pontos com a matéria na sequência:
    // Ex: "CONHECIMENTOS ESPECÍFICOS - CARGO AUDITOR: DIREITO ADMINISTRATIVO: 1. Estado..."
    let candidateLine = cleanLine;
    for (const genHeader of GENERIC_GROUPING_HEADERS) {
      const genRegex = new RegExp(`^${genHeader}[\\s\\-\\–\\—\\:]+`, 'i');
      if (genRegex.test(candidateLine)) {
        candidateLine = candidateLine.replace(genRegex, '').trim();
      }
    }

    // 1. Verifica disciplinas conhecidas
    const upper = candidateLine.toUpperCase().replace(/^[0-9\.\-\)\/\s]+/, '').trim();
    for (const kd of KNOWN_DISCIPLINAS) {
      if (
        upper === kd ||
        upper.startsWith(kd + ':') ||
        upper.startsWith(kd + ' -') ||
        upper.startsWith(kd + '.') ||
        upper.startsWith(kd + ' ')
      ) {
        const rawAfter = candidateLine.replace(/^[0-9\.\-\)\/\s]+/, '').slice(kd.length);
        const afterKd = rawAfter.replace(/^[:\-\.]\s*/, '').trim();
        return { isHeader: true, title: kd, remainderText: afterKd || undefined };
      }
    }

    // 2. Linha com título em MAIÚSCULAS seguido de tópico numerado (ex: "LEI ORGÂNICA DO DF 1 Fundamentos...")
    const upperWithTopicMatch = candidateLine.match(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{3,45}?)(?::|\s*-)?\s+(\d+(?:\.\d+)*\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇa-z].*)$/);
    if (upperWithTopicMatch) {
      const candidateTitle = cleanDisciplineName(upperWithTopicMatch[1]);
      if (candidateTitle.length >= 3 && !isGenericGroupingHeader(candidateTitle)) {
        return { isHeader: true, title: candidateTitle, remainderText: upperWithTopicMatch[2].trim() };
      }
    }

    // 3. Linha em formato "TITULO EM MAIÚSCULAS: resto do texto"
    const colonMatch = candidateLine.match(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{3,45}?):(?:\s*(.*))?$/);
    if (colonMatch) {
      const candidateTitle = cleanDisciplineName(colonMatch[1]);
      if (candidateTitle.length >= 3 && !isGenericGroupingHeader(candidateTitle)) {
        return { isHeader: true, title: candidateTitle, remainderText: colonMatch[2] ? colonMatch[2].trim() : undefined };
      }
    }

    // 4. Linha toda em MAIÚSCULAS isolada (sem número de tópico)
    if (candidateLine.length <= 50 && candidateLine === candidateLine.toUpperCase() && !/^\d+[\.\)]\s/.test(candidateLine) && !candidateLine.endsWith('.')) {
      const cleanTitle = cleanDisciplineName(candidateLine);
      if (cleanTitle.length >= 3 && !isGenericGroupingHeader(cleanTitle)) {
        return { isHeader: true, title: cleanTitle };
      }
    }

    return { isHeader: false, title: '' };
  };

  // Helper para dividir um parágrafo/trecho de tópicos em tópicos menores
  // CUIDADO: NUNCA quebra em números de leis como "14.133/2021" ou "art. 5º"!
  const splitTopicsFromText = (text: string): string[] => {
    if (!text || !text.trim()) return [];

    // 1. Se tem tópicos numerados explícitos (ex: "1. ", "1.1 ", "2. ", "1 ")
    const hasNumberedPattern = /(?:\n|\b)\d+(?:\.\d+)*[\.\)]\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇa-z]/.test(text);

    if (hasNumberedPattern) {
      // Divide com lookahead no início do próximo número de tópico
      const segments = text.split(/(?=(?:\n|\s|^)\d+(?:\.\d+)*[\.\)]\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇa-z])/).map(s => s.trim()).filter(Boolean);
      if (segments.length > 1) {
        return segments;
      }
    }

    // 2. Se não tem numeração, divide por ponto e vírgula ou por ponto final que não esteja dentro de números ou leis
    // Regex protege:
    // - números com ponto (ex: 14.133)
    // - abreviações comuns (nº, art, inc, al, etc.)
    const rawSegments = text.split(/(?:;|\.(?!\d)(?<!\b(?:Lei|Leis|nº|no|art|arts|inc|al|fl|fls|v|vs|p|pág|pag|par|cf|cpc|cpp|clt|ec)))\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇa-z0-9])/);
    return rawSegments.map(s => s.trim()).filter(Boolean);
  };

  const lines = sanitized.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const header = detectDisciplineHeader(line);

    if (header.isHeader) {
      currentItem = {
        nomeDisciplina: header.title,
        topicos: []
      };
      rawDisciplineItems.push(currentItem);

      if (header.remainderText) {
        const topics = splitTopicsFromText(header.remainderText);
        for (const t of topics) {
          currentItem.topicos.push(t);
        }
      }
      continue;
    }

    // Se não é cabeçalho de disciplina, pertence à disciplina corrente
    if (!currentItem) {
      // Se ainda não abriu disciplina e não é cabeçalho genérico, cria disciplina com o título da primeira linha ou geral
      if (!isGenericGroupingHeader(line)) {
        currentItem = {
          nomeDisciplina: 'Conhecimentos do Edital',
          topicos: []
        };
        rawDisciplineItems.push(currentItem);
      }
    }

    if (currentItem) {
      const topics = splitTopicsFromText(line);
      for (const t of topics) {
        currentItem.topicos.push(t);
      }
    }
  }

  // Passa pelo sanitizador rigoroso antes de entregar
  return sanitizeSyllabusData(rawDisciplineItems);
}
