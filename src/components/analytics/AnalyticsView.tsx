import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  Clock, 
  HelpCircle, 
  CheckCircle2, 
  XCircle, 
  TrendingUp, 
  Download, 
  FileSpreadsheet, 
  Award, 
  Flame, 
  Repeat 
} from 'lucide-react';
import { 
  Disciplina, 
  Assunto, 
  SessaoEstudo, 
  RegistroBlocoQuestoes, 
  Revisao, 
  Simulado, 
  EstatisticasProgressoReal 
} from '../../types';
import { Card, CardHeader, CardBody } from '../../design-system/Card';
import { Button } from '../../design-system/Button';
import { Badge } from '../../design-system/Badge';

interface AnalyticsViewProps {
  disciplinas: Disciplina[];
  assuntos: Assunto[];
  sessoes: SessaoEstudo[];
  blocosQuestoes: RegistroBlocoQuestoes[];
  revisoes: Revisao[];
  simulados: Simulado[];
  stats: EstatisticasProgressoReal;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  disciplinas,
  assuntos,
  sessoes,
  blocosQuestoes,
  revisoes,
  simulados,
  stats,
}) => {
  const [periodFilter, setPeriodFilter] = useState<'hoje' | 'semana' | 'mes' | 'todos'>('todos');
  const [activeTab, setActiveTab] = useState<'geral' | 'disciplinas' | 'assuntos' | 'evolucao'>('geral');

  const filteredData = useMemo(() => {
    let horas = 0;
    sessoes.forEach(s => horas += s.durationMinutes || 0);
    simulados.filter(s => s.status === 'finalizado').forEach(s => {
      horas += Math.round((s.elapsedSeconds || (s.durationMinutes * 60)) / 60);
    });
    const horasTotais = Math.round((horas / 60) * 10) / 10;
    
    let questoes = 0;
    let acertos = 0;
    blocosQuestoes.forEach(b => {
      questoes += b.totalQuestions || 0;
      acertos += b.correctAnswers || 0;
    });
    simulados.filter(s => s.status === 'finalizado').forEach(s => {
      questoes += s.questionsCount || (s.questoes?.length || 0);
      acertos += s.totalCorrect || 0;
    });
    const erros = Math.max(0, questoes - acertos);
    const taxaAcerto = questoes > 0 ? Math.round((acertos / questoes) * 100) : 0;
    const revisoesConcluidas = revisoes.filter(r => r.status === 'concluida').length;

    return {
      horasTotais,
      questoes,
      acertos,
      erros,
      taxaAcerto,
      revisoesConcluidas,
      sessoesCount: sessoes.length,
      mediaHorasPorSessao: sessoes.length > 0 ? Math.round((horasTotais / sessoes.length) * 10) / 10 : 0,
    };
  }, [sessoes, blocosQuestoes, revisoes, simulados]);

  const desempenhoDisciplinas = useMemo(() => {
    return disciplinas.map(disc => {
      const discBlocos = blocosQuestoes.filter(b => b.disciplinaId === disc.id);
      let discQ = 0;
      let discA = 0;
      discBlocos.forEach(b => {
        discQ += b.totalQuestions || 0;
        discA += b.correctAnswers || 0;
      });
      const taxa = discQ > 0 ? Math.round((discA / discQ) * 100) : 0;
      return {
        id: disc.id,
        name: disc.name,
        color: disc.color || '#6366f1',
        questoes: discQ,
        acertos: discA,
        erros: Math.max(0, discQ - discA),
        taxaAcerto: taxa,
      };
    });
  }, [disciplinas, blocosQuestoes]);

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,Disciplina;Questoes;Acertos;Erros;TaxaAcerto\n";
    desempenhoDisciplinas.forEach(d => {
      csvContent += `"${d.name}";${d.questoes};${d.acertos};${d.erros};${d.taxaAcerto}%\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `gabarita_analise_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Estatísticas & Relatórios
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Métricas consolidadas e desempenho por matéria.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExportCSV} leftIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}>
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5">
          <CardBody className="p-5">
            <span className="text-xs uppercase font-bold text-indigo-600 block mb-1">Horas Líquidas</span>
            <span className="text-3xl font-black">{filteredData.horasTotais}h</span>
          </CardBody>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5">
          <CardBody className="p-5">
            <span className="text-xs uppercase font-bold text-emerald-600 block mb-1">Taxa de Acerto</span>
            <span className="text-3xl font-black">{filteredData.taxaAcerto}%</span>
          </CardBody>
        </Card>
        <Card className="bg-gradient-to-br from-rose-500/10 to-rose-600/5">
          <CardBody className="p-5">
            <span className="text-xs uppercase font-bold text-rose-600 block mb-1">Erros Registrados</span>
            <span className="text-3xl font-black">{filteredData.erros}</span>
          </CardBody>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5">
          <CardBody className="p-5">
            <span className="text-xs uppercase font-bold text-amber-600 block mb-1">Revisões</span>
            <span className="text-3xl font-black">{filteredData.revisoesConcluidas}</span>
          </CardBody>
        </Card>
      </div>

      <div className="flex items-center gap-2 border-b pb-3 overflow-x-auto text-xs">
        <button onClick={() => setActiveTab('geral')} className={`px-4 py-2 rounded-lg font-bold ${activeTab === 'geral' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>Visão Geral</button>
        <button onClick={() => setActiveTab('disciplinas')} className={`px-4 py-2 rounded-lg font-bold ${activeTab === 'disciplinas' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>Por Disciplina</button>
        <button onClick={() => setActiveTab('evolucao')} className={`px-4 py-2 rounded-lg font-bold ${activeTab === 'evolucao' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>Evolução Semanal</button>
      </div>

      {activeTab === 'geral' && (
        <Card>
          <CardHeader title="Progresso Geral do Edital" />
          <CardBody className="p-6 space-y-4">
            <div className="flex justify-between font-bold text-sm">
              <span>Cobertura do Edital</span>
              <span className="text-emerald-500">{stats.percentualEdital}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stats.percentualEdital}%` }} />
            </div>
          </CardBody>
        </Card>
      )}

      {activeTab === 'disciplinas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {desempenhoDisciplinas.map(d => (
            <Card key={d.id}>
              <CardHeader title={d.name} action={<Badge variant="emerald" size="sm">{d.taxaAcerto}%</Badge>} />
              <CardBody className="p-5">
                <p className="text-xs text-slate-500">Acertos: {d.acertos} / {d.questoes}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'evolucao' && (
        <Card>
          <CardHeader title="Ritmo dos Últimos 7 Dias" />
          <CardBody className="p-6">
            <div className="grid grid-cols-7 gap-3 h-48 items-end">
              {stats.diasAtivosUltimaSemana.map((d, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1 h-full justify-end">
                  <span className="text-[10px] font-bold">{Math.round(d.minutos / 60)}h</span>
                  <div className="w-full bg-teal-400 rounded-t-lg" style={{ height: `${Math.max(10, Math.min(100, (d.minutos / 240) * 100))}%` }} />
                  <span className="text-xs font-semibold">{d.diaSemana}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};
