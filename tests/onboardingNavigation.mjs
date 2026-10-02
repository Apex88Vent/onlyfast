// Mounted React integration checks of the actual navigation/components.
// REACT_TEST_RENDERER_MODULE points to an external react-test-renderer 18 install;
// no new production/test package dependencies or live account mutations.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import * as configs from '../src/lib/classConfigs.ts';
import * as library from '../src/lib/setupLibrary.ts';
import * as access from '../src/lib/setupLibraryAccess.ts';
import * as custom from '../src/lib/customCar.ts';
import { buildBetaAccessSnapshot, CLOSED_BETA_ACCESS } from '../src/lib/betaFeatures.ts';
import { componentFunction } from './setupLibraryHarness.ts';
import { resolveAuthUiTransition } from '../src/lib/authUiTransition.ts';

const qaRequire = createRequire(process.env.REACT_TEST_RENDERER_MODULE);
const React = qaRequire('react');
const { create, act } = qaRequire(process.env.REACT_TEST_RENDERER_MODULE);
const empty = () => null;
const wrapper = ({ children }) => children;
const icon = props => React.createElement('span', props);
const text = node => typeof node === 'string' ? node : (node.children || []).map(text).join('');
const experiment = buildBetaAccessSnapshot({ user_id: 'test-id', is_test_account: true, beta_features_enabled: true, tester_kind: 'experimental' }, [{ feature_key: 'test_account_full_access', enabled: true }]);
let fixture;
function compile(file, modules = {}) {
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true } }).outputText;
  const output = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (name === 'react') return React;
    if (name.startsWith('react/')) return qaRequire(name);
    if (name === 'lucide-react') return new Proxy({}, { get: () => icon });
    if (name === '@/hooks/useBetaFeatures') return { useBetaFeatures: () => ({ ...fixture.access, loading: fixture.betaLoading, hasBetaFeature: () => false }) };
    if (name === '@/lib/classConfigs') return configs;
    if (name === '@/lib/setupLibrary') return library;
    if (name === '@/lib/setupLibraryAccess') return access;
    if (name === '@/lib/customCar') return custom;
    if (name in modules) return { __esModule: true, ...modules[name] };
    throw new Error(`Unstubbed dependency ${name}`);
  }, output, output.exports);
  return output.exports.default;
}
const How = compile('components/HowOnlyFastWorks.tsx');
const Selection = compile('components/OnboardingFlow.tsx');
const Auth = ({ isOpen, onClose }) => isOpen ? React.createElement('button', { onClick: onClose }, 'Dismiss login') : null;
const App = compile('components/AppLayout.tsx', {
  './CustomCarSheet': { CustomCarGate: wrapper },
  '@/lib/supabase': { supabase: {
    auth: {
      onAuthStateChange: handler => { fixture.authListener = handler; return { data: { subscription: { unsubscribe() {} } } }; },
      getSession: async () => ({ data: { session: fixture.user ? { user: fixture.user } : null } }),
      updateUser: async ({ data }) => { fixture.metadataWrites.push(data); fixture.user = { ...fixture.user, user_metadata: data }; fixture.authListener('USER_UPDATED', { user: fixture.user }); return { data: { user: fixture.user }, error: null }; },
    },
    from: () => {
      const query = { select: () => query, eq: () => query, not: () => query, order: () => query, limit: async () => ({ data: fixture.savedClass ? [{ race_class: fixture.savedClass }] : [], error: fixture.offline ? new Error('Offline') : null }) };
      return query;
    },
  } },
  './AccessibleAnnouncer': { AnnouncerProvider: wrapper },
  './SkipLink': { default: empty },
  './SplashScreen': { default: ({ onComplete }) => React.createElement('button', { onClick: onComplete }, 'End splash') },
  './OnboardingFlow': { default: Selection },
  './HowOnlyFastWorks': { default: How },
  './Header': { default: ({ onOpenHowOnlyFastWorks }) => React.createElement('button', { onClick: onOpenHowOnlyFastWorks }, 'Replay help') },
  './SetupDashboard': { default: ({ selectedCar, landingRequest }) => React.createElement('div', { 'data-landing': true, 'data-landing-request': landingRequest }, `Landing: ${selectedCar}`) },
  './AuthModal': { default: Auth },
  './CookieConsent': { default: empty },
  './Footer': { default: empty },
  './LegalModal': { default: empty },
  './ClassChangeModal': { default: empty },
  'react-router-dom': { useNavigate: () => () => { throw new Error('Unexpected route redirect'); } },
  '@/lib/membership': { getEffectiveTier: () => 'rookie', readMembership: () => ({}) },
  '@/lib/activeClass': {
    getActiveClassState: async () => { if (fixture.offline) throw new Error('Offline'); return fixture.deferredState || { active_class: fixture.activeClass, unlimited: fixture.access === experiment }; },
    initializeActiveClass: async car => { fixture.initializations.push(car); if (fixture.rejectClass) throw new Error('CLASS_INVALID'); return { active_class: car, unlimited: fixture.access === experiment }; },
  },
  '@/lib/testAccount': { resetTestAccountData: () => { throw new Error('Account reset must not run'); } },
  '@/lib/betaFeatures': { BETA_FEATURES: { testAccountReset: 'test_account_reset' } },
  '@/lib/filePickerState': { isOnlyFastFilePickerOpen: () => false },
  '@/lib/authUiTransition': { resolveAuthUiTransition },
});
const Home = compile('components/HomeLanding.tsx');
const Chassis = compile('components/ChassisSetupForm.tsx');
const PreviewLanding = compile('components/SetupPreviewLanding.tsx', {
  './HomeLanding': { default: Home }, './ChassisSetupForm': { default: Chassis },
  './CustomCarSheet': { CustomSheetFields: empty },
});
const Preview = compile('pages/OnboardingPreview.tsx', { '@/components/HowOnlyFastWorks': { default: How }, '@/components/OnboardingFlow': { default: Selection }, '@/components/SetupPreviewLanding': { default: PreviewLanding } });
const ChangeClass = compile('components/ClassChangeModal.tsx', {
  '@/lib/paymentVisibility': { isMedianIOSApp: false },
  '@/lib/activeClass': {
    sameClass: (a, b) => a?.trim().toLowerCase() === b?.trim().toLowerCase(),
    getActiveClassState: async () => ({ unlimited: fixture.access === experiment, can_change: fixture.access === experiment, next_eligible_at: '2026-10-08' }),
    changeActiveClass: async car => fixture.initializations.push(car),
    formatEligibleDate: value => value,
  },
});

