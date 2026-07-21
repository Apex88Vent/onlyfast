import { supabase } from '@/lib/supabase';

export interface ActiveClassState {
  active_class: string | null;
  tier: 'rookie' | 'pro' | 'team' | 'admin' | null;
  last_class_change_at: string | null;
  next_eligible_at: string | null;
  can_change: boolean;
  unlimited: boolean;
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
  };
};

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

export async function changeActiveClass(car: string): Promise<ActiveClassState> {
  const { data, error } = await supabase.rpc('change_active_race_class', { p_new_class: car });
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
