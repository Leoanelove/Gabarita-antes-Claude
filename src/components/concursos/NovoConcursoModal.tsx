import React, { useState } from 'react';
import { 
  Sparkles, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  ArrowRight, 
  ArrowLeft,
  Calendar,
  Briefcase,
  Building2,
  DollarSign,
  Users,
  BookOpen,
  Layers,
  HelpCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  Pencil,
  Check
} from 'lucide-react';
import { 
  Concurso, 
  ConcursoSphere, 
  ConcursoStatus, 
  EditalAiImportPayload,
  AssuntoImportance,
  TopicDifficulty 
} from '../../types';
import { Modal } from '../../design-system/Modal';
import { Button } from '../../design-system/Button';
import { Badge } from '../../design-system/Badge';
import { sanitizeSyllabusData, parseSyllabusLocally, ParsedSyllabusItem, generateSigla, sanitizeTopicString, preSanitizeEditalText } from '../../services/editalParser';

export interface ExtractedDiscipline {
  name: string;
  weight: number;
  color: string;
  code?: string;
  sigla?: string;
  topicos: Array<{
    name: string;
    importance?: AssuntoImportance;
    difficulty?: TopicDifficulty;
    subtopicos?: string[];
    notes?: string;
  }>;
}

interface NovoConcursoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveConcursoWithDisciplinas: (
    concurso: Omit<Concurso, 'id' | 'createdAt' | 'updatedAt'>,
    disciplinas: ExtractedDiscipline[]
  ) => Promise<void>;
}

