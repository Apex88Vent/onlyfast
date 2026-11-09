import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

function isRejectedSession(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { status, name } = error as { status?: number; name?: string };
  return status === 400 || status === 401 || status === 403 || status === 404 ||
    name === 'AuthSessionMissingError';
}

const isExpired = (session: Session) =>
  typeof session.expires_at === 'number' && session.expires_at <= Date.now() / 1000;

// This decides which UI to show. Existing server authorization and membership
// checks still decide what the user can read, write, or purchase.
export function useEntrySession() {
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
    const update = (candidate: Session | null, recovery = false, failure: unknown = null) => {
      const request = ++revision;
      clearTimeout(validationTimer);
      if (!candidate || isExpired(candidate)) {
        setState(previous => ({
          session: null, checking: false,
          error: Boolean(failure) && !isRejectedSession(failure),
          recovery: previous.recovery || recovery,
        }));
        return;
      }
      setState(previous => {
        // A routine token refresh must not unmount the open app/unsaved editor
        // while the previously validated token is still current and unexpired.
        const keep = previous.session?.user.id === candidate.user.id && !isExpired(previous.session);
        return {
          session: keep ? previous.session : null, checking: !keep && !recovery,
          error: false, recovery: previous.recovery || recovery,
        };
      });
      // Supabase auth listeners must return before calling more auth methods.
      validationTimer = setTimeout(() => {
        void (async () => {
          try {
            const { data, error } = await supabase.auth.getUser(candidate.access_token);
            if (!active || request !== revision) return;
            const valid = !error && data.user?.id === candidate.user.id && !isExpired(candidate);
            setState(previous => {
              const transient = Boolean(error) && !isRejectedSession(error);
              const keep = transient && previous.session && !isExpired(previous.session);
              return {
                session: valid ? candidate : keep ? previous.session : null, checking: false,
                error: transient && !keep, recovery: previous.recovery,
              };
            });
          } catch (error) {
            if (active && request === revision) setState(previous => {
              const transient = !isRejectedSession(error);
              const keep = transient && previous.session && !isExpired(previous.session);
              return {
                session: keep ? previous.session : null, checking: false,
                error: transient && !keep, recovery: previous.recovery,
              };
            });
          }
        })();
      }, 0);
    };
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      update(session, event === 'PASSWORD_RECOVERY');
    });
    const initial = revision;
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || revision !== initial) return;
        update(data.session, false, error);
      })
      .catch(() => {
        if (active && revision === initial) update(null, false, new Error('Session check failed'));
      });
    return () => {
      active = false;
      revision++;
      clearTimeout(validationTimer);
      subscription.unsubscribe();
    };
  }, []);
  return state;
}
