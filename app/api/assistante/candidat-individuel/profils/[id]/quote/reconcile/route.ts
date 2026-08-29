import { NextRequest, NextResponse } from 'next/server';
import { isErrorResponse } from '@/lib/guards';
import { requireInternalPipelineAccess } from '@/lib/quotes/candidat-individuel-guard.server';
import { getCandidatIndividuelStaffQuoteViewByIdempotencyKey } from '@/lib/quotes/candidat-individuel-staff-view.server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireInternalPipelineAccess();
  if (isErrorResponse(access)) return access;

  const json = await request.json().catch(() => null) as { idempotencyKey?: unknown } | null;
  const idempotencyKey = typeof json?.idempotencyKey === 'string' ? json.idempotencyKey.trim() : '';
  if (idempotencyKey.length === 0 || idempotencyKey.length > 200) {
    return NextResponse.json({ error: 'Clé de tentative invalide.' }, { status: 400 });
  }

  const { id } = await params;
  const quote = await getCandidatIndividuelStaffQuoteViewByIdempotencyKey(id, idempotencyKey);
  if (!quote) {
    return NextResponse.json({ error: 'Aucun devis ne correspond à cette tentative.' }, { status: 404 });
  }
  return NextResponse.json({ quote });
}
