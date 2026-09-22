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
import type { PrismaClient } from '@/core-v2/generated/client';
import { assertCapability, type Actor } from '@/lib/core-v2/rbac';
import type { AriaFeatureKey } from '@/lib/aria/cockpit/contracts';

export interface CoreV2AriaEntitlements {
  readonly features: readonly AriaFeatureKey[];
}

/** Active grants for a student, at `now` — a grant past `endsAt` or `status !== ACTIVE` never counts. */
export async function resolveCoreV2AriaEntitlements(
  client: PrismaClient,
  studentId: string,
  now: Date = new Date(),
): Promise<CoreV2AriaEntitlements> {
  const grants = await client.ariaAccessGrant.findMany({
    where: {
      studentId,
      status: 'ACTIVE',
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    select: { featureKey: true },
  });
  const features = [...new Set(grants.map((g) => g.featureKey))] as AriaFeatureKey[];
  return { features };
}

export interface GrantCoreV2AriaAccessInput {
  readonly studentId: string;
  readonly featureKey: AriaFeatureKey;
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
