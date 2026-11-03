import { colorKey, t } from './i18n.ts';
import { colorOf, rotationToTop, WHEEL_ORDER, type Pocket } from './rules.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CX = 200;
const CY = 200;
const OUTER = 176;
const INNER = 112;
const TEXT_R = 146;

export interface WheelController {
  spinTo(pocket: Pocket, durationMs: number, onDone: () => void): void;
  highlight(pocket: Pocket | null): void;
  jumpTo(pocket: Pocket | null): void;
}

/** One randomized spin. The wheel and ball meet on `pocket` at t = 1. */
export interface SpinMotion {
  wheelStart: number;
  wheelEnd: number;
  ballStart: number;
  ballEnd: number;
  /** Ease-out power. Higher starts faster and coasts longer. */
  easePower: number;
  bumps: number;
  bumpAmp: number;
  wobble: number;
}

const BALL_OUTER = 8;
const BALL_POCKET = 14.5;

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

function easeOutPow(t: number, power: number): number {
  const u = clamp01(t);
  return 1 - (1 - u) ** power;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const u = clamp01((value - edge0) / (edge1 - edge0));
  return u * u * (3 - 2 * u);
}

/**
 * Wheel angle, ball angle, and ball track (CSS top %) at progress t in [0, 1].
 * t = 1 is exact: the chosen pocket is under the pointer and the ball is in it.
 */
export function spinFrame(motion: SpinMotion, t: number): { wheel: number; ball: number; ballTop: number } {
  const u = clamp01(t);
  if (u >= 1) {
    return { wheel: motion.wheelEnd, ball: motion.ballEnd, ballTop: BALL_POCKET };
  }

  const split = 0.8;
  const wheelP = u < split
    ? easeOutPow(u / split, motion.easePower) * 0.88
    : 0.88 + easeOutPow((u - split) / (1 - split), 2) * 0.12;
  let wheel = motion.wheelStart + (motion.wheelEnd - motion.wheelStart) * wheelP;
  wheel += Math.sin(u * 16) * 0.28 * (1 - u);

  const travelEnd = 0.72;
  const ballP = u >= travelEnd ? 1 : 1 - Math.exp(-5.5 * (u / travelEnd));
  const ballPNorm = ballP / (1 - Math.exp(-5.5));
  let ball = motion.ballStart + (motion.ballEnd - motion.ballStart) * ballPNorm;

  const drop = smoothstep(0.55, 0.78, u);
  let ballTop = BALL_OUTER + (BALL_POCKET - BALL_OUTER) * drop;

  if (u > travelEnd && u < 0.97) {
    const local = (u - travelEnd) / (0.97 - travelEnd);
    const decay = Math.exp(-3.4 * local);
    ball += Math.sin(local * motion.bumps * Math.PI) * motion.bumpAmp * decay;
    ballTop += Math.sin(local * (motion.bumps + 1) * Math.PI) * motion.wobble * decay;
  }

  return { wheel, ball, ballTop };
}

function polar(radius: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [CX + radius * Math.cos(rad), CY + radius * Math.sin(rad)];
}