function reset(options = {}) {
  fixture = { user: { id: 'new-id', user_metadata: {} }, activeClass: null, savedClass: null, access: CLOSED_BETA_ACCESS, betaLoading: false, metadataWrites: [], initializations: [], ...options };
  const store = new Map(Object.entries(options.storage || {}));
  globalThis.localStorage = { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) };
  globalThis.sessionStorage = { getItem: () => null, setItem() {} };
  globalThis.document = { addEventListener() {}, removeEventListener() {} };
  globalThis.window = { setTimeout, clearTimeout };
  return store;
}
const buttons = root => root.findAllByType('button');
async function click(root, label) {
  const button = buttons(root).find(b => text(b) === label && b.props['aria-hidden'] !== true);
  assert.ok(button, `Missing button ${label}`);
  await act(async () => { await button.props.onClick(); });
}
async function mount(component = App) {
  let view;
  await act(async () => { view = create(React.createElement(component)); });
  if (component === App) await click(view.root, 'End splash');
  return view;
}
const heading = (root, label) => root.findAll(n => ['h1', 'h2'].includes(n.type) && text(n) === label).length > 0;
const landing = root => root.findAll(n => n.props['data-landing']).length > 0;
async function requiredSlides(root) {
  await click(root, 'Let’s Get Faster');
  for (let i = 0; i < 4; i++) await click(root, 'Continue');
  assert.ok(heading(root, 'Timing Scan'));
}

