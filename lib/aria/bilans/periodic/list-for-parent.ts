/**
 * Parent discoverability for ARIA periodic bilans (P7b-2). Real parent-facing
 * product surface: the child-detail dashboard already mounts
 * `AriaMasteryCard`/`AriaWorkshopsCard` for this exact family+child context
 * (P7a/P7d) — this is the same pattern's third real consumer, never a
 * courseKey-scoped read (a periodic bilan reports on the whole course over
 * time, not a live entitlement check), authorized purely by real parent
 * ownership of the child via `loadChildForParent`.
 *
 * Scoped to `ARIA_PERIODIC` only: the generic `Bilan` model already has
 * other, unrelated parent-visibility gaps for its other types (STAGE_POST
 * etc. have no parent list surface either) — out of this lot's scope to fix.
 */
import { prisma } from '@/lib/prisma';
import { loadChildForParent } from '../../application/parent/load-child-for-parent';
import { buildCanonicalAriaEntitlementContext, resolveAriaCapabilities } from '../../kernel/entitlements';

export interface AriaPeriodicBilanForParent {
  readonly id: string;
  readonly subject: string;
  readonly globalScore: number | null;
  readonly createdAt: Date;
  readonly publishedAt: Date;
}

export async function listAriaPeriodicBilansForParent(input: {
  readonly actor: { readonly userId: string; readonly role: string };
  readonly studentId: string;
}): Promise<readonly AriaPeriodicBilanForParent[]> {
  const student = await loadChildForParent(input.actor.userId, input.studentId);

  // A real, entitled child whose tier doesn't include parent reporting
  // gets a real empty list here, not a thrown error — same reasoning as
  // list-workshops-for-parent.ts's own tier gate. Not course-scoped
  // (unlike that one): a periodic bilan reports on the whole course over
  // time, so the tier check is the child's overall entitlement context.
  const entitlements = buildCanonicalAriaEntitlementContext(student.user.entitlements, new Date());
  if (!resolveAriaCapabilities(entitlements.tier).parentReporting) {
    return Object.freeze([]);
  }

  const rows = await prisma.bilan.findMany({
    where: {
      studentId: student.id,
      type: 'ARIA_PERIODIC',
      isPublished: true,
      parentsMarkdown: { not: null },
    },
    orderBy: { publishedAt: 'desc' },
    select: { id: true, subject: true, globalScore: true, createdAt: true, publishedAt: true },
  });

  return Object.freeze(
    rows
      .filter((row): row is typeof row & { publishedAt: Date } => row.publishedAt !== null)
      .map((row) => ({
        id: row.id,
        subject: row.subject,
        globalScore: row.globalScore,
        createdAt: row.createdAt,
        publishedAt: row.publishedAt,
      })),
  );
}
