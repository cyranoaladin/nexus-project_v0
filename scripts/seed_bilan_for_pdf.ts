import { PrismaClient, Subject } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email: 'eleve-test-1@nexus.com' } });
    let student = user ? await prisma.student.findUnique({ where: { userId: user.id } }) : null;
    if (!student) {
      student = await prisma.student.findFirst();
    }
    if (!student) {
      throw new Error('No student found to attach Bilan');
    }

    const qcmScores = {
      byDomain: {
        'Calcul littéral & équations': { points: 15, max: 20, percent: 75 },
        'Fonctions & graphes': { points: 12, max: 20, percent: 60 },
        'Géométrie vectorielle': { points: 10, max: 20, percent: 50 },
        'Trigonométrie': { points: 8, max: 20, percent: 40 },
        'Probabilités & stats': { points: 16, max: 20, percent: 80 },
        'Algorithmique & logique': { points: 14, max: 20, percent: 70 },
      },
      scoreGlobal: 63,
      weakDomains: 2,
    } as any;

    const pedagoProfile = {
      style: 'visuel',
      organisation: 'régulière',
      motivation: 'bonne',
      difficultes: 'raisonnement trigonométrique',
      attentes: 'progresser et viser la mention',
    } as any;

    const synthesis = {
      forces: [
        'Rigueur en calcul littéral',
        'Bonne intuition en probabilités',
      ],
      faiblesses: [
        'Repérage vectoriel perfectible',
        'Fragilités en trigonométrie de base',
      ],
      feuilleDeRoute: [
        'Consolider les identités trigonométriques fondamentales',
        'Revoir les vecteurs et la colinéarité avec exercices guidés',
        'Automatiser les méthodes de résolution d’équations du second degré',
      ],
      text: 'Rapport généré pour démonstration: diagnostic équilibré, progression ciblée sur trigonométrie et géométrie.',
    } as any;

    const offers = {
      primary: 'Studio Flex',
      alternatives: ['Académies', 'Cortex (si progression rapide)'],
      reasoning: 'Score global intermédiaire avec 2 domaines faibles, motivation et organisation bonnes => Flex est adapté.',
    } as any;

    const bilan = await prisma.bilan.create({
      data: {
        studentId: student.id,
        subject: Subject.MATHEMATIQUES,
        level: 'Première',
        statut: 'scolarise_fr',
        qcmScores,
        pedagoProfile,
        synthesis,
        offers,
        status: 'READY',
      },
    });

    console.log(JSON.stringify({ ok: true, bilanId: bilan.id }, null, 2));
  } catch (e: any) {
    console.error(e);
    process.exitCode = 1;
  }
}

main();

