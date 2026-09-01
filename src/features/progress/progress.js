import { showToast } from '../../shared/toast/toast.js';
import { setupSelectDropdown } from '../../shared/dropdown/dropdown.js';
import { readJSON, writeJSON, readRaw, STORAGE_KEYS } from '../../core/storage.js';
import { calculateStats } from './progress-stats.js';
import { renderFocusHeatmap, renderHabitHeatmap } from './progress-heatmap.js';
import { setupDateSegmentInput } from '../../shared/date-segment-input/date-segment-input.js';
import { t, formatDate, formatNumber, getLocale } from '../../core/i18n.js';
import { gregorianToJalali, jalaliToGregorian, stepJalaliMonth } from '../../core/date-utils.js';

// Global Progress State
const savedProgressPrefs = readJSON(STORAGE_KEYS.PROGRESS_VIEW_PREFS, {});
let timeRange = savedProgressPrefs.timeRange || 'weekly';
let refDate = new Date();
refDate.setHours(0,0,0,0);
let customStartDate = savedProgressPrefs.customStartDate ? new Date(savedProgressPrefs.customStartDate) : null;
let customEndDate = savedProgressPrefs.customEndDate ? new Date(savedProgressPrefs.customEndDate) : null;
let pendingCustomStart = null;
let pendingCustomEnd = null;

let showPomodoro = savedProgressPrefs.showPomodoro !== undefined ? savedProgressPrefs.showPomodoro : true;
let showHabits = savedProgressPrefs.showHabits !== undefined ? savedProgressPrefs.showHabits : true;
let compareMode = savedProgressPrefs.compareMode !== undefined ? savedProgressPrefs.compareMode : true;

export function saveProgressViewPrefs() {
  writeJSON(STORAGE_KEYS.PROGRESS_VIEW_PREFS, {
    timeRange,
    showPomodoro,
    showHabits,
    compareMode,
    customStartDate: customStartDate ? customStartDate.toISOString() : null,
    customEndDate: customEndDate ? customEndDate.toISOString() : null
  });
}

// Read/write bridge for the three dashboard toggles now that they live in
// the shared #settings-modal (see the full-merge FIX note in
// setupProgressEvents below) instead of their own progress-settings-modal.
// settings.js's loadSettings()/saveSettings() call these instead of
// touching this module's private showPomodoro/showHabits/compareMode
// state directly.
export function getProgressViewToggles() {
  return { showPomodoro, showHabits, compareMode };
}

export function setProgressViewToggles({ showPomodoro: sp, showHabits: sh, compareMode: cm }) {
  showPomodoro = sp;
  showHabits = sh;
  compareMode = cm;

  // BUG FIX (carried over from the old progress-settings-modal save
  // handler): if both tabs are now ON and a custom range is active that's
  // too wide for a combined view, shrink it so the charts stay readable.
  if (showPomodoro && showHabits && timeRange === 'custom' && customStartDate && customEndDate) {
    const diffDays = Math.ceil(Math.abs(customEndDate - customStartDate) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 60) {
      customStartDate = new Date(customEndDate);
      customStartDate.setDate(customStartDate.getDate() - 59);
      showToast(t('range_auto_adjusted_warning'), 'warning');
    }
  }

  saveProgressViewPrefs();
  renderProgressDashboard();
}