test('A/F: configured returning user enters landing; replay Close preserves class and onboarding data', async () => {
  reset({ user: { id: 'existing', user_metadata: { onboarding_completed: true } }, activeClass: 'Dwarf Cars' });
  const view = await mount();
  assert.ok(landing(view.root));
  await click(view.root, 'Replay help');
  assert.ok(buttons(view.root).some(b => text(b) === 'Close'));
  assert.equal(buttons(view.root).some(b => text(b) === 'Skip' && !b.props['aria-hidden']), false);
  await click(view.root, 'Close');
  assert.ok(landing(view.root));
  assert.deepEqual(fixture.metadataWrites, []);
  assert.deepEqual(fixture.initializations, []);
  await act(async () => view.unmount());
});

test('B/E: new user ignores stale class/membership; Skip exits to discipline selection with production options', async () => {
  reset({ user: { id: 'new-id', user_metadata: { membership_tier: 'pro' } }, storage: { onlyfast_car: 'GT3', onlyfast_membership: '{"membership_tier":"team"}', onlyfast_onboarding_completed_guest: 'true' } });
  const view = await mount();
  assert.ok(heading(view.root, 'Welcome to OnlyFast'));
  assert.equal(landing(view.root), false);
  assert.deepEqual(fixture.initializations, []);
  assert.equal(buttons(view.root).some(b => text(b) === 'Close'), false);
  assert.equal(buttons(view.root).find(b => text(b) === 'Skip').props['aria-hidden'], true);
  await requiredSlides(view.root);
  await click(view.root, 'Skip');
  assert.ok(heading(view.root, 'Select Your Discipline'));
  assert.equal(landing(view.root), false);
  const categories = buttons(view.root).filter(b => / - /.test(b.props['aria-label'] || ''));
  assert.equal(categories.length, 1);
  await act(async () => categories[0].props.onClick());
  assert.ok(heading(view.root, 'Select Your Car'));
  assert.equal(buttons(view.root).some(b => /GT3|Legends/.test(text(b))), false);
  assert.equal(buttons(view.root).filter(b => / - /.test(b.props['aria-label'] || '')).length, 7);
  await act(async () => view.unmount());
});

test('D: every Continue advances one slide; final button ends at Select Discipline', async () => {
  reset();
  const view = await mount();
  await requiredSlides(view.root);
  for (let i = 0; i < 6; i++) await click(view.root, 'Continue');
  assert.ok(heading(view.root, 'Ready to Build Speed?'));
  await click(view.root, 'Select My Discipline');
  assert.ok(heading(view.root, 'Select Your Discipline'));
  assert.equal(landing(view.root), false);
  assert.equal(fixture.metadataWrites[0].onboarding_completed, true);
  await act(async () => view.unmount());
});

test('C: flagged test@test.com sees all five disciplines, selects GT3; failed RPC cannot enter landing', async () => {
  reset({ user: { id: 'test-id', email: 'test@test.com', user_metadata: { onboarding_completed: true } }, access: experiment, rejectClass: true });
  const view = await mount();
  assert.ok(heading(view.root, 'Select Your Discipline'));
  const categories = buttons(view.root).filter(b => / - /.test(b.props['aria-label'] || ''));
  assert.equal(categories.length, 5);
  await act(async () => categories.find(b => b.props['aria-label'].startsWith('Road Course -')).props.onClick());
  const gt3 = buttons(view.root).find(b => b.props['aria-label']?.startsWith('GT3 -'));
  assert.ok(gt3);
  await act(async () => gt3.props.onClick());
  assert.ok(heading(view.root, 'Select Your Car'));
  assert.equal(landing(view.root), false);
  assert.match(view.root.findByProps({ role: 'alert' }).children.join(''), /could not be saved/);
  fixture.rejectClass = false;
  await act(async () => gt3.props.onClick());
  assert.ok(landing(view.root));
  assert.deepEqual(fixture.initializations, ['GT3', 'GT3']);
  await act(async () => view.unmount());
});

