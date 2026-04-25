import type { SurvivalState } from '@/lib/survival/types';

export function survivalStatusLabel(state?: SurvivalState | string) {
  if (state === 'ACQUIS') return 'Acquis';
  if (state === 'REVOIR') return 'A revoir';
  return 'Pas vu';
}

export function survivalStatusClass(state?: SurvivalState | string) {
  if (state === 'ACQUIS') return 'border-success/40 bg-success/10 text-success';
  if (state === 'REVOIR') return 'border-warning/40 bg-warning/10 text-warning';
  return 'border-white/10 bg-white/5 text-neutral-300';
}

export function survivalStatusIcon(state?: SurvivalState | string) {
  if (state === 'ACQUIS') return '✓';
  if (state === 'REVOIR') return '⏳';
  return '○';
}
