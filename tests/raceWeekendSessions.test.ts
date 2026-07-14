import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNewRaceWeekendSessions,
  resolveSavedRaceWeekendSessions,
} from '../src/lib/raceWeekendSessions.ts';

const labels = (rows: Parameters<typeof resolveSavedRaceWeekendSessions>[0]) =>
  resolveSavedRaceWeekendSessions(rows).map(session => session.label);

test('new race weekends use only the three canonical default sessions', () => {
  assert.deepEqual(
    createNewRaceWeekendSessions().map(session => session.label),
    ['Hot Laps', 'Heat', 'Main Event'],
  );
});

test('a renamed default session keeps its exact saved label', () => {
  assert.deepEqual(labels([
    { id: 'hot', setup_type: 'base', session_order: 1 },
    { id: 'heat', setup_type: 'heat', session_label: 'Heat Race 1', session_order: 2 },
    { id: 'main', setup_type: 'main', session_order: 3 },
  ]), ['Hot Laps', 'Heat Race 1', 'Main Event']);
});

test('an added session uses its exact saved label and saved order', () => {
  assert.deepEqual(labels([
    { id: 'main', setup_type: 'main', session_order: 3 },
    { id: 'b-main', setup_type: 'extra1', session_label: 'B Main', session_order: 4 },
    { id: 'hot', setup_type: 'base', session_order: 1 },
    { id: 'heat', setup_type: 'heat', session_order: 2 },
  ]), ['Hot Laps', 'Heat', 'Main Event', 'B Main']);
});

test('a deleted default session is not recreated for an existing weekend', () => {
  assert.deepEqual(labels([
    { id: 'heat', setup_type: 'heat', session_order: 2 },
    { id: 'main', setup_type: 'main', session_order: 3 },
  ]), ['Heat', 'Main Event']);
});

test('empty, corrupt, and generated extra-session labels are filtered out', () => {
  assert.deepEqual(labels([
    { id: 'heat', setup_type: 'heat', session_order: 2 },
    { id: 'fake-4', setup_type: 'extra1', session_label: 'Session 4', session_order: 4, cross_weight: 52.1 },
    { id: 'fake-5', setup_type: 'extra2', session_label: '', session_order: 5 },
    { id: 'fake-6', setup_type: 'extra3', session_label: 'Extra Session', session_order: 6 },
    { id: '', setup_type: 'extra1', session_label: 'B Main', session_order: 4 },
    { id: 'unknown', setup_type: 'extra9', session_label: 'Mystery', session_order: 7 },
  ]), ['Heat']);
});

test('an explicitly saved Main label is preserved and not rewritten', () => {
  assert.deepEqual(labels([
    { id: 'main', setup_type: 'main', session_label: 'Main', session_order: 3 },
  ]), ['Main']);
});

test('status remains attached to the correct durable session id after ordering', () => {
  const sessions = resolveSavedRaceWeekendSessions([
    { id: 'b-main', setup_type: 'extra1', session_label: 'B Main', session_order: 4, session_finished: true },
    { id: 'heat', setup_type: 'heat', session_order: 2 },
  ]);

  assert.deepEqual(
    sessions.map(session => ({ id: session.id, label: session.label, status: session.status })),
    [
      { id: 'heat', label: 'Heat', status: 'in-progress' },
      { id: 'b-main', label: 'B Main', status: 'complete' },
    ],
  );
});
