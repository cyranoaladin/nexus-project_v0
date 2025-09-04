import { BilanPremium } from './schema';

export type OfferOverlayResult = { updated: BilanPremium; offerRuleMatched?: string };

export function applyOfferOverlay(input: BilanPremium): OfferOverlayResult {
  let updated: BilanPremium = input;
  let offerRuleMatched: string | undefined;

  try {
    const g = Number(input.academic?.globalPercent ?? 0);
    const auto = (input as any).pedagogue?.autonomie || (input as any).pedago?.autonomie;
    const lowDomains = (input.academic?.scoresByDomain || []).filter(d => (d.percent ?? 0) < 50).length;

    if (input.meta?.statut === 'candidat_libre') {
      updated = {
        ...input,
        offres: {
          primary: 'Odyssée (Candidat Libre)',
          alternatives: ['Flex'],
          reasoning: 'Préparation intensive adaptée au statut candidat libre.'
        }
      } as any;
      offerRuleMatched = 'CANDIDAT_LIBRE_ODYSSEE';
    } else if (g >= 70 && lowDomains <= 1 && (auto === 'bonne')) {
      updated = {
        ...input,
        offres: {
          primary: 'Cortex',
          alternatives: ['Académies'],
          reasoning: 'Autonomie forte et maîtrise globale élevée — programme Cortex recommandé.'
        }
      } as any;
      offerRuleMatched = 'CORTEX_HIGH_PERF';
    } else if (lowDomains >= 2) {
      // Default targeted studio when multiple axes below 50%
      updated = {
        ...input,
        offres: {
          ...(input.offres || {} as any),
          primary: (input.offres?.primary || 'Studio Flex'),
          reasoning: (input.offres?.reasoning || 'Plusieurs axes <50% — approche ciblée Studio Flex recommandée.'),
        }
      } as any;
      offerRuleMatched = 'STUDIO_FLEX_TARGETED';
    }
  } catch {
    // ignore overlay failures
  }

  return { updated, offerRuleMatched };
}

