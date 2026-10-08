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
  'CONHECIMENTOS DO EDITAL',
  'CONHECIMENTOS GERAIS DO EDITAL',
  'GERAL',
  'MATÉRIAS',
  'MATERIAS',
  'DISCIPLINAS',
  'CONTEÚDO PROGRAMÁTICO',
  'CONTEUDO PROGRAMATICO',
  'CONHECIMENTOS BÁSICOS E ESPECÍFICOS PARA O CARGO',
  'CONHECIMENTOS BÁSICOS E ESPECÍFICOS',
  'CONHECIMENTOS BÁSICOS',
  'CONHECIMENTOS ESPECÍFICOS',
  'CONHECIMENTOS GERAIS',
  'CONHECIMENTOS COMPLEMENTARES',
  'CONHECIMENTOS COMUNS',
  'CONHECIMENTOS TRANSVERSAIS',
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
 * Converte títulos de disciplinas em caixa alta para Title Case formal,
 * preservando conectivos minúsculos (de, do, da, e, em) e siglas consagradas (DF, TI, etc.).
 */
export function formatDisciplineTitleCase(name: string): string {
  if (!name) return '';
  // Se o texto não estiver totalmente em maiúsculas (ex: "Noções de Direito Constitucional"), preserva
  if (name !== name.toUpperCase()) return name;
  const lowerWords = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'ou', 'em', 'no', 'na', 'nos', 'nas', 'para', 'com', 'por', 'a', 'o', 'as', 'os', 'à', 'às']);
  const acronyms = new Set(['DF', 'TI', 'RLM', 'SUS', 'ECA', 'CPC', 'CPP', 'CLT', 'CF', 'LODF']);
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      const upper = word.toUpperCase();
      if (acronyms.has(upper)) return upper;
      if (index > 0 && lowerWords.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Limpa o nome da disciplina: remove números iniciais e pontuações finais (ex: "1. LÍNGUA PORTUGUESA:" -> "LÍNGUA PORTUGUESA").
 */
export function cleanDisciplineName(rawName: string): string {
  if (!rawName) return '';
  let cleaned = restoreGluedDisciplineNames(rawName);

  // Remove números isolados ou prefixos ordinais no início (ex: "1. ", "1 - ", "1/ ")
  cleaned = cleaned.replace(/^(?:[0-9\.\-\)\/\s]+)+/, '').trim();

  // Remove informações de prova entre parênteses como "(15 questões)", "(peso 1)", "(5 questões)", "(10 itens)"
  cleaned = cleaned.replace(/\s*\(\s*\d+\s*(?:questões|questoes|itens|pontos|vagas)[^\)]*\)/gi, '').trim();
  cleaned = cleaned.replace(/\s*\(\s*peso\s*\d+[^\)]*\)/gi, '').trim();

  // Remove pontuação final desnecessária (ex: ":", "-", ".", ";")
  cleaned = cleaned.replace(/[\:\;\-\.\–\—\s]+$/, '').trim();

  return formatDisciplineTitleCase(cleaned);
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

  // Descarta se for ruído de carimbos de processos ou assinaturas digitais
  if (/^(?:N[º°o]\.?\s*(?:Processo|Doc|Documento|PROAD|SEI)|Processo\s*n[º°o]|Assinado\s+digitalmente|Documento\s+assinado|Para\s+validar\s+(?:este|o)\s+documento|Hash\s+de\s+validação|Chave\s+de\s+acesso|Autenticidade\s+garantida|Validação\s+em:?|Código\s+verificador|Data\s+do\s+julgamento|Diário\s+Oficial)\b/i.test(cleaned)) {
    return null;
  }

  // Remove sufixos de carimbos ou assinaturas digitais se colados ao final do texto do tópico
  cleaned = cleaned.replace(/\s*(?:N[º°o]\.?\s*(?:Processo|Doc|PROAD|SEI)|Assinado\s+digitalmente\s+por|Para\s+validar\s+(?:este|o)\s+documento).*$/i, '').trim();

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
 * Sanitização prévia de texto de edital (regex no frontend antes do envio para a IA/parser):
 * Remove assinaturas digitais, carimbos de processos, links de validação e números de página isolados.
 */
