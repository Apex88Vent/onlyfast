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
import * as pavementValues from '../src/lib/pavementSetupValues.ts';
import { buildBetaAccessSnapshot, CLOSED_BETA_ACCESS, setCachedBetaAccess, clearCachedBetaAccess } from '../src/lib/betaFeatures.ts';
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
    if (name === '@/hooks/useMembershipRevision') return { useMembershipRevision: () => {} };
    if (name.startsWith('react/')) return qaRequire(name);
    if (name === 'lucide-react') return new Proxy({}, { get: () => icon });
    if (name === '@/hooks/useBetaFeatures') return { useBetaFeatures: () => ({ ...fixture.access, loading: fixture.betaLoading, hasBetaFeature: () => false }) };
    if (name === '@/lib/classConfigs') return configs;
    if (name === '@/lib/setupLibrary') return library;
    if (name === '@/lib/setupLibraryAccess') return access;
    if (name === '@/lib/customCar') return custom;
    if (name === '@/lib/pavementSetupValues') return pavementValues;
    if (name in modules) return { __esModule: true, ...modules[name] };
    throw new Error(`Unstubbed dependency ${name}`);
  }, output, output.exports);
  return output.exports.default;
}
const How = compile('components/HowOnlyFastWorks.tsx');
const membershipExports = {};
const planSource = readFileSync(new URL('../src/lib/membership.ts', import.meta.url), 'utf8').match(/export const PLANS:[\s\S]*?\n\];/)[0];
new Function('exports', ts.transpileModule(planSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(membershipExports);
const Plan = compile('components/PlanSelection.tsx', { '@/lib/membership': membershipExports, './MembershipComparison': { default: empty }, './MembershipPaidAction': { default: empty }, '@/lib/paymentVisibility': { hideExternalPayments: true }, '@/lib/nativePurchases': { nativePurchasesEnabled: false } });
const Selection = compile('components/OnboardingFlow.tsx', { './PlanSelection': { default: Plan } });
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
    getActiveClassState: async () => { if (fixture.offline) throw new Error('Offline'); return fixture.deferredState || { active_class: fixture.activeClass, unlimited: fixture.access === experiment, ...fixture.progress }; },
    saveOnboardingProgress: async (step, discipline, car) => {
      if (fixture.rejectProgress) throw new Error('Offline');
      fixture.progressWrites.push({ step, discipline, car });
      fixture.progress = { onboarding_step: step, onboarding_discipline: discipline, onboarding_race_class: car };
      return { active_class: fixture.activeClass, unlimited: fixture.access === experiment, ...fixture.progress };
    },
    completeRacingOnboarding: async () => {
      const car = fixture.progress.onboarding_race_class;
      fixture.initializations.push(car);
      if (fixture.rejectClass) throw new Error('CLASS_INVALID');
      fixture.activeClass = car;
      fixture.progress.onboarding_step = 'complete';
      return { active_class: car, unlimited: fixture.access === experiment, ...fixture.progress };
    },
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
    getActiveClassState: async () => ({ unlimited: fixture.access === experiment || fixture.team, can_change: fixture.access === experiment || fixture.eligible, next_eligible_at: '2026-11-12T15:30:00Z' }),
    changeActiveClass: async car => { fixture.initializations.push(car); if (fixture.rejectChange) throw new Error('CLASS_CHANGE_COOLDOWN:2026-11-12T15:30:00Z'); return { active_class: car }; },
    formatEligibleDate: value => value,
  },
});

