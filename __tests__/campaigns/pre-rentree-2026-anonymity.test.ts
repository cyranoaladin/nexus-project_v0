/**
 * Anonymat total des enseignants (Volet 1 + Volet 2) : les intervenants n'apparaissent
 * jamais nommément, uniquement via des rôles abstraits (A/C/D/E) ou des libellés
 * génériques ("Enseignant de Mathématiques", etc.).
 */
import campaignManifest from '@/data/campaigns/pre-rentree-2026.json';
import modulesData from '@/content/pre-rentree-2026/modules.json';
import parentGuideData from '@/content/pre-rentree-2026/parent-guide.fr.json';
import pedagogyFrameworkData from '@/content/pre-rentree-2026/pedagogy-framework.fr.json';

/** Titres de civilité suivis d'une majuscule : signature quasi systématique d'un nom propre. */
const CIVILITY_NAME_PATTERN = /\b(?:M\.|Mme|Mlle|Professeur|Prof\.)\s+[A-ZÀ-Ý]/;

function assertNoNames(label: string, payload: unknown) {
  const text = JSON.stringify(payload);
  expect(text).not.toMatch(CIVILITY_NAME_PATTERN);
}

describe('Pré-rentrée 2026 — anonymat des enseignants (aucun nom propre)', () => {
  it('les 4 rôles enseignants sont strictement abstraits (A/C/D/E), jamais assignés', () => {
    const teacherRoles = campaignManifest.teacherRoles as Record<string, { assigned: boolean }>;
    expect(Object.keys(teacherRoles).sort()).toEqual([
      'TEACHER_A_MATHS_NSI',
      'TEACHER_C_FRANCAIS',
      'TEACHER_D_PHYSIQUE_CHIMIE',
      'TEACHER_E_SVT',
    ]);
    expect(Object.keys(teacherRoles).every((role) => /^TEACHER_[A-Z]_[A-Z_]+$/.test(role))).toBe(true);
    expect(Object.values(teacherRoles).every((role) => role.assigned === false)).toBe(true);
  });

  it('aucun créneau de la grille ne référence autre chose qu\'un rôle enseignant abstrait', () => {
    const windows = campaignManifest.schedule as unknown as Array<{ slots: Array<{ teacherRole: string }> }>;
    const roleIds = new Set(Object.keys(campaignManifest.teacherRoles));
    for (const window of windows) {
      for (const slot of window.slots) {
        expect(roleIds.has(slot.teacherRole)).toBe(true);
      }
    }
  });

  it('ne contient aucun nom propre précédé d\'une civilité dans les données de campagne, modules ou pédagogie', () => {
    assertNoNames('campaign', campaignManifest);
    assertNoNames('modules', modulesData);
    assertNoNames('parent-guide', parentGuideData);
    assertNoNames('pedagogy-framework', pedagogyFrameworkData);
  });

  it('operationalGates documente honnêtement que les affectations ne sont pas validées', () => {
    expect(campaignManifest.operationalGates.teacherAssignmentsValidated).toBe(false);
  });
});
