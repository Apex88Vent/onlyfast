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
  processingStep: 'idle' | 'scanning';
  currentSetupId: string;
  currentSessionId: string;
  scrollY: number;
  authLoading: boolean;
  savedCarLoads: number;
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

  // AppLayout's saved-car bootstrap is keyed by the durable user ID. A fresh
  // User object for the same ID must not re-enter its loading branch.
  if (decision.identityChanged && nextUserId) {
    state.authLoading = true;
    state.savedCarLoads += 1;
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
    processingStep: 'idle',
    currentSetupId: 'setup-42',
    currentSessionId: 'heat-7',
    scrollY: 384,
    authLoading: false,
    savedCarLoads: 0,
    remounts: 0,
  };

  for (const signal of ['blur', 'pagehide', 'visibilitychange:hidden', 'visibilitychange:visible', 'focus', 'pageshow']) {
    simulatePickerLifecycleSignal(state);
    assert.equal(state.dashboardView, 'setup', `${signal} cannot replace Scan Timing with Home`);
    assert.equal(state.scanTimingMounted, true, `${signal} keeps Scan Timing mounted`);
  }

  state.selectedFile = selectedFile;
  state.processingStarted = true;
  state.processingStep = 'scanning';

  // Exact sequence captured on the physical Median Android device after the
  // picker returned: one same-user SIGNED_IN followed by two USER_UPDATEDs.
  for (const event of ['SIGNED_IN', 'USER_UPDATED', 'USER_UPDATED']) {
    const decision = simulateAuthNotification(state, 'driver-1', 'driver-1', event);
    assert.equal(decision.identityChanged, false, `${event} is not a login transition`);
    assert.equal(decision.shouldRecheckOnboarding, false, `${event} keeps the entry gate settled`);
    assert.equal(decision.preservesMountedApp, true, `${event} preserves the mounted app`);
    assert.equal(state.dashboardView, 'setup');
    assert.equal(state.scanTimingMounted, true);
    assert.equal(state.authLoading, false, `${event} cannot re-enter initial auth loading`);
    assert.equal(state.savedCarLoads, 0, `${event} cannot reload the saved car/class`);
    assert.equal(state.remounts, 0);
    assert.equal(state.processingStep, 'scanning');
    assert.equal(state.currentSetupId, 'setup-42');
    assert.equal(state.currentSessionId, 'heat-7');
    assert.equal(state.scrollY, 384);
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
    processingStep: 'idle',
    currentSetupId: 'setup-42',
    currentSessionId: 'heat-7',
    scrollY: 0,
    authLoading: false,
    savedCarLoads: 0,
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
    processingStep: 'scanning',
    currentSetupId: 'setup-42',
    currentSessionId: 'heat-7',
    scrollY: 128,
    authLoading: false,
    savedCarLoads: 0,
    remounts: 0,
  };

  state.pickerOpen = false;
  assert.equal(state.dashboardView, 'setup');
  assert.equal(state.scanTimingMounted, true);
  assert.strictEqual(state.selectedFile, selectedFile);
  assert.equal(state.processingStarted, true);
});

test('TOKEN_REFRESHED for the same user keeps active Scan Timing processing in place', () => {
  const selectedFile = { name: 'median-token-refresh.jpg' };
  const state: ScanTimingState = {
    dashboardView: 'setup',
    scanTimingMounted: true,
    pickerOpen: false,
    selectedFile,
    processingStarted: true,
    processingStep: 'scanning',
    currentSetupId: 'setup-42',
    currentSessionId: 'main-9',
    scrollY: 256,
    authLoading: false,
    savedCarLoads: 0,
    remounts: 0,
  };

  const decision = simulateAuthNotification(state, 'driver-1', 'driver-1', 'TOKEN_REFRESHED');

  assert.equal(decision.identityChanged, false);
  assert.equal(decision.preservesMountedApp, true);
  assert.equal(state.scanTimingMounted, true);
  assert.equal(state.processingStep, 'scanning');
  assert.equal(state.authLoading, false);
  assert.equal(state.savedCarLoads, 0);
  assert.equal(state.remounts, 0);
  assert.strictEqual(state.selectedFile, selectedFile);
});

test('a real sign-in, sign-out, or account switch still rechecks the entry gate', () => {
  for (const [previousUserId, nextUserId, event] of [
    [null, 'driver-1', 'SIGNED_IN'],
    ['driver-1', null, 'SIGNED_OUT'],
    ['driver-1', 'driver-2', 'SIGNED_IN'],
    ['driver-1', null, 'SESSION_INVALID'],
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

  const initialUnauthenticated = resolveAuthUiTransition({
    previousUserId: null,
    nextUserId: null,
    event: 'INITIAL_SESSION',
    onboardingLoginEscape: false,
  });
  assert.equal(initialUnauthenticated.identityChanged, false);
  assert.equal(initialUnauthenticated.shouldRecheckOnboarding, false);
});

test('AppLayout saved-car loading is keyed by user ID, not Supabase User object identity', () => {
  const source = readFileSync(
    new URL('../src/components/AppLayout.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /const authenticatedUserId = user\?\.id \?\? null/);
  assert.match(source, /\.eq\('user_id', authenticatedUserId\)/);
  assert.match(
    source,
    /\}, \[authChecked, authenticatedUserId, selectedCar, applySelectedCar\]\)/,
  );
  assert.doesNotMatch(
    source,
    /\}, \[authChecked, user, selectedCar, applySelectedCar\]\)/,
  );
});

test('membership synchronization does not feed USER_UPDATED back into updateUser', () => {
  const source = readFileSync(
    new URL('../src/contexts/AppContext.tsx', import.meta.url),
    'utf8',
  );
  const authSyncCondition = source.match(/if \(event === 'SIGNED_IN'[\s\S]*?\) \{\s*sync\(\)/)?.[0] ?? '';

  assert.match(authSyncCondition, /SIGNED_IN/);
  assert.match(authSyncCondition, /TOKEN_REFRESHED/);
  assert.doesNotMatch(authSyncCondition, /USER_UPDATED/);
});

test('BetaFeaturesProvider still revalidates auth data without owning global auth loading', () => {
  const source = readFileSync(
    new URL('../src/contexts/BetaFeaturesContext.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /setCurrentUserId\(userId\)/);
  assert.match(source, /void loadForUser\(userId\)/);
  assert.doesNotMatch(source, /setAuthLoading|setIsLoadingSavedCar/);
});

test('the three auth listeners keep separate responsibilities and clean up subscriptions', () => {
  const sources = [
    '../src/components/AppLayout.tsx',
    '../src/contexts/AppContext.tsx',
    '../src/contexts/BetaFeaturesContext.tsx',
  ].map(path => readFileSync(new URL(path, import.meta.url), 'utf8'));

  for (const source of sources) {
    assert.equal((source.match(/supabase\.auth\.onAuthStateChange/g) || []).length, 1);
    assert.match(source, /subscription\.unsubscribe\(\)/);
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

test('duplicate native file events cannot start the same batch twice', () => {
  const source = readFileSync(
    new URL('../src/components/ScanTimingScreen.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /const processingFileSignatureRef = useRef<string \| null>\(null\)/);
  assert.match(source, /if \(processingFileSignatureRef\.current === signature\) return/);
  assert.match(source, /await handleFiles\(files\)[\s\S]*processingFileSignatureRef\.current = null/);
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
