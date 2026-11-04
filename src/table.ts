import { paintChip } from './chips.ts';
import { cellLabel, onLocale, spotDetail, spotTitle, t } from './i18n.ts';
import type { GameState } from './game.ts';
import {
  colorOf,
  describeSpot,
  formatChips,
  stakeOn,
  winningSpots,
  type Chip,
  type Pocket,
  type SpotId,
} from './rules.ts';

export interface TableController {
  render(state: GameState): void;
  cell(spot: SpotId): HTMLButtonElement | undefined;
}

function setFace(face: HTMLElement, label: string): void {
  face.replaceChildren();
  if (label.includes('\n')) {
    const [main, sub] = label.split('\n');
    face.append(document.createTextNode(main ?? ''));
    const small = document.createElement('small');
    small.textContent = sub ?? '';
    face.appendChild(small);
    return;
  }
  face.textContent = label;
}

function makeButton(className: string, spot: string): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `cell ${className}`;
  const face = document.createElement('span');
  face.className = 'face-label';
  setFace(face, cellLabel(spot));
  const stack = document.createElement('span');
  stack.className = 'stack';
  el.append(face, stack);
  return el;
}

/** Grid placement for one spot. Portrait uses six numbers per row so the felt fits a phone. */
export function tablePlacement(spot: SpotId, portrait: boolean): { column: string; row: string } {
  if (!portrait) {
    if (spot === 'n:0') return { column: '1', row: '1 / 4' };
    if (spot === 'n:00') return { column: '1', row: '4 / 7' };
    if (spot.startsWith('n:')) {
      const n = Number(spot.slice(2));
      const column = Math.floor((n - 1) / 3) + 2;
      const mod = n % 3;
      const rowStart = mod === 0 ? 1 : mod === 2 ? 3 : 5;
      return { column: String(column), row: `${rowStart} / ${rowStart + 2}` };
    }
    const columns: Record<string, { column: string; row: string }> = {
      c3: { column: '14', row: '1 / 3' },
      c2: { column: '14', row: '3 / 5' },
      c1: { column: '14', row: '5 / 7' },
      d1: { column: '2 / 6', row: '1' },
      d2: { column: '6 / 10', row: '1' },
      d3: { column: '10 / 14', row: '1' },
      low: { column: '2 / 4', row: '1' },
      even: { column: '4 / 6', row: '1' },
      red: { column: '6 / 8', row: '1' },
      black: { column: '8 / 10', row: '1' },
      odd: { column: '10 / 12', row: '1' },
      high: { column: '12 / 14', row: '1' },
    };
    return columns[spot] ?? { column: '1', row: '1' };
  }

  if (spot === 'n:0') return { column: '1 / 4', row: '1' };
  if (spot === 'n:00') return { column: '4 / 7', row: '1' };
  if (spot.startsWith('n:')) {
    const n = Number(spot.slice(2));
    const line = Math.ceil(n / 6);
    const col = ((n - 1) % 6) + 1;
    return { column: String(col), row: String(line + 1) };
  }
  const portraitColumns: Record<string, { column: string; row: string }> = {
    c1: { column: '1 / 3', row: '8' },
    c2: { column: '3 / 5', row: '8' },
    c3: { column: '5 / 7', row: '8' },
    d1: { column: '1 / 3', row: '1' },
    d2: { column: '3 / 5', row: '1' },
    d3: { column: '5 / 7', row: '1' },
    low: { column: '1', row: '1' },
    even: { column: '2', row: '1' },
    red: { column: '3', row: '1' },
    black: { column: '4', row: '1' },
    odd: { column: '5', row: '1' },
    high: { column: '6', row: '1' },
  };
  return portraitColumns[spot] ?? { column: '1', row: '1' };
}

