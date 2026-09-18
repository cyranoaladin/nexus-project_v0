/**
 * P7c: queues the real parent reminder email for every real, still-eligible
 * ARIA collective-workshop registration whose reminder has just become due.
 *
 * Deliberately NOT wired into any live periodic trigger yet — this whole
 * function is inert in production until a future, separate change adds a
 * one-line call to it inside the ALREADY-RUNNING, ALREADY-GENERIC
 * `lib/email/outbox-scheduler.ts` interval (confirmed real: started from
 * `instrumentation.ts` at server boot, ~5s tick, independent of any
 * request). That is the smallest possible production-activation step —
 * documented here rather than performed here, per the explicit "no
 * production deployment or mutation until the final ARIA production GO"
 * instruction this lot was scoped under.
 *
 * Design, and why:
 * - Timezone-safe: reuses the codebase's existing, already-proven
 *   Africa/Tunis (fixed UTC+1, no DST) convention — `combineDateAndTime`
 *   (lib/planning/invariants.ts) + `tunisNowAsPretendUtc`
 *   (lib/planning/series.ts) — rather than inventing a second one.
 * - Idempotent: `AriaWorkshopAttendee.reminderQueuedAt` is a nullable
 *   claim marker, set via a conditional `updateMany({ where: {
 *   reminderQueuedAt: null } })` — an atomic claim under Postgres's
 *   read-committed default, safe under concurrent scans across multiple
 *   app replicas (only one racer's update ever affects a row; the loser
 *   sees `count: 0` and moves on). `enqueueEmailIntent`'s own DB-unique
 *   `idempotencyKey` is a second, independent backstop.
 * - Cancellation/reschedule handled correctly BY CONSTRUCTION, not by an
 *   active cancel hook: eligibility and content are always computed fresh
 *   AT THE DUE MOMENT, directly from current DB state (`session.status`,
 *   current entitlement/tier) — never from a stale snapshot captured at
 *   registration time. A cancelled session is excluded by the `WHERE`
 *   clause itself; there is nothing to reverse.
 * - Expired/revoked entitlement handled the same way: eligibility is
 *   re-derived fresh here, exactly like `authorizeWorkshopCourseForActor`
 *   does for a live registration attempt, reusing its own pure
 *   `decideWorkshopEligibility` — never trusting the eligibility already
 *   proven at registration time.
 */
import { getCourse, isKnownCourseKey } from '@/lib/curriculum/catalog';
import { prisma } from '@/lib/prisma';
import { resolveAriaCourseAccess, type StudentWithEnrollments } from '../../access';
import { toCanonicalAriaCourseKey } from '../../curriculum/course-key-aliases';
import { buildCanonicalAriaEntitlementContext, resolveAriaCapabilities } from '../../kernel/entitlements';
import { combineDateAndTime } from '@/lib/planning/invariants';
import { tunisNowAsPretendUtc } from '@/lib/planning/series';
import { decideWorkshopEligibility } from './authorize';
import { notifyParentWorkshopReminder } from '../../notifications/notify-parent-workshop-reminder';

/** Real product policy: parents are reminded 24h before the real workshop starts. */
export const ARIA_WORKSHOP_REMINDER_OFFSET_HOURS = 24;

export interface QueueDueAriaWorkshopRemindersResult {
  readonly queued: number;
  readonly skippedNotYetEligible: number;
  readonly skippedTooLate: number;
}

export async function queueDueAriaWorkshopReminders(
  now: Date = tunisNowAsPretendUtc(),
): Promise<QueueDueAriaWorkshopRemindersResult> {
  const candidates = await prisma.ariaWorkshopAttendee.findMany({
    where: {
      status: 'REGISTERED',
      reminderQueuedAt: null,
      session: { status: 'SCHEDULED' },
    },
    select: {
      id: true,
      studentId: true,
      sessionId: true,
      session: {
        select: {
          courseKey: true,
          title: true,
          scheduledDate: true,
          startTime: true,
          endTime: true,
          location: true,
        },
      },
    },
  });

  let queued = 0;
  let skippedNotYetEligible = 0;
  let skippedTooLate = 0;

  for (const attendee of candidates) {
    const startInstant = combineDateAndTime(attendee.session.scheduledDate, attendee.session.startTime);
    const dueAt = new Date(startInstant.getTime() - ARIA_WORKSHOP_REMINDER_OFFSET_HOURS * 60 * 60 * 1000);
    if (now < dueAt) continue; // not due yet — leave unclaimed for a later scan.

    // Atomic claim: only the racer whose update actually affects a row
    // (reminderQueuedAt was still null) proceeds. Set unconditionally on
    // this branch — a claimed row is never re-evaluated, whether it ends
    // up sent, skipped as ineligible, or skipped as too late.
    const claim = await prisma.ariaWorkshopAttendee.updateMany({
      where: { id: attendee.id, reminderQueuedAt: null },
      data: { reminderQueuedAt: now },
    });
    if (claim.count === 0) continue; // another replica/tick already claimed this.

    if (now >= startInstant) {
      skippedTooLate++;
      continue;
    }

    const eligible = await isStillEligibleForWorkshop(attendee.studentId, attendee.session.courseKey, now);
    if (!eligible) {
      skippedNotYetEligible++;
      continue;
    }

    await notifyParentWorkshopReminder({
      studentId: attendee.studentId,
      sessionId: attendee.sessionId,
      workshopTitle: attendee.session.title,
      scheduledDate: attendee.session.scheduledDate,
      startTime: attendee.session.startTime,
      endTime: attendee.session.endTime,
      location: attendee.session.location,
    });
    queued++;
  }

  return { queued, skippedNotYetEligible, skippedTooLate };
}

async function isStillEligibleForWorkshop(studentId: string, rawCourseKey: string, now: Date): Promise<boolean> {
  const courseKey = toCanonicalAriaCourseKey(rawCourseKey);
  if (!isKnownCourseKey(courseKey) || !getCourse(courseKey)) return false;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      gradeLevel: true,
      academicTrack: true,
      stmgPathway: true,
      schoolingStatus: true,
      academicEnrollments: { select: { courseKey: true, kind: true, source: true } },
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
  if (!student) return false;

  const studentForAccess: StudentWithEnrollments = {
    id: student.id,
    gradeLevel: student.gradeLevel,
    academicTrack: student.academicTrack,
    stmgPathway: student.stmgPathway,
    schoolingStatus: student.schoolingStatus,
    academicEnrollments: student.academicEnrollments,
  };
  const entitlements = buildCanonicalAriaEntitlementContext(student.user.entitlements, now);
  const capabilities = resolveAriaCapabilities(entitlements.tier);
  const access = resolveAriaCourseAccess({ courseKey, student: studentForAccess, entitlements });

  try {
    decideWorkshopEligibility(access, capabilities);
    return true;
  } catch {
    return false;
  }
}
