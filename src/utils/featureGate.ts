import { UserProfile, UserPlan } from '../types';

export interface PlanLimits {
  maxConcursos: number;
  unlimitedEditalParser: boolean;
  unlimitedAIAssistant: boolean;
  advancedAnalytics: boolean;
  unlimitedSimulados: boolean;
}

export const PLAN_LIMITS: Record<UserPlan, PlanLimits> = {
  gratuito: {
    maxConcursos: 1,
    unlimitedEditalParser: false,
    unlimitedAIAssistant: false,
    advancedAnalytics: false,
    unlimitedSimulados: false,
  },
  teste: {
    maxConcursos: 999,
    unlimitedEditalParser: true,
    unlimitedAIAssistant: true,
    advancedAnalytics: true,
    unlimitedSimulados: true,
  },
  mensal: {
    maxConcursos: 999,
    unlimitedEditalParser: true,
    unlimitedAIAssistant: true,
    advancedAnalytics: true,
    unlimitedSimulados: true,
  },
  anual: {
    maxConcursos: 999,
    unlimitedEditalParser: true,
    unlimitedAIAssistant: true,
    advancedAnalytics: true,
    unlimitedSimulados: true,
  },
};

export class FeatureGate {
  static getUserPlan(user?: UserProfile): UserPlan {
    const sub = user?.subscription;
    if (!sub) return 'gratuito';
    if (sub.status === 'expirado' || sub.status === 'cancelado') return 'gratuito';
    if (sub.status === 'trial' && new Date(sub.expiresAt) < new Date()) return 'gratuito';
    return sub.plan || 'gratuito';
  }

  static checkLimit(user: UserProfile | undefined, featureKey: keyof PlanLimits): boolean | number {
    const plan = FeatureGate.getUserPlan(user);
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.gratuito;
    return limits[featureKey];
  }

  static isPremium(user: UserProfile | undefined): boolean {
    const plan = FeatureGate.getUserPlan(user);
    return plan !== 'gratuito';
  }
}
