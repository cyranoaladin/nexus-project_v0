/**
 * ARIA product-right authorization for Core v2 identities.
 *
 * `AriaAccessGrant` is an explicit, auditable authorization record — NOT a
 * second billing engine. Subscription/Entitlement remain the legacy,
 * V1-Student-keyed commercial authority (Phase 11, deliberately out of
 * scope of the Core v2 redesign — see core-v2/prisma/schema.prisma). "A
 * Core v2 Student row exists" must never be read as "ARIA is authorized":
 * every feature check here goes through a real grant row, granted or
 * revoked only via `grantCoreV2AriaAccess`/`revokeCoreV2AriaAccess` (the
 * one normal operator mechanism — never a hardcoded account id).
 */
import type {
  AriaAccessGrantStatus,
  CoreV2AriaTier,
  PrismaClient,
} from '@/core-v2/generated/client';
import { assertCapability, type Actor } from '@/lib/core-v2/rbac';
import { ARIA_FEATURE_KEYS, type AriaFeatureKey } from '@/lib/aria/cockpit/contracts';
import {
  buildCanonicalAriaEntitlementContext,
  resolveAriaCapabilities,
  type AriaCapabilities,
  type AriaEntitlementRecord,
  type CanonicalAriaEntitlementContext,
} from '@/lib/aria/kernel/entitlements';

export interface CoreV2AriaAccessGrantRecord {
  readonly id: string;
  readonly featureKey: AriaFeatureKey;
  readonly courseScopes: readonly string[];
  readonly status: AriaAccessGrantStatus;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly ariaTier: CoreV2AriaTier;
}

const ARIA_FEATURE_KEY_SET: ReadonlySet<string> = new Set(ARIA_FEATURE_KEYS);

function isAriaFeatureKey(value: string): value is AriaFeatureKey {
  return ARIA_FEATURE_KEY_SET.has(value);
}

export interface CoreV2AriaEntitlements {
  readonly aggregate: CanonicalAriaEntitlementContext;
  readonly byFeatureKey: ReadonlyMap<AriaFeatureKey, CanonicalAriaEntitlementContext>;
  readonly capabilities: AriaCapabilities;
}

/** Pure, lossless mapping into the shared ARIA entitlement kernel contract. */
export function adaptCoreV2AriaAccessGrant(
  grant: CoreV2AriaAccessGrantRecord,
): AriaEntitlementRecord {
  return {
    id: grant.id,
    productCode: 'ARIA_ACCESS',
    status: grant.status,
    startsAt: grant.startsAt,
    endsAt: grant.endsAt,
    ariaTier: grant.ariaTier,
    ariaScopes: grant.courseScopes.length === 0
      ? [{ kind: 'GLOBAL', courseKey: null }]
      : grant.courseScopes.map((courseKey) => ({ kind: 'COURSE' as const, courseKey })),
  };
}

/** Maps every row: status/date validity belongs exclusively to the canonical kernel. */
export function adaptCoreV2AriaAccessGrants(
  grants: readonly CoreV2AriaAccessGrantRecord[],
): readonly AriaEntitlementRecord[] {
  return grants.map(adaptCoreV2AriaAccessGrant);
}

/**
 * Builds both entitlement dimensions without reimplementing kernel rules:
 * aggregate tier capabilities, and feature-preserving course authorization.
 */
export function buildCoreV2AriaEntitlements(
  grants: readonly CoreV2AriaAccessGrantRecord[],
  now: Date,
): CoreV2AriaEntitlements {
  const canonicalRecords = adaptCoreV2AriaAccessGrants(grants);
  const aggregate = buildCanonicalAriaEntitlementContext(canonicalRecords, now);
  const recordsByFeature = new Map<AriaFeatureKey, AriaEntitlementRecord[]>();

  grants.forEach((grant, index) => {
    const records = recordsByFeature.get(grant.featureKey) ?? [];
    records.push(canonicalRecords[index]!);
    recordsByFeature.set(grant.featureKey, records);
  });

  const byFeatureKey = new Map<AriaFeatureKey, CanonicalAriaEntitlementContext>();
  for (const [featureKey, records] of recordsByFeature) {
    byFeatureKey.set(featureKey, buildCanonicalAriaEntitlementContext(records, now));
  }

  return {
    aggregate,
    byFeatureKey,
    capabilities: resolveAriaCapabilities(aggregate.tier),
  };
}

/**
 * Loads the complete authorization projection for one student. Deliberately
 * no status/date predicate: the canonical kernel is the sole validity engine.
 */
export async function loadCoreV2AriaAccessGrants(
  client: PrismaClient,
  studentId: string,
): Promise<CoreV2AriaAccessGrantRecord[]> {
  const rows = await client.ariaAccessGrant.findMany({
    where: { studentId },
    select: {
      id: true,
      featureKey: true,
      courseScopes: true,
      status: true,
      startsAt: true,
      endsAt: true,
      ariaTier: true,
    },
  });
  return rows.flatMap((row) => (
    isAriaFeatureKey(row.featureKey) ? [{ ...row, featureKey: row.featureKey }] : []
  ));
}

/** Resolve one student's grants exclusively through the shared canonical kernel. */
export async function resolveCoreV2AriaEntitlements(
  client: PrismaClient,
  studentId: string,
  now: Date = new Date(),
): Promise<CoreV2AriaEntitlements> {
  const grants = await loadCoreV2AriaAccessGrants(client, studentId);
  return buildCoreV2AriaEntitlements(grants, now);
}

export interface GrantCoreV2AriaAccessInput {
  readonly studentId: string;
  readonly featureKey: AriaFeatureKey;
  readonly ariaTier?: CoreV2AriaTier;
  readonly courseScopes?: readonly string[];
  readonly endsAt?: Date | null;
  readonly source?: string;
}

/** ADMIN-only: the normal way a Core v2 student gets ARIA access — never hardcoded in application code. */
export async function grantCoreV2AriaAccess(
  client: PrismaClient,
  actor: Actor,
  input: GrantCoreV2AriaAccessInput,
) {
  assertCapability(actor, 'ARIA_ACCESS_GRANT');
  return client.ariaAccessGrant.create({
    data: {
      studentId: input.studentId,
      featureKey: input.featureKey,
      ariaTier: input.ariaTier,
      courseScopes: [...(input.courseScopes ?? [])],
      endsAt: input.endsAt ?? null,
      grantedById: actor.userId,
      source: input.source ?? null,
    },
  });
}

/** ADMIN-only: revokes a grant (status transition, never a delete — the record stays for audit). */
export async function revokeCoreV2AriaAccess(client: PrismaClient, actor: Actor, grantId: string) {
  assertCapability(actor, 'ARIA_ACCESS_GRANT');
  return client.ariaAccessGrant.update({
    where: { id: grantId },
    data: { status: 'REVOKED' },
  });
}

export async function listCoreV2AriaAccessGrants(client: PrismaClient, actor: Actor, studentId: string) {
  assertCapability(actor, 'ARIA_ACCESS_GRANT');
  return client.ariaAccessGrant.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
  });
}