export function mountTable(root: HTMLElement, onPlace: (spot: SpotId, cell: HTMLButtonElement) => void): TableController {
  root.replaceChildren();

  const felt = document.createElement('div');
  felt.className = 'felt';

  const head = document.createElement('div');
  head.className = 'felt-head';
  const title = document.createElement('p');
  title.className = 'felt-title';
  const note = document.createElement('p');
  note.className = 'felt-note';
  const banner = document.createElement('p');
  banner.className = 'lock-banner';
  banner.id = 'lock-banner';
  banner.hidden = true;
  head.append(title, note, banner);

  const scroller = document.createElement('div');
  scroller.className = 'felt-scroll';
  const board = document.createElement('div');
  board.className = 'table-board';
  board.id = 'table-board';

  const numberGrid = document.createElement('div');
  numberGrid.className = 'number-grid';
  const dozenGrid = document.createElement('div');
  dozenGrid.className = 'dozen-grid';
  const outsideGrid = document.createElement('div');
  outsideGrid.className = 'outside-grid';

  const cells = new Map<SpotId, HTMLButtonElement>();
  const stackSig = new Map<string, string>();

  const register = (spot: SpotId, el: HTMLButtonElement) => {
    el.dataset.spot = spot;
    el.addEventListener('click', () => onPlace(spot, el));
    el.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse') return;
      showTip(spot, el);
    });
    el.addEventListener('pointerleave', hideTip);
    el.addEventListener('focus', () => showTip(spot, el));
    el.addEventListener('blur', hideTip);
    cells.set(spot, el);
  };

  const zero = makeButton('green zero', 'n:0');
  register('n:0', zero);

  const doubleZero = makeButton('green zero', 'n:00');
  register('n:00', doubleZero);

  numberGrid.append(zero, doubleZero);

  for (let n = 1; n <= 36; n += 1) {
    const pocket = String(n) as Pocket;
    const spot = `n:${pocket}` as SpotId;
    const color = colorOf(pocket);
    const el = makeButton(`num ${color}`, spot);
    register(spot, el);
    numberGrid.appendChild(el);
  }

  const columns: SpotId[] = ['c3', 'c2', 'c1'];
  for (const spot of columns) {
    const el = makeButton('outside column', spot);
    register(spot, el);
    numberGrid.appendChild(el);
  }

  for (const spot of ['d1', 'd2', 'd3'] as const) {
    const el = makeButton('outside dozen', spot);
    register(spot, el);
    dozenGrid.appendChild(el);
  }

  const outsideSpots: { spot: SpotId; extra?: string }[] = [
    { spot: 'low' },
    { spot: 'even' },
    { spot: 'red', extra: 'red-bet' },
    { spot: 'black', extra: 'black-bet' },
    { spot: 'odd' },
    { spot: 'high' },
  ];
  for (const item of outsideSpots) {
    const el = makeButton(`outside even-money ${item.extra ?? ''}`, item.spot);
    register(item.spot, el);
    outsideGrid.appendChild(el);
  }

  const layoutCells = (portrait: boolean) => {
    board.dataset.layout = portrait ? 'portrait' : 'landscape';
    for (const [spot, el] of cells) {
      const next = tablePlacement(spot, portrait);
      el.style.gridColumn = next.column;
      el.style.gridRow = next.row;
    }
  };

  const portraitQuery = window.matchMedia('(max-width: 720px)');
  const applyLayout = () => layoutCells(portraitQuery.matches);
  applyLayout();
  portraitQuery.addEventListener('change', applyLayout);

  board.append(numberGrid, dozenGrid, outsideGrid);
  scroller.appendChild(board);
  felt.append(head, scroller);
  root.appendChild(felt);

  function relabel(): void {
    title.textContent = t('feltTitle');
    note.textContent = t('feltOdds');
    for (const [spot, el] of cells) {
      const face = el.querySelector<HTMLElement>('.face-label');
      if (face) setFace(face, cellLabel(spot));
    }
  }
  relabel();
  onLocale(relabel);

  const tip = document.getElementById('tooltip');
  let tipSpot: SpotId | null = null;

  function showTip(spot: SpotId, anchor: HTMLElement): void {
    tipSpot = spot;
    positionTip(anchor);
  }

  function hideTip(): void {
    tipSpot = null;
    if (tip) tip.hidden = true;
  }

  function positionTip(anchor: HTMLElement): void {
    if (!tip || !tipSpot) return;
    const stake = Number(anchor.dataset.stake ?? '0');
    tip.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = `${spotTitle(tipSpot)} · ${spotDetail(tipSpot)}`;
    const odds = document.createElement('span');
    odds.className = 'odds';
    odds.textContent = `${describeSpot(tipSpot).odds}:1`;
    tip.append(strong, odds);
    if (stake > 0) {
      const line = document.createElement('span');
      line.textContent = `已下 ${formatChips(stake)}`;
      tip.appendChild(line);
    }
    tip.hidden = false;
    const rect = anchor.getBoundingClientRect();
    const width = tip.offsetWidth;
    const height = tip.offsetHeight;
    let left = rect.left + rect.width / 2 - width / 2;
    let top = rect.top - height - 8;
    if (top < 8) top = rect.bottom + 8;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  scroller.addEventListener('scroll', hideTip, { passive: true });

  return {
    cell: (spot) => cells.get(spot),
    render(state) {
      const locked = state.phase !== 'betting';
      board.classList.toggle('locked', locked);
      banner.hidden = !locked;
      banner.textContent = state.phase === 'settling' ? t('lockSettle') : t('lockSpin');

      const wins = state.phase === 'settling' && state.result ? new Set(winningSpots(state.result)) : null;
      for (const [spot, cell] of cells) {
        const stake = stakeOn(state.placements, spot);
        cell.dataset.stake = String(stake);
        cell.disabled = locked;
        cell.classList.toggle('has-bet', stake > 0);
        cell.classList.toggle('win', Boolean(wins?.has(spot)));
        const lastHit = state.phase !== 'spinning' && state.result !== null && spot === `n:${state.result}`;
        cell.classList.toggle('last-hit', lastHit);
        const copy = describeSpot(spot);
        const name = spotTitle(spot);
        cell.setAttribute(
          'aria-label',
          stake > 0
            ? `${name}, ${copy.odds}:1, ${formatChips(stake)}`
            : `${name}, ${copy.odds}:1`,
        );

        const mine = state.placements.filter((placement) => placement.spot === spot);
        const sig = `${state.phase}|${mine.map((placement) => `${placement.id}:${placement.amount}`).join(',')}|${wins?.has(spot) ? 'w' : ''}`;
        if (stackSig.get(spot) === sig) continue;
        stackSig.set(spot, sig);
        const stack = cell.querySelector('.stack');
        if (!stack) continue;
        const settling = state.phase === 'settling';
        stack.classList.toggle('win', settling && Boolean(wins?.has(spot)) && mine.length > 0);
        stack.classList.toggle('lose', settling && !wins?.has(spot) && mine.length > 0);
        stack.replaceChildren();
        mine.slice(-6).forEach((placement, index) => {
          const chip = document.createElement('span');
          chip.className = 'chip-face stack-chip';
          chip.style.setProperty('--lift', `${index * 4}px`);
          chip.style.zIndex = String(index + 1);
          paintChip(chip, placement.amount as Chip);
          stack.appendChild(chip);
        });
        if (mine.length > 0) {
          const total = document.createElement('span');
          total.className = 'stack-total';
          total.textContent = formatChips(stake);
          stack.appendChild(total);
        }
      }

      if (tipSpot) {
        const anchor = cells.get(tipSpot);
        if (!anchor || locked) hideTip();
        else positionTip(anchor);
      }
    },
  };
}
