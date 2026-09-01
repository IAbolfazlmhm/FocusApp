// ==========================================
// AUDIO SERVICE
// ==========================================
// Plays real sound assets (assets/sounds/*.mp3) through the Web Audio
// API, decoded once into an AudioBuffer and cached — not a new
// HTMLAudioElement or oscillator graph per play. If an asset is missing,
// fails to fetch, or fails to decode, playback falls back to the
// original synthesized tone for that same sound so the app never goes
// silently silent; see synthesizeUI/synthesizeAlarm at the bottom.

const SOUND_FILES = {
  click: 'assets/sounds/click.mp3',
  success: 'assets/sounds/success.mp3',
  // FIX: warning/error toasts (blocked validation, e.g. "task name can't
  // be empty") used to reuse the plain 'click' sound — the same neutral
  // tap that plays for a completely ordinary button press, with nothing
  // distinguishing "that didn't work" from "that worked". Its own
  // distinct sound now covers every showToast(..., 'warning') call in
  // the app at once, since toast.js is the one place that decides which
  // sound a toast type gets. assets/sounds/error.mp3 is a real generated
  // file (two 220Hz square-wave beeps, exponential decay) — not just
  // relying on the synthesizeUI() fallback below, though that fallback
  // uses the same waveform and will still sound right if the asset is
  // ever missing.
  error: 'assets/sounds/error.mp3',
  trash: 'assets/sounds/trash.mp3',
  bell: 'assets/sounds/bell.mp3',
  digital: 'assets/sounds/digital.mp3',
  bird: 'assets/sounds/bird.mp3',
};

// Created lazily on first use, not at module load — creating an
// AudioContext before any user gesture has happened triggers a
// harmless-but-noisy "AudioContext was not allowed to start" warning in
// the console on every page load, in every browser that enforces
// autoplay policies. Deferring construction to the first actual
// click/keypress means there's always been a user gesture by the time
// it's created.
let audioCtx = null;
function getAudioCtx() {
  const isFirstCreation = !audioCtx;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {audioCtx.resume();}
  if (isFirstCreation) {preloadAllBuffers();}
  return audioCtx;
}

// type -> AudioBuffer once decoded, or `null` if that asset is known to
// have failed (fetch/decode error) — a resolved-but-null cache entry is
// what tells playback to stop retrying and use the synth fallback
// instead of re-fetching on every single play.
const bufferCache = new Map();
const loadingPromises = new Map();

function loadBuffer(type) {
  if (bufferCache.has(type)) {return Promise.resolve(bufferCache.get(type));}
  if (loadingPromises.has(type)) {return loadingPromises.get(type);}

  const promise = fetch(SOUND_FILES[type])
    .then(res => {
      if (!res.ok) {throw new Error(`${type}: HTTP ${res.status}`);}
      return res.arrayBuffer();
    })
    .then(arrayBuffer => getAudioCtx().decodeAudioData(arrayBuffer))
    .then(decoded => {
      bufferCache.set(type, decoded);
      return decoded;
    })
    .catch(() => {
      // Missing file, bad path, or a format the browser can't decode —
      // cache the failure so every future call for this type goes
      // straight to the synth fallback instead of re-fetching.
      bufferCache.set(type, null);
      return null;
    });

  loadingPromises.set(type, promise);
  return promise;
}

function preloadAllBuffers() {
  Object.keys(SOUND_FILES).forEach(type => loadBuffer(type));
}

function playBuffer(buffer, gainValue) {
  const ctx = getAudioCtx();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = gainValue;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(0);
  // No manual cleanup needed: a one-shot AudioBufferSourceNode releases
  // its references once playback ends, per spec — nothing to leak.
}

function isSoundEnabled() {
  const soundToggle = document.getElementById('sound-toggle');
  return !soundToggle || soundToggle.checked;
}

// Keep track of when each sound was last played, to debounce rapid
// duplicate triggers (e.g. a fast double-click).
const lastPlayedTimes = {};
function shouldDebounce(type) {
  const nowClicked = Date.now();
  if (lastPlayedTimes[type] && (nowClicked - lastPlayedTimes[type] < 50)) {
    return true;
  }
  lastPlayedTimes[type] = nowClicked;
  return false;
}

