import React from 'react';
import { 
  Sparkles, 
  Target, 
  Briefcase, 
  BookOpen, 
  Plus, 
  ArrowRight,
  Zap,
  Repeat,
  CalendarCheck
} from 'lucide-react';
import { Card, CardBody } from '../../design-system/Card';
import { Button } from '../../design-system/Button';

interface EmptyContestStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  onAction: () => void;
  icon?: React.ElementType;
}

export const EmptyContestState: React.FC<EmptyContestStateProps> = ({
  title = "Você ainda não possui um concurso ativo",
  description = "Cadastre seu concurso foco e importe o conteúdo programático do edital (com auxílio da Inteligência Artificial ou manualmente) para desbloquear seu Painel de Estudos, Ciclo Inteligente, Cronograma e Revisões Espaçadas.",
  actionText = "Cadastrar Concurso Foco",
  onAction,
  icon: Icon = Target,
}) => {
  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 px-4 animate-fade-in">
      <Card className="relative overflow-hidden border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md shadow-xl rounded-3xl">
        {/* Glow ambient background */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <CardBody className="p-6 sm:p-10 text-center space-y-8 relative z-10">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500/20 via-teal-500/20 to-sky-500/20 border border-emerald-500/30 dark:border-emerald-400/30 flex items-center justify-center text-emerald-500 dark:text-emerald-400 shadow-inner">
              <Icon className="w-10 h-10" />
            </div>

            <div className="space-y-2 max-w-xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Sparkles className="w-3.5 h-3.5" /> Comece por aqui
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {title}
              </h3>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          {/* Value props pill badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 max-w-2xl mx-auto text-left">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-200">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Importador IA</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                Extraia disciplinas e tópicos do edital em segundos via IA.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-200">
                <CalendarCheck className="w-4 h-4 text-emerald-500" />
                <span>Ciclo & Cronograma</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                Distribuição de horas ponderada por peso e prioridade.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-200">
                <Repeat className="w-4 h-4 text-indigo-500" />
                <span>Revisões Espaçadas</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                Algoritmo SRS (24h, 7d, 15d, 30d) para retenção de longo prazo.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="primary"
              size="lg"
              onClick={onAction}
              leftIcon={<Plus className="w-5 h-5" />}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="w-full sm:w-auto shadow-lg shadow-emerald-500/20 px-8 py-3.5 text-sm sm:text-base font-bold"
            >
              {actionText}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
