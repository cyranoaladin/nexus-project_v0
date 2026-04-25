import type { SurvivalState } from '@/lib/survival/types';

export function survivalStatusLabel(state?: SurvivalState | string) {
  if (state === 'ACQUIS') return 'Acquis';
  if (state === 'REVOIR') return 'À revoir';
  return 'Pas vu';
}

export function survivalStatusClass(state?: SurvivalState | string) {
  if (state === 'ACQUIS') return 'border-eaf-teal/40 bg-eaf-teal/10 text-eaf-teal';
  if (state === 'REVOIR') return 'border-eaf-amber/40 bg-eaf-amber/10 text-eaf-amber';
  return 'border-eaf-indigo/20 bg-eaf-indigo/10 text-eaf-text-tertiary';
}

export function survivalStatusIcon(state?: SurvivalState | string) {
  if (state === 'ACQUIS') return '✓';
  if (state === 'REVOIR') return '⏳';
  return '○';
}
