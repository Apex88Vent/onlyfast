import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useMembershipRevision } from '@/hooks/useMembershipRevision';
import { traceRpc, trackTraceEnabled, type TrackTracePermission } from './api';

export function useTrackTraceIdentity() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    // Subscribe first so a late initial read cannot restore a signed-out user.
    let changed = false;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      changed = true;
      if (active) setUserId(session?.user.id ?? null);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (active && !changed) setUserId(data.session?.user.id ?? null);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  return userId;
}

export function useTrackTracePermission(userId: string | null) {
  const revision = useMembershipRevision();
  const permission = useQuery({
    queryKey: ['track_trace', 'permission', userId, revision],
    queryFn: () => traceRpc<TrackTracePermission>('get_track_trace_permission'),
    enabled: trackTraceEnabled && !!userId, staleTime: 0, gcTime: 0,
    refetchInterval: 30000, retry: false,
  });
  // Interpret both installed server contracts. Reading retained history does
  // not unlock the paid navigation or session preparation controls.
  const verified = !!userId && !permission.isError && permission.data?.feature === 'track_trace';
  const allowed = verified && (permission.data.can_read_history ?? permission.data.allowed) === true;
  const fullAccess = allowed && (permission.data.can_record ?? permission.data.allowed) === true;
  return { ...permission, revision, allowed, fullAccess, navigationLocked: verified && !fullAccess };
}
