/**
 * POST /api/assistante/candidat-individuel/profils — create/save a
 * ProfilCandidat draft.
 * GET  /api/assistante/candidat-individuel/profils — resume: list existing
 * drafts (optionally filtered by contactLeadId/studentId).
 *
 * Access: ADMIN/ASSISTANTE, AND pricing.candidatIndividuelPipeline.state
 * must be at least ACTIVE_INTERNAL (mission recâblage §5/§6).
 */
import { NextRequest, NextResponse } from 'next/server';
import { isErrorResponse, type AuthSession } from '@/lib/guards';
import { requireInternalPipelineAccess } from '@/lib/quotes/candidat-individuel-guard.server';
import { profilCandidatDraftBodySchema } from '@/lib/quotes/candidat-individuel-api-schemas';
import { createProfilCandidat } from '@/lib/quotes/profil-candidat.server';
import { listCandidatIndividuelStaffProfileViews } from '@/lib/quotes/candidat-individuel-staff-view.server';

export async function POST(request: NextRequest) {
  const access = await requireInternalPipelineAccess();
  if (isErrorResponse(access)) return access;
  const session = access as AuthSession;

  const json = await request.json().catch(() => null);
  const parsed = profilCandidatDraftBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  const result = await createProfilCandidat(parsed.data, session.user.id);
  if (!result.ok) {
    if ('identityError' in result) {
      const messages = {
        MISSING_IDENTITY: 'Sélectionnez un responsable et un élève.',
        CONTACT_LEAD_NOT_FOUND: 'Le responsable sélectionné est introuvable.',
        STUDENT_NOT_FOUND: "L'élève sélectionné est introuvable.",
        RESPONSIBLE_UNAVAILABLE: "Le rattachement responsable de cet élève doit être vérifié dans son dossier.",
        IDENTITY_MISMATCH: 'Cet élève est rattaché à un autre responsable. Vérifiez le dossier avant de continuer.',
      };
      return NextResponse.json({ error: result.identityError, message: messages[result.identityError] }, { status: 409 });
    }
  const validationIssues = result.validationIssues ?? [];
  const validationIssue = validationIssues[0];
  return NextResponse.json({
    error: validationIssue?.code ?? 'Profil incomplet',
    ...(validationIssue ? { message: validationIssue.message } : {}),
    validationIssues,
    unresolvedFields: result.unresolvedFields,
    missingRequiredFields: result.missingRequiredFields,
  }, { status: 422 });
  }
  return NextResponse.json({ profil: result.profil }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const access = await requireInternalPipelineAccess();
  if (isErrorResponse(access)) return access;

  const { searchParams } = new URL(request.url);
  const profils = await listCandidatIndividuelStaffProfileViews({
    contactLeadId: searchParams.get('contactLeadId') ?? undefined,
    studentId: searchParams.get('studentId') ?? undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
  });
  return NextResponse.json({ profils });
}
