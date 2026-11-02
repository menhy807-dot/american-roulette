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
  root.appendChild(stage);

  let wheelRot = 0;
  let ballRot = 0;
  let token = 0;

  function apply(duration: number): void {
    const easing = 'cubic-bezier(0.12, 0.62, 0.08, 1)';
    const ballEasing = 'cubic-bezier(0.15, 0.48, 0.06, 1)';
    rotor.style.transition = duration > 0 ? `transform ${duration}ms ${easing}` : 'none';
    orbit.style.transition = duration > 0 ? `transform ${duration}ms ${ballEasing}` : 'none';
    rotor.style.transform = `rotate(${wheelRot}deg)`;
    orbit.style.transform = `rotate(${ballRot}deg)`;
  }

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
      if (!pocket) {
        wheelRot = 0;
        ballRot = 0;
      } else {
        wheelRot = rotationToTop(0, pocket, 0);
        ballRot = 0;
      }
      apply(0);
      highlight(pocket);
    },
    spinTo(pocket, durationMs, onDone) {
      const my = ++token;
      const extraTurns = durationMs > 0 ? 4 + Math.floor(Math.random() * 3) : 0;
      const ballTurns = durationMs > 0 ? 6 + Math.floor(Math.random() * 3) : 0;
      wheelRot = rotationToTop(wheelRot, pocket, extraTurns);
      const ballMod = ((ballRot % 360) + 360) % 360;
      ballRot -= (ballMod === 0 ? 0 : ballMod) + ballTurns * 360;
      apply(durationMs);

      let finished = false;
      let timer = 0;
      const finish = () => {
        rotor.removeEventListener('transitionend', onEnd);
        window.clearTimeout(timer);
        if (finished || my !== token) return;
        finished = true;
        onDone();
      };
      const onEnd = (event: TransitionEvent) => {
        if (event.target !== rotor || event.propertyName !== 'transform') return;
        finish();
      };
      timer = window.setTimeout(finish, Math.max(0, durationMs) + 90);
      if (durationMs <= 0) {
        window.requestAnimationFrame(finish);
        return;
      }
      rotor.addEventListener('transitionend', onEnd);
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
    hubK.textContent = '转动';
    hubNum.textContent = '···';
    hubNum.classList.remove('pop');
    return;
  }

  if (!result) {
    hub.dataset.color = '';
    hubK.textContent = '欢迎';
    hubNum.textContent = '—';
    hubNum.classList.remove('pop');
    return;
  }

  const color = colorOf(result);
  const changed = hubNum.textContent !== result;
  hub.dataset.color = color;
  hubK.textContent = color === 'red' ? '红' : color === 'black' ? '黑' : '绿';
  hubNum.textContent = result;
  if (changed && phase === 'settling' && !reduceMotion) {
    hubNum.classList.remove('pop');
    void hubNum.offsetWidth;
    hubNum.classList.add('pop');
  }
}
