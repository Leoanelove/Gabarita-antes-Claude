import React, { useState, useMemo } from 'react';
import { 
  Award, 
  Clock, 
  Plus, 
  Search, 
  Trash2, 
  FileText, 
  TrendingUp, 
  Calendar,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Eye,
  Filter,
  BarChart2
} from 'lucide-react';
import { Simulado, Concurso, Disciplina, Assunto } from '../../types';
import { Card, CardHeader, CardBody } from '../../design-system/Card';
import { Button } from '../../design-system/Button';
import { SimuladoLineChart } from './SimuladoLineChart';
import { RegisterSimuladoModal } from './RegisterSimuladoModal';
import { SimuladoDetailModal } from './SimuladoDetailModal';
import { EmptyContestState } from '../common/EmptyContestState';

interface SimuladosViewProps {
  simulados: Simulado[];
  concursos: Concurso[];
  disciplinas: Disciplina[];
  assuntos?: Assunto[];
  onNavigateTab?: (tab: any) => void;
  onCreateSimulado: (data: any) => Promise<Simulado>;
  onDeleteSimulado: (id: string) => Promise<void>;
  onPauseSimulado?: (id: string, answers: Record<number, string>, doubting: Record<number, boolean>, timeRemaining: number, elapsedSeconds: number) => Promise<void>;
  onFinishSimulado?: (id: string, answers: Record<number, string>, doubting: Record<number, boolean>, elapsedSeconds: number) => Promise<Simulado>;
  onAddToCadernoErros?: (simuladoId: string, questaoId: string, motivo: any, observation?: string) => Promise<any>;
}

