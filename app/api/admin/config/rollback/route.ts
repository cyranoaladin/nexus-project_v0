/**
 * POST /api/admin/config/rollback — Rollback a config entry to its previous value
 *
 * Guard: ADMIN only
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import {
  invalidateSnapshot,
  SCHEMA_VERSION,
  validateConfigEntry,
  validateCrossInvariants,
} from '@/lib/config';
import type { AuthSession } from '@/lib/guards';

export async function POST(request: NextRequest) {
  const auth = await requireRole('ADMIN');
  if (isErrorResponse(auth)) return auth;
  const session = auth as AuthSession;

  let body: { namespace: string; key: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { namespace, key } = body;
  if (!namespace || !key) {
    return NextResponse.json(
      { error: 'Missing required fields: namespace, key' },
      { status: 400 },
    );
  }

  const existing = await prisma.businessConfig.findUnique({
    where: { namespace_key: { namespace, key } },
  });

  if (!existing) {
    return NextResponse.json(
      { error: 'Entry not found' },
      { status: 404 },
    );
  }

  if (existing.previousValue === null) {
    return NextResponse.json(
      { error: 'No previous value to rollback to' },
      { status: 400 },
    );
  }

  const prevValue = existing.previousValue;

  // Validate the rollback value
  const validation = validateConfigEntry(namespace, key, prevValue);
  if (!validation.valid) {
    return NextResponse.json(
      { error: 'Previous value fails validation', details: validation.error },
      { status: 400 },
    );
  }

  const invariantViolations = validateCrossInvariants(namespace, key, prevValue);
  if (invariantViolations.length > 0) {
    return NextResponse.json(
      { error: 'Rollback would violate invariants', violations: invariantViolations },
      { status: 400 },
    );
  }

  const entry = await prisma.businessConfig.update({
    where: { namespace_key: { namespace, key } },
    data: {
      value: prevValue as any,
      previousValue: existing.value as any,
      version: existing.version + 1,
      schemaVersion: SCHEMA_VERSION,
      updatedBy: session.user.id,
    },
  });

  await invalidateSnapshot();

  return NextResponse.json({ entry, rolledBack: true });
}
