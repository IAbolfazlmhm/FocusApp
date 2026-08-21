<!-- markdownlint-disable MD033 -->

# FocusApp

A Pomodoro timer, task manager, and habit tracker with focus sessions, streaks, heatmaps, and data export. All data stored locally in your browser — no account required, no server, no tracking.

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen)](https://focus-app-iabolfazlmhm.vercel.app/)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![Tests](https://img.shields.io/badge/tests-76%20passing-success)
![GitHub last commit](https://img.shields.io/github/last-commit/iabolfazlmhm/FocusApp)
![GitHub repo size](https://img.shields.io/github/repo-size/iabolfazlmhm/FocusApp)

## Live Demo

[Try FocusApp →](https://focus-app-iabolfazlmhm.vercel.app/)

## Screenshots

### Desktop

<p align="center">
  <img src="assets/screenshots/desktop-pomodoro.png" width="49%" alt="FocusApp Pomodoro Timer">
  <img src="assets/screenshots/desktop-habits.png" width="49%" alt="FocusApp Habit Tracker">
</p>

<p align="center">
  <img src="assets/screenshots/desktop-progress.png" width="49%" alt="FocusApp Progress Dashboard">
  <img src="assets/screenshots/desktop-focus-mode.png" width="49%" alt="FocusApp Focus Mode">
</p>

<p align="center">
  <img src="assets/screenshots/desktop-stopwatch.png" width="49%" alt="FocusApp Stopwatch">
</p>

### Mobile

<p align="center">
  <img src="assets/screenshots/phone-pomodoro.png" width="32%" alt="FocusApp Mobile Pomodoro Timer">
  <img src="assets/screenshots/phone-habits.png" width="32%" alt="FocusApp Mobile Habit Tracker">
</p>

<p align="center">
  <img src="assets/screenshots/phone-progress.png" width="32%" alt="FocusApp Mobile Progress">
  <img src="assets/screenshots/phone-stopwatch.png" width="32%" alt="FocusApp Mobile Stopwatch">
</p>

<p align="center">
  <img src="assets/screenshots/phone-focus-mode.png" width="32%" alt="FocusApp Mobile Focus Mode">
</p>

## Features

### Pomodoro Timer

- Work / Short Break / Long Break / Stopwatch modes
- Drift-corrected timer (uses `Date.now()` anchors, not naive `setInterval` subtraction)
- Auto-focus: assigns the timer to your lone active task automatically
- Per-phase theming (colors, backgrounds adapt to Work/Break/Long Break)
- Deep reset via press-and-hold on the reset button

### Task Manager

- Add, complete, delete, edit tasks
- Tag tasks with auto-colored chips (deterministic hash → same tag = same color)
- Filter by status (All / Active / Completed) and by tag
- Sort by newest, oldest, time spent, alphabetical
- Per-task time tracking with live badge updates during Pomodoro

### Habit Tracker

- Create habits with flexible recurrence (daily, custom weekdays, weekly, biweekly)
- Streak calculation that respects skip days and "today not logged yet"
- Calendar heatmap with multi-year history
- Color-coded categories per habit
- Per-habit color from 5 presets or any custom color (native color picker)

### Focus Mode

- Opt-in, distraction-reduced view of the Pomodoro tab: hides tab navigation and the task list, centers the timer, and surfaces a rotating motivational quote
- Persists across phase changes (work → break → work) — exits only on explicit action (toggle button or Escape)
- Timer state and behavior are completely unaffected; this is a view-only layer

### Progress Dashboard

- Side-by-side heatmaps for Pomodoro focus time and habit consistency
- Custom date ranges (7d / 30d / 90d / custom)
- Statistics cards (total focus time, completed tasks, active streaks)
- Delta badges showing week-over-week change

### Data Portability

- Full JSON export/import with versioned schema (`_focusAppExport` marker, `exportedAt` timestamp)
- Validates payload shape on import — rejects corrupted/wrong-shaped files gracefully
- Single-file backup works across browsers and devices

### Theming & Accessibility

- Light/dark mode (persisted)
- Self-hosted Inter variable font (woff2, latin + latin-ext, normal + italic) with a system-font fallback stack — no CDN dependency
- Respects `prefers-reduced-motion`
- Full keyboard navigation: all dropdowns, modals, and cards are keyboard-operable
- ARIA labels, roles, and live regions for screen readers
- Focus trapping in modals with focus restoration on close

## Quick Start

```bash
# Install dev dependencies (for linting)
npm install

# Run locally (serves index.html on http://localhost:5173)
npm start

# Lint JavaScript
npm run lint
```

Or simply open `index.html` directly in a browser — no build step required.

## Project Structure

```text
FocusApp/
├── index.html          # Single-page app markup
├── manifest.json       # PWA manifest
├── package.json        # Dev tooling config
├── eslint.config.js    # ESLint config
├── .gitignore
├── assets/
│   ├── fonts/           # Self-hosted Inter (woff2, variable weight)
│   ├── sounds/          # UI/alarm sound assets (mp3)
│   ├── motivation.json  # Quote pool (habits/focus/general categories)
│   └── icon.svg         # App icon
└── src/
    ├── main.js               # App bootstrap, global listeners (module entrypoint)
    ├── styles/                   # True globals — no feature owns these
    │   ├── fonts.css               # @font-face declarations
    │   ├── variables.css           # CSS custom properties (design tokens, themes, phases)
    │   ├── reset.css                # Base reset, fixed background layer, prefers-reduced-motion
    │   ├── utilities.css           # glass-pill + small reusable/fragment classes
    │   └── layout.css               # Page header/container/view-section + their responsive rules
    ├── core/                     # Pure logic, no UI, no CSS
    │   ├── state.js                 # Global mutable state + setters (ESM live bindings)
    │   ├── storage.js               # localStorage wrapper with try/catch + JSON safety
    │   ├── dom-utils.js             # escapeHTML, icons, generateId
    │   └── date-utils.js            # Shared YYYY-MM-DD local date key
    ├── shared/                   # Reusable widgets — JS and CSS colocated per widget
    │   ├── buttons.css              # Icon buttons + the .btn/.btn-primary/etc system
    │   ├── color-utils.js           # Tag/category color hashing + suggestion
    │   ├── scroll-utils.js          # Mobile-keyboard input-visibility helper
    │   ├── audio.js                 # AudioService: real assets via Web Audio, synth fallback
    │   ├── pill.css                 # Shared task/habit list-item card (.task-item, .done-btn, ...)
    │   ├── split-panel.css          # Shared two-column tab layout (.timer-section/.tasks-section)
    │   ├── filter-bar.css           # Shared All/Active/Done filter row
    │   ├── modal/
    │   │   ├── modal-utils.js         # Modal accessibility (focus trap, ESC), confirm modal
    │   │   └── modal.css              # Modal chrome, .setting-group/.custom-select, confirm-modal
    │   ├── dropdown/
    │   │   ├── dropdown.js            # Shared custom-select dropdown behavior
    │   │   └── dropdown.css           # Dropdown positioning/animation
    │   ├── toast/
    │   │   ├── toast.js               # Toast notifications
    │   │   └── toast.css
    │   ├── tabs/
    │   │   ├── tabs.js                # Tab switching
    │   │   └── tabs.css                # Tab bar + every phase's active-tab tint, consolidated
    │   ├── tag-chip/
    │   │   └── tag-chip.css           # Tag/category chips, color swatches (Tasks + Habits)
    │   ├── date-nav/
    │   │   └── date-nav.css           # "Today/Yesterday" + "Weekly ▾" nav triggers (3 tabs)
    │   ├── stepper/
    │   │   ├── stepper-utils.js       # Shared −/value/+ stepper control
    │   │   └── stepper.css
    │   └── date-segment-input/
    │       ├── date-segment-input.js  # Shared MM/DD/YYYY segmented date input
    │       └── date-segment-input.css
    └── features/                 # One folder per tab/feature — its own JS + CSS together
        ├── timer/
        │   ├── timer.js                # Drift-corrected Pomodoro engine
        │   ├── focus-mode.js           # Focus Mode toggle + state
        │   └── timer.css                # Clock ring, session tracker, controls, Focus Mode
        ├── tasks/
        │   ├── tasks.js                 # CRUD orchestrator + setupTaskEvents()
        │   ├── tasks-render.js          # Task list/filter rendering
        │   ├── tasks-storage.js         # saveTasks()
        │   ├── tasks-edit-modal.js      # Rename/retag modal
        │   ├── tasks-tags-modal.js      # Manage Tags modal
        │   ├── tasks-quick-tag-modal.js # Gear-icon quick tag picker
        │   ├── tasks-quick-tag-state.js # Shared transient state for the picker above
        │   ├── tasks-date-nav.js        # Prev/next day + calendar picker
        │   ├── tasks-sort.js            # Sort dropdown
        │   └── tasks.css                 # Task list/input/name/tag-row — Tasks' own pill content
        ├── habits/
        │   ├── habits.js                 # CRUD orchestrator + setupHabitsEvents()
        │   ├── habits-render.js          # Habit list rendering
        │   ├── habits-logic.js           # Recurrence scheduling (isHabitActiveOnDate, streaks)
        │   ├── habits-storage.js         # saveHabits()/saveHabitCategories()
        │   ├── habit-icons.js            # Icon name → SVG path dictionary
        │   ├── habits-modal-open.js      # Create/edit modal open+close
        │   ├── habits-modal-pickers.js   # Color/icon/category pickers
        │   ├── habits-modal-frequency.js # Frequency dropdown + custom days/repeat-every
        │   ├── habits-modal-save.js      # Modal save/validation
        │   ├── habits-modal-state.js     # Shared transient state for the modal split above
        │   ├── habits-delete-modal.js    # Clear-today / archive / delete-all-history
        │   ├── habits-categories.js      # Manage Categories modal
        │   ├── habits-sort.js            # Sort dropdown
        │   ├── habits-quick-add.js       # Quick-add input row
        │   └── habits.css                 # Habit info/icon/streak — Habits' own pill content
        ├── progress/
        │   ├── progress.js              # Dashboard init, custom range, comparison mode
        │   ├── progress-stats.js        # Stat calculation
        │   ├── progress-heatmap.js      # Focus/habit heatmap rendering
        │   ├── progress-report.js       # Daily report modal
        │   └── progress.css              # Heatmaps, legends, delta badges, report modal
        ├── settings/
        │   └── settings.js              # Settings modal, export/import, apply to timer
        ├── quotes/
        │   ├── motivation.js            # Loads assets/motivation.json, shared quote rotation
        │   ├── quotes.js                # Manage Quotes modal (user + built-in)
        │   └── quotes.css                # Manage Quotes modal content
        └── trash/
            ├── trash.js                 # Soft-delete store (move/restore/permanently-delete)
            ├── trash-ui.js              # Trash modal UI
            └── trash.css                 # Trash modal content
```

Each feature folder holds a single tab's own CRUD, rendering, UI-event wiring,
*and* the CSS unique to it — the two used to live in entirely separate `js/`
and `css/` trees; `core/` and `shared/` hold the feature-agnostic
infrastructure every feature depends on. Splitting the CSS out this way
meant actually tracing which rules were genuinely feature-specific versus
reused under the same class name by two or three tabs at once (the
`.task-item`/`.done-btn` pill, the `.timer-section`/`.tasks-section` panel
shell, the tab bar) — those live in `shared/` instead, with a comment at
each one explaining why. A handful of files per feature (`*-modal-state.js`,
`*-quick-tag-state.js`) exist solely to share a couple of small, transient
values — e.g. which record is currently being edited — across that
feature's own split-out files without reaching into `core/state.js`, which
is reserved for real persisted app data.

## Architecture Notes

- **ES Modules** throughout (`<script type="module" src="src/main.js">`)
- **Feature-based structure** — JS and CSS colocated per feature, no circular imports, clean DAG
- **Centralized storage** — all `localStorage` access via `core/storage.js` with defensive parsing
- **Shared widgets** — `shared/` owns modals, dropdowns, toasts, tabs, and the other cross-feature components, each with its JS and CSS together
- **Design tokens** — spacing/radius/shadow/typography scale in `styles/variables.css`, alongside the existing theme/phase color system
- **No runtime dependencies** — zero CDN scripts, fully self-contained; the Inter font is self-hosted rather than pulled from a CDN
- **Sprite-based icons** — gear, close, and target icons defined once as `<symbol>`, referenced via `<use>`
- **Audio** — real `.mp3` assets decoded once into cached `AudioBuffer`s and played via Web Audio; a missing/failed asset falls back to the original procedural synthesis for that same sound rather than going silent

## Development

```bash
# Install dev tooling (linting + tests)
npm install

# Run linter
npm run lint

# Auto-fix lint issues
npm run lint:fix

# Run the test suite
npm test
```

### ESLint Config

- Targets ES2022 modules
- Browser globals declared
- Rules: `eqeqeq`, `curly`, `no-var`, `prefer-const`, `no-duplicate-imports`

### Tests

`tests/` holds targeted unit tests for the app's actual logic, not a full coverage suite — persistence (`storage.js`, timer save/load and its 4-hour staleness cutoff), statistics (`calculateStats`), habit scheduling and streak math (`isHabitActiveOnDate`, `calculateStreak`), and the color-validation fix below. Runs on Node's built-in test runner (`node --test`), no test framework dependency. `jsdom` is a devDependency used only here, to give modules that cache `document.getElementById(...)` at module scope something to import against — it's never loaded by the actual app (see `tests/env.js`).

## Browser Support

Modern evergreen browsers (Chrome 111+, Firefox 113+, Safari 16.4+, Edge 111+). Uses:

- ES Modules
- CSS Custom Properties
- `color-mix()` (with fallback)
- `crypto.randomUUID()` (with fallback)
- `AudioContext` / `webkitAudioContext`
- `requestAnimationFrame`
- `MutationObserver`
- `Blob` / `URL.createObjectURL`

## Data Storage

All data lives in `localStorage` under keys prefixed with `focus`:

- `focusTasks`, `focusedTaskId`, `focusTagsList`, `focusTagColors`
- `focusHabits`, `focusHabitCategories`
- `focusSettings`, `focusTimerState`

No data ever leaves your browser.

## License

MIT
