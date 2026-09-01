import {
  setTimeLeft, setTotalTime, setCurrentPhase, setCompletedSessions
} from '../../core/state.js';

import {
  updateDisplay, updateCircle, updatePhaseText, updatePhaseColors, saveTimerState, stopTimer
} from '../timer/timer.js';

import { showToast } from '../../shared/toast/toast.js';
import { setupSelectDropdown } from '../../shared/dropdown/dropdown.js';
import { customConfirm } from '../../shared/modal/modal-utils.js';
import { readJSON, writeJSON, STORAGE_KEYS } from '../../core/storage.js';
import { setupStepperButtons, readNumericValue, setDisplayValue } from '../../shared/stepper/stepper-utils.js';
import { openTrashModal } from '../trash/trash-ui.js';
import { getLocale, setLocale, t } from '../../core/i18n.js';
import { getProgressViewToggles, setProgressViewToggles } from '../progress/progress.js';

// ==========================================
// DOM ELEMENTS
// ==========================================
const settingsModal = document.getElementById('settings-modal');
const modeSelect = document.getElementById('mode-select');
const languageSelect = document.getElementById('language-select');
const pomodoroWrapper = document.getElementById('pomodoro-settings-wrapper');
const circle = document.querySelector('.progress-ring-circle');

// All toggle switch IDs for aria-checked sync
const TOGGLE_IDS = [
  'dark-mode-toggle', 'sound-toggle', 'breaks-toggle', 'autostart-breaks-toggle',
  // FIX (full merge): 'prog-dark-mode'/'prog-sound-toggle' no longer exist —
  // those were proxy elements in the old separate progress-settings-modal,
  // removed now that Progress's gear button opens this shared modal
  // directly instead. The three dashboard toggles below live here now.
  'prog-toggle-focus', 'prog-toggle-habits', 'prog-toggle-compare'
];

// Helper to sync aria-checked with checkbox state
function syncAriaChecked(id) {
  const toggle = document.getElementById(id);
  if (toggle) {
    toggle.setAttribute('aria-checked', toggle.checked.toString());
  }
}

// Sync all toggles
function syncAllToggles() {
  TOGGLE_IDS.forEach(syncAriaChecked);
}

// ==========================================
// SETTINGS LOGIC
// ==========================================
export const DEFAULT_SETTINGS = {
  language: 'en',
  mode: 'pomodoro',
  workDuration: 25,
  breaksEnabled: true,
  autoStart: false,
  sound: 'bell',
  darkMode: false,
  haptics: true
};

export function applySettingsToTimer() {
  const selectedMode = modeSelect ? modeSelect.value : 'pomodoro';
  const workDurationInput = document.getElementById('work-duration');
  const selectedDuration = workDurationInput ? readNumericValue(workDurationInput) : 25;

  // Stops any in-progress interval and resets the Start/Pause button, via
  // the same shared helper every stop-path in timer.js now uses — this is
  // what used to be a separate, incomplete local copy of this logic (see
  // git history / the report this was flagged in), which is exactly how
  // the isRunning-desync bug happened in the first place. stopTimer() is
  // safe to call even when nothing is running (clearing a null interval
  // and re-setting "Start" text are both harmless no-ops in that case),
  // so no isRunning check is needed here anymore.
  stopTimer();

  const tracker = document.getElementById('session-tracker');
  const skipBtn = document.getElementById('skip-btn');

  if (selectedMode === 'stopwatch') {
    if (tracker) {tracker.classList.add('hidden');}

    if (skipBtn) {
      skipBtn.style.opacity = '0.3';
      skipBtn.style.pointerEvents = 'none';
      skipBtn.style.visibility = 'visible';
    }

    setTimeLeft(0);
    updateDisplay();

    if (circle) {
      const radius = circle.r.baseVal.value;
      circle.style.strokeDashoffset = radius * 2 * Math.PI;
    }
    updatePhaseColors();
  } else {
    if (tracker) {tracker.classList.remove('hidden');}

    if (skipBtn) {
      skipBtn.style.opacity = '1';
      skipBtn.style.pointerEvents = 'auto';
      skipBtn.style.visibility = 'visible';
    }

    const parsedDur = Number.isNaN(selectedDuration) ? 25 : selectedDuration;
    const newTotal = parsedDur * 60;
    setTotalTime(newTotal);
    setTimeLeft(newTotal);
    setCurrentPhase('work');
    setCompletedSessions(0);

    updatePhaseText();
    updatePhaseColors();
    updateDisplay();
    updateCircle();
  }
  saveTimerState();
}

