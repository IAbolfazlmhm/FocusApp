import '../tests/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDateBounds } from '../src/features/progress/progress.js';
import { setLocale } from '../src/core/i18n.js';
import { gregorianToJalali } from '../src/core/date-utils.js';

function dayAt(y, m, d) {
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

// FIX regression coverage: "weekly" and "monthly" used to always use
// Gregorian/ISO boundaries (Monday-start week, calendar-month) regardless
// of locale, so the fa-locale Progress dashboard showed Jalali-formatted
// *labels* over date ranges that didn't actually match how a Persian
// week/month is reckoned.

test('getDateBounds weekly: en locale starts the week on Monday (ISO)', () => {
  setLocale('en');
  // Wednesday, August 26, 2026
  const bounds = getDateBounds(dayAt(2026, 8, 26), 'weekly');
  assert.equal(bounds.start.getDay(), 1, 'week should start on Monday');
  assert.equal(bounds.start.getDate(), 24); // Monday Aug 24 2026
  assert.equal(bounds.end.getDate(), 30); // Sunday Aug 30 2026
});

test('getDateBounds weekly: fa locale starts the week on Saturday (Persian week)', () => {
  setLocale('fa');
  // Same Wednesday, August 26, 2026
  const bounds = getDateBounds(dayAt(2026, 8, 26), 'weekly');
  assert.equal(bounds.start.getDay(), 6, 'week should start on Saturday');
  assert.equal(bounds.start.getDate(), 22); // Saturday Aug 22 2026
  assert.equal(bounds.end.getDate(), 28); // Friday Aug 28 2026
  setLocale('en');
});

test('getDateBounds monthly: en locale uses the Gregorian calendar month', () => {
  setLocale('en');
  const bounds = getDateBounds(dayAt(2026, 8, 26), 'monthly');
  assert.equal(bounds.start.getMonth(), 7); // August (0-indexed)
  assert.equal(bounds.start.getDate(), 1);
  assert.equal(bounds.end.getMonth(), 7);
  assert.equal(bounds.end.getDate(), 31);
});

test('getDateBounds monthly: fa locale uses the actual Jalali month, not the Gregorian one', () => {
  setLocale('fa');
  // Aug 26 2026 falls in Shahrivar 1405 (which runs Aug 23 - Sep 22 2026)
  const bounds = getDateBounds(dayAt(2026, 8, 26), 'monthly');

  const startJalali = gregorianToJalali(bounds.start.getFullYear(), bounds.start.getMonth() + 1, bounds.start.getDate());
  const endJalali = gregorianToJalali(bounds.end.getFullYear(), bounds.end.getMonth() + 1, bounds.end.getDate());

  assert.deepEqual(startJalali, { jy: 1405, jm: 6, jd: 1 }, 'start should be 1 Shahrivar 1405');
  assert.deepEqual(endJalali, { jy: 1405, jm: 6, jd: 31 }, 'end should be 31 Shahrivar 1405');
  // And in Gregorian terms, this month does NOT align with August's own
  // boundaries — it spans into September, unlike the en-locale case above.
  assert.equal(bounds.start.getMonth(), 7); // still August 23...
  assert.equal(bounds.end.getMonth(), 8); // ...through September 22
  assert.equal(bounds.end.getDate(), 22);

  setLocale('en');
});

test('getDateBounds monthly: fa locale correctly spans a leap-year Esfand (30 days)', () => {
  setLocale('fa');
  // Any day within Esfand 1403 (a leap year) — 15 Esfand 1403 = 5 March 2025
  const bounds = getDateBounds(dayAt(2025, 3, 5), 'monthly');
  const startJalali = gregorianToJalali(bounds.start.getFullYear(), bounds.start.getMonth() + 1, bounds.start.getDate());
  const endJalali = gregorianToJalali(bounds.end.getFullYear(), bounds.end.getMonth() + 1, bounds.end.getDate());
  assert.deepEqual(startJalali, { jy: 1403, jm: 12, jd: 1 });
  assert.deepEqual(endJalali, { jy: 1403, jm: 12, jd: 30 }, '1403 is leap, so Esfand should run through day 30');
  setLocale('en');
});
