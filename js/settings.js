import { 
  timerId, isRunning, 
  setTimeLeft, setTotalTime, setCurrentPhase, setCompletedSessions,
  setIsRunning, setTimerId
} from './state.js';

import { 
  updateDisplay, updateCircle, updatePhaseText, updatePhaseColors, saveTimerState 
} from './timer.js';

import { showToast } from './ui-utils.js';
import { readJSON, writeJSON, readRaw } from './storage.js';
import { customConfirm } from './tasks.js';

// ==========================================
// DOM ELEMENTS
// ==========================================
const settingsModal = document.getElementById('settings-modal');
const modeSelect = document.getElementById('mode-select');
const pomodoroWrapper = document.getElementById('pomodoro-settings-wrapper');
const startBtn = document.getElementById('start-btn');
const circle = document.querySelector('.progress-ring-circle');

// ==========================================
// SETTINGS LOGIC
// ==========================================
export function applySettingsToTimer() {
  const selectedMode = modeSelect ? modeSelect.value : 'pomodoro';
  const workDurationInput = document.getElementById('work-duration');
  const selectedDuration = workDurationInput ? workDurationInput.value : 25;
  
  if (isRunning) {
    // FIX: this used to clearInterval() directly without ever updating
    // isRunning/timerId in state.js — the interval really stopped and the
    // button visibly reset to "Start", but isRunning stayed stuck at true.
    // toggleTimer()'s next call checks `if (isRunning)` first, saw the
    // stale true, and took the PAUSE branch instead of START, so the first
    // Start click after saving mid-session settings was a silent no-op.
    // Calling the real setters here keeps state.js truthful, so the next
    // Start click actually starts the timer.
    clearInterval(timerId); 
    setTimerId(null);
    setIsRunning(false);
  }
  
  if (startBtn) {
    const btnText = startBtn.querySelector('.btn-text');
    if (btnText) btnText.textContent = 'Start';
    startBtn.classList.remove('pause');
  }
  
  const tracker = document.getElementById('session-tracker');
  const skipBtn = document.getElementById('skip-btn');

  if (selectedMode === 'stopwatch') {
    if (tracker) tracker.classList.add('hidden'); 
    
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
    if (tracker) tracker.classList.remove('hidden'); 
    
    if (skipBtn) {
        skipBtn.style.opacity = '1';
        skipBtn.style.pointerEvents = 'auto';
        skipBtn.style.visibility = 'visible';
    }
    
    const newTotal = parseInt(selectedDuration) * 60;
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
  const settings = readJSON('focusSettings', null);
  if (settings) {
    // Helper to visually update the custom display text
    const syncDisplay = (inputId, displayId, dropdownId) => {
        const input = document.getElementById(inputId);
        const display = document.getElementById(displayId);
        const dropdown = document.getElementById(dropdownId);
        if (input && display && dropdown) {
            const activeItem = dropdown.querySelector(`.dropdown-item[data-val="${input.value}"]`);
            if (activeItem) display.value = activeItem.textContent;
        }
    };

    if (modeSelect) { 
        modeSelect.value = settings.mode; 
        syncDisplay('mode-select', 'mode-display', 'mode-dropdown'); 
    }
    
    const workDur = document.getElementById('work-duration');
    if (workDur) { 
        workDur.value = settings.workDuration; 
        syncDisplay('work-duration', 'duration-display', 'duration-dropdown'); 
    }
    
    const soundSelect = document.getElementById('sound-select');
    if (soundSelect) { 
        soundSelect.value = settings.sound; 
        syncDisplay('sound-select', 'sound-display', 'sound-dropdown'); 
    }
    
    const breaksToggle = document.getElementById('breaks-toggle');
    if (breaksToggle) breaksToggle.checked = settings.breaksEnabled;
    
    const autoStartToggle = document.getElementById('autostart-breaks-toggle');
    if (autoStartToggle) autoStartToggle.checked = settings.autoStart;
    
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) soundToggle.checked = settings.haptics;
    
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
        if (settings.mode === 'stopwatch') pomodoroWrapper.classList.add('disabled-settings');
        else pomodoroWrapper.classList.remove('disabled-settings');
    }
  }
}

