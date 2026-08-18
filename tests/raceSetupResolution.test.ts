import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeRaceTrack,
  raceDateDifferenceDays,
  resolveRaceSetupForEvent,
} from '../src/lib/raceSetupResolution.ts';
import type { RaceWeekendSessionRow } from '../src/lib/raceWeekendSessions.ts';
import { parsePerformancePosition } from '../src/lib/performanceSummary.ts';

const session = (
  id: string,
  setupType: 'base' | 'heat' | 'main' | 'extra1',
  values: Partial<RaceWeekendSessionRow> = {},
): RaceWeekendSessionRow => ({
  id,
  setup_type: setupType,
  setup_name: 'Race Setup',
  track_name: 'Barona Speedway',
  race_date: '2026-08-15',
  session_label: setupType === 'extra1' ? 'B Main' : undefined,
  session_order: setupType === 'base' ? 1 : setupType === 'heat' ? 2 : setupType === 'main' ? 3 : 4,
  created_at: '2026-08-15T10:00:00Z',
  updated_at: '2026-08-15T10:00:00Z',
  ...values,
});

test('an immutable schedule id wins and merges sessions despite inconsistent setup names', () => {
  const rows = [
    session('linked-hot', 'base', { race_schedule_id: 'event-1', setup_name: 'Original Name' }),
    session('linked-heat', 'heat', { race_schedule_id: 'event-1', setup_name: 'Renamed Weekend' }),
    session('newer-unlinked', 'main', {
      race_date: '2026-09-20',
      updated_at: '2026-09-21T10:00:00Z',
    }),
  ];

  const result = resolveRaceSetupForEvent({ id: 'event-1', race_date: '2026-08-15', track: 'Barona Speedway' }, rows);

  assert.equal(result.source, 'linked');
  assert.deepEqual(result.choice?.rows.map(row => row.id), ['linked-hot', 'linked-heat']);
});

test('exact normalized track and date automatically choose the newest coherent tie', () => {
  const rows = [
    session('older-exact', 'base', { setup_name: 'Older Exact', updated_at: '2026-08-15T12:00:00Z' }),
    session('newer-exact', 'base', { setup_name: 'Newer Exact', updated_at: '2026-08-16T12:00:00Z' }),
    session('newer-date', 'base', {
      setup_name: 'Different Date',
      race_date: '2026-09-20',
      updated_at: '2026-09-20T12:00:00Z',
    }),
  ];

  const result = resolveRaceSetupForEvent({ id: 'event-2', race_date: '2026-08-15', track: '  BARONA   SPEEDWAY ' }, rows);

  assert.equal(result.source, 'exact-date-track');
  assert.equal(result.choice?.rows[0]?.id, 'newer-exact');
  assert.equal(result.canLinkToSchedule, false, 'multiple exact groups are opened but not permanently linked');
});

test('track-only fallback ranks race_date before updated_at', () => {
  const rows = [
    session('older-race-edited-later', 'base', {
      setup_name: 'July Race',
      race_date: '2026-07-20',
      updated_at: '2026-10-01T12:00:00Z',
    }),
    session('newer-race-edited-earlier', 'base', {
      setup_name: 'August Race',
      race_date: '2026-08-15',
      updated_at: '2026-08-16T12:00:00Z',
    }),
  ];

  const result = resolveRaceSetupForEvent({ id: 'event-3', race_date: '2026-09-12', track: 'barona speedway ' }, rows);

  assert.equal(result.source, 'track-recent');
  assert.equal(result.choice?.rows[0]?.id, 'newer-race-edited-earlier');
  assert.equal(result.canLinkToSchedule, false);
});

test('track-only fallback uses updated_at only when race dates tie', () => {
  const rows = [
    session('older-edit', 'base', { setup_name: 'First', updated_at: '2026-08-15T12:00:00Z' }),
    session('newer-edit', 'base', { setup_name: 'Second', updated_at: '2026-08-16T12:00:00Z' }),
  ];

  const result = resolveRaceSetupForEvent({ id: 'event-4', race_date: '2026-09-12', track: 'Barona Speedway' }, rows);

  assert.equal(result.choice?.rows[0]?.id, 'newer-edit');
});

test('one unlinked exact group is linkable and contains only its persisted sessions', () => {
  const rows = [
    session('heat-race', 'heat', {
      setup_name: 'Exact Weekend',
      session_label: 'Heat Race',
      session_order: 1,
    }),
    session('b-main', 'extra1', {
      setup_name: 'Exact Weekend',
      session_label: 'B Main',
      session_order: 2,
    }),
  ];

  const result = resolveRaceSetupForEvent({ id: 'event-5', race_date: '2026-08-15', track: 'Barona Speedway' }, rows);

  assert.equal(result.source, 'exact-date-track');
  assert.equal(result.canLinkToSchedule, true);
  assert.deepEqual(
    result.choice?.rows.map(row => ({ id: row.id, label: row.session_label })),
    [
      { id: 'heat-race', label: 'Heat Race' },
      { id: 'b-main', label: 'B Main' },
    ],
  );
});

test('track normalization handles capitalization, whitespace, punctuation, venue suffixes, and address text', () => {
  assert.equal(normalizeRaceTrack('  Barona   Speedway  '), 'barona');
  assert.equal(normalizeRaceTrack('Barona-Speedway Race Track'), 'barona');
  assert.equal(normalizeRaceTrack('Barona Speedway, 1754'), 'barona');
  assert.equal(normalizeRaceTrack('Ventura Raceway, Main Street (Seaside Park)'), 'ventura');
  assert.notEqual(normalizeRaceTrack('Barona Speedway'), normalizeRaceTrack('Barona Dragstrip'));
});