export const NovoConcursoModal: React.FC<NovoConcursoModalProps> = ({
  isOpen,
  onClose,
  onSaveConcursoWithDisciplinas,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // --- Passo 1: Dados do Concurso ---
  const [organ, setOrgan] = useState('');
  const [role, setRole] = useState('');
  const [title, setTitle] = useState('');
  const [banca, setBanca] = useState('Vunesp');
  const [sphere, setSphere] = useState<ConcursoSphere>('federal');
  const [remuneration, setRemuneration] = useState('');
  const [vacantPositions, setVacantPositions] = useState('1');
  const [status, setStatus] = useState<ConcursoStatus>('autorizado');
  const [examDate, setExamDate] = useState('');
  const [editalUrl, setEditalUrl] = useState('');
  const [notes, setNotes] = useState('');

  // --- Passo 2: Conteúdo Programático ---
  const [contentMode, setContentMode] = useState<'ai' | 'manual' | 'preset'>('ai');
  const [pastedText, setPastedText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isParsingAi, setIsParsingAi] = useState(false);
  const [extractionSource, setExtractionSource] = useState<string>('gemini-ai');

  // Disciplinas manipuláveis
  const [disciplinas, setDisciplinas] = useState<ExtractedDiscipline[]>([]);
  const [expandedDisciplines, setExpandedDisciplines] = useState<Record<number, boolean>>({});

  // Edição inline na Revisão (Etapa 3)
  const [editingDisciplineIndex, setEditingDisciplineIndex] = useState<number | null>(null);
  const [editingDisciplineName, setEditingDisciplineName] = useState<string>('');
  const [editingTopicKey, setEditingTopicKey] = useState<string | null>(null);
  const [editingTopicName, setEditingTopicName] = useState<string>('');

  // Input rápido manual
  const [manualDiscName, setManualDiscName] = useState('');
  const [manualDiscWeight, setManualDiscWeight] = useState('2.0');
  const [manualDiscColor, setManualDiscColor] = useState('#10b981');
  const [manualTopicsText, setManualTopicsText] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-gerar título e sincronizar com Órgão e Cargo
  const handleOrganOrRoleChange = (newOrgan: string, newRole: string) => {
    setOrgan(newOrgan);
    setRole(newRole);
    const parts = [newOrgan.trim(), newRole.trim()].filter(Boolean);
    setTitle(parts.join(' - '));
  };

  const handleLoadSampleText = () => {
    setPastedText(`CONHECIMENTOS BÁSICOS E ESPECÍFICOS PARA O CARGO:
1. LÍNGUA PORTUGUESA: Compreensão e interpretação de textos. Ortografia oficial. Acentuação gráfica. Emprego das classes de palavras. Sintaxe da oração e do período. Pontuação. Concordância nominal e verbal. Regência nominal e verbal. Crase.
2. DIREITO CONSTITUCIONAL: Princípios fundamentais da CF/88. Direitos e garantias fundamentais. Direitos sociais e nacionalidade. Organização do Estado e dos Poderes. Funções essenciais à justiça.
3. DIREITO ADMINISTRATIVO: Regime jurídico administrativo. Princípios da administração pública. Poderes administrativos. Atos administrativos: conceitos, requisitos, atributos. Nova Lei de Licitações (Lei nº 14.133/2021). Agentes públicos e responsabilidade civil do Estado.
4. RACIOCÍNIO LÓGICO-MATEMÁTICO: Estruturas lógicas. Lógica de argumentação. Diagramas lógicos. Probabilidade e estatística básica.`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      if (file.name.endsWith('.json')) {
        try {
          const jsonParsed = JSON.parse(content);
          const rawItems = Array.isArray(jsonParsed)
            ? jsonParsed
            : (jsonParsed.syllabus || jsonParsed.disciplinas || jsonParsed.edital || []);
          const sanitized = sanitizeSyllabusData(rawItems);
          if (sanitized.length > 0) {
            const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6'];
            const converted = sanitized.map((item, idx) => {
              const sigla = item.sigla || generateSigla(item.nome);
              return {
                name: item.nome,
                sigla,
                code: sigla,
                weight: 2.0,
                color: colors[idx % colors.length],
                topicos: item.topicos.map(t => ({ name: t }))
              };
            });
            setDisciplinas(converted);
            setExtractionSource('Arquivo JSON Sanitizado');
            setStep(3);
            return;
          }
        } catch {
          // ignora e trata como texto
        }
      }
      setPastedText(content);
    };
    reader.readAsText(file);
  };

  const handleParseWithGemini = async () => {
    if (!pastedText.trim()) {
      setErrorMessage('Cole o texto do edital ou carregue um arquivo para extração com IA.');
      return;
    }
    // Sanitização de texto antes do envio à IA (remoção de carimbos de processos, assinaturas e paginações)
    const cleanedText = preSanitizeEditalText(pastedText);
    if (!cleanedText.trim()) {
      setErrorMessage('O texto colado continha apenas dados administrativos/ruídos. Insira o conteúdo das disciplinas.');
      return;
    }

    setIsParsingAi(true);
    setErrorMessage(null);
    try {
      try {
        const response = await fetch('/api/edital/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawText: cleanedText,
            cargo: role || 'Cargo Selecionado',
            concursoTitle: title || organ || 'Concurso Público',
          }),
        });
        if (response.ok) {
          const result = await response.json();
          const rawItems = result.syllabus || result.data?.syllabus || result.disciplinas || result.data?.disciplinas || [];
          const sanitized = sanitizeSyllabusData(rawItems);
          if (sanitized.length > 0) {
            const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6'];
            const converted = sanitized.map((item, idx) => {
              const sigla = item.sigla || generateSigla(item.nome);
              return {
                name: item.nome,
                sigla,
                code: sigla,
                weight: 2.0,
                color: colors[idx % colors.length],
                topicos: item.topicos.map(t => ({ name: t }))
              };
            });
            setDisciplinas(converted);
            setExtractionSource(result.source === 'gemini-ai' ? 'Gemini IA' : 'Parser Estruturado Inteligente');
            setIsParsingAi(false);
            setStep(3);
            return;
          }
        }
      } catch (fetchErr) {
        console.warn('Falha na requisição Gemini, utilizando fallback de parser estruturado:', fetchErr);
      }

      // Fallback local estruturado
      const parsedLocal = parseTextLocally(cleanedText);
      if (parsedLocal.length > 0) {
        setDisciplinas(parsedLocal);
        setExtractionSource('Parser Local Inteligente (Contingência)');
        setStep(3);
      } else {
        throw new Error('Não foi possível identificar disciplinas válidas no texto informado.');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Falha na extração de matérias com IA.');
    } finally {
      setIsParsingAi(false);
    }
  };

  const handleAddManualDiscipline = () => {
    if (!manualDiscName.trim()) {
      setErrorMessage('Informe o nome da matéria.');
      return;
    }
    const topicsList = manualTopicsText
      .split('\n')
      .map(t => t.trim())
      .filter(Boolean)
      .map(rawTopic => {
        const cleanTopic = sanitizeTopicString(rawTopic) || rawTopic.replace(/^(?:[\•\-\*\>\–\—\/\#\№\º\ª\■\□\▪\▫\+]\s*|\d+(?:\.\d+)*[\.\)\-\s\/\:]+)+/, '').trim();
        return {
          name: cleanTopic || rawTopic,
          importance: 'alta' as AssuntoImportance,
          difficulty: 'media' as TopicDifficulty,
        };
      })
      .filter(t => t.name.length > 0);

    const sigla = generateSigla(manualDiscName.trim());
    const newDisc: ExtractedDiscipline = {
      name: manualDiscName.trim(),
      sigla,
      code: sigla,
      weight: parseFloat(manualDiscWeight) || 2.0,
      color: manualDiscColor || '#10b981',
      topicos: topicsList.length > 0 ? topicsList : [{ name: 'Introdução e Teoria Geral' }],
    };

    setDisciplinas(prev => [...prev, newDisc]);
    setManualDiscName('');
    setManualTopicsText('');
    setErrorMessage(null);
  };

  const handleLoadPreset = (presetName: string) => {
    const presets: Record<string, ExtractedDiscipline[]> = {
      tribunais: [
        { name: 'Língua Portuguesa', weight: 2.0, color: '#0ea5e9', topicos: [{ name: 'Interpretação de Texto' }, { name: 'Sintaxe e Pontuação' }, { name: 'Crase e Regência' }] },
        { name: 'Direito Constitucional', weight: 2.5, color: '#10b981', topicos: [{ name: 'Direitos Fundamentais' }, { name: 'Poder Judiciário' }, { name: 'Funções Essenciais à Justiça' }] },
        { name: 'Direito Administrativo', weight: 2.5, color: '#8b5cf6', topicos: [{ name: 'Princípios e Poderes' }, { name: 'Atos Administrativos' }, { name: 'Licitações Lei 14.133' }] },
        { name: 'Direito Processual Civil', weight: 3.0, color: '#f59e0b', topicos: [{ name: 'Atos Processuais e Prazos' }, { name: 'Petição Inicial e Citação' }, { name: 'Procedimento Comum' }] },
        { name: 'Normas da Corregedoria', weight: 2.5, color: '#ec4899', topicos: [{ name: 'Escrituração e Termos Judiciais' }, { name: 'Processo Eletrônico' }] },
      ],
      policial: [
        { name: 'Língua Portuguesa', weight: 2.0, color: '#0ea5e9', topicos: [{ name: 'Compreensão de Texto' }, { name: 'Ortografia e Morfossintaxe' }] },
        { name: 'Direito Penal', weight: 3.0, color: '#ef4444', topicos: [{ name: 'Princípios do Direito Penal' }, { name: 'Crimes Contra a Pessoa' }, { name: 'Crimes Contra o Patrimônio' }] },
        { name: 'Direito Processual Penal', weight: 2.5, color: '#f59e0b', topicos: [{ name: 'Inquérito Policial' }, { name: 'Prisão e Liberdade Provisória' }] },
        { name: 'Legislação Especial', weight: 2.5, color: '#8b5cf6', topicos: [{ name: 'Lei de Drogas' }, { name: 'Estatuto do Desarmamento' }, { name: 'Lei de Abuso de Autoridade' }] },
        { name: 'Informática e TI', weight: 3.0, color: '#06b6d4', topicos: [{ name: 'Segurança da Informação' }, { name: 'Redes e Internet' }, { name: 'Banco de Dados' }] },
        { name: 'Contabilidade Geral', weight: 2.5, color: '#10b981', topicos: [{ name: 'Balanço Patrimonial' }, { name: 'DRE e Demonstrações' }] },
      ],
      fiscal: [
        { name: 'Língua Portuguesa', weight: 2.0, color: '#0ea5e9', topicos: [{ name: 'Interpretação e Gramática' }] },
        { name: 'Direito Tributário', weight: 3.0, color: '#10b981', topicos: [{ name: 'Sistema Tributário Nacional' }, { name: 'Competência Tributária' }, { name: 'Crédito Tributário' }] },
        { name: 'Legislação Tributária', weight: 3.0, color: '#059669', topicos: [{ name: 'Impostos Federais e Estaduais' }, { name: 'Processo Administrativo Fiscal' }] },
        { name: 'Auditoria Fiscal', weight: 2.5, color: '#f59e0b', topicos: [{ name: 'Normas de Auditoria' }, { name: 'Testes e Procedimentos' }] },
        { name: 'Contabilidade Geral e Avançada', weight: 3.0, color: '#8b5cf6', topicos: [{ name: 'Pronunciamentos CPC' }, { name: 'Consolidação de Demonstrações' }] },
        { name: 'Direito Administrativo e Constitucional', weight: 2.0, color: '#06b6d4', topicos: [{ name: 'Regime Jurídico' }, { name: 'Orçamento Público' }] },
      ],
      administrativo: [
        { name: 'Língua Portuguesa', weight: 2.0, color: '#0ea5e9', topicos: [{ name: 'Interpretação de Texto' }, { name: 'Redação Oficial' }] },
        { name: 'Raciocínio Lógico', weight: 2.0, color: '#f59e0b', topicos: [{ name: 'Lógica Proposicional' }, { name: 'Conjuntos e Porcentagem' }] },
        { name: 'Noções de Informática', weight: 1.5, color: '#06b6d4', topicos: [{ name: 'Windows e Linux' }, { name: 'Pacote Office e Navegadores' }] },
        { name: 'Direito Constitucional', weight: 2.0, color: '#10b981', topicos: [{ name: 'Direitos e Deveres' }, { name: 'Administração Pública na CF' }] },
        { name: 'Direito Administrativo', weight: 2.5, color: '#8b5cf6', topicos: [{ name: 'Atos e Poderes' }, { name: 'Licitações e Contratos' }] },
        { name: 'Administração Geral e Pública', weight: 3.0, color: '#ec4899', topicos: [{ name: 'Planejamento e Gestão' }, { name: 'Gestão de Pessoas e Processos' }] },
      ],
    };

    if (presets[presetName]) {
      setDisciplinas(presets[presetName]);
      setExtractionSource(`Grade Pré-definida: ${presetName.toUpperCase()}`);
      setStep(3);
    }
  };

  const handleRemoveDiscipline = (index: number) => {
    setDisciplinas(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateWeight = (index: number, newWeight: number) => {
    setDisciplinas(prev => prev.map((d, idx) => idx === index ? { ...d, weight: newWeight } : d));
  };

  const toggleDisciplineExpand = (index: number) => {
    setExpandedDisciplines(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleRemoveTopic = (discIndex: number, topicIndex: number) => {
    setDisciplinas(prev => prev.map((d, idx) => {
      if (idx !== discIndex) return d;
      return {
        ...d,
        topicos: d.topicos.filter((_, tIdx) => tIdx !== topicIndex)
      };
    }));
  };

  const handleAddTopic = (discIndex: number, newTopicName: string) => {
    const trimmed = newTopicName.trim();
    if (!trimmed) return;
    setDisciplinas(prev => prev.map((d, idx) => {
      if (idx !== discIndex) return d;
      return {
        ...d,
        topicos: [...d.topicos, { name: trimmed }]
      };
    }));
  };

  // Edição inline de Matéria
  const handleStartEditDiscipline = (index: number, currentName: string) => {
    setEditingDisciplineIndex(index);
    setEditingDisciplineName(currentName);
  };

  const handleSaveDisciplineName = (index: number) => {
    const trimmed = editingDisciplineName.trim();
    if (trimmed) {
      setDisciplinas(prev => prev.map((d, idx) => idx === index ? { ...d, name: trimmed } : d));
    }
    setEditingDisciplineIndex(null);
  };

  const handleCancelEditDiscipline = () => {
    setEditingDisciplineIndex(null);
  };

  // Edição inline de Tópico
  const handleStartEditTopic = (discIndex: number, topicIndex: number, currentName: string) => {
    setEditingTopicKey(`${discIndex}-${topicIndex}`);
    setEditingTopicName(currentName);
  };

  const handleSaveTopicName = (discIndex: number, topicIndex: number) => {
    const trimmed = editingTopicName.trim();
    if (trimmed) {
      setDisciplinas(prev => prev.map((d, idx) => {
        if (idx !== discIndex) return d;
        return {
          ...d,
          topicos: d.topicos.map((t, tIdx) => tIdx === topicIndex ? { ...t, name: trimmed } : t)
        };
      }));
    }
    setEditingTopicKey(null);
  };

  const handleCancelEditTopic = () => {
    setEditingTopicKey(null);
  };

  const handleFinalSubmit = async () => {
    if (!organ.trim() || !role.trim()) {
      setErrorMessage('Preencha ao menos o Órgão e o Cargo do concurso.');
      setStep(1);
      return;
    }

    if (disciplinas.length === 0) {
      setErrorMessage('Adicione ou extraia ao menos uma disciplina antes de salvar.');
      setStep(2);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const cleanOrgan = organ.trim();
      const cleanRole = role.trim();
      const finalTitle = title.trim() || (cleanRole ? `${cleanOrgan} - ${cleanRole}` : cleanOrgan);
      await onSaveConcursoWithDisciplinas(
        {
          title: finalTitle,
          titulo: finalTitle,
          organ: cleanOrgan,
          orgao: cleanOrgan,
          nome: cleanOrgan,
          role: cleanRole,
          banca: banca.trim() || 'A Definir',
          sphere,
          remuneration: parseFloat(remuneration) || 0,
          vacantPositions: parseInt(vacantPositions, 10) || 1,
          status,
          examDate: examDate || undefined,
          editalUrl: editalUrl.trim() || undefined,
          notes: notes.trim(),
          active: true,
        },
        disciplinas
      );
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Falha ao salvar concurso e disciplinas.');
    } finally {
      setIsSaving(false);
    }
  };

  const daysRemaining = examDate ? Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        step === 1 ? "Cadastro do Concurso Foco" :
        step === 2 ? "Extração de Matérias & Edital" :
        "Revisão e Ativação do Concurso"
      }
      description={
        step === 1 ? "Defina os dados fundamentais do seu certame (órgão, cargo, banca e data)." :
        step === 2 ? "Extraia a grade de disciplinas e tópicos com IA ou monte sua matriz de estudo." :
        "Confira as disciplinas que serão sincronizadas em todo o seu Gabarita."
      }
      maxWidth={step === 3 ? "xl" : "lg"}
    >
      <div className="space-y-6">
        {/* Progress Stepper Bar */}
        <div className="flex items-center justify-between gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              step === 1 
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-[10px]">1</span>
            <span>Dados Básicos</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!organ.trim() || !role.trim()) {
                setErrorMessage('Preencha os campos obrigatórios do Passo 1.');
                return;
              }
              setErrorMessage(null);
              setStep(2);
            }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              step === 2 
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-[10px]">2</span>
            <span>Grade & IA</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (disciplinas.length > 0) setStep(3);
            }}
            disabled={disciplinas.length === 0}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              disciplinas.length === 0 ? 'opacity-50 cursor-not-allowed text-slate-400' :
              step === 3 
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs' 
                : 'text-slate-500 cursor-pointer hover:text-slate-700'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-[10px]">3</span>
            <span>Revisão ({disciplinas.length})</span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* --- PASSO 1: DADOS DO CONCURSO --- */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Órgão / Instituição <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: TJ-SP, TCU, Polícia Federal"
                  value={organ}
                  onChange={(e) => handleOrganOrRoleChange(e.target.value, role)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Cargo Pretendido <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Escrevente Técnico Judiciário, Auditor"
                  value={role}
                  onChange={(e) => handleOrganOrRoleChange(organ, e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Banca Examinadora</label>
                <input
                  type="text"
                  placeholder="Ex: Vunesp, Cebraspe, FGV"
                  value={banca}
                  onChange={(e) => setBanca(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Esfera</label>
                <select
                  value={sphere}
                  onChange={(e) => setSphere(e.target.value as ConcursoSphere)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
                >
                  <option value="federal">Federal</option>
                  <option value="estadual">Estadual</option>
                  <option value="municipal">Municipal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Situação / Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ConcursoStatus)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
                >
                  <option value="previsto">Previsto</option>
                  <option value="autorizado">Autorizado</option>
                  <option value="comissao_formada">Comissão Formada</option>
                  <option value="escolha_banca">Escolha da Banca</option>
                  <option value="edital_publicado">Edital Publicado</option>
                  <option value="inscricoes_abertas">Inscrições Abertas</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Data da Prova {daysRemaining !== null && <span className="text-emerald-500">({daysRemaining}d)</span>}
                </label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Remuneração (R$)</label>
                <input
                  type="number"
                  placeholder="Ex: 8500"
                  value={remuneration}
                  onChange={(e) => setRemuneration(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Vagas</label>
                <input
                  type="number"
                  placeholder="Ex: 50"
                  value={vacantPositions}
                  onChange={(e) => setVacantPositions(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Observações ou Estratégia de Estudo</label>
              <textarea
                rows={2}
                placeholder="Ex: Foco pesado em Direito Processual Civil e Redação..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  if (!organ.trim() || !role.trim()) {
                    setErrorMessage('Informe o Órgão e o Cargo para continuar.');
                    return;
                  }
                  setErrorMessage(null);
                  setStep(2);
                }}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Próximo: Adicionar Disciplinas
              </Button>
            </div>
          </div>
        )}

        {/* --- PASSO 2: EXTRAÇÃO DE MATÉRIAS & EDITAL --- */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setContentMode('ai')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  contentMode === 'ai' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-slate-500'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Importar Edital com IA</span>
              </button>

              <button
                type="button"
                onClick={() => setContentMode('manual')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  contentMode === 'manual' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-slate-500'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Cadastro Manual</span>
              </button>

              <button
                type="button"
                onClick={() => setContentMode('preset')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  contentMode === 'preset' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-slate-500'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Grades Prontas</span>
              </button>
            </div>

            {/* Sub-aba 1: IA Gemini */}
            {contentMode === 'ai' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Cole o Conteúdo Programático do Edital
                  </label>
                  <button
                    type="button"
                    onClick={handleLoadSampleText}
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                  >
                    Carregar Exemplo Real
                  </button>
                </div>

                <textarea
                  rows={7}
                  placeholder="Cole aqui a lista de matérias e tópicos do edital..."
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  className="w-full text-xs p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />

                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <UploadCloud className="w-4 h-4 text-emerald-500" />
                    <span className="text-slate-600 dark:text-slate-300">Ou envie arquivo TXT/JSON do edital:</span>
                  </div>
                  <label className="cursor-pointer text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
                    <span>{uploadedFileName || 'Selecionar Arquivo'}</span>
                    <input type="file" accept=".txt,.json,.md" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleParseWithGemini}
                    isLoading={isParsingAi}
                    leftIcon={<Sparkles className="w-4 h-4" />}
                    className="w-full shadow-md shadow-emerald-500/20"
                  >
                    Extrair Disciplinas e Tópicos com IA
                  </Button>
                </div>
              </div>
            )}

            {/* Sub-aba 2: Manual */}
            {contentMode === 'manual' && (
              <div className="space-y-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nome da Matéria</label>
                    <input
                      type="text"
                      placeholder="Ex: Direito Constitucional"
                      value={manualDiscName}
                      onChange={(e) => setManualDiscName(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Peso (1.0 a 3.0)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="1.0"
                      max="3.0"
                      value={manualDiscWeight}
                      onChange={(e) => setManualDiscWeight(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tópicos (um por linha)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Controle de Constitucionalidade&#10;Direitos Fundamentais&#10;Poder Judiciário"
                    value={manualTopicsText}
                    onChange={(e) => setManualTopicsText(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs text-slate-500">{disciplinas.length} matéria(s) adicionada(s)</span>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleAddManualDiscipline}
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Adicionar Matéria à Grade
                  </Button>
                </div>
              </div>
            )}

            {/* Sub-aba 3: Presets */}
            {contentMode === 'preset' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleLoadPreset('tribunais')}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-left hover:border-emerald-500 transition-all cursor-pointer space-y-1"
                >
                  <div className="font-bold text-xs text-slate-900 dark:text-slate-100">⚖️ Carreiras de Tribunais (TJ, TRF, TRT)</div>
                  <p className="text-[11px] text-slate-500">Português, Dir. Const, Dir. Adm, Proc. Civil, Normas (5 matérias)</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleLoadPreset('policial')}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-left hover:border-emerald-500 transition-all cursor-pointer space-y-1"
                >
                  <div className="font-bold text-xs text-slate-900 dark:text-slate-100">🚔 Carreiras Policiais (PF, PRF, PC)</div>
                  <p className="text-[11px] text-slate-500">Português, Penal, Proc. Penal, Legislação, Informática (6 matérias)</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleLoadPreset('fiscal')}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-left hover:border-emerald-500 transition-all cursor-pointer space-y-1"
                >
                  <div className="font-bold text-xs text-slate-900 dark:text-slate-100">🏛️ Carreiras Fiscais e Controle (RFB, SEFAZ, TCU)</div>
                  <p className="text-[11px] text-slate-500">Tributário, Auditoria, Contabilidade, Legislação (6 matérias)</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleLoadPreset('administrativo')}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-left hover:border-emerald-500 transition-all cursor-pointer space-y-1"
                >
                  <div className="font-bold text-xs text-slate-900 dark:text-slate-100">📋 Carreiras Administrativas (Geral)</div>
                  <p className="text-[11px] text-slate-500">Português, RLM, Informática, Adm. Pública (6 matérias)</p>
                </button>
              </div>
            )}

            {/* Se houver disciplinas já extraídas ou adicionadas */}
            {disciplinas.length > 0 && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {disciplinas.length} disciplinas prontas para revisão!
                </span>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setStep(3)}
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  Avançar para Revisão
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setStep(1)} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Voltar aos Dados
              </Button>
              {disciplinas.length > 0 && (
                <Button type="button" variant="primary" onClick={() => setStep(3)} rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Revisar Grade ({disciplinas.length})
                </Button>
              )}
            </div>
          </div>
        )}

        {/* --- PASSO 3: REVISÃO E ATIVAÇÃO --- */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-900/30 via-slate-900 to-slate-950 border border-emerald-500/30 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-400 block">Concurso Configurado</span>
                <h4 className="text-sm font-black text-white">{organ} - {role}</h4>
                <p className="text-slate-400 text-[11px]">Banca: {banca} • {disciplinas.length} Matérias Extraídas</p>
              </div>
              <div className="shrink-0 text-right">
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-[11px]">
                  ★ Ativação Automática
                </span>
              </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {disciplinas.map((disc, idx) => {
                const cleanName = (disc.name || '').trim();
                if (!cleanName || !/[a-zA-ZáéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/.test(cleanName)) return null;
                const validTopics = (disc.topicos || []).filter(t => {
                  const tName = (t.name || '').trim();
                  return tName.length > 0 && /[a-zA-ZáéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/.test(tName);
                });
                if (!disc.topicos || disc.topicos.length === 0 || validTopics.length === 0) return null;
                const isExpanded = !!expandedDisciplines[idx];

                return (
                  <div 
                    key={idx} 
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all"
                  >
                    <div className="p-3 flex items-center justify-between gap-3">
                      {editingDisciplineIndex === idx ? (
                        <div className="flex items-center gap-2 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                          <div 
                            className="w-3.5 h-3.5 rounded-full shrink-0" 
                            style={{ backgroundColor: disc.color || '#10b981' }} 
                          />
                          <input
                            type="text"
                            autoFocus
                            value={editingDisciplineName}
                            onChange={(e) => setEditingDisciplineName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveDisciplineName(idx);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                handleCancelEditDiscipline();
                              }
                            }}
                            className="flex-1 text-xs font-bold p-1 px-2 rounded-md border border-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                            placeholder="Nome da disciplina..."
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveDisciplineName(idx)}
                            className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors cursor-pointer"
                            title="Salvar nome"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditDiscipline}
                            className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div 
                          className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                          onClick={() => toggleDisciplineExpand(idx)}
                        >
                          <div 
                            className="w-3.5 h-3.5 rounded-full shrink-0" 
                            style={{ backgroundColor: disc.color || '#10b981' }} 
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 group">
                              <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate hover:text-emerald-500 transition-colors">
                                {disc.name}
                              </h5>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEditDiscipline(idx, disc.name);
                                }}
                                className="p-0.5 text-slate-400 hover:text-emerald-500 rounded transition-colors cursor-pointer opacity-70 hover:opacity-100"
                                title="Editar nome da matéria"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {disc.topicos.length} tópico(s) cadastrado(s)
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                          <span>Peso:</span>
                          <select
                            value={disc.weight}
                            onChange={(e) => handleUpdateWeight(idx, parseFloat(e.target.value))}
                            className="text-xs p-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                          >
                            <option value="1">1.0 (Baixo)</option>
                            <option value="1.5">1.5</option>
                            <option value="2">2.0 (Médio)</option>
                            <option value="2.5">2.5</option>
                            <option value="3">3.0 (Alto)</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleDisciplineExpand(idx)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
                          title={isExpanded ? "Recolher tópicos" : "Ver tópicos da matéria"}
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveDiscipline(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                          title="Remover matéria"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Lista expansível de tópicos para conferência e ajustes finos */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/60 space-y-2">
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {disc.topicos.map((topico, tIdx) => {
                            const isEditingThisTopic = editingTopicKey === `${idx}-${tIdx}`;

                            if (isEditingThisTopic) {
                              return (
                                <div 
                                  key={tIdx} 
                                  className="flex items-center gap-1.5 p-1 px-2 bg-white dark:bg-slate-800 rounded-lg border border-emerald-500 text-xs shadow-xs"
                                >
                                  <span className="text-emerald-500 text-[11px] font-bold shrink-0">•</span>
                                  <input
                                    type="text"
                                    autoFocus
                                    value={editingTopicName}
                                    onChange={(e) => setEditingTopicName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSaveTopicName(idx, tIdx);
                                      } else if (e.key === 'Escape') {
                                        e.preventDefault();
                                        handleCancelEditTopic();
                                      }
                                    }}
                                    className="flex-1 text-[11px] bg-transparent text-slate-900 dark:text-slate-100 focus:outline-hidden py-0.5"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveTopicName(idx, tIdx)}
                                    className="text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 p-1 rounded transition-colors cursor-pointer shrink-0"
                                    title="Salvar tópico"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelEditTopic}
                                    className="text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 p-1 rounded transition-colors cursor-pointer shrink-0"
                                    title="Cancelar"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <div 
                                key={tIdx} 
                                className="flex items-center justify-between gap-2 p-1.5 px-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-200 group"
                              >
                                <span className="truncate flex-1 text-[11px]">• {topico.name}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditTopic(idx, tIdx, topico.name)}
                                    className="text-slate-400 hover:text-emerald-500 p-0.5 rounded-sm transition-colors cursor-pointer opacity-70 hover:opacity-100"
                                    title="Editar tópico"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTopic(idx, tIdx)}
                                    className="text-slate-400 hover:text-rose-500 p-0.5 rounded-sm transition-colors cursor-pointer"
                                    title="Excluir tópico"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Adicionar Tópico Rápido */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="text"
                            placeholder="Adicionar novo tópico a esta matéria..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddTopic(idx, e.currentTarget.value);
                                e.currentTarget.value = '';
                              }
                            }}
                            className="flex-1 text-[11px] p-1.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                              if (input && input.value) {
                                handleAddTopic(idx, input.value);
                                input.value = '';
                              }
                            }}
                            className="p-1.5 px-2.5 text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Adicionar</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setStep(2)} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Adicionar Mais Matérias
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleFinalSubmit}
                isLoading={isSaving}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                className="shadow-lg shadow-emerald-500/20"
              >
                Salvar Concurso e Iniciar Gabarita
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

// Parser local de contingência baseado no módulo editalParser
function parseTextLocally(rawText: string): ExtractedDiscipline[] {
  const parsedItems = parseSyllabusLocally(rawText);
  const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444'];
  return parsedItems.map((item, idx) => {
    const sigla = item.sigla || generateSigla(item.nome);
    return {
      name: item.nome,
      sigla,
      code: sigla,
      weight: 2.0,
      color: colors[idx % colors.length],
      topicos: item.topicos.map(t => ({ name: t }))
    };
  });
}
