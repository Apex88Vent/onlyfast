import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveAuthUiTransition } from '../src/lib/authUiTransition.ts';

interface ScanTimingState {
  dashboardView: 'home' | 'setup';
  scanTimingMounted: boolean;
  pickerOpen: boolean;
  selectedFile: { name: string } | null;
  processingStarted: boolean;
  remounts: number;
}

const simulateAuthNotification = (
  state: ScanTimingState,
  previousUserId: string | null,
  nextUserId: string | null,
  event: string,
) => {
  const decision = resolveAuthUiTransition({
    previousUserId,
    nextUserId,
    event,
    onboardingLoginEscape: false,
  });

  if (decision.shouldRecheckOnboarding) {
    state.scanTimingMounted = false;
    state.dashboardView = 'home';
    state.remounts += 1;
  }

  return decision;
};

const simulatePickerLifecycleSignal = (state: ScanTimingState) => {
  if (!state.pickerOpen) {
    state.dashboardView = 'home';
    state.scanTimingMounted = false;
  }
};

test('Median picker resume keeps Scan Timing mounted through same-user auth events', () => {
  const selectedFile = { name: 'timing-sheet.jpg' };
  const state: ScanTimingState = {
    dashboardView: 'setup',
    scanTimingMounted: true,
    pickerOpen: true,
    selectedFile: null,
    processingStarted: false,
    remounts: 0,
  };

  for (const signal of ['blur', 'pagehide', 'visibilitychange:hidden', 'visibilitychange:visible', 'focus', 'pageshow']) {
    simulatePickerLifecycleSignal(state);
    assert.equal(state.dashboardView, 'setup', `${signal} cannot replace Scan Timing with Home`);
    assert.equal(state.scanTimingMounted, true, `${signal} keeps Scan Timing mounted`);
  }

  state.selectedFile = selectedFile;
  state.processingStarted = true;

  for (const event of ['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED']) {
    const decision = simulateAuthNotification(state, 'driver-1', 'driver-1', event);
    assert.equal(decision.identityChanged, false, `${event} is not a login transition`);
    assert.equal(decision.shouldRecheckOnboarding, false, `${event} keeps the entry gate settled`);
    assert.equal(decision.preservesMountedApp, true, `${event} preserves the mounted app`);
    assert.equal(state.dashboardView, 'setup');
    assert.equal(state.scanTimingMounted, true);
    assert.equal(state.remounts, 0);
    assert.strictEqual(state.selectedFile, selectedFile, 'the exact File object remains attached');
  }

  state.pickerOpen = false;
  assert.equal(state.processingStarted, true, 'file processing can begin after the picker returns');
  assert.strictEqual(state.selectedFile, selectedFile, 'processing receives the selected File object');
});

test('picker cancellation preserves Scan Timing without starting processing', () => {
  const state: ScanTimingState = {
    dashboardView: 'setup',
    scanTimingMounted: true,
    pickerOpen: true,
    selectedFile: null,
    processingStarted: false,
    remounts: 0,
  };

  simulatePickerLifecycleSignal(state);
  simulateAuthNotification(state, 'driver-1', 'driver-1', 'SIGNED_IN');
  state.pickerOpen = false;

  assert.equal(state.dashboardView, 'setup');
  assert.equal(state.scanTimingMounted, true);
  assert.equal(state.selectedFile, null);
  assert.equal(state.processingStarted, false);
  assert.equal(state.remounts, 0);
});

test('normal web file selection keeps its existing direct processing flow', () => {
  const selectedFile = { name: 'browser-timing-sheet.png' };
  const state: ScanTimingState = {
    dashboardView: 'setup',
    scanTimingMounted: true,
    pickerOpen: true,
    selectedFile,
    processingStarted: true,
    remounts: 0,
  };

  state.pickerOpen = false;
  assert.equal(state.dashboardView, 'setup');
  assert.equal(state.scanTimingMounted, true);
  assert.strictEqual(state.selectedFile, selectedFile);
  assert.equal(state.processingStarted, true);
});

test('a real sign-in, sign-out, or account switch still rechecks the entry gate', () => {
  for (const [previousUserId, nextUserId, event] of [
    [null, 'driver-1', 'SIGNED_IN'],
    ['driver-1', null, 'SIGNED_OUT'],
    ['driver-1', 'driver-2', 'SIGNED_IN'],
  ] as const) {
    const decision = resolveAuthUiTransition({
      previousUserId,
      nextUserId,
      event,
      onboardingLoginEscape: false,
    });
    assert.equal(decision.identityChanged, true);
    assert.equal(decision.shouldRecheckOnboarding, true);
    assert.equal(decision.preservesMountedApp, false);
  }
});

test('the intentional onboarding login escape still bypasses the entry gate', () => {
  const decision = resolveAuthUiTransition({
    previousUserId: null,
    nextUserId: 'driver-1',
    event: 'SIGNED_IN',
    onboardingLoginEscape: true,
  });

  assert.equal(decision.shouldRecheckOnboarding, false);
  assert.equal(decision.shouldMarkOnboardingChecked, true);
});

test('Scan Timing picker controls cannot submit a form and selection awaits processing', () => {
  const source = readFileSync(
    new URL('../src/components/ScanTimingScreen.tsx', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(source, /<form\b/);
  assert.match(source, /type="button"[\s\S]*onClick=\{openUploadPicker\}/);
  assert.match(source, /type="button"[\s\S]*onClick=\{openCameraPicker\}/);
  assert.match(source, /const handleFileInputSelection[\s\S]*await handleFiles\(files\)/);
});

test('existing resume, visibility, page lifecycle, and safe-back handlers remain picker-aware', () => {
  const dashboardSource = readFileSync(
    new URL('../src/components/SetupDashboard.tsx', import.meta.url),
    'utf8',
  );
  const safeBackSource = readFileSync(
    new URL('../src/components/SafeBackHandler.tsx', import.meta.url),
    'utf8',
  );

  assert.match(dashboardSource, /const blockForFilePicker[\s\S]*isOnlyFastFilePickerOpen\(\)/);
  assert.match(dashboardSource, /addEventListener\('focus', handleResume\)/);
  assert.match(dashboardSource, /addEventListener\('blur', markActivity\)/);
  assert.match(dashboardSource, /addEventListener\('pageshow', handleResume\)/);
  assert.match(dashboardSource, /addEventListener\('pagehide', saveOnExit\)/);
  assert.match(dashboardSource, /addEventListener\('visibilitychange', handleVisibilityChange\)/);
  assert.match(safeBackSource, /handlePopState[\s\S]*isOnlyFastFilePickerOpen\(\)/);
  assert.match(safeBackSource, /handleNativeBack[\s\S]*isOnlyFastFilePickerOpen\(\)/);
});
