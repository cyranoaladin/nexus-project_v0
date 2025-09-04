import { describe, it, expect } from 'vitest';
import { applyOfferOverlay } from './offers';
import type { BilanPremium } from './schema';

function make(base: Partial<BilanPremium> = {}): BilanPremium {
  const now = new Date().toISOString();
  return {
    meta: { variant: 'parent', matiere: 'NSI', niveau: 'Terminale', statut: 'fr', createdAtISO: now },
    eleve: { firstName: 'A', lastName: 'B', etab: 'C' },
    academic: { globalPercent: 70, scoresByDomain: [{ domain: 'Algorithmes', percent: 80 }], forces: [], faiblesses: [], lacunesCritiques: [] },
    pedagogue: { style: 'Visuel', autonomie: 'bonne', organisation: 'moyenne', stress: 'moyen', flags: [] },
    plan: { horizonMois: 3, hebdoHeures: 2, etapes: ['E1'] },
    offres: { primary: 'Flex', alternatives: [], reasoning: 'ok' },
    rag: { citations: [] },
    ...(base as any),
  } as BilanPremium;
}

describe('recommendOffer overlay', () => {
  it('candidat_libre => Odyssée', () => {
    const d = make({ meta: { ...make().meta, statut: 'candidat_libre' } } as any);
    const r = applyOfferOverlay(d);
    expect(r.offerRuleMatched).toBe('CANDIDAT_LIBRE_ODYSSEE');
    expect(r.updated.offres.primary).toMatch(/Odyssée/);
  });

  it('69% => no Cortex; 70% + autonomie bonne + <=1 low domain => Cortex', () => {
    const d69 = make({ academic: { ...make().academic, globalPercent: 69 } } as any);
    const r69 = applyOfferOverlay(d69);
    expect(r69.offerRuleMatched).toBeUndefined();

    const d70 = make({ academic: { ...make().academic, globalPercent: 70, scoresByDomain: [{ domain: 'Algorithmes', percent: 75 }, { domain: 'Graphes', percent: 52 }] } } as any);
    const r70 = applyOfferOverlay(d70);
    expect(r70.offerRuleMatched).toBe('CORTEX_HIGH_PERF');
    expect(r70.updated.offres.primary).toBe('Cortex');
  });

  it('>=2 domaines <50% => Studio Flex targeted', () => {
    const d = make({ academic: { ...make().academic, scoresByDomain: [ { domain: 'A', percent: 49 }, { domain: 'B', percent: 48 }, { domain: 'C', percent: 60 } ] } } as any);
    const r = applyOfferOverlay(d);
    expect(r.offerRuleMatched).toBe('STUDIO_FLEX_TARGETED');
    expect(r.updated.offres.primary).toBeTruthy();
  });
});

