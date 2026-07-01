/**
 * POST /api/admin/config/rollback — Rollback a config entry to its previous value
 *
 * Guard: ADMIN only. Uses advisory lock for serialization (same as PATCH).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import {
  applyWrite,
  SCHEMA_VERSION,
  validateConfigEntry,
  validateCrossInvariants,
} from '@/lib/config';
import type { AuthSession } from '@/lib/guards';

const CONFIG_ADVISORY_LOCK_KEY = 737001;

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
  if (typeof namespace !== 'string' || !namespace || typeof key !== 'string' || !key) {
    return NextResponse.json(
      { error: 'Missing required fields: namespace, key' },
      { status: 400 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock($1)', CONFIG_ADVISORY_LOCK_KEY);

    const existing = await tx.businessConfig.findUnique({
      where: { namespace_key: { namespace, key } },
    });

    if (!existing) {
      return { rejected: true as const, status: 404, error: 'Entry not found' };
    }
    if (existing.previousValue === null) {
      return { rejected: true as const, status: 400, error: 'No previous value to rollback to' };
    }

    const prevValue = existing.previousValue;
    const validation = validateConfigEntry(namespace, key, prevValue);
    if (!validation.valid) {
      return { rejected: true as const, status: 400, error: `Previous value fails validation: ${validation.error}` };
    }

    const dbEntries = await tx.businessConfig.findMany();
    const dbResolver = (ns: string, k: string): unknown | null => {
      const row = dbEntries.find((r) => r.namespace === ns && r.key === k);
      return row?.value ?? null;
    };
    const violations = validateCrossInvariants(namespace, key, prevValue, dbResolver);
    if (violations.length > 0) {
      return { rejected: true as const, status: 400, error: 'Rollback would violate invariants', violations };
    }

    const entry = await tx.businessConfig.update({
      where: { namespace_key: { namespace, key } },
      data: {
        value: prevValue as import('@prisma/client').Prisma.InputJsonValue,
        previousValue: existing.value as import('@prisma/client').Prisma.InputJsonValue,
        version: existing.version + 1,
        schemaVersion: SCHEMA_VERSION,
        updatedBy: session.user.id,
      },
    });

    await tx.businessConfigAudit.create({
      data: {
        namespace,
        key,
        oldValue: existing.value as import('@prisma/client').Prisma.InputJsonValue,
        newValue: prevValue as import('@prisma/client').Prisma.InputJsonValue,
        version: entry.version,
        changedBy: session.user.id,
      },
    });

    return { rejected: false as const, entry };
  });

  if (result.rejected) {
    return NextResponse.json(
      { error: result.error, ...('violations' in result ? { violations: result.violations } : {}) },
      { status: result.status },
    );
  }

  applyWrite({
    namespace: result.entry.namespace,
    key: result.entry.key,
    value: result.entry.value,
    schemaVersion: result.entry.schemaVersion,
    version: result.entry.version,
    updatedBy: result.entry.updatedBy,
    updatedAt: result.entry.updatedAt,
  });

  return NextResponse.json({ entry: result.entry, rolledBack: true });
}
