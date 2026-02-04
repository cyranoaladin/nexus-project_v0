import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    console.log('[Parent Dashboard API] Session:', JSON.stringify(session, null, 2));

    if (!session || !session.user) {
      console.log('[Parent Dashboard API] No session or user');
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (session.user.role !== 'PARENT') {
      console.log('[Parent Dashboard API] User is not a parent:', session.user.role);
      return NextResponse.json({ error: 'Accès réservé aux parents' }, { status: 403 });
    }

    console.log('[Parent Dashboard API] Fetching parent profile for user:', session.user.id);

    // Fetch Parent Profile and Children
    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        children: {
          include: {
            user: true,
            badges: {
              include: {
                badge: true
              }
            },
            sessions: {
              where: { status: 'COMPLETED' },
              orderBy: { scheduledAt: 'desc' },
              take: 5,
              select: {
                id: true,
                subject: true,
                scheduledAt: true,
                status: true
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

    // Fetch Payments (Linked to User)
    const payments = await prisma.payment.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    console.log('[Parent Dashboard API] Found', payments.length, 'payments');

    // Transform data for frontend
    const childrenData = parentProfile.children.map((child: any) => ({
      id: child.id,
      name: `${child.user.firstName || ''} ${child.user.lastName || ''}`.trim() || child.user.email,
      grade: child.grade,
      school: child.school,
      credits: child.credits,
      badges: child.badges.map((sb: any) => ({
        id: sb.badge.id,
        name: sb.badge.name,
        icon: sb.badge.icon,
        category: sb.badge.category,
        earnedAt: sb.earnedAt
      })),
      recentScores: [], // Empty for now, can be populated later
      recentSessions: child.sessions
    }));

    console.log('[Parent Dashboard API] Returning data for', childrenData.length, 'children');

    return NextResponse.json({
      children: childrenData,
      payments: payments.map(p => ({
        id: p.id,
        date: p.createdAt,
        amount: p.amount,
        description: p.description,
        status: p.status,
        type: p.type
      }))
    });

  } catch (error) {
    console.error('[Parent Dashboard API] Error fetching parent dashboard data:', error);
    console.error('[Parent Dashboard API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: 'Erreur serveur', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
