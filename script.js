import { setupTabs } from './js/ui-utils.js';
import { loadSettings, setupSettingsEvents, applySettingsToTimer } from './js/settings.js';
import { loadTimerState, updatePhaseColors, toggleTimer, setupTimerEvents } from './js/timer.js';
import { renderFilters, renderTasks, initConfirmModal, setupTaskEvents } from './js/tasks.js';
import { renderHabits, setupHabitsEvents, initHabitQuotes } from './js/habits.js';
import { renderProgressDashboard, setupProgressEvents } from './js/progress.js';
import { playUI } from './js/audio.js';

window.addEventListener('DOMContentLoaded', () => {
    // 1. Settings Initialization
    loadSettings();
    setupSettingsEvents();
    
    // 2. Timer Initialization
    const hasSavedTimer = loadTimerState();
    if (!hasSavedTimer) applySettingsToTimer();
    setupTimerEvents();

    // 3. Tasks Initialization
    initConfirmModal();
    setupTaskEvents();
    renderFilters();
    renderTasks();
    
    // 4. Habits Initialization
    setupHabitsEvents();
    setupProgressEvents();
    renderHabits();
    if (typeof initHabitQuotes === 'function') initHabitQuotes();

    // 5. UI & Navigation
    setupTabs();
    setupGlobalShortcuts();
});

// Inter-module event listener for updating background themes
document.addEventListener('updateColors', () => {
    updatePhaseColors();
});

// Global Keyboard Shortcuts
function setupGlobalShortcuts() {
    document.addEventListener('keydown', (event) => {
        // Prevent triggering shortcuts when typing in inputs
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
        
        // Space key to toggle timer
        if (event.code === 'Space') { 
            event.preventDefault(); 
            toggleTimer(); 
        }
        
        // Escape to close any open modals
        if (event.code === 'Escape') {
            const modalIds = ['settings-modal', 'tags-modal', 'habit-modal', 'edit-tag-modal'];
            modalIds.forEach(id => {
                const modal = document.getElementById(id);
                if (modal && modal.classList.contains('show')) {
                    modal.classList.remove('show');
                }
            });
        }
    });
}

// Global Input Sanitizer
// This used to whitelist a fixed set of "allowed" characters (letters,
// numbers, spaces, plus a short punctuation list) as an XSS defense —
// meaning apostrophes, colons, quotes, slashes, ampersands, question
// marks, etc. all got silently stripped while you typed. That was
// solving the problem in the wrong place: character-whitelisting on
// input fights normal language (you couldn't type "Don't" or "9am-5pm:
// meeting") and is easy to get wrong either direction.
// The correct place to defend against XSS is at render time — every
// place task/habit/tag/category text gets shown now goes through
// escapeHTML() (see ui-utils.js), which neutralizes `< > & " '` no
// matter what was typed. So here we only block the two characters that
// have no legitimate use in a task/habit name and would otherwise let
// someone start typing a fake HTML tag — everything else is left alone.
document.addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text') {
        const cursorPosition = e.target.selectionStart;
        e.target.value = e.target.value.replace(/[<>]/g, '');
        e.target.setSelectionRange(cursorPosition, cursorPosition);
    }
});

// --- GLOBAL EVENT DISPATCHER ---
// Captures clicks on any interactive button and triggers a global sync
document.addEventListener('click', (e) => {
    // If the user completes a habit or task, tell the Progress tab to update
    if (e.target.closest('.done-btn') || e.target.closest('.habit-item') || e.target.closest('.task-item')) {
        setTimeout(() => {
            document.dispatchEvent(new Event('dataUpdated'));
        }, 100); // 100ms delay ensures localStorage saves first
    }
});

// --- GLOBAL SOUND HAPTICS ---
// Automatically plays the 'click' sound for all interactive elements across every tab and modal
document.addEventListener('click', (e) => {
    // 1. Identify what the user clicked (or the button wrapping what they clicked)
    const trigger = e.target.closest('button, .filter-btn, .tab, .dropdown-item, .tag-select-btn, .habit-item, .slider, .color-option, .icon-option');

    if (trigger) {
        // 2. Ignore buttons that already have custom sounds wired up in their specific files
        const isSpecialButton = trigger.closest('.done-btn') || 
                                trigger.closest('.remove-btn') || 
                                trigger.closest('.start-btn') ||
                                trigger.closest('.done-habit-btn');
        
        if (!isSpecialButton) {
            // You may need to import playUI at the top of script.js if it isn't already there!
            // import { playUI } from './js/audio.js';
            if (typeof playUI === 'function') {
                playUI('click');
            }
        }
    }
});