test('the working Ventura values resolve through exact normalized track and date', () => {
  const rows = [session('ventura-main', 'main', {
    setup_name: 'Ventura - 2026-07-11',
    track_name: 'Ventura',
    race_date: '2026-07-11',
  })];

  const result = resolveRaceSetupForEvent({
    id: 'ventura-2026-07-11',
    track: 'Ventura',
    race_date: '2026-07-11',
  }, rows);

  assert.equal(result.source, 'exact-date-track');
  assert.equal(result.choice?.rows[0]?.id, 'ventura-main');
});

test('two formerly failing Barona naming variants resolve on their exact race dates', () => {
  const rows = [
    session('barona-may-main', 'main', {
      setup_name: 'Barona Speedway, 1754 - 2026-05-23',
      track_name: 'Barona Speedway, 1754',
      race_date: '2026-05-23',
    }),
    session('barona-june-main', 'main', {
      setup_name: 'Barona 6-20-26',
      track_name: 'Barona Speedway',
      race_date: '2026-06-20',
    }),
  ];

  const may = resolveRaceSetupForEvent({ id: 'barona-may', track: 'Barona', race_date: '2026-05-23' }, rows);
  const june = resolveRaceSetupForEvent({ id: 'barona-june', track: 'Barona', race_date: '2026-06-20' }, rows);

  assert.equal(may.source, 'exact-date-track');
  assert.equal(may.choice?.rows[0]?.id, 'barona-may-main');
  assert.equal(june.source, 'exact-date-track');
  assert.equal(june.choice?.rows[0]?.id, 'barona-june-main');
});

test('same-track setup one day away resolves through the race-weekend window', () => {
  const rows = [session('sunday-main', 'main', { race_date: '2026-08-16' })];
  const result = resolveRaceSetupForEvent({ id: 'weekend', track: 'Barona', race_date: '2026-08-15' }, rows);

  assert.equal(result.source, 'date-window');
  assert.equal(result.dateDifferenceDays, 1);
  assert.equal(result.choice?.rows[0]?.id, 'sunday-main');
  assert.equal(result.canLinkToSchedule, true);
});

test('date-window matching accepts three days, rejects four, and uses date-only calendar arithmetic', () => {
  assert.equal(raceDateDifferenceDays('2026-03-01', '2026-02-26'), 3);
  const rows = [
    session('three-days', 'main', { setup_name: 'Within Window', race_date: '2026-02-26' }),
    session('four-days-newer', 'main', { setup_name: 'Outside Window', race_date: '2026-03-05' }),
  ];
  const result = resolveRaceSetupForEvent({ id: 'window', track: 'Barona', race_date: '2026-03-01' }, rows);

  assert.equal(result.source, 'date-window');
  assert.equal(result.choice?.rows[0]?.id, 'three-days');
});

test('closest race date wins inside the window, then newer race_date breaks an equal-distance tie', () => {
  const closest = resolveRaceSetupForEvent({ id: 'closest', track: 'Barona', race_date: '2026-08-15' }, [
    session('three-away', 'main', { setup_name: 'Three Away', race_date: '2026-08-12', updated_at: '2026-12-01T00:00:00Z' }),
    session('one-away', 'main', { setup_name: 'One Away', race_date: '2026-08-14', updated_at: '2026-08-14T00:00:00Z' }),
  ]);
  const tied = resolveRaceSetupForEvent({ id: 'tied', track: 'Barona', race_date: '2026-08-15' }, [
    session('day-before', 'main', { setup_name: 'Day Before', race_date: '2026-08-14', updated_at: '2026-12-01T00:00:00Z' }),
    session('day-after', 'main', { setup_name: 'Day After', race_date: '2026-08-16', updated_at: '2026-08-16T00:00:00Z' }),
  ]);

  assert.equal(closest.choice?.rows[0]?.id, 'one-away');
  assert.equal(tied.choice?.rows[0]?.id, 'day-after');
});

test('a picker-linked group resolves by immutable id on the subsequent lookup and preserves its sessions/results', () => {
  const linkedRows = [
    session('picked-heat', 'heat', {
      setup_name: 'Picked Group',
      session_label: 'Heat Race',
      session_order: 1,
      race_schedule_id: 'picked-event',
      timing_data: { finishing_position: 4 },
    }),
    session('picked-main', 'main', {
      setup_name: 'Picked Group Renamed',
      session_label: 'Main Event',
      session_order: 2,
      race_schedule_id: 'picked-event',
      timing_data: { finishing_position: '2nd' },
    }),
  ];
  const result = resolveRaceSetupForEvent({ id: 'picked-event', track: 'Different Legacy Text', race_date: '2026-09-12' }, linkedRows);

  assert.equal(result.source, 'linked');
  assert.deepEqual(result.choice?.rows.map(row => row.id), ['picked-heat', 'picked-main']);
  assert.deepEqual(
    result.choice?.rows.map(row => parsePerformancePosition((row.timing_data as any)?.finishing_position)),
    [4, 2],
  );
  assert.equal(parsePerformancePosition(({} as any).finishing_position), null);
});
