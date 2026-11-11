import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeBannerIsSafe, nativeBannerBlocker, nativeConsentScreenBlocker, nativeScreenDiagnostics, watchNativeBannerSafety } from '../src/lib/nativeBannerSafety.ts';

function fixture() {
  const state = { ready: true, blocked: false, input: false, editable: false, hidden: false, view: 'home' };
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 });
  const host = Object.assign(new EventTarget(), {
    navigator: { userAgent: 'MedianAndroid/1.0' }, innerHeight: 800, visualViewport: viewport,
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1', pointerEvents: 'auto' }),
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: (id: number) => { frames.delete(id); },
  }) as unknown as Window;
  const page = Object.assign(new EventTarget(), {
    documentElement: {}, visibilityState: 'visible',
    querySelector: (selector: string) => selector === '[data-native-banner-layout]' ? state.ready || null :
      selector === '[data-house-ad-page]' ? { getAttribute: () => state.view } : null,
    querySelectorAll: () => state.blocked ? [{ closest: () => state.hidden, getClientRects: () => state.hidden ? [] : [{}] }] : [],
    activeElement: { matches: () => state.input, get isContentEditable() { return state.editable; } },
  }) as unknown as Document;
  const flush = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(0)); };
  return { host, page, state, viewport, frames, flush };
}

test('native banner safety requires an authenticated layout, unobstructed viewport, no modal/scan, and no editing input', () => {
  const f = fixture();
  assert.equal(nativeBannerIsSafe(f.host, f.page), true);
  for (const key of ['ready', 'blocked', 'input', 'editable'] as const) {
    const original = f.state[key]; f.state[key] = !original;
    assert.equal(nativeBannerIsSafe(f.host, f.page), false, key);
    f.state[key] = original;
  }
  f.viewport.height = 300; assert.equal(nativeBannerIsSafe(f.host, f.page), false);
  f.viewport.height = 600; assert.equal(nativeBannerIsSafe(f.host, f.page), false, 'overlay keyboard');
  f.viewport.height = 800; assert.equal(nativeBannerIsSafe(f.host, f.page), true);
});

test('a missed native keyboard hide is refreshed on safe navigation, without inferring hidden from geometry or looping on diagnostic DOM changes', async () => {
  const f = fixture(); let notify!: (value: unknown) => void; let mutate!: () => void; let subscriptions = 0;
  const reads: ((value: unknown) => void)[] = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'MutationObserver');
  Object.defineProperty(globalThis, 'MutationObserver', { configurable: true, value: class {
    constructor(callback: () => void) { mutate = callback; } observe() {} disconnect() {}
  } });
  Object.assign(f.host, { median: { keyboard: { listen: (callback: typeof notify | '') => {
    if (callback !== '') { notify = callback; subscriptions++; }
  }, info: () => new Promise(resolve => reads.push(resolve)) } } });
  const settle = async () => { await Promise.resolve(); await Promise.resolve(); f.flush(); };
  const stop = watchNativeBannerSafety({ refresh() {} }, f.host, f.page);
  try {
    f.flush(); reads[0]({ visible: true }); await settle();
    assert.equal(nativeConsentScreenBlocker(f.host, f.page), 'native-keyboard-visible');
    f.state.view = 'saved'; mutate(); f.flush();
    assert.equal(reads.length, 2); assert.equal(subscriptions, 1);
    assert.equal(nativeScreenDiagnostics(f.host, f.page).keyboardCheck, 'pending');
    assert.equal(nativeConsentScreenBlocker(f.host, f.page), 'native-keyboard-visible', 'navigation cannot authorize a hidden keyboard');
    reads[1]({ visible: false }); await settle();
    assert.equal(nativeConsentScreenBlocker(f.host, f.page), null);
    assert.equal(nativeScreenDiagnostics(f.host, f.page).staleKeyboardVisibilityCorrected, true);
    mutate(); await settle(); assert.equal(reads.length, 2, 'text-only diagnostic renders cannot query native state repeatedly');
    f.state.input = true;
    assert.equal(nativeConsentScreenBlocker(f.host, f.page), 'editing-input-focused', 'native hidden cannot open UMP over active input');
    notify({ visible: true }); await settle(); assert.equal(nativeScreenDiagnostics(f.host, f.page).staleKeyboardVisibilityCorrected, false);
  } finally { stop(); if (previous) Object.defineProperty(globalThis, 'MutationObserver', previous); else Reflect.deleteProperty(globalThis, 'MutationObserver'); }
});

