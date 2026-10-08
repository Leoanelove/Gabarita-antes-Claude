import React, { useState } from 'react';
import { 
  Sparkles, 
  UploadCloud, 
  FileText, 
  Edit3, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Plus, 
  Trash2, 
  ArrowRight, 
  ArrowLeft,
  FileCode
} from 'lucide-react';
import { Concurso, EditalAiImportPayload, AssuntoImportance, TopicDifficulty } from '../../types';
import { Modal } from '../../design-system/Modal';
import { Button } from '../../design-system/Button';
import { Badge } from '../../design-system/Badge';
import { sanitizeSyllabusData, parseSyllabusLocally, ParsedSyllabusItem } from '../../services/editalParser';

interface EditalImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  concursos: Concurso[];
  selectedConcursoId?: string;
  hasExistingDisciplinas: boolean;
  onConfirmImport: (payload: EditalAiImportPayload, concursoId?: string, mode?: 'merge' | 'replace') => Promise<void>;
}

type ImportMethod = 'paste_text' | 'file_upload' | 'manual_tree';

export const EditalImportModal: React.FC<EditalImportModalProps> = ({
  isOpen,
  onClose,
  concursos,
  selectedConcursoId,
  hasExistingDisciplinas,
  onConfirmImport,
}) => {
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [method, setMethod] = useState<ImportMethod>('paste_text');
  const [targetConcursoId, setTargetConcursoId] = useState(selectedConcursoId || concursos[0]?.id || '');
  const [cargoName, setCargoName] = useState(
    concursos.find(c => c.id === (selectedConcursoId || concursos[0]?.id))?.role || 'Auditor-Fiscal'
  );
  const [pastedText, setPastedText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [manualDisciplinas, setManualDisciplinas] = useState<EditalAiImportPayload['disciplinas']>([]);

  const [parsedPayload, setParsedPayload] = useState<EditalAiImportPayload | null>(null);
  const [extractionSource, setExtractionSource] = useState<string>('gemini-ai');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [confirmReplaceChecked, setConfirmReplaceChecked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const formatPayloadFromSyllabus = (
    syllabus: ParsedSyllabusItem[],
    title: string,
    role: string
  ): EditalAiImportPayload => {
    const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6'];
    return {
      concursoTitle: title,
      cargo: role,
      disciplinas: syllabus.map((item, idx) => ({
        name: item.nome || item.nomeDisciplina,
        code: item.sigla || (item.nome || item.nomeDisciplina).slice(0, 4).toUpperCase(),
        weight: 2.0,
        color: colors[idx % colors.length],
        topicos: item.topicos.map(t => ({
          name: t,
          importance: 'alta' as const,
          difficulty: 'media' as const,
          subtopicos: []
        }))
      }))
    };
  };

  const handleLoadSampleText = () => {
    setPastedText(`CONHECIMENTOS ESPECÍFICOS - CARGO AUDITOR FEDERAL DE CONTROLE EXTERNO:
DIREITO ADMINISTRATIVO: 1. Estado, governo e administração pública: conceitos, elementos, poderes e organização. 1.1 Princípios da administração pública. 2. Atos administrativos: conceitos, requisitos, atributos, classificação. 2.1 Anulação, revogação e convalidação. 3. Nova Lei de Licitações (Lei nº 14.133/2021): princípios, modalidades de licitação, contratação direta.`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setErrorMsg(null);
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
            setParsedPayload(
              formatPayloadFromSyllabus(
                sanitized,
                jsonParsed.concursoTitle || 'Concurso Importado',
                jsonParsed.cargo || cargoName
              )
            );
            setExtractionSource('Arquivo JSON Sanitizado');
            setStep('review');
            return;
          }
        } catch {
          // ignore e segue como texto
        }
      }
      setPastedText(content);
    };
    reader.readAsText(file);
  };

  const handleParseWithGemini = async () => {
    if (method === 'manual_tree') {
      const selectedConc = concursos.find(c => c.id === targetConcursoId);
      setParsedPayload({
        concursoTitle: selectedConc?.title || 'Concurso Selecionado',
        cargo: cargoName || selectedConc?.role || 'Cargo Pretendido',
        disciplinas: manualDisciplinas,
      });
      setExtractionSource('estrutura-manual');
      setStep('review');
      return;
    }

    if (!pastedText.trim()) {
      setErrorMsg('Por favor, cole o texto do edital ou carregue um arquivo.');
      return;
    }

    setIsParsing(true);
    setErrorMsg(null);
    try {
      const selectedConc = concursos.find(c => c.id === targetConcursoId);
      const titleTarget = selectedConc?.title || 'Concurso Selecionado';
      const roleTarget = cargoName || selectedConc?.role || 'Cargo Pretendido';

      try {
        const response = await fetch('/api/edital/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawText: pastedText,
            cargo: roleTarget,
            concursoTitle: titleTarget,
          }),
        });
        if (response.ok) {
          const result = await response.json();
          const rawItems = result.syllabus || result.data?.syllabus || result.data?.disciplinas || result.data?.edital || [];
          const sanitized = sanitizeSyllabusData(rawItems);
          if (sanitized.length > 0) {
            setParsedPayload(formatPayloadFromSyllabus(sanitized, titleTarget, roleTarget));
            setExtractionSource(result.source === 'gemini-ai' ? 'Gemini 3.8 Flash (IA)' : 'Parser Estruturado Inteligente');
            setStep('review');
            return;
          }
        }
      } catch (fetchErr) {
        console.warn('Falha na chamada ao endpoint /api/edital/parse, acionando fallback local:', fetchErr);
      }

      const localItems = parseSyllabusLocally(pastedText);
      if (localItems.length > 0) {
        setParsedPayload(formatPayloadFromSyllabus(localItems, titleTarget, roleTarget));
        setExtractionSource('Parser Estruturado Inteligente (Contingência)');
        setStep('review');
      } else {
        throw new Error('Não foi possível identificar disciplinas válidas no texto informado. Certifique-se de que o texto contém matérias e seus tópicos.');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha na identificação do edital.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFinalSave = async () => {
    if (!parsedPayload) return;
    if (importMode === 'replace' && hasExistingDisciplinas && !confirmReplaceChecked) {
      setErrorMsg('Para substituir o edital existente, você deve marcar a caixa de confirmação de segurança.');
      return;
    }
    setIsSaving(true);
    try {
      await onConfirmImport(parsedPayload, targetConcursoId, importMode);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao gravar edital no banco.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={step === 'input' ? "Importador Inteligente de Edital" : "Revisão e Confirmação da Árvore"}
      description={step === 'input' ? "Carregue o conteúdo programático por texto, arquivo ou estrutura manual." : "Examine as disciplinas antes de confirmar."}
      maxWidth={step === 'review' ? 'xl' : 'lg'}
    >
      <div className="space-y-5">
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {step === 'input' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Concurso de Destino</label>
                <select
                  value={targetConcursoId}
                  onChange={(e) => {
                    setTargetConcursoId(e.target.value);
                    const match = concursos.find(c => c.id === e.target.value);
                    if (match) setCargoName(match.role);
                  }}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-2"
                >
                  {concursos.map(c => (
                    <option key={c.id} value={c.id}>{c.title} ({c.banca})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Cargo Pretendido</label>
                <input
                  type="text"
                  value={cargoName}
                  onChange={(e) => setCargoName(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-2"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setMethod('paste_text')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  method === 'paste_text' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-emerald-500" />
                <span>Texto Colado</span>
              </button>
              <button
                type="button"
                onClick={() => setMethod('file_upload')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  method === 'file_upload' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5 text-sky-500" />
                <span>Arquivo</span>
              </button>
            </div>

            {method === 'paste_text' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Cole o Trecho do Edital</label>
                  <button type="button" onClick={handleLoadSampleText} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
                    Carregar Exemplo Real
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Cole aqui o conteúdo do edital..."
                  className="w-full text-xs p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>
            )}

            {method === 'file_upload' && (
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center">
                <UploadCloud className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <label className="inline-flex">
                  <span className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg cursor-pointer">Escolher Arquivo</span>
                  <input type="file" accept=".txt,.json,.md,.csv" onChange={handleFileUpload} className="hidden" />
                </label>
                {uploadedFileName && <p className="mt-2 text-xs text-emerald-600 font-semibold">{uploadedFileName}</p>}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="button" variant="primary" onClick={handleParseWithGemini} isLoading={isParsing} leftIcon={<Sparkles className="w-4 h-4" />}>
                Processar Edital
              </Button>
            </div>
          </div>
        )}

        {step === 'review' && parsedPayload && (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs flex items-center justify-between">
              <span>Estrutura Identificada via <strong className="text-emerald-600">{extractionSource}</strong></span>
              <span className="font-semibold">{parsedPayload.disciplinas.length} disciplinas</span>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
              {parsedPayload.disciplinas.map((disc, dIdx) => {
                const cleanName = (disc.name || '').trim();
                if (!cleanName || !/[a-zA-ZáéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/.test(cleanName)) return null;
                const validTopics = disc.topicos.filter(top => {
                  const tName = (top.name || '').trim();
                  return tName.length > 0 && /[a-zA-ZáéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/.test(tName);
                });
                if (disc.topicos.length === 0 || validTopics.length === 0) return null;

                return (
                  <div key={dIdx} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{disc.name}</h4>
                    <div className="pl-4 space-y-1">
                      {validTopics.map((top, tIdx) => (
                        <p key={tIdx} className="text-xs text-slate-600 dark:text-slate-300">• {top.name}</p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {hasExistingDisciplinas && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 rounded-xl text-xs space-y-2">
                <label className="flex items-center gap-2 font-bold cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="merge"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                  />
                  <span>Mesclar com edital atual</span>
                </label>
                <label className="flex items-center gap-2 font-bold cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                  />
                  <span>Substituir edital existente</span>
                </label>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setStep('input')} leftIcon={<ArrowLeft className="w-4 h-4" />}>Voltar</Button>
              <Button type="button" variant="primary" onClick={handleFinalSave} isLoading={isSaving} leftIcon={<CheckCircle2 className="w-4 h-4" />}>
                Confirmar & Gravar
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

function parseEditalLocally(rawText: string, cargo?: string, concursoTitle?: string): EditalAiImportPayload {
  const parsedItems = parseSyllabusLocally(rawText);
  const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6'];
  return {
    concursoTitle: concursoTitle || 'Certame Importado',
    cargo: cargo || 'Cargo Geral',
    disciplinas: parsedItems.map((item, idx) => ({
      name: item.nome || item.nomeDisciplina,
      code: item.sigla || (item.nome || item.nomeDisciplina).slice(0, 4).toUpperCase(),
      weight: 2.0,
      color: colors[idx % colors.length],
      topicos: item.topicos.map(t => ({
        name: t,
        importance: 'alta' as const,
        difficulty: 'media' as const,
        subtopicos: []
      }))
    }))
  };
}
