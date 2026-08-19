# FocusApp

A Pomodoro timer, task manager, and habit tracker with focus sessions, streaks, heatmaps, and data export. All data stored locally in your browser — no account required, no server, no tracking.

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

```
FocusApp/
├── index.html          # Single-page app markup
├── manifest.json       # PWA manifest
├── package.json        # Dev tooling config
├── eslint.config.js    # ESLint config
├── .gitignore
├── assets/
│   ├── fonts/           # Self-hosted Inter (woff2, variable weight)
│   ├── sounds/          # UI/alarm sound assets (wav)
│   ├── motivation.json  # Quote pool (habits/focus/general categories)
│   └── Stopwatch*.png   # App icons
├── css/
│   ├── fonts.css           # @font-face declarations
│   ├── variables.css       # CSS custom properties (design tokens, themes, phases)
│   ├── reset.css           # Base reset, fixed background layer, prefers-reduced-motion
│   ├── components/
│   │   ├── buttons.css     # Icon buttons + the .btn/.btn-primary/etc system
│   │   ├── toasts.css      # Toast notifications
│   │   ├── modals.css      # Modal chrome, settings modal, confirm-modal fixes
│   │   ├── dropdowns.css   # Custom-select dropdowns + position fixes
│   │   └── tags.css        # Tag chips, color swatches
│   ├── utilities.css       # glass-pill + small reusable/fragment classes
│   ├── layout.css          # Grid, tabs, bubbles, containers
│   ├── pomodoro.css        # Timer ring, session tracker, task items, Focus Mode
│   ├── habits.css          # Habit cards, streaks, dashboard, date pickers
│   └── progress.css        # Heatmaps, legends, delta badges

├── js/
│   ├── main.js               # App bootstrap, global listeners (module entrypoint)
│   ├── core/
│   │   ├── state.js          # Global mutable state + setters (ESM live bindings)
│   │   ├── storage.js        # localStorage wrapper with try/catch + JSON safety
│   │   ├── dom-utils.js      # escapeHTML, icons, generateId
│   │   └── date-utils.js     # Shared YYYY-MM-DD local date key
│   ├── ui/                   # Generic, feature-agnostic UI infrastructure
│   │   ├── modal-utils.js       # Modal accessibility (focus trap, ESC), confirm modal
│   │   ├── dropdown.js          # Shared custom-select dropdown behavior
│   │   ├── toast.js             # Toast notifications
│   │   ├── tabs.js              # Tab switching
│   │   ├── scroll-utils.js      # Mobile-keyboard input-visibility helper
│   │   ├── color-utils.js       # Tag/category color hashing + suggestion
│   │   ├── stepper-utils.js     # Shared −/value/+ stepper control
│   │   ├── date-segment-input.js # Shared MM/DD/YYYY segmented date input
│   │   └── audio.js             # AudioService: real assets via Web Audio, synth fallback
│   ├── timer/
│   │   ├── timer.js          # Drift-corrected Pomodoro engine
│   │   └── focus-mode.js     # Focus Mode toggle + state
│   ├── tasks/                 # Pomodoro tab: tasks
│   │   ├── tasks.js              # CRUD orchestrator + setupTaskEvents()
│   │   ├── tasks-render.js       # Task list/filter rendering
│   │   ├── tasks-storage.js      # saveTasks()
│   │   ├── tasks-edit-modal.js   # Rename/retag modal
│   │   ├── tasks-tags-modal.js   # Manage Tags modal
│   │   ├── tasks-quick-tag-modal.js  # Gear-icon quick tag picker
│   │   ├── tasks-quick-tag-state.js  # Shared transient state for the picker above
│   │   ├── tasks-date-nav.js     # Prev/next day + calendar picker
│   │   └── tasks-sort.js         # Sort dropdown
│   ├── habits/                # Habits tab
│   │   ├── habits.js              # CRUD orchestrator + setupHabitsEvents()
│   │   ├── habits-render.js       # Habit list rendering
│   │   ├── habits-logic.js        # Recurrence scheduling (isHabitActiveOnDate, streaks)
│   │   ├── habits-storage.js      # saveHabits()/saveHabitCategories()
│   │   ├── habit-icons.js         # Icon name → SVG path dictionary
│   │   ├── habits-modal-open.js   # Create/edit modal open+close
│   │   ├── habits-modal-pickers.js   # Color/icon/category pickers
│   │   ├── habits-modal-frequency.js # Frequency dropdown + custom days/interval
│   │   ├── habits-modal-save.js   # Modal save/validation
│   │   ├── habits-modal-state.js  # Shared transient state for the modal split above
│   │   ├── habits-delete-modal.js # Clear-today / archive / delete-all-history
│   │   ├── habits-categories.js   # Manage Categories modal
│   │   ├── habits-sort.js         # Sort dropdown
│   │   └── habits-quick-add.js    # Quick-add input row
│   ├── progress/
│   │   ├── progress.js          # Dashboard init, custom range, comparison mode
│   │   ├── progress-stats.js    # Stat calculation
│   │   ├── progress-heatmap.js  # Focus/habit heatmap rendering
│   │   └── progress-report.js   # Daily report modal
│   ├── settings/
│   │   └── settings.js       # Settings modal, export/import, apply to timer
│   ├── quotes/
│   │   ├── motivation.js     # Loads assets/motivation.json, shared quote rotation
│   │   └── quotes.js         # Manage Quotes modal (user + built-in)
│   └── trash/
│       ├── trash.js          # Soft-delete store (move/restore/permanently-delete)
│       └── trash-ui.js       # Trash modal UI
```

Each domain folder groups a single feature's own CRUD, rendering, and UI-event
wiring together; `core/` and `ui/` hold the feature-agnostic infrastructure
every domain depends on. A handful of files per domain (`*-modal-state.js`,
`*-quick-tag-state.js`) exist solely to share a couple of small, transient
values — e.g. which record is currently being edited — across that domain's
own split-out files without reaching into `core/state.js`, which is reserved
for real persisted app data.

## Architecture Notes

- **ES Modules** throughout (`<script type="module" src="js/main.js">`)
- **Feature-based modules** — no circular imports, clean DAG
- **Centralized storage** — all `localStorage` access via `core/storage.js` with defensive parsing
- **Shared utilities** — `ui/` owns modals, dropdowns, toasts, tabs, and the other cross-feature widgets
- **Design tokens** — spacing/radius/shadow/typography scale in `variables.css`, alongside the existing theme/phase color system
- **No runtime dependencies** — zero CDN scripts, fully self-contained; the Inter font is self-hosted rather than pulled from a CDN
- **Sprite-based icons** — gear, close, and target icons defined once as `<symbol>`, referenced via `<use>`
- **Audio** — real `.wav` assets decoded once into cached `AudioBuffer`s and played via Web Audio; a missing/failed asset falls back to the original procedural synthesis for that same sound rather than going silent

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