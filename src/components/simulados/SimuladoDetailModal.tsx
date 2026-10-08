import React from 'react';
import { 
  Award, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  Trash2, 
  X,
  Layers,
  TrendingUp,
  Target
} from 'lucide-react';
import { Simulado } from '../../types';
import { Button } from '../../design-system/Button';

interface SimuladoDetailModalProps {
  simulado: Simulado;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
}

export const SimuladoDetailModal: React.FC<SimuladoDetailModalProps> = ({
  simulado,
  onClose,
  onDelete,
}) => {
  const [isDeleting, setIsDeleting] = React.useState(false);

  const formattedDate = new Date(simulado.finishedAt || simulado.createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const accuracy = simulado.accuracyRate !== undefined 
    ? simulado.accuracyRate 
    : simulado.questionsCount > 0 
      ? Math.round(((simulado.totalCorrect || 0) / simulado.questionsCount) * 100) 
      : 0;

  const totalQuestions = simulado.questionsCount || 1;
  const correct = simulado.totalCorrect || 0;
  const wrong = simulado.totalWrong || 0;
  const blank = simulado.totalBlank || Math.max(0, totalQuestions - correct - wrong);
  const liquidScore = simulado.score !== undefined ? simulado.score : (correct - wrong);

  const durationHours = Math.floor((simulado.durationMinutes || 0) / 60);
  const durationMins = (simulado.durationMinutes || 0) % 60;
  const formattedDuration = durationHours > 0 
    ? `${durationHours}h ${durationMins > 0 ? `${durationMins}min` : ''}`
    : `${simulado.durationMinutes || 0} min`;

  const handleDelete = async () => {
    if (window.confirm(`Tem certeza que deseja excluir o registro do simulado "${simulado.title}"?`)) {
      setIsDeleting(true);
      try {
        await onDelete(simulado.id);
        onClose();
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const disciplines = simulado.desempenhoPorDisciplina || [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Cabeçalho */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                {simulado.banca || 'Simulado'}
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {formattedDate}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
              {simulado.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Métricas Principais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-center">
              <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 block mb-1">
                Aproveitamento
              </span>
              <span className="text-2xl sm:text-3xl font-black font-mono text-indigo-600 dark:text-indigo-300">
                {accuracy}%
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block mb-1">
                Acertos
              </span>
              <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-300">
                {correct}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
              <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 block mb-1">
                Erros
              </span>
              <span className="text-2xl sm:text-3xl font-black font-mono text-rose-600 dark:text-rose-300">
                {wrong}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">
                Pontos Líquidos
              </span>
              <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-slate-100">
                {liquidScore}
              </span>
            </div>
          </div>

          {/* Dados Adicionais */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" />
              Tempo Gasto: <strong className="text-slate-900 dark:text-slate-100">{formattedDuration}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-slate-400" />
              Total de Questões: <strong className="text-slate-900 dark:text-slate-100">{totalQuestions} questões</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <MinusCircle className="w-4 h-4 text-amber-500" />
              Em Branco: <strong className="text-slate-900 dark:text-slate-100">{blank}</strong>
            </span>
          </div>

          {/* Desempenho por Disciplina */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              Desempenho por Matéria ({disciplines.length})
            </h3>

            {disciplines.length > 0 ? (
              <div className="space-y-2.5">
                {disciplines.map((d, idx) => {
                  const dTotal = d.totalQuestoes || (d.acertos + d.erros + (d.brancos || 0)) || 1;
                  const dRate = d.taxaAcerto !== undefined 
                    ? d.taxaAcerto 
                    : Math.round((d.acertos / dTotal) * 100);

                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                          {d.disciplinaName}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-slate-400">
                            {d.acertos}/{dTotal} questões
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-xs font-extrabold font-mono ${
                            dRate >= 80 
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                              : dRate >= 60 
                                ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30' 
                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          }`}>
                            {dRate}%
                          </span>
                        </div>
                      </div>

                      {/* Barra de Progresso da Disciplina */}
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                        <div
                          className="bg-emerald-500"
                          style={{ width: `${(d.acertos / dTotal) * 100}%` }}
                          title={`Acertos: ${d.acertos}`}
                        />
                        <div
                          className="bg-rose-500"
                          style={{ width: `${(d.erros / dTotal) * 100}%` }}
                          title={`Erros: ${d.erros}`}
                        />
                        <div
                          className="bg-amber-400"
                          style={{ width: `${((d.brancos || 0) / dTotal) * 100}%` }}
                          title={`Em Branco: ${d.brancos || 0}`}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                        <span className="text-emerald-500 font-medium">✓ {d.acertos} acertos</span>
                        <span className="text-rose-500 font-medium">✗ {d.erros} erros</span>
                        <span className="text-amber-500 font-medium">- {d.brancos || 0} brancos</span>
                        <span className="text-slate-300 font-mono">Líquida: {d.acertos - d.erros}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Nenhum detalhamento por matéria disponível.</p>
            )}
          </div>
        </div>

        {/* Rodapé com ações */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Excluir Registro
          </button>
          <Button variant="outline" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
};
