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

export function playWin(): void {
  tone(523.25, 0.16, 'sine', 0.04, 0);
  tone(659.25, 0.16, 'sine', 0.04, 0.08);
  tone(783.99, 0.28, 'sine', 0.045, 0.16);
}

export function playLose(): void {
  tone(196, 0.22, 'sine', 0.03);
}
