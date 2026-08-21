// ==========================================
// TEST ENVIRONMENT SETUP
// ==========================================
// The app's own modules assume they're running in a browser — several
// cache `document.getElementById(...)` results at module scope. None of
// that is a design problem in an app that only ever runs in a browser;
// it just means a plain Node test needs *something* standing in for
// `window`/`document`/`localStorage` before those modules can be
// imported at all. jsdom is a devDependency only — nothing under js/ or
// index.html depends on it, and it's never loaded by the actual app.
//
// Import this file first, before importing anything from js/, in every
// test file that needs it.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost/',
});

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
// FIX: Node has its own built-in global Event/CustomEvent (separate from
// jsdom's), so `new Event(...)` used product-code-side (trash.js,
// tabs.js, timer.js, ...) built a Node-realm Event — but
// dom.window.document.dispatchEvent() only accepts an instance of
// *jsdom's* Event class, from this same dom.window realm. A real browser
// never has two competing Event classes, so this mismatch is purely a
// test-environment gap; the fix is here, not in the product code that
// correctly assumes one realm.
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;
