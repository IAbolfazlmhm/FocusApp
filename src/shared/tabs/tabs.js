// ==========================================
// TABS & NAVIGATION
// ==========================================
import { readRaw, writeRaw, STORAGE_KEYS } from '../../core/storage.js';

export function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const bubble = document.querySelector('.active-bubble');

  // FIX: previously animated by changing `left`/`width` directly, which
  // (a) forces a layout recalc every frame and (b) sits inside a
  // `backdrop-filter: blur()` container, so every frame also re-ran an
  // expensive blur repaint — together these made the slide look laggy
  // instead of smooth. Width barely ever changes (the 3 tabs are equal
  // flex-1 slices of the same bar), so only position needs to animate;
  // driving that with `transform: translateX()` lets the browser animate
  // it on the compositor (GPU) without touching layout at all. See the
  // matching `.active-bubble` rule in layout.css.
  function updateBubble(targetTab) {
    if (!targetTab || !bubble) {return;}
    bubble.style.width = `${targetTab.offsetWidth}px`;
    bubble.style.transform = `translateX(${targetTab.offsetLeft}px)`;
  }

  window.addEventListener('load', () => {
    document.body.classList.remove('preload');

    const savedTabIndex = readRaw(STORAGE_KEYS.ACTIVE_TAB, 0);

    if (tabs[savedTabIndex]) {
      setTimeout(() => {
        tabs[savedTabIndex].click();
      }, 50);
    }
  });

  // FIX: tab switches used to swap `display: none` <-> `display: flex`
  // directly, with no transition — every tab switch just popped instantly.
  // display isn't itself animatable, so showing a view now happens in two
  // steps: make it part of layout at opacity 0 / offset, then (after the
  // browser has actually painted that starting frame — double
  // requestAnimationFrame, not a single one, which some browsers can
  // still coalesce into the same frame and skip straight to the end
  // state) let it transition to its resting position. The outgoing view
  // is hidden instantly rather than faded out — the incoming view is
  // what the user's attention follows, and only one view occupies the
  // page's actual layout space at a time, so an exit fade would just be
  // motion nobody's looking at while adding another moving part to get
  // wrong. CSS custom properties already collapse this to a no-op
  // transition under prefers-reduced-motion (see reset.css).
  //
  // `alreadyVisible` exists because the click handler below re-clicks
  // whichever tab is already active — both on every page load (the
  // setTimeout above) and whenever a user re-clicks their current tab.
  // Without it, both cases would needlessly fade the current view to
  // transparent and back on every single load, since by the time
  // showView() runs the blanket display:none a few lines down has
  // already fired.
  function showView(view, alreadyVisible) {
    if (!view) {return;}
    view.style.display = 'flex';
    if (alreadyVisible) {return;}
    view.style.opacity = '0';
    view.style.transform = 'translateY(6px)';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        view.style.opacity = '1';
        view.style.transform = 'translateY(0)';
      });
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      // Click sound is handled by the global data-sound delegate, not here.

      writeRaw(STORAGE_KEYS.ACTIVE_TAB, index);
      document.dispatchEvent(new Event('tabChanged'));

      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      updateBubble(tab);

      const pomodoroView = document.getElementById('pomodoro-view');
      const habitsView = document.getElementById('habits-view');
      const progressView = document.getElementById('progress-view');

      // Captured before the blanket hide below overwrites it — see the
      // comment on showView() above.
      const wasVisible = {
        pomodoro: !!pomodoroView && pomodoroView.style.display !== 'none',
        habits: !!habitsView && habitsView.style.display !== 'none',
        progress: !!progressView && progressView.style.display !== 'none',
      };

      if (pomodoroView) {pomodoroView.style.display = 'none';}
      if (habitsView) {habitsView.style.display = 'none';}
      if (progressView) {progressView.style.display = 'none';}

      if (index === 0) {
        showView(pomodoroView, wasVisible.pomodoro);
        document.body.classList.remove('phase-habits', 'phase-progress');
        const event = new CustomEvent('updateColors');
        document.dispatchEvent(event);
      } else {
        document.body.classList.remove('phase-work', 'phase-short', 'phase-long', 'phase-stopwatch');
        if (index === 1 && habitsView) {
          showView(habitsView, wasVisible.habits);
          document.body.classList.add('phase-habits');
          document.body.classList.remove('phase-progress');
        }
        if (index === 2 && progressView) {
          showView(progressView, wasVisible.progress);
          document.body.classList.remove('phase-habits');
          document.body.classList.add('phase-progress');
          // FIX: this used to dispatch synchronously, right here in the
          // click handler — meaning the (fairly heavy) dashboard
          // rebuild it triggers (heatmaps, stats, deltas) ran BEFORE the
          // browser got a chance to paint the tab-switch bubble's first
          // animation frame. Since the whole handler is one synchronous
          // task, the bubble's slide would stall for however long that
          // rebuild took, then jump to catch up — reading as lag.
          // requestAnimationFrame defers it to right after the browser's
          // next paint, so the bubble gets its first smooth frame in
          // before the dashboard work happens (still effectively
          // instant to the user, just no longer blocking the animation).
          requestAnimationFrame(() => {
              document.dispatchEvent(new Event('progressTabOpened'));
          });
        }
      }

      const pomodoroSettings = document.getElementById('pomodoro-settings-wrapper');
      const modeSelect = document.getElementById('mode-select');

      // Hide Timer Settings & Mode Select when not on Pomodoro tab
      if (pomodoroSettings) {pomodoroSettings.style.display = index === 0 ? 'block' : 'none';}
      // Trigger bubble recalculation if switching to Habits tab (index 1)
      if (index === 1) {
          document.dispatchEvent(new Event('habitsTabOpened'));
      }
      if (modeSelect) {
          const modeWrapper = modeSelect.closest('.setting-group');
          if (modeWrapper) {modeWrapper.style.display = index === 0 ? 'flex' : 'none';}
      }
    });
  });

  window.addEventListener('resize', () => {
     const activeTab = document.querySelector('.tab.active');
     if (activeTab) {updateBubble(activeTab);}
  });
}
