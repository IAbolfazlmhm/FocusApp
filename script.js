// ==========================================
// 1. INITIAL VARIABLES (APP STATE)
// ==========================================
let totalTime = 25 * 60; 
let timeLeft = totalTime; 
let timerId = null; 
let isRunning = false;
let currentPhase = 'work'; // 'work', 'shortBreak', 'longBreak'
let completedSessions = 0; 

// تابع نمایش نوتیفیکیشن (جایگزین Alert)
// تابع نمایش نوتیفیکیشن (نسخه شیشه‌ای و محدود)
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  
  // 🌟 فیکس رگباری: چک کن اگر پیامی با همین متن وجود داره، دیگه نساز!
  const existingToasts = container.querySelectorAll('.toast');
  for (let t of existingToasts) {
    if (t.innerText.includes(message)) return; // اگر پیام تکراری بود، تابع رو متوقف کن
  }

  // محدودیت تعداد پیام‌ها: اگر بیشتر از 3 تا بود، قدیمی‌ترین رو پاک کن
  if (container.childElementCount >= 3) {
    const oldest = container.firstChild;
    oldest.style.animation = 'toastOut 0.2s forwards';
    setTimeout(() => oldest.remove(), 200);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  // آیکون فقط برای موفقیت و خطا (برای اینفو حذف شد)
  let icon = '';
  if (type === 'success') icon = '<span style="color:#10b981">✔</span>'; // تیک سبز
  if (type === 'warning') icon = '<span style="color:#f59e0b">⚠️</span>'; // خطر زرد
  // برای info آیکونی نمی‌ذاریم تا ساده باشه

  // اگر آیکون داشت نشون بده، اگر نه فقط متن
  toast.innerHTML = icon ? `${icon} <span>${message}</span>` : `<span>${message}</span>`;
  
  container.appendChild(toast);

  // صدای ملایم فقط برای ارور و موفقیت (برای اینفو صدا نمی‌خوایم شاید آزاردهنده باشه)
  if (type !== 'info') {
      // چک کردن تنظیمات صدا که قبلا اضافه کردیم
      const soundToggle = document.getElementById('sound-toggle');
      if (!soundToggle || soundToggle.checked) {
          if (type === 'success') playUI('success');
          if (type === 'warning') playUI('click');
      }
  }

  // حذف خودکار بعد از 3 ثانیه
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s forwards';
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3000);
}