export function loadSettings() {
  const stored = readJSON(STORAGE_KEYS.SETTINGS, null);
  const settings = stored ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS;

  // Helper to visually update the custom display text
  const syncDisplay = (inputId, displayId, dropdownId) => {
    const input = document.getElementById(inputId);
    const display = document.getElementById(displayId);
    const dropdown = document.getElementById(dropdownId);
    if (input && display && dropdown) {
      const activeItem = dropdown.querySelector(`.dropdown-item[data-val="${input.value}"]`);
      if (activeItem) {display.value = activeItem.textContent;}
    }
  };

  if (languageSelect) {
    languageSelect.value = settings.language || getLocale();
    syncDisplay('language-select', 'language-display', 'language-dropdown');
  }

  if (modeSelect) {
    modeSelect.value = settings.mode || 'pomodoro';
    syncDisplay('mode-select', 'mode-display', 'mode-dropdown');
  }

  const workDur = document.getElementById('work-duration');
  if (workDur) {
    const parsed = parseInt(settings.workDuration, 10);
    setDisplayValue(workDur, Number.isNaN(parsed) ? 25 : Math.min(180, Math.max(1, parsed)));
  }

  const soundSelect = document.getElementById('sound-select');
  if (soundSelect) {
    soundSelect.value = settings.sound || 'bell';
    syncDisplay('sound-select', 'sound-display', 'sound-dropdown');
  }

  const breaksToggle = document.getElementById('breaks-toggle');
  if (breaksToggle) {breaksToggle.checked = settings.breaksEnabled !== false;}

  const autoStartToggle = document.getElementById('autostart-breaks-toggle');
  if (autoStartToggle) {autoStartToggle.checked = settings.autoStart === true;}

  const soundToggle = document.getElementById('sound-toggle');
  if (soundToggle) {soundToggle.checked = settings.haptics !== false;}

  const darkModeToggle = document.getElementById('dark-mode-toggle');
  if (darkModeToggle) {
    if (settings.darkMode) {
      darkModeToggle.checked = true;
      document.body.setAttribute('data-theme', 'dark');
    } else {
      darkModeToggle.checked = false;
      document.body.removeAttribute('data-theme');
    }
  }

  if (pomodoroWrapper) {
    if (settings.mode === 'stopwatch') {pomodoroWrapper.classList.add('disabled-settings');}
    else {pomodoroWrapper.classList.remove('disabled-settings');}
  }

  // FIX (full merge): these three used to only be initialized inside
  // progress.js's own prog-settings-btn click handler, so they'd show
  // stale/default state if this shared modal was opened from a different
  // path. Now that they live in this modal, loadSettings() is the one
  // place — same as every other control here — that (re)reads them.
  const togFocus = document.getElementById('prog-toggle-focus');
  const togHabits = document.getElementById('prog-toggle-habits');
  const togCompare = document.getElementById('prog-toggle-compare');
  const { showPomodoro, showHabits, compareMode } = getProgressViewToggles();
  if (togFocus) {togFocus.checked = showPomodoro;}
  if (togHabits) {togHabits.checked = showHabits;}
  if (togCompare) {togCompare.checked = compareMode;}

  syncAllToggles();
}

export function saveSettings() {
  const currentLang = languageSelect ? languageSelect.value : getLocale();
  const workDurationInput = document.getElementById('work-duration');
  // FIX: this used to read .value directly — a plain string that, since
  // work-duration switched from type="number" to type="text" to support
  // displaying Persian digits, can now legitimately contain Persian
  // glyphs (e.g. "۲۵"). Storing that raw would corrupt the setting for
  // any consumer expecting a plain number; readNumericValue() (from
  // stepper-utils.js, the same helper the stepper itself uses) parses
  // either script back to a real number.
  const workDuration = workDurationInput ? readNumericValue(workDurationInput) : 25;
  const settings = {
    language: currentLang,
    mode: modeSelect ? modeSelect.value : 'pomodoro',
    workDuration: Number.isNaN(workDuration) ? 25 : workDuration,
    breaksEnabled: document.getElementById('breaks-toggle') ? document.getElementById('breaks-toggle').checked : true,
    autoStart: document.getElementById('autostart-breaks-toggle') ? document.getElementById('autostart-breaks-toggle').checked : false,
    sound: document.getElementById('sound-select') ? document.getElementById('sound-select').value : 'bell',
    darkMode: document.getElementById('dark-mode-toggle') ? document.getElementById('dark-mode-toggle').checked : false,
    haptics: document.getElementById('sound-toggle') ? document.getElementById('sound-toggle').checked : true
  };
  writeJSON(STORAGE_KEYS.SETTINGS, settings);

  // FIX (full merge): persist the three dashboard toggles alongside
  // everything else this one Save & Apply button now covers, via the
  // same bridge loadSettings() reads them through.
  const togFocus = document.getElementById('prog-toggle-focus');
  const togHabits = document.getElementById('prog-toggle-habits');
  const togCompare = document.getElementById('prog-toggle-compare');
  if (togFocus && togHabits && togCompare) {
    setProgressViewToggles({
      showPomodoro: togFocus.checked,
      showHabits: togHabits.checked,
      compareMode: togCompare.checked
    });
  }

  if (currentLang !== getLocale()) {
    setLocale(currentLang, true);
    document.dispatchEvent(new Event('languageChanged'));
  }
}

