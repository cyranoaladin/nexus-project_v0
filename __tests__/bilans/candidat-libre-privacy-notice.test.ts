import {
  CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
  CANDIDATE_DIAGNOSTIC_PRIVACY_NOTICE,
  NOTICE_PENDING_PLACEHOLDERS,
} from '@/lib/diagnostics/candidat-libre/privacy-notice';

/**
 * La notice est le fondement du consentement : le consentement enregistré porte
 * sur une version précise de ce texte. Ces tests protègent trois choses que le
 * code seul ne garantit pas.
 */

function noticeText(): string {
  const { sections, parentConsentStatement, studentAssentStatement } = CANDIDATE_DIAGNOSTIC_PRIVACY_NOTICE;
  return [
    ...sections.flatMap((section) => [section.heading, ...section.body]),
    parentConsentStatement,
    studentAssentStatement,
  ].join('\n');
}

describe('notice de confidentialité candidat libre', () => {
  it('déclare la version que le consentement enregistrera', () => {
    expect(CANDIDATE_DIAGNOSTIC_PRIVACY_NOTICE.version).toBe(CANDIDATE_DIAGNOSTIC_NOTICE_VERSION);
    expect(CANDIDATE_DIAGNOSTIC_NOTICE_VERSION).toMatch(/^candidat-libre-notice\.v\d+$/);
  });

  it.each([
    ['le responsable de traitement', /Nexus Réussite/],
    ['la finalité', /faisabilité/i],
    ['l’absence de décision automatisée', /pas .*décision automatisée/i],
    ['l’absence d’IA générative', /sans intelligence artificielle générative/i],
    ['les documents officiels', /pièce d’identité|Cyclades/i],
    ['l’enregistrement audio', /enregistrement audio/i],
    ['la base légale du consentement', /consentement/i],
    ['l’autorité parentale', /autorité parentale/i],
    ['le retrait possible', /retirer ce consentement à tout moment/i],
    ['la conservation', /conserv/i],
    ['le chiffrement des documents', /chiffré/i],
    ['les droits', /accès.*rectification.*effacement/i],
  ])('couvre %s', (_label, pattern) => {
    expect(noticeText()).toMatch(pattern);
  });

  it('recueille un assentiment de l’élève distinct du consentement parental', () => {
    const { parentConsentStatement, studentAssentStatement } = CANDIDATE_DIAGNOSTIC_PRIVACY_NOTICE;
    expect(studentAssentStatement).not.toBe(parentConsentStatement);
    expect(studentAssentStatement.length).toBeLessThan(parentConsentStatement.length);
  });

  /**
   * Trois emplacements attendent une validation juridique : contact vie privée,
   * durée de conservation, et le nom de l'élève injecté au rendu. Ils sont
   * laissés explicites plutôt que comblés par une valeur inventée. Ce test
   * échouera dès qu'ils seront renseignés — ce qui est le signal attendu pour
   * incrémenter la version de la notice, puisque le texte consenti aura changé.
   */
  it('signale les emplacements encore en attente de validation juridique', () => {
    const text = noticeText();
    const remaining = NOTICE_PENDING_PLACEHOLDERS.filter((placeholder) => text.includes(placeholder));
    expect(remaining.sort()).toEqual([...NOTICE_PENDING_PLACEHOLDERS].sort());
  });
});
