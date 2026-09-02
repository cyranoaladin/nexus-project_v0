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
