import { 
  timerId, isRunning, 
  setTimeLeft, setTotalTime, setCurrentPhase, setCompletedSessions 
} from './state.js';

import { 
  updateDisplay, updateCircle, updatePhaseText, updatePhaseColors, saveTimerState 
} from './timer.js';

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
    // We import timerId and isRunning as read-only from state, 
    // so we assume timer.js handles the actual pause logic, 
    // but here we just force clear it locally for settings application.
    clearInterval(timerId); 
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
  const savedSettings = localStorage.getItem('focusSettings');
  if (savedSettings) {
    let settings;
    try {
      settings = JSON.parse(savedSettings);
    } catch (err) {
      console.warn('Corrupted focusSettings in localStorage, ignoring and using defaults.', err);
      return;
    }
    
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
  localStorage.setItem('focusSettings', JSON.stringify(settings));
}

export function setupSettingsEvents() {
    const settingsBtn = document.querySelector('.settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings');
    const saveSettingsBtn = document.getElementById('save-settings');

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
          saveSettings(); 
          applySettingsToTimer();
          
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