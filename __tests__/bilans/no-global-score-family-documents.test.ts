import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';
import { renderDeterministicBilanHtml } from '@/lib/bilans/render/html';
import type { RenderIdentity } from '@/lib/bilans/render/render-identity';
import { buildPreRentreeStageLabel } from '@/lib/bilans/render/stage-label';

/**
 * Décision produit du 2026-08-12 : du concret chiffré côté familles
 * (couverture, calibration, répartition, réussite par domaine), mais JAMAIS
 * une note. Ce test verrouille l'interdit : le score global ne doit
 * apparaître sous aucune forme dans les documents élève et parents.
 */

const identity: RenderIdentity = {
  displayName: 'ELEVE_SCOREGLOBAL',
  level: 'SECONDE',
  subject: 'MATHS',
  date: '2026-08-12',
  stageLabel: buildPreRentreeStageLabel('SECONDE', 'MATHS'),
};

// globalScore choisi pour n'entrer en collision avec AUCUN autre chiffre du
// document : ni un score de domaine, ni la couverture, ni la calibration,
// ni un compte de domaines, ni une durée de séance.
const SENTINEL_GLOBAL_SCORE = 61;

const factSheet: FactSheet = Object.freeze({
  engineVersion: '1.0.1',
  bankSlug: 'entree-seconde-maths-v1',
  bankVersion: 1,
  student: Object.freeze({ alias: 'ELEVE_SCOREGLOBAL', level: 'SECONDE' }),
  globalScore: SENTINEL_GLOBAL_SCORE,
  coverage: 88,
  calibrationIndex: 72,
  domains: Object.freeze([
    Object.freeze({ id: 'calcul-numerique', score: 25, profile: 'ERREUR_CONFIANTE' as const }),
    Object.freeze({ id: 'fractions', score: 90, profile: 'MAITRISE' as const }),
    Object.freeze({ id: 'equations', score: 40, profile: 'LACUNE_CONSCIENTE' as const }),
    Object.freeze({ id: 'geometrie', score: 75, profile: 'MAITRISE_FRAGILE' as const }),
  ]),
  nodes: Object.freeze([]),
  flags: Object.freeze([]),
  groupBand: 'CONSOLIDATION_STANDARD' as const,
});

function visibleText(html: string): string {
  return html
    .replace(/<style>[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ');
}

describe('Aucun score global côté familles — jamais une note', () => {
  it.each(['ELEVE', 'PARENTS'] as const)('le document %s affiche les chiffres autorisés mais jamais le score global', (audience) => {
    const html = renderDeterministicBilanHtml(factSheet, audience, identity);
    const text = visibleText(html);

    // Autorisé : calibration, couverture, réussites par domaine, comptes.
    expect(text).toContain('72');
    expect(text).toContain('88');
    expect(text).toContain('90');
    expect(text).toContain('25');

    // Interdit : le score global, sous toute forme.
    expect(text).not.toContain(String(SENTINEL_GLOBAL_SCORE));
    expect(text).not.toMatch(/\b\d{1,3}\s*\/\s*(20|100)\b/);
    // « Aucune note, aucun classement » (dénégation voulue) reste licite :
    // seuls le mot « score », « moyenne » et toute note affirmative sont bannis.
    expect(text).not.toMatch(/\bscore\b|\bmoyenne\b|note globale|note de \d|noté/i);
  });

  it('le document interne Nexus conserve, lui, le score global', () => {
    const html = renderDeterministicBilanHtml(factSheet, 'NEXUS', identity);
    expect(visibleText(html)).toContain(String(SENTINEL_GLOBAL_SCORE));
  });

  it('la répartition par profil est chiffrée en compte et en proportion', () => {
    const html = renderDeterministicBilanHtml(factSheet, 'PARENTS', identity);
    const text = visibleText(html);
    expect(text).toMatch(/1[\s ]*domaine solide/);
    expect(text).toContain('(25');
  });
});
