// ==========================================
// STEPPER CONTROLS (minus / value / plus)
// ==========================================
// Shared by the Pomodoro settings' Work Duration control (settings.js)
// and the habit modal's Custom Interval control (habits.js) — both are
// a plain number input flanked by minus/plus buttons, supporting a
// single click (±step) as well as press-and-hold to repeat, using the
// same pointer-event press-and-hold pattern the timer's Reset button
// already uses (see timer.js) rather than a second, different one.

const HOLD_DELAY_MS = 400; // pause before repeat kicks in, so a normal single click never double-steps
const HOLD_REPEAT_MS = 90;

function clampToRange(value, min, max) {
  if (Number.isNaN(value)) {return min;}
  return Math.min(max, Math.max(min, value));
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
    input.value = clamped;
    if (onChange) {onChange(clamped);}
  };

  const nudge = (delta) => {
    const current = parseInt(input.value, 10);
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

  // Manual typing: clamp/validate once the user finishes (blur or
  // Enter), not on every keystroke — otherwise typing "1" on the way to
  // "180" would get snapped back the moment it briefly reads as "1".
  input.addEventListener('blur', () => setValue(parseInt(input.value, 10)));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {input.blur();}
  });
}
