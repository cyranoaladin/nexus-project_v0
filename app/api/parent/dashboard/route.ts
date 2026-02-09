import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import type { Prisma } from '@prisma/client';

type ChildWithRelations = Prisma.StudentProfileGetPayload<{
  include: {
    user: true;
    badges: {
      include: {
        badge: true;
      };
    };
    sessions: {
      select: {
        id: true;
        subject: true;
        scheduledAt: true;
        status: true;
      };
    };
  };
}> & {
  credits: number;
};

type StudentBadge = Prisma.StudentBadgeGetPayload<{
  include: {
    badge: true;
  };
}>;

type SessionData = {
  id: string;
  subject: string;
  scheduledAt: Date;
  status: string;
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      console.log('[Parent Dashboard API] No session or user');
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (session.user.role !== 'PARENT') {
      console.log('[Parent Dashboard API] User is not a parent:', session.user.role);
      return NextResponse.json({ error: 'Accès réservé aux parents' }, { status: 403 });
    }

    console.log('[Parent Dashboard API] Fetching parent profile for user:', session.user.id);

    // Fetch Parent Profile and Children with UPCOMING sessions
    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        children: {
          include: {
            user: {
              include: {
                studentSessions: {
                  where: {
                    status: 'SCHEDULED'
                  },
                  orderBy: { scheduledDate: 'asc' },
                  take: 5,
                  select: {
                    id: true,
                    subject: true,
                    scheduledDate: true,
                    startTime: true,
                    endTime: true,
                    status: true,
                    modality: true,
                    type: true,
                    coachId: true
                  }
                }
              }
            },
            badges: {
              include: {
                badge: true
              }
            }
          }
        }
      }
    });

    console.log('[Parent Dashboard API] Parent profile:', parentProfile ? 'Found' : 'Not found');

    if (!parentProfile) {
      console.log('[Parent Dashboard API] Parent profile not found for user:', session.user.id);
      return NextResponse.json({ error: 'Profil parent introuvable' }, { status: 404 });
    }

    // Fetch Payments
    const payments = await prisma.payment.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    console.log('[Parent Dashboard API] Found', payments.length, 'payments');

    // Transform data for frontend
    const childrenData = await Promise.all(parentProfile.children.map(async (child) => {
      // Fetch coach names for sessions if needed, or use placeholder
      // For simplicity/performance in this fix, we map sessions directly

      const mappedSessions = child.user.studentSessions.map(s => ({
        id: s.id,
        subject: s.subject,
        scheduledAt: s.scheduledDate.toISOString(),
        coachName: 'Coach',
        type: s.type === 'INDIVIDUAL' ? 'COURS_ONLINE' : 'COURS_COLLECTIF', // Use generic types for now
        status: s.status,
        duration: 60
      }));

      const nextSession = mappedSessions.length > 0 ? mappedSessions[0] : null;

      return {
        id: child.id,
        firstName: child.user.firstName || '',
        lastName: child.user.lastName || '',
        // name: ... (Frontend uses firstName/lastName in interface usually?)
        // Page.tsx uses: firstName, lastName.
        // Interface says: firstName, lastName in parent object.
        // Children objects in Page.tsx interface: id, firstName, lastName, ...
        // So we must match that.

        grade: child.grade,
        school: child.school,
        credits: child.credits,

        // Subscription details (mock or from DB)
        subscription: "Standard", // Default
        subscriptionDetails: null,

        nextSession: nextSession,

        progress: 0, // Mock
        subjectProgress: {}, // Mock

        sessions: mappedSessions,

        // Fix badges mapping
        badges: child.badges.map((sb: StudentBadge) => ({
          id: sb.badge.id,
          name: sb.badge.name,
          icon: sb.badge.icon,
          category: sb.badge.category,
          earnedAt: sb.earnedAt.toISOString()
        }))
      };
    }));

    console.log('[Parent Dashboard API] Returning data for', childrenData.length, 'children');

    return NextResponse.json({
      // Parent info
      parent: {
        id: session.user.id,
        firstName: session.user.firstName || '',
        lastName: session.user.lastName || '',
        email: session.user.email || ''
      },
      children: childrenData,
      payments: payments.map(p => ({
        id: p.id,
        date: p.createdAt.toISOString(),
        amount: p.amount,
        description: p.description,
        status: p.status,
        type: p.type
      }))
    });

  } catch (error) {
    console.error('[Parent Dashboard API] Error fetching parent dashboard data:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
