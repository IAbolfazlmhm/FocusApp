import { 
  timeLeft, totalTime, timerId, isRunning, currentPhase, completedSessions,
  setTimeLeft, setTotalTime, setTimerId, setIsRunning, setCurrentPhase, setCompletedSessions,
  tasks, focusedTaskId 
} from './state.js';

import { playAlarm } from './audio.js';
import { showToast, icons } from './ui-utils.js';

// Note: These will be exported from tasks.js in the next steps. 
// We import them here to maintain modularity.
import { saveTasks, formatTaskTime } from './tasks.js';

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

// Same YYYY-MM-DD local-date format progress.js's getLocalDateStr() uses,
// duplicated here rather than imported to avoid a circular import between
// timer.js and progress.js. Used to record WHICH day focus time was
// actually earned on, instead of only a single all-time total.
function localDateKey(dateObj = new Date()) {
  const d = new Date(dateObj);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
  localStorage.setItem('focusTimerState', JSON.stringify(state));
}

export function loadTimerState() {
  const saved = localStorage.getItem('focusTimerState');
  if (!saved) return false;

  let state;
  try {
    state = JSON.parse(saved);
  } catch (err) {
    console.warn('Corrupted focusTimerState in localStorage, discarding.', err);
    localStorage.removeItem('focusTimerState');
    return false;
  }
  const FOUR_HOURS = 4 * 60 * 60 * 1000; 

  // Invalidate state if it's older than 4 hours
  if (Date.now() - state.lastSaved > FOUR_HOURS) { 
    localStorage.removeItem('focusTimerState'); 
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
  if (!circle) return;
  const offset = circumference - (timeLeft / totalTime) * circumference;
  circle.style.strokeDashoffset = offset;
}

export function updateDisplay() {
  if (!timeDisplay) return;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  timeDisplay.textContent = formattedTime;
  
  let activeTaskName = 'Focus App';
  if (focusedTaskId !== null && tasks) {
    const activeTask = tasks.find(t => t.id === focusedTaskId);
    if (activeTask) activeTaskName = activeTask.text;
  }
  
  const activeTab = localStorage.getItem('focusActiveTab');
  if (!activeTab || activeTab === '0') {
    let activeTaskName = 'Focus App';
    // Assuming tasks array is imported or available globally
    if (typeof focusedTaskId !== 'undefined' && focusedTaskId !== null && typeof tasks !== 'undefined') {
      const activeTask = tasks.find(t => t.id === focusedTaskId);
      if (activeTask) {
        activeTaskName = activeTask.text;
        // BUG FIX: Truncate long task names in the browser tab!
        if (activeTaskName.length > 10) {
          activeTaskName = activeTaskName.substring(0, 10) + '...';
        }
      }
    }
    document.title = `${activeTaskName} - ${formattedTime}`;
  }
}

export function updatePhaseText() {
  const currentPhaseEl = document.getElementById('current-phase');
  const nextPhaseEl = document.getElementById('next-phase');
  const breaksToggle = document.getElementById('breaks-toggle');
  const modeSelect = document.getElementById('mode-select');

  if (!currentPhaseEl || !nextPhaseEl) return;
  if (modeSelect && modeSelect.value === 'stopwatch') return;

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
  
  if (currentPhase === 'work') document.body.classList.add('phase-work');
  else if (currentPhase === 'shortBreak') document.body.classList.add('phase-short');
  else if (currentPhase === 'longBreak') document.body.classList.add('phase-long');
}

// ==========================================
// CORE TIMER LOGIC
// ==========================================
export function resetTimer() {
  clearInterval(timerId); 
  setTimerId(null);
  setIsRunning(false); 
  
  if (startBtn) {
    startBtn.querySelector('.btn-text').textContent = 'Start';
    startBtn.classList.remove('pause');
  }
  
  const modeSelect = document.getElementById('mode-select');
  
  if (modeSelect && modeSelect.value === 'stopwatch') {
    setTimeLeft(0);
    updateDisplay();
    if (circle) circle.style.strokeDashoffset = circumference; 
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
  const currentTaskNameEl = document.getElementById('current-task-name');
  const modeSelect = document.getElementById('mode-select');
  const soundSelect = document.getElementById('sound-select');
  const autostartBreaks = document.getElementById('autostart-breaks-toggle');
  
  const currentTaskName = currentTaskNameEl ? currentTaskNameEl.textContent : '';

  // Auto-focus logic
  if (currentTaskName === 'Nothing' && tasks) {
    const activeTasks = tasks.filter(t => !t.completed);
    if (activeTasks.length === 1) {
      // Logic for toggling focus will be fully implemented in tasks.js
      const event = new CustomEvent('autoFocusTask', { detail: { id: activeTasks[0].id } });
      document.dispatchEvent(event);
    } else { 
      showToast('🎯 Please focus on a task first before starting the timer!', 'warning'); 
      return; 
    }
  }

  if (isRunning) {
    // Pause timer
    clearInterval(timerId); 
    setTimerId(null);
    setIsRunning(false);
    
    if (startBtn) {
      startBtn.querySelector('.btn-text').textContent = 'Start';
      startBtn.classList.remove('pause');
    }
    
    // Ticks now only persist every few seconds (see below), so pausing
    // needs its own explicit save — otherwise up to a few seconds of
    // progress could be lost if the page is reloaded right after pausing.
    saveTimerState();
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
            if (!activeTask.timeByDate) activeTask.timeByDate = {};
            const todayKey = localDateKey();
            activeTask.timeByDate[todayKey] = (activeTask.timeByDate[todayKey] || 0) + deltaSeconds;
            saveTasks(); 
            const badge = document.getElementById(`badge-${activeTask.id}`);
            if (badge) badge.innerHTML = formatTaskTime(activeTask.timeSpent);
          }
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
          clearInterval(timerId); 
          setTimerId(null);
          setIsRunning(false);
          
          if (startBtn) {
            startBtn.querySelector('.btn-text').textContent = 'Start';
            startBtn.classList.remove('pause');
          }
          
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
    }, 1000);
    
    setTimerId(interval);
  }
}

