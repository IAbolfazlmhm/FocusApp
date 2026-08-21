import {
  timeLeft, totalTime, timerId, isRunning, currentPhase, completedSessions,
  setTimeLeft, setTotalTime, setTimerId, setIsRunning, setCurrentPhase, setCompletedSessions,
  tasks, focusedTaskId
} from '../../core/state.js';

import { playAlarm } from '../../shared/audio.js';
import { showToast } from '../../shared/toast/toast.js';
import { icons } from '../../core/dom-utils.js';
import { readJSON, writeJSON, readRaw, remove, STORAGE_KEYS } from '../../core/storage.js';
import { getLocalDateKey } from '../../core/date-utils.js';

// Task-name length shown in the browser tab title, kept short since tab
// width is limited. Centralized as a constant so it's easy to find/tune
// instead of a bare "10" buried in updateDisplay().
const TAB_TITLE_TASK_NAME_MAX_LENGTH = 24;

// FIX: work/stopwatch sessions can now run without a focused task (a
// deliberate choice — requiring a task to even start the timer was
// blocking legitimate "just work, don't bookkeep it" sessions). Before
// this, that time was tracked nowhere: the per-task timeSpent/timeByDate
// block below only ever fires when focusedTaskId isn't null, so a whole
// taskless session would complete, sound its alarm, count toward
// completedSessions — and then vanish from every focus-time stat, since
// nothing was ever storing it. This is a minimal, separate accumulator
// (keyed by day, exactly like task.timeByDate) so that time counts
// toward the Progress tab's totals/heatmap instead of being discarded.
// Stored under STORAGE_KEYS.TASKLESS_TIME — progress.js reads the same
// key when building stats.
function addTasklessFocusTime(seconds) {
  if (seconds <= 0) {return;}
  const byDate = readJSON(STORAGE_KEYS.TASKLESS_TIME, {});
  const todayKey = getLocalDateKey();
  byDate[todayKey] = (byDate[todayKey] || 0) + seconds;
  writeJSON(STORAGE_KEYS.TASKLESS_TIME, byDate);
}

/**
 * Clears one day's taskless focus time — e.g. a stray entry from
 * testing the timer without a task selected. Exported for the daily
 * report modal (progress-report.js), the one place this total is
 * actually shown.
 */
export function clearTasklessTime(dateKey) {
  const byDate = readJSON(STORAGE_KEYS.TASKLESS_TIME, {});
  if (!(dateKey in byDate)) {return;}
  delete byDate[dateKey];
  writeJSON(STORAGE_KEYS.TASKLESS_TIME, byDate);
}

import { saveTasks } from '../tasks/tasks-storage.js';
import { formatTaskTime } from '../tasks/tasks-render.js';

// ==========================================
// DOM ELEMENTS & INITIALIZATION
// ==========================================
const timeDisplay = document.getElementById('time-left');
const startBtn = document.getElementById('start-btn');
const circle = document.querySelector('.progress-ring-circle');

// ==========================================
// DRIFT-CORRECTED TICK ANCHOR
// ==========================================
// setInterval(..., 1000) does NOT fire exactly every 1000ms — background
// tab throttling, a slow device, or a GC pause all make it drift, so a
// naive "subtract 1 every tick" approach can make a 25-minute session
// finish meaningfully early or late. Instead we record a real-world
// timestamp + the timeLeft at that moment, then compute timeLeft on every
// tick from actual elapsed wall-clock time. If a tick fires late, the next
// one self-corrects instead of accumulating error.
let tickAnchorTime = null;
let tickAnchorTimeLeft = 0;
let tickLastElapsedSeconds = 0; // elapsed seconds since anchor, as of the last tick

// FIX: cached copy of which tab is active. Previously, updateDisplay()
// (which runs every second while any timer runs) called
// readRaw(STORAGE_KEYS.ACTIVE_TAB) — a localStorage read — on every single tick.
// This value only changes when the user switches tabs (an event the app
// already dispatches: tabChanged), so caching it here and invalidating on
// that event turns a per-second cost into a one-time cost.
let cachedActiveTab = readRaw(STORAGE_KEYS.ACTIVE_TAB, '0');

