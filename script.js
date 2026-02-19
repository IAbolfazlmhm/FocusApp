// ==========================================
// 1. INITIAL VARIABLES (APP STATE)
// ==========================================
let totalTime = 25 * 60; 
let timeLeft = totalTime; 
let timerId = null; 
let isRunning = false;
let currentPhase = 'work'; // 'work', 'shortBreak', 'longBreak'
let completedSessions = 0; 
let currentSort = 'newest'; // 'newest', 'az', 'tag', 'time'
let sortOrder = 'desc'; // 'asc' (صعودی) یا 'desc' (نزولی)
const sortDropdown = document.getElementById('sort-dropdown');
const customTagDropdown = document.getElementById('custom-tag-dropdown');

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
// 6. TASKS LOGIC (FINAL POLISHED VERSION)
// ==========================================
let tasks = JSON.parse(localStorage.getItem('focusTasks')) || [];
let focusedTaskId = JSON.parse(localStorage.getItem('focusedTaskId')) || null;
let savedTags = JSON.parse(localStorage.getItem('focusTagsList')) || ['Work', 'Study', 'Personal'];
let currentFilter = 'all';

// DOM Elements
const taskInput = document.querySelector('.task-input');
const tagInput = document.getElementById('new-task-tag');
const addBtn = document.querySelector('.add-btn');
const taskListContainer = document.querySelector('.task-list-container');
const tasksSection = document.querySelector('.tasks-section');
const currentTaskNameEl = document.getElementById('current-task-name');
const filterListEl = document.getElementById('filter-list');
const filterBubble = document.querySelector('.filter-bubble');
const manageTagsBtn = document.getElementById('manage-tags-btn');
const tagsModal = document.getElementById('tags-modal');
const closeTagsModal = document.getElementById('close-tags-modal');
const tagsManagementList = document.getElementById('tags-management-list');
const tagsDatalist = document.getElementById('tags-datalist');
const manageAddTagBtn = document.getElementById('manage-add-tag-btn');
const manageNewTagInput = document.getElementById('manage-new-tag-input');
// Confirm Modal Elements
const confirmModal = document.getElementById('confirm-modal');
const confirmMsg = document.getElementById('confirm-message');
const confirmYes = document.getElementById('confirm-yes-btn');
const confirmNo = document.getElementById('confirm-no-btn');
let confirmCallback = null;
// Edit Tag Modal Elements
const editTagModal = document.getElementById('edit-tag-modal');
const editTagList = document.getElementById('edit-tag-list');
const closeEditTagBtn = document.getElementById('close-edit-tag');
let editingTaskId = null;

