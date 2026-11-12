import { tierLimits, type PlanMeta, type TierLimits } from './membership';

export type Tier2027 = 'sportsman' | 'pro' | 'factory';
// New catalog only. These are proposed USD prices, never live billing identifiers.
export const SUBSCRIPTION_2027: Record<Tier2027, { monthlyPrice: number; annualPrice: number | null; limits: TierLimits }> = {
  sportsman: { monthlyPrice: 4.99, annualPrice: null, limits: tierLimits.sportsman },
  pro: { monthlyPrice: 7.99, annualPrice: 60, limits: tierLimits.pro },
  factory: { monthlyPrice: 14.99, annualPrice: null, limits: tierLimits.factory },
};
export const PLANS_2027: PlanMeta[] = (['sportsman', 'pro', 'factory'] as const).map(tier => {
  const config = SUBSCRIPTION_2027[tier];
  const limits = config.limits;
  return {
    tier, displayName: tier === 'sportsman' ? 'Sportsman' : tier === 'pro' ? 'Pro' : 'Factory',
    priceDisplay: '$' + config.monthlyPrice.toFixed(2) + '/month',
    buttonText: 'Inspect permissions', recommended: tier === 'pro',
    badge: tier === 'pro' ? 'For solo racers' : undefined,
    description: tier === 'factory' ? 'Every class in your garage.' : 'One selected racing car class.',
    synopsis: [
      limits.maxCars === 'unlimited' ? 'Unlimited racing car classes' : 'One selected racing car class',
      limits.maxBaseSetups === 'unlimited' ? 'Unlimited base setups' : limits.maxBaseSetups + ' saved base setups',
      limits.maxRaceWeekendSetups === 'unlimited' ? 'Unlimited regular race setups' : limits.maxRaceWeekendSetups + ' active regular setup slots, including locked setups',
      limits.raceWeekendSetupLockHours === null ? 'No editing time limit' : 'Read-only after 48 hours; all values, notes and results remain visible',
      limits.onlyLapsEnabled ? 'Full OnlyLaps and telemetry access — coming with integration' : 'No OnlyLaps or advanced telemetry',
      limits.setupAssistsPerRaceWeekend === 'unlimited' ? 'Unlimited Setup Assist and timing scans' : '1 Setup Assist and 2 timing scans per race weekend',
      'No advertisements',
    ],
    supportingText: config.annualPrice === null ? 'Annual pricing to be determined.' : '$' + config.annualPrice.toFixed(0) + '/year',
  };
});
