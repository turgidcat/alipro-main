let audioContext = null;
let lastPlayedAt = 0;
let unlockInstalled = false;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  return audioContext;
}

export function primeGenerationSound() {
  const context = getAudioContext();
  if (!context) return;
  if (context.state === 'suspended') context.resume().catch(() => {});
}

function installUnlockListeners() {
  if (unlockInstalled || typeof window === 'undefined') return;
  unlockInstalled = true;
  const unlock = () => {
    primeGenerationSound();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

function tone(context, frequency, start, duration, gainValue) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export function playGenerationCompleteSound() {
  installUnlockListeners();
  const context = getAudioContext();
  if (!context) return;
  const now = Date.now();
  if (now - lastPlayedAt < 550) return;
  lastPlayedAt = now;
  const play = () => {
    const start = context.currentTime + 0.01;
    tone(context, 660, start, 0.12, 0.035);
    tone(context, 880, start + 0.09, 0.18, 0.028);
  };
  if (context.state === 'suspended') {
    context.resume().then(play).catch(() => {});
  } else {
    play();
  }
}

installUnlockListeners();
