import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildScheduleFinishSyncDecision,
  isBlankScheduleFinishingPosition,
} from '../src/lib/scheduleFinishingPosition.ts';

test('Main timing with numeric finishing position targets its associated Schedule row as text', () => {
  assert.deepEqual(
    buildScheduleFinishSyncDecision('main', { finishing_position: 3 }, 'schedule-3'),
    { status: 'ready', raceScheduleId: 'schedule-3', finishingPosition: '3' },
  );
});

test('Main timing accepts an ordinal finishing-position string', () => {
  assert.deepEqual(
    buildScheduleFinishSyncDecision('main', { finishing_position: '3rd' }, 'schedule-3'),
    { status: 'ready', raceScheduleId: 'schedule-3', finishingPosition: '3' },
  );
});

test('Heat timing never produces a Schedule update request', () => {
  assert.deepEqual(
    buildScheduleFinishSyncDecision('heat', { finishing_position: 1 }, 'schedule-heat'),
    { status: 'not-main' },
  );
});

test('Hot Laps timing never produces a Schedule update request', () => {
  assert.deepEqual(
    buildScheduleFinishSyncDecision('base', { finishing_position: 1 }, 'schedule-hot-laps'),
    { status: 'not-main' },
  );
});

test('extra/custom session timing never produces a Schedule update request', () => {
  assert.deepEqual(
    buildScheduleFinishSyncDecision('extra1', { finishing_position: 1 }, 'schedule-extra'),
    { status: 'not-main' },
  );
});

test('Main timing without a valid finishing position invents nothing', () => {
  assert.deepEqual(
    buildScheduleFinishSyncDecision('main', { fastest_lap_time: '14.123' }, 'schedule-main'),
    { status: 'invalid-finish' },
  );
});

test('Main timing without race_schedule_id cannot target another race', () => {
  assert.deepEqual(
    buildScheduleFinishSyncDecision('main', { finishing_position: 2 }, null),
    { status: 'missing-schedule-id' },
  );
});

test('explicit linking may backfill only a blank or TBD Schedule result', () => {
  assert.equal(isBlankScheduleFinishingPosition(null), true);
  assert.equal(isBlankScheduleFinishingPosition(''), true);
  assert.equal(isBlankScheduleFinishingPosition(' TBD '), true);
  assert.equal(isBlankScheduleFinishingPosition('3rd'), false);
  assert.equal(isBlankScheduleFinishingPosition('3'), false);
});

test('a later newly saved Main result remains eligible to replace the prior automatic value', () => {
  const first = buildScheduleFinishSyncDecision('main', { finishing_position: 4 }, 'schedule-main');
  const replacement = buildScheduleFinishSyncDecision('main', { finishing_position: '2nd' }, 'schedule-main');
  assert.deepEqual(first, { status: 'ready', raceScheduleId: 'schedule-main', finishingPosition: '4' });
  assert.deepEqual(replacement, { status: 'ready', raceScheduleId: 'schedule-main', finishingPosition: '2' });
});
