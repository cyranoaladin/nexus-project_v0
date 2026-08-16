/**
 * Marqueur permanent de sûreté pour les briefs du dossier enseignant (fail-closed).
 *
 * RAISON ARCHITECTURALE :
 * La suspension des opérations de brief LLM (hotfix P0 temporaire) sera
 * décommissionnée lorsque le workflow complet de relecture sera prêt.
 * En revanche, le garde de sûreté du dossier enseignant (brief APPROVED +
 * snapshot de score courant + contenu valide) est un mécanisme PERMANENT de
 * défense en profondeur.
 *
 * Découpler ce marqueur du module de suspension garantit que le retrait ultérieur
 * de la suspension ne pourra jamais affaiblir ou supprimer le contrôle de sûreté
 * du rendu du dossier enseignant.
 */
export const APPROVED_BRIEF_SAFETY_MARKER = 'APPROVED_AND_CURRENT_VERIFIED' as const;
export type ApprovedBriefSafetyMarker = typeof APPROVED_BRIEF_SAFETY_MARKER;

export const TEACHER_DOSSIER_UNSAFE_BRIEF_RENDER_BLOCKED =
  'TEACHER_DOSSIER_UNSAFE_BRIEF_RENDER_BLOCKED' as const;

export class TeacherDossierUnsafeBriefRenderError extends Error {
  readonly code = TEACHER_DOSSIER_UNSAFE_BRIEF_RENDER_BLOCKED;
  constructor(message: string = TEACHER_DOSSIER_UNSAFE_BRIEF_RENDER_BLOCKED) {
    super(message);
    this.name = 'TeacherDossierUnsafeBriefRenderError';
  }
}

export function assertValidTeacherDossierStudentBrief(student: {
  brief: unknown | null;
  briefSafetyMarker?: ApprovedBriefSafetyMarker;
}): void {
  if (student.brief !== null && student.briefSafetyMarker !== APPROVED_BRIEF_SAFETY_MARKER) {
    throw new TeacherDossierUnsafeBriefRenderError();
  }
}
