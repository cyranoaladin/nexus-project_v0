import type { GradeLevel } from '@prisma/client';

export function shouldShowStmgLivret(input: {
  isStmgTrack: boolean;
  isSurvivalMode: boolean;
  grade?: string | null;
  gradeLevel?: GradeLevel | string | null;
}): boolean {
  return (
    input.isStmgTrack &&
    !input.isSurvivalMode &&
    (input.gradeLevel === 'PREMIERE' || input.grade === 'PREMIERE')
  );
}

export function shouldShowEdsParcours(input: {
  isStmgTrack: boolean;
  grade?: string | null;
  gradeLevel?: GradeLevel | string | null;
}): boolean {
  const level = input.gradeLevel ?? input.grade;
  return !input.isStmgTrack && (level === 'PREMIERE' || level === 'TERMINALE');
}
export type DashboardRubrique = 'cockpit' | 'eam' | 'parcours' | 'sessions' | 'matières' | 'bilans' | 'stages';

export function resolveDashboardRubrique(hash: string): DashboardRubrique | undefined {
  const sections: Partial<Record<string, DashboardRubrique>> = {
    aria: 'cockpit',
    'programme-maths': 'parcours',
    resources: 'matières',
    survival: 'parcours',
    trajectory: 'parcours',
    bilans: 'bilans',
    sessions: 'sessions',
    stages: 'stages',
  };
  return sections[hash];
}
