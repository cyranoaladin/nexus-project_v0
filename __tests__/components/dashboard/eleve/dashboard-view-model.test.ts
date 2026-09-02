import {
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
