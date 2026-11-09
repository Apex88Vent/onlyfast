import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      revision++;
      setState((previous) => ({
        session,
        checking: false,
        error: false,
        recovery: previous.recovery || event === 'PASSWORD_RECOVERY',
      }));
    });
    const initial = revision;
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || revision !== initial) return;
        setState({
          session: data.session,
          checking: false,
          error: Boolean(error),
          recovery: false,
        });
      })
      .catch(() => {
        if (active && revision === initial)
          setState({ session: null, checking: false, error: true, recovery: false });
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  return state;
}
