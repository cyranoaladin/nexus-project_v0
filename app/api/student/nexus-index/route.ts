export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { computeNexusIndex } from '@/lib/nexus-index';
import { resolveStudentScope } from '@/lib/scopes';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/student/nexus-index?studentId=...
 *
 * Returns the Nexus Index™ for the resolved student.
 * Scope resolution via resolveStudentScope:
 * - ELEVE: own index
 * - PARENT: child index (supports ?studentId for multi-children)
 * - ADMIN/ASSISTANTE: any student (requires ?studentId)
 */
export async function GET(request: NextRequest) {
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

    // Extract optional studentId from query params
    const studentId = request.nextUrl.searchParams.get('studentId') || undefined;

    const scope = await resolveStudentScope(
      { id: userId, role },
      { studentId }
    );

    if (!scope.authorized) {
      // For parent with no children, return null index gracefully
      if (role === 'PARENT' && scope.error.includes('enfant')) {
        return NextResponse.json({
          success: true,
          index: null,
          message: scope.error,
        });
      }
      return NextResponse.json(
        { error: scope.error },
        { status: 403 }
      );
    }

    const index = await computeNexusIndex(scope.studentUserId);

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