function reset(options = {}) {
  fixture = { user: { id: 'new-id', user_metadata: {} }, activeClass: null, savedClass: null, access: CLOSED_BETA_ACCESS, betaLoading: false, metadataWrites: [], initializations: [], progress: {}, progressWrites: [], ...options };
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
const heading = (root, label) => root.findAll(n => ['h1', 'h2', 'h3'].includes(n.type) && text(n) === label).length > 0;
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
  assert.equal(categories.length, 3);
  await act(async () => categories[0].props.onClick());
  assert.ok(heading(view.root, 'Select Your Car'));
  assert.equal(buttons(view.root).some(b => /GT3|Legends/.test(text(b))), false);
  assert.equal(buttons(view.root).filter(b => / - /.test(b.props['aria-label'] || '')).length, 12);
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
  assert.deepEqual(fixture.metadataWrites, []);
  assert.equal(fixture.progress.onboarding_step, 'discipline');
  await act(async () => view.unmount());
});

test('C: flagged test@test.com sees three selectable disciplines, selects GT3; failed RPC cannot enter landing', async () => {
  reset({ user: { id: 'test-id', email: 'test@test.com', user_metadata: { onboarding_completed: true } }, access: experiment, rejectClass: true });
  const view = await mount();
  assert.ok(heading(view.root, 'Select Your Discipline'));
  const categories = buttons(view.root).filter(b => / - /.test(b.props['aria-label'] || ''));
  assert.equal(categories.length, 3);
  await act(async () => categories.find(b => b.props['aria-label'].startsWith('Road Racing -')).props.onClick());
  const gt3 = buttons(view.root).find(b => b.props['aria-label']?.startsWith('GT3 -'));
  assert.ok(gt3);
  await act(async () => gt3.props.onClick());
  assert.ok(heading(view.root, 'Choose Your OnlyFast Plan'));
  await click(view.root, 'Continue Free');
  assert.equal(landing(view.root), false);
  assert.match(view.root.findByProps({ role: 'alert' }).children.join(''), /could not be completed/);
  fixture.rejectClass = false;
  await click(view.root, 'Continue Free');
  assert.ok(landing(view.root));
  assert.deepEqual(fixture.initializations, ['road_gt3', 'road_gt3']);
  await act(async () => view.unmount());
});

test('unconfigured legacy user goes to restored discipline selection', async () => {
  reset({ user: { id: 'unflagged-test', email: 'test@test.com', user_metadata: { onboarding_completed: true } } });
  const view = await mount();
  assert.ok(heading(view.root, 'Select Your Discipline'));
  assert.equal(buttons(view.root).filter(b => / - /.test(b.props['aria-label'] || '')).length, 3);
  await act(async () => view.unmount());
});

test('login from onboarding rechecks the new account; dismissing login does not complete onboarding', async () => {
  reset({ user: null });
  const view = await mount();
  await click(view.root, 'Create Account / Sign In');
  await click(view.root, 'Dismiss login');
  assert.ok(heading(view.root, 'Welcome to OnlyFast'));
  assert.deepEqual(fixture.metadataWrites, []);
  await click(view.root, 'Create Account / Sign In');
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
  assert.equal(buttons(view.root).filter(b => / - /.test(b.props['aria-label'] || '')).length, 3);
  assert.deepEqual(fixture.metadataWrites, []);
  assert.deepEqual(fixture.initializations, []);
  await act(async () => view.unmount());
});

