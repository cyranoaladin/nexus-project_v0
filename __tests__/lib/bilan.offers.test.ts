import { applyOfferOverlay } from '@/apps/web/server/bilan/offers';
import type { BilanPremium } from '@/apps/web/server/bilan/schema';

describe('apps/web/server/bilan/offers.applyOfferOverlay', () => {
  const base: BilanPremium = {
    meta: { variant: 'eleve', matiere: 'NSI', niveau: 'Terminale', statut: 'fr', createdAtISO: new Date().toISOString() },
    eleve: { firstName: 'A', lastName: 'B' },
    academic: { globalPercent: 60, scoresByDomain: [{ domain: 'Algorithmes', percent: 40 }, { domain: 'Python', percent: 55 }], forces: [], faiblesses: [], lacunesCritiques: [] },
    pedagogue: { style: 'Visuel', autonomie: 'moyenne', organisation: 'moyenne', stress: 'moyen', flags: [] },
    plan: { horizonMois: 3, hebdoHeures: 2, etapes: ['x'] },
    offres: { primary: 'Flex', alternatives: [], reasoning: 'init' },
    rag: { citations: [] },
  };

  it('matches CANDIDAT_LIBRE_ODYSSEE rule', () => {
    const input = { ...base, meta: { ...base.meta, statut: 'candidat_libre' } } as BilanPremium;
    const { updated, offerRuleMatched } = applyOfferOverlay(input);
    expect(offerRuleMatched).toBe('CANDIDAT_LIBRE_ODYSSEE');
    expect(updated.offres.primary).toContain('Odyssée');
  });

  it('matches CORTEX_HIGH_PERF rule for high performance and good autonomy', () => {
    const input = { ...base, academic: { ...base.academic, globalPercent: 75, scoresByDomain: [{ domain: 'Algorithmes', percent: 80 }] }, pedagogue: { ...base.pedagogue, autonomie: 'bonne' } } as any;
    const { updated, offerRuleMatched } = applyOfferOverlay(input);
    expect(offerRuleMatched).toBe('CORTEX_HIGH_PERF');
    expect(updated.offres.primary).toBe('Cortex');
  });

  it('matches STUDIO_FLEX_TARGETED when >=2 domains below 50%', () => {
    const input = { ...base, academic: { ...base.academic, scoresByDomain: [{ domain: 'Algorithmes', percent: 40 }, { domain: 'Python', percent: 45 }, { domain: 'Graphes', percent: 80 }] } } as any;
    const { updated, offerRuleMatched } = applyOfferOverlay(input);
    expect(offerRuleMatched).toBe('STUDIO_FLEX_TARGETED');
    expect(updated.offres.primary).toBe('Flex');
  });
});

