/**
 * GET  /api/planning-studio  — planning canonique (ADMIN, ASSISTANTE, COACH)
 *                              ?meta=1 : révision seule (sondage léger)
 * PUT  /api/planning-studio  — nouvelle révision sous verrou optimiste
 *                              (ADMIN, ASSISTANTE ; RESET réservé à ADMIN)
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiGuard } from '@/lib/api-guard';
import { isErrorResponse } from '@/lib/guards';
import { planningStudioPermissions } from '@/lib/planning-studio/access';
import { actorFromUser } from '@/lib/planning-studio/service';
import { planningErrorResponse, planningService } from './_shared';

const putSchema = z.object({
  expectedRevision: z.number().int().min(0),
  payload: z.record(z.string(), z.unknown()).optional(),
  action: z.enum(['SAVE', 'IMPORT', 'RESET']).default('SAVE'),
  summary: z.string().max(200).optional(),
});

export async function GET(request: NextRequest) {
  const guard = await apiGuard({ policy: 'planning-studio.read' });
  if (isErrorResponse(guard)) return guard;
  try {
    const doc = await planningService.getOrInitDocument(guard.user.id);
    const permissions = planningStudioPermissions(guard.user.role);
    const meta = {
      academicYear: doc.academicYear,
      schemaVersion: doc.schemaVersion,
      revision: doc.revision,
      updatedAt: doc.updatedAt,
      updatedBy: actorFromUser(doc.updatedBy),
      payloadHash: doc.payloadHash,
    };
    if (request.nextUrl.searchParams.get('meta') === '1') {
      return NextResponse.json({ document: meta }, { headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json(
      {
        document: meta,
        payload: doc.payload,
        permissions,
        viewer: { id: guard.user.id, role: guard.user.role, name: [guard.user.firstName, guard.user.lastName].filter(Boolean).join(' ').trim() || guard.user.name || guard.user.email },
        initialized: doc.initialized,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return planningErrorResponse(err);
  }
}

export async function PUT(request: NextRequest) {
  const guard = await apiGuard({ policy: 'planning-studio.write' });
  if (isErrorResponse(guard)) return guard;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'PLANNING_BAD_REQUEST', message: 'Corps JSON invalide.' }, { status: 400 });
  }
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'PLANNING_BAD_REQUEST', message: 'Requête invalide.', issues: parsed.error.issues }, { status: 400 });
  }
  const permissions = planningStudioPermissions(guard.user.role);
  try {
    if (parsed.data.action === 'RESET') {
      if (!permissions.canReset) return NextResponse.json({ error: 'Forbidden', message: 'Réinitialisation réservée à la direction.' }, { status: 403 });
      const result = await planningService.resetToBootstrap({ expectedRevision: parsed.data.expectedRevision, actorId: guard.user.id });
      return NextResponse.json(result);
    }
    if (parsed.data.action === 'IMPORT' && !permissions.canImport) {
      return NextResponse.json({ error: 'Forbidden', message: 'Import non autorisé pour ce rôle.' }, { status: 403 });
    }
    if (!parsed.data.payload) {
      return NextResponse.json({ error: 'PLANNING_BAD_REQUEST', message: 'Charge utile « payload » requise.' }, { status: 400 });
    }
    const result = await planningService.saveDocument({
      expectedRevision: parsed.data.expectedRevision,
      payload: parsed.data.payload,
      actorId: guard.user.id,
      action: parsed.data.action,
      summary: parsed.data.summary ?? null,
    });
    return NextResponse.json(result);
  } catch (err) {
    return planningErrorResponse(err);
  }
}
