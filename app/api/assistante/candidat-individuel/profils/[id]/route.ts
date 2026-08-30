/**
 * GET   /api/assistante/candidat-individuel/profils/:id — resume a draft.
 * PATCH /api/assistante/candidat-individuel/profils/:id — save edits to a draft.
 *
 * Access: ADMIN/ASSISTANTE, AND pricing.candidatIndividuelPipeline.state
 * must be at least ACTIVE_INTERNAL (mission recâblage §5/§6).
 */
import { NextRequest, NextResponse } from 'next/server';
import { isErrorResponse } from '@/lib/guards';
import { requireInternalPipelineAccess } from '@/lib/quotes/candidat-individuel-guard.server';
import { profilCandidatDraftBodySchema } from '@/lib/quotes/candidat-individuel-api-schemas';
import { updateProfilCandidat } from '@/lib/quotes/profil-candidat.server';
import { getCandidatIndividuelStaffProfileView } from '@/lib/quotes/candidat-individuel-staff-view.server';

const NOT_FOUND = { error: 'Profil introuvable' };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireInternalPipelineAccess();
  if (isErrorResponse(access)) return access;

  const { id } = await params;
  const profil = await getCandidatIndividuelStaffProfileView(id);
  if (!profil) return NextResponse.json(NOT_FOUND, { status: 404 });
  return NextResponse.json({ profil });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireInternalPipelineAccess();
  if (isErrorResponse(access)) return access;

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = profilCandidatDraftBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  const result = await updateProfilCandidat(id, parsed.data);
  if (!result.ok) {
    if ('notFound' in result) return NextResponse.json(NOT_FOUND, { status: 404 });
    if ('quoteExists' in result) {
      return NextResponse.json(
        { error: 'Ce profil est lié à un devis. Créez une révision pour le modifier.' },
        { status: 409 },
      );
    }
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
    return NextResponse.json(
      { error: 'Profil incomplet', unresolvedFields: result.unresolvedFields, missingRequiredFields: result.missingRequiredFields },
      { status: 422 },
    );
  }
  return NextResponse.json({ profil: result.profil });
}
