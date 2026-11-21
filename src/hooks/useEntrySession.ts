import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { isExpired, isRejectedSession, restoreStartupSession, startupRead, watchStartupResume } from '@/lib/startupRecovery';

// This decides which UI to show. Existing server authorization and membership
// checks still decide what the user can read, write, or purchase.
export function useEntrySession() {
  const retryRef = useRef(() => {});
  const [state, setState] = useState<{
    session: Session | null;
    checking: boolean;
    error: boolean;
    recovery: boolean;
  }>({ session: null, checking: true, error: false, recovery: false });
  useEffect(() => {
    let active = true;
    let revision = 0;
    let validationTimer: ReturnType<typeof setTimeout> | undefined;
    let validation: AbortController | undefined;
    const restoreController = new AbortController();
    let restoring = false;
    let retryNeeded = false;
    let validated: Session | null = null;
    const userReads = new Map<string, ReturnType<typeof supabase.auth.getUser>>();
    const update = (candidate: Session | null, recovery = false, failure: unknown = null) => {
      const request = ++revision;
      clearTimeout(validationTimer);
      validation?.abort();
      if (!candidate || isExpired(candidate)) {
        retryNeeded = Boolean(failure) && !isRejectedSession(failure);
        validated = null;
        setState(previous => ({
          session: null, checking: false,
          error: Boolean(failure) && !isRejectedSession(failure),
          recovery: previous.recovery || recovery,
        }));
        return;
      }
      const controller = new AbortController();
      validation = controller;
      setState(previous => {
        // Keep an already verified user's editor mounted while a fresh token
        // for that same identity is checked. Server authorization still applies.
        const keep = previous.session?.user.id === candidate.user.id;
        return {
          session: keep ? previous.session : null, checking: !keep && !recovery,
          error: false, recovery: previous.recovery || recovery,
        };
      });
      // Supabase auth listeners must return before calling more auth methods.
      validationTimer = setTimeout(() => {
        void (async () => {
          try {
            const token = candidate.access_token;
            const user = await startupRead('session-user', async () => {
              let pending = userReads.get(token);
              if (!pending) {
                pending = supabase.auth.getUser(token).finally(() => userReads.delete(token));
                userReads.set(token, pending);
              }
              const { data, error } = await pending;
              if (error) throw error;
              return data.user;
            }, controller.signal);
            if (!active || request !== revision) return;
            validated = user?.id === candidate.user.id && !isExpired(candidate) ? candidate : null;
            retryNeeded = false;
            const accepted = validated;
            setState(previous => ({ session: accepted, checking: false, error: false, recovery: previous.recovery }));
          } catch (error) {
            if (!active || request !== revision) return;
            retryNeeded = !isRejectedSession(error);
            const keep = retryNeeded && validated?.user.id === candidate.user.id;
            if (!keep) validated = null;
            const retained = validated;
            const failed = retryNeeded && !keep;
            setState(previous => ({
              session: retained, checking: false, error: failed, recovery: previous.recovery,
            }));
          }
        })();
      }, 0);
    };
    const restore = () => {
      if (!active || restoring) return;
      const initial = revision;
      restoring = true;
      setState(previous => previous.error ? { ...previous, checking: true, error: false } : previous);
      void restoreStartupSession(supabase.auth, restoreController.signal)
        .then(session => { if (active && revision === initial) update(session); })
        .catch(error => {
          if (!active || revision !== initial) return;
          if (validated && !isRejectedSession(error)) retryNeeded = true;
          else update(null, false, error);
        })
        .finally(() => { restoring = false; });
    };
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || (event === 'INITIAL_SESSION' && !session)) return;
      update(session, event === 'PASSWORD_RECOVERY');
    });
    retryRef.current = restore;
    const stopResume = watchStartupResume(() => { if (retryNeeded || (validated && isExpired(validated))) restore(); });
    restore();
    return () => {
      active = false;
      revision++;
      clearTimeout(validationTimer);
      validation?.abort();
      restoreController.abort();
      stopResume();
      retryRef.current = () => {};
      subscription.unsubscribe();
    };
  }, []);
  return { ...state, retry: () => retryRef.current() };
}