test('unavailable disciplines have no pointer/keyboard handlers, including flagged accounts and resumed plans', async () => {
  for (const accessSnapshot of [CLOSED_BETA_ACCESS, experiment]) {
    reset({ access: accessSnapshot });
    let view;
    await act(async () => { view = create(React.createElement(Selection, { onComplete: () => assert.fail('Unavailable completion') })); });
    for (const name of ['RC Racing', 'Motorcycle Racing']) {
      const card = view.root.findByProps({ 'aria-label': name + ' - Coming Soon' });
      assert.equal(String(card.props['aria-disabled']), 'true');
      assert.equal(card.props.onClick, undefined);
      assert.equal(card.props.onKeyDown, undefined);
      assert.equal(card.props.tabIndex, undefined);
      assert.match(text(card), /COMING SOON/);
    }
    await act(async () => view.unmount());
    for (const [discipline, car] of [['rc', 'RC 1/8 Buggy'], ['motorcycle', 'Supersport']]) {
      await act(async () => { view = create(React.createElement(Selection, { initialStep: 'plan', initialDiscipline: discipline,
        initialClass: car, onComplete: () => assert.fail('Unavailable completion'), onProgress: () => assert.fail('Unavailable progress') })); });
      assert.ok(heading(view.root, 'Select Your Discipline'));
      assert.equal(heading(view.root, 'Choose Your OnlyFast Plan'), false);
      await act(async () => view.unmount());
    }
  }
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
  await act(async () => view.root.findByProps({ id: 'active-discipline-select' }).props.onChange({ target: { value: 'road_course' } }));
  assert.ok(view.root.findByProps({ id: 'active-class-select' }).findAllByType('option').some(option => option.props.value === 'GT3'), 'historical vehicle remains selectable');
  await act(async () => view.root.findByProps({ id: 'active-class-select' }).props.onChange({ target: { value: 'GT3' } }));
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

test('Rookie and Pro see the warning before commit; Cancel writes nothing; Confirm changes once', async () => {
  for (const tier of ['rookie','pro']) {
    reset({ eligible: true });
    let closed = false;
    let selected;
    const props = { isOpen: true, user: { id: 'new-id' }, tier, currentClass: 'Dwarf Cars',
      onClose: () => { closed = true; }, onChanged: car => { selected = car; }, onUpgrade() {} };
    let view;
    await act(async () => { view = create(React.createElement(ChangeClass, props)); });
    await act(async () => view.root.findByProps({ id: 'active-discipline-select' }).props.onChange({ target: { value: 'road_course' } }));
    await act(async () => view.root.findByProps({ id: 'active-class-select' }).props.onChange({ target: { value: 'GT3' } }));
    await click(view.root, 'Continue');
    assert.ok(heading(view.root, 'Confirm vehicle change'));
    assert.match(text(view.root), /NOT be deleted/);
    assert.match(text(view.root), /once every 30 days/);
    assert.deepEqual(fixture.initializations, []);
    await click(view.root, 'Cancel');
    assert.equal(closed, true);
    assert.equal(selected, undefined);
    assert.deepEqual(fixture.initializations, []);
    closed = false;
    await click(view.root, 'Confirm Change');
    assert.deepEqual(fixture.initializations, ['GT3']);
    assert.equal(selected, 'GT3');
    await act(async () => view.unmount());
  }
});

test('server cooldown rejection after warning displays the authoritative eligible date', async () => {
  reset({ eligible: true, rejectChange: true });
  let view;
  await act(async () => { view = create(React.createElement(ChangeClass, { isOpen: true, user: fixture.user,
    tier: 'pro', currentClass: 'Dwarf Cars', onClose() {}, onChanged() { assert.fail('Blocked change'); }, onUpgrade() {} })); });
  await act(async () => view.root.findByProps({ id: 'active-class-select' }).props.onChange({ target: { value: 'Modified' } }));
  await click(view.root, 'Continue');
  await click(view.root, 'Confirm Change');
  assert.ok(heading(view.root, 'Class change unavailable'));
  assert.match(text(view.root), /2026-11-12T15:30:00Z/);
  await act(async () => view.unmount());
});

test('unfinished discipline, vehicle and plan steps resume from server after remount', async () => {
  for (const [step,title] of [['discipline','Select Your Discipline'],['vehicle','Select Your Car'],['plan','Choose Your OnlyFast Plan']]) {
    reset({ progress: { onboarding_step: step, onboarding_discipline: 'road_course', onboarding_race_class: 'GT3' } });
    let view = await mount();
    assert.ok(heading(view.root, title));
    assert.equal(landing(view.root), false);
    await act(async () => view.unmount());
    view = await mount();
    assert.ok(heading(view.root, title));
    assert.deepEqual(fixture.initializations, []);
    if (step === 'plan') {
      const paid = buttons(view.root).filter(b => text(b) === 'Coming Soon');
      assert.equal(paid.length, 2);
      for (const button of paid) { assert.equal(button.props.disabled, true); assert.equal(button.props.onClick, undefined); }
      await click(view.root, 'Continue Free');
      assert.ok(landing(view.root));
      assert.deepEqual(fixture.initializations, ['GT3']);
    }
    await act(async () => view.unmount());
  }
});

test('Dirt Track Dwarf Cars waits for Rookie selection and progress failures stay on the current step', async () => {
  reset();
  const view = await mount();
  await requiredSlides(view.root);
  await click(view.root, 'Skip');
  fixture.rejectProgress = true;
  await act(async () => buttons(view.root).find(b => b.props['aria-label']?.startsWith('Dirt Track Oval -')).props.onClick());
  assert.ok(heading(view.root, 'Select Your Discipline'));
  fixture.rejectProgress = false;
  await act(async () => buttons(view.root).find(b => b.props['aria-label']?.startsWith('Dirt Track Oval -')).props.onClick());
  await act(async () => buttons(view.root).find(b => b.props['aria-label']?.startsWith('Dwarf Cars -')).props.onClick());
  assert.ok(heading(view.root, 'Choose Your OnlyFast Plan'));
  assert.deepEqual(fixture.initializations, []);
  await click(view.root, 'Continue Free');
  assert.ok(landing(view.root));
  assert.deepEqual(fixture.initializations, ['Dwarf Cars']);
  await act(async () => view.unmount());
});

for (const car of ['road_spec_miata', 'road_gt3', 'road_karts', 'road_ta2']) {
  test('A/B/C: first-run Road Racing ' + car + ' initializes before landing, without requesting an editor', async () => {
    reset();
    const view = await mount();
    await requiredSlides(view.root);
    await click(view.root, 'Skip');
    const road = buttons(view.root).find(b => b.props['aria-label']?.startsWith('Road Racing -'));
    await act(async () => road.props.onClick());
    const selected = buttons(view.root).find(b => b.props['aria-label']?.startsWith(library.setupClassLabel(car) + ' -'));
    await act(async () => selected.props.onClick());
    assert.ok(heading(view.root, 'Choose Your OnlyFast Plan'));
    await click(view.root, 'Continue Free');
    assert.ok(landing(view.root));
    assert.equal(view.root.findByProps({ 'data-landing': true }).props['data-landing-request'], 1);
    assert.deepEqual(fixture.initializations, [car]);
    await act(async () => view.unmount());
  });
}

for (const car of ['road_karts']) {
  test('G/E: actual protected preview ends on real landing for ' + car + '; explicit New Setup opens its form', async () => {
    reset({ access: experiment });
    const view = await mount(Preview);
    await requiredSlides(view.root);
    await click(view.root, 'Skip to discipline selection');
    await act(async () => buttons(view.root).find(b => b.props['aria-label']?.startsWith('Road Racing -')).props.onClick());
    await act(async () => buttons(view.root).find(b => b.props['aria-label']?.startsWith(library.setupClassLabel(car) + ' -')).props.onClick());
    await click(view.root, 'Continue Free');
    assert.equal(view.root.findAllByType(Home).length, 1);
    assert.equal(view.root.findAllByType(Chassis).length, 0);
    await click(view.root, 'New Setup');
    assert.ok(heading(view.root, library.setupClassLabel(car) + ' Setup Sheet'));
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

const pavementClasses = ['Legends', 'Pavement Late Model', 'Stock Car / ARCA', 'Pavement Modified', 'Street Stock / Sportsman', 'Mini Stock / Compact'];
for (const car of pavementClasses) {
  test('pavement class selection: ' + car + ' initializes into landing without opening a form', async () => {
    reset({ access: experiment, user: { id: 'test-id', user_metadata: { onboarding_completed: true } } });
    const view = await mount();
    await act(async () => buttons(view.root).find(b => b.props['aria-label']?.startsWith('Pavement Oval -')).props.onClick());
    await act(async () => buttons(view.root).find(b => b.props['aria-label']?.startsWith(library.setupClassLabel(car) + ' -')).props.onClick());
    await click(view.root, 'Continue Free');
    assert.ok(landing(view.root));
    assert.equal(view.root.findAllByType(Chassis).length, 0);
    assert.deepEqual(fixture.initializations, [car]);
    await act(async () => view.unmount());
  });

  test('mounted ' + car + ': native corners, editable sections, weight display and real base/race serializer round trips', async () => {
    reset({ access: experiment });
    setCachedBetaAccess(experiment);
    const save = componentFunction('CreateBaseSetupView.tsx', 'buildPayload');
    const reopen = componentFunction('CreateBaseSetupView.tsx', 'loadTemplateIntoState');
    const race = componentFunction('SetupDashboard.tsx', 'buildPayload');
    let values = { raceClass: car, setup_name: 'Pavement baseline' };
    let view;
    const onChange = (key, value) => { values = { ...values, [key]: value }; view.update(React.createElement(Chassis, { raceClass: car, data: values, customFields: [], onChange })); };
    const field = key => view.root.find(n => ['input', 'select'].includes(n.type) && n.props.id?.endsWith('-' + key));
    const enter = async (key, value) => act(async () => field(key).props.onChange({ target: { value } }));
    try {
      await act(async () => { view = create(React.createElement(Chassis, { raceClass: car, data: values, customFields: [], onChange })); });
      for (const section of ['General Chassis', 'Four Corners', 'Front', 'Rear-End & Drivetrain']) assert.ok(heading(view.root, section));
      for (const legend of ['Left Front (LF)', 'Right Front (RF)', 'Left Rear (LR)', 'Right Rear (RR)']) assert.ok(view.root.findAllByType('legend').some(n => text(n) === legend));
      assert.equal(field('total_weight').props.readOnly, false);
      await enter('total_weight', '1500');
      const representative = {
        [car === 'Legends' ? 'engine_rpm' : car === 'Mini Stock / Compact' ? 'transmission_gear' : 'final_drive']: car === 'Mini Stock / Compact' ? '4th' : '7500',
        lf_cold_pressure: '17.5', lf_camber: '-1.5',
        [car === 'Pavement Modified' || car === 'Street Stock / Sportsman' ? 'pinion_angle' : car === 'Mini Stock / Compact' ? 'lr_toe' : 'rear_steer']: '-0.25',
        front_toe: '1/8', front_toe_direction: 'in',
        lf_corner_weight: '500', rf_corner_weight: '520', lr_corner_weight: '580', rr_corner_weight: '400',
      };
      for (const [key, value] of Object.entries(representative)) await enter(key, value);
      assert.equal(field('total_weight').props.value, '2000');
      assert.equal(field('total_weight').props.readOnly, true);
      assert.equal(field('cross_weight').props.value, '55');
      let row = JSON.parse(JSON.stringify(save(values)));
      assert.equal(row.race_class, car);
      await act(async () => view.unmount()); // leave the setup
      values = reopen(row);
      await act(async () => { view = create(React.createElement(Chassis, { raceClass: car, data: values, customFields: [], onChange })); });
      for (const [key, value] of Object.entries(representative)) assert.equal(field(key).props.value, value, key + ' reopened');
      await enter('lf_cold_pressure', '18.25');
      row = JSON.parse(JSON.stringify(save(values)));
      const copy = save({ ...reopen(row), setup_name: 'Renamed pavement copy' });
      assert.equal(copy.setup_name, 'Renamed pavement copy');
      assert.equal(copy.race_class, car);
      assert.equal(reopen(copy).lf_cold_pressure, '18.25');
      assert.equal(reopen(copy).total_weight, '2000');
      const raceRow = race(reopen(copy), 'base', 'Pavement race');
      assert.equal(raceRow.race_class, car);
      assert.equal(reopen(raceRow).lf_cold_pressure, '18.25');
    } finally { clearCachedBetaAccess(); await act(async () => view?.unmount()); }
  });
}
