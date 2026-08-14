import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { supabase } from '@/lib/supabase';
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

  const closeBetaAccess = useCallback((nextLoading = false) => {
    clearCachedBetaAccess();
    setSnapshot(CLOSED_BETA_ACCESS);
    setLoading(nextLoading);
  }, []);

  const loadForUser = useCallback(async (userId: string | null) => {
    const requestId = ++requestNumber.current;

    if (!userId) {
      closeBetaAccess(false);
      return;
    }

    // Revalidation also fails closed: stale beta permission is never retained
    // while a fresh authorization lookup is in flight.
    closeBetaAccess(true);

    try {
      const [accountResult, flagsResult] = await Promise.all([
        supabase
          .from('beta_tester_accounts')
          .select('user_id, is_test_account, beta_features_enabled, tester_kind')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('user_feature_flags')
          .select('feature_key, enabled')
          .eq('user_id', userId)
          .eq('enabled', true),
      ]);

      if (requestId !== requestNumber.current) return;
      if (accountResult.error) throw accountResult.error;
      if (flagsResult.error) throw flagsResult.error;

      const nextSnapshot = buildBetaAccessSnapshot(
        accountResult.data as BetaTesterAccountRow | null,
        (flagsResult.data || []) as UserFeatureFlagRow[],
      );
      setCachedBetaAccess(nextSnapshot);
      setSnapshot(nextSnapshot);
    } catch (error) {
      if (requestId !== requestNumber.current) return;
      closeBetaAccess(false);
      // Useful in development, while the normal production experience remains
      // fully usable if the migration/network is unavailable.
      console.error('[beta-features] Failed to load account feature flags; using production defaults.', error);
    } finally {
      if (requestId === requestNumber.current) setLoading(false);
    }
  }, [closeBetaAccess]);

  const refreshBetaFeatures = useCallback(async () => {
    await loadForUser(currentUserId);
  }, [currentUserId, loadForUser]);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        const userId = data.session?.user?.id ?? null;
        setCurrentUserId(userId);
        void loadForUser(userId);
      })
      .catch((error) => {
        if (!active) return;
        setCurrentUserId(null);
        closeBetaAccess(false);
        console.error('[beta-features] Failed to read the authenticated session; using production defaults.', error);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const userId = session?.user?.id ?? null;
      setCurrentUserId(userId);
      void loadForUser(userId);
    });

    return () => {
      active = false;
      requestNumber.current += 1;
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
