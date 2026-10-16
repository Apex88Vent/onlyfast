import { supabase, supabaseUrl, supabaseKey } from '@/lib/supabase';

export interface ActiveClassState {
  active_class: string | null;
  tier: 'rookie' | 'pro' | 'team' | 'admin' | null;
  last_class_change_at: string | null;
  next_eligible_at: string | null;
  can_change: boolean;
  unlimited: boolean;
  active_discipline: string | null;
  onboarding_step: 'tutorial' | 'discipline' | 'vehicle' | 'plan' | 'complete';
  onboarding_discipline: string | null;
  onboarding_race_class: string | null;
}

const asState = (value: unknown): ActiveClassState => {
  const row = (Array.isArray(value) ? value[0] : value) as Partial<ActiveClassState> | null;
  return {
    active_class: row?.active_class || null,
    tier: row?.tier || null,
    last_class_change_at: row?.last_class_change_at || null,
    next_eligible_at: row?.next_eligible_at || null,
    can_change: row?.can_change !== false,
    unlimited: row?.unlimited === true,
    active_discipline: row?.active_discipline || null,
    onboarding_step: row?.onboarding_step || (row?.active_class ? 'complete' : 'tutorial'),
    onboarding_discipline: row?.onboarding_discipline || null,
    onboarding_race_class: row?.onboarding_race_class || null,
  };
};

// Bind mutations to the account that initiated the action. A login/account
// switch during an await must never apply the previous screen's selection to
// the new account. The captured JWT is used only for this request.
async function racingMutation(name: string, args: Record<string, unknown>, expectedUserId?: string) {
  if (!expectedUserId) return supabase.rpc(name, args);
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== expectedUserId) throw new Error('CLASS_AUTH_REQUIRED');
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: supabaseKey, Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Your racing selection could not be saved.');
  return { data: result, error: null };
}

export async function saveOnboardingProgress(step: 'discipline' | 'vehicle' | 'plan', discipline?: string, car?: string, expectedUserId?: string): Promise<ActiveClassState> {
  const { data, error } = await racingMutation('save_racing_onboarding_progress', {
    p_step: step, p_discipline: discipline || null, p_class: car || null,
  }, expectedUserId);
  if (error) throw error;
  return asState(data);
}

export async function completeRacingOnboarding(expectedUserId?: string): Promise<ActiveClassState> {
  const { data, error } = await racingMutation('complete_racing_onboarding', {}, expectedUserId);
  if (error) throw error;
  return asState(data);
}

export const sameClass = (a?: string | null, b?: string | null) =>
  (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

export async function getActiveClassState(): Promise<ActiveClassState> {
  const { data, error } = await supabase.rpc('get_active_race_class_state');
  if (error) {
    if (import.meta.env.DEV) console.error('[class-change] get state failed', { code: error.code, message: error.message });
    throw error;
  }
  return asState(data);
}

export async function initializeActiveClass(car: string): Promise<ActiveClassState> {
  const { data, error } = await supabase.rpc('initialize_active_race_class', { p_class: car });
  if (error) {
    if (import.meta.env.DEV) console.error('[class-change] initialize failed', { code: error.code, message: error.message });
    throw error;
  }
  return asState(data);
}

export async function changeActiveClass(car: string, expectedUserId?: string): Promise<ActiveClassState> {
  const { data, error } = await racingMutation('change_active_race_class', { p_new_class: car }, expectedUserId);
  if (error) {
    if (import.meta.env.DEV) console.error('[class-change] change failed', { code: error.code, message: error.message });
    throw error;
  }
  return asState(data);
}

export const formatEligibleDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};
