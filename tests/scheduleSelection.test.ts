import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRaceRolloverSelection,
  getRaceCenterLabel,
  getScheduleRaceKey,
  getRaceScheduleNavigation,
  getUpcomingScheduleEntries,
  raceIdentityMatchesScheduleRace,
} from '../src/lib/scheduleSelection.ts';

const schedule = [
  { id: 'race-1', race_date: '2026-07-01', track: 'Alpha Speedway' },
  { id: 'race-2', race_date: '2026-07-08', track: 'Bravo Raceway' },
  { id: 'race-3', race_date: '2026-07-15', track: 'Charlie Motorplex' },
];

test('race navigation returns the immediately adjacent scheduled races', () => {
  const navigation = getRaceScheduleNavigation(schedule, schedule[1]);
  assert.equal(navigation.previous?.id, 'race-1');
  assert.equal(navigation.center?.id, 'race-2');
  assert.equal(navigation.next?.id, 'race-3');
});

test('race navigation safely disables missing first and last neighbors', () => {
  const first = getRaceScheduleNavigation(schedule, schedule[0]);
  const last = getRaceScheduleNavigation(schedule, schedule[2]);
  assert.equal(first.previous, null);
  assert.equal(first.next?.id, 'race-2');
  assert.equal(last.previous?.id, 'race-2');
  assert.equal(last.next, null);
});

test('saved race weekends match schedule entries despite track name case or surrounding spaces', () => {
  assert.equal(
    raceIdentityMatchesScheduleRace('2026-07-08', '  BRAVO RACEWAY ', schedule[1]),
    true,
  );
  assert.equal(
    raceIdentityMatchesScheduleRace('2026-07-08', 'Different Raceway', schedule[1]),
    false,
  );
});

test('race center advances on the second local calendar day after the prior race ends', () => {
  const before = getRaceRolloverSelection(schedule, new Date(2026, 6, 2));
  const rolloverDay = getRaceRolloverSelection(schedule, new Date(2026, 6, 3));
  assert.equal(before.center?.id, 'race-1');
  assert.equal(rolloverDay.previous?.id, 'race-1');
  assert.equal(rolloverDay.center?.id, 'race-2');
  assert.equal(rolloverDay.next?.id, 'race-3');
  assert.equal(rolloverDay.automaticallyAdvanced, true);
});

test('multi-day race rollover uses the final scheduled local date', () => {
  const multiDay = [
    { id: 'weekend-1', race_date: '2026-07-10', race_end_date: '2026-07-11', track: 'Weekend Speedway' },
    { id: 'weekend-2', race_date: '2026-07-20', race_end_date: null, track: 'Next Speedway' },
  ];
  assert.equal(getRaceRolloverSelection(multiDay, new Date(2026, 6, 12)).center?.id, 'weekend-1');
  assert.equal(getRaceRolloverSelection(multiDay, new Date(2026, 6, 13)).center?.id, 'weekend-2');
});

test('rollover handles long gaps and the final scheduled race safely', () => {
  const duringGap = getRaceRolloverSelection(schedule, new Date(2026, 6, 3));
  const afterSeason = getRaceRolloverSelection(schedule, new Date(2026, 7, 1));
  assert.equal(duringGap.center?.id, 'race-2');
  assert.equal(afterSeason.center?.id, 'race-3');
  assert.equal(afterSeason.next, null);
});

test('an automatically advanced race stays Upcoming until that race is activated', () => {
  const selection = getRaceRolloverSelection(schedule, new Date(2026, 6, 3));
  assert.equal(getRaceCenterLabel(selection, ''), 'Upcoming Race');
  assert.equal(getRaceCenterLabel(selection, getScheduleRaceKey(selection.center)), 'Current Race');
});

test('landing upcoming events use the final date for multi-day weekends', () => {
  const multiDay = [
    { id: 'weekend-1', race_date: '2026-07-10', race_end_date: '2026-07-12', track: 'Weekend Speedway' },
    { id: 'weekend-2', race_date: '2026-07-20', track: 'Next Speedway' },
  ];
  assert.deepEqual(
    getUpcomingScheduleEntries(multiDay, new Date(2026, 6, 11)).map(race => race.id),
    ['weekend-1', 'weekend-2'],
  );
});

test('landing next event advances after the prior event final date passes', () => {
  assert.equal(getUpcomingScheduleEntries(schedule, new Date(2026, 6, 9))[0]?.id, 'race-3');
});

test('landing next event has a safe empty state after the final scheduled event', () => {
  assert.deepEqual(getUpcomingScheduleEntries(schedule, new Date(2026, 6, 16)), []);
});
