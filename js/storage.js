// ==========================================
// CENTRALIZED LOCALSTORAGE ACCESS
// ==========================================
// FIX: Previously every module (habits.js, progress.js, settings.js,
// tasks.js, timer.js) called localStorage.getItem/setItem directly, so the
// safeParse() protection that state.js had only covered the very first
// load. Any write later in the app's life, or a read in a different file,
// could still throw on corrupted/tampered data. Routing everything through
// this one module means "storage can never crash the app" is true
// everywhere, not just at startup — and if the storage strategy ever needs
// to change (e.g. namespacing keys, adding a quota-exceeded fallback), it
// only needs to change here.

/**
 * Read and JSON.parse a key, falling back safely if it's missing, invalid
 * JSON, or (when expectedType is 'array') the wrong shape.
 */
export function readJSON(key, fallback, expectedType = null) {
  const raw = localStorage.getItem(key);
  if (raw === null) {return fallback;}
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) {return fallback;}
    if (expectedType === 'array' && !Array.isArray(parsed)) {
      console.warn(`localStorage["${key}"] was valid JSON but not an array, resetting to default.`);
      return fallback;
    }
    return parsed;
  } catch (err) {
    console.warn(`Corrupted data in localStorage["${key}"], resetting to default.`, err);
    return fallback;
  }
}

/**
 * JSON.stringify and write a key. Wrapped in try/catch because
 * localStorage.setItem can throw (private browsing mode in some browsers,
 * or quota exceeded) — better to lose one save than crash the app.
 */
export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`Failed to save localStorage["${key}"].`, err);
    return false;
  }
}

/** Read a raw (non-JSON) string value, e.g. the active tab index. */
export function readRaw(key, fallback = null) {
  const raw = localStorage.getItem(key);
  return raw === null ? fallback : raw;
}

/** Write a raw (non-JSON) string value. */
export function writeRaw(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`Failed to save localStorage["${key}"].`, err);
    return false;
  }
}

export function remove(key) {
  localStorage.removeItem(key);
}