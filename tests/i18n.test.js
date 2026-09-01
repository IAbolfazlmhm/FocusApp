import test from 'node:test';
import assert from 'node:assert/strict';
import './env.js';
import { t, setLocale, getLocale, isRTL, translateDOM, initLocale } from '../src/core/i18n.js';
import { STORAGE_KEYS } from '../src/core/storage.js';

test('i18n: defaults to English and returns translation keys correctly', () => {
  setLocale('en');
  assert.equal(getLocale(), 'en');
  assert.equal(isRTL(), false);
  assert.equal(t('tab_pomodoro'), 'Pomodoro');
  assert.equal(t('start'), 'Start');
});

test('i18n: translates to Persian when locale is set to fa', () => {
  setLocale('fa');
  assert.equal(getLocale(), 'fa');
  assert.equal(isRTL(), true);
  assert.equal(t('tab_pomodoro'), 'پومودورو');
  assert.equal(t('start'), 'شروع');
  assert.equal(t('save_changes'), 'ذخیره تغییرات');
});

test('i18n: parameter interpolation replaces placeholders correctly', () => {
  setLocale('en');
  const renderedEn = t('completed_count', { done: 3, total: 5 });
  assert.equal(renderedEn, '3/5 Completed');

  // FIX: numeric params are now routed through formatNumber() (see i18n.js),
  // so fa-locale interpolation renders Persian digits like every other
  // number in the app, instead of leaking Latin digits into translated text.
  setLocale('fa');
  const renderedFa = t('completed_count', { done: 3, total: 5 });
  assert.equal(renderedFa, '۳/۵ انجام شد');
});

test('i18n: string params are left untouched by number formatting', () => {
  setLocale('fa');
  const rendered = t('delete_tag_confirm', { tag: 'urgent' });
  assert.match(rendered, /urgent/);
});

test('i18n: falls back to English when a key is missing in other locales', () => {
  setLocale('fa');
  const text = t('non_existent_key');
  assert.equal(text, 'non_existent_key');
});

test('i18n: translateDOM updates data-i18n and data-i18n-placeholder elements', () => {
  setLocale('fa', false);
  const container = document.createElement('div');
  container.innerHTML = `
    <span id="title" data-i18n="app_title"></span>
    <input id="input" data-i18n-placeholder="add_task_placeholder" />
    <button id="btn" data-i18n-title="settings" data-i18n-aria-label="settings"></button>
  `;
  translateDOM(container);

  assert.equal(container.querySelector('#title').textContent, 'برنامه تمرکز');
  assert.equal(container.querySelector('#input').placeholder, 'افزودن وظیفه جدید...');
  assert.equal(container.querySelector('#btn').title, 'تنظیمات');
  assert.equal(container.querySelector('#btn').getAttribute('aria-label'), 'تنظیمات');
});

// FIX regression coverage: initLocale() used to always default a
// first-time visitor to 'en' regardless of their actual device/browser
// language. It now checks window.navigator.language, but only when
// nothing is stored yet — an explicit prior choice always wins.
function setBrowserLanguage(lang) {
  Object.defineProperty(window.navigator, 'language', { value: lang, configurable: true });
}

test('i18n: initLocale defaults a first-time visitor to fa when the browser reports a Persian language', () => {
  localStorage.removeItem(STORAGE_KEYS.SETTINGS);
  setBrowserLanguage('fa-IR');
  initLocale();
  assert.equal(getLocale(), 'fa');
});

test('i18n: initLocale defaults a first-time visitor to en when the browser reports a non-Persian language', () => {
  localStorage.removeItem(STORAGE_KEYS.SETTINGS);
  setBrowserLanguage('de-DE');
  initLocale();
  assert.equal(getLocale(), 'en');
});

test('i18n: initLocale prefers a previously saved language choice over the browser language', () => {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ language: 'en' }));
  setBrowserLanguage('fa-IR');
  initLocale();
  assert.equal(getLocale(), 'en', 'stored English preference should win even though the browser is Persian');

  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ language: 'fa' }));
  setBrowserLanguage('en-US');
  initLocale();
  assert.equal(getLocale(), 'fa', 'stored Persian preference should win even though the browser is English');

  localStorage.removeItem(STORAGE_KEYS.SETTINGS);
  setLocale('en');
});

test('i18n: translations exist for all new keys in en and fa', () => {
  const keys = [
    'minute_short', 'uncategorized', 'choose_color_for_tag', 'color_for_tag',
    'delete_tag_aria', 'reset_tag_color', 'reset_tag_color_aria',
    'choose_color_for_category', 'color_for_category', 'delete_category_aria',
    'reset_category_color', 'reset_category_color_aria', 'choose_a_date',
    'previous_month', 'next_month', 'app_heading', 'delete_quote', 'select_tag_aria'
  ];

  setLocale('en');
  keys.forEach(k => {
    assert.notEqual(t(k), k, `Key ${k} should have an English translation`);
  });

  setLocale('fa');
  keys.forEach(k => {
    assert.notEqual(t(k), k, `Key ${k} should have a Persian translation`);
  });
  setLocale('en');
});

test('i18n: uncategorized key translates correctly', () => {
  setLocale('en');
  assert.equal(t('uncategorized'), 'Uncategorized');
  setLocale('fa');
  assert.equal(t('uncategorized'), 'دسته‌بندی‌نشده');
  setLocale('en');
});

test('i18n: minute_short key translates correctly', () => {
  setLocale('en');
  assert.equal(t('minute_short'), 'min');
  setLocale('fa');
  assert.equal(t('minute_short'), 'دقیقه');
  setLocale('en');
});
