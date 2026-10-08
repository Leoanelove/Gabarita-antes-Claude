import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  X, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  Award,
  Sparkles,
  Calculator,
  BookOpen
} from 'lucide-react';
import { Concurso, Disciplina, Simulado, SimuladoDesempenhoDisciplina } from '../../types';
import { Button } from '../../design-system/Button';

interface RegisterSimuladoModalProps {
  concursos: Concurso[];
  disciplinas: Disciplina[];
  onClose: () => void;
  onSave: (simuladoData: any) => Promise<Simulado>;
}

interface MateriaRow {
  id: string;
  disciplinaId: string;
  disciplinaName: string;
  acertos: number | '';
  erros: number | '';
  brancos: number | '';
}

export const RegisterSimuladoModal: React.FC<RegisterSimuladoModalProps> = ({
  concursos,
  disciplinas,
  onClose,
  onSave,
}) => {
  const activeConcurso = concursos.find(c => c.active) || concursos[0];

  // Dados Gerais
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [banca, setBanca] = useState(activeConcurso?.banca || 'FGV');
  const [durationHours, setDurationHours] = useState<number | ''>(3);
  const [durationMinutes, setDurationMinutes] = useState<number | ''>(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Lista dinâmica de matérias com estado inicial amigável (3 primeiras disciplinas do app)
  const [materias, setMaterias] = useState<MateriaRow[]>(() => {
    if (disciplinas.length > 0) {
      return disciplinas.slice(0, Math.min(4, disciplinas.length)).map((d, idx) => ({
        id: `mat_${idx}_${Date.now()}`,
        disciplinaId: d.id,
        disciplinaName: d.name,
        acertos: 0,
        erros: 0,
        brancos: 0,
      }));
    }
    return [
      {
        id: `mat_0_${Date.now()}`,
        disciplinaId: 'custom_1',
        disciplinaName: 'Língua Portuguesa',
        acertos: 0,
        erros: 0,
        brancos: 0,
      },
      {
        id: `mat_1_${Date.now()}`,
        disciplinaId: 'custom_2',
        disciplinaName: 'Direito Administrativo',
        acertos: 0,
        erros: 0,
        brancos: 0,
      }
    ];
  });

  // Funções para manipular a lista dinâmica de matérias
  const handleAddMateria = () => {
    // Tenta encontrar uma disciplina que ainda não foi adicionada
    const unusedDisc = disciplinas.find(d => !materias.some(m => m.disciplinaId === d.id));
    const newMateria: MateriaRow = {
      id: `mat_${Date.now()}_${Math.random()}`,
      disciplinaId: unusedDisc?.id || `custom_${Date.now()}`,
      disciplinaName: unusedDisc?.name || '',
      acertos: 0,
      erros: 0,
      brancos: 0,
    };
    setMaterias(prev => [...prev, newMateria]);
  };

  const handleRemoveMateria = (id: string) => {
    if (materias.length === 1) {
      setErrorMsg('O simulado deve conter pelo menos 1 matéria.');
      return;
    }
    setMaterias(prev => prev.filter(m => m.id !== id));
    setErrorMsg(null);
  };

  const handleUpdateMateria = (id: string, field: keyof MateriaRow, value: any) => {
    setMaterias(prev => prev.map(m => {
      if (m.id === id) {
        if (field === 'disciplinaName') {
          // Se selecionou de disciplinas existentes, atualiza id e nome
          const matched = disciplinas.find(d => d.name === value);
          return {
            ...m,
            disciplinaName: value,
            disciplinaId: matched?.id || m.disciplinaId,
          };
        }
        return { ...m, [field]: value };
      }
      return m;
    }));
    setErrorMsg(null);
  };

  // Cálculos Automáticos em Tempo Real
  const totals = useMemo(() => {
    let totalAcertos = 0;
    let totalErros = 0;
    let totalBrancos = 0;

    materias.forEach(m => {
      totalAcertos += Number(m.acertos) || 0;
      totalErros += Number(m.erros) || 0;
      totalBrancos += Number(m.brancos) || 0;
    });

    const totalQuestoes = totalAcertos + totalErros + totalBrancos;
    const taxaAcerto = totalQuestoes > 0 
      ? Math.round((totalAcertos / totalQuestoes) * 100) 
      : 0;
    const pontuacaoLiquida = totalAcertos - totalErros;

    return {
      totalAcertos,
      totalErros,
      totalBrancos,
      totalQuestoes,
      taxaAcerto,
      pontuacaoLiquida,
    };
  }, [materias]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const finalTitle = title.trim();
    if (!finalTitle) {
      setErrorMsg('Por favor, informe o nome do simulado (ex: Simulado TCDF).');
      return;
    }

    if (totals.totalQuestoes === 0) {
      setErrorMsg('Adicione pelo menos uma matéria com questões registradas.');
      return;
    }

    // Verifica matérias sem nome
    const emptyNames = materias.some(m => !m.disciplinaName.trim());
    if (emptyNames) {
      setErrorMsg('Preencha o nome de todas as matérias adicionadas.');
      return;
    }

    const totalDurationMinutes = (Number(durationHours) || 0) * 60 + (Number(durationMinutes) || 0);

    const desempenhoPorDisciplina: SimuladoDesempenhoDisciplina[] = materias.map(m => {
      const acertos = Number(m.acertos) || 0;
      const erros = Number(m.erros) || 0;
      const brancos = Number(m.brancos) || 0;
      const totalMatQuestoes = acertos + erros + brancos;
      const taxa = totalMatQuestoes > 0 ? Math.round((acertos / totalMatQuestoes) * 100) : 0;
      return {
        disciplinaId: m.disciplinaId,
        disciplinaName: m.disciplinaName.trim(),
        totalQuestoes: totalMatQuestoes,
        acertos,
        erros,
        brancos,
        taxaAcerto: taxa,
        pontuacaoLiquida: acertos - erros,
      };
    });

    setIsSubmitting(true);
    try {
      await onSave({
        userId: 'user_demo_01',
        concursoId: activeConcurso?.id,
        concursoName: activeConcurso?.title,
        title: finalTitle,
        banca: banca.trim() || 'FGV',
        durationMinutes: totalDurationMinutes > 0 ? totalDurationMinutes : 180,
        questionsCount: totals.totalQuestoes,
        totalCorrect: totals.totalAcertos,
        totalWrong: totals.totalErros,
        totalBlank: totals.totalBrancos,
        accuracyRate: totals.taxaAcerto,
        score: totals.pontuacaoLiquida,
        maxScore: totals.totalQuestoes,
        status: 'finalizado',
        desempenhoPorDisciplina,
        finishedAt: `${date}T12:00:00Z`,
        createdAt: `${date}T12:00:00Z`,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao registrar simulado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const commonBancas = ['FGV', 'Cebraspe', 'FCC', 'Vunesp', 'Cesgranrio', 'IBFC', 'AOCP', 'Quadrix'];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Cabeçalho do Modal */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
                Registrar Novo Simulado
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lançamento manual de simulados realizados externamente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Dados Gerais */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
              1. Dados Gerais do Simulado
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nome do Simulado */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nome do Simulado <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Simulado TCDF - Auditor de Controle Externo (Prova 01)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
                />
              </div>

              {/* Data de Realização */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Data de Realização
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono"
                />
              </div>

              {/* Banca Organizadora */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Banca Organizadora
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={banca}
                    onChange={(e) => setBanca(e.target.value)}
                    placeholder="Ex: FGV, Cebraspe, FCC"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {commonBancas.map(b => (
                      <button
                        type="button"
                        key={b}
                        onClick={() => setBanca(b)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors ${
                          banca.toLowerCase() === b.toLowerCase()
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tempo de Duração */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Tempo de Duração Gasto
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="12"
                      value={durationHours}
                      onChange={(e) => setDurationHours(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-mono text-center focus:ring-2 focus:ring-indigo-500 outline-hidden"
                      placeholder="3"
                    />
                    <span className="text-xs font-bold text-slate-500">horas</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(e.target.value === '' ? '' : Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-mono text-center focus:ring-2 focus:ring-indigo-500 outline-hidden"
                      placeholder="30"
                    />
                    <span className="text-xs font-bold text-slate-500">minutos</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Desempenho por Matéria (Dinâmico) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                2. Desempenho por Matéria
              </h3>
              <button
                type="button"
                onClick={handleAddMateria}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-800/50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Matéria
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Informe a quantidade de acertos, erros e em branco para cada disciplina avaliada:
            </p>

            <div className="space-y-3">
              {materias.map((mat, index) => {
                const matAcertos = Number(mat.acertos) || 0;
                const matErros = Number(mat.erros) || 0;
                const matBrancos = Number(mat.brancos) || 0;
                const matTotal = matAcertos + matErros + matBrancos;
                const matRate = matTotal > 0 ? Math.round((matAcertos / matTotal) * 100) : 0;

                return (
                  <div
                    key={mat.id}
                    className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                          Matéria #{index + 1}
                        </label>
                        {disciplinas.length > 0 ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              list={`disc-list-${mat.id}`}
                              value={mat.disciplinaName}
                              onChange={(e) => handleUpdateMateria(mat.id, 'disciplinaName', e.target.value)}
                              placeholder="Digite ou selecione a disciplina..."
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                            />
                            <datalist id={`disc-list-${mat.id}`}>
                              {disciplinas.map(d => (
                                <option key={d.id} value={d.name} />
                              ))}
                            </datalist>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={mat.disciplinaName}
                            onChange={(e) => handleUpdateMateria(mat.id, 'disciplinaName', e.target.value)}
                            placeholder="Nome da matéria (ex: Português)"
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                          />
                        )}
                      </div>

                      {/* Botão Remover Matéria */}
                      <button
                        type="button"
                        onClick={() => handleRemoveMateria(mat.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors mt-4"
                        title="Remover Matéria"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Inputs de Acertos, Erros e Brancos */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 items-end">
                      {/* Acertos */}
                      <div>
                        <label className="block text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Acertos
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={mat.acertos}
                          onChange={(e) => handleUpdateMateria(mat.id, 'acertos', e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 text-center focus:ring-2 focus:ring-emerald-500 outline-hidden"
                        />
                      </div>

                      {/* Erros */}
                      <div>
                        <label className="block text-[11px] font-bold text-rose-600 dark:text-rose-400 mb-1 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Erros
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={mat.erros}
                          onChange={(e) => handleUpdateMateria(mat.id, 'erros', e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-rose-500/30 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-rose-600 dark:text-rose-400 text-center focus:ring-2 focus:ring-rose-500 outline-hidden"
                        />
                      </div>

                      {/* Em Branco */}
                      <div>
                        <label className="block text-[11px] font-bold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
                          <MinusCircle className="w-3 h-3" />
                          Em Branco
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={mat.brancos}
                          onChange={(e) => handleUpdateMateria(mat.id, 'brancos', e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-amber-600 dark:text-amber-400 text-center focus:ring-2 focus:ring-amber-500 outline-hidden"
                        />
                      </div>

                      {/* Mini Resumo da Matéria */}
                      <div className="col-span-3 sm:col-span-1 flex flex-col items-center sm:items-end justify-center pt-1 sm:pt-0">
                        <span className="text-[10px] text-slate-400 font-medium">Total: {matTotal} q</span>
                        <span className={`text-xs font-black font-mono ${
                          matRate >= 80 ? 'text-emerald-500' : matRate >= 60 ? 'text-indigo-500' : 'text-amber-500'
                        }`}>
                          {matRate}% acerto
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Painel de Cálculo Automático em Tempo Real */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900 border border-indigo-500/30 text-white shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2.5">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-indigo-400" />
                Resumo Automático do Simulado
              </h4>
              <span className="text-[11px] font-bold text-slate-400">
                {materias.length} {materias.length === 1 ? 'matéria' : 'matérias'}
              </span>
            </div>

            {/* Grid com métricas automáticas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Questões</span>
                <span className="text-xl sm:text-2xl font-black font-mono text-white">
                  {totals.totalQuestoes}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block">Total Acertos</span>
                <span className="text-xl sm:text-2xl font-black font-mono text-emerald-300">
                  {totals.totalAcertos}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40">
                <span className="text-[10px] uppercase font-bold text-rose-400 block">Total Erros</span>
                <span className="text-xl sm:text-2xl font-black font-mono text-rose-300">
                  {totals.totalErros}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-indigo-900/60 border border-indigo-400/40">
                <span className="text-[10px] uppercase font-bold text-indigo-300 block">Aproveitamento</span>
                <span className="text-xl sm:text-2xl font-black font-mono text-indigo-200">
                  {totals.taxaAcerto}%
                </span>
              </div>
            </div>

            {/* Barra Visual de Distribuição */}
            {totals.totalQuestoes > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[10px] font-bold text-slate-400">
                  <span>Distribuição das Questões</span>
                  <span className="text-slate-300">
                    Pontuação Líquida: <strong className="text-white">{totals.pontuacaoLiquida} pts</strong>
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex border border-slate-700">
                  <div
                    className="bg-emerald-500 transition-all duration-300"
                    style={{ width: `${(totals.totalAcertos / totals.totalQuestoes) * 100}%` }}
                    title={`Acertos: ${totals.totalAcertos}`}
                  />
                  <div
                    className="bg-rose-500 transition-all duration-300"
                    style={{ width: `${(totals.totalErros / totals.totalQuestoes) * 100}%` }}
                    title={`Erros: ${totals.totalErros}`}
                  />
                  <div
                    className="bg-amber-400 transition-all duration-300"
                    style={{ width: `${(totals.totalBrancos / totals.totalQuestoes) * 100}%` }}
                    title={`Em Branco: ${totals.totalBrancos}`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Ações do Modal */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting || totals.totalQuestoes === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 shadow-md"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Simulado'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