export function preSanitizeEditalText(text: string): string {
  if (!text) return '';
  return text
    // Remove linhas com processos, PROAD, SEI
    .replace(/^.*N[ºo°]?\s*Processo.*$/gim, '')
    // Remove linhas de assinatura digital
    .replace(/^.*Assinado\s+digitalmente\s+por.*$/gim, '')
    // Remove links/instruções de validação de documentos
    .replace(/^.*Para\s+validar\s+este\s+documento.*$/gim, '')
    .replace(/^.*Para\s+conferência\s+acesse.*$/gim, '')
    // Remove URLs isoladas ou links http/https
    .replace(/https?:\/\/\S+/gim, '')
    // Remove numeração de página isolada (ex: linha apenas com número)
    .replace(/^\s*\d+\s*$/gm, '')
    // Remove paginação com barra (ex: 12/45 ou 3 / 80)
    .replace(/^\s*\d+\s*\/\s*\d+\s*$/gm, '')
    // Normaliza múltiplas quebras de linha consecutivas
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Normaliza o texto de entrada do edital reconstituindo quebras de linha indevidas
 * no meio de frases provocadas por cópias de PDFs ou quebras de parágrafo.
 */
export function reconstituteBrokenPdfLines(rawText: string): string {
  if (!rawText) return '';
  const lines = rawText.split(/\r?\n/);
  const result: string[] = [];

  const connectivesEnd = /\b(?:da|de|do|das|dos|e|ou|para|em|no|na|nos|nas|com|por|sem|sob|sobre|entre|conforme|segundo|ao|aos|à|às|cujo|cuja|cujos|cujas|que|onde|pelo|pela|pelos|pelas)\s*$/i;
  const startsWithNumberOrBullet = /^\s*(?:\d+(?:\.\d+)*[\.\)\-\:\s]|[a-z]\)|\•|\-|\*|\—|\–)\s+[A-Za-zÀ-ÿ]/;

  for (let i = 0; i < lines.length; i++) {
    const current = lines[i].trim();
    if (!current) continue;

    // Se a linha for ruído administrativo, carimbo ou assinatura digital, descarte sumariamente
    const isNoiseOrStamp = /^(?:N[º°o]\.?\s*(?:Processo|Doc|Documento|PROAD|SEI)|Processo\s*n[º°o]|Assinado\s+digitalmente|Documento\s+assinado|Para\s+validar\s+(?:este|o)\s+documento|Hash\s+de\s+validação|Chave\s+de\s+acesso|Diário\s+Oficial)\b/i.test(current);
    if (isNoiseOrStamp) {
      continue;
    }

    if (result.length === 0) {
      result.push(current);
      continue;
    }

    const prevIndex = result.length - 1;
    const prev = result[prevIndex];

    // Se a linha anterior ou a atual for cabeçalho genérico ou título de disciplina, NUNCA mescle
    const strippedCurrent = current.replace(/\s*\([^\)]*\)/g, '').trim();
    const isCurrentDisciplineLike =
      (strippedCurrent.length <= 55 && strippedCurrent === strippedCurrent.toUpperCase() && !/^\d+[\.\)]\s/.test(strippedCurrent)) ||
      /^(?:Noções de|Direito|Língua|Raciocínio|Legislação|História|Geografia|Administração|Contabilidade|Informática)\b/i.test(strippedCurrent);

    if (isGenericGroupingHeader(prev) || isGenericGroupingHeader(current) || isCurrentDisciplineLike) {
      result.push(current);
      continue;
    }

    const openParens = (prev.match(/\(/g) || []).length;
    const closeParens = (prev.match(/\)/g) || []).length;
    const hasUnclosedParen = openParens > closeParens;

    const endsWithConnective = connectivesEnd.test(prev);
    const endsWithComma = /[\,\-]\s*$/.test(prev);
    const startsWithLowercase = /^[a-záéíóúâêôãõç]/.test(current);
    const startsWithClosingParen = /^\)/.test(current);
    const prevEndsWithPeriodOrSemi = /[\.\;\:]$/.test(prev);
    const currIsNewNumberedTopic = startsWithNumberOrBullet.test(current);

    const shouldMerge =
      endsWithConnective ||
      hasUnclosedParen ||
      endsWithComma ||
      startsWithLowercase ||
      startsWithClosingParen ||
      (!prevEndsWithPeriodOrSemi && !currIsNewNumberedTopic && current.length > 0 && !isCurrentDisciplineLike);

    if (shouldMerge) {
      result[prevIndex] = `${prev} ${current}`;
    } else {
      result.push(current);
    }
  }

  return result.join('\n');
}

/**
 * Unifica tópicos contíguos que foram partidos indevidamente no meio de orações.
 * Resolve casos reais como:
 * - "Sintaxe da" + "oração e do período" -> "Sintaxe da oração e do período"
 * - "...Redação da" + "Presidência da República)" -> "...Redação da Presidência da República)"
 */
