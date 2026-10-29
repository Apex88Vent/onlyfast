// Mounted component checks; external renderer matches the existing QA harness.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import * as road from '../src/lib/roadTrackFeedback.ts';
import * as library from '../src/lib/setupLibrary.ts';
import * as configs from '../src/lib/classConfigs.ts';
import * as access from '../src/lib/setupLibraryAccess.ts';
import * as pavementValues from '../src/lib/pavementSetupValues.ts';
import { formatSetupAssistResponse } from '../supabase/functions/_shared/setup-assist-response.ts';

const qaRequire = createRequire(process.env.REACT_TEST_RENDERER_MODULE);
const React = qaRequire('react');
const { create, act } = qaRequire(process.env.REACT_TEST_RENDERER_MODULE);
function compile(file, modules = {}) {
  const source = readFileSync(new URL(`../src/components/${file}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true } }).outputText;
  const output = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (name === 'react') return React;
    if (name.startsWith('react/')) return qaRequire(name);
    if (name === '@/lib/roadTrackFeedback') return road;
    if (name === '@/lib/setupLibrary') return library;
    if (name === '@/hooks/useMembershipRevision') return { useMembershipRevision: () => 0 };
    if (name === '@/lib/nativeAds') return { nativeAds: {
      suspend: () => () => {}, beginSetupAssistDismissal: () => null, completeSetupAssistDismissal: () => 'suppressed',
    } };
    if (name === './LockedFeatureNotice') return { __esModule: true, default: compile('LockedFeatureNotice.tsx', {
      'react-router-dom': { Link: ({ to, children, ...props }) => React.createElement('a', { ...props, href: to }, children) },
    }) };
    if (name in modules) return { __esModule: true, ...modules[name] };
    throw new Error(`Unstubbed dependency ${name}`);
  }, output, output.exports);
  return output.exports.default;
}
const text = node => typeof node === 'string' ? node : (node.children || []).map(text).join('');
const RoadMap = compile('RoadCourseTrack.tsx');
const OvalMap = compile('DirtOvalTrack.tsx');
const PavementMap = compile('PavementOvalTrack.tsx', { './DirtOvalTrack': { default: OvalMap } });
const Chassis = compile('ChassisSetupForm.tsx', {
  '@/lib/classConfigs': configs,
  '@/lib/setupLibraryAccess': access,
  '@/lib/pavementSetupValues': pavementValues,
  '@/hooks/useBetaFeatures': { useBetaFeatures: () => ({}) },
});

test('mounted road map has six controls on the course, one S control, and cycles by click and keyboard', async () => {
  let data = {};
  let view;
  const props = () => ({ data, onChange: (key, value) => { data = { ...data, [key]: value }; view.update(React.createElement(RoadMap, props())); } });
  await act(async () => { view = create(React.createElement(RoadMap, props())); });
  const controls = () => view.root.findAllByProps({ role: 'button' });
  assert.equal(controls().length, 6);
  assert.equal(view.root.findAllByType('button').length, 0, 'no separate controls below the course');
  assert.equal(controls().filter(button => button.props['aria-label'].startsWith('High Speed S Turns')).length, 1);
  for (const [index, zone] of road.ROAD_TRACK_ZONES.entries()) {
    const hitPath = controls()[index].findByProps({ 'data-road-zone': zone.key });
    assert.equal(hitPath.props.pointerEvents, 'stroke');
    assert.equal(hitPath.props.stroke, 'transparent');
    assert.equal(controls()[index].parent.type, 'svg');
    assert.equal(controls()[index].props.tabIndex, 0);
    assert.match(text(controls()[index]), /Tap to Set/);
    for (const expected of road.roadHandlingOptions(zone.key).slice(1).concat('')) {
      await act(async () => controls()[index].props.onClick());
      assert.equal(data[zone.key], expected);
      assert.match(text(controls()[index]), new RegExp(road.roadHandlingLabel(expected)));
    }
    let prevented = false;
    await act(async () => controls()[index].props.onKeyDown({ key: 'Enter', preventDefault() { prevented = true; } }));
    assert.equal(prevented, true);
    assert.equal(data[zone.key], road.roadHandlingOptions(zone.key)[1]);
    await act(async () => controls()[index].props.onKeyDown({ key: ' ', preventDefault() {} }));
    assert.equal(data[zone.key], road.roadHandlingOptions(zone.key)[2]);
    await act(async () => controls()[index].props.onKeyDown({ key: 'ArrowRight', preventDefault() { throw new Error('Unrelated key must not activate'); } }));
    assert.equal(data[zone.key], road.roadHandlingOptions(zone.key)[2]);
  }
  await act(async () => view.unmount());
});

test('road refinement keeps the geometry, blue section labels, white background and no track overlays', async () => {
  const saved = Object.fromEntries(road.ROAD_TRACK_KEYS.map(key => [key, key === 'road_straightaway' ? 'under_geared' : 'understeer']));
  let view;
  let changes = 0;
  await act(async () => { view = create(React.createElement(RoadMap, { data: saved, onChange() { changes++; } })); });
  const svg = view.root.findByType('svg');
  assert.equal(svg.props.className, 'block w-full h-auto');
  assert.equal(svg.props.viewBox, '0 -30 700 425');
  assert.ok(!view.root.findByType('section').props.className.includes('p-6'), 'the map has no horizontal panel padding');
  const sPath = view.root.findByProps({ 'data-road-zone': 'road_high_speed_s_turns' }).props.d;
  assert.equal((sPath.match(/C/g) || []).length, 3, 'three flowing bends');
  assert.equal((sPath.match(/L/g) || []).length, 2, 'straight before and after the three bends');
  assert.equal(svg.findAllByType('text').filter(node => text(node) === 'Straightaway').length, 1);
  for (const label of svg.findAllByType('text').filter(label => label.parent.props.pointerEvents === 'none')) {
    assert.equal(label.props.fill || label.parent.props.fill, '#00A8E8');
    assert.equal(label.props.fontWeight || label.parent.props.fontWeight, 'bold');
  }
  assert.equal(svg.findAllByType('rect').filter(rect => rect.props['data-road-input-box']).length, 6);
  assert.ok(svg.findAllByType('rect').filter(rect => !rect.props['data-road-input-box']).every(rect => rect.props.fill === 'transparent'), 'no extra label backgrounds or large selection boxes');
  assert.ok(svg.findAllByType('path').filter(path => path.props.fill === 'none').every(path => ['#9CA3AF', '#374151', 'white', 'transparent'].includes(path.props.stroke)), 'saved conditions do not overlay a colored region on the artwork');
  assert.equal(view.root.findByType('p').children.join(''), 'Tap to input handling characteristics');
  assert.equal(svg.findAllByType('tspan').length, 6, 'three section titles stack into two lines');
  assert.equal(svg.findByProps({ 'data-road-infield': true }).props.fill, '#7CB668');
  assert.equal(svg.findAllByProps({ 'data-road-runoff': true }).length, 0, 'sand runoff is removed');
  for (const [index, zone] of road.ROAD_TRACK_ZONES.entries()) {
    const control = svg.findAllByProps({ role: 'button' })[index];
    assert.ok(control.props['aria-label'].includes(road.roadHandlingLabel(saved[zone.key])));
    assert.equal(control.props.className, 'group cursor-pointer outline-none');
    assert.equal(control.findByProps({ 'data-road-input-box': zone.key }).props.className, 'group-focus-visible:stroke-[#00A8E8]', 'keyboard focus stays local to the input box');
  }
  assert.equal(changes, 0, 'loading the refined map never clears or rewrites saved selections');
  await act(async () => view.unmount());
});

test('six road input boxes match the dirt oval reference and show every selected state', async () => {
  let dirt, roadView;
  const props = { entryHandling: '', midHandling: '', exitHandling: '', onEntryChange() {}, onMidChange() {}, onExitChange() {} };
  await act(async () => {
    dirt = create(React.createElement(OvalMap, props));
    roadView = create(React.createElement(RoadMap, { data: {}, onChange() {} }));
  });
  const dirtControl = dirt.root.findAllByProps({ role: 'button' })[0];
  const referenceBox = dirtControl.findByType('rect');
  const referenceText = dirtControl.findAllByType('text');
  const boxes = roadView.root.findAllByProps({ role: 'button' });
  assert.equal(boxes.length, 6);
  assert.deepEqual(boxes.map(box => text(box.findAllByType('text')[0])), ['ENTRY', 'EXIT', 'ENTRY', 'EXIT', 'S TURNS', 'STRAIGHT']);
  for (const [index, zone] of road.ROAD_TRACK_ZONES.entries()) {
    const box = boxes[index].findByProps({ 'data-road-input-box': zone.key });
    for (const property of ['width', 'height', 'rx', 'fill', 'opacity']) assert.equal(box.props[property], referenceBox.props[property]);
    const labels = boxes[index].findAllByType('text');
    for (const [labelIndex, label] of labels.entries()) {
      for (const property of ['fontSize', 'fill', 'fontWeight', 'opacity', 'textAnchor']) assert.equal(label.props[property], referenceText[labelIndex].props[property]);
    }
    assert.equal(text(labels[1]), 'Tap to Set');
    for (const value of road.roadHandlingOptions(zone.key).slice(1)) {
      await act(async () => roadView.update(React.createElement(RoadMap, { data: { [zone.key]: value }, onChange() {} })));
      const updated = roadView.root.findAllByProps({ role: 'button' })[index];
      assert.equal(updated.findByProps({ 'data-road-input-box': zone.key }).props.fill, road.roadHandlingColor(value));
      assert.equal(text(updated.findAllByType('text')[1]), road.roadHandlingLabel(value));
    }
  }
  await act(async () => { dirt.unmount(); roadView.unmount(); });
});

test('road setup heading is removed while fields and other disciplines remain intact', async () => {
  for (const [car, config] of Object.entries(library.EXPANDED_CLASS_CONFIGS)) {
    if (config.category !== 'road_course' && car !== 'Legends') continue;
    let view;
    await act(async () => { view = create(React.createElement(Chassis, { raceClass: car, data: {}, customFields: [], onChange() {} })); });
    assert.equal(/(?:Development )?Setup sheet/i.test(text(view.toJSON())), car === 'Legends', car);
    assert.ok(view.root.findAllByType('input').length > 0, 'setup fields retained for ' + car);
    assert.ok(view.root.findAllByType('section').length >= config.extraSections.length, 'setup sections retained for ' + car);
    await act(async () => view.unmount());
  }
});

test('inline house ads keep a fixed footprint through every slide and reserve space while loading', async () => {
  const originalWindow = globalThis.window;
  const timers = new Map();
  let timerId = 0;
  globalThis.window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: id => timers.delete(id),
  };
  const icon = props => React.createElement('span', props);
  const Ad = compile('RookieHouseAdContent.tsx', {
    'react-router-dom': { useNavigate: () => () => {} },
    'lucide-react': { ArrowRight: icon, CheckCircle2: icon, Flag: icon, Gauge: icon, Sparkles: icon },
    '@/lib/membership': { setPendingPlan() {} },
    '@/lib/paymentVisibility': { hideExternalPayments: false, isMedianIOSApp: false },
  });
  let view;
  try {
    for (const placement of ['home_middle', 'home_bottom', 'setup_track_conditions', 'setup_dashboard_bottom', 'setup_session_bottom', 'parts_reference_bottom', 'schedule_bottom', 'timing_scan_bottom', 'todo_bottom']) {
      await act(async () => { view = create(React.createElement(Ad, { placement })); });
      for (const tone of ['red', 'blue', 'pro']) {
        const button = view.root.findByType('button');
        assert.equal(button.props['data-slide-tone'], tone);
        assert.ok(button.props.className.includes('h-[160px]'));
        assert.ok(button.findAllByType('span').some(span => span.props.className?.includes('flex h-full items-center')));
        if (tone === 'pro') assert.ok(text(button).includes('Unlock all features. No ads.'));
        const advance = timers.values().next().value;
        assert.equal(typeof advance, 'function');
        await act(async () => advance());
      }
      await act(async () => view.unmount());
      view = null;
    }
    const slot = readFileSync(new URL('../src/components/RookieAdSlot.tsx', import.meta.url), 'utf8');
    assert.match(slot, /Suspense fallback=[\s\S]*?h-\[160px\]/);
  } finally {
    if (view) await act(async () => view.unmount());
    globalThis.window = originalWindow;
  }
});

test('mounted pavement oval changes only surface colors, keeping dirt geometry and keyboard/click behavior', async () => {
  const changes = [];
  const props = { entryHandling: '', midHandling: '', exitHandling: '', onEntryChange: value => changes.push(['entry', value]), onMidChange: value => changes.push(['mid', value]), onExitChange: value => changes.push(['exit', value]) };
  let dirt, pavement;
  await act(async () => { dirt = create(React.createElement(OvalMap, props)); pavement = create(React.createElement(PavementMap, props)); });
  assert.deepEqual(pavement.root.findAllByType('path').map(path => path.props.d), dirt.root.findAllByType('path').map(path => path.props.d));
  assert.equal(dirt.root.findAllByType('stop')[0].props.stopColor, '#C4A882');
  assert.equal(pavement.root.findAllByType('stop')[0].props.stopColor, '#374151');
  for (const view of [dirt, pavement]) {
    const controls = view.root.findAllByProps({ role: 'button' });
    assert.equal(controls.length, 3);
    await act(async () => controls[0].props.onClick());
    await act(async () => controls[1].props.onKeyDown({ key: 'Enter', preventDefault() {} }));
    await act(async () => controls[2].props.onKeyDown({ key: ' ', preventDefault() {} }));
  }
  assert.deepEqual(changes, [...Array(2)].flatMap(() => [['entry', 'loose'], ['mid', 'loose'], ['exit', 'loose']]));
  await act(async () => { dirt.unmount(); pavement.unmount(); });
});

test('original inline upgrade design works on Android, iOS and web while preserving the iOS post-save Continue behavior', async () => {
  const previousWindow = globalThis.window;
  globalThis.window = { matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) };
  const icon = props => React.createElement('span', props);
  try {
    for (const platform of ['android', 'ios', 'web']) {
      const navigation = []; let pending = 0; let continued = 0;
      const Ad = compile('RookieHouseAdContent.tsx', {
        'react-router-dom': { useNavigate: () => (...args) => navigation.push(args) },
        'lucide-react': { ArrowRight: icon, CheckCircle2: icon, Flag: icon, Gauge: icon, Sparkles: icon },
        '@/lib/membership': { setPendingPlan() { pending++; } },
        '@/lib/paymentVisibility': { hideExternalPayments: platform !== 'web', isMedianIOSApp: platform === 'ios' },
      });
      let view;
      await act(async () => { view = create(React.createElement(Ad, { placement: 'home_middle' })); });
      assert.equal(view.root.findAllByType('button').length, 1);
      assert.match(text(view.toJSON()), /Unlock all features. No ads./);
      await act(async () => { view.root.findByType('button').props.onClick(); });
      assert.deepEqual(navigation, [['/upgrade', { state: { plan: 'pro' } }]]);
      assert.equal(pending, platform === 'web' ? 1 : 0, 'native house ad must not enable external payment state');
      await act(async () => { view.unmount(); });
      if (platform === 'ios') {
        await act(async () => { view = create(React.createElement(Ad, { placement: 'after_save_interstitial', onContinue: () => { continued++; } })); });
        assert.equal(text(view.toJSON()), 'Continue');
        await act(async () => { view.root.findByType('button').props.onClick(); }); assert.equal(continued, 1);
        await act(async () => { view.unmount(); });
      }
    }
  } finally { globalThis.window = previousWindow; }
});

test('both What If CTAs use one panel without automatic requests; failures hide bottom CTA', async () => {
  const originalWindow = globalThis.window;
  globalThis.window = new EventTarget();
  const requests = [];
  let token = 'test-token';
  const suggestion = formatSetupAssistResponse(JSON.stringify({ summary: 'Test fixture', recommended_changes: ['One action'], why_reasoning: ['One reason'], expected_effect: ['One effect'], notes_cautions: [] }));
  const Feedback = compile('HandlingFeedback.tsx', {
    '@/lib/supabase': { supabase: { auth: { getSession: async () => ({ data: { session: token ? { access_token: token } : null } }) }, functions: { invoke: async (name, options) => { requests.push({ name, ...options }); return { data: { suggestion } }; } } } },
    '@/lib/membership': { getEffectiveTier: () => 'team', readMembership: () => ({}), checkSetupAssistPermission: () => ({ allowed: true }) },
    '@/lib/onlylapsSessionScope': { ONLYLAPS_SESSION_LINK_CHANGED_EVENT: 'test-link-event' },
  });
  let view;
  try {
    await act(async () => { view = create(React.createElement(Feedback, { entryHandling: '', midHandling: '', exitHandling: '', setupData: { road_low_speed_entry: 'understeer', road_straightaway: 'under_geared' }, raceClass: 'road_gt3', user: { id: 'test' }, raceWeekendKey: 'Saved Weekend' })); });
    const buttons = () => view.root.findAllByType('button');
    const ctas = () => buttons().filter(button => text(button) === 'What If?');
    const suggestions = () => view.root.findAllByProps({ 'aria-label': 'AI setup suggestions' });
    const query = () => buttons().find(button => text(button).includes('Get Setup Suggestions'));
    assert.equal(ctas().length, 1);
    assert.equal(query().props.disabled, false, 'road-only feedback enables suggestions');
    assert.equal(requests.length, 0);
    await act(async () => query().props.onClick());
    assert.equal(ctas().length, 2);
    assert.equal(suggestions().length, 1);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].body.discipline, 'road_course');
    const headings = () => suggestions()[0].findAllByType('h4').map(text);
    const firstHeadings = headings();
    assert.deepEqual(firstHeadings, ['Summary', 'Recommended Changes', 'Why / Reasoning', 'Expected Effect', 'Notes / Cautions']);
    await act(async () => ctas()[1].props.onClick());
    assert.equal(view.root.findAllByProps({ id: 'what-if-panel' }).length, 1);
    assert.equal(requests.length, 1);
    await act(async () => ctas()[0].props.onClick());
    assert.equal(view.root.findAllByProps({ id: 'what-if-panel' }).length, 0);
    await act(async () => ctas()[1].props.onClick());
    assert.equal(view.root.findAllByProps({ id: 'what-if-panel' }).length, 1);
    const input = view.root.findAllByType('input').find(input => input.props.placeholder?.startsWith('What if'));
    await act(async () => input.props.onChange({ target: { value: 'What if I change gearing?' } }));
    await act(async () => buttons().find(button => text(button) === 'Ask').props.onClick());
    assert.equal(requests.length, 2);
    assert.equal(requests[1].body.whatIfQuestion, 'What if I change gearing?');
    assert.equal(requests[1].body.currentSetup.road_straightaway, 'under_geared');
    assert.equal(view.root.findAllByProps({ 'aria-label': 'What-if analysis result' }).length, 1);
    assert.equal(suggestions().length, 1);
    await act(async () => query().props.onClick());
    assert.deepEqual(headings(), firstHeadings);
    assert.equal(suggestions().length, 1);
    token = '';
    await act(async () => query().props.onClick());
    assert.equal(ctas().length, 1, 'an error message is not a successful suggestion');
    assert.equal(requests.length, 3);
  } finally {
    if (view) await act(async () => view.unmount());
    globalThis.window = originalWindow;
  }
});

test('real map selections feed matching speed/phase keys into Setup Assist and What If', async () => {
  const originalWindow = globalThis.window;
  globalThis.window = new EventTarget();
  const requests = [];
  const Feedback = compile('HandlingFeedback.tsx', {
    '@/lib/supabase': { supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'test' } } }) }, functions: { invoke: async (_name, options) => { requests.push(options.body); return { data: { suggestion: 'Test fixture' } }; } } } },
    '@/lib/membership': { getEffectiveTier: () => 'team', readMembership: () => ({}), checkSetupAssistPermission: () => ({ allowed: true }) },
    '@/lib/onlylapsSessionScope': { ONLYLAPS_SESSION_LINK_CHANGED_EVENT: 'test-link-event' },
  });
  function Harness() {
    const [data, setData] = React.useState({});
    return React.createElement(React.Fragment, null,
      React.createElement(RoadMap, { data, onChange: (key, value) => setData(previous => ({ ...previous, [key]: value })) }),
      React.createElement(Feedback, { entryHandling: 'tight', midHandling: 'loose', exitHandling: 'perfect', setupData: data, raceClass: 'road_gt3', user: { id: 'test' }, raceWeekendKey: 'Saved Weekend' }),
    );
  }
  let view;
  try {
    await act(async () => { view = create(React.createElement(Harness)); });
    const selections = [1, 2, 3, 1, 2, 2];
    const expected = {};
    for (const [index, zone] of road.ROAD_TRACK_ZONES.entries()) {
      for (let step = 0; step < selections[index]; step++) {
        await act(async () => view.root.findByProps({ 'data-road-input-box': zone.key }).parent.parent.props.onClick());
      }
      expected[zone.key] = road.roadHandlingOptions(zone.key)[selections[index]];
    }
    const query = () => view.root.findAllByType('button').find(button => text(button).includes('Get Setup Suggestions'));
    await act(async () => query().props.onClick());
    assert.equal(requests[0].discipline, 'road_course');
    assert.deepEqual(requests[0].currentSetup, expected);
    await act(async () => view.root.findByProps({ 'data-road-input-box': 'road_high_speed_entry' }).parent.parent.props.onClick());
    await act(async () => query().props.onClick());
    assert.deepEqual(requests[1].currentSetup, { ...expected, road_high_speed_entry: '' }, 'only the selected high-speed entry field changes');
    await act(async () => view.root.findAllByType('button').find(button => text(button) === 'What If?').props.onClick());
    await act(async () => view.root.findAllByType('input').find(input => input.props.placeholder?.startsWith('What if')).props.onChange({ target: { value: 'What if I change the sway bar?' } }));
    await act(async () => view.root.findAllByType('button').find(button => text(button) === 'Ask').props.onClick());
    assert.deepEqual(requests[2].currentSetup, requests[1].currentSetup);
    assert.equal(requests[2].whatIfQuestion, 'What if I change the sway bar?');
  } finally {
    if (view) await act(async () => view.unmount());
    globalThis.window = originalWindow;
  }
});
