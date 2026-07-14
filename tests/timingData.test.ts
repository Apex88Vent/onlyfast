import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachTimingDataToSession,
  mergeTimingRows,
  mergeTimingScanResults,
} from '../src/lib/timingData.ts';

test('timing data and every parsed lap use the selected session id', () => {
  const result = attachTimingDataToSession({
    session_id: 'wrong-session',
    fastest_lap_time: '14.125',
    lap_times: [
      { lap: 1, time: '14.500', session_id: 'wrong-session' },
      { lap: 2, time: '14.125' },
    ],
  }, 'session-hot-laps');

  assert.equal(result?.session_id, 'session-hot-laps');
  assert.deepEqual(
    result?.lap_times?.map(lap => lap.session_id),
    ['session-hot-laps', 'session-hot-laps'],
  );
});

test('separate session ids produce isolated timing objects', () => {
  const source = { lap_times: [{ lap: 1, time: '15.000' }] };
  const hotLaps = attachTimingDataToSession(source, 'session-hot-laps');
  const heat = attachTimingDataToSession(source, 'session-heat');

  assert.equal(hotLaps?.session_id, 'session-hot-laps');
  assert.equal(heat?.session_id, 'session-heat');
  assert.notDeepEqual(hotLaps, heat);
});

test('hot laps, heat, main, and an extra session remain completely isolated', () => {
  const sessions = [
    ['session-hot-laps', '14.100'],
    ['session-heat', '14.200'],
    ['session-main', '14.300'],
    ['session-extra', '14.400'],
  ] as const;
  const bySessionId = Object.fromEntries(sessions.map(([sessionId, time], index) => [
    sessionId,
    attachTimingDataToSession({ lap_times: [{ lap: index + 1, time }] }, sessionId),
  ]));

  for (const [sessionId, time] of sessions) {
    assert.equal(bySessionId[sessionId]?.session_id, sessionId);
    assert.equal(bySessionId[sessionId]?.lap_times?.[0].time, time);
    assert.equal(bySessionId[sessionId]?.lap_times?.[0].session_id, sessionId);
  }
  assert.equal(Object.keys(bySessionId).length, 4);
});

test('three overlapping screenshots merge laps 1 through 25 exactly once', () => {
  const screenshot = (start: number, end: number) => ({
    lap_times: Array.from({ length: end - start + 1 }, (_, index) => {
      const lap = start + index;
      return { lap, time: `${14 + lap / 1000}` };
    }),
  });
  const result = mergeTimingScanResults([
    screenshot(1, 10),
    screenshot(8, 18),
    screenshot(16, 25),
  ], 'session-main');

  assert.deepEqual(result?.lap_times?.map(lap => lap.lap), Array.from({ length: 25 }, (_, index) => index + 1));
  assert.equal(result?.total_laps, 25);
  assert.ok(result?.lap_times?.every(lap => lap.session_id === 'session-main'));
});

test('duplicate rows keep the more complete OCR result and equal lap times alone are not deduplicated', () => {
  const rows = mergeTimingRows([
    { lap: 8, time: '14,500', car_number: '88' },
    { lap: 8, time: '14.500', car_number: '88', position: 2, driver_name: 'Alex' },
    { lap: 9, time: '14.500', car_number: '88', position: 2, driver_name: 'Alex' },
  ], 'session-heat');

  assert.equal(rows.length, 2);
  assert.equal(rows[0].lap, 8);
  assert.equal(rows[0].position, 2);
  assert.equal(rows[0].driver_name, 'Alex');
  assert.equal(rows[1].lap, 9);
});
