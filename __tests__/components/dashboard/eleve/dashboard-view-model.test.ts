import {
  resolveDashboardRubrique,
  shouldShowStmgLivret,
} from '@/components/dashboard/eleve/dashboard-view-model';

describe('dashboard view model', () => {
  it('shows the STMG livret from gradeLevel when legacy grade is empty', () => {
    expect(
      shouldShowStmgLivret({
        isStmgTrack: true,
        isSurvivalMode: false,
        grade: '',
        gradeLevel: 'PREMIERE',
      })
    ).toBe(true);
  });
});

describe('dashboard deep links', () => {
  it.each(['bilans', 'sessions', 'stages'] as const)('opens %s from its deep link', (section) => {
    expect(resolveDashboardRubrique(section)).toBe(section);
  });
  it('preserves resources and ignores unknown fragments', () => {
    expect(resolveDashboardRubrique('resources')).toBe('matières');
    expect(resolveDashboardRubrique('aria')).toBe('cockpit');
    expect(resolveDashboardRubrique('programme-maths')).toBe('parcours');
    expect(resolveDashboardRubrique('inconnu')).toBeUndefined();
  });
});
