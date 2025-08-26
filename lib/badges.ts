import { prisma } from './prisma';

// Définition des badges selon la documentation
const BADGE_DEFINITIONS = [
  // Catégorie : Assiduité & Engagement
  {
    name: 'Premiers Pas',
    description: 'Terminer le tour de bienvenue',
    category: 'ASSIDUITE',
    icon: '👋',
    condition: 'first_login',
  },
  {
    name: 'Chauffage...',
    description: 'Première connexion de la semaine',
    category: 'ASSIDUITE',
    icon: '🔥',
    condition: 'weekly_first_login',
  },
  {
    name: 'Série en Cours',
    description: "Se connecter 3 jours d'affilée",
    category: 'ASSIDUITE',
    icon: '📈',
    condition: 'login_streak_3',
  },
  {
    name: 'Force de la Nature',
    description: "Se connecter 5 jours d'affilée",
    category: 'ASSIDUITE',
    icon: '💪',
    condition: 'login_streak_5',
  },
  {
    name: 'Noctambule du Savoir',
    description: 'Compléter un module après 22h',
    category: 'ASSIDUITE',
    icon: '🌙',
    condition: 'late_night_study',
  },

  // Catégorie : Progression & Maîtrise
  {
    name: 'Décollage Réussi',
    description: 'Terminer le premier module',
    category: 'PROGRESSION',
    icon: '🚀',
    condition: 'first_module_completed',
  },
  {
    name: 'Score Parfait',
    description: 'Obtenir 100% à un quiz de 10+ questions',
    category: 'PROGRESSION',
    icon: '💯',
    condition: 'perfect_quiz_score',
  },
  {
    name: 'Maître du Chapitre',
    description: "Terminer tous les modules d'un chapitre",
    category: 'PROGRESSION',
    icon: '👑',
    condition: 'chapter_master',
  },
  {
    name: 'Spécialiste en Devenir',
    description: "Terminer 50% des modules d'une matière",
    category: 'PROGRESSION',
    icon: '🎯',
    condition: 'subject_50_percent',
  },
  {
    name: 'Grand Maître',
    description: "Terminer 100% des modules d'une matière",
    category: 'PROGRESSION',
    icon: '🏆',
    condition: 'subject_master',
  },

  // Catégorie : Curiosité & Interaction (ARIA)
  {
    name: 'Dialogue avec le Futur',
    description: 'Poser la première question à ARIA',
    category: 'CURIOSITE',
    icon: '🤖',
    condition: 'first_aria_question',
  },
  {
    name: 'Esprit Vif',
    description: 'Poser 25 questions à ARIA',
    category: 'CURIOSITE',
    icon: '⚡',
    condition: 'aria_questions_25',
  },
  {
    name: 'Explorateur de Connaissances',
    description: 'Poser 100 questions à ARIA dans une matière',
    category: 'CURIOSITE',
    icon: '🔍',
    condition: 'aria_questions_100_subject',
  },
  {
    name: 'Polyglotte Numérique',
    description: 'Utiliser ARIA pour 3 matières différentes',
    category: 'CURIOSITE',
    icon: '🌐',
    condition: 'aria_3_subjects',
  },
  {
    name: 'Architecte du Feedback',
    description: 'Donner 10 feedbacks sur ARIA',
    category: 'CURIOSITE',
    icon: '🏗️',
    condition: 'aria_feedback_10',
  },
];

// Initialisation des badges en base
export async function initializeBadges() {
  for (const badgeData of BADGE_DEFINITIONS) {
    await prisma.badge.upsert({
      where: { name: badgeData.name },
      update: badgeData,
      create: badgeData,
    });
  }
}

// Attribution d'un badge à un élève
export async function awardBadge(studentId: string, badgeName: string) {
  const badge = await prisma.badge.findUnique({
    where: { name: badgeName },
  });

  if (!badge) return null;

  // Vérifier si l'élève a déjà ce badge
  const existingBadge = await prisma.studentBadge.findUnique({
    where: {
      studentId_badgeId: {
        studentId,
        badgeId: badge.id,
      },
    },
  });

  if (existingBadge) return null;

  // Attribuer le badge
  return await prisma.studentBadge.create({
    data: {
      studentId,
      badgeId: badge.id,
    },
    include: {
      badge: true,
    },
  });
}

// Vérification et attribution automatique des badges
export async function checkAndAwardBadges(studentId: string, event: string, metadata?: any) {
  const newBadges = [];

  switch (event) {
    case 'first_login':
      const firstBadge = await awardBadge(studentId, 'Premiers Pas');
      if (firstBadge) newBadges.push(firstBadge);
      break;

    case 'first_aria_question':
      const ariaBadge = await awardBadge(studentId, 'Dialogue avec le Futur');
      if (ariaBadge) newBadges.push(ariaBadge);
      break;

    case 'aria_feedback':
      // Compter les feedbacks donnés
      const feedbackCount = await prisma.ariaMessage.count({
        where: {
          conversation: {
            studentId,
          },
          feedback: { not: null },
        },
      });

      if (feedbackCount >= 10) {
        const feedbackBadge = await awardBadge(studentId, 'Architecte du Feedback');
        if (feedbackBadge) newBadges.push(feedbackBadge);
      }
      break;

    case 'aria_question_count':
      const questionCount = await prisma.ariaMessage.count({
        where: {
          conversation: {
            studentId,
          },
          role: 'user',
        },
      });

      if (questionCount >= 25) {
        const vifBadge = await awardBadge(studentId, 'Esprit Vif');
        if (vifBadge) newBadges.push(vifBadge);
      }
      break;
  }

  return newBadges;
}

// Récupération des badges d'un élève
export async function getStudentBadges(studentId: string) {
  return await prisma.studentBadge.findMany({
    where: { studentId },
    include: { badge: true },
    orderBy: { earnedAt: 'desc' },
  });
}