test('email alone cannot unlock development classes; a completed unconfigured user goes to selection', async () => {
  reset({ user: { id: 'unflagged-test', email: 'test@test.com', user_metadata: { onboarding_completed: true } } });
  const view = await mount();
  assert.ok(heading(view.root, 'Select Your Discipline'));
  assert.equal(buttons(view.root).filter(b => / - /.test(b.props['aria-label'] || '')).length, 1);
  await act(async () => view.unmount());
});

test('login from onboarding rechecks the new account; dismissing login does not complete onboarding', async () => {
  reset({ user: null });
  const view = await mount();
  await click(view.root, 'Already a member? Login here');
  await click(view.root, 'Dismiss login');
  assert.ok(heading(view.root, 'Welcome to OnlyFast'));
  assert.deepEqual(fixture.metadataWrites, []);
  await click(view.root, 'Already a member? Login here');
  fixture.user = { id: 'signed-up-id', user_metadata: {} };
  await act(async () => fixture.authListener('SIGNED_IN', { user: fixture.user }));
  assert.ok(heading(view.root, 'Welcome to OnlyFast'));
  assert.equal(landing(view.root), false);
  await act(async () => view.unmount());
});

test('changing authenticated identity clears the previous class; token refresh preserves the mounted landing', async () => {
  reset({ user: { id: 'old-id', user_metadata: { onboarding_completed: true } }, activeClass: 'Modified' });
  const view = await mount();
  const originalLanding = view.root.findByProps({ 'data-landing': true });
  await act(async () => fixture.authListener('TOKEN_REFRESHED', { user: fixture.user }));
  assert.equal(view.root.findByProps({ 'data-landing': true }), originalLanding);
  fixture.user = { id: 'new-id', user_metadata: {} };
  fixture.activeClass = null;
  await act(async () => fixture.authListener('SIGNED_IN', { user: fixture.user }));
  assert.ok(heading(view.root, 'Welcome to OnlyFast'));
  assert.equal(landing(view.root), false);
  await act(async () => view.unmount());
});

test('preview Finish/Skip uses the real discipline/class screens without writing profile/class state', async () => {
  reset({ access: experiment });
  const view = await mount(Preview);
  await requiredSlides(view.root);
  await click(view.root, 'Skip to discipline selection');
  assert.ok(heading(view.root, 'Select Your Discipline'));
  assert.equal(buttons(view.root).filter(b => / - /.test(b.props['aria-label'] || '')).length, 5);
  assert.deepEqual(fixture.metadataWrites, []);
  assert.deepEqual(fixture.initializations, []);
  await act(async () => view.unmount());
});

test('returning user recovers their own saved class without adopting the device-wide class', async () => {
  reset({ savedClass: 'Sport Mod', storage: { onlyfast_car: 'GT3' } });
  const view = await mount();
  assert.equal(text(view.root.findByProps({ 'data-landing': true })), 'Landing: Sport Mod');
  assert.deepEqual(fixture.initializations, []);
  await act(async () => view.unmount());
});

test('successful empty server state overrides cached class; offline fallback is scoped to the current user', async () => {
  reset({ user: { id: 'new-id', user_metadata: { onboarding_completed: true } }, storage: { onlyfast_car: 'GT3', 'onlyfast_car_new-id': 'Modified' } });
  let view = await mount();
  assert.ok(heading(view.root, 'Select Your Discipline'));
  await act(async () => view.unmount());
  reset({ offline: true, storage: { onlyfast_car: 'GT3', 'onlyfast_car_new-id': 'Modified' } });
  view = await mount();
  assert.equal(text(view.root.findByProps({ 'data-landing': true })), 'Landing: Modified');
  await act(async () => view.unmount());
});