// SVG Icons
const iconWork = `<svg class="ui-icon phase-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`;
const iconShort = `<svg class="ui-icon phase-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`;
const iconLong = `<svg class="ui-icon phase-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>`;
const iconClock = `<svg class="ui-icon" style="width:14px; height:14px; margin-right:4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

// ==========================================
// 2. NAVIGATION BUBBLE & TABS
// ==========================================
const tabs = document.querySelectorAll('.tab');
const bubble = document.querySelector('.active-bubble');

function updateBubble(targetTab) {
  bubble.style.width = `${targetTab.offsetWidth}px`;
  bubble.style.left = `${targetTab.offsetLeft}px`;
}

window.addEventListener('load', () => {
  // حذف کلاس preload برای فعال‌سازی انیمیشن‌ها
  document.body.classList.remove('preload');
  
  const activeTab = document.querySelector('.tab.active');
  if (activeTab) updateBubble(activeTab);
});

tabs.forEach((tab, index) => {
  tab.addEventListener('click', (e) => {
    playUI('click');
    tabs.forEach(t => t.classList.remove('active')); 
    e.target.classList.add('active'); 
    updateBubble(e.target); 
    
    document.getElementById('pomodoro-view').style.display = 'none';
    document.getElementById('habits-view').style.display = 'none';
    document.getElementById('progress-view').style.display = 'none';
    
    // مدیریت رنگ‌ها بر اساس تب
    if (index === 0) {
      document.getElementById('pomodoro-view').style.display = 'flex';
      updatePhaseColors(); // برگرداندن رنگ فاز فعلی
    } else {
      // در تب‌های دیگر، رنگ‌ها را پاک کن
      document.body.classList.remove('phase-work', 'phase-short', 'phase-long', 'phase-stopwatch');
      if (index === 1) document.getElementById('habits-view').style.display = 'flex';
      if (index === 2) document.getElementById('progress-view').style.display = 'flex';
    }
  });
});

// ==========================================
// 3. AUDIO ENGINE (Offline)
// ==========================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playUI(type) {
  // اگر چک‌باکس صدا خاموش بود، هیچ صدایی پخش نکن!
  const soundToggle = document.getElementById('sound-toggle');
  if (soundToggle && !soundToggle.checked) return;
  
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  
  if (type === 'click') {
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(600, now); oscillator.frequency.exponentialRampToValueAtTime(300, now + 0.1);
    gainNode.gain.setValueAtTime(0.1, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    oscillator.start(now); oscillator.stop(now + 0.1);
  } else if (type === 'success') {
    oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(400, now); oscillator.frequency.setValueAtTime(600, now + 0.1);
    gainNode.gain.setValueAtTime(0.1, now); gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
    oscillator.start(now); oscillator.stop(now + 0.2);
  } else if (type === 'trash') {
    oscillator.type = 'sawtooth'; oscillator.frequency.setValueAtTime(150, now); oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.2);
    gainNode.gain.setValueAtTime(0.1, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    oscillator.start(now); oscillator.stop(now + 0.2);
  }
}

function playAlarm(type) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (type === 'mute') return;
  const now = audioCtx.currentTime;
  
  if (type === 'bell') {
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(0.8, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 2);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 2);
  } else if (type === 'digital') {
    for (let i=0; i<3; i++) {
      const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
      osc.type = 'square'; osc.frequency.setValueAtTime(1200, now + i*0.3);
      gain.gain.setValueAtTime(0, now + i*0.3); gain.gain.setValueAtTime(0.3, now + i*0.3 + 0.05); gain.gain.setValueAtTime(0, now + i*0.3 + 0.15);
      osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now + i*0.3); osc.stop(now + i*0.3 + 0.2);
    }
  } else if (type === 'bird') {
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(2000, now);
    osc.frequency.linearRampToValueAtTime(3000, now + 0.1); osc.frequency.linearRampToValueAtTime(2000, now + 0.2);
    gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.2);
  }
}

// ==========================================
// 4. TIMER & DOM
// ==========================================
const timeDisplay = document.getElementById('time-left');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const circle = document.querySelector('.progress-ring-circle');
const radius = circle.r.baseVal.value;
const circumference = radius * 2 * Math.PI;

circle.style.strokeDasharray = `${circumference} ${circumference}`;
circle.style.strokeDashoffset = 0; 

function saveTimerState() {
  const state = { timeLeft, totalTime, currentPhase, completedSessions, lastSaved: Date.now() };
  localStorage.setItem('focusTimerState', JSON.stringify(state));
}

function loadTimerState() {
  const saved = localStorage.getItem('focusTimerState');
  if (saved) {
    const state = JSON.parse(saved);
    const FOUR_HOURS = 4 * 60 * 60 * 1000; 
    if (Date.now() - state.lastSaved > FOUR_HOURS) { localStorage.removeItem('focusTimerState'); return false; }
    
    timeLeft = state.timeLeft;
    totalTime = state.totalTime;
    currentPhase = state.currentPhase;
    completedSessions = state.completedSessions;
    
    if (document.getElementById('mode-select').value === 'pomodoro') updatePhaseText();
    updateDisplay();
    updateCircle();
    updatePhaseColors();
    return true; 
  }
  return false; 
}

function updateCircle() {
  const offset = circumference - (timeLeft / totalTime) * circumference;
  circle.style.strokeDashoffset = offset;
}

function updateDisplay() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  timeDisplay.textContent = formattedTime;
  let activeTaskName = 'Focus App';
  if (focusedTaskId !== null) {
    const activeTask = tasks.find(t => t.id === focusedTaskId);
    if (activeTask) activeTaskName = activeTask.text;
  }
  document.title = `${formattedTime} - ${activeTaskName}`;
}

function updatePhaseText() {
  const currentPhaseEl = document.getElementById('current-phase');
  const nextPhaseEl = document.getElementById('next-phase');
  const breaksEnabled = document.getElementById('breaks-toggle').checked;

  if (document.getElementById('mode-select').value === 'stopwatch') return;

  if (currentPhase === 'work') {
    if (breaksEnabled) {
      currentPhaseEl.innerHTML = `${iconWork} Work ${completedSessions + 1}/4`;
      nextPhaseEl.innerHTML = (completedSessions === 3) ? `Next: ${iconLong} Long Break` : `Next: ${iconShort} Short Break`;
    } else {
      currentPhaseEl.innerHTML = `${iconWork} Work (Session ${completedSessions + 1})`;
      nextPhaseEl.innerHTML = `Breaks disabled`;
    }
  } else if (currentPhase === 'shortBreak') {
    currentPhaseEl.innerHTML = `${iconShort} Short Break`;
    nextPhaseEl.innerHTML = `Next: ${iconWork} Work ${completedSessions + 1}/4`;
  } else if (currentPhase === 'longBreak') {
    currentPhaseEl.innerHTML = `${iconLong} Long Break`;
    nextPhaseEl.innerHTML = `Next: ${iconWork} Work 1/4`;
  }
}

function updatePhaseColors() {
  // پاک کردن همه
  document.body.classList.remove('phase-work', 'phase-short', 'phase-long', 'phase-stopwatch');
  
  if (document.getElementById('mode-select').value === 'stopwatch') {
      document.body.classList.add('phase-stopwatch');
      return;
  }
  
  if (currentPhase === 'work') document.body.classList.add('phase-work');
  else if (currentPhase === 'shortBreak') document.body.classList.add('phase-short');
  else if (currentPhase === 'longBreak') document.body.classList.add('phase-long');
}

function resetTimer() {
  clearInterval(timerId); 
  isRunning = false; 
  startBtn.querySelector('.btn-text').textContent = 'Start';
  startBtn.classList.remove('pause');
  
  if (document.getElementById('mode-select').value === 'stopwatch') {
    timeLeft = 0;
    updateDisplay();
    circle.style.strokeDashoffset = circumference; 
    updatePhaseColors();
  } else {
    timeLeft = totalTime; 
    updateDisplay(); 
    updateCircle(); 
    updatePhaseColors();
  }
  saveTimerState(); 
}

function switchPhase() {
  const breaksEnabled = document.getElementById('breaks-toggle').checked;
  const workDuration = parseInt(document.getElementById('work-duration').value) * 60;
  
  if (currentPhase === 'work') {
    completedSessions++;
    if (breaksEnabled) {
      if (completedSessions >= 4) { currentPhase = 'longBreak'; totalTime = 15 * 60; completedSessions = 0; } 
      else { currentPhase = 'shortBreak'; totalTime = 5 * 60; }
    } else { totalTime = workDuration; }
  } else {
    currentPhase = 'work';
    totalTime = workDuration;
  }

  timeLeft = totalTime;
  updatePhaseText();
  updatePhaseColors();
  updateDisplay();
  updateCircle();
  saveTimerState();
}

function toggleTimer() {
  const currentTaskName = document.getElementById('current-task-name').textContent;
  
  // Auto-focus
  if (currentTaskName === 'Nothing') {
    const activeTasks = tasks.filter(t => !t.completed);
    if (activeTasks.length === 1) toggleFocus(activeTasks[0].id);
    else { showToast('🎯 Please focus on a task first before starting the timer!'); return; }
  }

  if (isRunning) {
    clearInterval(timerId); 
    isRunning = false;
    startBtn.querySelector('.btn-text').textContent = 'Start';
    startBtn.classList.remove('pause');
  } else {
    isRunning = true;
    startBtn.querySelector('.btn-text').textContent = 'Pause'; 
    startBtn.classList.add('pause');
    
    timerId = setInterval(() => {
      // Task logic
      if (focusedTaskId !== null) {
        if (document.getElementById('mode-select').value === 'stopwatch' || currentPhase === 'work') {
          const activeTask = tasks.find(t => t.id === focusedTaskId);
          if (activeTask) {
            activeTask.timeSpent++; 
            saveTasks(); 
            const badge = document.getElementById(`badge-${activeTask.id}`);
            if (badge) badge.innerHTML = formatTaskTime(activeTask.timeSpent);
          }
        }
      }
      
      // Stopwatch or Pomodoro
      if (document.getElementById('mode-select').value === 'stopwatch') {
        timeLeft++; 
        updateDisplay();
        const offset = circumference - ((timeLeft % 60) / 60) * circumference;
        circle.style.strokeDashoffset = offset;
      } else {
        timeLeft--; 
        updateDisplay(); 
        updateCircle(); 
        
        if (timeLeft === 0) {
          clearInterval(timerId); 
          isRunning = false;
          startBtn.querySelector('.btn-text').textContent = 'Start';
          startBtn.classList.remove('pause');
          playAlarm(document.getElementById('sound-select').value);
          switchPhase();
          if (document.getElementById('autostart-breaks-toggle').checked && currentPhase !== 'work') toggleTimer(); 
        }
      }
      saveTimerState(); 
    }, 1000);
  }
}

// ==========================================
// 5. EVENT LISTENERS
// ==========================================
startBtn.addEventListener('click', toggleTimer);
resetBtn.addEventListener('click', resetTimer);

resetBtn.addEventListener('dblclick', function() {
  if (document.getElementById('mode-select').value === 'pomodoro') {
    clearInterval(timerId);
    isRunning = false;
    startBtn.querySelector('.btn-text').textContent = 'Start';
    startBtn.classList.remove('pause');
    currentPhase = 'work';
    completedSessions = 0;
    updatePhaseText();
    updatePhaseColors();
    totalTime = parseInt(document.getElementById('work-duration').value) * 60;
    timeLeft = totalTime;
    updateDisplay();
    updateCircle();
    saveTimerState(); 
    showToast('Full Session Reset! Back to Work 1.');
  }
});

const skipBtn = document.getElementById('skip-btn');
if (skipBtn) {
  skipBtn.addEventListener('click', function(event) {
    event.preventDefault(); 
    if (document.getElementById('mode-select').value === 'pomodoro') {
      clearInterval(timerId); 
      isRunning = false;
      startBtn.querySelector('.btn-text').textContent = 'Start';
      startBtn.classList.remove('pause');
      switchPhase(); 
    }
  });
}

// ==========================================
// 6. TASKS LOGIC
// ==========================================
let tasks = JSON.parse(localStorage.getItem('focusTasks')) || [];
let focusedTaskId = JSON.parse(localStorage.getItem('focusedTaskId')) || null;
const taskInput = document.querySelector('.task-input');
const addBtn = document.querySelector('.add-btn');
const taskListContainer = document.querySelector('.task-list-container');
const tasksSection = document.querySelector('.tasks-section');
const currentTaskNameEl = document.getElementById('current-task-name');

function saveTasks() { localStorage.setItem('focusTasks', JSON.stringify(tasks)); localStorage.setItem('focusedTaskId', JSON.stringify(focusedTaskId)); }

function formatTaskTime(totalSeconds) {
  if (totalSeconds === 0) return ''; 
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${iconClock} ${m}m ${s}s`;
}

