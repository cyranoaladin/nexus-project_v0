/**
 * POST /api/assistante/candidat-individuel/profils/:id/review — "demander
 * une revue" (mission recâblage §5). A staff-set marker only — never
 * auto-derived from a pipeline result status (HUMAN_REVIEW_REQUIRED/
 * DIRECTION_APPROVAL_REQUIRED stay per-simulation fields, never persisted
 * profil state).
 */
import { NextRequest, NextResponse } from 'next/server';
import { isErrorResponse, type AuthSession } from '@/lib/guards';
import { requireInternalPipelineAccess } from '@/lib/quotes/candidat-individuel-guard.server';
import { requestReviewBodySchema } from '@/lib/quotes/candidat-individuel-api-schemas';
import { requestProfilCandidatReview } from '@/lib/quotes/profil-candidat.server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireInternalPipelineAccess();
  if (isErrorResponse(access)) return access;
  const session = access as AuthSession;

  const { id } = await params;
  const json = await request.json().catch(() => ({}));
  const parsed = requestReviewBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  const profil = await requestProfilCandidatReview(id, session.user.id, parsed.data.note ?? null);
  if (!profil) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
  return NextResponse.json({ profil });
}
