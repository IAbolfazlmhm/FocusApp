import { showToast } from '../ui/toast.js';
import { setupSelectDropdown } from '../ui/dropdown.js';
import { saveSettings } from '../settings/settings.js';
import { readJSON, readRaw, STORAGE_KEYS } from '../core/storage.js';
import { calculateStats } from './progress-stats.js';
import { renderFocusHeatmap, renderHabitHeatmap } from './progress-heatmap.js';
import { setupDateSegmentInput } from '../ui/date-segment-input.js';

// Global Progress State
let timeRange = 'weekly';
let refDate = new Date();
refDate.setHours(0,0,0,0);
let customStartDate = null;
let customEndDate = null;
let pendingCustomStart = null;
let pendingCustomEnd = null;

let showPomodoro = true;
let showHabits = true;
let compareMode = true;

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
  else if (timeRange === 'monthly') {prevRefDate.setMonth(prevRefDate.getMonth() - 1);}
  else if (timeRange === 'custom') {
    const diffTime = Math.abs(bounds.end - bounds.start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    prevRefDate.setDate(bounds.start.getDate() - diffDays);
  }
  const prevBounds = getDateBounds(prevRefDate, timeRange);

  const currentStats = calculateStats(bounds.start, bounds.end, currentTasks, currentHabits, showPomodoro, showHabits);
  const prevStats = calculateStats(prevBounds.start, prevBounds.end, currentTasks, currentHabits, showPomodoro, showHabits);

  updateLeftPanelUI(currentStats, prevStats, bounds);
  renderFocusHeatmap(bounds.start, bounds.end, currentTasks, showPomodoro, showHabits);
  renderHabitHeatmap(bounds.start, bounds.end, currentHabits, showPomodoro, showHabits);

  if (readRaw(STORAGE_KEYS.ACTIVE_TAB) === '2') {document.title = 'Focus App - Dashboard';}
}

function updateLeftPanelUI(curr, prev, bounds) {
  const title = document.getElementById('left-panel-title');
  const formatShort = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (title) {
    if (timeRange === 'daily') {title.textContent = formatShort(bounds.start);}
    else if (timeRange === 'weekly') {title.textContent = `${formatShort(bounds.start)} - ${formatShort(bounds.end)}`;}
    else if (timeRange === 'monthly') {title.textContent = bounds.start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });}
    else if (timeRange === 'custom') {title.textContent = `${formatShort(bounds.start)} - ${formatShort(bounds.end)}`;}
  }

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
  if (scoreVal) {scoreVal.textContent = `${finalScore}%`;}

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

  if (statFocus) {statFocus.textContent = `${hours}h ${mins}m ${secs}s`;}
  if (statItems) {statItems.textContent = curr.itemsCompleted;}
  if (statPerfect) {statPerfect.textContent = curr.perfectDaysCount;}

  updateDeltaBadge('delta-focus', curr.focusMinutes, prev.focusMinutes, 'm');
  updateDeltaBadge('delta-items', curr.itemsCompleted, prev.itemsCompleted, '');
  updateDeltaBadge('delta-perfect', curr.perfectDaysCount, prev.perfectDaysCount, '');
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
    badge.textContent = `↑ ${diff}${suffix}`;
  } else if (diff < 0) {
    badge.classList.add('negative');
    badge.textContent = `↓ ${Math.abs(diff)}${suffix}`;
  } else {
    badge.classList.add('neutral');
    badge.textContent = `- 0${suffix}`;
  }
}