function renderTasks() {
  const existingTasks = taskListContainer.querySelectorAll('.task-item');
  existingTasks.forEach(task => task.remove());

  tasks.forEach(task => {
    const taskDiv = document.createElement('div');
    taskDiv.className = `task-item ${task.completed ? 'completed' : ''} ${task.id === focusedTaskId ? 'active-focus' : ''}`;
    
    taskDiv.innerHTML = `
      <div class="task-info">
        <span>${task.text}</span>
        <span class="task-time-badge" id="badge-${task.id}">${formatTaskTime(task.timeSpent)}</span>
      </div>
      <div class="task-actions">
        <button class="focus-btn" title="Focus"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></button>
        <button class="done-btn" title="Done"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>
        <button class="remove-btn" title="Remove"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
      </div>
    `;

    taskDiv.querySelector('.focus-btn').addEventListener('click', () => toggleFocus(task.id));
    taskDiv.querySelector('.done-btn').addEventListener('click', () => toggleCompleted(task.id));
    taskDiv.querySelector('.remove-btn').addEventListener('click', () => removeTask(task.id));

    taskListContainer.appendChild(taskDiv);
  });

  if (focusedTaskId) {
    tasksSection.classList.add('zen-mode');
    const focusedTask = tasks.find(t => t.id === focusedTaskId);
    currentTaskNameEl.textContent = focusedTask ? focusedTask.text : 'Nothing';
  } else {
    tasksSection.classList.remove('zen-mode');
    currentTaskNameEl.textContent = 'Nothing';
  }

  let guideTextEl = document.getElementById('guide-text');
  if (tasks.length === 0) {
    guideTextEl.innerHTML = `
      <div class="empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; margin-top: 40px; opacity: 0.7;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 60px; height: 60px; margin-bottom: 10px;"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>
        <p>No tasks yet. Take a deep breath and start planning!</p>
      </div>`;
    guideTextEl.style.display = 'block';
  } else { guideTextEl.style.display = 'none'; }
}

