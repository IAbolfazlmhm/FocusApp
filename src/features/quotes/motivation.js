// ==========================================
// MOTIVATION ENGINE
// ==========================================
// Loads assets/motivation.json once and shares it between every feature
// that shows a rotating quote (Habits tab, Focus Mode) instead of each
// one keeping its own hardcoded array. A small built-in fallback list
// covers the case where the fetch itself fails — offline, opened
// directly from disk via file:// (which blocks fetch of local JSON in
// several browsers), a 404, or malformed JSON — so a broken asset never
// removes the feature, just narrows it back to a fixed short list.

import { userQuotes, setUserQuotes } from '../../core/state.js';
import { writeJSON, readJSON, STORAGE_KEYS } from '../../core/storage.js';
import { generateId } from '../../core/dom-utils.js';
import { moveToTrash } from '../trash/trash.js';

const MOTIVATION_URL = 'assets/motivation.json';

const FALLBACK_QUOTES = [
  { quote: 'Small steps every day.', category: 'habits' },
  { quote: 'Consistency over intensity.', category: 'habits' },
  { quote: 'One task at a time.', category: 'focus' },
  { quote: 'Done is better than perfect.', category: 'general' },
];

let quotesCache = null;
let loadPromise = null;

function loadQuotes() {
  if (quotesCache) {return Promise.resolve(quotesCache);}
  if (loadPromise) {return loadPromise;}

  loadPromise = fetch(MOTIVATION_URL)
    .then(res => {
      if (!res.ok) {throw new Error(`motivation.json: HTTP ${res.status}`);}
      return res.json();
    })
    .then(data => {
      if (!Array.isArray(data.quotes) || data.quotes.length === 0) {
        throw new Error('motivation.json: no quotes array');
      }
      quotesCache = data.quotes;
      return quotesCache;
    })
    .catch(() => {
      quotesCache = FALLBACK_QUOTES;
      return quotesCache;
    });

  return loadPromise;
}

/**
 * Built-in quotes (assets/motivation.json, with the small hardcoded
 * fallback if that fetch fails) plus the user's own quotes, combined into
 * one pool for rotation. The two stay separate in storage — this merge
 * happens only here, at read time — so a user quote is never written into
 * the source JSON and the built-in list is never touched.
 */
async function getCombinedQuotes() {
  const builtIn = await loadQuotes();
  // Apply any saved built-in overrides (edited text/category, or
  // disabled) on top of the static asset — this always produces a new
  // array via map/filter rather than touching `builtIn`/quotesCache in
  // place, since that cached array is the same object returned to every
  // caller (including tests asserting the built-in pool is untouched).
  const overrides = readJSON(STORAGE_KEYS.BUILT_IN_QUOTE_OVERRIDES, {});
  const overriddenBuiltIn = Object.keys(overrides).length === 0
    ? builtIn
    : builtIn
      .map((q, i) => {
        const ov = overrides[`builtin-${i}`];
        if (!ov) {return q;}
        if (ov.enabled === false) {return null;}
        return { quote: ov.quote !== undefined ? ov.quote : q.quote, category: ov.category !== undefined ? ov.category : q.category };
      })
      .filter(Boolean);
  // Built-ins have no `enabled` field and are always eligible; a user
  // quote is excluded only when explicitly disabled (enabled === false),
  // so quotes added before this feature existed (enabled === undefined)
  // keep rotating exactly as before.
  const activeUserQuotes = userQuotes.filter(q => q.enabled !== false);
  return activeUserQuotes.length > 0 ? overriddenBuiltIn.concat(activeUserQuotes) : overriddenBuiltIn;
}

export async function getRandomQuote(category = null) {
  const quotes = await getCombinedQuotes();
  // A quote tagged "general" fits anywhere, so it's included alongside an
  // exact category match rather than requiring category === null to ever
  // surface — otherwise a user quote saved as "General" (or the built-in
  // general quotes already in motivation.json) would never appear, since
  // every current call site asks for a specific category.
  const pool = category ? quotes.filter(q => q.category === category || q.category === 'general') : quotes;
  const list = pool.length > 0 ? pool : quotes;
  return list[Math.floor(Math.random() * list.length)];
}

// ==========================================
// USER QUOTE MANAGEMENT
// ==========================================
// CRUD over the user's own quotes only. Data/persistence lives here
// (alongside the rest of the quote engine); the Settings > Manage Quotes
// modal (quotes.js) owns rendering that list and wiring its form — same
// split already used for storage vs. UI everywhere else in the app.

export function getUserQuotes() {
  return userQuotes;
}

export function addUserQuote(quoteText, category) {
  const entry = { id: generateId(), quote: quoteText, category, enabled: true };
  const updated = [...userQuotes, entry];
  setUserQuotes(updated);
  writeJSON(STORAGE_KEYS.USER_QUOTES, updated);
  return entry;
}

export function updateUserQuote(id, { quote: quoteText, category }) {
  const updated = userQuotes.map(q => (q.id === id ? { ...q, quote: quoteText, category } : q));
  setUserQuotes(updated);
  writeJSON(STORAGE_KEYS.USER_QUOTES, updated);
}

