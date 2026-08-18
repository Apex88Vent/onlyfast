import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dashboard = readFileSync(
  new URL('../src/components/SetupDashboard.tsx', import.meta.url),
  'utf8',
);
const savedSetups = readFileSync(
  new URL('../src/components/SavedSetups.tsx', import.meta.url),
  'utf8',
);
const baseEditor = readFileSync(
  new URL('../src/components/CreateBaseSetupView.tsx', import.meta.url),
  'utf8',
);
const home = readFileSync(
  new URL('../src/components/HomeLanding.tsx', import.meta.url),
  'utf8',
);
const migration = readFileSync(
  new URL('../supabase/migrations/20260817_link_race_setups_to_schedule.sql', import.meta.url),
  'utf8',
);
const resolver = readFileSync(
  new URL('../src/lib/raceSetupResolution.ts', import.meta.url),
  'utf8',
);
const scanTiming = readFileSync(
  new URL('../src/components/ScanTimingScreen.tsx', import.meta.url),
  'utf8',
);
const timingDisplay = readFileSync(
  new URL('../src/components/TimingDataDisplay.tsx', import.meta.url),
  'utf8',
);
const scheduleForm = readFileSync(
  new URL('../src/components/RaceScheduleForm.tsx', import.meta.url),
  'utf8',
);

test('Saved Setups routes an exact Base Setup row into the existing base editor', () => {
  assert.match(savedSetups, /if \(isBaseSetupRow\(clicked\)\)[\s\S]*onLoadBaseSetup\(clicked\)/);
  assert.match(dashboard, /if \(isBaseTemplateSetup\(setup\)\)[\s\S]*setBaseTemplateToEdit\(setup\)[\s\S]*setActiveView\('create-base'\)/);
  assert.match(baseEditor, /setEditingId\(t\.id\)/);
  assert.match(baseEditor, /if \(!initialTemplate\?\.id\) return;[\s\S]*handleEdit\(initialTemplate\)/);
  assert.match(baseEditor, /dbWrite\(payload, editingId\)/);
});

