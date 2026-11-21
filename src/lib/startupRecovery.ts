import type { Session, SupabaseClient } from '@supabase/supabase-js';

const readDeadlineMs = 5000;
const retryDelayMs = 350;

export type StartupStage = 'session' | 'session-user' | 'feature-flags' | 'racing-profile' | 'saved-class'
  | 'dashboard-setups' | 'dashboard-schedule' | 'dashboard-render' | 'testing-environment' | 'app-entry'
  | 'feature-module' | 'feature-render';

export class StartupTimeout extends Error {}

export function failedRead(error: unknown, status: number) {
  return { status, code: (error as { code?: unknown } | null)?.code };
}

export function isRejectedSession(error: unknown) {
  const { status, name } = (error || {}) as { status?: number; name?: string };
  return status === 400 || status === 401 || status === 403 || status === 404 || name === 'AuthSessionMissingError';
}

export function isTransientStartupError(error: unknown) {
  const { status, name, code } = (error || {}) as { status?: number; name?: string; code?: string };
  return error instanceof StartupTimeout || error instanceof TypeError || name === 'AuthRetryableFetchError' ||
    status === 0 || status === 408 || status === 429 || (typeof status === 'number' && status >= 500) ||
    code === '57014';
}

export function logStartupFailure(stage: StartupStage, error: unknown, attempt = 1) {
  const { status, code } = (error || {}) as { status?: number; code?: string };
  // Deliberately omit messages, stacks, URLs, and auth/account information.
  console.warn('[onlyfast.startup]', {
    build: import.meta.env?.ONLYFAST_BUILD_VERSION || 'local',
    stage,
    attempt,
    kind: error instanceof StartupTimeout ? 'timeout' : isTransientStartupError(error) ? 'transient' : 'failed',
    ...(typeof status === 'number' && status >= 0 && status <= 599 ? { status } : {}),
    ...(typeof code === 'string' && /^(?:PGRST\d{3}|[0-9]{2}[0-9A-Z]{3})$/.test(code) ? { code } : {}),
  });
}

function abortable<T>(signal: AbortSignal, operation: () => PromiseLike<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    void Promise.resolve().then(() => {
      if (signal.aborted) throw signal.reason;
      return operation();
    }).then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}

// Read-only operations can retry once. Each timed-out transport receives its own
// abort signal, and superseded attempts cannot publish results to the UI.
export async function startupRead<T>(
  stage: StartupStage,
  read: (signal: AbortSignal) => PromiseLike<T>,
  signal?: AbortSignal,
  { deadline = readDeadlineMs, delay = retryDelayMs } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    if (signal?.aborted) throw signal.reason;
    const request = new AbortController();
    const cancel = () => request.abort(signal?.reason);
    signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => request.abort(new StartupTimeout()), deadline);
    try {
      return await abortable(request.signal, () => read(request.signal));
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      logStartupFailure(stage, error, attempt);
      if (attempt >= 2 || !isTransientStartupError(error)) throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

export function watchStartupResume(resume: () => void) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  const onResume = () => { if (document.visibilityState !== 'hidden') resume(); };
  window.addEventListener('pageshow', onResume);
  window.addEventListener('online', onResume);
  window.addEventListener('focus', onResume);
  document.addEventListener('visibilitychange', onResume);
  return () => {
    window.removeEventListener('pageshow', onResume);
    window.removeEventListener('online', onResume);
    window.removeEventListener('focus', onResume);
    document.removeEventListener('visibilitychange', onResume);
  };
}

// GoTrue owns refresh-token rotation and may retry internally. Bound each of
// its restoration/verification transports so a suspended socket cannot hold
// that SDK state indefinitely. Other Auth, database, and billing calls are unchanged.
export function withSessionFetchDeadline(fetcher: typeof fetch): typeof fetch {
  return async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const source = typeof Request !== 'undefined' && input instanceof Request ? input : undefined;
    const method = init?.method || source?.method || 'GET';
    const refresh = url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token';
    if (!refresh && (url.pathname !== '/auth/v1/user' || method !== 'GET')) return fetcher(input, init);

    const external = init?.signal ?? source?.signal;
    const request = new AbortController();
    const cancel = () => request.abort(external?.reason);
    if (external?.aborted) cancel();
    else external?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => request.abort(new StartupTimeout()), readDeadlineMs);
    try {
      return await fetcher(input, { ...init, signal: request.signal });
    } finally {
      clearTimeout(timer);
      external?.removeEventListener('abort', cancel);
    }
  };
}

export const isExpired = (session: Session) =>
  typeof session.expires_at === 'number' && session.expires_at <= Date.now() / 1000;

type StartupAuth = Pick<SupabaseClient['auth'], 'getSession'>;
const sessionsInFlight = new WeakMap<StartupAuth, Promise<Session | null>>();

// The SDK owns token rotation. A timed-out caller can stop waiting, but must
// never start a competing refresh while the SDK is still restoring a session.
export function restoreStartupSession(auth: StartupAuth, signal?: AbortSignal) {
  return startupRead('session', () => {
    const pending = sessionsInFlight.get(auth);
    if (pending) return pending;
    const request = auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      return data.session && !isExpired(data.session) ? data.session : null;
    }).finally(() => sessionsInFlight.delete(auth));
    sessionsInFlight.set(auth, request);
    return request;
  }, signal);
}
