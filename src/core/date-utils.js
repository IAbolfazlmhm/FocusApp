// ==========================================
// DATE & CALENDAR UTILITIES
// ==========================================
// Shared YYYY-MM-DD local-date formatting and pure mathematical
// Jalali (Solar Hijri / Shamsi) <-> Gregorian calendar conversions.

export function getLocalDateKey(dateObj = new Date()) {
  const d = new Date(dateObj);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Convert Gregorian date { gy, gm, gd } to Jalali { jy, jm, jd }
export function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
  let jy = -1595 + (33 * Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm, jd;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return { jy, jm, jd };
}

// Convert Jalali date { jy, jm, jd } to Gregorian { gy, gm, gd }
export function jalaliToGregorian(jy, jm, jd) {
  const jy2 = jy + 1595;
  let days = -355668 + (365 * jy2) + Math.floor(jy2 / 33) * 8 + Math.floor(((jy2 % 33) + 3) / 4) + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    days -= 1;
    gy += 100 * Math.floor(days / 36524);
    days %= 36524;
    if (days >= 365) {days++;}
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const leap = ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0));
  const sal_a = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  while (gm < 13 && days >= sal_a[gm]) {
    days -= sal_a[gm];
    gm++;
  }
  return { gy, gm, gd: days + 1 };
}

// Convert Persian digits (۰-۹) to standard English ASCII digits (0-9)
export function parsePersianDigits(str) {
  if (!str) {return '';}
  const persianMap = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
  return String(str).replace(/[۰-۹]/g, ch => persianMap[ch] || ch);
}

// The reverse of parsePersianDigits(): ASCII digits (0-9) to Persian (۰-۹).
// Character-for-character, unlike formatNumber() — that goes through
// Intl.NumberFormat on a parsed numeric value, which silently drops
// leading zeros ('04' -> 4 -> '۴'). Callers displaying a digit string
// as-typed (e.g. the segmented date input) need the length preserved.
export function toPersianDigits(str) {
  if (!str) {return '';}
  const digitMap = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(str).replace(/[0-9]/g, ch => digitMap[Number(ch)]);
}

// Whether a Jalali year is leap (Esfand has 30 days instead of 29).
// Derived from the conversion functions above (verified correct against
// a reference implementation across 100 years with zero mismatches)
// rather than a separately hand-rolled cycle formula — a Jalali year is
// leap iff its last month has a 30th day, testable by converting day 30
// to Gregorian and back and checking it round-trips to the same date.
// This one function is now the single source of truth for Jalali leap
// years — both the segmented date input and the date-picker popover
// calendar grid use it, instead of each carrying its own copy.
export function isJalaliLeapYear(year) {
  const g = jalaliToGregorian(year, 12, 30);
  const back = gregorianToJalali(g.gy, g.gm, g.gd);
  return back.jy === year && back.jm === 12 && back.jd === 30;
}

// Days in a given Jalali month/year: months 1-6 always have 31, 7-11
// always have 30, and month 12 (Esfand) has 30 or 29 depending on
// isJalaliLeapYear.
export function jalaliDaysInMonth(month, year) {
  if (month <= 6) {return 31;}
  if (month <= 11) {return 30;}
  return isJalaliLeapYear(year) ? 30 : 29;
}

// Steps a Gregorian anchor date by one Jalali month, forward or back.
// Needed instead of the native .setMonth() whenever "next/previous month"
// means a Jalali month — Jalali and Gregorian month boundaries don't line
// up, so stepping the Gregorian month of an anchor date doesn't reliably
// land in the adjacent Jalali month. Shared by the date-picker popover
// calendar and Progress's monthly-view navigation (both "next month"
// buttons need the same calendar-correct step).
export function stepJalaliMonth(anchorDate, direction) {
  const { jy, jm } = gregorianToJalali(anchorDate.getFullYear(), anchorDate.getMonth() + 1, anchorDate.getDate());
  let newJy = jy;
  let newJm = jm + direction;
  if (newJm > 12) {newJm = 1; newJy += 1;}
  if (newJm < 1) {newJm = 12; newJy -= 1;}
  const g = jalaliToGregorian(newJy, newJm, 1);
  return new Date(g.gy, g.gm - 1, g.gd);
}