test('late previous-account class lookup cannot overwrite the newly authenticated account', async () => {
  let resolvePrevious;
  reset({ user: { id: 'old-id', user_metadata: {} }, deferredState: new Promise(resolve => { resolvePrevious = resolve; }) });
  const view = await mount();
  assert.equal(landing(view.root), false);
  fixture.user = { id: 'new-id', user_metadata: {} };
  fixture.deferredState = null;
  await act(async () => fixture.authListener('SIGNED_IN', { user: fixture.user }));
  await act(async () => resolvePrevious({ active_class: 'GT3', unlimited: true }));
  assert.ok(heading(view.root, 'Welcome to OnlyFast'));
  assert.equal(landing(view.root), false);
  await act(async () => view.unmount());
});

test('class-change modal uses existing server test bypass while preserving normal-user cooldown', async () => {
  reset({ access: experiment });
  let selected;
  let closed = false;
  const props = { isOpen: true, user: { id: 'test-id' }, tier: 'rookie', currentClass: 'Dwarf Cars', onClose: () => { closed = true; }, onChanged: car => { selected = car; }, onUpgrade() {} };
  let view;
  await act(async () => { view = create(React.createElement(ChangeClass, props)); });
  assert.equal(view.root.findAllByType('option').length, 49);
  await act(async () => view.root.findByType('select').props.onChange({ target: { value: 'GT3' } }));
  await click(view.root, 'Change Class');
  assert.equal(selected, 'GT3');
  assert.equal(closed, true);
  assert.deepEqual(fixture.initializations, ['GT3']);
  await act(async () => view.unmount());
  reset();
  await act(async () => { view = create(React.createElement(ChangeClass, { ...props, user: { id: 'normal-id' } })); });
  assert.equal(view.root.findAllByType('select').length, 0);
  assert.ok(heading(view.root, 'Class change unavailable'));
  await act(async () => view.unmount());
});

for (const car of ['GT3', 'Shifter Kart', 'Clutch Kart']) {
  test('A/B/C: first-run Road Course ' + car + ' initializes before landing, without requesting an editor', async () => {
    reset({ access: experiment });
    const view = await mount();
    await requiredSlides(view.root);
    await click(view.root, 'Skip');
    const road = buttons(view.root).find(b => b.props['aria-label']?.startsWith('Road Course -'));
    await act(async () => road.props.onClick());
    const selected = buttons(view.root).find(b => b.props['aria-label']?.startsWith(car + ' -'));
    await act(async () => selected.props.onClick());
    assert.ok(landing(view.root));
    assert.equal(view.root.findByProps({ 'data-landing': true }).props['data-landing-request'], 1);
    assert.deepEqual(fixture.initializations, [car]);
    await act(async () => view.unmount());
  });
}

for (const car of ['Shifter Kart', 'Clutch Kart']) {
  test('G/E: actual protected preview ends on real landing for ' + car + '; explicit New Setup opens its form', async () => {
    reset({ access: experiment });
    const view = await mount(Preview);
    await requiredSlides(view.root);
    await click(view.root, 'Skip to discipline selection');
    await act(async () => buttons(view.root).find(b => b.props['aria-label']?.startsWith('Road Course -')).props.onClick());
    await act(async () => buttons(view.root).find(b => b.props['aria-label']?.startsWith(car + ' -')).props.onClick());
    assert.equal(view.root.findAllByType(Home).length, 1);
    assert.equal(view.root.findAllByType(Chassis).length, 0);
    await click(view.root, 'New Setup');
    assert.ok(heading(view.root, car + ' Setup Sheet'));
    assert.equal(view.root.findAllByType(Chassis).length, 1);
    assert.equal(view.root.findAllByType(Home).length, 0);
    await click(view.root, 'Back to landing');
    assert.equal(view.root.findAllByType(Home).length, 1);
    assert.deepEqual(fixture.initializations, []);
    assert.deepEqual(fixture.metadataWrites, []);
    await act(async () => view.unmount());
  });
}

