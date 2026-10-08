import React, { useState } from 'react';
import { 
  Repeat, 
  CalendarClock, 
  Check, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  HelpCircle,
  Clock,
  Layers,
  CalendarDays
} from 'lucide-react';
import { StudyMethod } from '../../types';
import { Modal } from '../../design-system/Modal';
import { Button } from '../../design-system/Button';
import { Badge } from '../../design-system/Badge';

interface MetodoEstudoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMethod?: StudyMethod;
  onSelectMethod: (method: StudyMethod) => Promise<void> | void;
  title?: string;
  description?: string;
}

export const MetodoEstudoModal: React.FC<MetodoEstudoModalProps> = ({
  isOpen,
  onClose,
  currentMethod = 'ciclo',
  onSelectMethod,
  title = 'Escolha o Método de Estudo',
  description = 'Selecione a metodologia que melhor atende à sua rotina e estratégia de aprovação.',
}) => {
  const [selectedMethod, setSelectedMethod] = useState<StudyMethod>(currentMethod);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onSelectMethod(selectedMethod);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      maxWidth="lg"
    >
      <div className="space-y-5 text-xs">
        <div className="p-3.5 rounded-xl bg-[var(--primary-light)] border border-[var(--primary-light-border)] flex items-start gap-2.5 text-[var(--primary-text)] dark:text-[var(--primary-text-dark)]">
          <Sparkles className="w-4 h-4 text-[var(--primary-color)] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Etapa Obrigatória de Setup:</strong> Cada estudante possui uma dinâmica própria. 
            Você pode alternar ou replanejar o seu método a qualquer momento através do painel.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Opção 1: Ciclo de Estudos */}
          <div
            onClick={() => setSelectedMethod('ciclo')}
            className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
              selectedMethod === 'ciclo'
                ? 'border-[var(--primary-color)] bg-[var(--primary-light)] shadow-md ring-2 ring-[var(--primary-light-border)]'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            {selectedMethod === 'ciclo' && (
              <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-[var(--primary-color)] text-white flex items-center justify-center shadow-sm">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-[var(--primary-light)] text-[var(--primary-text)] dark:text-[var(--primary-text-dark)] flex items-center justify-center">
                  <Repeat className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100 block">
                    Ciclo de Estudos
                  </span>
                  <span className="text-[11px] text-[var(--primary-text)] dark:text-[var(--primary-text-dark)] font-semibold">
                    Esteira Contínua Flexível
                  </span>
                </div>
              </div>

              <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                Estudo dinâmico em rotação contínua. Você estuda o tempo que tiver disponível e retoma exatamente de onde parou.
              </p>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Sem culpa por dias ou imprevistos</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Gráfico de Rosca com horas por disciplina</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Ideal para rotinas variáveis e foco em peso</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Método de Alto Rendimento
              </span>
              <Badge variant={selectedMethod === 'ciclo' ? 'primary' : 'slate'} size="sm">
                {selectedMethod === 'ciclo' ? 'Selecionado' : 'Escolher'}
              </Badge>
            </div>
          </div>

          {/* Opção 2: Cronograma Fixo */}
          <div
            onClick={() => setSelectedMethod('cronograma')}
            className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
              selectedMethod === 'cronograma'
                ? 'border-[var(--primary-color)] bg-[var(--primary-light)] shadow-md ring-2 ring-[var(--primary-light-border)]'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            {selectedMethod === 'cronograma' && (
              <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-[var(--primary-color)] text-white flex items-center justify-center shadow-sm">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100 block">
                    Cronograma Fixo
                  </span>
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                    Grade Semanal & Calendário
                  </span>
                </div>
              </div>

              <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                Grade de horários distribuída nos dias da semana e horários fixos com visualização completa no calendário.
              </p>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Calendário diário, semanal e mensal</span>
                </div>
                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Dias e horários programados previamente</span>
                </div>
                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Ideal para quem possui rotina diária regular</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Planejamento Semanal
              </span>
              <Badge variant={selectedMethod === 'cronograma' ? 'primary' : 'slate'} size="sm">
                {selectedMethod === 'cronograma' ? 'Selecionado' : 'Escolher'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleConfirm}
            isLoading={isSubmitting}
            leftIcon={<Check className="w-4 h-4" />}
            className="theme-btn-primary font-bold shadow-md cursor-pointer"
          >
            Confirmar e Aplicar Método
          </Button>
        </div>
      </div>
    </Modal>
  );
};
