import { describe, it, expect } from 'vitest';
import { mapPremiumToTexView } from './orchestrator';
import type { BilanPremium } from './schema';

function makeBase(overrides: Partial<BilanPremium> = {}): BilanPremium {
  const base: BilanPremium = {
    meta: { variant: 'parent', matiere: 'NSI', niveau: 'Terminale', statut: 'fr', createdAtISO: new Date().toISOString() },
    eleve: { firstName: 'Élève', lastName: 'Test', etab: 'Lycée' },
    academic: {
      globalPercent: 65,
      scoresByDomain: [
        { domain: 'Graphes', percent: 42 },
        { domain: 'Python', percent: 70 },
        { domain: 'Algorithmes', percent: 55 },
      ],
      forces: [], faiblesses: [], lacunesCritiques: []
    },
    pedagogue: { style: 'Visuel', autonomie: 'moyenne', organisation: 'moyenne', stress: 'moyen', flags: [] },
    plan: { horizonMois: 3, hebdoHeures: 2, etapes: ['S1', 'S2', 'S3'] },
    offres: { primary: 'Flex', alternatives: [], reasoning: 'ok' },
    rag: { citations: [] },
  };
  return { ...base, ...overrides } as BilanPremium;
}

describe('mapPremiumToTexView', () => {
  it('orders radar axes for NSI according to known order', () => {
    const d = makeBase();
    const view = mapPremiumToTexView(d);
    const labels = view.qcm.domains.map(d => d.label);
    expect(labels[0]).toContain('Algorithmes'); // First according to preferOrder
    expect(labels[1]).toContain('Python');
  });

  it('keeps given order when domains are unknown to preferOrder', () => {
    const d = makeBase();
    // Domains not present in preferOrder for NSI to ensure stable ordering
    (d as any).academic.scoresByDomain = [
      { domain: 'Zeta', percent: 10 },
      { domain: 'Alpha', percent: 20 },
      { domain: 'Omega', percent: 30 },
    ];
    const view = mapPremiumToTexView(d);
    const labels = view.qcm.domains.map(d => d.label);
    expect(labels[0]).toContain('Zeta');
    expect(labels[1]).toContain('Alpha');
    expect(labels[2]).toContain('Omega');
  });

  it('maps timeline phases C/D/T with S1..S8 labels', () => {
    const d = makeBase();
    (d as any).plan.phases = ['Consolidation','Approfondissement','Entrainement','Consolidation','Entrainement','Consolidation','Approfondissement','Entrainement'];
    d.plan.etapes = ['E1','E2','E3','E4','E5','E6','E7','E8'];
    const view = mapPremiumToTexView(d);
    expect(view.timeline_rows.length).toBe(8);
    expect(view.timeline_rows[0].week).toBe('S1');
    expect(view.timeline_rows[7].week).toBe('S8');
    // Ensure C/D/T coordinates include ones
    expect(view.timeline.c).toMatch(/\(S1,1\)/);
    expect(view.timeline.d).toMatch(/\(S2,1\)/);
    expect(view.timeline.t).toMatch(/\(S3,1\)/);
  });
});

