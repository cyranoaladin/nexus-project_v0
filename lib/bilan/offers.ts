// lib/bilan/offers.ts
import { Offers, PedagoProfile, QCMScores } from './types';

export function recommendOffers(
  scores: QCMScores,
  profile: PedagoProfile,
  statut?: string,
  objectif?: string
): Offers {
  // Cas Candidat Libre prioritaire
  if ((statut || '').toLowerCase().includes('candidat')) {
    return {
      primary: 'Odyssée Candidat Libre',
      alternatives: [],
      reasoning: 'Statut candidat libre: besoin d’un cadre complet et sécurisé (remplacer le lycée).',
    };
  }

  const score = scores.scoreGlobal;
  const weak = scores.weakDomains;
  const motivation = (profile?.motivation || '').toLowerCase();
  const organisation = (profile?.organisation || '').toLowerCase();

  // Très bon niveau et autonomie
  if (score >= 70 && weak <= 1 && !(organisation.includes('désorgan') || motivation.includes('faible'))) {
    return {
      primary: 'Cortex',
      alternatives: ['Académies (stage ciblé)'],
      reasoning: 'Très bon niveau et autonomie: IA ARIA 24/7 + perfectionnement ponctuel.',
    };
  }

  // Niveau correct + besoins ponctuels
  if (score >= 55 && weak <= 2 && !motivation.includes('faible')) {
    return {
      primary: 'Studio Flex',
      alternatives: ['Cortex', 'Académies'],
      reasoning: 'Niveau correct; renforts ciblés à la carte selon besoins.',
    };
  }

  // Plusieurs lacunes ou besoin d’un choc de progression
  if (score >= 40 && weak >= 2) {
    return {
      primary: 'Académies',
      alternatives: ['Odyssée'],
      reasoning: 'Lacunes multiples: stage intensif pour remonter rapidement, puis suivi structuré si nécessaire.',
    };
  }

  // Niveau faible ou besoin structurant
  if (score < 55 || motivation.includes('faible') || organisation.includes('désorgan')) {
    return {
      primary: 'Odyssée',
      alternatives: ['Flex (renforts ponctuels)'],
      reasoning: 'Besoin de structure et d’accompagnement premium, feuille de route annuelle.',
    };
  }

  // Par défaut
  return {
    primary: 'Cortex',
    alternatives: ['Académies'],
    reasoning: 'Autonomie correcte; IA 24/7 et perfectionnement éventuel.',
  };
}

