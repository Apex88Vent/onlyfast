import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPerformanceSummary } from '../src/lib/performanceSummary.ts';

test('restores every original statistic for multiple completed race weekends', () => {
  assert.deepEqual(buildPerformanceSummary([
    { finishing_position: '1st' },
    { finishing_position: '5' },
    { finishing_position: 'TBD' },
  ], [
    { timing_data: { starting_position: 7, finishing_position: 4 } },
    { timing_data: { positions_gained_lost: -1 } },
  ]), [
    { label: 'Events', value: 2 },
    { label: 'Avg Finish', value: 3 },
    { label: 'Top 5s', value: 2 },
    { label: 'Wins', value: 1 },
    { label: 'Positions Gained', value: '+2' },
  ]);
});

test('uses real values for one completed race weekend', () => {
  assert.deepEqual(buildPerformanceSummary([
    { finishing_position: '8th' },
  ], [
    { timing_data: { positions_gained_lost: 0 } },
  ]), [
    { label: 'Events', value: 1 },
    { label: 'Avg Finish', value: 8 },
    { label: 'Top 5s', value: 0 },
    { label: 'Wins', value: 0 },
    { label: 'Positions Gained', value: '0' },
  ]);
});

test('keeps every tile visible with the prior zero state when results are unavailable', () => {
  assert.deepEqual(buildPerformanceSummary([
    { finishing_position: 'TBD' },
  ], []), [
    { label: 'Events', value: 0 },
    { label: 'Avg Finish', value: 0 },
    { label: 'Top 5s', value: 0 },
    { label: 'Wins', value: 0 },
    { label: 'Positions Gained', value: '0' },
  ]);
});

test('timing data alone cannot suppress the other original statistics', () => {
  assert.deepEqual(buildPerformanceSummary([], [
    { timing_data: { starting_position: 10, finishing_position: 6 } },
  ]), [
    { label: 'Events', value: 0 },
    { label: 'Avg Finish', value: 0 },
    { label: 'Top 5s', value: 0 },
    { label: 'Wins', value: 0 },
    { label: 'Positions Gained', value: '+4' },
  ]);
});

test('preserves the original empty state when no performance source exists', () => {
  assert.deepEqual(buildPerformanceSummary([], []), []);
});
