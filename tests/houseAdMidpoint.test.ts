import assert from 'node:assert/strict';
import test from 'node:test';
import { measureHouseBoundary, nearestHouseBoundary } from '../src/lib/houseAdMidpoint.ts';

test('midpoint is based on measured heights, never record count or the previous fixed slot', () => {
  assert.equal(nearestHouseBoundary(1200, [100, 200, 300, 1200]), 2, 'three short rows and one tall row');
  assert.equal(nearestHouseBoundary(1200, [100, 550, 800, 1200]), 1);
  assert.equal(nearestHouseBoundary(400, [80, 210, 390]), 1, 'short form logical section boundary');
  assert.equal(nearestHouseBoundary(1800, [80, 210, 900, 1700]), 2, 'dynamic results move the nearest boundary');
  assert.equal(nearestHouseBoundary(0, []), -1);
});

function element(top: number, height: number, order: number) {
  return {
    top, height, order, scrollTop: 0, scrollHeight: height, clientHeight: height, parentElement: null as unknown,
    getBoundingClientRect() { return { top: this.top, bottom: this.top + this.height, height: this.height }; },
    getClientRects: () => [{}], closest: () => null, contains: (_other: unknown) => false,
    nextElementSibling: null,
    compareDocumentPosition(other: { order: number }) { return this.order < other.order ? 4 : 2; },
  };
}
test('actual measurement accounts for nested scrolling and removes the existing ad from midpoint calculations', () => {
  const root = element(0, 400, 0);
  const scroller = element(100, 200, 1); scroller.scrollHeight = 1000; scroller.scrollTop = 400;
  const rows = [200, 400, 600, 800, 1000].map((bottom, index) => element(100 + bottom - 200 - 400, 200, index + 2));
  rows.forEach(row => { row.parentElement = scroller; });
  scroller.contains = other => rows.includes(other as typeof rows[number]);
  const page = Object.assign(root, { ownerDocument: { defaultView: { getComputedStyle: (node: unknown) => ({ overflowY: node === scroller ? 'auto' : 'visible', display: 'block' }) } },
    querySelectorAll: (selector: string) => selector === '*' ? [scroller, ...rows] : rows,
  });
  assert.equal(measureHouseBoundary(page as unknown as HTMLElement, null), rows[1]);
  const host = element(100, 160, 3.5);
  root.height += 160; root.scrollHeight += 160;
  rows.slice(2).forEach(row => { row.top += 160; });
  assert.equal(measureHouseBoundary(page as unknown as HTMLElement, host as unknown as HTMLElement), rows[1], 'placing the ad must not move its own target');
});