export const SimuladosView: React.FC<SimuladosViewProps> = ({
  simulados,
  concursos,
  disciplinas,
  onNavigateTab,
  onCreateSimulado,
  onDeleteSimulado,
}) => {
  if (concursos.length === 0) {
    return (
      <EmptyContestState
        title="Você ainda não possui um concurso ativo"
        description="Cadastre seu concurso foco e importe as disciplinas do certame para registrar simulados e analisar seus gráficos de desempenho por matéria e evolução temporal."
        actionText="Cadastrar Concurso Foco"
        onAction={() => onNavigateTab ? onNavigateTab('concursos') : null}
      />
    );
  }

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBancaFilter, setSelectedBancaFilter] = useState<string>('todas');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [viewingDetailSimulado, setViewingDetailSimulado] = useState<Simulado | null>(null);

  // Considera simulados finalizados / registrados ordenados por data decrescente (mais recente primeiro)
  const sortedHistory = useMemo(() => {
    return [...simulados]
      .filter(s => s.status === 'finalizado' || s.accuracyRate !== undefined)
      .sort((a, b) => {
        const dateA = new Date(a.finishedAt || a.createdAt).getTime();
        const dateB = new Date(b.finishedAt || b.createdAt).getTime();
        return dateB - dateA; // Mais recente primeiro
      });
  }, [simulados]);

  // Estatísticas Gerais
  const totalSimulados = sortedHistory.length;

  // Último Simulado
  const ultimoSimulado = sortedHistory.length > 0 ? sortedHistory[0] : null;
  const ultimoAccuracy = ultimoSimulado 
    ? (ultimoSimulado.accuracyRate !== undefined 
        ? ultimoSimulado.accuracyRate 
        : Math.round(((ultimoSimulado.totalCorrect || 0) / (ultimoSimulado.questionsCount || 1)) * 100))
    : 0;

  const ultimoAcertos = ultimoSimulado?.totalCorrect || 0;
  const ultimoErros = ultimoSimulado?.totalWrong || 0;
  const ultimoBrancos = ultimoSimulado?.totalBlank !== undefined 
    ? ultimoSimulado.totalBlank 
    : Math.max(0, (ultimoSimulado?.questionsCount || 0) - ultimoAcertos - ultimoErros);

  // Total de questões resolvidas em simulados
  const totalQuestoesSimulados = useMemo(() => {
    return sortedHistory.reduce((acc, s) => acc + (s.questionsCount || 0), 0);
  }, [sortedHistory]);

  // Lista filtrada
  const filteredSimulados = useMemo(() => {
    return sortedHistory.filter(s => {
      const matchesSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.banca || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesBanca = selectedBancaFilter === 'todas' || 
        (s.banca || '').toLowerCase() === selectedBancaFilter.toLowerCase();
      return matchesSearch && matchesBanca;
    });
  }, [sortedHistory, searchTerm, selectedBancaFilter]);

  // Lista única de bancas presentes nos simulados
  const availableBancas = useMemo(() => {
    const set = new Set<string>();
    sortedHistory.forEach(s => {
      if (s.banca) set.add(s.banca);
    });
    return Array.from(set);
  }, [sortedHistory]);

  const handleDelete = async (id: string, title: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o simulado "${title}"?`)) {
      await onDeleteSimulado(id);
      if (viewingDetailSimulado?.id === id) {
        setViewingDetailSimulado(null);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Topo: Título da Aba & Botão de Ação Primária '+ Novo Simulado' */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Award className="w-5 h-5" />
            </div>
            Registrador de Simulados
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Registre e acompanhe sua evolução percentual em provas reais e simulados externos.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => setIsRegisterModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-600/20 shrink-0"
        >
          Novo Simulado
        </Button>
      </div>

      {/* 1. Layout Principal: Topo Esquerdo (2 Cards Verticais) + Topo Direito (Gráfico de Linha Largo) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Topo Esquerdo: 2 Cards Verticais (lg:col-span-4) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Card 1: 'Simulados Realizados' */}
          <Card className="flex-1 border-slate-200 dark:border-slate-800 bg-gradient-to-br from-indigo-500/10 via-slate-50 to-white dark:from-indigo-950/30 dark:via-slate-900 dark:to-slate-900 shadow-sm">
            <CardBody className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-indigo-600 dark:text-indigo-400">
                  Simulados Realizados
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <BarChart2 className="w-4 h-4" />
                </div>
              </div>

              <div className="my-2">
                <span className="text-3xl sm:text-4xl font-black font-mono text-slate-900 dark:text-slate-100">
                  {totalSimulados}
                </span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-2">
                  {totalSimulados === 1 ? 'simulado registrado' : 'simulados registrados'}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Total de Questões:</span>
                <strong className="text-slate-800 dark:text-slate-200 font-mono font-bold">
                  {totalQuestoesSimulados} q
                </strong>
              </div>
            </CardBody>
          </Card>

          {/* Card 2: 'Último Simulado' */}
          <Card className="flex-1 border-slate-200 dark:border-slate-800 bg-gradient-to-br from-emerald-500/10 via-slate-50 to-white dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 shadow-sm">
            <CardBody className="p-5 flex flex-col justify-between h-full space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-emerald-600 dark:text-emerald-400">
                  Último Simulado
                </span>
                {ultimoSimulado && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {ultimoSimulado.banca || 'Simulado'}
                  </span>
                )}
              </div>

              {ultimoSimulado ? (
                <>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={ultimoSimulado.title}>
                      {ultimoSimulado.title}
                    </h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                        {ultimoAccuracy}%
                      </span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        aproveitamento geral
                      </span>
                    </div>
                  </div>

                  {/* Quantidade de Acertos, Erros e Brancos */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
                    <div className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25">
                      <span className="text-[9px] uppercase font-bold text-emerald-700 dark:text-emerald-300 block">
                        Acertos
                      </span>
                      <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                        {ultimoAcertos}
                      </span>
                    </div>

                    <div className="p-1.5 rounded-lg bg-rose-500/15 border border-rose-500/25">
                      <span className="text-[9px] uppercase font-bold text-rose-700 dark:text-rose-300 block">
                        Erros
                      </span>
                      <span className="text-sm font-black font-mono text-rose-600 dark:text-rose-400">
                        {ultimoErros}
                      </span>
                    </div>

                    <div className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25">
                      <span className="text-[9px] uppercase font-bold text-amber-700 dark:text-amber-300 block">
                        Brancos
                      </span>
                      <span className="text-sm font-black font-mono text-amber-600 dark:text-amber-400">
                        {ultimoBrancos}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-4 text-center text-slate-400 text-xs">
                  Nenhum simulado registrado ainda.
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Topo Direito: Card Largo 'Seu Desempenho' com Gráfico de Linha (lg:col-span-8) */}
        <div className="lg:col-span-8 flex flex-col">
          <Card className="h-full border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <CardHeader
              title="Seu Desempenho"
              subtitle="Evolução percentual de acertos ao longo do tempo"
              action={
                <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800/50">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Histórico de Evolução</span>
                </div>
              }
            />
            <CardBody className="p-5 pt-2 flex-1 flex flex-col justify-center">
              <SimuladoLineChart simulados={sortedHistory} />
            </CardBody>
          </Card>
        </div>
      </div>

      {/* 2. Lista Inferior: Histórico de Simulados Registrados */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              Histórico de Simulados
            </h3>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {filteredSimulados.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filtro por Banca */}
            {availableBancas.length > 1 && (
              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedBancaFilter}
                  onChange={(e) => setSelectedBancaFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                >
                  <option value="todas">Todas as Bancas</option>
                  {availableBancas.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Barra de Busca */}
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou banca..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
              />
            </div>
          </div>
        </div>

        {/* Listagem em Cards Modernos */}
        {filteredSimulados.length > 0 ? (
          <div className="space-y-3">
            {filteredSimulados.map((sim) => {
              const accuracy = sim.accuracyRate !== undefined
                ? sim.accuracyRate
                : Math.round(((sim.totalCorrect || 0) / (sim.questionsCount || 1)) * 100);
              
              const correct = sim.totalCorrect || 0;
              const wrong = sim.totalWrong || 0;
              const blank = sim.totalBlank !== undefined 
                ? sim.totalBlank 
                : Math.max(0, (sim.questionsCount || 0) - correct - wrong);

              const formattedDate = new Date(sim.finishedAt || sim.createdAt).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              });

              const durationHours = Math.floor((sim.durationMinutes || 0) / 60);
              const durationMins = (sim.durationMinutes || 0) % 60;
              const formattedDuration = durationHours > 0 
                ? `${durationHours}h ${durationMins > 0 ? `${durationMins}m` : ''}`
                : `${sim.durationMinutes || 0} min`;

              const disciplinesCount = sim.desempenhoPorDisciplina?.length || 0;

              return (
                <div
                  key={sim.id}
                  className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 dark:hover:border-indigo-500/40 transition-all duration-200 shadow-xs hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Coluna 1: Data, Nome do Simulado e Banca */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {formattedDate}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                        {sim.banca || 'Simulado'}
                      </span>
                      {disciplinesCount > 0 && (
                        <span className="text-[11px] font-medium text-slate-400">
                          • {disciplinesCount} {disciplinesCount === 1 ? 'matéria' : 'matérias'}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 truncate">
                      {sim.title}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Tempo Gasto: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{formattedDuration}</strong>
                      </span>
                      <span>•</span>
                      <span>Total: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{sim.questionsCount} questões</strong></span>
                    </div>
                  </div>

                  {/* Coluna 2: Resumo de Acertos/Erros/Brancos e Taxa */}
                  <div className="flex flex-wrap items-center gap-4 sm:gap-6 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                    {/* Contadores Acertos / Erros / Brancos */}
                    <div className="flex items-center gap-2 text-xs font-mono font-bold">
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" title="Acertos">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{correct}</span>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400" title="Erros">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{wrong}</span>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400" title="Em Branco">
                        <MinusCircle className="w-3.5 h-3.5" />
                        <span>{blank}</span>
                      </div>
                    </div>

                    {/* Taxa de Aproveitamento */}
                    <div className="text-right min-w-[70px]">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Aproveitamento
                      </span>
                      <span className={`text-xl font-black font-mono ${
                        accuracy >= 80 
                          ? 'text-emerald-600 dark:text-emerald-400' 
                          : accuracy >= 60 
                            ? 'text-indigo-600 dark:text-indigo-400' 
                            : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {accuracy}%
                      </span>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewingDetailSimulado(sim)}
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                        className="text-xs"
                      >
                        Ver Detalhes
                      </Button>
                      <button
                        onClick={() => handleDelete(sim.id, sim.title)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                        title="Excluir Simulado"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 sm:p-12 text-center rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
            <Award className="w-10 h-10 text-slate-400 mx-auto" />
            <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
              {searchTerm ? 'Nenhum simulado encontrado para a busca.' : 'Nenhum simulado registrado no histórico.'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Realizou uma prova ou simulado impresso/online? Clique abaixo para registrar seus acertos e erros por matéria.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsRegisterModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
              className="mt-2 bg-indigo-600 text-white font-bold"
            >
              Registrar Primeiro Simulado
            </Button>
          </div>
        )}
      </div>

      {/* Modal de Registro de Novo Simulado */}
      {isRegisterModalOpen && (
        <RegisterSimuladoModal
          concursos={concursos}
          disciplinas={disciplinas}
          onClose={() => setIsRegisterModalOpen(false)}
          onSave={onCreateSimulado}
        />
      )}

      {/* Modal de Visualização de Detalhes do Simulado */}
      {viewingDetailSimulado && (
        <SimuladoDetailModal
          simulado={viewingDetailSimulado}
          onClose={() => setViewingDetailSimulado(null)}
          onDelete={onDeleteSimulado}
        />
      )}
    </div>
  );
};