// Temporarily removes a quote from rotation without losing its text —
// distinct from deleting it. Returns the new enabled state so the caller
// can update its UI without a second read of the list.
export function toggleUserQuoteEnabled(id) {
  let nowEnabled = true;
  const updated = userQuotes.map(q => {
    if (q.id !== id) {return q;}
    nowEnabled = !(q.enabled !== false);
    return { ...q, enabled: nowEnabled };
  });
  setUserQuotes(updated);
  writeJSON(STORAGE_KEYS.USER_QUOTES, updated);
  return nowEnabled;
}

export function deleteUserQuote(id) {
  const removed = userQuotes.find(q => q.id === id);
  const updated = userQuotes.filter(q => q.id !== id);
  setUserQuotes(updated);
  writeJSON(STORAGE_KEYS.USER_QUOTES, updated);
  // Soft-delete: the full quote goes to Trash instead of being gone for
  // good — see trash.js. Importing it here (rather than having callers
  // do it) keeps every quote-delete path, present and future, covered.
  if (removed) {moveToTrash('quote', removed.quote, removed);}
}

/**
 * Puts a trashed quote back into userQuotes, preserving its original id
 * — restoring re-adds the exact same entry rather than creating a new
 * one, so repeated delete/restore cycles don't pile up duplicate ids.
 */
export function restoreUserQuote(quoteData) {
  if (!quoteData || userQuotes.some(q => q.id === quoteData.id)) {return;}
  const updated = [...userQuotes, quoteData];
  setUserQuotes(updated);
  writeJSON(STORAGE_KEYS.USER_QUOTES, updated);
}

// ==========================================
// BUILT-IN QUOTE CUSTOMIZATION
// ==========================================
// The built-in quote pool (assets/motivation.json, loaded via
// loadQuotes() below) is a static, shipped asset — it can't be spliced
// or rewritten in place. To let someone edit or disable one of those
// quotes anyway, overrides are kept as a separate small patch layer,
// keyed by a stable `builtin-<index>` id (index in the static array is
// stable across loads since the asset itself doesn't change), and
// applied on top of the real data everywhere it's read — see
// getCombinedQuotes() below, which is the only place that needs to know
// both layers exist.

function getBuiltInOverrides() {
  return readJSON(STORAGE_KEYS.BUILT_IN_QUOTE_OVERRIDES, {});
}

/** Built-in quotes merged with any saved overrides, for the management UI. */
export async function getBuiltInQuotesForManagement() {
  const builtIn = await loadQuotes();
  const overrides = getBuiltInOverrides();
  return builtIn.map((q, i) => {
    const id = `builtin-${i}`;
    const ov = overrides[id] || {};
    return {
      id,
      quote: ov.quote !== undefined ? ov.quote : q.quote,
      category: ov.category !== undefined ? ov.category : q.category,
      enabled: ov.enabled !== false,
      isEdited: ov.quote !== undefined || ov.category !== undefined,
    };
  });
}

export function updateBuiltInQuoteOverride(id, { quote: quoteText, category }) {
  const overrides = getBuiltInOverrides();
  overrides[id] = { ...overrides[id], quote: quoteText, category };
  writeJSON(STORAGE_KEYS.BUILT_IN_QUOTE_OVERRIDES, overrides);
}

/** Mirrors toggleUserQuoteEnabled() above — "delete" for a built-in quote means removing it from rotation, since the underlying asset can't be spliced. Returns the new enabled state. */
export function toggleBuiltInQuoteEnabled(id) {
  const overrides = getBuiltInOverrides();
  const nowEnabled = !(overrides[id]?.enabled !== false);
  overrides[id] = { ...overrides[id], enabled: nowEnabled };
  writeJSON(STORAGE_KEYS.BUILT_IN_QUOTE_OVERRIDES, overrides);
  return nowEnabled;
}

/** Reverts a built-in quote's text/category edit — its enabled state (if changed) is kept, since "reset the edit" and "re-enable it" are different actions. */
export function resetBuiltInQuoteOverride(id) {
  const overrides = getBuiltInOverrides();
  const keepEnabled = overrides[id]?.enabled;
  overrides[id] = keepEnabled === false ? { enabled: false } : undefined;
  if (overrides[id] === undefined) {delete overrides[id];}
  writeJSON(STORAGE_KEYS.BUILT_IN_QUOTE_OVERRIDES, overrides);
}

/**
 * Puts a random quote into `el` and rotates it on a timer, fading out/in
 * across the change. Returns a stop function — callers that can be torn
 * down (like Focus Mode) should call it on exit so the interval doesn't
 * keep running against a detached element.
 */
export function startQuoteRotation(el, { category = null, intervalMs = 8000, fadeMs = 800, fadeClass = 'fade-out' } = {}) {
  if (!el) {return () => {};}
  let stopped = false;

  const applyRandomQuote = async () => {
    const { quote } = await getRandomQuote(category);
    if (stopped) {return;}
    el.textContent = `"${quote}"`;
  };

  const timer = setInterval(() => {
    el.classList.add(fadeClass);
    setTimeout(async () => {
      if (stopped) {return;}
      await applyRandomQuote();
      el.classList.remove(fadeClass);
    }, fadeMs);
  }, intervalMs);

  applyRandomQuote();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
