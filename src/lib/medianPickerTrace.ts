const TRACE_STORAGE_KEY = 'onlyfast_median_picker_trace_v1';
const TRACE_ENABLED_KEY = 'onlyfast_median_picker_trace_enabled_v1';
const PREVIOUS_DOCUMENT_KEY = 'onlyfast_median_picker_trace_document_v1';
const TRACE_UPDATED_EVENT = 'onlyfast-median-picker-trace-updated';
const MAX_TRACE_EVENTS = 180;

type TraceScalar = string | number | boolean | null;

export interface MedianPickerTraceRecord {
  sequence: number;
  timestamp: string;
  documentInstanceId: string;
  event: string;
  pathname: string;
  visibilityState: string;
  pickerActive: boolean;
  details?: Record<string, TraceScalar>;
}

const ALLOWED_DETAIL_KEYS = new Set([
  'source',
  'eventType',
  'sameAuthenticatedUser',
  'authenticated',
  'identityChanged',
  'authChecked',
  'authLoading',
  'entryGateOpen',
  'entryGateChecked',
  'splashVisible',
  'authenticatedAppVisible',
  'appLayoutMounted',
  'setupDashboardMounted',
  'scanTimingMounted',
  'activeSubscriptions',
  'clientInstances',
  'view',
  'previousView',
  'destinationView',
  'destinationPathname',
  'reason',
  'stateLoaded',
  'resumeAttempted',
  'hasSavedRoute',
  'savedRouteView',
  'hasSetup',
  'hasSession',
  'activeSessionSlot',
  'step',
  'fileCount',
  'processingStarted',
  'success',
  'cancelled',
  'blocked',
  'persisted',
  'documentChanged',
  'previousDocumentInstanceId',
  'currentDocumentInstanceId',
  'existingCallback',
  'scrollY',
]);

const makeDocumentInstanceId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
};

const documentInstanceId = makeDocumentInstanceId();
let previousDocumentInstanceId: string | null = null;
let globalTraceInstalled = false;
let activeAuthSubscriptions = 0;
let liveTraceContext: Record<string, TraceScalar> = {};

export const didMedianPickerDocumentChange = (
  previousId: string | null,
  currentId: string,
) => Boolean(previousId && previousId !== currentId);

const canUseSessionStorage = () => typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';

const readPickerActive = () => {
  if (typeof window === 'undefined') return false;
  try {
    const traceWindow = window as Window & { __onlyfastFilePickerOpen?: boolean };
    return Boolean(traceWindow.__onlyfastFilePickerOpen) ||
      localStorage.getItem('onlyfast_file_picker_active') === 'true';
  } catch {
    return false;
  }
};

