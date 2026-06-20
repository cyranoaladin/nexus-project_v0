import { prisma } from './prisma'
import { Prisma, CronExecutionStatus } from '@prisma/client'
import { sendCreditExpirationReminder } from './email'

/**
 * Helper: Start a cron job execution with idempotency tracking
 * Returns null if the job has already been executed for this key
 */
async function startExecution(jobName: string, executionKey: string) {
  try {
    return await prisma.cronExecution.create({
      data: {
        jobName,
        executionKey,
        status: CronExecutionStatus.RUNNING
      }
    });
  } catch (error) {
    // P2002: Unique constraint violation - job already running or completed
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string };
      if (prismaError.code === 'P2002') {
        return null;
      }
    }
    throw error;
  }
}

/**
 * Helper: Mark a cron job execution as completed or failed
 */
async function completeExecution(executionId: string, error?: string) {
  await prisma.cronExecution.update({
    where: { id: executionId },
    data: {
      status: error ? CronExecutionStatus.FAILED : CronExecutionStatus.COMPLETED,
      completedAt: new Date(),
      error
    }
  });
}

// Job quotidien pour vérifier les crédits qui expirent
export async function checkExpiringCredits() {
  // Chercher les crédits qui expirent dans 7 jours
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
  
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
  })
  
  // Grouper par élève
  const studentCreditsMap = new Map()
  
  expiringCredits.forEach(credit => {
    const studentId = credit.studentId
    if (!studentCreditsMap.has(studentId)) {
      studentCreditsMap.set(studentId, {
        student: credit.student,
        totalCredits: 0,
        expirationDate: credit.expiresAt
      })
    }
    studentCreditsMap.get(studentId).totalCredits += credit.amount
  })
  
  // Envoyer les emails de rappel
  const reminderJobs: Promise<void>[] = []

  studentCreditsMap.forEach((data) => {
    reminderJobs.push((async () => {
      try {
        await sendCreditExpirationReminder(
          data.student.parent.user.email,
          `${data.student.parent.user.firstName} ${data.student.parent.user.lastName}`,
          `${data.student.user.firstName} ${data.student.user.lastName}`,
          data.totalCredits,
          data.expirationDate
        )
        
      } catch (error) {
        console.error(`❌ Erreur envoi email pour ${data.student.user.firstName}:`, error)
      }
    })())
  })

  await Promise.all(reminderJobs)
}

// Job mensuel pour expirer les anciens crédits
// CRITICAL: Uses transaction to ensure atomicity of expiration operations (INV-CRON-2)
export async function expireOldCredits() {
  // Wrap expiration in transaction to ensure both create and update happen atomically
  const totalExpired = await prisma.$transaction(async (tx) => {
    const expiredTransactions = await tx.creditTransaction.findMany({
      where: {
        expiresAt: { lt: new Date() },
        type: 'MONTHLY_ALLOCATION',
        amount: { gt: 0 } // Seulement les crédits positifs non encore expirés
      }
    });

    let total = 0;

    for (const transaction of expiredTransactions) {
      // Créer une transaction d'expiration
      await tx.creditTransaction.create({
        data: {
          studentId: transaction.studentId,
          type: 'EXPIRATION',
          amount: -transaction.amount,
          description: `Expiration de ${transaction.amount} crédits reportés`
        }
      });

      // Marquer la transaction originale comme expirée
      await tx.creditTransaction.update({
        where: { id: transaction.id },
        data: { amount: 0 } // Mettre à 0 pour éviter de re-expirer
      });

      total += transaction.amount;
    }

    return total;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 60000  // 60 seconds for potentially long-running job
  });

}

// Job mensuel pour allouer les crédits mensuels
// CRITICAL: Uses idempotency tracking to prevent duplicate allocations (INV-CRON-1)
export async function allocateMonthlyCredits() {
  // Create execution key from current year-month to prevent duplicate runs
  const now = new Date();
  const executionKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const execution = await startExecution('monthly-allocation', executionKey);
  if (!execution) {
    // Job already executed this month
    return;
  }

  try {
    // Wrap allocation in transaction for atomicity (INV-CRON-2)
    const totalAllocated = await prisma.$transaction(async (tx) => {
      const activeSubscriptions = await tx.subscription.findMany({
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

      let total = 0;

      for (const subscription of activeSubscriptions) {
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 2); // Expire dans 2 mois (report 1 mois)

        await tx.creditTransaction.create({
          data: {
            studentId: subscription.studentId,
            type: 'MONTHLY_ALLOCATION',
            amount: subscription.creditsPerMonth,
            description: `Allocation mensuelle de ${subscription.creditsPerMonth} crédits`,
            expiresAt: nextMonth
          }
        });

        total += subscription.creditsPerMonth;
      }

      return total;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 60000  // 60 seconds for potentially long-running job
    });

    await completeExecution(execution.id);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await completeExecution(execution.id, errorMessage);
    console.error('❌ Erreur lors de l\'allocation des crédits:', error);
    throw error;
  }
}
