import {
  CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
  CANDIDATE_DIAGNOSTIC_PRIVACY_NOTICE,
  NOTICE_PENDING_LEGAL_CONSTANTS,
  NOTICE_PER_DOSSIER_VARIABLES,
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
   * Deux constantes légales attendent le juriste : contact vie privée et durée
   * de conservation. Elles font partie du texte consenti, donc les renseigner
   * doit incrémenter la version — ce test échouera alors, et c'est le signal
   * attendu.
   */
  it('signale les constantes légales encore en attente du juriste', () => {
    const text = noticeText();
    const remaining = NOTICE_PENDING_LEGAL_CONSTANTS.filter((placeholder) => text.includes(placeholder));
    expect(remaining.sort()).toEqual([...NOTICE_PENDING_LEGAL_CONSTANTS].sort());
  });

  /**
   * Le nom de l'élève est une variable par dossier, interpolée au moment du
   * consentement de chaque famille. Elle ne fait pas partie du texte légal
   * versionné : la renseigner ne doit jamais incrémenter la version.
   */
  it('garde le nom de l’élève hors des constantes versionnées', () => {
    for (const variable of NOTICE_PER_DOSSIER_VARIABLES) {
      expect(NOTICE_PENDING_LEGAL_CONSTANTS).not.toContain(variable);
    }
    expect(CANDIDATE_DIAGNOSTIC_PRIVACY_NOTICE.parentConsentStatement).toContain('{{ELEVE_NOM}}');
  });
});
