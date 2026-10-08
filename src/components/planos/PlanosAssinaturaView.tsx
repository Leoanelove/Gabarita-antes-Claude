import React, { useState } from 'react';
import { Crown, CheckCircle2, Check } from 'lucide-react';
import { UserProfile, UserPlan } from '../../types';
import { FeatureGate } from '../../utils/featureGate';
import { PaymentService } from '../../services/paymentService';
import { Card, CardBody } from '../../design-system/Card';
import { Button } from '../../design-system/Button';
import { Badge } from '../../design-system/Badge';

interface PlanosAssinaturaViewProps {
  user: UserProfile;
  onUpdateSubscription: (plan: UserPlan) => Promise<void>;
}

export const PlanosAssinaturaView: React.FC<PlanosAssinaturaViewProps> = ({
  user,
  onUpdateSubscription,
}) => {
  const currentPlan = FeatureGate.getUserPlan(user);
  const [selectedGateway, setSelectedGateway] = useState<'stripe' | 'mercadopago'>('stripe');
  const [isProcessing, setIsProcessing] = useState<UserPlan | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubscribe = async (plan: UserPlan) => {
    setIsProcessing(plan);
    setSuccessMessage(null);
    try {
      await PaymentService.createCheckoutSession(plan, selectedGateway);
      await onUpdateSubscription(plan);
      setSuccessMessage(`Parabéns! Você ativou com sucesso o ${PaymentService.getPlanPrice(plan).name}.`);
    } catch (e) {
      console.error('Erro na assinatura:', e);
    } finally {
      setIsProcessing(null);
    }
  };

  const plansList = [
    {
      id: 'gratuito' as UserPlan,
      name: 'Plano Gratuito',
      price: 'R$ 0',
      period: 'para sempre',
      description: 'Ideal para iniciar seus estudos.',
      features: ['1 Concurso Ativo', 'Edital verticalizado básico', 'Registro de sessões'],
      badge: 'Atual',
      badgeVariant: 'slate' as const,
      highlight: false,
    },
    {
      id: 'teste' as UserPlan,
      name: 'Teste Gratuito (7 Dias)',
      price: 'R$ 0',
      period: 'por 7 dias',
      description: 'Experimente recursos PRO.',
      features: ['Concursos ilimitados', 'Edital por IA', 'Assistente IA Ilimitado'],
      badge: 'Grátis',
      badgeVariant: 'sky' as const,
      highlight: false,
    },
    {
      id: 'mensal' as UserPlan,
      name: 'Plano Mensal PRO',
      price: 'R$ 49,90',
      period: 'por mês',
      description: 'Flexibilidade para preparação.',
      features: ['Tudo do Teste', 'Assistente prioritário', 'Relatórios e exportação'],
      badge: 'Popular',
      badgeVariant: 'purple' as const,
      highlight: false,
    },
    {
      id: 'anual' as UserPlan,
      name: 'Plano Anual PRO',
      price: 'R$ 29,90',
      period: 'por mês (anual)',
      description: 'Melhor custo-benefício.',
      features: ['Economia de 40%', 'Recursos PRO ilimitados', 'Suporte dedicado'],
      badge: '-40%',
      badgeVariant: 'emerald' as const,
      highlight: true,
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 animate-fade-in">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <Badge variant="purple" size="md">
          <Crown className="w-3.5 h-3.5 inline mr-1" /> Assinatura & Planos
        </Badge>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
          Escolha o plano ideal para a sua aprovação
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Desbloqueie inteligência artificial avançada e editais ilimitados.
        </p>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 max-w-xl mx-auto">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plansList.map(plan => {
          const isCurrent = currentPlan === plan.id;
          return (
            <Card
              key={plan.id}
              className={`plano-card relative flex flex-col justify-between overflow-hidden transition-all duration-300 ${
                plan.highlight ? 'plano-highlight border-2 border-emerald-500 shadow-xl' : ''
              }`}
            >
              <CardBody className="p-6 space-y-5 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base text-slate-900 dark:text-white dark:drop-shadow-[0_2px_8px_rgba(255,255,255,0.1)]">
                      {plan.name}
                    </h3>
                    <Badge variant={plan.badgeVariant} size="sm" className="plano-badge font-bold">
                      {plan.badge}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight dark:drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]">
                      {plan.price}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                      {plan.period}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{plan.description}</p>
                  <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200">
                        <Check className="w-4 h-4 text-emerald-500 dark:text-[var(--primary-color)] shrink-0 mt-0.5 dark:drop-shadow-[0_0_6px_var(--primary-color)]" />
                        <span className="leading-tight">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-6">
                  {isCurrent ? (
                    <Button variant="outline" className="w-full plano-btn-current" disabled>
                      Plano Atual
                    </Button>
                  ) : (
                    <Button
                      variant={plan.highlight ? 'primary' : 'outline'}
                      className={`w-full plano-btn-action ${plan.highlight ? 'plano-btn-highlight' : ''}`}
                      isLoading={isProcessing === plan.id}
                      onClick={() => handleSubscribe(plan.id)}
                    >
                      {plan.id === 'gratuito' ? 'Selecionar' : 'Assinar Agora'}
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
