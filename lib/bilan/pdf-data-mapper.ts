// lib/bilan/pdf-data-mapper.ts
import { BilanPdfData } from './types';

export function toPdfData(bilan: any): BilanPdfData {
  const qcmScores = (bilan?.qcmScores as any) || { byDomain: {} };
  const byDomain = qcmScores.byDomain || {};
  const scoresByDomain = Object.keys(byDomain).map((k) => ({ domain: k, percent: byDomain[k].percent ?? 0 }));
  const synthesis = (bilan?.synthesis as any) || { forces: [], faiblesses: [], feuilleDeRoute: [] };
  const offers = (bilan?.offers as any) || { primary: '', alternatives: [], reasoning: '' };

  return {
    eleve: {
      firstName: bilan?.student?.user?.firstName,
      lastName: bilan?.student?.user?.lastName,
      niveau: bilan?.level,
      statut: bilan?.statut,
    },
    createdAt: bilan?.createdAt,
    scoresByDomain,
    forces: synthesis.forces || [],
    faiblesses: synthesis.faiblesses || [],
    feuilleDeRoute: synthesis.feuilleDeRoute || [],
    offrePrincipale: offers.primary || '',
    offreReasoning: offers.reasoning || '',
    alternatives: Array.isArray(offers.alternatives) ? offers.alternatives : [],
  };
}