export function saveSettings() {
  const settings = {
    mode: modeSelect ? modeSelect.value : 'pomodoro', 
    workDuration: document.getElementById('work-duration') ? document.getElementById('work-duration').value : 25,
    breaksEnabled: document.getElementById('breaks-toggle') ? document.getElementById('breaks-toggle').checked : true, 
    autoStart: document.getElementById('autostart-breaks-toggle') ? document.getElementById('autostart-breaks-toggle').checked : false,
    sound: document.getElementById('sound-select') ? document.getElementById('sound-select').value : 'bell', 
    darkMode: document.getElementById('dark-mode-toggle') ? document.getElementById('dark-mode-toggle').checked : false,
    haptics: document.getElementById('sound-toggle') ? document.getElementById('sound-toggle').checked : true
  };
  writeJSON('focusSettings', settings);
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
        'focusTasks', 'focusedTaskId', 'focusTagsList',
        'focusHabits', 'focusHabitCategories',
        'focusSettings', 'focusTimerState'
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
                if (value !== undefined) data[key] = value;
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

            showToast('Backup file downloaded.', 'success');
        });
    }

    const importDataBtn = document.getElementById('import-data-btn');
    const importDataInput = document.getElementById('import-data-input');
    if (importDataBtn && importDataInput) {
        importDataBtn.addEventListener('click', () => importDataInput.click());

        importDataInput.addEventListener('change', () => {
            const file = importDataInput.files && importDataInput.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => {
                let parsed;
                try {
                    parsed = JSON.parse(reader.result);
                } catch (err) {
                    showToast('That file is not valid JSON.', 'warning');
                    return;
                }

                const payload = parsed && parsed._focusAppExport ? parsed.data : parsed;
                if (!payload || typeof payload !== 'object') {
                    showToast('That file doesn\'t look like a FocusApp backup.', 'warning');
                    return;
                }

                // FIX: this used to call the browser's native confirm() —
                // a jarring, unstyled dialog in an app that otherwise has
                // its own themed confirm modal (customConfirm, already
                // used everywhere else for deletions). Swapped in here so
                // import behaves consistently with the rest of the app.
                customConfirm(
                    'This will REPLACE your current tasks, habits, and settings with the contents of this file. This cannot be undone. Continue?',
                    () => {
                        let importedCount = 0;
                        DATA_KEYS.forEach(key => {
                            if (Object.prototype.hasOwnProperty.call(payload, key)) {
                                writeJSON(key, payload[key]);
                                importedCount++;
                            }
                        });

                        if (importedCount === 0) {
                            showToast('No recognizable data found in that file.', 'warning');
                            return;
                        }

                        showToast('Data imported — reloading...', 'success');
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
        if (typeof loadSettings === 'function') loadSettings();
    });

    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        // BUG FIX: Reset visually to the true saved state in case of unsaved clicks
        if (typeof loadSettings === 'function') loadSettings();
        if (settingsModal) settingsModal.classList.add('show');
      });
    }
    
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('show'));
    
    if (settingsModal) {
        settingsModal.addEventListener('click', (event) => { 
            if (event.target === settingsModal) settingsModal.classList.remove('show'); 
        });
    }

    if (modeSelect) {
        modeSelect.addEventListener('change', () => { 
            if (modeSelect.value === 'stopwatch') pomodoroWrapper.classList.add('disabled-settings'); 
            else pomodoroWrapper.classList.remove('disabled-settings'); 
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
          const previous = readJSON('focusSettings', null);

          saveSettings(); 

          const newMode = modeSelect ? modeSelect.value : 'pomodoro';
          const newDuration = document.getElementById('work-duration') ? document.getElementById('work-duration').value : 25;
          const timerRelevantSettingsChanged = !previous
            || previous.mode !== newMode
            || String(previous.workDuration) !== String(newDuration);

          if (timerRelevantSettingsChanged) {
            applySettingsToTimer();
          }
          
          const darkModeToggle = document.getElementById('dark-mode-toggle');
          if (darkModeToggle && darkModeToggle.checked) document.body.setAttribute('data-theme','dark');
          else document.body.removeAttribute('data-theme');
          
          settingsModal.classList.remove('show'); 
        });
    }

    // --- CUSTOM DROPDOWN ENGINE ---
    function setupCustomDropdown(wrapperId, displayId, inputId, dropdownId) {
        const wrapper = document.getElementById(wrapperId);
        const display = document.getElementById(displayId);
        const input = document.getElementById(inputId);
        const dropdown = document.getElementById(dropdownId);

        if (!wrapper || !display || !dropdown) return;

        display.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });

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

        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) dropdown.classList.remove('show');
        });
    }

    setupCustomDropdown('mode-wrapper', 'mode-display', 'mode-select', 'mode-dropdown');
    setupCustomDropdown('duration-wrapper', 'duration-display', 'work-duration', 'duration-dropdown');
    setupCustomDropdown('sound-wrapper', 'sound-display', 'sound-select', 'sound-dropdown');
}