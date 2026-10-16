import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import * as response from '../supabase/functions/_shared/setup-assist-response.ts';
import { recommendationReferencesTelemetryEvidence } from '../supabase/functions/_shared/setup-assist-onlylaps-context.ts';
import * as road from '../src/lib/roadTrackFeedback.ts';
import { EXPANDED_CLASS_CONFIGS } from '../src/lib/setupLibrary.ts';
import { createNewRaceWeekendSessions, savedSessionLabel } from '../src/lib/raceWeekendSessions.ts';
import { buildLibraryCustomFields, libraryFieldsFromRow, SETUP_LIBRARY_KEY } from '../src/lib/setupLibraryStorage.ts';
import { componentFunction } from './setupLibraryHarness.ts';

const answer = {
  summary: 'Entry pushes; the rear steps out on exit.',
  recommended_changes: ['25 lb/in is an example value to verify.', '## Try one change at a time.'],
  why_reasoning: ['- Explain the mechanical balance.'],
  expected_effect: ['Less entry understeer.'],
  notes_cautions: ['Telemetry evidence: measured minimum speed is 31 mph.'],
};

test('response format fixes five headings, strips model markup and preserves values and telemetry evidence', () => {
  const formatted = response.formatSetupAssistResponse(JSON.stringify(answer))!;
  assert.deepEqual(formatted.match(/^## .+$/gm), ['## Summary', '## Recommended Changes', '## Why / Reasoning', '## Expected Effect', '## Notes / Cautions']);
  assert.match(formatted, /- 25 lb\/in/);
  assert.match(formatted, /- Try one change at a time\./);
  assert.ok(recommendationReferencesTelemetryEvidence(formatted));
  assert.equal(response.SETUP_ASSIST_RESPONSE_FORMAT.json_schema.strict, true);
  assert.equal(response.SETUP_ASSIST_RESPONSE_FORMAT.json_schema.schema.additionalProperties, false);
});

test('incomplete/refused/malformed answers cannot become successful suggestions', () => {
  for (const value of [null, '', 'plain markdown', '{}', JSON.stringify({ ...answer, summary: '' }), JSON.stringify({ ...answer, expected_effect: [1] })]) {
    assert.equal(response.formatSetupAssistResponse(value), null);
  }
  assert.match(response.formatSetupAssistResponse(JSON.stringify({ ...answer, notes_cautions: [] }))!, /## Notes \/ Cautions\n- None specified\./);
});

test('road controls have exactly six zones and separate corner and straightaway cycles', () => {
  assert.equal(road.ROAD_TRACK_ZONES.length, 6);
  assert.equal(road.ROAD_TRACK_ZONES.filter(zone => zone.section === 'High Speed S Turns').length, 1);
  for (const zone of road.ROAD_TRACK_ZONES) {
    const expected = zone.key === 'road_straightaway' ? ['over_geared', 'under_geared', 'perfect', ''] : ['understeer', 'oversteer', 'perfect', ''];
    let value = '';
    for (const next of expected) { value = road.cycleRoadHandling(zone.key, value); assert.equal(value, next); }
  }
  assert.equal(road.readRoadHandling('road_straightaway', 'understeer'), '');
  assert.equal(road.readRoadHandling('road_high_speed_s_turns', 'over_geared'), '');
});

test('all road/pavement classes use new defaults while dirt and saved labels stay intact', () => {
  for (const [car, config] of Object.entries(EXPANDED_CLASS_CONFIGS)) {
    if (config.category === 'road_course' || config.category === 'pavement_oval') {
      assert.deepEqual(createNewRaceWeekendSessions(car).map(s => [s.setupType, s.label]), [['base', 'Practice'], ['heat', 'Qualifying'], ['main', 'Race']]);
      assert.equal(savedSessionLabel({ race_class: car, setup_type: 'heat' }), 'Qualifying');
      assert.equal(savedSessionLabel({ race_class: car, setup_type: 'heat', session_label: 'Heat from an older weekend' }), 'Heat from an older weekend');
    }
  }
  assert.deepEqual(createNewRaceWeekendSessions('Dwarf Cars').map(s => s.label), ['Hot Laps', 'Heat', 'Main Event']);
});

test('actual dashboard save/load preserves six road values independently per session/class', () => {
  const save = componentFunction('SetupDashboard.tsx', 'buildPayload', { selectedCar: 'road_gt3', sessionLabels: {}, TAB_LABELS: { base: { short: 'Practice' }, heat: { short: 'Qualifying' } } });
  const load = componentFunction('SetupDashboard.tsx', 'loadSetupIntoState');
  const state = { raceClass: 'road_gt3', ...Object.fromEntries(road.ROAD_TRACK_KEYS.map(key => [key, key === 'road_straightaway' ? 'under_geared' : 'understeer'])) };
  const base = save(state, 'base', 'Road Weekend');
  const heat = save({ ...state, road_low_speed_entry: 'oversteer' }, 'heat', 'Road Weekend');
  assert.equal(base.session_label, 'Practice');
  assert.equal(heat.session_label, 'Qualifying');
  for (const key of road.ROAD_TRACK_KEYS) assert.equal(load(base)[key], state[key]);
  assert.equal(load(heat).road_low_speed_entry, 'oversteer');
  assert.equal(load(base).road_low_speed_entry, 'understeer');
  assert.deepEqual(libraryFieldsFromRow({ ...base, race_class: 'road_gt4' }), {});
  const restored = load(base);
  const cleared = buildLibraryCustomFields('road_gt3', { ...restored, ...road.emptyRoadTrackFeedback() });
  assert.equal((cleared[SETUP_LIBRARY_KEY] as { values: Record<string, string> }).values.road_low_speed_entry, '');
});

test('copying chassis and applying a template clears road feedback as it clears oval feedback', () => {
  for (const fn of ['handleCopyLastSetup', 'handleCopyFromPastSetup', 'handleApplyBaseTemplate']) {
    let next;
    const source = { raceClass: 'road_gt3', road_low_speed_entry: 'oversteer', entry_handling: 'tight' };
    const action = componentFunction('SetupDashboard.tsx', fn, { ...road, activeTab: 'heat', selectedCar: 'road_gt3', setups: { base: source, heat: { ...source }, main: {} }, setSetups: update => { next = update({ base: source, heat: source }); }, setShowCopyFromPast() {}, setBaseTemplateMessage() {}, setTimeout() {}, setActiveTab() {}, setActiveView() {}, loadSetupIntoState: () => source });
    action({ race_class: 'road_gt3', setup_name: 'Template' });
    const result = fn === 'handleApplyBaseTemplate' ? next.base : next.heat;
    assert.equal(result.entry_handling, '');
    road.ROAD_TRACK_KEYS.forEach(key => assert.equal(result[key], ''));
  }
});

// Run the actual edge-function handler with mocked infrastructure, inspecting
// the generated API request instead of spending credits or mutating live data.
function edgeHandler() {
  let handler: (req: Request) => Promise<Response>;
  let requestBody: any;
  let content: unknown = JSON.stringify(answer);
  const file = readFileSync(new URL('../supabase/functions/get-suggestions/index.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(file, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } });
  const modules = {
    '../_shared/setup-assist-response.ts': response,
    'https://esm.sh/@supabase/supabase-js@2': { createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'test', app_metadata: { has_admin_full_access: true } } } }) } }) },
    '../_shared/beta-features.ts': { hasBetaFeatureForUser: async () => false },
    '../_shared/onlylaps-setup-context-store.ts': { createOnlyLapsSetupContextStore: () => ({}) },
    '../_shared/setup-assist-onlylaps-context.ts': { loadSetupAssistOnlyLapsPromptContext: async () => ({ promptContext: null, debug: {} }), appendOnlyLapsTelemetryToSetupAssistPrompt: (prompt: string) => prompt, toBetaSetupAssistTelemetryDebug: () => null },
  };
  new Function('require', 'exports', 'Deno', 'fetch', 'console', code.outputText)(name => modules[name], {}, { env: { get: () => 'test' }, serve: callback => { handler = callback; } }, async (_url, options) => { requestBody = JSON.parse(options.body); return new Response(JSON.stringify({ choices: [{ message: { content } }] })); }, { log() {}, error() {} });
  return { call: (body: object, auth = true) => handler(new Request('http://test', { method: 'POST', headers: { ...(auth ? { Authorization: 'Bearer test' } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify(body) })), body: () => requestBody, setContent: (value: unknown) => { content = value; } };
}

test('suggestions and What If use correct dirt meanings, strict formatting and unchanged model/auth scope', async () => {
  for (const whatIfQuestion of [undefined, 'What if I soften the front spring?']) {
    const edge = edgeHandler();
    const result = await edge.call({ raceClass: 'Dwarf Cars', entry_handling: 'tight', exit_handling: 'loose', whatIfQuestion, race_weekend_key: 'Weekend' });
    assert.equal(result.status, 200);
    const body = edge.body();
    assert.equal(body.model, 'gpt-4o-mini');
    assert.deepEqual(body.response_format, response.SETUP_ASSIST_RESPONSE_FORMAT);
    assert.match(body.messages[0].content, /Tight means.*pushes, understeers, or resists rotation/);
    assert.match(body.messages[0].content, /Loose means the rear steps out.*oversteers/);
    assert.match(body.messages[1].content, /Corner Entry: tight/);
    assert.equal((await result.json()).suggestion, response.formatSetupAssistResponse(JSON.stringify(answer)));
    assert.equal((await edge.call({ race_weekend_key: 'Weekend' }, false)).status, 401);
    assert.equal((await edge.call({})).status, 400);
    edge.setContent(null);
    assert.equal((await edge.call({ race_weekend_key: 'Weekend' })).status, 502);
  }
});

test('road/pavement requests use their discipline and supplied fields instead of dirt-only adjustments', async () => {
  for (const discipline of ['road_course', 'pavement_oval']) {
    const edge = edgeHandler();
    const result = await edge.call({ discipline, raceClass: 'road_gt3', currentSetup: { road_low_speed_entry: 'understeer', road_straightaway: 'over_geared', rf_spring_rate: '140' }, race_weekend_key: 'Weekend' });
    assert.equal(result.status, 200);
    const prompt = edge.body().messages[1].content;
    assert.match(prompt, discipline === 'road_course' ? /expert road course racing/ : /expert pavement oval racing/);
    assert.match(prompt, /"rf_spring_rate":"140"/);
    assert.doesNotMatch(prompt, /Stagger: N\/A/);
    if (discipline === 'road_course') { assert.match(prompt, /Low Speed Turn Entry: understeer/); assert.match(prompt, /Straightaway: over geared/); assert.equal((prompt.match(/High Speed S Turns \(whole section\)/g) || []).length, 1); }
  }
});

test('Setup Assist and What If keep speed and phase feedback separate and require zone-specific advice', async () => {
  const values = {
    road_low_speed_entry: 'understeer', road_low_speed_exit: 'oversteer',
    road_high_speed_entry: 'perfect', road_high_speed_exit: 'understeer',
    road_high_speed_s_turns: 'oversteer', road_straightaway: 'under_geared',
  };
  for (const whatIfQuestion of [undefined, 'What if I adjust the front sway bar?']) {
    const edge = edgeHandler();
    const result = await edge.call({ discipline: 'road_course', raceClass: 'road_gt3', currentSetup: values, whatIfQuestion, race_weekend_key: 'Weekend' });
    assert.equal(result.status, 200);
    const [system, user] = edge.body().messages;
    for (const line of [
      'Low Speed Turn Entry: understeer', 'Low Speed Turn Exit: oversteer',
      'High Speed Turn Entry: perfect', 'High Speed Turn Exit: understeer',
      'High Speed S Turns (whole section): oversteer', 'Straightaway: under geared',
    ]) assert.ok(user.content.includes(line), line);
    assert.ok(system.content.includes(response.ROAD_HANDLING_INSTRUCTIONS));
    assert.match(system.content, /exact affected zone label and its reported condition/);
    assert.match(system.content, /perfect as a zone to preserve/);
    assert.match(system.content, /not specified as unknown/);
  }
  const dirt = edgeHandler();
  await dirt.call({ discipline: 'dirt_oval', race_weekend_key: 'Weekend' });
  assert.ok(!dirt.body().messages[0].content.includes(response.ROAD_HANDLING_INSTRUCTIONS), 'road instructions do not change dirt assistance');
});
