export function isBigWin(net: number, stake: number, straightHit: boolean): boolean {
  if (net <= 0) return false;
  return straightHit || (stake > 0 && net >= stake * 10);
}

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  life: number;
}

const COLORS = ['#f0d7a2', '#d4b36a', '#f4efe4', '#8d3333', '#b7e2c8', '#f0c7c1'];

export function celebrate(big: boolean, reduced: boolean): void {
  if (reduced || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.setAttribute('aria-hidden', 'true');
  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }
  const count = big ? 160 : 70;
  const bits: Bit[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.15;
    const speed = (big ? 11 : 8) + Math.random() * (big ? 9 : 6);
    bits.push({
      x: canvas.width * (0.15 + Math.random() * 0.7),
      y: canvas.height * (0.28 + Math.random() * 0.35),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spin: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * (big ? 8 : 5),
      h: 8 + Math.random() * (big ? 12 : 7),
      color: COLORS[i % COLORS.length] ?? '#f0d7a2',
      life: 1,
    });
  }
  const started = performance.now();
  const duration = big ? 3200 : 2400;
  const tick = (now: number) => {
    const t = (now - started) / duration;
    if (t >= 1) {
      canvas.remove();
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const bit of bits) {
      bit.vy += 0.16;
      bit.x += bit.vx;
      bit.y += bit.vy;
      bit.spin += bit.vr;
      bit.life = 1 - t;
      ctx.save();
      ctx.translate(bit.x, bit.y);
      ctx.rotate(bit.spin);
      ctx.globalAlpha = Math.max(0, bit.life);
      ctx.fillStyle = bit.color;
      ctx.fillRect(-bit.w / 2, -bit.h / 2, bit.w, bit.h);
      ctx.restore();
    }
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
}

export function showWinBanner(text: string): void {
  document.querySelector('.win-banner')?.remove();
  const banner = document.createElement('p');
  banner.className = 'win-banner';
  banner.textContent = text;
  document.body.appendChild(banner);
  window.setTimeout(() => banner.remove(), 2600);
}
