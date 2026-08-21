// ==========================================
// SEGMENTED DATE INPUT (MM / DD / YYYY)
// ==========================================
// Replaces a native <input type="date"> with three plain numeric inputs
// this app fully controls — used by the Progress tab's Custom Range
// modal (progress.js). A native date input is an opaque, browser-drawn
// control: its intrinsic width doesn't reliably fill a flex-stretched
// container (Start/End were reported as not filling the full line, and
// sitting oddly positioned within it), and on at least some browsers
// the year segment keeps accepting more digits past 4 if the person
// keeps typing rather than capping and moving on. Neither is something
// CSS or JS can reach into and fix on the native widget — three plain
// inputs this file owns outright fixes both directly.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function daysInMonth(month, year) {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return DAYS_IN_MONTH[month - 1];
}

function digitsOnly(el, maxLen) {
  el.value = el.value.replace(/\D/g, '').slice(0, maxLen);
}

/**
 * Wires a {month, day, year} trio of plain text inputs into one
 * cohesive date field: typing the last digit a segment can hold
 * auto-advances focus to the next one (fixing the native control's
 * "keeps accepting digits past 4 in the year" issue by construction —
 * there's no fifth digit to type once focus has already moved on),
 * Backspace on an empty segment moves back to the previous one, and
 * each segment clamps/zero-pads once the person moves on (blur), not
 * on every keystroke, so they can freely type "1" on the way to "12"
 * without it snapping back at the halfway point.
 *
 * Returns { getValue(): 'YYYY-MM-DD' | null, setValue(dateStr), focus() }
 * — the same shape callers previously read off a native date input's
 * .value, so progress.js's surrounding logic barely changes.
 */
export function setupDateSegmentInput(monthEl, dayEl, yearEl) {
  if (!monthEl || !dayEl || !yearEl) {
    return { getValue: () => null, setValue: () => {}, focus: () => {} };
  }

  monthEl.addEventListener('input', () => {
    digitsOnly(monthEl, 2);
    if (monthEl.value.length === 2) {dayEl.focus(); dayEl.select();}
  });
  dayEl.addEventListener('input', () => {
    digitsOnly(dayEl, 2);
    if (dayEl.value.length === 2) {yearEl.focus(); yearEl.select();}
  });
  yearEl.addEventListener('input', () => {
    digitsOnly(yearEl, 4);
  });

  monthEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' && monthEl.selectionStart === monthEl.value.length) {dayEl.focus();}
  });
  dayEl.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && dayEl.value === '') {monthEl.focus();}
    if (e.key === 'ArrowLeft' && dayEl.selectionStart === 0) {monthEl.focus();}
    if (e.key === 'ArrowRight' && dayEl.selectionStart === dayEl.value.length) {yearEl.focus();}
  });
  yearEl.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && yearEl.value === '') {dayEl.focus();}
    if (e.key === 'ArrowLeft' && yearEl.selectionStart === 0) {dayEl.focus();}
  });

  monthEl.addEventListener('blur', () => {
    if (monthEl.value === '') {return;}
    monthEl.value = String(clamp(parseInt(monthEl.value, 10) || 1, 1, 12)).padStart(2, '0');
  });
  dayEl.addEventListener('blur', () => {
    if (dayEl.value === '') {return;}
    const month = parseInt(monthEl.value, 10) || 1;
    const year = parseInt(yearEl.value, 10) || new Date().getFullYear();
    dayEl.value = String(clamp(parseInt(dayEl.value, 10) || 1, 1, daysInMonth(month, year))).padStart(2, '0');
  });
  yearEl.addEventListener('blur', () => {
    if (yearEl.value === '') {return;}
    yearEl.value = String(clamp(parseInt(yearEl.value, 10) || new Date().getFullYear(), 1970, 2100)).padStart(4, '0');
  });

  return {
    getValue() {
      if (monthEl.value === '' || dayEl.value === '' || yearEl.value.length !== 4) {return null;}
      const year = clamp(parseInt(yearEl.value, 10), 1970, 2100);
      const month = clamp(parseInt(monthEl.value, 10), 1, 12);
      const day = clamp(parseInt(dayEl.value, 10), 1, daysInMonth(month, year));
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    },
    setValue(dateStr) {
      if (!dateStr) {
        monthEl.value = '';
        dayEl.value = '';
        yearEl.value = '';
        return;
      }
      const [y, m, d] = dateStr.split('-');
      yearEl.value = y || '';
      monthEl.value = m || '';
      dayEl.value = d || '';
    },
    focus() {
      monthEl.focus();
    },
  };
}
