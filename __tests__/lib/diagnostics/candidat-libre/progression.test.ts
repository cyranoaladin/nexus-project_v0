import { computeCompletionPercentage, resolveModuleAvailability } from '@/lib/diagnostics/candidat-libre/progression';
import type { DiagnosticModuleView } from '@/lib/diagnostics/candidat-libre/types';

function view(key: string, status: DiagnosticModuleView['status'], submittedAt?: string): DiagnosticModuleView {
  return { key, status, progress: status === 'REVIEWED' ? 100 : 0, submittedAt };
}

describe('candidate diagnostic progression', () => {
  it('locks a module until prerequisites are complete', () => {
    const result = resolveModuleAvailability('profil-parcours', [view('accueil-integrite', 'IN_PROGRESS')]);
    expect(result.available).toBe(false);
  });

  it('opens profile after integrity module submission', () => {
    const result = resolveModuleAvailability('profil-parcours', [view('accueil-integrite', 'AUTO_SCORED', new Date().toISOString())]);
    expect(result.available).toBe(true);
  });

  it('sets a delayed availability for the retention module', () => {
    const now = new Date('2026-08-05T10:00:00.000Z');
    const result = resolveModuleAvailability('retention-transfert', [view('potentiel-t1', 'AUTO_SCORED', now.toISOString())], now);
    expect(result.available).toBe(false);
    expect(result.availableAt?.toISOString()).toBe('2026-08-08T10:00:00.000Z');
  });

  it('computes progress over all required audiences', () => {
    expect(computeCompletionPercentage([view('accueil-integrite', 'AUTO_SCORED')])).toBeGreaterThan(0);
    expect(computeCompletionPercentage([])).toBe(0);
  });
});
