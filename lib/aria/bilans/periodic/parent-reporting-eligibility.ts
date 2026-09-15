/**
 * Shared gate for "can this parent see ARIA_PERIODIC bilan content for
 * this child?" — the same `parentReporting` capability check
 * `listAriaPeriodicBilansForParent` already applies to the list. Used by
 * the detail read (`GET /api/bilans/[id]`), which — a prior audit found —
 * had silently drifted from the list by never applying this gate at all.
 *
 * Entitlements are attached to the CHILD's own `User` row
 * (`Entitlement.userId` = the beneficiary student, never the paying
 * parent — see `lib/aria/application/parent/load-child-for-parent.ts`,
 * which reads `student.user.entitlements` for the exact same reason), so
 * this reads `student.user.entitlements`, not the parent's.
 *
 * `resolvePeriodicBilanNotificationIntent` (the publish notification)
 * applies the identical rule via the same two kernel functions
 * (`buildCanonicalAriaEntitlementContext` + `resolveAriaCapabilities`),
 * but through its own query rather than a call to this function: it
 * already needs the parent's name/email in the same round trip, so
 * folding the child's entitlements into that one query is cheaper than a
 * second lookup here. The RULE is not duplicated — only the query shape
 * is, for a real, deliberate performance reason.
 */
import { prisma } from '@/lib/prisma';
import { buildCanonicalAriaEntitlementContext, resolveAriaCapabilities } from '../../kernel/entitlements';

export async function isParentReportingEligibleForStudent(
  studentId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      user: {
        select: {
          entitlements: {
            select: {
              id: true,
              productCode: true,
              status: true,
              startsAt: true,
              endsAt: true,
              ariaTier: true,
              ariaScopes: { select: { kind: true, courseKey: true } },
            },
          },
        },
      },
    },
  });
  const studentEntitlements = student?.user.entitlements;
  if (!studentEntitlements) return false;
  const entitlements = buildCanonicalAriaEntitlementContext(studentEntitlements, now);
  return resolveAriaCapabilities(entitlements.tier).parentReporting;
}
