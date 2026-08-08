import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
  CANDIDATE_DIAGNOSTIC_PRIVACY_NOTICE,
  NOTICE_OPEN_QUESTIONS,
  NOTICE_PENDING_LEGAL_CONSTANTS,
} from '@/lib/diagnostics/candidat-libre/privacy-notice';

/**
 * La notice est le fondement du consentement : ce qui est enregistré porte sur
 * une version précise de ce texte. Ces tests protègent sa fidélité et sa
 * couverture, pas sa mise en forme.
 */

function noticeText(): string {
  const { sections, consentStatement } = CANDIDATE_DIAGNOSTIC_PRIVACY_NOTICE;
  return [...sections.flatMap((s) => [s.heading, ...s.body]), consentStatement].join('\n');
}

describe('notice de confidentialité — version adulte', () => {
  it('déclare la version que le consentement enregistrera', () => {
    expect(CANDIDATE_DIAGNOSTIC_PRIVACY_NOTICE.version).toBe(CANDIDATE_DIAGNOSTIC_NOTICE_VERSION);
    expect(CANDIDATE_DIAGNOSTIC_NOTICE_VERSION).toBe('candidat-libre-notice.v2');
  });

  it.each([
    ['le responsable de traitement', /Nexus Réussite/],
    ['le contact vie privée', /contact@nexusreussite\.academy/],
    ['la finalité', /faisabilité/i],
    ['l’absence de décision automatisée', /Aucune décision n’est rendue par une machine/],
    ['l’absence d’IA générative', /sans intelligence artificielle générative/],
    ['les documents officiels', /pièce d’identité|Cyclades/],
    ['l’enregistrement audio', /enregistrement audio/],
    ['la base du consentement', /Sur la base de votre consentement/],
    ['le retrait possible', /retirer à tout moment/],
    ['la conservation d’un an', /une année avant suppression ou anonymisation/],
    ['le chiffrement des documents', /chiffré/],
    ['les droits', /Accès, rectification, effacement/],
  ])('couvre %s', (_label, pattern) => {
    expect(noticeText()).toMatch(pattern);
  });

  /**
   * Régime adulte : le texte ne doit plus parler d'autorité parentale ni
   * d'enfant — c'est l'étudiant qui consent pour lui-même.
   */
  it.each([/autorité parentale/i, /votre enfant/i, /mon enfant/i, /mineur/i])(
    'ne comporte plus la formulation %p',
    (pattern) => {
      expect(noticeText()).not.toMatch(pattern);
    },
  );

  it('n’interpole aucun nom : le texte versionné ne dépend pas du dossier', () => {
    expect(noticeText()).not.toContain('{{ELEVE_NOM}}');
    expect(CANDIDATE_DIAGNOSTIC_PRIVACY_NOTICE.consentStatement).not.toMatch(/\{\{[A-Z_]*NOM[A-Z_]*\}\}/);
  });

  it('garde le consentement à l’IA séparé du consentement principal', () => {
    const { consentStatement, llmConsentStatement } = CANDIDATE_DIAGNOSTIC_PRIVACY_NOTICE;
    expect(llmConsentStatement).not.toBe(consentStatement);
    expect(llmConsentStatement).toMatch(/pseudonymisées/);
    expect(llmConsentStatement).toMatch(/relu par un enseignant/);
    // Il ne fait pas partie du texte principal : il n'est pas recueilli aujourd'hui.
    expect(noticeText()).not.toContain(llmConsentStatement);
  });
});

describe('fidélité au texte fourni', () => {
  const SOURCE = path.join(os.homedir(), 'Téléchargements/NOTICE-confidentialite-candidat-libre-majeur.md');

  /**
   * Le texte est un objet juridique : il vient du responsable et du juriste.
   * Ce test compare les phrases porteuses au fichier source, pour qu'une
   * réécriture silencieuse côté code soit détectée.
   */
  /**
   * Seule normalisation admise : l'apostrophe. Le fichier fourni utilise
   * l'apostrophe droite, le dépôt applique l'apostrophe typographique
   * française. C'est un choix de composition, pas une réécriture — les mots
   * sont identiques.
   */
  const normalize = (value: string) => value.replace(/[’']/g, "'").replace(/\*\*/g, '');

  it('reprend verbatim les phrases porteuses du fichier fourni', () => {
    if (!fs.existsSync(SOURCE)) {
      // Le fichier source n'est pas versionné ; hors du poste du responsable,
      // ce contrôle ne peut pas s'exécuter et n'a pas à faire échouer la suite.
      return;
    }
    const source = normalize(fs.readFileSync(SOURCE, 'utf8'));
    const rendered = normalize(noticeText());
    for (const phrase of [
      "Aucune décision n'est rendue par une machine",
      'sans intelligence artificielle générative',
      'Sur la base de votre consentement',
      'une année avant suppression ou anonymisation',
      'contact@nexusreussite.academy',
      "y compris le dépôt de mes documents officiels et l'enregistrement audio",
    ].map(normalize)) {
      expect(source).toContain(phrase);
      expect(rendered).toContain(phrase);
    }
  });
});

describe('points encore ouverts', () => {
  /**
   * Le contact et la durée, ouverts en v1, sont désormais renseignés. Reste la
   * modalité de partage à un tiers. Ce test échouera dès qu'elle sera comblée —
   * c'est le signal attendu pour incrémenter la version.
   */
  it('signale la modalité de partage à un tiers, encore à préciser', () => {
    const remaining = NOTICE_PENDING_LEGAL_CONSTANTS.filter((c) => noticeText().includes(c));
    expect(remaining).toEqual([...NOTICE_PENDING_LEGAL_CONSTANTS]);
  });

  /**
   * La durée est fixée à un an, mais son point de départ ne l'est pas de façon
   * opérationnelle : impossible d'automatiser une purge sans le trancher.
   */
  it('consigne le point de départ de la conservation comme question ouverte', () => {
    expect(NOTICE_OPEN_QUESTIONS.join(' ')).toMatch(/point de départ/i);
  });
});
