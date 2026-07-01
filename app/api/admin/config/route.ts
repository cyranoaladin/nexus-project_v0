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
  applyWrite,
  ensureFresh,
  getStaticFallback,
  getValidNamespaces,
  getNamespaceKeys,
  SCHEMA_VERSION,
  validateConfigEntry,
  validateCrossInvariants,
  CONFIG_ADVISORY_LOCK_KEY,
} from '@/lib/config';
import type { AuthSession } from '@/lib/guards';

// Advisory lock key for serializing config writes. All config writes
// share the same lock — config changes are rare (admin-only), so
// serialization is the simplest correct solution for cross-key invariants.
 // arbitrary stable int

export async function GET() {
  const auth = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
  if (isErrorResponse(auth)) return auth;

  await ensureFresh();

  // Build effective entries: override if exists, else canonical fallback.
  // Each entry marked with source: 'override' | 'fallback'.
  const overrides = getAllEntries();
  const overrideMap = new Map(overrides.map((e) => [`${e.namespace}::${e.key}`, e]));
  const entries: Array<{ namespace: string; key: string; value: unknown; source: 'override' | 'fallback' }> = [];

  for (const ns of getValidNamespaces()) {
    const keys = getNamespaceKeys(ns);
    if (keys) {
      for (const key of keys) {
        const override = overrideMap.get(`${ns}::${key}`);
        if (override) {
          entries.push({ namespace: ns, key, value: override.value, source: 'override' });
        } else {
          const fallback = getStaticFallback(ns, key);
          if (fallback !== null) {
            entries.push({ namespace: ns, key, value: fallback, source: 'fallback' });
          }
        }
      }
    }
  }

  // Also include any overrides for open-ended namespaces (products.credits)
  for (const override of overrides) {
    if (!entries.some((e) => e.namespace === override.namespace && e.key === override.key)) {
      entries.push({ namespace: override.namespace, key: override.key, value: override.value, source: 'override' });
    }
  }

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
  if (typeof namespace !== 'string' || !namespace || typeof key !== 'string' || !key || value === undefined) {
    return NextResponse.json(
      { error: 'Missing required fields: namespace, key, value' },
      { status: 400 },
    );
  }

  // Per-key Zod validation (stateless — can run outside transaction)
  const validation = validateConfigEntry(namespace, key, value);
  if (!validation.valid) {
    return NextResponse.json(
      { error: 'Validation failed', details: validation.error },
      { status: 400 },
    );
  }

  // Fast-reject: check invariants against snapshot (catches obvious violations
  // without a DB round-trip). The authoritative check happens inside the transaction.
  await ensureFresh();
  const fastReject = validateCrossInvariants(namespace, key, value);
  if (fastReject.length > 0) {
    return NextResponse.json(
      { error: 'Invariant violation', violations: fastReject },
      { status: 400 },
    );
  }

  // Serialized write: advisory lock + transactional invariant check + upsert.
  // The advisory lock serializes ALL config writes so cross-key invariants
  // cannot be bypassed by concurrent PATCHes on related keys (TOCTOU fix).
  const result = await prisma.$transaction(async (tx) => {
    // Acquire advisory lock — released when the transaction ends
    await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock($1)', CONFIG_ADVISORY_LOCK_KEY);

    // Read ALL config entries for this namespace from the DB (not snapshot)
    // to build a transactional resolver for cross-key invariants.
    const dbEntries = await tx.businessConfig.findMany();
    const dbResolver = (ns: string, k: string): unknown | null => {
      const row = dbEntries.find((r) => r.namespace === ns && r.key === k);
      return row?.value ?? null;
    };

    // Authoritative invariant check against the transactional DB state
    const invariantViolations = validateCrossInvariants(namespace, key, value, dbResolver);
    if (invariantViolations.length > 0) {
      return { rejected: true as const, violations: invariantViolations };
    }

    // Upsert with version increment
    const existing = await tx.businessConfig.findUnique({
      where: { namespace_key: { namespace, key } },
    });

    const entry = await tx.businessConfig.upsert({
      where: { namespace_key: { namespace, key } },
      create: {
        namespace,
        key,
        value: value as import('@prisma/client').Prisma.InputJsonValue,
        schemaVersion: SCHEMA_VERSION,
        version: 1,
        updatedBy: session.user.id,
      },
      update: {
        value: value as import('@prisma/client').Prisma.InputJsonValue,
        schemaVersion: SCHEMA_VERSION,
        version: (existing?.version ?? 0) + 1,
        previousValue: existing?.value as import('@prisma/client').Prisma.InputJsonValue ?? undefined,
        updatedBy: session.user.id,
      },
    });

    // Audit trail — append-only, same transaction
    await tx.businessConfigAudit.create({
      data: {
        namespace,
        key,
        oldValue: existing?.value as import('@prisma/client').Prisma.InputJsonValue ?? undefined,
        newValue: value as import('@prisma/client').Prisma.InputJsonValue,
        version: entry.version,
        changedBy: session.user.id,
      },
    });

    return { rejected: false as const, entry };
  });

  if (result.rejected) {
    return NextResponse.json(
      { error: 'Invariant violation', violations: result.violations },
      { status: 400 },
    );
  }

  // Apply committed entry to snapshot (synchronous, version-ordered)
  applyWrite({
    namespace: result.entry.namespace,
    key: result.entry.key,
    value: result.entry.value,
    schemaVersion: result.entry.schemaVersion,
    version: result.entry.version,
    updatedBy: result.entry.updatedBy,
    updatedAt: result.entry.updatedAt,
  });

  return NextResponse.json({ entry: result.entry });
}
