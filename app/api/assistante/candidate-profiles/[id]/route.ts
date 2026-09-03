/**
 * GET /api/assistante/candidate-profiles/[id] — reads a ProfilCandidat
 * (Track A, Section 12). Staff-only (ADMIN/ASSISTANTE).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { UserRole } from '@prisma/client';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { getProfilCandidatById } from '@/lib/quotes/candidate-profile-persistence.server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessionOrError = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  const blocked = await guardSensitiveRateLimit(request, {
    scope: 'candidate-profile-read',
    identity: sessionOrError.user.id,
  });
  if (blocked) return blocked;

  const { id } = await params;
  const profil = await getProfilCandidatById(id);
  if (!profil) {
    return NextResponse.json({ error: 'candidate_profile_not_found' }, { status: 404 });
  }

  return NextResponse.json(profil, { status: 200 });
}
