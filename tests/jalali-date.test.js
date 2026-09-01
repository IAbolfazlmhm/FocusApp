import test from 'node:test';
import assert from 'node:assert/strict';
import { gregorianToJalali, jalaliToGregorian, parsePersianDigits, toPersianDigits, isJalaliLeapYear, jalaliDaysInMonth } from '../src/core/date-utils.js';

test('jalali-date: converts Gregorian dates to Jalali accurately', () => {
  // 2026-08-23 -> 1405-06-01 (1 Shahrivar 1405)
  const j1 = gregorianToJalali(2026, 8, 23);
  assert.equal(j1.jy, 1405);
  assert.equal(j1.jm, 6);
  assert.equal(j1.jd, 1);

  // 2024-03-20 -> 1403-01-01 (Nowruz 1403)
  const j2 = gregorianToJalali(2024, 3, 20);
  assert.equal(j2.jy, 1403);
  assert.equal(j2.jm, 1);
  assert.equal(j2.jd, 1);
});

test('jalali-date: converts Jalali dates back to Gregorian accurately', () => {
  // 1405-06-01 -> 2026-08-23
  const g1 = jalaliToGregorian(1405, 6, 1);
  assert.equal(g1.gy, 2026);
  assert.equal(g1.gm, 8);
  assert.equal(g1.gd, 23);

  // 1403-01-01 -> 2024-03-20
  const g2 = jalaliToGregorian(1403, 1, 1);
  assert.equal(g2.gy, 2024);
  assert.equal(g2.gm, 3);
  assert.equal(g2.gd, 20);
});

test('jalali-date: parsePersianDigits converts Persian numerals to ASCII numerals', () => {
  assert.equal(parsePersianDigits('۱۲۳۴۵۶۷۸۹۰'), '1234567890');
  assert.equal(parsePersianDigits('۱۴۰۵/۰۶/۰۱'), '1405/06/01');
  assert.equal(parsePersianDigits('abc 123'), 'abc 123');
});

test('jalali-date: toPersianDigits converts ASCII numerals to Persian, preserving leading zeros', () => {
  assert.equal(toPersianDigits('1234567890'), '۱۲۳۴۵۶۷۸۹۰');
  assert.equal(toPersianDigits('04'), '۰۴');
  assert.equal(toPersianDigits(''), '');
});

test('jalali-date: parsePersianDigits and toPersianDigits round-trip', () => {
  assert.equal(parsePersianDigits(toPersianDigits('1405')), '1405');
});

test('jalali-date: Esfand day count matches the real Jalali leap-year cycle, not a hand-rolled formula', () => {
  // 29 Esfand 1403 -> 19 March 2025; 1403 is a real leap year, so the
  // 30th also exists and rolls correctly into Farvardin 1404 if you go
  // one more day past it.
  const g1403 = jalaliToGregorian(1403, 12, 30);
  const back1403 = gregorianToJalali(g1403.gy, g1403.gm, g1403.gd);
  assert.equal(back1403.jy, 1403);
  assert.equal(back1403.jm, 12);
  assert.equal(back1403.jd, 30); // 1403 is leap — 30 Esfand exists

  // 1404 is NOT a leap year — asking for "30 Esfand 1404" should not
  // round-trip back to day 30 of month 12 in that same year.
  const g1404 = jalaliToGregorian(1404, 12, 30);
  const back1404 = gregorianToJalali(g1404.gy, g1404.gm, g1404.gd);
  assert.notEqual(`${back1404.jy}-${back1404.jm}-${back1404.jd}`, '1404-12-30');
});

// Direct coverage for isJalaliLeapYear/jalaliDaysInMonth themselves —
// previously only exercised indirectly through the round-trip tests
// above and through date-segment-input.js/date-picker-popover.js.
test('isJalaliLeapYear: matches known leap and non-leap years', () => {
  assert.equal(isJalaliLeapYear(1403), true);
  assert.equal(isJalaliLeapYear(1404), false);
});

test('jalaliDaysInMonth: months 1-6 always have 31 days', () => {
  for (let m = 1; m <= 6; m++) {
    assert.equal(jalaliDaysInMonth(m, 1404), 31);
  }
});

test('jalaliDaysInMonth: months 7-11 always have 30 days', () => {
  for (let m = 7; m <= 11; m++) {
    assert.equal(jalaliDaysInMonth(m, 1404), 30);
  }
});

test('jalaliDaysInMonth: month 12 (Esfand) depends on the leap year', () => {
  assert.equal(jalaliDaysInMonth(12, 1403), 30); // leap
  assert.equal(jalaliDaysInMonth(12, 1404), 29); // not leap
});