test('keyboard dismissal/resume re-read native state; failed reads and late results never override visibility evidence', async () => {
  const f = fixture(); let notify!: (value: unknown) => void;
  const reads: { resolve(value: unknown): void; reject(error: Error): void }[] = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'MutationObserver');
  Object.defineProperty(globalThis, 'MutationObserver', { configurable: true, value: class { observe() {} disconnect() {} } });
  Object.assign(f.host, { median: { keyboard: { listen: (callback: typeof notify | '') => { if (callback !== '') notify = callback; },
    info: () => new Promise((resolve, reject) => reads.push({ resolve, reject })) } } });
  const settle = async () => { await Promise.resolve(); await Promise.resolve(); f.flush(); };
  const stop = watchNativeBannerSafety({ refresh() {} }, f.host, f.page);
  try {
    f.flush(); notify({ visible: true }); reads[0].resolve({ visible: false }); await settle();
    assert.equal(nativeScreenDiagnostics(f.host, f.page).keyboardVisibility, 'visible', 'older info cannot overwrite a newer show event');
    f.page.dispatchEvent(new Event('focusout')); f.viewport.dispatchEvent(new Event('resize')); f.flush();
    assert.equal(reads.length, 2, 'dismissal events coalesce');
    reads[1].reject(Error('Native info unavailable')); await settle();
    assert.equal(nativeScreenDiagnostics(f.host, f.page).keyboardCheck, 'error');
    assert.equal(nativeConsentScreenBlocker(f.host, f.page), 'native-keyboard-visible');
    Object.assign(f.page, { visibilityState: 'hidden' }); f.page.dispatchEvent(new Event('visibilitychange')); f.flush();
    assert.equal(reads.length, 2, 'no native query in background');
    Object.assign(f.page, { visibilityState: 'visible' }); f.host.dispatchEvent(new Event('pageshow')); f.flush();
    assert.equal(reads.length, 3); reads[2].resolve({ visible: false }); await settle();
    assert.equal(nativeScreenDiagnostics(f.host, f.page).keyboardVisibility, 'hidden');
    assert.equal(nativeConsentScreenBlocker(f.host, f.page), null);
    f.host.dispatchEvent(new Event('membership-updated')); f.flush();
    assert.equal(reads.length, 4, 'trusted membership arrival also refreshes native screen state');
    stop(); reads[3].resolve({ visible: true }); await settle();
    assert.equal(f.frames.size, 0, 'an unmounted watcher cannot refresh from a late read');
  } finally { stop(); if (previous) Object.defineProperty(globalThis, 'MutationObserver', previous); else Reflect.deleteProperty(globalThis, 'MutationObserver'); }
});

test('native consent does not require banner space but retains layout, editing, keyboard and overlay safeguards', () => {
  const f = fixture();
  Object.assign(f.host, { innerHeight: 300 }); f.viewport.height = 300;
  assert.equal(nativeBannerBlocker(f.host, f.page), 'banner-viewport-too-small');
  assert.equal(nativeConsentScreenBlocker(f.host, f.page), null);
  for (const [key, value, blocker] of [
    ['ready', false, 'authenticated-layout-unavailable'], ['blocked', true, 'visible-overlay-or-scan'],
    ['input', true, 'editing-input-focused'], ['editable', true, 'editing-input-focused'],
  ] as const) {
    const before = f.state[key]; f.state[key] = value;
    assert.equal(nativeConsentScreenBlocker(f.host, f.page), blocker);
    f.state[key] = before;
  }
  Object.assign(f.host, { innerHeight: 800 });
  assert.equal(nativeConsentScreenBlocker(f.host, f.page), 'keyboard-viewport-occluded');
});

test('hidden dialogs do not suppress banners, and native keyboard dismissal restores them even when an input retains focus', async () => {
  const f = fixture(); let notify!: (value: unknown) => void; let info!: (value: unknown) => void; let stopped = false;
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'MutationObserver');
  Object.defineProperty(globalThis, 'MutationObserver', { configurable: true, value: class { observe() {} disconnect() {} } });
  Object.assign(f.host, { median: { keyboard: {
    listen: (callback: typeof notify | '') => { if (callback === '') stopped = true; else notify = callback; },
    info: () => new Promise(resolve => { info = resolve; }),
  } } });
  try {
    const stop = watchNativeBannerSafety({ refresh() {} }, f.host, f.page); f.flush();
    f.state.input = true; notify({ visible: true }); f.flush();
    assert.equal(nativeBannerIsSafe(f.host, f.page), false);
    f.viewport.height = 500;
    notify({ visible: false }); f.flush();
    assert.equal(nativeBannerIsSafe(f.host, f.page), true, 'Done must restore banners despite retained input focus');
    info({ visible: true }); await Promise.resolve(); f.flush();
    assert.equal(nativeBannerIsSafe(f.host, f.page), true, 'late initial info must not replace a newer hide event');
    f.state.blocked = true; f.state.hidden = true;
    assert.equal(nativeBannerIsSafe(f.host, f.page), true, 'an unmounted/hidden dialog is not an active overlay');
    f.state.hidden = false; assert.equal(nativeBannerIsSafe(f.host, f.page), false);
    stop(); assert.equal(stopped, true);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'MutationObserver', previous); else Reflect.deleteProperty(globalThis, 'MutationObserver');
  }
});

test('one shared native watcher coalesces dialog/keyboard changes and cleans up observers/listeners without touching interstitial APIs', () => {
  const f = fixture(); let refreshes = 0; let mutations!: () => void; let disconnected = false;
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'MutationObserver');
  class Observer {
    constructor(callback: () => void) { mutations = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  }
  Object.defineProperty(globalThis, 'MutationObserver', { configurable: true, value: Observer });
  try {
    const stop = watchNativeBannerSafety({ refresh: () => { refreshes++; } }, f.host, f.page);
    f.flush(); assert.equal(refreshes, 1);
    f.page.dispatchEvent(new Event('focusin')); f.page.dispatchEvent(new Event('focusout'));
    f.viewport.dispatchEvent(new Event('resize')); mutations();
    assert.equal(f.frames.size, 1); f.flush(); assert.equal(refreshes, 2);
    f.host.dispatchEvent(new Event('resize')); assert.equal(f.frames.size, 1);
    stop(); assert.equal(disconnected, true); assert.equal(f.frames.size, 0);
    f.page.dispatchEvent(new Event('focusin')); f.viewport.dispatchEvent(new Event('scroll')); f.flush();
    assert.equal(refreshes, 2);
    Object.assign(f.host.navigator, { userAgent: 'Chrome' });
    watchNativeBannerSafety({ refresh: () => { throw Error('Web must not install native banner observers'); } }, f.host, f.page)();
    assert.equal(f.frames.size, 0);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'MutationObserver', previous);
    else Reflect.deleteProperty(globalThis, 'MutationObserver');
  }
});
