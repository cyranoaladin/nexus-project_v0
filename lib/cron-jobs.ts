import { sendCreditExpirationReminder } from './email';
import { prisma } from './prisma';

// Job quotidien pour vérifier les crédits qui expirent
export async function checkExpiringCredits() {

  // Chercher les crédits qui expirent dans 7 jours
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const expiringCredits = await prisma.creditTransaction.findMany({
    where: {
      type: 'MONTHLY_ALLOCATION',
      amount: { gt: 0 }, // Crédits positifs
      expiresAt: {
        gte: new Date(),
        lte: sevenDaysFromNow
      }
    },
    include: {
      student: {
        include: {
          user: true,
          parent: {
            include: {
              user: true
            }
          }
        }
      }
    }
  });

  // Grouper par élève
  const studentCreditsMap = new Map();

  expiringCredits.forEach(credit => {
    const studentId = credit.studentId;
    if (!studentCreditsMap.has(studentId)) {
      studentCreditsMap.set(studentId, {
        student: credit.student,
        totalCredits: 0,
        expirationDate: credit.expiresAt
      });
    }
    studentCreditsMap.get(studentId).totalCredits += credit.amount;
  });

  // Envoyer les emails de rappel
  for (const [studentId, data] of studentCreditsMap) {
    try {
      await sendCreditExpirationReminder(
        data.student.parent.user.email,
        `${data.student.parent.user.firstName} ${data.student.parent.user.lastName}`,
        `${data.student.user.firstName} ${data.student.user.lastName}`,
        data.totalCredits,
        data.expirationDate
      );

    } catch (error) {
      console.error(`❌ Erreur envoi email pour ${data.student.user.firstName}:`, error);
    }
  }

}

// Job mensuel pour expirer les anciens crédits
export async function expireOldCredits() {

  const expiredTransactions = await prisma.creditTransaction.findMany({
    where: {
      expiresAt: { lt: new Date() },
      type: 'MONTHLY_ALLOCATION',
      amount: { gt: 0 } // Seulement les crédits positifs non encore expirés
    }
  });

  let totalExpired = 0;

  for (const transaction of expiredTransactions) {
    // Créer une transaction d'expiration
    await prisma.creditTransaction.create({
      data: {
        studentId: transaction.studentId,
        type: 'EXPIRATION',
        amount: -transaction.amount,
        description: `Expiration de ${transaction.amount} crédits reportés`
      }
    });

    // Marquer la transaction originale comme expirée
    await prisma.creditTransaction.update({
      where: { id: transaction.id },
      data: { amount: 0 } // Mettre à 0 pour éviter de re-expirer
    });

    totalExpired += transaction.amount;
  }

}

// Job mensuel pour allouer les crédits mensuels
export async function allocateMonthlyCredits() {

  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      creditsPerMonth: { gt: 0 }
    },
    include: {
      student: {
        include: {
          user: true
        }
      }
    }
  });

  let totalAllocated = 0;

  for (const subscription of activeSubscriptions) {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 2); // Expire dans 2 mois (report 1 mois)

    await prisma.creditTransaction.create({
      data: {
        studentId: subscription.studentId,
        type: 'MONTHLY_ALLOCATION',
        amount: subscription.creditsPerMonth,
        description: `Allocation mensuelle de ${subscription.creditsPerMonth} crédits`,
        expiresAt: nextMonth
      }
    });

    totalAllocated += subscription.creditsPerMonth;
  }

}
