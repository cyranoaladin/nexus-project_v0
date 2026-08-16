/**
 * Suspension temporaire des opérations de génération et de relecture des briefs
 * enseignant (hotfix P0).
 *
 * NOTE DE DÉCOMMISSIONNEMENT :
 * Cette constante et cette politique de garde doivent être retirées et nettoyées
 * explicitement lors de la finalisation et du déploiement de la version complète
 * de la PR #156.
 */
export const TEACHER_BRIEF_OPERATIONS_SUSPENDED = true as const;
export const TEACHER_BRIEF_SUSPENSION_CODE = 'TEACHER_BRIEF_OPERATIONS_SUSPENDED' as const;
export const TEACHER_BRIEF_SUSPENSION_MESSAGE =
  'Génération et relecture des briefs temporairement suspendues pour sécurisation.' as const;

export class TeacherBriefOperationsSuspendedError extends Error {
  readonly code = TEACHER_BRIEF_SUSPENSION_CODE;
  constructor(message: string = TEACHER_BRIEF_SUSPENSION_MESSAGE) {
    super(message);
    this.name = 'TeacherBriefOperationsSuspendedError';
  }
}

export function teacherBriefOperationsAreSuspended(): boolean {
  return TEACHER_BRIEF_OPERATIONS_SUSPENDED;
}

export function assertTeacherBriefOperationsEnabled(): void {
  if (TEACHER_BRIEF_OPERATIONS_SUSPENDED) {
    throw new TeacherBriefOperationsSuspendedError();
  }
}
