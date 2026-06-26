import { playUI } from './audio.js';

// ==========================================
// SVG ICONS DICTIONARY
// ==========================================
export const icons = {
  work: `<svg class="ui-icon phase-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`,
  short: `<svg class="ui-icon phase-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`,
  long: `<svg class="ui-icon phase-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>`,
  clock: `<svg class="ui-icon" style="width:14px; height:14px; margin-right:4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
};

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const existingToasts = container.querySelectorAll('.toast');
  for (let t of existingToasts) {
    if (t.innerText.includes(message)) return;
  }

  if (container.childElementCount >= 3) {
    const oldest = container.firstChild;
    oldest.style.animation = 'toastOut 0.2s forwards';
    setTimeout(() => oldest.remove(), 200);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '';
  if (type === 'success') icon = '<span style="color:#10b981">✔</span>'; 
  if (type === 'warning') icon = '<span style="color:#f59e0b">⚠️</span>'; 

  toast.innerHTML = icon ? `${icon} <span>${message}</span>` : `<span>${message}</span>`;
  container.appendChild(toast);

  if (type !== 'info') {
      const soundToggle = document.getElementById('sound-toggle');
      if (!soundToggle || soundToggle.checked) {
          if (type === 'success') playUI('success');
          if (type === 'warning') playUI('click');
      }
  }

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s forwards';
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3000);
}

// ==========================================
// TABS & NAVIGATION
// ==========================================
export function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const bubble = document.querySelector('.active-bubble');

  function updateBubble(targetTab) {
    if (!targetTab || !bubble) return;
    bubble.style.width = `${targetTab.offsetWidth}px`;
    bubble.style.left = `${targetTab.offsetLeft}px`;
  }

  window.addEventListener('load', () => {
    document.body.classList.remove('preload');
    
    const savedTabIndex = localStorage.getItem('focusActiveTab') || 0;
    
    if (tabs[savedTabIndex]) {
        setTimeout(() => {
            tabs[savedTabIndex].click();
        }, 50);
    }
  });

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => { 
      playUI('click');
      
      localStorage.setItem('focusActiveTab', index);
      
      tabs.forEach(t => t.classList.remove('active')); 
      tab.classList.add('active'); 
      updateBubble(tab); 
      
      const pomodoroView = document.getElementById('pomodoro-view');
      const habitsView = document.getElementById('habits-view');
      const progressView = document.getElementById('progress-view');
      
      if (pomodoroView) pomodoroView.style.display = 'none';
      if (habitsView) habitsView.style.display = 'none';
      if (progressView) progressView.style.display = 'none';
      
      if (index === 0) {
        if (pomodoroView) pomodoroView.style.display = 'flex'; 
        document.body.classList.remove('phase-habits', 'phase-progress');
        const event = new CustomEvent('updateColors');
        document.dispatchEvent(event);
      } else {
        document.body.classList.remove('phase-work', 'phase-short', 'phase-long', 'phase-stopwatch');
        if (index === 1 && habitsView) {
            habitsView.style.display = 'flex';
            document.body.classList.add('phase-habits');
            document.body.classList.remove('phase-progress');
        }
        if (index === 2 && progressView) {
            progressView.style.display = 'flex';
            document.body.classList.remove('phase-habits');
            document.body.classList.add('phase-progress');
            // Clean event broadcast to tell the Progress tab to update its data
            document.dispatchEvent(new Event('progressTabOpened')); 
        }
      }

      const pomodoroSettings = document.getElementById('pomodoro-settings-wrapper');
      const modeSelect = document.getElementById('mode-select');
      
      // Hide Timer Settings & Mode Select when not on Pomodoro tab
      if (pomodoroSettings) pomodoroSettings.style.display = index === 0 ? 'block' : 'none';
      // Trigger bubble recalculation if switching to Habits tab (index 1)
      if (index === 1) {
          document.dispatchEvent(new Event('habitsTabOpened'));
      }
      if (modeSelect) {
          const modeWrapper = modeSelect.closest('.setting-group');
          if (modeWrapper) modeWrapper.style.display = index === 0 ? 'flex' : 'none';
      }
    });
  });

  window.addEventListener('resize', () => {
     const activeTab = document.querySelector('.tab.active');
     if (activeTab) updateBubble(activeTab);
  });
}