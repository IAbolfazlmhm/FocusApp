// ==========================================
// ANCHORED DATE PICKER
// ==========================================
// Native date pickers are browser/OS surfaces, so their position cannot be
// controlled by the page (especially in device emulation). This small shared
// calendar stays inside the date navigation control for both Pomodoro and
// Habits.
import { formatDate, formatNumber, isRTL, getLocale, t } from '../../core/i18n.js';
import { gregorianToJalali, jalaliToGregorian, jalaliDaysInMonth, stepJalaliMonth } from '../../core/date-utils.js';

let activePicker = null;

function sameDate(first, second) {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

function closeActivePicker() {
  if (!activePicker) {return;}
  activePicker.trigger.setAttribute('aria-expanded', 'false');
  activePicker.element.remove();
  document.removeEventListener('pointerdown', activePicker.onPointerDown);
  document.removeEventListener('keydown', activePicker.onKeyDown);
  activePicker = null;
}

function renderCalendar(picker) {
  const { element, selectedDate } = picker;
  const rtl = isRTL();
  // FIX: this calendar used to only get cosmetic Persian treatment — the
  // month title and day aria-labels were formatted via fa-IR (which does
  // render real Jalali month/year), but the day grid itself still
  // iterated the Gregorian month underneath: Gregorian day count,
  // Gregorian weekday offset for the leading blanks. So under fa locale
  // you'd see a correct Jalali month name in the header sitting over a
  // grid of days that didn't actually belong to that month. Now the grid
  // is genuinely Jalali-aware: monthStart/totalDays are derived from the
  // actual viewed Jalali month, and each day button still holds a real,
  // correct Gregorian Date underneath (via jalaliToGregorian) for
  // selection and comparison — only the *iteration* is calendar-aware.
  const isJalali = getLocale() === 'fa';

  let monthStart;
  let totalDays;
  let jy;
  let jm;

  if (isJalali) {
    ({ jy, jm } = gregorianToJalali(picker.viewDate.getFullYear(), picker.viewDate.getMonth() + 1, picker.viewDate.getDate()));
    const g = jalaliToGregorian(jy, jm, 1);
    monthStart = new Date(g.gy, g.gm - 1, g.gd);
    totalDays = jalaliDaysInMonth(jm, jy);
  } else {
    monthStart = new Date(picker.viewDate.getFullYear(), picker.viewDate.getMonth(), 1);
    totalDays = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  }

  // Leading blank cells before day 1, aligned to whichever day the header
  // below starts on: Saturday-first for the Persian/RTL week, Sunday-first
  // otherwise. monthStart.getDay() is 0=Sun..6=Sat either way (it's a
  // plain Gregorian Date under the hood); (getDay() + 1) % 7 remaps that
  // so Saturday lands in column 0 to match the ش ی د س چ پ ج header order.
  const leadingDays = rtl ? (monthStart.getDay() + 1) % 7 : monthStart.getDay();

  const weekdaysHTML = rtl
    ? '<span>ش</span><span>ی</span><span>د</span><span>س</span><span>چ</span><span>پ</span><span>ج</span>'
    : '<span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>';

  element.innerHTML = `
    <div class="date-picker-popover-header">
      <button type="button" class="date-picker-nav-btn" aria-label="${t('previous_month')}">‹</button>
      <span class="date-picker-popover-title">${formatDate(monthStart, { month: 'long', year: 'numeric' })}</span>
      <button type="button" class="date-picker-nav-btn" aria-label="${t('next_month')}">›</button>
    </div>
    <div class="date-picker-weekdays" aria-hidden="true">
      ${weekdaysHTML}
    </div>
    <div class="date-picker-days" role="grid" aria-label="${t('choose_a_date')}"></div>
  `;

  const days = element.querySelector('.date-picker-days');
  for (let index = 0; index < leadingDays; index += 1) {
    days.append(document.createElement('span'));
  }

  for (let day = 1; day <= totalDays; day += 1) {
    // `date` is always the real, correct Gregorian date underneath —
    // computed via jalaliToGregorian when isJalali, so selection,
    // comparison, and everything else downstream keeps working with a
    // genuine Date object regardless of which calendar the grid is
    // being iterated/labeled in.
    const date = isJalali
      ? (() => { const g = jalaliToGregorian(jy, jm, day); return new Date(g.gy, g.gm - 1, g.gd); })()
      : new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `date-picker-day${sameDate(date, selectedDate) ? ' is-selected' : ''}`;
    button.textContent = formatNumber(day);
    button.setAttribute('role', 'gridcell');
    button.setAttribute('aria-label', formatDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
    button.setAttribute('aria-selected', String(sameDate(date, selectedDate)));
    button.addEventListener('click', () => {
      picker.onSelect(date);
      closeActivePicker();
    });
    days.append(button);
  }

  const [previous, next] = element.querySelectorAll('.date-picker-nav-btn');
  previous.addEventListener('click', () => {
    if (isJalali) {picker.viewDate = stepJalaliMonth(picker.viewDate, -1);}
    else {picker.viewDate.setMonth(picker.viewDate.getMonth() - 1);}
    renderCalendar(picker);
  });
  next.addEventListener('click', () => {
    if (isJalali) {picker.viewDate = stepJalaliMonth(picker.viewDate, 1);}
    else {picker.viewDate.setMonth(picker.viewDate.getMonth() + 1);}
    renderCalendar(picker);
  });
}

export function openDatePickerPopover({ trigger, selectedDate, onSelect }) {
  if (activePicker?.trigger === trigger) {
    closeActivePicker();
    return;
  }

  closeActivePicker();
  const element = document.createElement('div');
  element.className = 'date-picker-popover glass-effect';
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-label', t('choose_a_date'));
  trigger.parentElement.append(element);

  const picker = {
    element,
    trigger,
    selectedDate: new Date(selectedDate),
    // FIX: this used to truncate to "day 1 of the Gregorian month
    // containing selectedDate" before renderCalendar() ever ran — fine
    // for the Gregorian case (day 1 of a Gregorian month trivially stays
    // within that same Gregorian month), but wrong for Jalali, since
    // Gregorian and Jalali month boundaries don't align. Example: if
    // today is 7 Shahrivar 1405 (= Aug 29, 2026), truncating first
    // produces Aug 1, 2026 — which falls in *Mordad* 1405 (Shahrivar
    // only starts Aug 23), so the popover opened showing last month with
    // today's date nowhere on the grid. renderCalendar() already derives
    // the correct month-start itself from whatever viewDate holds, in
    // both calendar systems — no need to pre-truncate here at all, so
    // just carry the actual selected date through untouched.
    viewDate: new Date(selectedDate),
    onSelect,
    onPointerDown(event) {
      if (!element.contains(event.target) && event.target !== trigger) {closeActivePicker();}
    },
    onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeActivePicker();
        trigger.focus();
      }
    }
  };

  activePicker = picker;
  trigger.setAttribute('aria-expanded', 'true');
  renderCalendar(picker);
  setTimeout(() => {
    document.addEventListener('pointerdown', picker.onPointerDown);
    document.addEventListener('keydown', picker.onKeyDown);
  }, 0);
}
