import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeBannerIsSafe, watchNativeBannerSafety } from '../src/lib/nativeBannerSafety.ts';

function fixture() {
  const state = { ready: true, blocked: false, input: false, editable: false, hidden: false };
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
    documentElement: {},
    querySelector: (selector: string) => selector === '[data-native-banner-layout]' ? state.ready || null : state.blocked || null,
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