// getLocalDateKey() (date-utils.js) provides the shared YYYY-MM-DD local-
// date format used here and in progress.js — previously two separately
// duplicated copies of the same logic, extracted into one shared module.

// Calculate circle circumference for progress animation
const radius = circle ? circle.r.baseVal.value : 110;
const circumference = radius * 2 * Math.PI;

if (circle) {
  circle.style.strokeDasharray = `${circumference} ${circumference}`;
  circle.style.strokeDashoffset = 0;
}

// ==========================================
// TIMER STATE MANAGEMENT
// ==========================================
export function saveTimerState() {
  const state = {
    timeLeft,
    totalTime,
    currentPhase,
    completedSessions,
    lastSaved: Date.now()
  };
  writeJSON(STORAGE_KEYS.TIMER_STATE, state);
}

export function loadTimerState() {
  const state = readJSON(STORAGE_KEYS.TIMER_STATE, null);
  if (!state) {return false;}

  const FOUR_HOURS = 4 * 60 * 60 * 1000;

  // Invalidate state if it's older than 4 hours
  if (Date.now() - state.lastSaved > FOUR_HOURS) {
    remove('focusTimerState');
    return false;
  }

  // Use state setters to update global state
  setTimeLeft(state.timeLeft);
  setTotalTime(state.totalTime);
  setCurrentPhase(state.currentPhase);
  setCompletedSessions(state.completedSessions);

  const modeSelect = document.getElementById('mode-select');
  if (modeSelect && modeSelect.value === 'pomodoro') {
    updatePhaseText();
  }

  updateDisplay();
  updateCircle();
  updatePhaseColors();

  return true;
}

// ==========================================
// DOM UPDATE FUNCTIONS
// ==========================================
export function updateCircle() {
  if (!circle) {return;}
  const offset = circumference - (timeLeft / totalTime) * circumference;
  circle.style.strokeDashoffset = offset;
}

export function updateDisplay() {
  if (!timeDisplay) {return;}

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  timeDisplay.textContent = formattedTime;

  // FIX: this used to compute activeTaskName once here, then recompute it
  // a second time inside the block below with looser (redundant) typeof
  // checks — the first computation was dead code that never got used.
  // Now there's a single lookup, reused for both the tab title (below) and
  // the truncation length is a shared constant instead of a bare "10".
  let activeTaskName = 'Focus App';
  if (focusedTaskId !== null && tasks) {
    const activeTask = tasks.find(t => t.id === focusedTaskId);
    if (activeTask) {activeTaskName = activeTask.text;}
  }

  // Uses the cached tab value instead of a per-tick localStorage read
  if (!cachedActiveTab || cachedActiveTab === '0') {
    let tabTitleTaskName = activeTaskName;
    if (tabTitleTaskName.length > TAB_TITLE_TASK_NAME_MAX_LENGTH) {
      tabTitleTaskName = tabTitleTaskName.substring(0, TAB_TITLE_TASK_NAME_MAX_LENGTH) + '...';
    }
    document.title = `${tabTitleTaskName} - ${formattedTime}`;
  }
}

export function updatePhaseText() {
  const currentPhaseEl = document.getElementById('current-phase');
  const nextPhaseEl = document.getElementById('next-phase');
  const breaksToggle = document.getElementById('breaks-toggle');
  const modeSelect = document.getElementById('mode-select');

  if (!currentPhaseEl || !nextPhaseEl) {return;}
  if (modeSelect && modeSelect.value === 'stopwatch') {return;}

  const breaksEnabled = breaksToggle ? breaksToggle.checked : true;

  if (currentPhase === 'work') {
    if (breaksEnabled) {
      currentPhaseEl.innerHTML = `${icons.work} Work ${completedSessions + 1}/4`;
      nextPhaseEl.innerHTML = (completedSessions === 3)
      ? `Next: ${icons.long} Long Break`
      : `Next: ${icons.short} Short Break`;
    } else {
      currentPhaseEl.innerHTML = `${icons.work} Work (Session ${completedSessions + 1})`;
      nextPhaseEl.innerHTML = `Breaks disabled`;
    }
  } else if (currentPhase === 'shortBreak') {
    currentPhaseEl.innerHTML = `${icons.short} Short Break`;
    nextPhaseEl.innerHTML = `Next: ${icons.work} Work ${completedSessions + 1}/4`;
  } else if (currentPhase === 'longBreak') {
    currentPhaseEl.innerHTML = `${icons.long} Long Break`;
    nextPhaseEl.innerHTML = `Next: ${icons.work} Work 1/4`;
  }
}

