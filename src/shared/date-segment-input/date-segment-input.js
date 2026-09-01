// ==========================================
// SEGMENTED DATE INPUT (MM / DD / YYYY or YYYY / MM / DD)
// ==========================================
// Replaces native date inputs with three plain numeric inputs that work
// with Gregorian calendar (en) and Iranian Shamsi/Jalali calendar (fa).

import { getLocale } from '../../core/i18n.js';
import {
  gregorianToJalali, jalaliToGregorian, parsePersianDigits, toPersianDigits, jalaliDaysInMonth
} from '../../core/date-utils.js';

const DAYS_IN_MONTH_GREGORIAN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function daysInMonth(month, year, isJalali = false) {
  if (isJalali) {return jalaliDaysInMonth(month, year);}

  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return DAYS_IN_MONTH_GREGORIAN[month - 1] || 30;
}

// Writes a plain-digit string to a segment field, displaying it in Persian
// glyphs under fa locale (Latin otherwise). Every place that used to do
// `el.value = someDigitString` now goes through this instead, so typed
// input, blur-clamping, and setValue() (populating the fields when the
// picker opens) all render consistently.
function setSegmentValue(el, rawStr) {
  el.value = getLocale() === 'fa' ? toPersianDigits(rawStr) : rawStr;
}

function digitsOnly(el, maxLen) {
  // Accepts Persian/Eastern-Arabic digits as typed (parsePersianDigits
  // normalizes them for parsing) but keeps the box's *displayed* text in
  // Persian glyphs under fa locale, instead of snapping every keystroke to
  // Latin digits — matching how numbers render everywhere else in the app.
  // toPersianDigits (not formatNumber) is deliberate here: it maps digit-
  // for-digit and preserves leading zeros ('04' stays 2 chars), which the
  // length-based auto-advance-to-next-field logic below depends on.
  const normalized = parsePersianDigits(el.value).replace(/\D/g, '').slice(0, maxLen);
  setSegmentValue(el, normalized);
}

// The plain ASCII digits currently in a segment field, regardless of
// which script it's displaying them in. No caching here on purpose —
// deriving it fresh from el.value every time (rather than stashing it in
// a dataset attribute alongside each write) means it can never go stale
// if something sets .value directly instead of going through
// setSegmentValue/digitsOnly. parsePersianDigits() round-trips correctly
// either way: plain ASCII digits pass through unchanged.
function rawValue(el) {
  return parsePersianDigits(el.value).replace(/\D/g, '');
}

export function setupDateSegmentInput(yearEl, monthEl, dayEl) {
  if (!monthEl || !dayEl || !yearEl) {
    return { getValue: () => null, setValue: () => {}, focus: () => {} };
  }

  // FIX: reordered from month->day->year (MM/DD/YYYY) to year->month->day
  // (YYYY/MM/DD) throughout — typing/auto-advance, backspace, arrow-key
  // navigation, and focus() all follow this order now, matching the new
  // visual order in index.html. Both locales share the same logical
  // YYYY/MM/DD order; only the visual left-to-right vs right-to-left flow
  // differs, and that's handled by the browser's own bidi layout once
  // dir="rtl" is set on the page (see setLocale in i18n.js) — nothing
  // date-specific needed here for that part.
  yearEl.addEventListener('input', () => {
    digitsOnly(yearEl, 4);
    if (rawValue(yearEl).length === 4) {monthEl.focus(); monthEl.select();}
  });
  monthEl.addEventListener('input', () => {
    digitsOnly(monthEl, 2);
    if (rawValue(monthEl).length === 2) {dayEl.focus(); dayEl.select();}
  });
  dayEl.addEventListener('input', () => {
    digitsOnly(dayEl, 2);
  });

  yearEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' && yearEl.selectionStart === yearEl.value.length) {monthEl.focus();}
  });
  monthEl.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && rawValue(monthEl) === '') {yearEl.focus();}
    if (e.key === 'ArrowLeft' && monthEl.selectionStart === 0) {yearEl.focus();}
    if (e.key === 'ArrowRight' && monthEl.selectionStart === monthEl.value.length) {dayEl.focus();}
  });
  dayEl.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && rawValue(dayEl) === '') {monthEl.focus();}
    if (e.key === 'ArrowLeft' && dayEl.selectionStart === 0) {monthEl.focus();}
  });

  yearEl.addEventListener('blur', () => {
    if (rawValue(yearEl) === '') {return;}
    const isJalali = getLocale() === 'fa';
    const minYear = isJalali ? 1300 : 1970;
    const maxYear = isJalali ? 1500 : 2100;
    const defaultYear = isJalali ? 1405 : new Date().getFullYear();
    setSegmentValue(yearEl, String(clamp(parseInt(rawValue(yearEl), 10) || defaultYear, minYear, maxYear)).padStart(4, '0'));
  });
  monthEl.addEventListener('blur', () => {
    if (rawValue(monthEl) === '') {return;}
    setSegmentValue(monthEl, String(clamp(parseInt(rawValue(monthEl), 10) || 1, 1, 12)).padStart(2, '0'));
  });
  dayEl.addEventListener('blur', () => {
    if (rawValue(dayEl) === '') {return;}
    const isJalali = getLocale() === 'fa';
    const month = parseInt(rawValue(monthEl), 10) || 1;
    const year = parseInt(rawValue(yearEl), 10) || (isJalali ? 1405 : new Date().getFullYear());
    setSegmentValue(dayEl, String(clamp(parseInt(rawValue(dayEl), 10) || 1, 1, daysInMonth(month, year, isJalali))).padStart(2, '0'));
  });

  return {
    getValue() {
      if (rawValue(monthEl) === '' || rawValue(dayEl) === '' || rawValue(yearEl).length !== 4) {return null;}
      const isJalali = getLocale() === 'fa';
      const m = clamp(parseInt(rawValue(monthEl), 10), 1, 12);
      const y = parseInt(rawValue(yearEl), 10);
      const d = clamp(parseInt(rawValue(dayEl), 10), 1, daysInMonth(m, y, isJalali));

      if (isJalali) {
        // Convert Jalali date to Gregorian YYYY-MM-DD
        const { gy, gm, gd } = jalaliToGregorian(y, m, d);
        return `${String(gy).padStart(4, '0')}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
      }

      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    },
    setValue(dateStr) {
      if (!dateStr) {
        setSegmentValue(monthEl, '');
        setSegmentValue(dayEl, '');
        setSegmentValue(yearEl, '');
        return;
      }
      const isJalali = getLocale() === 'fa';
      const [gy, gm, gd] = dateStr.split('-').map(Number);

      if (isJalali && gy && gm && gd) {
        const { jy, jm, jd } = gregorianToJalali(gy, gm, gd);
        setSegmentValue(yearEl, String(jy).padStart(4, '0'));
        setSegmentValue(monthEl, String(jm).padStart(2, '0'));
        setSegmentValue(dayEl, String(jd).padStart(2, '0'));
        return;
      }

      setSegmentValue(yearEl, String(gy || '').padStart(4, '0'));
      setSegmentValue(monthEl, String(gm || '').padStart(2, '0'));
      setSegmentValue(dayEl, String(gd || '').padStart(2, '0'));
    },
    focus() {
      yearEl.focus();
    },
  };
}