// Icons
const iconTag = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>`;

// --- CORE FUNCTIONS ---

function saveTasks() { 
  localStorage.setItem('focusTasks', JSON.stringify(tasks)); 
  localStorage.setItem('focusedTaskId', JSON.stringify(focusedTaskId)); 
  localStorage.setItem('focusTagsList', JSON.stringify(savedTags));
}

function formatTaskTime(totalSeconds) { 
  if (totalSeconds === 0) return ''; 
  const m = Math.floor(totalSeconds / 60); 
  const s = totalSeconds % 60; 
  return `${iconClock} ${m}m ${s}s`; 
}

function getRelativeDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// --- CUSTOM CONFIRM DIALOG ---
function customConfirm(message, onConfirm) {
  confirmMsg.textContent = message;
  confirmCallback = onConfirm;
  confirmModal.classList.add('show');
}
confirmYes.onclick = () => { if(confirmCallback) confirmCallback(); confirmModal.classList.remove('show'); };
confirmNo.onclick = () => { confirmModal.classList.remove('show'); };


// --- RENDER LOGIC ---

// رندر کردن اولیه فیلترها (فقط وقتی تگ جدید اضافه/حذف میشه صدا زده میشه)
// رندر کردن اولیه فیلترها
function renderFilters() {
  const scrollPos = filterListEl.scrollLeft;

  let html = `
    <div class="filter-bubble"></div>
    <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
    <button class="filter-btn ${currentFilter === 'active' ? 'active' : ''}" data-filter="active">Active</button>
    <button class="filter-btn ${currentFilter === 'completed' ? 'active' : ''}" data-filter="completed">Done</button>
  `;
  
  savedTags.forEach(tag => {
    html += `<button class="filter-btn ${currentFilter === tag ? 'active' : ''}" data-filter="${tag}">#${tag}</button>`;
  });

  filterListEl.innerHTML = html;

  const btns = filterListEl.querySelectorAll('.filter-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      playUI('click');
      currentFilter = btn.dataset.filter;
      
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      updateFilterBubble(); 
      renderTasks(); 
    });
  });

  filterListEl.scrollLeft = scrollPos;
  
  // 🌟 فیکس حباب: جلوگیری از انیمیشن اضافی موقع رفرش
  const bubble = filterListEl.querySelector('.filter-bubble');
  if (bubble) {
      bubble.style.transition = 'none'; // 1. انیمیشن رو خاموش کن
      updateFilterBubble();             // 2. حباب رو ببر سر جاش
      updatePhaseColors();              // 3. رنگش رو تنظیم کن
      
      void bubble.offsetWidth;          // 4. به مرورگر بگو همین الان تغییرات رو اعمال کن (Force Reflow)
      
      bubble.style.transition = '';     // 5. انیمیشن رو دوباره روشن کن برای کلیک‌های بعدی کاربر
  }
}

