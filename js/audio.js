// ==========================================
// AUDIO ENGINE MODULE
// ==========================================

// Created lazily on first use (see getAudioCtx below), not at module load —
// creating an AudioContext before any user gesture has happened triggers a
// harmless-but-noisy "AudioContext was not allowed to start" warning in the
// console on every page load, in every browser that enforces autoplay
// policies. Deferring construction to the first actual click/keypress means
// there's always been a user gesture by the time it's created.
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// Keep track of when each sound was last played
const lastPlayedTimes = {};

export function playUI(type) {
  const soundToggle = document.getElementById('sound-toggle');
  if (soundToggle && !soundToggle.checked) return;

  // FIX: this debounce check used to run AFTER creating and wiring up the
  // oscillator/gainNode below, so a rapid double-click (or fast repeated
  // keyboard input) allocated and connected a full pair of Web Audio nodes
  // for every ignored duplicate call, only to throw them away unused.
  // Checking first avoids that pointless node creation entirely.
  const nowClicked = Date.now();
  if (lastPlayedTimes[type] && (nowClicked - lastPlayedTimes[type] < 50)) {
    return; // It hasn't been 50ms yet, ignore this duplicate request!
  }
  lastPlayedTimes[type] = nowClicked;

  const audioCtx = getAudioCtx();

  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  const now = audioCtx.currentTime;

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
  }
}

export function playAlarm(type) {
  if (type === 'mute') return;

  // FIX: previously only the alarm-sound dropdown itself could silence this
  // (by being set to "Mute"). The separate "Sound Effects" toggle already
  // gates playUI() above but was never checked here, so turning off Sound
  // Effects in Settings muted UI clicks but not the end-of-session alarm —
  // two toggles a user reasonably expects to be the same "sound on/off"
  // switch. Checking the toggle here makes it one real source of truth,
  // independent of and in addition to the per-sound "Mute" option.
  const soundToggle = document.getElementById('sound-toggle');
  if (soundToggle && !soundToggle.checked) return;

  const audioCtx = getAudioCtx();

  const now = audioCtx.currentTime;

  if (type === 'bell') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 2);
  } else if (type === 'digital') {
    for (let i = 0; i < 3; i++) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, now + i * 0.3);
      gain.gain.setValueAtTime(0, now + i * 0.3);
      gain.gain.setValueAtTime(0.3, now + i * 0.3 + 0.05);
      gain.gain.setValueAtTime(0, now + i * 0.3 + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + i * 0.3);
      osc.stop(now + i * 0.3 + 0.2);
    }
  } else if (type === 'bird') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000, now);
    osc.frequency.linearRampToValueAtTime(3000, now + 0.1);
    osc.frequency.linearRampToValueAtTime(2000, now + 0.2);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }
}