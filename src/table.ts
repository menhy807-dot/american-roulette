import { paintChip } from './chips.ts';
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

function makeButton(className: string, label: string): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `cell ${className}`;
  const face = document.createElement('span');
  face.className = 'face-label';
  if (label.includes('\n')) {
    const [main, sub] = label.split('\n');
    face.append(document.createTextNode(main ?? ''));
    const small = document.createElement('small');
    small.textContent = sub ?? '';
    face.appendChild(small);
  } else {
    face.textContent = label;
  }
  const stack = document.createElement('span');
  stack.className = 'stack';
  el.append(face, stack);
  return el;
}

export function mountTable(root: HTMLElement, onPlace: (spot: SpotId, cell: HTMLButtonElement) => void): TableController {
  root.replaceChildren();

  const felt = document.createElement('div');
  felt.className = 'felt';

  const head = document.createElement('div');
  head.className = 'felt-head';
  const title = document.createElement('p');
  title.className = 'felt-title';
  title.textContent = '美式赌桌';
  const note = document.createElement('p');
  note.className = 'felt-note';
  note.textContent = '直注 35:1 · 红黑单双大小 1:1 · 打与列 2:1';
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

  const zero = makeButton('green zero', '0');
  register('n:0', zero);

  const doubleZero = makeButton('green zero', '00');
  register('n:00', doubleZero);

  numberGrid.append(zero, doubleZero);

  for (let n = 1; n <= 36; n += 1) {
    const pocket = String(n) as Pocket;
    const spot = `n:${pocket}` as SpotId;
    const color = colorOf(pocket);
    const el = makeButton(`num ${color}`, String(n));
    register(spot, el);
    numberGrid.appendChild(el);
  }

  const columns: { spot: SpotId; label: string }[] = [
    { spot: 'c3', label: '2:1\n第三列' },
    { spot: 'c2', label: '2:1\n第二列' },
    { spot: 'c1', label: '2:1\n第一列' },
  ];
  for (const column of columns) {
    const el = makeButton('outside column', column.label);
    register(column.spot, el);
    numberGrid.appendChild(el);
  }

  const dozenSpots: { spot: SpotId; label: string }[] = [
    { spot: 'd1', label: '第一打\n1–12' },
    { spot: 'd2', label: '第二打\n13–24' },
    { spot: 'd3', label: '第三打\n25–36' },
  ];
  for (const dozen of dozenSpots) {
    const el = makeButton('outside dozen', dozen.label);
    register(dozen.spot, el);
    dozenGrid.appendChild(el);
  }

  const outsideSpots: { spot: SpotId; label: string; extra?: string }[] = [
    { spot: 'low', label: '小\n1–18' },
    { spot: 'even', label: '双' },
    { spot: 'red', label: '红', extra: 'red-bet' },
    { spot: 'black', label: '黑', extra: 'black-bet' },
    { spot: 'odd', label: '单' },
    { spot: 'high', label: '大\n19–36' },
  ];
  for (const item of outsideSpots) {
    const el = makeButton(`outside even-money ${item.extra ?? ''}`, item.label);
    register(item.spot, el);
    outsideGrid.appendChild(el);
  }

  const place = (spot: SpotId, column: string, row: string) => {
    const el = cells.get(spot);
    if (!el) return;
    el.style.gridColumn = column;
    el.style.gridRow = row;
  };

  const layoutCells = (portrait: boolean) => {
    board.dataset.layout = portrait ? 'portrait' : 'landscape';
    if (!portrait) {
      place('n:0', '1', '1 / 4');
      place('n:00', '1', '4 / 7');
      for (let n = 1; n <= 36; n += 1) {
        const column = Math.floor((n - 1) / 3) + 2;
        const mod = n % 3;
        const rowStart = mod === 0 ? 1 : mod === 2 ? 3 : 5;
        place(`n:${String(n)}` as SpotId, String(column), `${rowStart} / ${rowStart + 2}`);
      }
      place('c3', '14', '1 / 3');
      place('c2', '14', '3 / 5');
      place('c1', '14', '5 / 7');
      place('d1', '2 / 6', '1');
      place('d2', '6 / 10', '1');
      place('d3', '10 / 14', '1');
      place('low', '2 / 4', '1');
      place('even', '4 / 6', '1');
      place('red', '6 / 8', '1');
      place('black', '8 / 10', '1');
      place('odd', '10 / 12', '1');
      place('high', '12 / 14', '1');
      return;
    }

    place('n:0', '1 / 4', '1');
    place('n:00', '4 / 7', '1');
    for (let n = 1; n <= 36; n += 1) {
      const street = Math.ceil(n / 3);
      const pos = (n - 1) % 3;
      place(`n:${String(n)}` as SpotId, `${pos * 2 + 1} / ${pos * 2 + 3}`, String(street + 1));
    }
    place('c1', '1 / 3', '14');
    place('c2', '3 / 5', '14');
    place('c3', '5 / 7', '14');
    place('d1', '1 / 3', '1');
    place('d2', '3 / 5', '1');
    place('d3', '5 / 7', '1');
    place('low', '1 / 3', '1');
    place('even', '3 / 5', '1');
    place('red', '5 / 7', '1');
    place('black', '1 / 3', '2');
    place('odd', '3 / 5', '2');
    place('high', '5 / 7', '2');
  };

  const portraitQuery = window.matchMedia('(max-width: 720px)');
  const applyLayout = () => layoutCells(portraitQuery.matches);
  applyLayout();
  portraitQuery.addEventListener('change', applyLayout);

  board.append(numberGrid, dozenGrid, outsideGrid);
  scroller.appendChild(board);
  felt.append(head, scroller);
  root.appendChild(felt);

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
    const copy = describeSpot(tipSpot);
    const stake = Number(anchor.dataset.stake ?? '0');
    tip.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = `${copy.title} · ${copy.detail}`;
    const odds = document.createElement('span');
    odds.className = 'odds';
    odds.textContent = `赔率 ${copy.odds}:1`;
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
      banner.textContent = state.phase === 'settling' ? '结算中' : '本局已封盘';

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
        cell.setAttribute(
          'aria-label',
          stake > 0
            ? `${copy.title}，${copy.odds} 比 1，已下 ${formatChips(stake)}`
            : `${copy.title}，${copy.odds} 比 1`,
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
