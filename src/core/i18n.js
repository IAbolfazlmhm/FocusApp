import { en } from '../locales/en.js';
import { fa } from '../locales/fa.js';
import { readJSON, writeJSON, STORAGE_KEYS } from './storage.js';

const translations = { en, fa };

let currentLocale = 'en';

export function getLocale() {
  return currentLocale;
}

export function isRTL() {
  return currentLocale === 'fa';
}

export function formatNumber(num) {
  if (num === null || num === undefined) {return '';}
  if (currentLocale === 'fa') {
    return new Intl.NumberFormat('fa-IR', { useGrouping: false }).format(num);
  }
  return String(num);
}

export function formatDate(dateObj, options) {
  if (!dateObj) {return '';}
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const locale = currentLocale === 'fa' ? 'fa-IR' : 'en-US';
  return d.toLocaleDateString(locale, options);
}

export function t(key, params = {}) {
  const dict = translations[currentLocale] || translations.en;
  let text = dict[key] || translations.en[key] || key;

  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([paramKey, paramVal]) => {
      // FIX: numeric params used to be interpolated with plain String(),
      // so any translated string with a number in it (progress counts,
      // heatmap tooltips, quote-length warnings, etc.) showed Latin digits
      // even under fa locale, regardless of what formatNumber() does
      // everywhere else. Route numbers through formatNumber() here once,
      // centrally, instead of relying on every call site to remember.
      const formattedVal = typeof paramVal === 'number' ? formatNumber(paramVal) : paramVal;
      text = text.replaceAll(`{${paramKey}}`, String(formattedVal));
    });
  }

  return text;
}

export function setLocale(locale, shouldTranslateDOM = true) {
  if (!translations[locale]) {
    locale = 'en';
  }
  currentLocale = locale;

  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'fa' ? 'rtl' : 'ltr';
    if (shouldTranslateDOM) {
      translateDOM();
    }
  }

  // Update focusSettings in localStorage if it exists
  const rawSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  if (rawSettings) {
    try {
      const settings = JSON.parse(rawSettings);
      if (settings && settings.language !== locale) {
        settings.language = locale;
        writeJSON(STORAGE_KEYS.SETTINGS, settings);
      }
    } catch {}
  }
}

export function initLocale() {
  const settings = readJSON(STORAGE_KEYS.SETTINGS, null);
  let initialLocale;

  if (settings && settings.language) {
    // An explicit choice (the user's own, or restored from a previous
    // session) always wins over whatever the browser/OS reports.
    initialLocale = settings.language === 'fa' ? 'fa' : 'en';
  } else {
    // FIX: first-ever visit, nothing stored yet — this used to always
    // default to 'en' regardless of the visitor's actual device/browser
    // language. window.navigator.language (falling back to the
    // languages list) is the standard vanilla-JS way to read that;
    // window.navigator rather than the bare global so this resolves to
    // the same object a real browser would give either way, but is also
    // mockable in the jsdom-based test environment (see
    // initLocale.test.js) instead of colliding with Node's own built-in
    // navigator global. Any Persian regional form (fa, fa-IR, fa-AF, ...)
    // starts the app in fa instead of leaving a Persian-speaking visitor
    // to go find the language switcher themselves.
    const nav = typeof window !== 'undefined' ? window.navigator : undefined;
    const browserLang = (nav && (nav.language || (nav.languages && nav.languages[0]))) || '';
    initialLocale = browserLang.toLowerCase().startsWith('fa') ? 'fa' : 'en';
  }

  setLocale(initialLocale, false);
}

export function translateDOM(root = document) {
  if (!root || typeof root.querySelectorAll !== 'function') {return;}

  // FIX: the browser tab title stayed "Focus App" in English at load and
  // on every tab except Pomodoro (where timer.js's own per-tick update
  // takes over while a session is running) — translateDOM() runs on
  // startup and on every languageChanged, so this is the one place that
  // covers both without needing a separate hook. If a timer session is
  // actively running, the very next tick overwrites this within a
  // second anyway, so there's no fight over which title "wins".
  if (typeof document !== 'undefined') {
    document.title = t('app_title');
  }

  // Translate text content
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (key) {
      el.textContent = t(key);
    }
  });

  // Translate placeholders
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (key) {
      el.placeholder = t(key);
    }
  });

  // Translate titles
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    if (key) {
      el.title = t(key);
    }
  });

  // Translate aria-labels
  root.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    const key = el.dataset.i18nAriaLabel;
    if (key) {
      el.setAttribute('aria-label', t(key));
    }
  });
}
