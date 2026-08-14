// ==========================================
// TAG / HABIT COLOR MATH
// ==========================================
// Everywhere a tag or habit needs a color — either a user-picked one or a
// deterministic fallback hashed from its name — goes through this file.
// Pure functions only; no DOM, no storage, no app state.

// A hex color that reaches rendering always comes from a native
// <input type="color"> under normal use, which the browser itself
// constrains to "#rrggbb" — but stored tag/habit colors also come back
// out of localStorage, including via Import Data, which writes an
// uploaded JSON file's contents straight in with no validation of what's
// inside it. getTagColor below and renderHabits() in habits.js both
// interpolate a color string directly into a style="..." attribute
// inside an innerHTML template (for the --tag-color/--habit-color CSS
// custom properties) — an unvalidated string there is a real injection
// path (e.g. a color value containing a `"` could close the attribute
// early), not just a source of visually broken output. Validating at
// the point a stored color is read for rendering — rather than only
// when it's written — covers every path data can arrive by, present or
// future, not just the ones that exist today.
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
export function isValidHexColor(value) {
  return typeof value === 'string' && HEX_COLOR_RE.test(value);
}

// Converts "#3b82f6" (+ alpha) into "rgba(59, 130, 246, 0.15)". Needed
// because hsla()/hsl() strings (used for the hash-based default color
// below) can't take a hex color as input, and vice versa — this is the
// one conversion point shared by both color paths. Assumes a valid hex
// input; callers pass already-validated colors (see isValidHexColor
// above) or one of this file's own hslToHex() outputs, which are always
// well-formed by construction.
export function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Small internal helper: converts h/s/l (the same values getTagColor's
// hash branch computes) into a "#rrggbb" string. Only needed so
// getTagColor can also return a `hex` value for UI that requires one
// (e.g. a native <input type="color">, which can't accept hsl()).
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = x => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

// FIX: renderTasks() in tasks.js used to look for `window.getTagObj` /
// `window.hexToRgba` to color tag chips, but neither was ever defined
// anywhere in the app (only referenced, behind a `typeof === 'function'`
// guard) — so the guard was always false and every tag chip silently
// rendered in the plain/uncolored fallback style. This gives tags a real,
// stable color without needing to store one: the same tag name always
// hashes to the same hue, so chips stay visually consistent across
// reloads and don't need a color picker UI of their own (unlike habits,
// which already have one).
export function getTagColor(tag, customHex) {
  // FIX: tags used to always get an auto-hashed color with no way for the
  // user to change it — even though some tags (a habit-style "Work" or
  // "Health") might already have a color meaning to the user elsewhere.
  // Passing a stored custom hex (see tagColors in state.js, wired up in
  // tasks.js) here now takes priority; the hash is only ever a fallback
  // for tags nobody has customized yet. Falls through to the hash-based
  // default if customHex isn't a well-formed hex color — see
  // isValidHexColor above for why that check exists.
  if (customHex && isValidHexColor(customHex)) {
    return {
      solid: customHex,
      bg: hexToRgba(customHex, 0.15),
      border: hexToRgba(customHex, 0.3),
      hex: customHex
    };
  }

  let hash = 0;
  const str = String(tag);
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  // Returned as hsl()/hsla() strings (not a bare hex color) so the caller
  // can use `solid` for text/border and `bg` for a translucent fill
  // without needing to append an alpha suffix to a color format that
  // doesn't support one. `hex` is provided alongside for UI (like a color
  // swatch input) that specifically needs a hex value.
  return {
    solid: `hsl(${hue}, 65%, 45%)`,
    bg: `hsla(${hue}, 65%, 45%, 0.15)`,
    border: `hsla(${hue}, 65%, 45%, 0.3)`,
    hex: hslToHex(hue, 65, 45)
  };
}
