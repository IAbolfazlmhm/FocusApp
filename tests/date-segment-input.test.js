import '../tests/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDateSegmentInput } from '../js/ui/date-segment-input.js';

function makeSegmentInputs() {
  const month = document.createElement('input');
  const day = document.createElement('input');
  const year = document.createElement('input');
  document.body.appendChild(month);
  document.body.appendChild(day);
  document.body.appendChild(year);
  return { month, day, year };
}

test('getValue returns null while any segment is incomplete', () => {
  const { month, day, year } = makeSegmentInputs();
  const field = setupDateSegmentInput(month, day, year);
  assert.equal(field.getValue(), null);
  month.value = '06';
  assert.equal(field.getValue(), null);
  day.value = '15';
  assert.equal(field.getValue(), null); // year still empty
});

test('getValue returns a zero-padded YYYY-MM-DD once all three segments are filled', () => {
  const { month, day, year } = makeSegmentInputs();
  const field = setupDateSegmentInput(month, day, year);
  month.value = '6';
  day.value = '5';
  year.value = '2026';
  assert.equal(field.getValue(), '2026-06-05');
});

test('setValue followed by getValue round-trips an ISO date string', () => {
  const { month, day, year } = makeSegmentInputs();
  const field = setupDateSegmentInput(month, day, year);
  field.setValue('2026-12-31');
  assert.equal(month.value, '12');
  assert.equal(day.value, '31');
  assert.equal(year.value, '2026');
  assert.equal(field.getValue(), '2026-12-31');
});

test('setValue with an empty/falsy value clears all three segments', () => {
  const { month, day, year } = makeSegmentInputs();
  const field = setupDateSegmentInput(month, day, year);
  field.setValue('2026-01-01');
  field.setValue(null);
  assert.equal(month.value, '');
  assert.equal(day.value, '');
  assert.equal(year.value, '');
});

test('typing 2 digits into the month segment auto-advances focus to the day segment', () => {
  const { month, day, year } = makeSegmentInputs();
  setupDateSegmentInput(month, day, year);
  month.value = '06';
  month.dispatchEvent(new window.Event('input'));
  assert.equal(document.activeElement, day);
});

test('non-digit characters typed into a segment are stripped', () => {
  const { month, day, year } = makeSegmentInputs();
  setupDateSegmentInput(month, day, year);
  month.value = '1a2b';
  month.dispatchEvent(new window.Event('input'));
  assert.equal(month.value, '12');
});

test('the year segment never holds more than 4 digits, no matter how much is typed', () => {
  const { month, day, year } = makeSegmentInputs();
  setupDateSegmentInput(month, day, year);
  year.value = '202599999';
  year.dispatchEvent(new window.Event('input'));
  assert.equal(year.value, '2025');
});

test('blurring the month segment clamps an out-of-range value into 1-12', () => {
  const { month, day, year } = makeSegmentInputs();
  setupDateSegmentInput(month, day, year);
  month.value = '13';
  month.dispatchEvent(new window.Event('blur'));
  assert.equal(month.value, '12');

  month.value = '0';
  month.dispatchEvent(new window.Event('blur'));
  assert.equal(month.value, '01');
});

test('blurring the day segment clamps to the real number of days in that month/year', () => {
  const { month, day, year } = makeSegmentInputs();
  setupDateSegmentInput(month, day, year);
  month.value = '02';
  year.value = '2026'; // not a leap year — February has 28 days
  day.value = '30';
  day.dispatchEvent(new window.Event('blur'));
  assert.equal(day.value, '28');
});

test('blurring the day segment allows Feb 29 on a leap year', () => {
  const { month, day, year } = makeSegmentInputs();
  setupDateSegmentInput(month, day, year);
  month.value = '02';
  year.value = '2028'; // a leap year
  day.value = '29';
  day.dispatchEvent(new window.Event('blur'));
  assert.equal(day.value, '29');
});

test('Backspace on an empty day segment moves focus back to the month segment', () => {
  const { month, day, year } = makeSegmentInputs();
  setupDateSegmentInput(month, day, year);
  day.value = '';
  day.focus();
  day.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Backspace' }));
  assert.equal(document.activeElement, month);
});

test('missing DOM elements degrade to a safe no-op controller instead of throwing', () => {
  const field = setupDateSegmentInput(null, null, null);
  assert.equal(field.getValue(), null);
  assert.doesNotThrow(() => field.setValue('2026-01-01'));
  assert.doesNotThrow(() => field.focus());
});
