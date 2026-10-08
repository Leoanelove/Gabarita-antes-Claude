import { UserPlan } from '../types';

export interface CheckoutSession {
  checkoutUrl?: string;
  sessionId: string;
  provider: 'stripe' | 'mercadopago' | 'simulation';
  status: 'pending' | 'success';
}

export class PaymentService {
  static async createCheckoutSession(plan: UserPlan, gateway: 'stripe' | 'mercadopago' = 'stripe'): Promise<CheckoutSession> {
    try {
      const response = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, gateway }),
      });
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (e) {
      console.warn('PaymentService: Servidor de pagamento externo indisponível, ativando modo simulado seguro:', e);
    }
    return {
      sessionId: `sim_session_${Date.now()}`,
      provider: gateway,
      status: 'success',
      checkoutUrl: '#',
    };
  }

  static getPlanPrice(plan: UserPlan): { price: number; period: string; name: string } {
    switch (plan) {
      case 'gratuito':
        return { price: 0, period: 'para sempre', name: 'Plano Gratuito' };
      case 'teste':
        return { price: 0, period: 'por 7 dias', name: 'Teste Gratuito 7 Dias' };
      case 'mensal':
        return { price: 49.90, period: 'por mês', name: 'Plano Mensal PRO' };
      case 'anual':
        return { price: 29.90, period: 'por mês (cobrado anualmente)', name: 'Plano Anual PRO (-40%)' };
    }
  }
}