function updateFilterBubble() {
  const activeBtn = filterListEl.querySelector('.filter-btn.active');
  const bubble = filterListEl.querySelector('.filter-bubble');
  
  if (activeBtn && bubble) {
    bubble.style.width = `${activeBtn.offsetWidth}px`;
    bubble.style.left = `${activeBtn.offsetLeft}px`;
    
    // اسکرول خودکار برای دیده شدن دکمه فعال
    activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

function renderTasks() {
  taskListContainer.innerHTML = ''; 
  
  let filtered = tasks;
  if (currentFilter === 'active') filtered = tasks.filter(t => !t.completed);
  else if (currentFilter === 'completed') filtered = tasks.filter(t => t.completed);
  else if (currentFilter !== 'all') filtered = tasks.filter(t => t.tag === currentFilter);

  // 🌟 ۱. اعمال منطق مرتب‌سازی پیشرفته (با پشتیبانی از Asc/Desc)
  filtered.sort((a, b) => {
      let val = 0;
      if (currentSort === 'newest') val = a.createdAt - b.createdAt; 
      else if (currentSort === 'az') val = a.text.localeCompare(b.text);
      else if (currentSort === 'tag') val = (a.tag || '').localeCompare(b.tag || '');
      else if (currentSort === 'time') val = a.timeSpent - b.timeSpent;

      // اگر sortOrder مساوی asc بود عادی مرتب کن، اگر desc بود برعکسش کن
      return sortOrder === 'asc' ? val : -val;
  });

  let lastDateHeader = null;
  let isFirstHeader = true;

  filtered.forEach(task => {
    const dateLabel = getRelativeDate(task.createdAt);
    
    // 🌟 ۲. ساخت هدر تاریخ (دکمه سمت چپ، تاریخ، خط افقی)
    if (dateLabel !== lastDateHeader) {
      const header = document.createElement('div');
      header.className = 'date-header';
      header.dataset.dateGroup = dateLabel;

      // اضافه کردن دکمه Sort اول از همه (سمت چپ) فقط برای اولین تاریخ
      if (isFirstHeader) {
          const sortBtn = document.createElement('button');
          sortBtn.className = 'sort-btn-inline';
          // آیکون بدون متن
          sortBtn.innerHTML = `<svg class="ui-icon" style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="12" x2="14" y2="12"></line><line x1="4" y1="18" x2="8" y2="18"></line></svg>`;
          
          sortBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              header.appendChild(sortDropdown); // منو رو میاره زیر دکمه
              updateSortUI(); // تنظیم فلش‌ها قبل از باز شدن
              sortDropdown.classList.toggle('show');
          });
          
          header.appendChild(sortBtn);
          isFirstHeader = false;
      }
      
      // متن تاریخ
      const titleSpan = document.createElement('span');
      titleSpan.textContent = dateLabel;
      header.appendChild(titleSpan);
      
      // خط افقی
      const line = document.createElement('div');
      line.className = 'date-header-line';
      header.appendChild(line);

      taskListContainer.appendChild(header);
      lastDateHeader = dateLabel;
    }

    // ... ادامه ساخت taskDiv ...

    const taskDiv = document.createElement('div');
    taskDiv.className = `task-item ${task.completed ? 'completed' : ''} ${task.id === focusedTaskId ? 'active-focus' : ''}`;
    
    // تگ تسک
    const tagHTML = task.tag ? `<span class="task-tag">#${task.tag}</span>` : '';

    taskDiv.innerHTML = `
      <div class="task-info">
        ${tagHTML}
        <span>${task.text}</span>
        <span class="task-time-badge" id="badge-${task.id}">${formatTaskTime(task.timeSpent)}</span>
      </div>
      <div class="task-actions">
        <button class="focus-btn edit-tag-btn" title="Edit Tag">${iconTag}</button>
        
        <button class="focus-btn focus-action" title="Focus"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></button>
        <button class="done-btn" title="Done"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>
        <button class="remove-btn" title="Remove"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
      </div>
    `;

    taskDiv.querySelector('.focus-action').addEventListener('click', () => toggleFocus(task.id));
    taskDiv.querySelector('.done-btn').addEventListener('click', () => toggleCompleted(task.id));
    taskDiv.querySelector('.remove-btn').addEventListener('click', () => {
      customConfirm("Delete this task?", () => removeTask(task.id));
    });
    // باز کردن مودال ادیت تگ برای این تسک
    taskDiv.querySelector('.edit-tag-btn').addEventListener('click', () => openEditTagModal(task.id));

    taskListContainer.appendChild(taskDiv);
  });

  if (focusedTaskId) {
    tasksSection.classList.add('zen-mode');
    const t = tasks.find(x => x.id === focusedTaskId);
    currentTaskNameEl.textContent = t ? t.text : 'Nothing';
    taskListContainer.scrollTop = 0;
  } else {
    tasksSection.classList.remove('zen-mode');
    currentTaskNameEl.textContent = 'Nothing';
  }
  
  // --- Empty State (فنجان قهوه و متن هوشمند) ---
  if (filtered.length === 0) {
    let msg = "No tasks yet. Take a deep breath and start planning!";
    if (currentFilter === 'active') msg = "No active tasks.";
    else if (currentFilter === 'completed') msg = "No completed tasks.";
    else if (currentFilter !== 'all') msg = `No tasks found for #${currentFilter}.`;

    taskListContainer.innerHTML = `
      <div class="empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; margin-top: 40px; opacity: 0.7;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 60px; height: 60px; margin-bottom: 10px;"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>
        <p>${msg}</p>
      </div>`;
  }
}

// --- ACTIONS ---

function addTask() {
  const text = taskInput.value.trim();
  const tagRaw = tagInput.value.trim();
  const tag = tagRaw ? tagRaw.charAt(0).toUpperCase() + tagRaw.slice(1) : null;

  if (!text) { showToast('Please enter a valid task.', 'warning'); return; }

  if (tag && !savedTags.includes(tag)) {
    savedTags.push(tag);
  }

  tasks.push({ id: Date.now(), text, tag, completed: false, timeSpent: 0, createdAt: Date.now() });

  playUI('click'); 
  saveTasks(); 
  renderFilters(); 
  renderTasks(); 
  taskInput.value = '';
}

function removeTask(id) {
  playUI('trash'); tasks = tasks.filter(t => t.id !== id);
  if (focusedTaskId === id) focusedTaskId = null;
  saveTasks(); renderTasks(); checkAutoPause();
}

