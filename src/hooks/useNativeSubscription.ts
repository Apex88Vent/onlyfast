import { useEffect, useRef, useState } from 'react';
import { fetchUserSubscription, deriveAccountStatus, syncMembershipFromSubscription, type AccountStatus } from '@/lib/subscription';
import { nativePurchases, nativePurchasesEnabled, syncNativeSubscription } from '@/lib/nativePurchases';
import { NativePurchaseError } from '@/lib/nativePurchaseController';
import { supabase } from '@/lib/supabase';

async function loadStatus(userId: string) {
  const initial = await supabase.auth.getSession();
  if (initial.data.session?.user.id !== userId) throw new Error('Your account changed. Please try again.');
  const status = await syncMembershipFromSubscription();
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id !== userId || !status) throw new Error('Your account changed. Please try again.');
  return status;
}

export function useNativeSubscription(userId: string, { onVerified }: {
  onVerified?: () => void | Promise<void>;
} = {}) {
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState(false);
  const generation = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    const revision = ++generation.current;
    const generationRef = generation;
    setAccount(null); setMessage(''); setBusy(false); setLoadError(false);
    const refresh = async () => {
      try {
        const status = await loadStatus(userId);
        if (generation.current === revision) { setAccount(status); setLoadError(false); }
      } catch { if (generation.current === revision) setLoadError(true); }
    };
    void refresh();
    window.addEventListener('subscription-updated', refresh);
    window.addEventListener('membership-updated', refreshDisplay);
    function refreshDisplay() {
      // The lifecycle has already refreshed trusted membership. Reading it again
      // through loadStatus would publish another event and recurse indefinitely.
      void supabase.auth.getSession().then(({ data }) => {
        if (generation.current === revision && data.session?.user.id === userId) {
          setAccount(current => current ? deriveAccountStatus(current.row) : null);
          void fetchUserSubscription(userId).then(async row => {
            const current = await supabase.auth.getSession();
            if (generation.current === revision && current.data.session?.user.id === userId) setAccount(deriveAccountStatus(row));
          }).catch(() => {});
        } else if (generation.current === revision) setAccount(null);
      }).catch(() => {});
    }
    return () => { generationRef.current++; window.removeEventListener('subscription-updated', refresh); window.removeEventListener('membership-updated', refreshDisplay); };
  }, [userId]);

  const run = async (action: 'purchase' | 'restore' | 'refresh') => {
    if (action !== 'refresh' && !nativePurchasesEnabled) return;
    if (pending.current) return;
    pending.current = true;
    const revision = generation.current;
    setBusy(true); setMessage('');
    try {
      if (action !== 'refresh') {
        // Recheck the database immediately before presenting a paid offer.
        const existing = await loadStatus(userId);
        const { data: session } = await supabase.auth.getSession();
        if (generation.current !== revision || session.session?.user.id !== userId) return;
        if (action === 'purchase' && existing.isPaid) {
          setAccount(existing);
          setMessage('Your paid membership is already active. Manage changes through your current subscription provider.');
          return;
        }
        await nativePurchases.setUser(userId);
        if (generation.current !== revision) return;
        await nativePurchases.run(userId, action);
      }
      if (nativePurchasesEnabled || account?.row?.subscription_source === 'revenuecat') await syncNativeSubscription(userId);
      const status = await loadStatus(userId);
      if (generation.current !== revision) return;
      setAccount(status); setLoadError(false);
      if (status.isPaid && action !== 'refresh') await onVerified?.();
      setMessage(status.isPaid ? 'Your subscription is active.' : action === 'restore' ?
        'No active store subscription was found for this account. Check your store account and OnlyFast login.' :
        'No active subscription is confirmed yet. If you purchased, refresh in a moment.');
    } catch (error) {
      if (generation.current === revision) setMessage(error instanceof NativePurchaseError && error.cancelled ?
        'Purchase cancelled.' : error instanceof Error ? error.message : 'Unable to complete the request. Please try again.');
    } finally { pending.current = false; if (generation.current === revision) setBusy(false); }
  };

  return { account, busy, message, loadError, run };
}