export function updatePhaseColors() {
  // Clear all phase classes
  document.body.classList.remove('phase-work', 'phase-short', 'phase-long', 'phase-stopwatch');

  const modeSelect = document.getElementById('mode-select');

  if (modeSelect && modeSelect.value === 'stopwatch') {
    document.body.classList.add('phase-stopwatch');
    return;
  }

  if (currentPhase === 'work') {document.body.classList.add('phase-work');}
  else if (currentPhase === 'shortBreak') {document.body.classList.add('phase-short');}
  else if (currentPhase === 'longBreak') {document.body.classList.add('phase-long');}
}

// ==========================================
// CORE TIMER LOGIC
// ==========================================
// Every place that stops the timer needs the same 4 things done together:
// clear the interval, null out timerId, flip isRunning false, and reset
// the Start/Pause button back to "Start". The 6 call sites below (plus a
// further, incomplete copy that used to live in settings.js) each
// repeated this by hand — which is exactly how the isRunning-desync bug
// got introduced there in the first place. One shared function means
// there's only one place this logic can go wrong, not seven.
export function stopTimer() {
  clearInterval(timerId);
  setTimerId(null);
  setIsRunning(false);

  if (startBtn) {
    startBtn.querySelector('.btn-text').textContent = 'Start';
    startBtn.classList.remove('pause');
  }
}

export function resetTimer() {
  stopTimer();

  const modeSelect = document.getElementById('mode-select');

  if (modeSelect && modeSelect.value === 'stopwatch') {
    setTimeLeft(0);
    updateDisplay();
    if (circle) {circle.style.strokeDashoffset = circumference;}
    updatePhaseColors();
  } else {
    setTimeLeft(totalTime);
    updateDisplay();
    updateCircle();
    updatePhaseColors();
  }

  saveTimerState();
}

export function switchPhase() {
  const breaksToggle = document.getElementById('breaks-toggle');
  const workDurationSelect = document.getElementById('work-duration');

  const breaksEnabled = breaksToggle ? breaksToggle.checked : true;
  const workDuration = workDurationSelect ? parseInt(workDurationSelect.value) * 60 : 25 * 60;

  if (currentPhase === 'work') {
    setCompletedSessions(completedSessions + 1);

    if (breaksEnabled) {
      if (completedSessions >= 4) {
        setCurrentPhase('longBreak');
        setTotalTime(15 * 60);
        setCompletedSessions(0);
      } else {
        setCurrentPhase('shortBreak');
        setTotalTime(5 * 60);
      }
    } else {
      setTotalTime(workDuration);
    }
  } else {
    setCurrentPhase('work');
    setTotalTime(workDuration);
  }

  setTimeLeft(totalTime);
  updatePhaseText();
  updatePhaseColors();
  updateDisplay();
  updateCircle();
  saveTimerState();
}

