import { REFLEXES } from './reflex-data';
import { PHRASES_MAGIQUES } from './phrases';
import type { SurvivalProgressSnapshot, SurvivalRitual } from './types';

function daysBetween(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((to.getTime() - from.getTime()) / msPerDay);
}

export function chooseDailyRitual(
  progress: SurvivalProgressSnapshot,
  today = new Date(),
  examDate = new Date('2026-06-08'),
): SurvivalRitual {
  const firstUnseen = REFLEXES.find((reflex) => {
    const state = progress.reflexesState[reflex.id];
    return !state || state === 'PAS_VU';
  });

  if (firstUnseen) {
    return {
      id: `ritual_${firstUnseen.id}`,
      kind: 'REFLEX',
      targetId: firstUnseen.id,
      title: `Aujourd’hui : ${firstUnseen.title}`,
      durationMinutes: 8,
      description: 'Une seule fiche, trois questions, puis on ferme.',
    };
  }

  const review = REFLEXES.find((reflex) => progress.reflexesState[reflex.id] === 'REVOIR');
  if (review) {
    return {
      id: `ritual_review_${review.id}`,
      kind: 'REVIEW',
      targetId: review.id,
      title: `Aujourd’hui : revoir ${review.title}`,
      durationMinutes: 5,
      description: 'On reprend calmement une fiche déjà vue.',
    };
  }

  const accuracy = progress.qcmAttempts > 0 ? progress.qcmCorrect / progress.qcmAttempts : 0;
  if (accuracy < 0.7) {
    return {
      id: 'ritual_qcm_6',
      kind: 'QCM',
      targetId: 'qcm_trainer',
      title: "Aujourd’hui : 6 questions QCM Trainer",
      durationMinutes: 10,
      description: 'Mode avec aide autorisé. L’objectif est de remplir.',
    };
  }

  if (daysBetween(today, examDate) <= 7) {
    return {
      id: 'ritual_exam_sujet0',
      kind: 'EXAM',
      targetId: 'sujet_0',
      title: "Aujourd’hui : un sujet 0 entier en mode épreuve",
      durationMinutes: 60,
      description: 'Sans calculatrice. On remplit 100 % du QCM.',
    };
  }

  const phrase = PHRASES_MAGIQUES.find((item) => (progress.phrasesState[item.id] ?? 0) < 3) ?? PHRASES_MAGIQUES[0];
  return {
    id: `ritual_phrase_${phrase.id}`,
    kind: 'PHRASE',
    targetId: phrase.id,
    title: `Aujourd’hui : copier 3 fois la phrase magique ${phrase.id.replace('phrase_', 'N°')}`,
    durationMinutes: 3,
    description: 'Objectif : être capable de la recopier le jour J.',
  };
}

export const TWO_MINUTE_FALLBACK: SurvivalRitual = {
  id: 'ritual_golden_rule',
  kind: 'GOLDEN_RULE',
  targetId: 'golden_rule',
  title: "Lis la règle d’or et ferme l’app",
  durationMinutes: 2,
  description: 'Le jour J, tu remplis tout le QCM, même au hasard.',
};