// اسکرول افکت
taskListContainer.addEventListener('scroll', () => {
  if (taskListContainer.scrollTop > 5) taskListContainer.classList.add('is-scrolled');
  else taskListContainer.classList.remove('is-scrolled');
});

function addTask() {
  const text = taskInput.value.trim();
  if (!text || !/[a-zA-Z0-9\u0600-\u06FF]/.test(text)) { showToast("Please enter a valid task."); return; }
  const newTask = { id: Date.now(), text: text, completed: false, timeSpent: 0 };
  tasks.push(newTask); playUI('click'); saveTasks(); renderTasks(); taskInput.value = '';
}

function removeTask(id) {
  playUI('trash'); tasks = tasks.filter(task => task.id !== id);
  if (focusedTaskId === id) focusedTaskId = null;
  saveTasks(); renderTasks(); checkAutoPause();
}

function toggleCompleted(id) {
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    if (task.completed) { playUI('success'); if (focusedTaskId === id) focusedTaskId = null; }
    saveTasks(); renderTasks(); checkAutoPause();
  }
}

function toggleFocus(id) {
  const task = tasks.find(t => t.id === id);
  if (task && task.completed) { showToast("✅ This task is already completed! You can't focus on it."); return; }
  if (focusedTaskId === id) focusedTaskId = null; else focusedTaskId = id;
  playUI('click'); saveTasks(); renderTasks(); checkAutoPause();
}

