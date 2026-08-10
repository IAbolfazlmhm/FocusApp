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

export async function getRandomQuote(category = null) {
  const quotes = await loadQuotes();
  const pool = category ? quotes.filter(q => q.category === category) : quotes;
  const list = pool.length > 0 ? pool : quotes;
  return list[Math.floor(Math.random() * list.length)];
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
