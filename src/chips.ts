import type { Chip } from './rules.ts';

const STYLE: Record<Chip, { face: string; edge: string; ink: string }> = {
  1: { face: '#f3ead7', edge: '#6e5a38', ink: '#2a2116' },
  5: { face: '#a33b3b', edge: '#f4efe4', ink: '#fff8ee' },
  25: { face: '#1d7a46', edge: '#f4efe4', ink: '#fff8ee' },
  100: { face: '#16181c', edge: '#e0c98a', ink: '#f7f1e6' },
  500: { face: '#6d3a78', edge: '#f4efe4', ink: '#fff8ee' },
};

export function paintChip(el: HTMLElement, amount: Chip): void {
  const style = STYLE[amount];
  el.style.setProperty('--face', style.face);
  el.style.setProperty('--edge', style.edge);
  el.style.setProperty('--ink', style.ink);
  el.replaceChildren();
  const label = document.createElement('span');
  label.className = 'chip-label';
  label.textContent = String(amount);
  el.appendChild(label);
}