function toggleCompleted(id) {
  const t = tasks.find(x => x.id === id);
  if (t) { t.completed = !t.completed; t.completedAt = t.completed ? Date.now() : null; if (t.completed) { playUI('success'); if(focusedTaskId===id) focusedTaskId=null; } saveTasks(); renderTasks(); checkAutoPause(); }
}

function toggleFocus(id) {
  const t = tasks.find(x => x.id === id);
  if (t && t.completed) { showToast('Task completed!', 'warning'); return; }
  focusedTaskId = (focusedTaskId === id) ? null : id;
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

// --- TAG MANAGEMENT & EDIT ---

manageTagsBtn.addEventListener('click', () => {
  tagsModal.classList.add('show');
  renderTagsManagement();
});

// پشتیبانی از Enter در بخش ساخت تگ جدید در مودال مدیریت
manageNewTagInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault(); // جلوگیری از رفرش ناخواسته فرم
        manageAddTagBtn.click(); // شبیه‌سازی کلیک روی دکمه Add
    }
});

closeTagsModal.addEventListener('click', () => tagsModal.classList.remove('show'));

// افزودن تگ جدید از داخل مودال
manageAddTagBtn.addEventListener('click', () => {
    const newTagName = manageNewTagInput.value.trim();
    if(newTagName && !savedTags.includes(newTagName)) {
        savedTags.push(newTagName.charAt(0).toUpperCase() + newTagName.slice(1));
        saveTasks();
        renderTagsManagement();
        renderFilters();
        manageNewTagInput.value = '';
        showToast('Tag added', 'success');
    }
});

// مودال مدیریت (حذف) -> قرمز
function renderTagsManagement() {
  tagsManagementList.innerHTML = '';
  savedTags.forEach(tag => {
    const chip = document.createElement('div');
    chip.className = 'tag-chip deletable';
    chip.textContent = `#${tag}`;
    
    chip.addEventListener('click', () => {
      // 🌟 فیکس کلمه Undefined: مستقیم از خود متغیر tag استفاده کردیم
      customConfirm(`Delete tag "${tag}"?`, () => {
        
        savedTags = savedTags.filter(t => t !== tag);
        
        // 🌟 فیکس پاک نشدن تگ تسک‌ها: هر تسکی این تگ رو داره، تگش پاک میشه
        tasks.forEach(t => {
            if (t.tag === tag) {
                t.tag = null;
            }
        });

        if (currentFilter === tag) currentFilter = 'all';
        
        saveTasks();
        renderTagsManagement();
        renderFilters();
        renderTasks();
      });
    });
    tagsManagementList.appendChild(chip);
  });
}

// مودال انتخاب (ادیت) -> زرد
function openEditTagModal(taskId) {
    editingTaskId = taskId;
    editTagList.innerHTML = '';
    
    // گزینه No Tag
    const noTagBtn = document.createElement('div');
    noTagBtn.className = 'tag-chip selectable'; // کلاس selectable اضافه شد
    noTagBtn.textContent = '❌ No Tag';
    noTagBtn.onclick = () => setTaskTag(null);
    editTagList.appendChild(noTagBtn);

    savedTags.forEach(tag => {
        const btn = document.createElement('div');
        btn.className = 'tag-chip selectable'; // کلاس selectable اضافه شد
        btn.textContent = `#${tag}`;
        btn.onclick = () => setTaskTag(tag);
        editTagList.appendChild(btn);
    });

    editTagModal.classList.add('show');
}

function setTaskTag(tag) {
    const task = tasks.find(t => t.id === editingTaskId);
    if (task) {
        task.tag = tag;
        saveTasks();
        renderTasks();
        // همچنین اگر فیلتر فعلی روی تگ بود، رفرش کن
        if (currentFilter !== 'all' && currentFilter !== 'active' && currentFilter !== 'completed') {
             renderTasks(); // تا شاید تسک از لیست حذف بشه اگر تگش عوض شد
        }
    }
    editTagModal.classList.remove('show');
}