const readRecords = (): MedianPickerTraceRecord[] => {
  if (!canUseSessionStorage()) return [];
  try {
    const raw = sessionStorage.getItem(TRACE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const sanitizeDetails = (details?: Record<string, TraceScalar>) => {
  if (!details) return undefined;
  const sanitized: Record<string, TraceScalar> = {};
  for (const [key, value] of Object.entries(details)) {
    if (!ALLOWED_DETAIL_KEYS.has(key)) continue;
    sanitized[key] = typeof value === 'string' ? value.slice(0, 100) : value;
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

const traceEnabled = () => {
  if (!canUseSessionStorage()) return false;
  try {
    return sessionStorage.getItem(TRACE_ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
};

export const updateMedianPickerTraceContext = (context: Record<string, TraceScalar>): void => {
  liveTraceContext = sanitizeDetails({ ...liveTraceContext, ...context }) || {};
};

const notifyTraceUpdated = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(TRACE_UPDATED_EVENT));
};

export const appendMedianPickerTrace = (
  event: string,
  details?: Record<string, TraceScalar>,
): void => {
  if (!traceEnabled()) return;
  try {
    const records = readRecords();
    const lastSequence = records.at(-1)?.sequence ?? 0;
    const record: MedianPickerTraceRecord = {
      sequence: lastSequence + 1,
      timestamp: new Date().toISOString(),
      documentInstanceId,
      event: event.slice(0, 100),
      pathname: typeof window === 'undefined' ? '' : window.location.pathname,
      visibilityState: typeof document === 'undefined' ? 'unknown' : document.visibilityState,
      pickerActive: readPickerActive(),
      details: sanitizeDetails({ ...liveTraceContext, ...details }),
    };
    sessionStorage.setItem(
      TRACE_STORAGE_KEY,
      JSON.stringify([...records, record].slice(-MAX_TRACE_EVENTS)),
    );
    notifyTraceUpdated();
  } catch {
    // Diagnostics must never affect the application flow.
  }
};

export const enableMedianPickerTrace = (): void => {
  if (!canUseSessionStorage()) return;
  try {
    const wasEnabled = traceEnabled();
    sessionStorage.setItem(TRACE_ENABLED_KEY, 'true');
    if (!wasEnabled) {
      appendMedianPickerTrace('trace_enabled', {
        currentDocumentInstanceId: documentInstanceId,
        previousDocumentInstanceId,
        documentChanged: didMedianPickerDocumentChange(previousDocumentInstanceId, documentInstanceId),
      });
    }
  } catch {
    // Diagnostics must never affect the application flow.
  }
};

export const clearMedianPickerTrace = (): void => {
  if (!canUseSessionStorage()) return;
  try {
    sessionStorage.removeItem(TRACE_STORAGE_KEY);
    notifyTraceUpdated();
  } catch {
    // Diagnostics must never affect the application flow.
  }
};

export const getMedianPickerTraceRecords = (): MedianPickerTraceRecord[] => readRecords();

export const getMedianPickerTraceText = (): string => JSON.stringify({
  traceVersion: 1,
  currentDocumentInstanceId: documentInstanceId,
  previousDocumentInstanceId,
  eventCount: readRecords().length,
  events: readRecords(),
}, null, 2);

export const getMedianPickerDocumentInstanceId = () => documentInstanceId;
export const getMedianPickerTraceUpdatedEvent = () => TRACE_UPDATED_EVENT;
export const getMedianPickerActiveAuthSubscriptionCount = () => activeAuthSubscriptions;

export const registerMedianPickerAuthSubscription = (source: string) => {
  activeAuthSubscriptions += 1;
  appendMedianPickerTrace('auth_subscription_added', {
    source,
    activeSubscriptions: activeAuthSubscriptions,
  });
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    activeAuthSubscriptions = Math.max(0, activeAuthSubscriptions - 1);
    appendMedianPickerTrace('auth_subscription_removed', {
      source,
      activeSubscriptions: activeAuthSubscriptions,
    });
  };
};

const destinationPathname = (url: string | URL | null | undefined) => {
  if (typeof window === 'undefined') return '';
  if (!url) return window.location.pathname;
  try {
    return new URL(String(url), window.location.href).pathname;
  } catch {
    return '';
  }
};

export const installMedianPickerGlobalTrace = (): void => {
  if (globalTraceInstalled || typeof window === 'undefined' || typeof document === 'undefined') return;
  globalTraceInstalled = true;

  const recordWindowEvent = (event: Event) => {
    appendMedianPickerTrace(`window_${event.type}`, {
      persisted: 'persisted' in event ? Boolean((event as PageTransitionEvent).persisted) : false,
      scrollY: window.scrollY,
    });
  };
  const recordDocumentEvent = (event: Event) => appendMedianPickerTrace(`document_${event.type}`, {
    scrollY: window.scrollY,
  });

  ['blur', 'focus', 'pagehide', 'pageshow', 'popstate', 'hashchange', 'beforeunload'].forEach(type => {
    window.addEventListener(type, recordWindowEvent);
  });
  document.addEventListener('visibilitychange', recordDocumentEvent);
  document.addEventListener('backbutton', () => appendMedianPickerTrace('median_native_back_event'));

  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);
  window.history.pushState = (data, unused, url) => {
    appendMedianPickerTrace('history_push_state', { destinationPathname: destinationPathname(url) });
    return originalPushState(data, unused, url);
  };
  window.history.replaceState = (data, unused, url) => {
    appendMedianPickerTrace('history_replace_state', { destinationPathname: destinationPathname(url) });
    return originalReplaceState(data, unused, url);
  };

  const medianWindow = window as Window & {
    median_app_resumed?: () => unknown;
    median_app_paused?: () => unknown;
  };
  const existingResume = medianWindow.median_app_resumed;
  const existingPause = medianWindow.median_app_paused;
  appendMedianPickerTrace('median_resume_callback_installed', {
    existingCallback: typeof existingResume === 'function',
  });
  medianWindow.median_app_resumed = () => {
    appendMedianPickerTrace('median_app_resumed_callback', {
      existingCallback: typeof existingResume === 'function',
    });
    return existingResume?.();
  };
  medianWindow.median_app_paused = () => {
    appendMedianPickerTrace('median_app_paused_callback');
    return existingPause?.();
  };

  appendMedianPickerTrace('application_bootstrap', {
    currentDocumentInstanceId: documentInstanceId,
    previousDocumentInstanceId,
    documentChanged: didMedianPickerDocumentChange(previousDocumentInstanceId, documentInstanceId),
  });
};

if (canUseSessionStorage()) {
  try {
    previousDocumentInstanceId = sessionStorage.getItem(PREVIOUS_DOCUMENT_KEY);
    sessionStorage.setItem(PREVIOUS_DOCUMENT_KEY, documentInstanceId);
    appendMedianPickerTrace('document_bootstrap', {
      currentDocumentInstanceId: documentInstanceId,
      previousDocumentInstanceId,
      documentChanged: didMedianPickerDocumentChange(previousDocumentInstanceId, documentInstanceId),
    });
  } catch {
    // Diagnostics must never affect the application flow.
  }
}