// ==========================================
// DATE HELPERS
// ==========================================
function getDateBounds(date, range) {
  const d = new Date(date);
  d.setHours(0,0,0,0);

  if (range === 'daily') {return { start: new Date(d), end: new Date(d) };}
  if (range === 'weekly') {
    const day = d.getDay() || 7;
    const start = new Date(d);
    start.setDate(d.getDate() - day + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  }
  if (range === 'monthly') {
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { start, end };
  }
  if (range === 'custom') {return { start: customStartDate || new Date(), end: customEndDate || new Date() };}
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
    else if (timeRange === 'monthly') {refDate.setMonth(refDate.getMonth() - 1);}
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
    else if (timeRange === 'monthly') {refDate.setMonth(refDate.getMonth() + 1);}
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
    document.getElementById('range-start-month'),
    document.getElementById('range-start-day'),
    document.getElementById('range-start-year')
  );
  const endDateField = setupDateSegmentInput(
    document.getElementById('range-end-month'),
    document.getElementById('range-end-day'),
    document.getElementById('range-end-year')
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
        showToast('Choose both a start and end date.', 'warning');
        return;
      }

      const start = new Date(`${startInput}T00:00:00`);
      const end = new Date(`${endInput}T23:59:59.999`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        showToast('Please choose valid dates.', 'warning');
        return;
      }
      if (start > end) {
        showToast('Start date must be before end date.', 'warning');
        return;
      }

      const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
      const maxAllowedDays = (showPomodoro && showHabits) ? 60 : 100;
      if (diffDays > maxAllowedDays) {
        showToast(`Please select a range of ${maxAllowedDays} days or less.`, 'warning');
        return;
      }

      customStartDate = start;
      customEndDate = end;
      timeRange = 'custom';
      refDate = new Date(start);
      refDate.setHours(0, 0, 0, 0);
      if (rangeDisplay) {rangeDisplay.textContent = 'Custom Range';}
      rangeDropdown?.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active-sort'));
      rangeDropdown?.querySelector('[data-range="custom"]')?.classList.add('active-sort');
      closeCustomRangeModal();
      renderProgressDashboard();
    });
  }

  const setBtn = document.getElementById('prog-settings-btn');
  const setModal = document.getElementById('progress-settings-modal');
  const closeSet = document.getElementById('close-prog-settings');
  const saveProgSetBtn = document.getElementById('save-prog-settings');
  const repModal = document.getElementById('daily-report-modal');
  const closeRep = document.getElementById('close-report-modal');

  const togFocus = document.getElementById('prog-toggle-focus');
  const togHabits = document.getElementById('prog-toggle-habits');
  const togComp = document.getElementById('prog-toggle-compare');
  const progDarkMode = document.getElementById('prog-dark-mode');
  const progSound = document.getElementById('prog-sound-toggle');
  const mainDarkMode = document.getElementById('dark-mode-toggle');
  const mainSound = document.getElementById('sound-toggle');

  if (setBtn && setModal) {
    setBtn.addEventListener('click', () => {
      if (togFocus) {togFocus.checked = showPomodoro; togFocus.setAttribute('aria-checked', showPomodoro.toString());}
      if (togHabits) {togHabits.checked = showHabits; togHabits.setAttribute('aria-checked', showHabits.toString());}
      if (togComp) {togComp.checked = compareMode; togComp.setAttribute('aria-checked', compareMode.toString());}
      if (progDarkMode && mainDarkMode) {progDarkMode.checked = mainDarkMode.checked; progDarkMode.setAttribute('aria-checked', mainDarkMode.checked.toString());}
      if (progSound && mainSound) {progSound.checked = mainSound.checked; progSound.setAttribute('aria-checked', mainSound.checked.toString());}
      setModal.classList.add('show');
    });
  }

  if (closeSet && setModal) {closeSet.addEventListener('click', () => setModal.classList.remove('show'));}
  if (closeRep && repModal) {closeRep.addEventListener('click', () => repModal.classList.remove('show'));}

  if (saveProgSetBtn) {
    saveProgSetBtn.addEventListener('click', () => {
      if (togFocus) {showPomodoro = togFocus.checked; togFocus.setAttribute('aria-checked', togFocus.checked.toString());}
      if (togHabits) {showHabits = togHabits.checked; togHabits.setAttribute('aria-checked', togHabits.checked.toString());}
      if (togComp) {compareMode = togComp.checked; togComp.setAttribute('aria-checked', togComp.checked.toString());}

      if (progDarkMode && mainDarkMode) {
        mainDarkMode.checked = progDarkMode.checked;
        mainDarkMode.setAttribute('aria-checked', progDarkMode.checked.toString());
        if (progDarkMode.checked) {document.body.setAttribute('data-theme', 'dark');}
        else {document.body.removeAttribute('data-theme');}
      }
      if (progSound && mainSound) {mainSound.checked = progSound.checked; mainSound.setAttribute('aria-checked', progSound.checked.toString());}

      // Call the real save logic directly instead of simulating a click on
      // the Settings modal's save button — that indirection broke silently
      // if the button's ID or handler ever changed (see
      // FocusApp-Senior-Audit.md, Finding M6).
      saveSettings();

      // BUG FIX: Protect the layout! If both tabs are now ON, and they have a massive custom range active, shrink it.
      if (showPomodoro && showHabits && timeRange === 'custom') {
        const diffDays = Math.ceil(Math.abs(customEndDate - customStartDate) / (1000 * 60 * 60 * 24)) + 1;
        if (diffDays > 60) {
          // Forcefully shrink the start date to be exactly 60 days from the end date
          customStartDate = new Date(customEndDate);
          customStartDate.setDate(customStartDate.getDate() - 59);
          showToast("Range automatically adjusted to 60 days to fit both charts.", "warning");
        }
      }

      renderProgressDashboard();
      setModal.classList.remove('show');
    });
  }

  document.addEventListener('click', (e) => {
    if (setModal && e.target === setModal) {setModal.classList.remove('show');}
    if (repModal && e.target === repModal) {repModal.classList.remove('show');}
    if (customRangeModal && e.target === customRangeModal) {closeCustomRangeModal();}
  });

  document.addEventListener('tabChanged', () => {
    if (readRaw(STORAGE_KEYS.ACTIVE_TAB) === '2') {document.title = 'Focus App - Dashboard';}
  });
}