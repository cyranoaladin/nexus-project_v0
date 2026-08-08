import {
  isStudentAdultAt,
  requiredModuleKeysForDossier,
} from '@/lib/diagnostics/candidat-libre/module-scoping';

/**
 * Portée des modules exigés pour un dossier.
 *
 * Le questionnaire parent recueille l'avis du titulaire de l'autorité
 * parentale. Pour un étudiant majeur, cette autorité n'existe pas : exiger ce
 * module reviendrait à bloquer son dossier sur une pièce qui n'a pas d'objet,
 * et à solliciter un tiers qui n'a aucun rôle légal ici.
 *
 * Le reste des modules demeure exigé : cet étudiant passe le baccalauréat
 * complet, toutes les épreuves académiques le concernent.
 */

const ADULT = new Date('2008-03-15');
const MINOR = new Date('2010-06-01');
const NOW = new Date('2026-08-08');

describe('isStudentAdultAt', () => {
  it('reconnaît un étudiant majeur', () => {
    expect(isStudentAdultAt(ADULT, NOW)).toBe(true);
  });

  it('reconnaît un étudiant mineur', () => {
    expect(isStudentAdultAt(MINOR, NOW)).toBe(false);
  });

  it('traite le jour des dix-huit ans comme la majorité', () => {
    expect(isStudentAdultAt(new Date('2008-08-08'), NOW)).toBe(true);
  });

  it('reste mineur la veille des dix-huit ans', () => {
    expect(isStudentAdultAt(new Date('2008-08-09'), NOW)).toBe(false);
  });

  /** Sans date de naissance, on ne présume pas la majorité. */
  it('échoue fermé quand la date de naissance est inconnue', () => {
    expect(isStudentAdultAt(null, NOW)).toBe(false);
  });
});

describe('requiredModuleKeysForDossier', () => {
  it('n’exige pas le questionnaire parent pour un étudiant majeur', () => {
    const keys = requiredModuleKeysForDossier({ studentIsAdult: true });
    expect(keys).not.toContain('questionnaire-parent');
  });

  it('l’exige toujours pour un étudiant mineur', () => {
    const keys = requiredModuleKeysForDossier({ studentIsAdult: false });
    expect(keys).toContain('questionnaire-parent');
  });

  /** Le bac est complet : aucune matière n'est retirée au motif de la majorité. */
  it.each(['mathematiques', 'nsi', 'ses', 'francais-academique', 'tronc-commun', 'grand-oral'])(
    'exige %s dans les deux cas',
    (moduleKey) => {
      expect(requiredModuleKeysForDossier({ studentIsAdult: true })).toContain(moduleKey);
      expect(requiredModuleKeysForDossier({ studentIsAdult: false })).toContain(moduleKey);
    },
  );

  it('ne retire qu’un seul module pour un majeur', () => {
    const adult = requiredModuleKeysForDossier({ studentIsAdult: true });
    const minor = requiredModuleKeysForDossier({ studentIsAdult: false });
    expect(minor.length - adult.length).toBe(1);
    expect(minor.filter((k) => !adult.includes(k))).toEqual(['questionnaire-parent']);
  });

  it('n’exige aucun module non marqué comme requis', () => {
    const keys = requiredModuleKeysForDossier({ studentIsAdult: true });
    expect(new Set(keys).size).toBe(keys.length);
  });
});