export function toggleTimer() {
  const modeSelect = document.getElementById('mode-select');
  const soundSelect = document.getElementById('sound-select');
  const autostartBreaks = document.getElementById('autostart-breaks-toggle');

  // FIX: used to match on currentTaskNameEl.textContent === 'Nothing',
  // which is fragile DOM-text coupling — if the UI copy is ever changed
  // (localization, a rewording pass), the feature breaks silently.
  // Checking focusedTaskId from state is the real source of truth.
  const requiresWorkTracking = currentPhase === 'work' || modeSelect?.value === 'stopwatch';
  if (requiresWorkTracking && focusedTaskId === null && tasks) {
    const activeTasks = tasks.filter(t => !t.completed);
    if (activeTasks.length === 1) {
      const event = new CustomEvent('autoFocusTask', { detail: { id: activeTasks[0].id } });
      document.dispatchEvent(event);
    } else {
      const currentTaskLabel = document.getElementById('current-task-name');
      if (currentTaskLabel) {currentTaskLabel.textContent = 'No Task';}
    }
  }

  if (isRunning) {
    // Pause timer
    stopTimer();

    // Ticks now only persist every few seconds (see below), so pausing
    // needs its own explicit save — otherwise up to a few seconds of
    // progress could be lost if the page is reloaded right after pausing.
    saveTimerState();
    // Same reasoning as the periodic dispatch inside the tick loop below
    // — pausing is also a natural moment where the Progress tab (if
    // it's the one currently open) should immediately reflect whatever
    // time was just earned, not wait up to 15s for the next periodic one.
    document.dispatchEvent(new Event('dataUpdated'));
  } else {
    // Start timer
    setIsRunning(true);

    if (startBtn) {
      startBtn.querySelector('.btn-text').textContent = 'Pause';
      startBtn.classList.add('pause');
    }

    // Anchor drift-correction to right now, at whatever timeLeft currently is
    // (this covers both a fresh start and a resume-from-pause correctly).
    tickAnchorTime = Date.now();
    tickAnchorTimeLeft = timeLeft;
    tickLastElapsedSeconds = 0;

    const interval = setInterval(() => {
      // Real elapsed time since the anchor, NOT "however many ticks fired" —
      // this is what makes the timer self-correct if a tick fires late
      // (backgrounded tab, slow device, etc.) instead of drifting further
      // behind with every missed/delayed tick.
      const nowElapsedSeconds = Math.floor((Date.now() - tickAnchorTime) / 1000);
      const deltaSeconds = Math.max(0, nowElapsedSeconds - tickLastElapsedSeconds);
      tickLastElapsedSeconds = nowElapsedSeconds;

      // Task time tracking logic
      if (deltaSeconds > 0 && focusedTaskId !== null && tasks) {
        if ((modeSelect && modeSelect.value === 'stopwatch') || currentPhase === 'work') {
          const activeTask = tasks.find(t => t.id === focusedTaskId);
          if (activeTask) {
            activeTask.timeSpent += deltaSeconds;
            // Also record which DAY this time was earned on. Previously only
            // the all-time total existed, and the dashboard attributed 100%
            // of it to the task's createdAt date — so time spent focusing
            // today on a task you created yesterday silently showed up
            // under yesterday instead. timeByDate fixes that going forward
            // (existing totals from before this change stay as-is; there's
            // no way to retroactively know which past day they belong to).
            if (!activeTask.timeByDate) {activeTask.timeByDate = {};}
            const todayKey = getLocalDateKey();
            activeTask.timeByDate[todayKey] = (activeTask.timeByDate[todayKey] || 0) + deltaSeconds;
            saveTasks();
            const badge = document.getElementById(`badge-${activeTask.id}`);
            if (badge) {badge.innerHTML = formatTaskTime(activeTask.timeSpent);}
          }
        }
      } else if (deltaSeconds > 0 && focusedTaskId === null) {
        // Taskless session — see addTasklessFocusTime()'s comment above.
        if ((modeSelect && modeSelect.value === 'stopwatch') || currentPhase === 'work') {
          addTasklessFocusTime(deltaSeconds);
        }
      }

      // Stopwatch or Pomodoro mode checks
      if (modeSelect && modeSelect.value === 'stopwatch') {
        setTimeLeft(tickAnchorTimeLeft + nowElapsedSeconds);
        updateDisplay();

        if (circle) {
          const offset = circumference - ((timeLeft % 60) / 60) * circumference;
          circle.style.strokeDashoffset = offset;
        }
      } else {
        setTimeLeft(Math.max(0, tickAnchorTimeLeft - nowElapsedSeconds));
        updateDisplay();
        updateCircle();

        // Phase completion logic
        if (timeLeft <= 0) {
          stopTimer();

          playAlarm(soundSelect ? soundSelect.value : 'bell');
          switchPhase();

          if (autostartBreaks && autostartBreaks.checked && currentPhase !== 'work') {
            toggleTimer();
          }
        }
      }
      // Every tick used to write to localStorage — once per second while
      // any timer runs, whether or not anything meaningful changed. Since
      // pause/phase-change/tab-hide (below) all save immediately anyway,
      // the tick only needs to save periodically as a safety net for long
      // uninterrupted runs.
      if (nowElapsedSeconds % 5 === 0) {
        saveTimerState();
      }

      // The underlying focus-time data (task.timeByDate / taskless time,
      // above) already updates every single second regardless of which
      // tab is open — but nothing told the Progress tab that, so its
      // heatmap/stats only ever reflected a running session at the
      // moment you switched to it, not while you stayed on it watching
      // one run. dataUpdated is the same event habits.js's own CRUD
      // already dispatches on every change; progress.js's listener for
      // it already no-ops unless the Progress tab is the visible one, so
      // dispatching this periodically (not every single tick — a full
      // heatmap re-render every second would be excessive DOM churn for
      // a once-a-minute-ish color change) costs nothing when it isn't.
      if (nowElapsedSeconds % 15 === 0) {
        document.dispatchEvent(new Event('dataUpdated'));
      }
    }, 1000);

    setTimerId(interval);
  }
}

