export type OfferRecommendation = {
  primary: string;
  alternatives: string[];
  reasoning: string;
};

export function recommendOffer(params: {
  scoreGlobal: number;
  weakDomains: number;
  autonomy?: 'élevée' | 'moyenne' | 'faible';
  motivation?: 'bonne' | 'moyenne' | 'faible';
  statut?: string; // 'candidat_libre' etc.
}): OfferRecommendation {
  const { scoreGlobal, weakDomains, autonomy, motivation, statut } = params;

  if ((statut || '').toLowerCase().includes('candidat')) {
    return {
      primary: 'Programme Odyssée — Candidat Libre',
      alternatives: ['Académies Nexus (stages intensifs)'],
      reasoning: "Le statut 'candidat libre' nécessite un suivi complet qui remplace l’établissement: cadre, progression et accompagnement premium.",
    };
  }

  if (scoreGlobal >= 70 && weakDomains <= 1 && autonomy === 'élevée') {
    return {
      primary: 'Nexus Cortex (IA ARIA 24/7)',
      alternatives: ['Académies Nexus (perfectionnement ciblé)'],
      reasoning: 'Très bon niveau et autonomie: Cortex fournit un support continu, et un stage peut affiner un axe précis.',
    };
  }

  if (scoreGlobal >= 55 && weakDomains <= 2 && (motivation === 'bonne' || motivation === 'moyenne')) {
    return {
      primary: 'Studio Flex (cours à la carte)',
      alternatives: ['Cortex', 'Académies Nexus'],
      reasoning: 'Niveau correct avec quelques axes à renforcer: des séances ciblées + IA pour l’entraînement.',
    };
  }

  if (scoreGlobal >= 40 && weakDomains >= 2) {
    return {
      primary: 'Académies Nexus (stages intensifs)',
      alternatives: ['Programme Odyssée (si objectif mention/Parcoursup)'],
      reasoning: 'Plusieurs faiblesses: un choc de progression intensif est pertinent; un suivi annuel peut sécuriser la mention.',
    };
  }

  if (scoreGlobal < 55 || autonomy === 'faible' || motivation === 'faible') {
    return {
      primary: 'Programme Odyssée (accompagnement annuel premium)',
      alternatives: ['Studio Flex (renfort ponctuel)'],
      reasoning: 'Besoin d’un cadre structurant, d’un suivi et d’un pilotage régulier pour ancrer les progrès.',
    };
  }

  return {
    primary: 'Nexus Cortex (IA ARIA 24/7)',
    alternatives: ['Académies Nexus'],
    reasoning: 'Par défaut, un support IA continu est bénéfique; un stage ponctuel peut compléter sur un thème.',
  };
}
