import {
  buildAriaSubjectLinks,
  shouldShowStmgLivret,
} from '@/components/dashboard/eleve/dashboard-view-model';
import type { EleveTrackItem } from '@/components/dashboard/eleve/types';

const stmgModules: EleveTrackItem[] = [
  {
    module: 'MATHS_STMG',
    label: 'Mathématiques STMG',
    skillGraphRef: 'maths_premiere_stmg',
    progress: {
      totalXp: 0,
      completedChapters: [],
      masteredChapters: [],
      totalChaptersInProgram: 8,
      bestCombo: 0,
      streak: 0,
    },
  },
  {
    module: 'SGN',
    label: 'Sciences de gestion et numérique',
    skillGraphRef: 'sgn_premiere_stmg',
    progress: {
      totalXp: 0,
      completedChapters: [],
      masteredChapters: [],
      totalChaptersInProgram: 6,
      bestCombo: 0,
      streak: 0,
    },
  },
];

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

  it('builds ARIA subject links from STMG modules instead of empty specialties', () => {
    const links = buildAriaSubjectLinks({
      isStmgTrack: true,
      specialties: [],
      stmgModules,
    });

    expect(links).toEqual([
      { value: 'MATHS_STMG', label: 'Mathématiques STMG', color: 'text-orange-300' },
      { value: 'SGN', label: 'Sciences de gestion et numérique', color: 'text-emerald-300' },
    ]);
  });
});
