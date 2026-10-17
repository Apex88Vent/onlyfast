/** App-wide membership refresh, independent of whether new purchases are held. */
export interface MembershipLifecycleSource {
  session(): Promise<string | null>;
  onAuthChange(listener: (userId: string | null) => void): () => void;
  clear(userId: string | null): void;
  refresh(userId: string): Promise<void>;
  expiresAt(): number | null;
  onExpiration(): void;
}

export function watchMembershipLifecycle(source: MembershipLifecycleSource, host: Window, page: Document): () => void {
  let active = true;
  let userId: string | null = null;
  let revision = 0;
  let refreshing = false;
  let requested = false;
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;

  const refresh = async () => {
    if (!active || !userId) return;
    requested = true;
    if (refreshing) return;
    refreshing = true;
    try {
      while (active && requested && userId) {
        requested = false;
        const id = userId;
        const generation = revision;
        try {
          await source.refresh(id);
        } catch { /* Offline never creates paid access; retry on resume/online/manual refresh. */ }
        finally {
          if (active && generation === revision) {
            clearTimeout(expiryTimer);
            const expires = source.expiresAt();
            if (expires !== null && expires > Date.now()) {
              expiryTimer = setTimeout(() => { source.onExpiration(); void refresh(); }, Math.min(expires - Date.now() + 50, 2_147_483_647));
            }
          }
        }
      }
    } finally { refreshing = false; }
  };
  const update = (next: string | null) => {
    if (!active) return;
    revision++;
    userId = next;
    source.clear(next);
    clearTimeout(expiryTimer);
    // Supabase auth callbacks must return before invoking more auth methods.
    setTimeout(() => { if (active) void refresh(); }, 0);
  };
  const unsubscribe = source.onAuthChange(update);
  const initialRevision = revision;
  void source.session().then(id => {
    if (active && initialRevision === revision) update(id);
  }).catch(() => {});
  const resume = () => { if (page.visibilityState === 'visible') void refresh(); };
  const changed = () => { void refresh(); };
  page.addEventListener('visibilitychange', resume);
  host.addEventListener('focus', resume);
  host.addEventListener('online', resume);
  host.addEventListener('subscription-updated', changed);
  return () => {
    active = false;
    revision++;
    clearTimeout(expiryTimer);
    unsubscribe();
    page.removeEventListener('visibilitychange', resume);
    host.removeEventListener('focus', resume);
    host.removeEventListener('online', resume);
    host.removeEventListener('subscription-updated', changed);
    source.clear(null);
  };
}