export function playUI(type) {
  if (!isSoundEnabled()) {return;}
  if (shouldDebounce(type)) {return;}

  // FIX: main.js's global [data-sound] click delegate fires 'click' on
  // every click unconditionally, regardless of what the click's own
  // handler decided to do — so a blocked/failed action (data-sound=
  // "click" + a showToast(..., 'warning') call inside the same handler)
  // played both the generic tap AND the new distinct error sound,
  // almost simultaneously. The handler's own playUI('error'/'success'/
  // etc.) always runs first (target-phase handlers fire before the
  // event bubbles to the document-level delegate), so stamping 'click'
  // as "just played" here means the delegate's later playUI('click')
  // for the very same click gets caught by the debounce check above and
  // silently skipped — exactly one sound per click, not two competing
  // ones. Only stamps for non-'click' types, since self-debouncing
  // 'click' against itself is already handled by shouldDebounce() above.
  if (type !== 'click') {
    lastPlayedTimes.click = Date.now();
  }

  const cached = bufferCache.get(type);
  if (cached) {
    playBuffer(cached, 0.5);
    return;
  }
  if (cached === undefined) {
    // Not loaded yet — kick off loading for next time, but don't make
    // this click wait on a network round-trip for its feedback.
    loadBuffer(type);
  }
  synthesizeUI(type);
}

export function playAlarm(type) {
  if (type === 'mute') {return;}
  // FIX: previously only the alarm-sound dropdown itself could silence this
  // (by being set to "Mute"). The separate "Sound Effects" toggle already
  // gates playUI() above but was never checked here, so turning off Sound
  // Effects in Settings muted UI clicks but not the end-of-session alarm —
  // two toggles a user reasonably expects to be the same "sound on/off"
  // switch. Checking the toggle here makes it one real source of truth,
  // independent of and in addition to the per-sound "Mute" option.
  if (!isSoundEnabled()) {return;}

  const cached = bufferCache.get(type);
  if (cached) {
    playBuffer(cached, 0.6);
    return;
  }
  if (cached === undefined) {
    loadBuffer(type);
  }
  synthesizeAlarm(type);
}

// --- Synthesis fallback ---
// Identical in design to the sounds baked into assets/sounds/*.mp3 — this
// only ever runs for someone whose browser/server can't deliver those
// files, so it needs to sound like the same instrument, not be a
// generic "beep" placeholder.

function synthesizeUI(type) {
  const ctx = getAudioCtx();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  const now = ctx.currentTime;

  if (type === 'click') {
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(600, now);
    oscillator.frequency.exponentialRampToValueAtTime(300, now + 0.1);
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    oscillator.start(now);
    oscillator.stop(now + 0.1);
  } else if (type === 'success') {
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(400, now);
    oscillator.frequency.setValueAtTime(600, now + 0.1);
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  } else if (type === 'trash') {
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(150, now);
    oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.2);
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  } else if (type === 'error') {
    // Two short descending square-wave beeps — deliberately harsher
    // (square, not sine/triangle) and lower-pitched than 'click' or
    // 'success' so it reads unambiguously as "that didn't work" rather
    // than blending in with ordinary interaction feedback.
    [0, 0.12].forEach(offset => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, now + offset);
      gain.gain.setValueAtTime(0.12, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.1);
    });
  }
}

function synthesizeAlarm(type) {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;

  if (type === 'bell') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 2);
  } else if (type === 'digital') {
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, now + i * 0.3);
      gain.gain.setValueAtTime(0, now + i * 0.3);
      gain.gain.setValueAtTime(0.3, now + i * 0.3 + 0.05);
      gain.gain.setValueAtTime(0, now + i * 0.3 + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.3);
      osc.stop(now + i * 0.3 + 0.2);
    }
  } else if (type === 'bird') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000, now);
    osc.frequency.linearRampToValueAtTime(3000, now + 0.1);
    osc.frequency.linearRampToValueAtTime(2000, now + 0.2);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }
}
