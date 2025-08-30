// lib/bilan/synthesis.ts
import { PedagoProfile, QCMScores, Synthesis } from './types';

export function buildHeuristicSynthesis(scores: QCMScores, profile: PedagoProfile): Synthesis {
  const entries = Object.values(scores.byDomain);
  const sorted = [...entries].sort((a, b) => b.percent - a.percent);
  const forces = sorted.filter(d => d.percent >= 75).slice(0, 3).map(d => `Maîtrise solide en ${d.domain.toLowerCase()} (${d.percent}%).`);
  const faibles = sorted.filter(d => d.percent < 50).slice(0, 3).map(d => `Renforcer ${d.domain.toLowerCase()} (actuellement ${d.percent}%).`);

  const feuille: string[] = [];
  feuille.push('2h/semaine d’exercices ciblés sur les axes faibles (ARIA + annales).');
  feuille.push('1h/semaine encadrée (Flex) pour corriger la méthode et sécuriser les acquis.');
  feuille.push('Étape 2 (après 4 semaines): entraînement type Bac (sujets chronométrés).');

  if ((profile?.organisation || '').toLowerCase().includes('désorgan')) {
    feuille.unshift('Mettre en place un planning hebdomadaire (créneaux fixes, check-list).');
  }
  if ((profile?.motivation || '').toLowerCase().includes('faible')) {
    feuille.push('Coaching motivationnel léger: fixer un objectif chiffré et un rituel de révision.');
  }

  return { forces, faiblesses: faibles, feuilleDeRoute: feuille };
}

