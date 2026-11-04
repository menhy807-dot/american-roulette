let context: AudioContext | null = null;

function audio(): AudioContext | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!context) context = new Ctor();
  if (context.state === 'suspended') void context.resume();
  return context;
}

function tone(freq: number, dur: number, type: OscillatorType, peak: number, delay = 0): void {
  const ctx = audio();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function noise(dur: number, peak: number, freq: number): void {
  const ctx = audio();
  if (!ctx) return;
  const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 0.8;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peak, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
}

export function unlockAudio(): void {
  audio();
}

export function playChip(): void {
  noise(0.045, 0.03, 1800);
  tone(920, 0.06, 'triangle', 0.035);
}

export function playSpin(): void {
  noise(0.28, 0.025, 420);
  tone(180, 0.22, 'sine', 0.02);
}

export function playWin(big = false): void {
  tone(523.25, 0.16, 'sine', 0.045, 0);
  tone(659.25, 0.16, 'sine', 0.045, 0.09);
  tone(783.99, 0.22, 'sine', 0.05, 0.18);
  tone(1046.5, big ? 0.42 : 0.3, 'triangle', big ? 0.05 : 0.03, 0.28);
  if (big) tone(1318.5, 0.36, 'sine', 0.04, 0.42);
}

let rollTimer = 0;

/** Soft clacks while the ball travels. Returns a stop function. */
export function startRoll(): () => void {
  window.clearInterval(rollTimer);
  const tick = () => {
    noise(0.04, 0.02, 700 + Math.random() * 900);
    tone(120 + Math.random() * 50, 0.04, 'sine', 0.01);
  };
  tick();
  rollTimer = window.setInterval(tick, 120 + Math.floor(Math.random() * 80));
  return () => window.clearInterval(rollTimer);
}

export function playLose(): void {
  tone(196, 0.22, 'sine', 0.03);
}