// Execute the actual dashboard effects and New Setup handler. This catches
// restoration of a recent setup (including Custom Car) after initialization.
function dashboardEffect(marker, scope) {
  const source = readFileSync(new URL('../src/components/SetupDashboard.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('dashboard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[0]?.getText(ast).includes(marker)) expression = node.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(expression, marker);
  const js = ts.transpileModule('const callback = ' + expression, { compilerOptions: { target: ts.ScriptTarget.ES2021 } }).outputText;
  return new Function(...Object.keys(scope), js + '\nreturn callback;')(...Object.values(scope));
}

test('E/F: actual dashboard blocks stale setup restoration after selection, keeps returning landing and explicit New Setup', async () => {
  let route = 'home';
  let reads = 0;
  let resume = false;
  const scope = { stateLoaded: true, resumeAttempted: false, landingRequest: 1, selectedCar: 'Custom Car', CUSTOM_CAR: 'Custom Car', savedMeta: {},
    setActiveView: value => { route = value; }, setResumeAttempted: value => { resume = value; },
    setActiveTab() {}, readSavedDashboardRoute: () => { reads++; return { view: 'setup', timestamp: Date.now() }; }, IDLE_HOME_TIMEOUT_MS: 1800000 };
  dashboardEffect('const restoreSavedRoute', scope)();
  assert.equal(route, 'home');
  assert.equal(reads, 0, 'no recent setup opened/read simply because a class was selected');
  route = 'setup';
  dashboardEffect('A successful initial selection/class change', scope)();
  assert.equal(route, 'home', 'a class change while editing returns to landing');
  assert.equal(resume, true);
  dashboardEffect('const restoreSavedRoute', { ...scope, landingRequest: 0, selectedCar: 'Dwarf Cars', readSavedDashboardRoute: () => null })();
  assert.equal(route, 'home', 'configured returning user without an intentional recent route enters home');
  const onNew = componentFunction('SetupDashboard.tsx', 'handleNewSetupClick', { workspaceHasData: () => false, savedMeta: {}, setDeletedSessionSlots() {}, setAddedSessionSlots() {}, setActiveView: value => { route = value; } });
  let view;
  await act(async () => { view = create(React.createElement(Home, { selectedCar: 'Shifter Kart', onChangeClass() {}, onAction: action => { assert.equal(action, 'new-setup'); onNew(); } })); });
  await click(view.root, 'New Setup');
  assert.equal(route, 'setup');
  // Existing intentional resume remains available outside class selection.
  dashboardEffect('const restoreSavedRoute', { ...scope, landingRequest: 0, selectedCar: 'Dwarf Cars', activeTab: 'base', ALL_SLOTS: ['base'], deletedSessionSlots: {}, orderedSessions: ['base'], setups: {}, tabHasData: () => false })();
  assert.equal(route, 'setup');
  await act(async () => view.unmount());
});

test('class selection cannot autosave a restored draft before an explicit editor action', async () => {
  let intervalCallback;
  let saves = 0;
  const scope = { user: { id: 'new-id' }, landingRequest: 1, activeView: 'home', savedMeta: { name: 'Restored draft' }, AUTOSAVE_MS: 300000,
    setInterval: callback => { intervalCallback = callback; return 1; }, clearInterval() {}, performSave: async () => { saves++; return true; }, setLastAutoSave() {} };
  dashboardEffect('landingRequest > 0 && activeView', scope)();
  assert.equal(intervalCallback, undefined);
  assert.equal(saves, 0);
  dashboardEffect('landingRequest > 0 && activeView', { ...scope, activeView: 'setup' })();
  intervalCallback();
  await Promise.resolve();
  assert.equal(saves, 1, 'explicit editor action retains existing named-file autosave');
});
