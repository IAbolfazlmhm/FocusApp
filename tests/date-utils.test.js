import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLocalDateKey } from '../src/core/date-utils.js';

test('getLocalDateKey formats a date as YYYY-MM-DD', () => {
  assert.equal(getLocalDateKey(new Date(2026, 0, 5)), '2026-01-05');
});

test('getLocalDateKey zero-pads single-digit months and days', () => {
  assert.equal(getLocalDateKey(new Date(2026, 8, 9)), '2026-09-09');
});

test('getLocalDateKey does not zero-pad double-digit months/days', () => {
  assert.equal(getLocalDateKey(new Date(2026, 11, 31)), '2026-12-31');
});

test('getLocalDateKey defaults to the current date when called with no argument', () => {
  const now = new Date();
  const expected = getLocalDateKey(now);
  assert.equal(getLocalDateKey(), expected);
});

test('getLocalDateKey uses local calendar fields, not the UTC date', () => {
  // A date constructed from explicit local y/m/d components should key
  // by those same components regardless of the machine's timezone —
  // this is the exact bug class the function's own header comment
  // exists to prevent (see date-utils.js).
  const d = new Date(2026, 2, 1); // March 1, 2026, local midnight
  assert.equal(getLocalDateKey(d), '2026-03-01');
});

test('getLocalDateKey accepts a Date-like value it can coerce', () => {
  // The function does `new Date(dateObj)` internally, so an ISO string
  // works the same as a Date object for callers that pass one.
  assert.equal(getLocalDateKey('2026-06-15T10:00:00'), '2026-06-15');
});
