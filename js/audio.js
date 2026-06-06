// ==========================================
// AUDIO ENGINE MODULE
// ==========================================

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

export function playUI(type) {
  const soundToggle = document.getElementById('sound-toggle');
  if (soundToggle && !soundToggle.checked) return;
  
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
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
  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (type === 'mute') return;
  
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