function checkAutoPause() {
  if (focusedTaskId === null && isRunning) {
    clearInterval(timerId); isRunning = false;
    startBtn.querySelector('.btn-text').textContent = 'Start';
    startBtn.classList.remove('pause');
  }
  updateDisplay();
}

addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keypress', e => { if (e.key === 'Enter') addTask(); });

// ==========================================
// 7. SETTINGS
// ==========================================
const settingsBtn = document.querySelector('.settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const saveSettingsBtn = document.getElementById('save-settings');
const modeSelect = document.getElementById('mode-select');
const pomodoroWrapper = document.getElementById('pomodoro-settings-wrapper');

function applySettingsToTimer() {
  const selectedMode = modeSelect.value;
  const selectedDuration = document.getElementById('work-duration').value;
  
  clearInterval(timerId); isRunning = false;
  startBtn.querySelector('.btn-text').textContent = 'Start';
  startBtn.classList.remove('pause');
  
  const tracker = document.getElementById('session-tracker');
  const skipBtn = document.getElementById('skip-btn');

  if (selectedMode === 'stopwatch') {
    tracker.classList.add('hidden'); 
    
    // 🌟 فیکس تقارن: بجای مخفی کردن، شفافیتش رو کم می‌کنیم و غیرفعالش می‌کنیم
    skipBtn.style.opacity = '0.3';
    skipBtn.style.pointerEvents = 'none'; // غیرقابل کلیک
    skipBtn.style.visibility = 'visible'; // اما دیده شود تا جا پر شود
    
    timeLeft = 0; 
    updateDisplay();
    circle.style.strokeDashoffset = circumference; 
    updatePhaseColors(); 
  } else {
    tracker.classList.remove('hidden'); 
    
    // برگرداندن به حالت عادی
    skipBtn.style.opacity = '1';
    skipBtn.style.pointerEvents = 'auto';
    skipBtn.style.visibility = 'visible';
    
    totalTime = parseInt(selectedDuration) * 60; timeLeft = totalTime;
    currentPhase = 'work'; completedSessions = 0;
    updatePhaseText(); updatePhaseColors(); updateDisplay(); updateCircle(); 
  }
  saveTimerState();
}

function loadSettings() {
  const savedSettings = localStorage.getItem('focusSettings');
  if (savedSettings) {
    const settings = JSON.parse(savedSettings);
    modeSelect.value = settings.mode;
    document.getElementById('work-duration').value = settings.workDuration;
    document.getElementById('breaks-toggle').checked = settings.breaksEnabled;
    document.getElementById('autostart-breaks-toggle').checked = settings.autoStart;
    document.getElementById('sound-select').value = settings.sound;
    document.getElementById('sound-toggle').checked = settings.haptics;
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (settings.darkMode) { darkModeToggle.checked = true; document.body.setAttribute('data-theme', 'dark'); }
    else { darkModeToggle.checked = false; document.body.removeAttribute('data-theme'); }
    
    if (settings.mode === 'stopwatch') pomodoroWrapper.classList.add('disabled-settings');
    else pomodoroWrapper.classList.remove('disabled-settings');
  }
}

function saveSettings() {
  const settings = {
    mode: modeSelect.value, workDuration: document.getElementById('work-duration').value,
    breaksEnabled: document.getElementById('breaks-toggle').checked, autoStart: document.getElementById('autostart-breaks-toggle').checked,
    sound: document.getElementById('sound-select').value, darkMode: document.getElementById('dark-mode-toggle').checked,
    haptics: document.getElementById('sound-toggle').checked
  };
  localStorage.setItem('focusSettings', JSON.stringify(settings));
}

settingsBtn.addEventListener('click', () => settingsModal.classList.add('show'));
closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('show'));
settingsModal.addEventListener('click', (event) => { if (event.target === settingsModal) settingsModal.classList.remove('show'); });
modeSelect.addEventListener('change', () => { if (modeSelect.value === 'stopwatch') pomodoroWrapper.classList.add('disabled-settings'); else pomodoroWrapper.classList.remove('disabled-settings'); });
saveSettingsBtn.addEventListener('click', () => {
  saveSettings(); applySettingsToTimer();
  if (document.getElementById('dark-mode-toggle').checked) document.body.setAttribute('data-theme','dark');
  else document.body.removeAttribute('data-theme');
  settingsModal.classList.remove('show'); 
});

// ==========================================
// 8. INIT & SHORTCUTS
// ==========================================
loadSettings();
const hasSavedTimer = loadTimerState();
if (!hasSavedTimer) applySettingsToTimer();
renderTasks();

document.addEventListener('keydown', (event) => {
  if (event.target.tagName === 'INPUT') return;
  if (event.code === 'Space') { event.preventDefault(); toggleTimer(); }
  if (event.code === 'Escape') {
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal.classList.contains('show')) settingsModal.classList.remove('show');
  }
});