function slicePath(mid: number, slice: number): string {
  const a0 = mid - slice / 2;
  const a1 = mid + slice / 2;
  const [x0, y0] = polar(OUTER, a0);
  const [x1, y1] = polar(OUTER, a1);
  const [ix0, iy0] = polar(INNER, a0);
  const [ix1, iy1] = polar(INNER, a1);
  return [
    `M ${ix0.toFixed(2)} ${iy0.toFixed(2)}`,
    `L ${x0.toFixed(2)} ${y0.toFixed(2)}`,
    `A ${OUTER} ${OUTER} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `L ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
    `A ${INNER} ${INNER} 0 0 0 ${ix0.toFixed(2)} ${iy0.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function el<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, name);
}

export function mountWheel(root: HTMLElement): WheelController {
  root.replaceChildren();
  const anchor = document.createElement('div');
  anchor.className = 'wheel-anchor';

  const backdrop = document.createElement('div');
  backdrop.className = 'wheel-backdrop';
  document.body.appendChild(backdrop);

  const zoom = document.createElement('div');
  zoom.className = 'wheel-zoom';

  const stage = document.createElement('div');
  stage.className = 'wheel-stage';

  const pointer = document.createElement('div');
  pointer.className = 'pointer';
  pointer.setAttribute('aria-hidden', 'true');

  const disc = document.createElement('div');
  disc.className = 'wheel-disc';

  const rotor = document.createElement('div');
  rotor.className = 'wheel-rotor';

  const svg = el('svg');
  svg.setAttribute('viewBox', '0 0 400 400');
  svg.setAttribute('aria-hidden', 'true');

  const wood = el('circle');
  wood.setAttribute('cx', String(CX));
  wood.setAttribute('cy', String(CY));
  wood.setAttribute('r', '198');
  wood.setAttribute('class', 'wheel-wood');

  const brass = el('circle');
  brass.setAttribute('cx', String(CX));
  brass.setAttribute('cy', String(CY));
  brass.setAttribute('r', '186');
  brass.setAttribute('class', 'wheel-brass');

  const pockets = el('g');
  const slice = 360 / WHEEL_ORDER.length;
  for (let i = 0; i < WHEEL_ORDER.length; i += 1) {
    const pocket = WHEEL_ORDER[i] ?? '0';
    const mid = i * slice;
    const group = el('g');
    group.setAttribute('class', 'pocket');
    group.dataset.pocket = pocket;
    group.dataset.color = colorOf(pocket);

    const path = el('path');
    path.setAttribute('d', slicePath(mid, slice));
    path.setAttribute('class', 'pocket-path');
    group.appendChild(path);

    const [tx, ty] = polar(TEXT_R, mid);
    const text = el('text');
    text.setAttribute('class', 'pocket-num');
    text.setAttribute('x', tx.toFixed(2));
    text.setAttribute('y', ty.toFixed(2));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('transform', `rotate(${mid.toFixed(3)} ${tx.toFixed(2)} ${ty.toFixed(2)})`);
    text.textContent = pocket;
    if (pocket === '00') text.setAttribute('font-size', '11');
    group.appendChild(text);
    pockets.appendChild(group);
  }

  const felt = el('circle');
  felt.setAttribute('cx', String(CX));
  felt.setAttribute('cy', String(CY));
  felt.setAttribute('r', String(INNER - 1));
  felt.setAttribute('class', 'wheel-felt');

  const groove = el('circle');
  groove.setAttribute('cx', String(CX));
  groove.setAttribute('cy', String(CY));
  groove.setAttribute('r', '128');
  groove.setAttribute('class', 'wheel-groove');

  svg.append(wood, brass, pockets, felt, groove);
  rotor.appendChild(svg);

  const orbit = document.createElement('div');
  orbit.className = 'ball-orbit';
  const ball = document.createElement('div');
  ball.className = 'ball';
  orbit.appendChild(ball);

  const hub = document.createElement('div');
  hub.className = 'hub';
  hub.id = 'hub';
  const hubK = document.createElement('span');
  hubK.className = 'hub-k';
  hubK.id = 'hub-k';
  hubK.textContent = '欢迎';
  const hubNum = document.createElement('span');
  hubNum.className = 'hub-num';
  hubNum.id = 'hub-num';
  hubNum.textContent = '—';
  hub.append(hubK, hubNum);

  disc.append(rotor, orbit, hub);
  stage.append(pointer, disc);
  zoom.appendChild(stage);
  anchor.appendChild(zoom);
  root.appendChild(anchor);

  let wheelRot = 0;
  let ballRot = 0;
  let token = 0;
  let zoomed = false;

  function applyFrame(frame: { wheel: number; ball: number; ballTop: number }): void {
    rotor.style.transform = `rotate(${frame.wheel}deg)`;
    orbit.style.transform = `rotate(${frame.ball}deg)`;
    ball.style.top = `${frame.ballTop}%`;
  }

  function layoutZoom(on: boolean, animate: boolean): void {
    const rect = anchor.getBoundingClientRect();
    const idle = Math.max(rect.width, 1);
    const big = idle * 2;
    zoom.style.width = `${big}px`;
    zoom.style.height = `${big}px`;
    const cx = on ? window.innerWidth / 2 : rect.left + idle / 2;
    const rawCy = on ? window.innerHeight * 0.46 : rect.top + idle / 2;
    const cy = on
      ? Math.max(big / 2 + 8, Math.min(window.innerHeight - big / 2 - 8, rawCy))
      : rawCy;
    const x = cx - big / 2;
    const y = cy - big / 2;
    if (!animate) zoom.style.transition = 'none';
    zoom.style.transform = `translate(${x}px, ${y}px) scale(${on ? 1 : 0.5})`;
    if (!animate) {
      void zoom.offsetWidth;
      zoom.style.transition = '';
    }
  }

  function setZoom(on: boolean): void {
    const changed = zoomed !== on;
    zoomed = on;
    zoom.classList.toggle('is-zoomed', on);
    backdrop.classList.toggle('is-on', on);
    layoutZoom(on, changed);
  }

  const onResize = () => layoutZoom(zoomed, false);
  window.addEventListener('resize', onResize);
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => layoutZoom(zoomed, false));
    observer.observe(anchor);
  }
  layoutZoom(false, false);
  window.requestAnimationFrame(() => layoutZoom(zoomed, false));

  function highlight(pocket: Pocket | null): void {
    for (const node of pockets.querySelectorAll('.pocket.win')) node.classList.remove('win');
    if (!pocket) return;
    const node = pockets.querySelector(`[data-pocket="${CSS.escape(pocket)}"]`);
    node?.classList.add('win');
  }

  return {
    highlight,
    jumpTo(pocket) {
      token += 1;
      setZoom(false);
      if (!pocket) {
        wheelRot = 0;
        ballRot = 0;
      } else {
        wheelRot = rotationToTop(0, pocket, 0);
        ballRot = 0;
      }
      applyFrame({ wheel: wheelRot, ball: ballRot, ballTop: BALL_POCKET });
      highlight(pocket);
    },
    spinTo(pocket, durationMs, onDone) {
      const my = ++token;
      const spinning = durationMs > 0;
      const wheelTurns = spinning ? 6 + Math.floor(Math.random() * 5) : 0;
      const ballTurns = spinning ? 8 + Math.floor(Math.random() * 6) : 0;
      const wheelEnd = rotationToTop(wheelRot, pocket, wheelTurns);
      const ballMod = ((ballRot % 360) + 360) % 360;
      const ballEnd = ballRot - (ballMod === 0 ? 0 : ballMod) - ballTurns * 360;
      const motion: SpinMotion = {
        wheelStart: wheelRot,
        wheelEnd,
        ballStart: ballRot,
        ballEnd,
        easePower: 2.4 + Math.random() * 1.6,
        bumps: 3 + Math.floor(Math.random() * 3),
        bumpAmp: 8 + Math.random() * 14,
        wobble: 0.45 + Math.random() * 0.9,
      };

      const finish = () => {
        if (my !== token) return;
        wheelRot = wheelEnd;
        ballRot = ballEnd;
        applyFrame({ wheel: wheelRot, ball: ballRot, ballTop: BALL_POCKET });
        onDone();
        if (spinning) setZoom(false);
      };

      if (!spinning) {
        wheelRot = wheelEnd;
        ballRot = ballEnd;
        applyFrame({ wheel: wheelRot, ball: ballRot, ballTop: BALL_POCKET });
        queueMicrotask(() => {
          if (my === token) onDone();
        });
        return;
      }

      setZoom(true);
      const started = performance.now();
      const step = (now: number) => {
        if (my !== token) return;
        const t = Math.min(1, (now - started) / durationMs);
        const frame = spinFrame(motion, t);
        applyFrame(frame);
        if (t < 1) {
          window.requestAnimationFrame(step);
          return;
        }
        finish();
      };
      window.requestAnimationFrame(step);
    },
  };
}

export function renderHub(phase: 'betting' | 'spinning' | 'settling', result: Pocket | null, reduceMotion: boolean): void {
  const hub = document.getElementById('hub');
  const hubK = document.getElementById('hub-k');
  const hubNum = document.getElementById('hub-num');
  if (!hub || !hubK || !hubNum) return;

  if (phase === 'spinning') {
    hub.dataset.color = '';
    hubK.textContent = t('hubSpin');
    hubNum.textContent = '···';
    hubNum.classList.remove('pop');
    return;
  }

  if (!result) {
    hub.dataset.color = '';
    hubK.textContent = t('hubWelcome');
    hubNum.textContent = '—';
    hubNum.classList.remove('pop');
    return;
  }

  const color = colorOf(result);
  const changed = hubNum.textContent !== result;
  hub.dataset.color = color;
  hubK.textContent = t(colorKey(result));
  hubNum.textContent = result;
  if (changed && phase === 'settling' && !reduceMotion) {
    hubNum.classList.remove('pop');
    void hubNum.offsetWidth;
    hubNum.classList.add('pop');
  }
}