export function setupSettingsEvents() {
  const settingsBtn = document.querySelector('.settings-btn');
  const closeSettingsBtn = document.getElementById('close-settings');
  const saveSettingsBtn = document.getElementById('save-settings');

  // --- EXPORT / IMPORT DATA ---
  // Everything lives only in this browser's localStorage, which can be
  // wiped by clearing site data, private browsing, or a browser reset.
  // This lets someone save a real file they control, and restore it later
  // (even in a different browser/computer).
  const DATA_KEYS = [
    'focusTasks', 'focusedTaskId', 'focusTagsList', 'focusTagColors',
    'focusHabits', 'focusHabitCategories', 'focusCategoryColors',
    'focusSettings', 'focusTimerState', 'focusTasklessTime',
    'focusUserQuotes', 'focusBuiltInQuoteOverrides', 'focusTrash',
    'focusProgressViewPrefs', 'focusTaskViewPrefs', 'focusHabitViewPrefs'
  ];

  const exportDataBtn = document.getElementById('export-data-btn');
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', () => {
      const data = {};
      DATA_KEYS.forEach(key => {
        // readJSON already returns the `undefined` fallback for a
        // missing key, so there's no need for a separate direct
        // localStorage.getItem() check first — this keeps every
        // storage read in the app routed through storage.js.
        const value = readJSON(key, undefined);
        if (value !== undefined) {data[key] = value;}
      });

      const exportBundle = {
        _focusAppExport: true,
        exportedAt: new Date().toISOString(),
        data
      };

      const blob = new Blob([JSON.stringify(exportBundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `focusapp-backup-${dateStamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      showToast(t('backup_downloaded_toast'), 'success');
    });
  }

  const importDataBtn = document.getElementById('import-data-btn');
  const importDataInput = document.getElementById('import-data-input');
  if (importDataBtn && importDataInput) {
    importDataBtn.addEventListener('click', () => importDataInput.click());

    importDataInput.addEventListener('change', () => {
      const file = importDataInput.files && importDataInput.files[0];
      if (!file) {return;}

      const reader = new FileReader();
      reader.onload = () => {
        let parsed;
        try {
          parsed = JSON.parse(reader.result);
        } catch {
          showToast(t('invalid_json_toast'), 'warning');
          return;
        }

        const payload = parsed && parsed._focusAppExport ? parsed.data : parsed;
        if (!payload || typeof payload !== 'object') {
          showToast(t('invalid_backup_toast'), 'warning');
          return;
        }

        // FIX: this used to call the browser's native confirm() —
        // a jarring, unstyled dialog in an app that otherwise has
        // its own themed confirm modal (customConfirm, already
        // used everywhere else for deletions). Swapped in here so
        // import behaves consistently with the rest of the app.
        // FIX: the message itself was still a hardcoded English string —
        // never localized even though a matching replace_data_confirm
        // key already existed in both locale files, unused.
        customConfirm(
          t('replace_data_confirm'),
          () => {
            let importedCount = 0;
            DATA_KEYS.forEach(key => {
              if (Object.prototype.hasOwnProperty.call(payload, key)) {
                writeJSON(key, payload[key]);
                importedCount++;
              }
            });

            if (importedCount === 0) {
              showToast(t('no_recognizable_data_toast'), 'warning');
              return;
            }

            showToast(t('data_imported_toast'), 'success');
            // A reload is the simplest reliable way to get every module
            // (tasks, habits, timer, progress) to pick up the newly
            // written localStorage instead of trying to patch each
            // module's already-initialized in-memory state live.
            setTimeout(() => location.reload(), 800);
          }
        );
      };
      reader.readAsText(file);
    });
  }

  // Catch event from other tabs to reload settings securely
  document.addEventListener('reloadSettingsUI', () => {
    loadSettings();
  });

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      // BUG FIX: Reset visually to the true saved state in case of unsaved clicks
      loadSettings();
      // FIX: the Progress Dashboard toggles (Show Pomodoro/Habits/Compare)
      // only make sense when this modal was opened from Progress's own
      // gear button — showing them here (or from Habits) was a mistake.
      // 'progress-context' controls a CSS-only show/hide (see
      // .progress-dashboard-section in modal.css) so opening from
      // Pomodoro or Habits looks exactly like it did before that section
      // existed, while Progress still gets the fuller modal.
      if (settingsModal) {settingsModal.classList.remove('progress-context'); settingsModal.classList.add('show');}
    });
  }

  if (closeSettingsBtn) {closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('show'));}

  if (settingsModal) {
    settingsModal.addEventListener('click', (event) => {
      if (event.target === settingsModal) {settingsModal.classList.remove('show');}
    });
  }

  if (modeSelect) {
    modeSelect.addEventListener('change', () => {
      if (modeSelect.value === 'stopwatch') {pomodoroWrapper.classList.add('disabled-settings');}
      else {pomodoroWrapper.classList.remove('disabled-settings');}
    });
  }

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      // Read what was saved BEFORE this save, so we can tell whether
      // anything that actually affects a running timer (mode/duration)
      // changed. Previously, applySettingsToTimer() ran unconditionally
      // here, which meant toggling something unrelated like dark mode
      // or the notification sound would wipe an in-progress session
      // (reset time left, phase, and completed session count to zero).
      const previous = readJSON(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);

      saveSettings();

      const newMode = modeSelect ? modeSelect.value : 'pomodoro';
      // FIX: reading .value directly here compared it as a string against
      // previous.workDuration (a number) — harmless while both were always
      // Latin digits, but once work-duration could display Persian glyphs
      // this comparison would never match in fa locale (String(25) !==
      // String("۲۵")) even when nothing actually changed, incorrectly
      // triggering applySettingsToTimer() — which resets the in-progress
      // session — on every single settings save while in fa.
      const workDurationEl = document.getElementById('work-duration');
      const newDuration = workDurationEl ? readNumericValue(workDurationEl) : 25;
      const timerRelevantSettingsChanged = previous.mode !== newMode
      || Number(previous.workDuration) !== newDuration;

      if (timerRelevantSettingsChanged) {
        applySettingsToTimer();
      }

      const darkModeToggle = document.getElementById('dark-mode-toggle');
      if (darkModeToggle && darkModeToggle.checked) {document.body.setAttribute('data-theme','dark');}
      else {document.body.removeAttribute('data-theme');}

      syncAllToggles();

      settingsModal.classList.remove('show');
    });
  }

  // --- CUSTOM DROPDOWN ENGINE ---
  // Selection assignment (what happens when an option is picked) stays
  // here, since it's specific to this call site. Opening, closing,
  // keyboard navigation, and ARIA now live in the shared
  // setupSelectDropdown() (dropdown.js) so all 4 "select-replacement"
  // dropdowns in the app get identical, keyboard-accessible behavior
  // from one implementation instead of four.
  function setupCustomDropdown(wrapperId, displayId, inputId, dropdownId) {
    const display = document.getElementById(displayId);
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);

    if (!display || !input || !dropdown) {return;}

    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        display.value = item.textContent;
        input.value = item.getAttribute('data-val');
        dropdown.classList.remove('show');

        // Trigger a generic change event so other functions update
        const event = new Event('change');
        input.dispatchEvent(event);
      });
    });

    setupSelectDropdown({ wrapperId, triggerId: displayId, dropdownId, valueInputId: inputId });
  }

  setupCustomDropdown('language-wrapper', 'language-display', 'language-select', 'language-dropdown');
  setupCustomDropdown('mode-wrapper', 'mode-display', 'mode-select', 'mode-dropdown');
  setupCustomDropdown('sound-wrapper', 'sound-display', 'sound-select', 'sound-dropdown');

  // Work Duration is now a −/value/+ stepper instead of a fixed-preset
  // dropdown, so it doesn't need setupCustomDropdown — just the shared
  // stepper helper (also used by the habit modal's Custom Interval).
  setupStepperButtons('duration-minus', 'duration-plus', 'work-duration', 1, 180);

  const openTrashBtn = document.getElementById('open-trash-btn');
  if (openTrashBtn) {
    openTrashBtn.addEventListener('click', () => {
      settingsModal.classList.remove('show');
      openTrashModal();
    });
  }
}
