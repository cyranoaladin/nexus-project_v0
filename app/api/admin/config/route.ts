/**
 * GET  /api/admin/config — Read all config entries + fallbacks
 * PATCH /api/admin/config — Write/update a single config entry
 *
 * Guards: ADMIN only (PATCH), ADMIN+ASSISTANTE (GET — read-only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, requireAnyRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import {
  getAllEntries,
  invalidateSnapshot,
  SCHEMA_VERSION,
  validateConfigEntry,
  validateCrossInvariants,
} from '@/lib/config';
import type { AuthSession } from '@/lib/guards';

export async function GET() {
  const auth = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
  if (isErrorResponse(auth)) return auth;

  const entries = getAllEntries();
  return NextResponse.json({ entries });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRole('ADMIN');
  if (isErrorResponse(auth)) return auth;
  const session = auth as AuthSession;

  let body: { namespace: string; key: string; value: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { namespace, key, value } = body;
  if (!namespace || !key || value === undefined) {
    return NextResponse.json(
      { error: 'Missing required fields: namespace, key, value' },
      { status: 400 },
    );
  }

  // Per-key Zod validation
  const validation = validateConfigEntry(namespace, key, value);
  if (!validation.valid) {
    return NextResponse.json(
      { error: 'Validation failed', details: validation.error },
      { status: 400 },
    );
  }

  // Cross-namespace invariants
  const invariantViolations = validateCrossInvariants(namespace, key, value);
  if (invariantViolations.length > 0) {
    return NextResponse.json(
      { error: 'Invariant violation', violations: invariantViolations },
      { status: 400 },
    );
  }

  // DB write: upsert with versioning
  const existing = await prisma.businessConfig.findUnique({
    where: { namespace_key: { namespace, key } },
  });

  const entry = await prisma.businessConfig.upsert({
    where: { namespace_key: { namespace, key } },
    create: {
      namespace,
      key,
      value: value as any,
      schemaVersion: SCHEMA_VERSION,
      version: 1,
      updatedBy: session.user.id,
    },
    update: {
      value: value as any,
      schemaVersion: SCHEMA_VERSION,
      version: existing ? existing.version + 1 : 1,
      previousValue: existing?.value ?? undefined,
      updatedBy: session.user.id,
    },
  });

  // RULE: commit FIRST, then await invalidateSnapshot()
  await invalidateSnapshot();

  return NextResponse.json({ entry });
}
