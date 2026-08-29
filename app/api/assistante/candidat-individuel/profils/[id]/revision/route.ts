/**
 * POST /api/assistante/candidat-individuel/profils/:id/revision — "créer
 * une révision" (mission recâblage §5). Creates a new ProfilCandidat row
 * linked back via previousProfilId, never mutates the row it supersedes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isErrorResponse, type AuthSession } from '@/lib/guards';
import { requireInternalPipelineAccess } from '@/lib/quotes/candidat-individuel-guard.server';
import { createProfilCandidatRevision } from '@/lib/quotes/profil-candidat.server';
import { getCandidatIndividuelStaffProfileView } from '@/lib/quotes/candidat-individuel-staff-view.server';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireInternalPipelineAccess();
  if (isErrorResponse(access)) return access;
  const session = access as AuthSession;

  const { id } = await params;
  const created = await createProfilCandidatRevision(id, session.user.id);
  if (!created) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
  const profil = await getCandidatIndividuelStaffProfileView(created.id);
  if (!profil) return NextResponse.json({ error: 'La révision créée ne peut pas être relue.' }, { status: 500 });
  return NextResponse.json({ profil }, { status: 201 });
}
