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

import { userQuotes, setUserQuotes } from './state.js';
import { writeJSON, STORAGE_KEYS } from './storage.js';
import { generateId } from './ui-utils.js';

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
  // Built-ins have no `enabled` field and are always eligible; a user
  // quote is excluded only when explicitly disabled (enabled === false),
  // so quotes added before this feature existed (enabled === undefined)
  // keep rotating exactly as before.
  const activeUserQuotes = userQuotes.filter(q => q.enabled !== false);
  return activeUserQuotes.length > 0 ? builtIn.concat(activeUserQuotes) : builtIn;
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
  const updated = userQuotes.filter(q => q.id !== id);
  setUserQuotes(updated);
  writeJSON(STORAGE_KEYS.USER_QUOTES, updated);
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
