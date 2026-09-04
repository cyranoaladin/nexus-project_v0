/**
 * GET /api/assistante/candidate-profiles/[id] — reads a ProfilCandidat
 * (Track A, Section 12). Staff-only (ADMIN/ASSISTANTE).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { Prisma, UserRole } from '@prisma/client';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { getCandidateProfileWorkflowStatus } from '@/lib/quotes/candidate-profile-flag';
import {
  getProfilCandidatById,
  reviseProfilCandidat,
} from '@/lib/quotes/candidate-profile-persistence.server';
import { reviseProfilCandidatSchema } from '@/lib/quotes/candidate-profile-schemas';

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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessionOrError = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  const blocked = await guardSensitiveRateLimit(request, {
    scope: 'candidate-profile-update',
    identity: sessionOrError.user.id,
  });
  if (blocked) return blocked;

  const workflowStatus = await getCandidateProfileWorkflowStatus();
  if (workflowStatus !== 'ACTIVE_INTERNAL') {
    return NextResponse.json({ error: 'candidate_profile_workflow_disabled' }, { status: 403 });
  }

  const { id } = await params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = reviseProfilCandidatSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload', issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await getProfilCandidatById(id);
  if (!existing) {
    return NextResponse.json({ error: 'candidate_profile_not_found' }, { status: 404 });
  }

  const mergedSpecialite1 = parsed.data.specialite1 ?? existing.specialite1;
  const mergedSpecialite2 = parsed.data.specialite2 ?? existing.specialite2;
  if (mergedSpecialite1 === mergedSpecialite2) {
    return NextResponse.json(
      {
        error: 'invalid_payload',
        issues: [
          {
            code: 'custom',
            message: 'specialite1 and specialite2 must be distinct',
            path: ['specialite2'],
          },
        ],
      },
      { status: 400 },
    );
  }

  try {
    const revised = await reviseProfilCandidat(id, {
      ...parsed.data,
      createdByUserId: sessionOrError.user.id,
    });
    return NextResponse.json(revised, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('specialite1 and specialite2 must be distinct')) {
      return NextResponse.json(
        {
          error: 'invalid_payload',
          issues: [
            {
              code: 'custom',
              message: error.message,
              path: ['specialite2'],
            },
          ],
        },
        { status: 400 },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'candidate_profile_not_found' }, { status: 404 });
      }
      if (error.code === 'P2002') {
        return NextResponse.json({ error: 'candidate_profile_concurrent_revision' }, { status: 409 });
      }
    }
    throw error;
  }
}