export function stitchBrokenTopics(topics: string[]): string[] {
  if (!topics || topics.length <= 1) return topics || [];
  const stitched: string[] = [];

  const connectivesEnd = /\b(?:da|de|do|das|dos|e|ou|para|em|no|na|nos|nas|com|por|sem|sob|sobre|entre|conforme|segundo|ao|aos|à|às|cujo|cuja|cujos|cujas|pelo|pela|pelos|pelas)\s*$/i;
  const connectivesStart = /^(?:da|de|do|das|dos|e|ou|para|em|no|na|nos|nas|com|por|sem|sob|sobre|entre|ao|aos|à|às|pelo|pela|pelos|pelas)\b/i;

  for (let i = 0; i < topics.length; i++) {
    const raw = (topics[i] || '').trim();
    if (!raw) continue;

    if (stitched.length === 0) {
      stitched.push(raw);
      continue;
    }

    const prevIdx = stitched.length - 1;
    const prev = stitched[prevIdx];

    const openParens = (prev.match(/\(/g) || []).length;
    const closeParens = (prev.match(/\)/g) || []).length;
    const hasUnclosedParen = openParens > closeParens;

    const endsWithConn = connectivesEnd.test(prev);
    const endsWithCommaOrColon = /[\,\:\-]\s*$/.test(prev);
    const startsWithConn = connectivesStart.test(raw);
    const startsWithLower = /^[a-záéíóúâêôãõç]/.test(raw);
    const startsWithCloseParen = /^\)/.test(raw);

    if (endsWithConn || hasUnclosedParen || endsWithCommaOrColon || startsWithConn || startsWithLower || startsWithCloseParen) {
      stitched[prevIdx] = `${prev} ${raw}`.replace(/\s+/g, ' ').trim();
    } else {
      stitched.push(raw);
    }
  }

  return stitched;
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
    const rawTopics: any[] = Array.isArray(raw.topicos) ? raw.topicos : (Array.isArray(raw.topics) ? raw.topics : []);
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

    // Unifica tópicos fragmentados indevidamente
    const stitchedTopics = stitchBrokenTopics(validTopics);

    // 4. PROTEÇÃO: Se a disciplina ficou sem tópicos válidos após a limpeza de ruídos, descarte o item
    if (stitchedTopics.length === 0) {
      continue;
    }

    const rawSigla = raw.sigla || raw.code || '';
    const cleanSigla = (rawSigla ? rawSigla.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() : '') || generateSigla(cleanName);

    sanitizedList.push({
      nome: cleanName,
      sigla: cleanSigla,
      nomeDisciplina: cleanName,
      topicos: stitchedTopics
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
  const reconstituted = reconstituteBrokenPdfLines(rawText);
  const sanitized = sanitizeSyllabusText(reconstituted);
  if (!sanitized.trim()) return [];

  const rawDisciplineItems: { nomeDisciplina: string; topicos: string[] }[] = [];
  let currentItem: { nomeDisciplina: string; topicos: string[] } | null = null;

  // Lista de disciplinas conhecidas para detecção prioritária
  const KNOWN_DISCIPLINAS = [
    'LÍNGUA PORTUGUESA', 'PORTUGUÊS', 'DIREITO CONSTITUCIONAL', 'DIREITO ADMINISTRATIVO',
    'HISTÓRIA E GEOGRAFIA DE GOIÁS', 'HISTÓRIA E GEOGRAFIA DO ESTADO', 'HISTÓRIA E GEOGRAFIA',
    'HISTÓRIA DO BRASIL', 'HISTÓRIA', 'GEOGRAFIA',
    'LEGISLAÇÃO COMPLEMENTAR', 'LEGISLAÇÃO ESPECÍFICA', 'LEGISLAÇÃO ESPECIAL', 'LEGISLAÇÃO INSTITUCIONAL',
    'LEI ORGÂNICA DO DISTRITO FEDERAL', 'LEI ORGÂNICA', 'RACIOCÍNIO LÓGICO', 'RACIOCÍNIO LÓGICO-MATEMÁTICO',
    'DIREITO TRIBUTÁRIO', 'CONTABILIDADE GERAL', 'CONTABILIDADE PÚBLICA', 'CONTABILIDADE', 'AUDITORIA',
    'ADMINISTRAÇÃO PÚBLICA', 'ADMINISTRAÇÃO GERAL', 'DIREITO PENAL', 'DIREITO PROCESSUAL PENAL',
    'DIREITO PROCESSUAL CIVIL', 'DIREITO CIVIL',
    'INFORMÁTICA', 'NOÇÕES DE INFORMÁTICA', 'DIREITO FINANCEIRO', 'ÉTICA NO SERVIÇO PÚBLICO',
    'NOÇÕES DE DIREITO CONSTITUCIONAL', 'NOÇÕES DE DIREITO ADMINISTRATIVO', 'NOÇÕES DE ADMINISTRAÇÃO PÚBLICA',
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

    if (isGenericGroupingHeader(candidateLine)) {
      return { isHeader: false, title: '' };
    }

    // Limpa metadados entre parênteses para teste (ex: "LÍNGUA PORTUGUESA (15 questões)" -> "LÍNGUA PORTUGUESA")
    const strippedCandidate = candidateLine
      .replace(/\s*\(\s*\d+\s*(?:questões|questoes|itens|pontos|vagas)[^\)]*\)/gi, '')
      .replace(/\s*\(\s*peso\s*\d+[^\)]*\)/gi, '')
      .trim();

    // 1. Verifica disciplinas conhecidas
    const upper = strippedCandidate.toUpperCase().replace(/^[0-9\.\-\)\/\s]+/, '').trim();
    for (const kd of KNOWN_DISCIPLINAS) {
      if (
        upper === kd ||
        upper.startsWith(kd + ':') ||
        upper.startsWith(kd + ' -') ||
        upper.startsWith(kd + '.') ||
        upper.startsWith(kd + ' ') ||
        upper.startsWith(kd + '(')
      ) {
        const rawAfter = strippedCandidate.replace(/^[0-9\.\-\)\/\s]+/, '').slice(kd.length).trim();
        // Se após a matéria conhecida houver conectivo ou complemento territorial/institucional (ex: "DE GOIÁS", "DO ESTADO", "APLICADA")
        // ou se não houver dois pontos nem número de tópico (ex: "1. "), o título completo pertence integralmente à disciplina!
        const hasTopicNumber = /^(?:\d+(?:\.\d+)*[\.\)\s]|[a-z]\)|\•|\-)/.test(rawAfter);
        const hasColon = rawAfter.startsWith(':');
        const continuesTitle = /^(?:DE|DO|DA|DOS|DAS|E|EM|NO|NA|PARA|APLICAD[AO]|MUNICIPAL|ESTADUAL|FEDERAL)\b/i.test(rawAfter);

        if (!hasTopicNumber && !hasColon && (continuesTitle || strippedCandidate.length <= 70)) {
          // Preserva a integridade do nome completo da matéria na mesma linha (ex: "História e Geografia de Goiás")
          return { isHeader: true, title: cleanDisciplineName(strippedCandidate) };
        }

        const afterKd = rawAfter.replace(/^[:\-\.]\s*/, '').trim();
        return { isHeader: true, title: cleanDisciplineName(kd), remainderText: afterKd || undefined };
      }
    }

    // 2. Linha com título em MAIÚSCULAS seguido de tópico numerado (ex: "LEI ORGÂNICA DO DF 1 Fundamentos...")
    const upperWithTopicMatch = strippedCandidate.match(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{3,45}?)(?::|\s*-)?\s+(\d+(?:\.\d+)*\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇa-z].*)$/);
    if (upperWithTopicMatch) {
      const candidateTitle = cleanDisciplineName(upperWithTopicMatch[1]);
      if (candidateTitle.length >= 3 && !isGenericGroupingHeader(candidateTitle)) {
        return { isHeader: true, title: candidateTitle, remainderText: upperWithTopicMatch[2].trim() };
      }
    }

    // 3. Linha em formato "TITULO EM MAIÚSCULAS: resto do texto"
    const colonMatch = strippedCandidate.match(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{3,45}?):(?:\s*(.*))?$/);
    if (colonMatch) {
      const candidateTitle = cleanDisciplineName(colonMatch[1]);
      if (candidateTitle.length >= 3 && !isGenericGroupingHeader(candidateTitle)) {
        return { isHeader: true, title: candidateTitle, remainderText: colonMatch[2] ? colonMatch[2].trim() : undefined };
      }
    }

    // 4. Linha toda em MAIÚSCULAS isolada (sem número de tópico) ou título substantivo de matéria
    if (strippedCandidate.length <= 60 && !/^\d+[\.\)]\s/.test(strippedCandidate) && !strippedCandidate.endsWith('.')) {
      const cleanTitle = cleanDisciplineName(strippedCandidate);
      if (
        cleanTitle.length >= 3 &&
        !isGenericGroupingHeader(cleanTitle) &&
        (cleanTitle === cleanTitle.toUpperCase() || /^(?:Noções de|Direito|Língua|Raciocínio|Legislação|História|Geografia|Administração|Contabilidade|Informática)/i.test(cleanTitle))
      ) {
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
    return stitchBrokenTopics(rawSegments.map(s => s.trim()).filter(Boolean));
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

    // Se não é cabeçalho de disciplina e ainda não abriu disciplina, tenta extrair título ou aguarda próximo cabeçalho
    if (!currentItem) {
      if (!isGenericGroupingHeader(line)) {
        const parts = line.split(/[:\.\-]\s+/);
        const candidateTitle = cleanDisciplineName(parts[0]);
        if (candidateTitle && candidateTitle.length >= 3 && !isGenericGroupingHeader(candidateTitle) && parts.length > 1) {
          currentItem = {
            nomeDisciplina: candidateTitle,
            topicos: []
          };
          rawDisciplineItems.push(currentItem);
          const remainder = parts.slice(1).join('. ');
          const topics = splitTopicsFromText(remainder);
          for (const t of topics) {
            currentItem.topicos.push(t);
          }
          continue;
        }
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
