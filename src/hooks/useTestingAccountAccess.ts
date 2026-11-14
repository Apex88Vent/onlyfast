import { useEffect, useState } from 'react';
import { supabase, supabaseUrl } from '@/lib/supabase';
import { useMembershipRevision } from './useMembershipRevision';

export const is2027Testing = supabaseUrl === 'https://mfzajhnfonrfuiwxgvhe.supabase.co';
export type TestingAccountAccess = { tier: string; selection_required: boolean; active_class: string };

export function useTestingAccountAccess(userId?: string) {
  const revision = useMembershipRevision();
  const [access, setAccess] = useState<{ userId: string; value: TestingAccountAccess } | null>(null);
  useEffect(() => {
    if (!is2027Testing || !userId) { setAccess(null); return; }
    let active = true; let generation = 0;
    setAccess(null);
    const refresh = async () => {
      const request = ++generation;
      const session = (await supabase.auth.getSession()).data.session;
      if (session?.user.id !== userId) return;
      const result = await supabase.rpc('get_onlyfast_2027_account_access');
      const current = (await supabase.auth.getSession()).data.session;
      if (active && request === generation && current?.user.id === userId) {
        setAccess(result.error ? null : { userId, value: result.data });
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    const focus = () => { void refresh(); };
    window.addEventListener('focus', focus);
    return () => { active = false; generation++; clearInterval(timer); window.removeEventListener('focus', focus); };
  }, [userId, revision]);
  return access?.userId === userId ? access.value : null;
}

export function testingClassReadOnly(access: TestingAccountAccess | null, raceClass: string) {
  if (!access || access.tier === 'unsubscribed') return true;
  if (['factory', 'team', 'admin'].includes(access.tier)) return false;
  return access.selection_required || !raceClass.trim() || raceClass.trim().toLowerCase() !== access.active_class?.trim().toLowerCase();
}