// ==========================================
// TIMER EVENT LISTENERS
// ==========================================
export function setupTimerEvents() {
  const resetBtn = document.getElementById('reset-btn');
  const skipBtn = document.getElementById('skip-btn');

  // Backgrounding the tab, switching apps, or closing the tab all fire this.
  // Since ticks only save every ~5s now, this is what guarantees a reload
  // right after switching away never loses more than an instant of progress.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && isRunning) {
      saveTimerState();
    }
  });

  if (startBtn) {startBtn.addEventListener('click', toggleTimer);}
  if (resetBtn) {
    let suppressNextClick = false;
    resetBtn.addEventListener('click', () => {
      if (suppressNextClick) { suppressNextClick = false; return; }
      resetTimer();
    });

    // FIX: the full session reset (back to Work 1, session count to 0)
    // previously only fired on dblclick — a gesture with no reliable
    // touch equivalent (double-tap is often intercepted by the browser
    // as a zoom gesture), and invisible on touch since `title` tooltips
    // never show there either. Extracted so dblclick (kept as-is for
    // desktop users) and the new press-and-hold below call the exact
    // same logic instead of two copies drifting apart over time.
    function deepResetTimer() {
      const modeSelect = document.getElementById('mode-select');
      if (modeSelect && modeSelect.value === 'pomodoro') {
        stopTimer();
        setCurrentPhase('work');
        setCompletedSessions(0);
        updatePhaseText();
        updatePhaseColors();

        const workDuration = document.getElementById('work-duration');
        const newTotal = workDuration ? parseInt(workDuration.value) * 60 : 25 * 60;
        setTotalTime(newTotal);
        setTimeLeft(newTotal);

        updateDisplay();
        updateCircle();
        saveTimerState();
        showToast('Full Session Reset! Back to Work 1.', 'info');
      }
    }

    resetBtn.addEventListener('dblclick', deepResetTimer);

    // Press-and-hold: works for both mouse and touch via Pointer Events.
    // The `.holding` class drives a CSS ring animation (pomodoro.css) so
    // the hold is visible, not a silent countdown — that visual feedback
    // is what makes the gesture discoverable in the first place.
    const LONG_PRESS_MS = 600;
    let longPressTimer = null;

    function cancelLongPress() {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      resetBtn.classList.remove('holding');
    }

    resetBtn.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) {return;}
      resetBtn.classList.add('holding');
      longPressTimer = setTimeout(() => {
        cancelLongPress();
        suppressNextClick = true;
        deepResetTimer();
      }, LONG_PRESS_MS);
    });

    resetBtn.addEventListener('pointerup', cancelLongPress);
    resetBtn.addEventListener('pointerleave', cancelLongPress);
    resetBtn.addEventListener('pointercancel', cancelLongPress);
  }

  if (skipBtn) {
    skipBtn.addEventListener('click', function(event) {
      event.preventDefault();
      const modeSelect = document.getElementById('mode-select');
      if (modeSelect && modeSelect.value === 'pomodoro') {
        stopTimer();
        switchPhase();
      }
    });
  }

  // Listen for auto-pause triggers from the Tasks module
  document.addEventListener('checkAutoPauseTimer', () => {
    if (focusedTaskId === null && isRunning) {
      stopTimer();
    }
    updateDisplay();
  });

  document.addEventListener('tabChanged', () => {
    cachedActiveTab = readRaw(STORAGE_KEYS.ACTIVE_TAB, '0');
    if (!cachedActiveTab || cachedActiveTab === '0') {updateDisplay();}
  });
}
