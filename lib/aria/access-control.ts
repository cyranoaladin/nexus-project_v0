// lib/aria/access-control.ts
import { prisma } from '@/lib/prisma';
import { Student, Subject, Subscription, User } from '@prisma/client';

type StudentWithSubscriptions = Student & { subscriptions: Subscription[] };

// Cette fonction résout le profil de l'élève actif, que l'utilisateur soit un parent ou l'élève lui-même.
async function resolveStudent(
  userId: string,
  userRole: string
): Promise<StudentWithSubscriptions | null> {
  if (userRole === 'ELEVE') {
    return await prisma.student.findUnique({
      where: { userId },
      include: { subscriptions: true },
    });
  }
  if (userRole === 'PARENT') {
    // TODO: Implémenter la logique pour trouver l'enfant actuellement sélectionné par le parent.
    // Pour l'instant, nous retournons le premier enfant trouvé.
    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId },
      include: {
        children: {
          include: { subscriptions: true },
          take: 1,
        },
      },
    });
    return (parentProfile as any)?.children?.[0] || null;
  }
  return null;
}

// Cette fonction est le point d'entrée pour vérifier si un utilisateur a accès à ARIA pour une matière donnée.
export async function assertAriaAccess(
  userId: string,
  subject: Subject
): Promise<{
  student: Student & { user: User; subscriptions: Subscription[] };
  hasAriaPlusForSubject: boolean;
}> {
  const student = await prisma.student.findUnique({
    where: { userId },
    include: {
      user: true,
      subscriptions: {
        where: {
          status: 'ACTIVE',
          endDate: {
            gte: new Date(),
          },
        },
      },
    },
  });

  if (!student) {
    throw new Error('Profil élève non trouvé ou non associé à cet utilisateur.');
  }

  const hasAriaPlusForSubject = student.subscriptions.some((sub) => {
    try {
      // ariaSubjects est stocké comme une chaîne JSON, il faut la parser.
      const subjects = JSON.parse(sub.ariaSubjects || '[]') as Subject[];
      return subjects.includes(subject);
    } catch (e) {
      console.error('Erreur de parsing JSON pour ariaSubjects:', e);
      return false;
    }
  });

  return { student, hasAriaPlusForSubject };
}

// Limites pour le mode freemium
const FREEMIUM_LIMITS = {
  requestsPerDay: 5,
};

// Vérifie si l'élève peut utiliser ARIA en mode freemium
export async function checkFreemiumUsage(studentId: string): Promise<boolean> {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return false;

  const usageData = student.freemiumUsage as {
    lastRequestDate?: string;
    requestCount?: number;
  } | null;
  if (!usageData || !usageData.lastRequestDate) {
    return true; // Première utilisation
  }

  const lastRequestDate = new Date(usageData.lastRequestDate);
  const today = new Date();

  if (lastRequestDate.toDateString() !== today.toDateString()) {
    return true; // Le compteur est réinitialisé chaque jour
  }

  return (usageData.requestCount || 0) < FREEMIUM_LIMITS.requestsPerDay;
}

// Met à jour le compteur d'utilisation freemium
export async function updateFreemiumUsage(studentId: string): Promise<void> {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return;

  const today = new Date();
  const usageData = student.freemiumUsage as {
    lastRequestDate?: string;
    requestCount?: number;
  } | null;

  let newCount = 1;
  if (
    usageData &&
    usageData.lastRequestDate &&
    new Date(usageData.lastRequestDate).toDateString() === today.toDateString()
  ) {
    newCount = (usageData.requestCount || 0) + 1;
  }

  await prisma.student.update({
    where: { id: studentId },
    data: {
      freemiumUsage: {
        lastRequestDate: today.toISOString(),
        requestCount: newCount,
      },
    },
  });
}