test('race browsing is separate from the View Data opening action', () => {
  assert.match(home, /onAction\('previous-race'\)/);
  assert.match(home, /onAction\('view-race-data'\)/);
  assert.match(home, />\s*View Data\s*</);
  assert.match(home, /onAction\('next-race'\)/);
  assert.match(dashboard, /if \(action === 'previous-race'\)[\s\S]*browseToRace\(displayedRaceNavigation\.previous/);
  assert.match(dashboard, /if \(action === 'next-race'\)[\s\S]*browseToRace\(displayedRaceNavigation\.next/);
  assert.match(dashboard, /if \(action === 'view-race-data'\)[\s\S]*openScheduledRaceWeekend\(displayedRace, canCreateDisplayedRace\)/);
});

test('the landing card and View Data share the deterministic race resolver', () => {
  assert.match(dashboard, /const resolution = resolveRaceSetupForEvent\(race,/);
  assert.match(dashboard, /const cachedResult = queriedWeekendSessions\?\.raceKey === raceKey/);
  assert.match(dashboard, /if \(result\.choice\)[\s\S]*loadRaceSetupChoice\([\s\S]*result\.choice/);
  assert.match(resolver, /const linked = choices\.find\(choice => choice\.scheduleId === scheduleId\)/);
  assert.match(resolver, /normalizeRaceDate\(second\.raceDate\)\.localeCompare\(normalizeRaceDate\(first\.raceDate\)\)/);
  assert.match(dashboard, /race_schedule_id: savedMeta\.raceScheduleId \|\| null/);
  assert.match(dashboard, /setSavedMeta\(\{ name: undefined, ids: \{\}, raceScheduleId: normalizedText\(race\.id\)/);
});

test('the picker is fallback-only after automatic resolution fails', () => {
  assert.match(dashboard, /no saved data for this race, choose setup to load/);
  assert.match(dashboard, /if \(result\.choice\)[\s\S]*return;[\s\S]*if \(allowCreate\)[\s\S]*initializeScheduledRaceWeekend\(race\)[\s\S]*openFallbackSetupPicker\(race\)/);
  assert.match(dashboard, /const hasExplicitGroup = Array\.isArray\(setup\.__groupSetups\)[\s\S]*if \(user && name && !hasExplicitGroup\)/);
});

test('a picker choice permanently links only the selected persisted session ids and refreshes the card immediately', () => {
  assert.match(dashboard, /const ids = choice\.rows\.map\(row => normalizedText\(row\.id\)\)\.filter\(Boolean\)/);
  assert.match(dashboard, /\.update\(\{ race_schedule_id: race\.id \}\)[\s\S]*\.in\('id', ids\)/);
  assert.match(dashboard, /verifiedPickerSelection[\s\S]*linkRaceSetupChoiceToSchedule\(choice, race, verifiedPickerSelection\)/);
  assert.match(dashboard, /setQueriedWeekendSessions\(\{[\s\S]*choice: selectedChoice,[\s\S]*rows: selectedChoice\.rows,[\s\S]*source: 'linked'/);
  assert.match(dashboard, /linkChoiceToRace: true/);
});

test('candidate loading is bounded but includes immutable and normalized-track candidates', () => {
  assert.match(dashboard, /\.eq\('race_schedule_id', race\.id\)[\s\S]*\.limit\(20\)/);
  assert.match(dashboard, /raceTrackSearchToken\(race\.track\)/);
  assert.match(dashboard, /\.ilike\('track_name', `%\$\{trackToken\}%`\)/);
  assert.match(dashboard, /\.limit\(250\)/);
});

test('session results come only from each persisted row timing_data finishing position', () => {
  assert.match(dashboard, /attachTimingDataToSession\(session\.row\?\.timing_data, session\.id\)/);
  assert.match(dashboard, /parsePerformancePosition\(timingData\?\.finishing_position\)/);
  assert.match(home, /session\.result[\s\S]*— \{session\.result\}/);
});

test('finishing position is visible in scan review and saved session timing displays', () => {
  assert.match(scanTiming, /label="Finishing Position"[\s\S]*scan\.finishing_position[\s\S]*parsePerformancePosition/);
  assert.match(timingDisplay, /label="Finishing Position"[\s\S]*timingData\.finishing_position/);
});

test('only a newly saved Main timing result syncs to Schedule and picker linking protects an existing result', () => {
  assert.match(scanTiming, /\.select\('id, setup_type, race_schedule_id, timing_data'\)/);
  assert.match(scanTiming, /setupType: updated\.setup_type,[\s\S]*raceScheduleId: updated\.race_schedule_id/);
  assert.match(dashboard, /stableSetupType !== 'main'[\s\S]*session\.raceScheduleId/);
  assert.doesNotMatch(dashboard, /setRefreshTrigger\(prev => prev \+ 1\);\s*const mainSessionId[\s\S]*syncMainEventResultToSchedule/);
  assert.match(dashboard, /if \(options\.onlyIfMissing\)[\s\S]*isBlankScheduleFinishingPosition/);
  assert.match(dashboard, /\.eq\('id', decision\.raceScheduleId\)/);
  assert.match(dashboard, /if \(mainTiming\)[\s\S]*onlyIfMissing: true/);
  assert.match(dashboard, /setScheduleRows\(prev => prev\.map/);
});

test('Schedule finishing position remains editable and no page-load effect resyncs Main timing', () => {
  assert.match(scheduleForm, /id="rf-pos"[\s\S]*value=\{entry\.finishing_position/);
  assert.doesNotMatch(scheduleForm, /id="rf-pos"[^>]*(disabled|readOnly)/);
  assert.doesNotMatch(dashboard, /useEffect\([\s\S]{0,500}syncMainEventResultToSchedule/);
});

test('the migration backfills only unambiguous events and blocks future duplicates', () => {
  assert.match(migration, /foreign key \(race_schedule_id\)[\s\S]*references public\.race_schedule\(id\)[\s\S]*on delete set null/i);
  assert.match(migration, /unique_schedule_rows[\s\S]*group by user_id, race_date[\s\S]*having count\(\*\) = 1/i);
  assert.match(migration, /having count\(distinct setup_group\) = 1[\s\S]*count\(\*\) = count\(distinct setup_type\)/i);
  assert.match(migration, /create unique index if not exists race_setups_schedule_session_uidx[\s\S]*user_id, race_schedule_id, setup_type/i);
});

test('race-card animation stays local and retains reduced-motion support', () => {
  assert.match(home, /transition-all duration-200 ease-out \$\{weekendTransitionClass\}/);
  assert.match(dashboard, /if \(prefersReducedMotion\)[\s\S]*setDisplayedRaceKey\(key\)/);
  assert.match(dashboard, /raceSlideDirection === 'left'[\s\S]*-translate-x-6 opacity-0/);
});
