import '../tests/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupStepperButtons, readNumericValue, setDisplayValue } from '../src/shared/stepper/stepper-utils.js';
import { setLocale } from '../src/core/i18n.js';

function makeStepper(initialValue) {
  const minus = document.createElement('button');
  const plus = document.createElement('button');
  const input = document.createElement('input');
  input.type = 'text';
  input.value = initialValue;
  document.body.appendChild(minus);
  document.body.appendChild(plus);
  document.body.appendChild(input);
  return { minus, plus, input };
}

// FIX regression coverage: work-duration and the habit repeat-interval
// input switched from type="number" (which can only ever display plain
// ASCII digits, by spec) to type="text", so they could show Persian
// digits under fa locale like every other number in the app.

test('setupStepperButtons displays the initial value in Persian digits under fa locale', () => {
  setLocale('fa');
  const { minus, plus, input } = makeStepper('25');
  setupStepperButtons(minus.id || (minus.id = 'm1'), plus.id || (plus.id = 'p1'), input.id || (input.id = 'i1'), 1, 180);
  assert.equal(input.value, '۲۵');
  setLocale('en');
});

test('setupStepperButtons keeps the initial value in Latin digits under en locale', () => {
  setLocale('en');
  const { minus, plus, input } = makeStepper('25');
  minus.id = 'm2'; plus.id = 'p2'; input.id = 'i2';
  setupStepperButtons('m2', 'p2', 'i2', 1, 180);
  assert.equal(input.value, '25');
});

test('clicking plus/minus nudges the value and keeps it displayed in Persian digits under fa', () => {
  setLocale('fa');
  const { minus, plus, input } = makeStepper('25');
  minus.id = 'm3'; plus.id = 'p3'; input.id = 'i3';
  setupStepperButtons('m3', 'p3', 'i3', 1, 180);
  // FIX: attachHold() starts a setInterval after HOLD_DELAY_MS if
  // pointerup never fires — a click always ends in pointerup in real
  // usage, so every dispatched pointerdown here needs a matching
  // pointerup, or the dangling interval keeps the test process alive
  // indefinitely (this hung the whole suite before being fixed).
  plus.dispatchEvent(new window.PointerEvent('pointerdown'));
  plus.dispatchEvent(new window.PointerEvent('pointerup'));
  assert.equal(input.value, '۲۶');
  minus.dispatchEvent(new window.PointerEvent('pointerdown'));
  minus.dispatchEvent(new window.PointerEvent('pointerup'));
  minus.dispatchEvent(new window.PointerEvent('pointerdown'));
  minus.dispatchEvent(new window.PointerEvent('pointerup'));
  assert.equal(input.value, '۲۴');
  setLocale('en');
});

test('typing Persian digits and blurring clamps and redisplays correctly in fa', () => {
  setLocale('fa');
  const { minus, plus, input } = makeStepper('25');
  minus.id = 'm4'; plus.id = 'p4'; input.id = 'i4';
  setupStepperButtons('m4', 'p4', 'i4', 1, 180);
  input.value = '۹۹۹'; // out of range (max 180), typed in Persian digits
  input.dispatchEvent(new window.Event('input'));
  assert.equal(input.value, '۹۹۹'); // input event only strips non-digits, doesn't clamp yet
  input.dispatchEvent(new window.Event('blur'));
  assert.equal(input.value, '۱۸۰'); // clamped to max, still Persian
  setLocale('en');
});

test('readNumericValue parses Persian-digit input values back to a real number', () => {
  const input = document.createElement('input');
  input.value = '۴۲';
  assert.equal(readNumericValue(input), 42);
});

test('readNumericValue parses Latin-digit input values too', () => {
  const input = document.createElement('input');
  input.value = '42';
  assert.equal(readNumericValue(input), 42);
});

test('setDisplayValue writes Persian digits under fa and Latin under en', () => {
  const input = document.createElement('input');
  setLocale('fa');
  setDisplayValue(input, 7);
  assert.equal(input.value, '۷');
  setLocale('en');
  setDisplayValue(input, 7);
  assert.equal(input.value, '7');
});

test('onChange callback receives a real parsed number, not a Persian-glyph string', () => {
  setLocale('fa');
  const { minus, plus, input } = makeStepper('5');
  minus.id = 'm5'; plus.id = 'p5'; input.id = 'i5';
  let lastChange = null;
  setupStepperButtons('m5', 'p5', 'i5', 1, 52, { onChange: (v) => { lastChange = v; } });
  plus.dispatchEvent(new window.PointerEvent('pointerdown'));
  plus.dispatchEvent(new window.PointerEvent('pointerup'));
  assert.equal(lastChange, 6);
  assert.equal(typeof lastChange, 'number');
  setLocale('en');
});
