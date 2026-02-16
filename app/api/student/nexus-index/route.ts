export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { computeNexusIndex } from '@/lib/nexus-index';
import { NextResponse } from 'next/server';

/**
 * GET /api/student/nexus-index
 *
 * Returns the Nexus Index™ for the authenticated student.
 * Also accessible by PARENT (returns first child's index) and ADMIN/ASSISTANTE.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentification requise' },
        { status: 401 }
      );
    }

    const { role, id: userId } = session.user;

    // Only students, parents, admin, and assistants can access
    if (!['ELEVE', 'PARENT', 'ADMIN', 'ASSISTANTE'].includes(role)) {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 403 }
      );
    }

    let targetUserId = userId;

    // For parents, compute index for first child
    if (role === 'PARENT') {
      const { prisma } = await import('@/lib/prisma');
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId },
        select: {
          children: {
            select: { userId: true },
            take: 1,
          },
        },
      });

      if (!parentProfile?.children[0]) {
        return NextResponse.json({
          success: true,
          index: null,
          message: 'Aucun enfant associé',
        });
      }

      targetUserId = parentProfile.children[0].userId;
    }

    const index = await computeNexusIndex(targetUserId);

    return NextResponse.json({
      success: true,
      index,
    });
  } catch (error) {
    console.error('[API] Nexus Index error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
