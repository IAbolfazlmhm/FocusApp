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
│   ├── state.js         # Global mutable state + setters (ESM live bindings)
│   ├── storage.js       # localStorage wrapper with try/catch + JSON safety
│   ├── date-utils.js    # Shared YYYY-MM-DD local date key
│   ├── audio.js         # AudioService: real assets via Web Audio, synth fallback
│   ├── motivation.js    # Loads assets/motivation.json, shared quote rotation
│   ├── focus-mode.js    # Focus Mode toggle + state
│   ├── ui-utils.js      # escapeHTML, icons, toasts, tabs, modals, dropdowns, confirm
│   ├── settings.js      # Settings modal, export/import, apply to timer
│   ├── timer.js         # Drift-corrected Pomodoro engine
│   ├── tasks.js         # Task CRUD, filtering, sorting, tagging
│   ├── habits.js        # Habit CRUD, recurrence, streaks, heatmaps
│   └── progress.js      # Dashboard rendering, stats, custom ranges
└── script.js            # App bootstrap, global listeners (module entrypoint)
```

## Architecture Notes

- **ES Modules** throughout (`<script type="module" src="script.js">`)
- **Feature-based modules** — no circular imports, clean DAG
- **Centralized storage** — all `localStorage` access via `storage.js` with defensive parsing
- **Shared utilities** — `ui-utils.js` owns modals, dropdowns, toasts, tabs, icons
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