closeEditTagBtn.addEventListener('click', () => editTagModal.classList.remove('show'));

// Event Listeners
addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keypress', e => { if (e.key === 'Enter') addTask(); });
tagInput.addEventListener('keypress', e => { if (e.key === 'Enter') addTask(); });

// Init
renderFilters();
renderTasks();

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

// --- CUSTOM DROPDOWN LOGIC ---
function showCustomDropdown() {
    const val = tagInput.value.toLowerCase().trim();
    
    // فیلتر کردن تگ‌هایی که شامل حروف تایپ شده هستن
    const filteredTags = savedTags.filter(t => t.toLowerCase().includes(val));
    
    if (filteredTags.length === 0) {
        customTagDropdown.classList.remove('show');
        return;
    }
    
    // ساخت آیتم‌های منو
    customTagDropdown.innerHTML = filteredTags.map(tag => 
        `<div class="dropdown-item">#${tag}</div>`
    ).join('');
    
    customTagDropdown.classList.add('show');
    
    // کلیک روی هر آیتم
    customTagDropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            // حذف # از اول متن و قرار دادن در اینپوت
            tagInput.value = item.textContent.replace('#', ''); 
            customTagDropdown.classList.remove('show');
            taskInput.focus(); // انتقال خودکار کرسر به بخش نوشتن تسک
        });
    });
};

// نمایش منو موقع فوکوس و تایپ
tagInput.addEventListener('input', showCustomDropdown);
tagInput.addEventListener('focus', showCustomDropdown);

// مخفی کردن منو وقتی جای دیگه‌ای کلیک میشه
document.addEventListener('click', (e) => {
    if (!e.target.closest('.tag-selector-wrapper')) {
        customTagDropdown.classList.remove('show');
    }
});

// لاجیک بسته شدن منوی سورت
document.addEventListener('click', (e) => {
    if (!e.target.closest('.sort-btn-inline') && sortDropdown) {
        sortDropdown.classList.remove('show');
    }
});

// اعمال نوع مرتب‌سازی
if (sortDropdown) {
    sortDropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            currentSort = item.dataset.sort;
            playUI('click');
            sortDropdown.classList.remove('show');
            renderTasks();
        });
    });
};

// آپدیت UI منوی کشویی سورت (گذاشتن فلش و رنگ)
function updateSortUI() {
    if (!sortDropdown) return;
    sortDropdown.querySelectorAll('.dropdown-item').forEach(item => {
        const dirSpan = item.querySelector('.sort-dir');
        if (item.dataset.sort === currentSort) {
            item.classList.add('active-sort');
            dirSpan.textContent = sortOrder === 'asc' ? '↑' : '↓';
        } else {
            item.classList.remove('active-sort');
            dirSpan.textContent = '';
        }
    });
}

// کلیک روی آیتم‌های سورت
if (sortDropdown) {
    sortDropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            const clickedSort = item.dataset.sort;
            
            // اگر کاربر روی همون فیلتری که فعاله دوباره کلیک کرد (مثل دابل کلیک)
            if (currentSort === clickedSort) {
                // فقط در این حالت جهتش رو برعکس کن
                sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                // 🌟 اگر رفت روی یه فیلتر جدید، همیشه برگرد به منطقی‌ترین حالت
                currentSort = clickedSort;
                if (clickedSort === 'newest') sortOrder = 'desc'; // جدیدترین‌ها اول
                else if (clickedSort === 'time') sortOrder = 'desc'; // بیشترین زمان اول
                else if (clickedSort === 'az') sortOrder = 'desc'; // الف تا ی
                else if (clickedSort === 'tag') sortOrder = 'desc'; // الفبای تگ‌ها
            }
            
            playUI('click');
            updateSortUI(); 
            sortDropdown.classList.remove('show');
            renderTasks();
        });
    });
};