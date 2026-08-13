import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendMedianPickerTrace,
  clearMedianPickerTrace,
  didMedianPickerDocumentChange,
  enableMedianPickerTrace,
  getMedianPickerDocumentInstanceId,
  getMedianPickerTraceRecords,
  getMedianPickerTraceText,
  installMedianPickerGlobalTrace,
  registerMedianPickerAuthSubscription,
  updateMedianPickerTraceContext,
} from '../src/lib/medianPickerTrace.ts';
import { readFileSync } from 'node:fs';

const installBrowserState = () => {
  const sessionValues = new Map<string, string>();
  const localValues = new Map<string, string>();
  const windowListeners = new Map<string, Array<(event: Event) => void>>();
  const documentListeners = new Map<string, Array<(event: Event) => void>>();
  const storage = (values: Map<string, string>) => ({
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  const addListener = (
    listeners: Map<string, Array<(event: Event) => void>>,
    type: string,
    handler: (event: Event) => void,
  ) => listeners.set(type, [...(listeners.get(type) || []), handler]);

  const fakeWindow = {
    location: { pathname: '/account', href: 'https://onlyfast.test/account' },
    history: {
      pushState: () => undefined,
      replaceState: () => undefined,
    },
    addEventListener: (type: string, handler: (event: Event) => void) =>
      addListener(windowListeners, type, handler),
    dispatchEvent: (event: Event) => {
      (windowListeners.get(event.type) || []).forEach(handler => handler(event));
      return true;
    },
  };
  const fakeDocument = {
    visibilityState: 'visible',
    addEventListener: (type: string, handler: (event: Event) => void) =>
      addListener(documentListeners, type, handler),
  };

  Object.defineProperty(globalThis, 'window', { value: fakeWindow, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: fakeDocument, configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: storage(sessionValues), configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: storage(localValues), configurable: true });

  return { fakeWindow, sessionValues, localValues, windowListeners, documentListeners };
};

test('trace is session-only, bounded, and rejects unapproved privacy-sensitive fields', () => {
  const state = installBrowserState();
  enableMedianPickerTrace();
  clearMedianPickerTrace();
  updateMedianPickerTraceContext({
    scanTimingMounted: true,
    hasSetup: true,
    hasSession: true,
    userId: 'context-must-not-be-recorded',
  });

  for (let index = 0; index < 220; index += 1) {
    appendMedianPickerTrace('bounded_event', {
      source: 'test',
      fileCount: index,
      userId: 'must-not-be-recorded',
      email: 'must-not-be-recorded@example.test',
      authToken: 'must-not-be-recorded',
    });
  }

  const records = getMedianPickerTraceRecords();
  assert.equal(records.length, 180);
  assert.equal(records[0].details?.fileCount, 40);
  assert.equal(records.at(-1)?.details?.fileCount, 219);
  assert.equal(records.at(-1)?.details?.scanTimingMounted, true);
  assert.equal(records.at(-1)?.details?.hasSetup, true);
  assert.equal(records.at(-1)?.details?.hasSession, true);
  assert.doesNotMatch(getMedianPickerTraceText(), /must-not-be-recorded/);
  assert.equal([...state.localValues.keys()].some(key => key.includes('trace')), false);
  assert.equal([...state.sessionValues.keys()].some(key => key.includes('trace')), true);
});

test('document, window, history, Median resume, and subscription events share one document ID', () => {
  const state = installBrowserState();
  enableMedianPickerTrace();
  clearMedianPickerTrace();
  installMedianPickerGlobalTrace();

  const unregisterAppLayout = registerMedianPickerAuthSubscription('AppLayout');
  const unregisterAppContext = registerMedianPickerAuthSubscription('AppContext');
  state.fakeWindow.history.pushState({}, '', '/');
  state.windowListeners.get('focus')?.forEach(handler => handler(new Event('focus')));
  state.documentListeners.get('visibilitychange')?.forEach(handler => handler(new Event('visibilitychange')));
  (state.fakeWindow as typeof state.fakeWindow & { median_app_resumed: () => void }).median_app_resumed();

  const records = getMedianPickerTraceRecords();
  assert.ok(records.some(record => record.event === 'application_bootstrap'));
  assert.ok(records.some(record => record.event === 'history_push_state'));
  assert.ok(records.some(record => record.event === 'window_focus'));
  assert.ok(records.some(record => record.event === 'document_visibilitychange'));
  assert.ok(records.some(record => record.event === 'median_app_resumed_callback'));
  assert.deepEqual(new Set(records.map(record => record.documentInstanceId)), new Set([getMedianPickerDocumentInstanceId()]));
  assert.deepEqual(
    records.filter(record => record.event === 'auth_subscription_added').map(record => record.details?.activeSubscriptions),
    [1, 2],
  );

  unregisterAppContext();
  unregisterAppLayout();
});

test('document instance comparison distinguishes component remounts from a new JavaScript document', () => {
  assert.equal(didMedianPickerDocumentChange(null, 'document-a'), false);
  assert.equal(didMedianPickerDocumentChange('document-a', 'document-a'), false);
  assert.equal(didMedianPickerDocumentChange('document-a', 'document-b'), true);
});

test('the active setup path has three auth listeners, one Supabase client, and no StrictMode root', () => {
  const activeAuthSources = [
    '../src/components/AppLayout.tsx',
    '../src/contexts/AppContext.tsx',
    '../src/contexts/BetaFeaturesContext.tsx',
  ].map(path => readFileSync(new URL(path, import.meta.url), 'utf8'));
  const supabaseSource = readFileSync(new URL('../src/lib/supabase.ts', import.meta.url), 'utf8');
  const mainSource = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');

  assert.equal(
    activeAuthSources.reduce((count, source) => count + (source.match(/onAuthStateChange\(/g)?.length || 0), 0),
    3,
  );
  assert.equal(supabaseSource.match(/createClient\(/g)?.length, 1);
  assert.doesNotMatch(mainSource, /StrictMode/);
});