// ==========================================
// CORE RENDER FUNCTION
// ==========================================
export function renderProgressDashboard() {
  const currentTasks = readJSON(STORAGE_KEYS.TASKS, [], 'array');
  const currentHabits = readJSON(STORAGE_KEYS.HABITS, [], 'array');

  const bounds = getDateBounds(refDate, timeRange);

  const prevRefDate = new Date(bounds.start);
  if (timeRange === 'daily') {prevRefDate.setDate(prevRefDate.getDate() - 1);}
  else if (timeRange === 'weekly') {prevRefDate.setDate(prevRefDate.getDate() - 7);}
  else if (timeRange === 'monthly') {
    // FIX: .setMonth() steps a Gregorian month, which doesn't reliably
    // land in the previous Jalali month (they don't share boundaries).
    // getDateBounds() above already computed bounds.start as the correct
    // first day of the current period in either calendar; stepping back
    // one more day from there and asking getDateBounds() to bucket that
    // day is simpler and more robust than re-deriving "one month back"
    // twice in two different ways.
    if (getLocale() === 'fa') {
      const oneDayBeforeStart = new Date(bounds.start);
      oneDayBeforeStart.setDate(oneDayBeforeStart.getDate() - 1);
      prevRefDate.setTime(oneDayBeforeStart.getTime());
    } else {
      prevRefDate.setMonth(prevRefDate.getMonth() - 1);
    }
  }
  else if (timeRange === 'custom') {
    const diffTime = Math.abs(bounds.end - bounds.start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    prevRefDate.setDate(bounds.start.getDate() - diffDays);
  }
  const prevBounds = getDateBounds(prevRefDate, timeRange);

  const currentStats = calculateStats(bounds.start, bounds.end, currentTasks, currentHabits, showPomodoro, showHabits);
  const prevStats = calculateStats(prevBounds.start, prevBounds.end, currentTasks, currentHabits, showPomodoro, showHabits);

  const periodLabel = updateLeftPanelUI(currentStats, prevStats, bounds);
  syncRangeDisplay();
  renderFocusHeatmap(bounds.start, bounds.end, currentTasks, showPomodoro, showHabits);
  renderHabitHeatmap(bounds.start, bounds.end, currentHabits, showPomodoro, showHabits);

  // FIX: this used to be a hardcoded English string ('Focus App -
  // Dashboard') that also ignored the actual selected period entirely —
  // it never changed with the date-range title right next to it on the
  // page, and stayed in English even after switching to fa. Now it
  // reuses the exact same period label updateLeftPanelUI just computed
  // (so the two can never drift apart) and goes through t() like every
  // other title update.
  if (readRaw(STORAGE_KEYS.ACTIVE_TAB) === '2') {document.title = `${t('app_title')} - ${periodLabel}`;}
}

function updateLeftPanelUI(curr, prev, bounds) {
  const title = document.getElementById('left-panel-title');
  const formatShort = (d) => formatDate(d, { month: 'short', day: 'numeric' });

  let periodLabel = '';
  if (timeRange === 'daily') {periodLabel = formatShort(bounds.start);}
  else if (timeRange === 'weekly') {periodLabel = `${formatShort(bounds.start)} - ${formatShort(bounds.end)}`;}
  else if (timeRange === 'monthly') {periodLabel = formatDate(bounds.start, { month: 'long', year: 'numeric' });}
  else if (timeRange === 'custom') {periodLabel = `${formatShort(bounds.start)} - ${formatShort(bounds.end)}`;}

  if (title) {title.textContent = periodLabel;}

  // BUG FIX: True Weighted Average of Both Tabs!
  let totalItems = 0;
  let completedItems = 0;

  if (showPomodoro) {
    totalItems += curr.totalTasksCreated;
    completedItems += curr.totalTasksCompleted;
  }
  if (showHabits) {
    totalItems += curr.totalExpectedLogs;
    completedItems += curr.totalSuccessfulLogs;
  }

  const finalScore = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

  const scoreVal = document.getElementById('hero-score-value');
  if (scoreVal) {scoreVal.textContent = `${formatNumber(finalScore)}%`;}

  const ring = document.getElementById('hero-consistency-ring');
  if (ring) {
    const radius = (ring.r && ring.r.baseVal) ? ring.r.baseVal.value : 80;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (finalScore / 100) * circumference;
    ring.style.strokeDasharray = `${circumference} ${circumference}`;
    requestAnimationFrame(() => ring.style.strokeDashoffset = offset);
  }

  // Seconds, not just minutes — a stat that only ever showed "0h 0m"
  // for a short session gave no sense that the timer was actually
  // tracking anything at all. curr.focusSeconds is the true running
  // total (calculateStats sums raw seconds internally); focusMinutes is
  // kept separately, unrounded from these, purely for the delta badge
  // below so its m/m comparison stays exactly as it always was.
  const totalSeconds = Math.max(0, Math.floor(curr.focusSeconds || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const statFocus = document.getElementById('stat-total-focus');
  const statItems = document.getElementById('stat-items-done');
  const statPerfect = document.getElementById('stat-perfect-days');

  if (statFocus) {statFocus.textContent = `${formatNumber(hours)}h ${formatNumber(mins)}m ${formatNumber(secs)}s`;}
  if (statItems) {statItems.textContent = formatNumber(curr.itemsCompleted);}
  if (statPerfect) {statPerfect.textContent = formatNumber(curr.perfectDaysCount);}

  updateDeltaBadge('delta-focus', curr.focusMinutes, prev.focusMinutes, 'm');
  updateDeltaBadge('delta-items', curr.itemsCompleted, prev.itemsCompleted, '');
  updateDeltaBadge('delta-perfect', curr.perfectDaysCount, prev.perfectDaysCount, '');

  return periodLabel;
}

function updateDeltaBadge(elementId, currVal, prevVal, suffix) {
  const badge = document.getElementById(elementId);
  if (!badge) {return;}

  if (!compareMode || timeRange === 'custom') {
    badge.classList.remove('show');
    return;
  }

  const diff = currVal - prevVal;
  badge.className = 'delta-badge show';

  if (diff > 0) {
    badge.classList.add('positive');
    badge.textContent = `↑ ${formatNumber(diff)}${suffix}`;
  } else if (diff < 0) {
    badge.classList.add('negative');
    badge.textContent = `↓ ${formatNumber(Math.abs(diff))}${suffix}`;
  } else {
    badge.classList.add('neutral');
    badge.textContent = `- ${formatNumber(0)}${suffix}`;
  }
}

// ==========================================
// DATE HELPERS
// ==========================================
export function getDateBounds(date, range) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  const isJalali = getLocale() === 'fa';

  if (range === 'daily') {return { start: new Date(d), end: new Date(d) };}
  if (range === 'weekly') {
    // FIX: this used to always find "start of week" as Monday
    // (ISO/Gregorian convention) regardless of locale, so the Persian
    // "weekly" view showed correctly Jalali-formatted date *labels* on a
    // week range that didn't actually correspond to how a Persian week is
    // reckoned — the Persian week starts Saturday, not Monday. d.getDay()
    // is 0=Sun..6=Sat either way (it's a plain Gregorian Date under the
    // hood); (getDay() + 1) % 7 gives "days since Saturday" the same way
    // it does for the calendar-popover's weekday alignment.
    const start = new Date(d);
    if (isJalali) {
      const daysSinceSaturday = (d.getDay() + 1) % 7;
      start.setDate(d.getDate() - daysSinceSaturday);
    } else {
      const day = d.getDay() || 7;
      start.setDate(d.getDate() - day + 1);
    }
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  }
  if (range === 'monthly') {
    // FIX: this used to always use Gregorian calendar-month boundaries
    // (new Date(y, m, 1) / new Date(y, m+1, 0)) regardless of locale — so
    // the Persian "monthly" view showed a Gregorian month's data (e.g.
    // "August 2026") with a Jalali-formatted title on top, rather than an
    // actual Jalali month (e.g. Shahrivar 1405, which runs Aug 23-Sep 22
    // and doesn't align with any single Gregorian month). Mirrors the
    // same jalaliToGregorian-based approach used for the date-picker
    // popover's month grid.
    if (isJalali) {
      const { jy, jm } = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
      const startG = jalaliToGregorian(jy, jm, 1);
      const nextMonthStart = stepJalaliMonth(new Date(startG.gy, startG.gm - 1, startG.gd), 1);
      const end = new Date(nextMonthStart);
      end.setDate(end.getDate() - 1);
      return { start: new Date(startG.gy, startG.gm - 1, startG.gd), end };
    }
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { start, end };
  }
  if (range === 'custom') {return { start: customStartDate || new Date(), end: customEndDate || new Date() };}
}

// FIX: #prog-range-display used to also carry a static data-i18n="weekly_range"
// in index.html — harmless as a default, except translateDOM() re-applies
// every data-i18n element unconditionally on every languageChanged, so it
// silently reset this span back to "Weekly" regardless of which range was
// actually selected (Monthly view stayed correctly on Monthly — the bug
// was purely cosmetic, in this label only). Removed that attribute; this
// function is the one place that keeps the display in sync with the real
// timeRange now, reading the matching dropdown item's own (correctly
// data-i18n-mapped) text rather than hardcoding anything itself. Called
// once at setup and again from renderProgressDashboard() on every
// languageChanged, after translateDOM() has already re-translated the
// individual dropdown items themselves.
function syncRangeDisplay() {
  const rangeDropdown = document.getElementById('prog-range-dropdown');
  const rangeDisplay = document.getElementById('prog-range-display');
  if (!rangeDisplay || !rangeDropdown) {return;}

  if (timeRange === 'custom') {
    rangeDisplay.textContent = t('custom_range');
    return;
  }
  const activeItem = rangeDropdown.querySelector(`[data-range="${timeRange}"]`);
  if (activeItem) {
    rangeDropdown.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active-sort'));
    activeItem.classList.add('active-sort');
    rangeDisplay.textContent = activeItem.textContent;
  }
}

// ==========================================
// EVENT LISTENERS INITIALIZATION
// ==========================================
export function setupProgressEvents() {

  document.addEventListener('dataUpdated', () => {
    const progressView = document.getElementById('progress-view');
    if (progressView && progressView.style.display !== 'none') {
      renderProgressDashboard();
    }
  });

  document.addEventListener('progressTabOpened', () => {
    renderProgressDashboard();
  });

  const prevBtn = document.getElementById('prog-prev-btn');
  const nextBtn = document.getElementById('prog-next-btn');

  if (prevBtn) {prevBtn.addEventListener('click', () => {
    if (timeRange === 'daily') {refDate.setDate(refDate.getDate() - 1);}
    else if (timeRange === 'weekly') {refDate.setDate(refDate.getDate() - 7);}
    else if (timeRange === 'monthly') {
      // FIX: .setMonth() steps a Gregorian month — doesn't land in the
      // previous Jalali month, since their boundaries don't line up.
      if (getLocale() === 'fa') {refDate.setTime(stepJalaliMonth(refDate, -1).getTime());}
      else {refDate.setMonth(refDate.getMonth() - 1);}
    }
    else if (timeRange === 'custom') {
      const bounds = getDateBounds(refDate, 'custom');
      const diffDays = Math.ceil(Math.abs(bounds.end - bounds.start) / (1000 * 60 * 60 * 24)) + 1;
      customStartDate.setDate(customStartDate.getDate() - diffDays);
      customEndDate.setDate(customEndDate.getDate() - diffDays);
    }
    renderProgressDashboard();
  });}

  if (nextBtn) {nextBtn.addEventListener('click', () => {
    if (timeRange === 'daily') {refDate.setDate(refDate.getDate() + 1);}
    else if (timeRange === 'weekly') {refDate.setDate(refDate.getDate() + 7);}
    else if (timeRange === 'monthly') {
      if (getLocale() === 'fa') {refDate.setTime(stepJalaliMonth(refDate, 1).getTime());}
      else {refDate.setMonth(refDate.getMonth() + 1);}
    }
    else if (timeRange === 'custom') {
      const bounds = getDateBounds(refDate, 'custom');
      const diffDays = Math.ceil(Math.abs(bounds.end - bounds.start) / (1000 * 60 * 60 * 24)) + 1;
      customStartDate.setDate(customStartDate.getDate() + diffDays);
      customEndDate.setDate(customEndDate.getDate() + diffDays);
    }
    renderProgressDashboard();
  });}

  const rangeBtn = document.getElementById('prog-range-btn');
  const rangeDropdown = document.getElementById('prog-range-dropdown');
  const rangeDisplay = document.getElementById('prog-range-display');
  const customRangeModal = document.getElementById('custom-range-modal');

  syncRangeDisplay();

  if (rangeBtn && rangeDropdown) {
    rangeDropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const selectedRange = item.dataset.range;

        if (selectedRange === 'custom') {
          openCustomRangeModal();
        } else {
          rangeDropdown.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active-sort'));
          item.classList.add('active-sort');
          timeRange = selectedRange;
          refDate = new Date();
          if (rangeDisplay) {rangeDisplay.textContent = item.textContent;}
          saveProgressViewPrefs();
          renderProgressDashboard();
        }
        rangeDropdown.classList.remove('show');
      });
    });

    setupSelectDropdown({ wrapperId: 'prog-range-wrapper', triggerId: 'prog-range-btn', dropdownId: 'prog-range-dropdown' });
  }

  const applyCustomBtn = document.getElementById('apply-custom-range');
  const closeCustomBtn = document.getElementById('close-custom-range');
  const cancelCustomBtn = document.getElementById('cancel-custom-range');
  const startDateField = setupDateSegmentInput(
    document.getElementById('range-start-year'),
    document.getElementById('range-start-month'),
    document.getElementById('range-start-day')
  );
  const endDateField = setupDateSegmentInput(
    document.getElementById('range-end-year'),
    document.getElementById('range-end-month'),
    document.getElementById('range-end-day')
  );

  const toInputDate = date => {
    const local = new Date(date);
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
    return local.toISOString().slice(0, 10);
  };

  const openCustomRangeModal = () => {
    if (!customRangeModal) {return;}

    pendingCustomStart = customStartDate ? new Date(customStartDate) : new Date();
    pendingCustomEnd = customEndDate ? new Date(customEndDate) : new Date();
    startDateField.setValue(toInputDate(pendingCustomStart));
    endDateField.setValue(toInputDate(pendingCustomEnd));
    customRangeModal.classList.add('show');
    startDateField.focus();
  };

  const closeCustomRangeModal = () => {
    pendingCustomStart = null;
    pendingCustomEnd = null;
    if (customRangeModal) {customRangeModal.classList.remove('show');}
  };

  if (closeCustomBtn) {closeCustomBtn.addEventListener('click', closeCustomRangeModal);}
  if (cancelCustomBtn) {cancelCustomBtn.addEventListener('click', closeCustomRangeModal);}

  if (applyCustomBtn && customRangeModal) {
    applyCustomBtn.addEventListener('click', () => {
      const startInput = startDateField.getValue() || '';
      const endInput = endDateField.getValue() || '';
      if (!startInput || !endInput) {
        showToast(t('choose_both_dates'), 'warning');
        return;
      }

      const start = new Date(`${startInput}T00:00:00`);
      const end = new Date(`${endInput}T23:59:59.999`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        showToast(t('choose_valid_dates'), 'warning');
        return;
      }
      if (start > end) {
        showToast(t('start_before_end'), 'warning');
        return;
      }

      const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
      const maxAllowedDays = (showPomodoro && showHabits) ? 60 : 100;
      if (diffDays > maxAllowedDays) {
        showToast(t('range_limit_warning', { max: maxAllowedDays }), 'warning');
        return;
      }

      customStartDate = start;
      customEndDate = end;
      timeRange = 'custom';
      refDate = new Date(start);
      refDate.setHours(0, 0, 0, 0);
      if (rangeDisplay) {rangeDisplay.textContent = t('custom_range');}
      rangeDropdown?.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active-sort'));
      rangeDropdown?.querySelector('[data-range="custom"]')?.classList.add('active-sort');
      closeCustomRangeModal();
      saveProgressViewPrefs();
      renderProgressDashboard();
    });
  }

  const setBtn = document.getElementById('prog-settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const repModal = document.getElementById('daily-report-modal');
  const closeRep = document.getElementById('close-report-modal');

  // Reuses the same shared #settings-modal that Habits' and Pomodoro's
  // gear buttons already open, instead of a separate progress-settings-
  // modal — gives Progress the same Help/Quotes/Export/Import/Trash
  // access for free, and avoids the class of sync bug a separate modal
  // had (its own language dropdown went stale because it set .value
  // directly instead of dispatching a change event, unlike the shared
  // modal's own dropdown helper). The one thing that's actually
  // Progress-specific is the three dashboard toggles (Show Pomodoro/
  // Habits/Compare, read/written via getProgressViewToggles/
  // setProgressViewToggles below) — those only make sense when the
  // modal was opened from here, not from Habits or Pomodoro, so
  // 'progress-context' is a CSS-only flag (see .progress-dashboard-
  // section in modal.css) set only on this entry point.
  if (setBtn && settingsModal) {
    setBtn.addEventListener('click', () => {
      document.dispatchEvent(new Event('reloadSettingsUI'));
      settingsModal.classList.add('progress-context');
      settingsModal.classList.add('show');
    });
  }

  if (closeRep && repModal) {closeRep.addEventListener('click', () => repModal.classList.remove('show'));}

  document.addEventListener('click', (e) => {
    if (repModal && e.target === repModal) {repModal.classList.remove('show');}
    if (customRangeModal && e.target === customRangeModal) {closeCustomRangeModal();}
  });

  document.addEventListener('tabChanged', () => {
    // FIX: same hardcoded English string as the one in
    // renderProgressDashboard above, plus it never included the actual
    // period either. Reuses whatever #left-panel-title already shows
    // (renderProgressDashboard keeps that in sync on every data/date/
    // locale change) rather than recomputing the same date-bounds logic
    // a third time.
    if (readRaw(STORAGE_KEYS.ACTIVE_TAB) === '2') {
      const currentPeriodLabel = document.getElementById('left-panel-title');
      document.title = currentPeriodLabel && currentPeriodLabel.textContent
        ? `${t('app_title')} - ${currentPeriodLabel.textContent}`
        : t('app_title');
    }
  });
}