// ==========================================
// TIMER EVENT LISTENERS
// ==========================================
export function setupTimerEvents() {
  const startBtn = document.getElementById('start-btn');
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

  if (startBtn) startBtn.addEventListener('click', toggleTimer);
  if (resetBtn) {
    resetBtn.addEventListener('click', resetTimer);
    resetBtn.addEventListener('dblclick', function() {
      const modeSelect = document.getElementById('mode-select');
      if (modeSelect && modeSelect.value === 'pomodoro') {
        clearInterval(timerId);
        setIsRunning(false);
        setTimerId(null);
        startBtn.querySelector('.btn-text').textContent = 'Start';
        startBtn.classList.remove('pause');
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
    });
  }

  if (skipBtn) {
    skipBtn.addEventListener('click', function(event) {
      event.preventDefault(); 
      const modeSelect = document.getElementById('mode-select');
      if (modeSelect && modeSelect.value === 'pomodoro') {
        clearInterval(timerId); 
        setIsRunning(false);
        setTimerId(null);
        if (startBtn) {
          startBtn.querySelector('.btn-text').textContent = 'Start';
          startBtn.classList.remove('pause');
        }
        switchPhase(); 
      }
    });
  }

  // Listen for auto-pause triggers from the Tasks module
  document.addEventListener('checkAutoPauseTimer', () => {
    if (focusedTaskId === null && isRunning) {
      clearInterval(timerId); 
      setIsRunning(false);
      setTimerId(null);
      if (startBtn) {
        startBtn.querySelector('.btn-text').textContent = 'Start';
        startBtn.classList.remove('pause');
      }
    }
    updateDisplay();
  });

  document.addEventListener('tabChanged', () => {
        const activeTab = localStorage.getItem('focusActiveTab');
        if (!activeTab || activeTab === '0') updateDisplay();
    });
}