import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { supabase } from '@/lib/supabase';
import { failedRead, restoreStartupSession, startupRead } from '@/lib/startupRecovery';
import {
  buildBetaAccessSnapshot,
  clearCachedBetaAccess,
  CLOSED_BETA_ACCESS,
  setCachedBetaAccess,
  type BetaAccessSnapshot,
  type BetaTesterAccountRow,
  type UserFeatureFlagRow,
} from '@/lib/betaFeatures';
import {
  BetaFeaturesContext,
  type BetaFeaturesContextValue,
} from '@/contexts/betaFeaturesContextValue';

export const BetaFeaturesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [snapshot, setSnapshot] = useState<BetaAccessSnapshot>(CLOSED_BETA_ACCESS);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const requestNumber = useRef(0);
  const loadingFlags = useRef<{ userId: string; controller: AbortController }>();

  const closeBetaAccess = useCallback((nextLoading = false) => {
    clearCachedBetaAccess();
    setSnapshot(CLOSED_BETA_ACCESS);
    setLoading(nextLoading);
  }, []);

  const loadForUser = useCallback(async (userId: string | null) => {
    if (loadingFlags.current?.userId === userId) return;
    loadingFlags.current?.controller.abort();
    loadingFlags.current = undefined;
    const requestId = ++requestNumber.current;

    if (!userId) {
      closeBetaAccess(false);
      return;
    }

    // Revalidation also fails closed: stale beta permission is never retained
    // while a fresh authorization lookup is in flight.
    closeBetaAccess(true);
    const controller = new AbortController();
    loadingFlags.current = { userId, controller };

    try {
      const [accountResult, flagsResult] = await startupRead('feature-flags', async signal => {
        const [account, flags] = await Promise.all([
          supabase
            .from('beta_tester_accounts')
            .select('user_id, is_test_account, beta_features_enabled, tester_kind')
            .eq('user_id', userId)
            .retry(false)
            .abortSignal(signal)
            .maybeSingle(),
          supabase
            .from('user_feature_flags')
            .select('feature_key, enabled')
            .eq('user_id', userId)
            .eq('enabled', true)
            .retry(false)
            .abortSignal(signal),
        ]);
        if (account.error) throw failedRead(account.error, account.status);
        if (flags.error) throw failedRead(flags.error, flags.status);
        return [account, flags] as const;
      }, controller.signal);

      if (requestId !== requestNumber.current) return;
      const nextSnapshot = buildBetaAccessSnapshot(
        accountResult.data as BetaTesterAccountRow | null,
        (flagsResult.data || []) as UserFeatureFlagRow[],
      );
      setCachedBetaAccess(nextSnapshot);
      setSnapshot(nextSnapshot);
    } catch {
      if (controller.signal.aborted || requestId !== requestNumber.current) return;
      closeBetaAccess(false);
    } finally {
      if (requestId === requestNumber.current) {
        loadingFlags.current = undefined;
        setLoading(false);
      }
    }
  }, [closeBetaAccess]);

  const refreshBetaFeatures = useCallback(async () => {
    await loadForUser(currentUserId);
  }, [currentUserId, loadForUser]);

  useEffect(() => {
    let active = true;
    let revision = 0;
    const controller = new AbortController();

    const initial = revision;
    void restoreStartupSession(supabase.auth, controller.signal)
      .then(session => {
        if (!active || initial !== revision) return;
        const userId = session?.user?.id ?? null;
        setCurrentUserId(userId);
        void loadForUser(userId);
      })
      .catch(() => {
        if (!active || initial !== revision) return;
        setCurrentUserId(null);
        closeBetaAccess(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || (event === 'INITIAL_SESSION' && !session)) return;
      revision++;
      const userId = session?.user?.id ?? null;
      setCurrentUserId(userId);
      void loadForUser(userId);
    });

    return () => {
      active = false;
      controller.abort();
      requestNumber.current += 1;
      loadingFlags.current?.controller.abort();
      loadingFlags.current = undefined;
      subscription.unsubscribe();
      clearCachedBetaAccess();
    };
  }, [closeBetaAccess, loadForUser]);

  useEffect(() => {
    if (!currentUserId) return;

    const reload = () => {
      void loadForUser(currentUserId);
    };
    const channel = supabase
      .channel(`beta-features:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'beta_tester_accounts',
          filter: `user_id=eq.${currentUserId}`,
        },
        reload,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_feature_flags',
          filter: `user_id=eq.${currentUserId}`,
        },
        reload,
      )
      .subscribe();

    const onFocus = () => reload();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') reload();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, loadForUser]);

  const enabledFeatureSet = useMemo(
    () => new Set(snapshot.enabledFeatures),
    [snapshot.enabledFeatures],
  );
  const hasBetaFeature = useCallback(
    (featureName: string) =>
      snapshot.betaFeaturesEnabled && enabledFeatureSet.has(featureName),
    [enabledFeatureSet, snapshot.betaFeaturesEnabled],
  );
  const betaIndicatorLabel =
    snapshot.enabledFeatures.length === 0
      ? null
      : snapshot.testerKind === 'experimental'
        ? 'Beta Test Account'
        : snapshot.testerKind === 'personal'
          ? 'Beta Features'
          : null;

  const value = useMemo<BetaFeaturesContextValue>(
    () => ({
      ...snapshot,
      loading,
      hasBetaFeature,
      refreshBetaFeatures,
      betaIndicatorLabel,
    }),
    [
      betaIndicatorLabel,
      hasBetaFeature,
      loading,
      refreshBetaFeatures,
      snapshot,
    ],
  );

  return (
    <BetaFeaturesContext.Provider value={value}>
      {children}
    </BetaFeaturesContext.Provider>
  );
};
