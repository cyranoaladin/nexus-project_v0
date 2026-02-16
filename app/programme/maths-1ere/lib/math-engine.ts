'use client';

import { ComputeEngine } from '@cortex-js/compute-engine';

function normalizeExpression(expr: string): string {
  return expr
    .trim()
    .replace(/\$/g, '')
    .replace(/\\,/g, '.')
    .replace(/,/g, '.')
    .replace(/\s+/g, '')
    .replace(/\\cdot/g, '*')
    .replace(/\\times/g, '*')
    .replace(/([0-9])([a-zA-Z(])/g, '$1*$2')
    .replace(/([a-zA-Z)])([0-9(])/g, '$1*$2');
}

export function areEquivalentAnswers(studentAnswer: string, expectedAnswer: string): boolean {
  const lhs = normalizeExpression(studentAnswer);
  const rhs = normalizeExpression(expectedAnswer);

  if (!lhs || !rhs) return false;
  if (lhs === rhs) return true;
  // Removed: star-stripping shortcut was too permissive (e.g. 2*10 === 210)

  try {
    const ce = new ComputeEngine();
    const lhsExpr = ce.parse(lhs).canonical;
    const rhsExpr = ce.parse(rhs).canonical;

    if (lhsExpr.isSame(rhsExpr)) return true;

    const numericDiff = ce.box(['Subtract', lhsExpr, rhsExpr]).N().valueOf();
    return typeof numericDiff === 'number' && Number.isFinite(numericDiff) && Math.abs(numericDiff) < 1e-9;
  } catch {
    return false;
  }
}

export function generateExerciseRandomInt(min: number, max: number, rng: () => number = Math.random): number {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  const roll = rng();
  const safeRoll = Number.isFinite(roll) ? Math.min(Math.max(roll, 0), 0.999999999999) : 0;
  return Math.floor(safeRoll * (hi - lo + 1)) + lo;
}

export function generateExerciseRandomFloat(
  min: number,
  max: number,
  decimals = 2,
  rng: () => number = Math.random
): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const roll = rng();
  const safeRoll = Number.isFinite(roll) ? Math.min(Math.max(roll, 0), 0.999999999999) : 0;
  const value = lo + safeRoll * (hi - lo);
  const factor = Math.pow(10, Math.max(0, decimals));
  return Math.round(value * factor) / factor;
}
