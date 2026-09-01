// ==========================================
// STEPPER CONTROLS (minus / value / plus)
// ==========================================
// Shared by the Pomodoro settings' Work Duration control (settings.js)
// and the habit modal's Custom Interval control (habits.js) — both are
// a plain number input flanked by minus/plus buttons, supporting a
// single click (±step) as well as press-and-hold to repeat, using the
// same pointer-event press-and-hold pattern the timer's Reset button
// already uses (see timer.js) rather than a second, different one.

import { parsePersianDigits, toPersianDigits } from '../../core/date-utils.js';
import { getLocale } from '../../core/i18n.js';

const HOLD_DELAY_MS = 400; // pause before repeat kicks in, so a normal single click never double-steps
const HOLD_REPEAT_MS = 90;

function clampToRange(value, min, max) {
  if (Number.isNaN(value)) {return min;}
  return Math.min(max, Math.max(min, value));
}

// FIX: this stepper's input used to be type="number" — a native number
// input can only ever display plain ASCII digits, by spec, regardless of
// what's assigned to .value (a browser won't render Persian glyphs in
// one, and assigning a non-ASCII-parseable string to .value just clears
// it). Work Duration and the habit custom-interval control (both share
// this file) were the two remaining numeric inputs in the app stuck in
// Latin digits even under fa locale. index.html now has these as
// type="text" inputmode="numeric" instead — same fix as the custom-range
// date segments (date-segment-input.js) — and this function displays
// Persian digits under fa locale the same way: convert what's typed for
// parsing, but keep the actual displayed value in Persian glyphs.
// FIX: this stepper's input used to be type="number" — a native number
// input can only ever display plain ASCII digits, by spec, regardless of
// what's assigned to .value (a browser won't render Persian glyphs in
// one, and assigning a non-ASCII-parseable string to .value just clears
// it). Work Duration and the habit custom-interval control (both share
// this file) were the two remaining numeric inputs in the app stuck in
// Latin digits even under fa locale. index.html now has these as
// type="text" inputmode="numeric" instead — same fix as the custom-range
// date segments (date-segment-input.js) — and this function displays
// Persian digits under fa locale the same way: convert what's typed for
// parsing, but keep the actual displayed value in Persian glyphs.
// Exported since a few call sites outside this file also read/write
// these two inputs' .value directly (populating/resetting the habit
// modal, reading the value on save) and need the same treatment —
// see habits-modal-open.js and habits-modal-save.js.
export function setDisplayValue(input, numericValue) {
  const raw = String(numericValue);
  input.value = getLocale() === 'fa' ? toPersianDigits(raw) : raw;
}

export function readNumericValue(input) {
  return parseInt(parsePersianDigits(input.value), 10);
}

/**
 * Wires a minus button, a number input, and a plus button into a single
 * stepper control. `onChange(newValue)` (optional) fires after every
 * change — click, hold-repeat, or manual typing/blur — so callers can
 * persist/apply the new value immediately without polling the input.
 */
export function setupStepperButtons(minusId, plusId, inputId, min, max, { step = 1, onChange } = {}) {
  const minusBtn = document.getElementById(minusId);
  const plusBtn = document.getElementById(plusId);
  const input = document.getElementById(inputId);
  if (!minusBtn || !plusBtn || !input) {return;}

  const setValue = (v) => {
    const clamped = clampToRange(v, min, max);
    setDisplayValue(input, clamped);
    if (onChange) {onChange(clamped);}
  };

  const nudge = (delta) => {
    const current = readNumericValue(input);
    setValue((Number.isNaN(current) ? min : current) + delta);
  };

  const attachHold = (btn, delta) => {
    let holdTimeout = null;
    let holdInterval = null;
    const stop = () => {
      clearTimeout(holdTimeout);
      clearInterval(holdInterval);
      holdTimeout = null;
      holdInterval = null;
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      nudge(delta);
      holdTimeout = setTimeout(() => {
        holdInterval = setInterval(() => nudge(delta), HOLD_REPEAT_MS);
      }, HOLD_DELAY_MS);
    });
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointerleave', stop);
    btn.addEventListener('pointercancel', stop);
  };

  attachHold(minusBtn, -step);
  attachHold(plusBtn, step);

  input.addEventListener('input', () => {
    // Strip anything that isn't a digit (Persian or Latin) as the user
    // types, same digitsOnly-style approach as date-segment-input.js,
    // but display in whichever script the current locale calls for.
    const digitsOnly = parsePersianDigits(input.value).replace(/\D/g, '');
    input.value = getLocale() === 'fa' ? toPersianDigits(digitsOnly) : digitsOnly;
  });

  input.addEventListener('blur', () => {
    const parsed = readNumericValue(input);
    setValue(Number.isNaN(parsed) ? min : parsed);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {input.blur();}
  });

  // FIX: setupStepperButtons() only runs once at page setup, so the
  // input's initial value (whatever the static HTML has, or was already
  // set to) stayed in Latin digits until the first nudge/blur if the app
  // started in fa. Applying the current locale's script once here up
  // front closes that gap for the initial render.
  const initial = readNumericValue(input);
  if (!Number.isNaN(initial)) {setDisplayValue(input, initial);}
}
