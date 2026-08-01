import { buildValidatedPack } from '@/lib/bilans/validators/contracts';
import { validateAgentBundle } from '@/lib/bilans/validators';

const pack = buildValidatedPack({
  slug: 'maths-terminale-v1',
  version: 1,
  status: 'VALIDATED',
  review: { validatedBy: 'ENSEIGNANT_MATHS', validatedAt: '2026-08-01T09:00:00.000Z' },
  scoring: { domains: ['analyse', 'algebre'] },
  reporting: {
    promptFiles: {
      preAnalysis: { path: 'content/bilans/prompts/pre.md', checksum: 'a'.repeat(64) },
      eleve: { path: 'content/bilans/prompts/eleve.md', checksum: 'b'.repeat(64) },
      parents: { path: 'content/bilans/prompts/parents.md', checksum: 'c'.repeat(64) },
      nexus: { path: 'content/bilans/prompts/nexus.md', checksum: 'd'.repeat(64) },
      verifier: { path: 'content/bilans/prompts/verifier.md', checksum: 'e'.repeat(64) },
    },
  },
  validation: { lexiconPath: 'data/bilans/lexique-interdit.json', forbidDigits: ['eleve', 'parents'] },
});

const factSheet = {
  domains: [
    { id: 'analyse', score: 42, profile: 'ERREUR_CONFIANTE' },
    { id: 'algebre', score: 78, profile: 'MAITRISE' },
  ],
};

const validBundle = {
  preAnalysis: { synthese: 'Une synthèse sobre.', forcesPercues: ['Persévérance'], craintes: [] },
  eleve: {
    accroche: 'Ton travail montre des appuis utiles.',
    forces: ['Analyse : une démarche engagée.', 'Algèbre : des acquis mobilisables.', 'Une méthode régulière.'],
    priorites: [
      { domainId: 'analyse', titre: 'Analyse', pourquoi: 'Stabiliser les démarches.', comment: 'Reprendre les raisonnements.' },
      { domainId: 'algebre', titre: 'Algèbre', pourquoi: 'Consolider les acquis.', comment: 'Varier les exercices.' },
    ],
    microPlan: [{ action: 'Revoir les raisonnements.', dureeMin: 20 }],
    motDeFin: 'Le travail sera progressif et structuré.',
  },
  parents: {
    cadre: 'La passation met en évidence un profil cohérent.',
    pointsAppui: [
      { domainId: 'algebre', texte: 'Algèbre : des acquis mobilisables.' },
      { domainId: 'analyse', texte: 'Analyse : un engagement à structurer.' },
    ],
    priorites: [
      { domainId: 'analyse', titre: 'Analyse', ceQuiSeraFait: 'Les démarches seront reprises.' },
      { domainId: 'algebre', titre: 'Algèbre', ceQuiSeraFait: 'Les acquis seront consolidés.' },
    ],
    etapeSuivante: { texte: 'Un échange permettra de préciser le parcours.', cta: 'Être conseillé' },
  },
  nexus: {
    syntheseProfil: 'Profil synthétique.',
    diagnosticPedagogique: 'Analyse interne factuelle.',
    planQuatreSemaines: 'Plan interne.',
    alertes: [],
    ragReferences: [],
  },
  verifier: { ok: true, violations: [] },
};

function rules(bundle: unknown) {
  return validateAgentBundle({ bundle, factSheet, pack }).map(({ rule }) => rule);
}

describe('deterministic bilan validators V1-V7', () => {
  it('accepts a valid bundle', () => expect(rules(validBundle)).toEqual([]));
  it('V1 rejects an unknown schema key', () => expect(rules({ ...validBundle, extra: true })).toContain('V1'));
  it('V2 rejects digits in parent prose', () => expect(rules({
    ...validBundle,
    parents: { ...validBundle.parents, cadre: 'Résultat 12 sur 20.' },
  })).toContain('V2'));
  it('V3 rejects the canonical forbidden lexicon', () => expect(rules({
    ...validBundle,
    eleve: { ...validBundle.eleve, motDeFin: 'Résultats garantis.' },
  })).toContain('V3'));
  it('V4 rejects a missing evaluated domain', () => expect(rules({
    ...validBundle,
    eleve: { ...validBundle.eleve, priorites: validBundle.eleve.priorites.filter(({ domainId }) => domainId !== 'analyse') },
    parents: {
      ...validBundle.parents,
      pointsAppui: validBundle.parents.pointsAppui.filter(({ domainId }) => domainId !== 'analyse'),
      priorites: validBundle.parents.priorites.filter(({ domainId }) => domainId !== 'analyse'),
    },
  })).toContain('V4'));
  it('V5 rejects plural student markers', () => expect(rules({
    ...validBundle,
    parents: { ...validBundle.parents, cadre: 'Les élèves disposent de points d’appui.' },
  })).toContain('V5'));
  it('V6 rejects PII', () => expect(rules({
    ...validBundle,
    parents: { ...validBundle.parents, cadre: 'Contact: eleve.synthetic@example.invalid' },
  })).toContain('V6'));
  it('V7 rejects an unapproved CTA', () => expect(rules({
    ...validBundle,
    parents: { ...validBundle.parents, etapeSuivante: { ...validBundle.parents.etapeSuivante, cta: 'Acheter maintenant' } },
  })).toContain('V7'));
});
