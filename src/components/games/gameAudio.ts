let sharedContext: AudioContext | null = null;

const getContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedContext || sharedContext.state === 'closed') sharedContext = new AudioContextClass();
  if (sharedContext.state === 'suspended') void sharedContext.resume().catch(() => undefined);
  return sharedContext;
};

/** Short UI blip. One AudioContext is reused, because browsers cap how many can exist. */
export const playGameTone = (enabled: boolean, frequency = 420, duration = 0.06, type: OscillatorType = 'sine') => {
  if (!enabled) return;
  const context = getContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.05, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration + 0.01);
  oscillator.addEventListener('ended', () => { oscillator.disconnect(); gain.disconnect(); }, { once: true });
};

export const formatGameTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};
