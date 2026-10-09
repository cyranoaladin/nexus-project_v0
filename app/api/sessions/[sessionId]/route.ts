import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { SessionStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { tunisWallClockToUtcInstant } from '@/lib/planning/invariants';
import { resolveJitsiRoomNameForSession } from '@/lib/jitsi-server';
import { getVideoMode } from '@/lib/video-mode';
import { familyAuthorityAvailable, familyReadAllowed, resolveParentStudentAccess } from '@/lib/families/student-access-authority';

/**
 * /api/sessions/[sessionId] — the real backend for the video join flow
 * (app/session/video/page.tsx). Replaces the previous, entirely dead
 * app/api/sessions/video/route.ts (never called by any client — the page
 * called this exact path and always got a 404, since it didn't exist) and
 * the client-side, non-deterministic room-name generation the page used
 * to fall back to (`session-${sessionId}-${Date.now()}`, which gave every
 * participant a different, private room).
 *
 * GET is read-only (a private, non-cacheable status check) and never mutates the
 * booking. POST is the explicit join action: same checks as GET, plus the
 * SCHEDULED→IN_PROGRESS transition — an HTTP GET must never have a side
 * effect (a browser prefetch, retry, or link preview could otherwise
 * silently flip a session to IN_PROGRESS before anyone actually joined).
 *
 * Ownership is scoped strictly server-side to the booking's own
 * student/coach/parent (never a client-supplied id). Whether staff
 * (ADMIN/ASSISTANTE) should also be able to open a session they are not
 * assigned to (supervision) is a real, open product question — not
 * decided here; see the go-live audit's blocker register.
 */

function videoJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.append('Vary', 'Cookie, Authorization');
  return NextResponse.json(body, { ...init, headers });
}

const JOIN_EARLY_WINDOW_MS = 15 * 60 * 1000;
const JOIN_LATE_TOLERANCE_MS = 30 * 60 * 1000;

/** 503 VIDEO_DISABLED means video join is unavailable on this Preview. */
function videoDisabledResponse() {
  return videoJson(
    { error: 'VIDEO_DISABLED', message: 'Visioconférence intégrée non activée sur cette Preview.' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

interface JoinableBookingSession {
  id: string;
  studentId: string;
  coachId: string;
  scheduledDate: Date;
  startTime: string;
  duration: number;
  status: SessionStatus;
  subject: string;
  student: { firstName: string | null; lastName: string | null };
  coach: { firstName: string | null; lastName: string | null };
}

type ResolveResult =
  | { ok: true; booking: JoinableBookingSession; sessionStart: Date }
  | { ok: false; response: NextResponse };

/**
 * Loads the booking, checks ownership, lifecycle status, and the join
 * time window. Shared by GET (read-only) and POST (join, mutates) so the
 * two never drift — the eligibility rule is defined exactly once.
 */
async function resolveJoinableBooking(
  sessionId: string, subject: { id: string; role?: string }, action: 'read' | 'mutation',
): Promise<ResolveResult> {
  let participantWhere: { studentId: string } | { coachId: string };
  if (subject.role === 'ELEVE') participantWhere = { studentId: subject.id };
  else if (subject.role === 'COACH') participantWhere = { coachId: subject.id };
  else if (subject.role === 'PARENT') {
    const identity = await prisma.sessionBooking.findFirst({
      where: { id: sessionId }, select: { studentId: true },
    });
    const student = identity ? await prisma.student.findUnique({
      where: { userId: identity.studentId }, select: { id: true },
    }) : null;
    if (!student || !identity) {
      // While family authority is down, an unknown session answers like a known one.
      return { ok: false, response: await familyAuthorityAvailable(subject.id)
        ? videoJson({ error: 'Session non trouvée' }, { status: 404 })
        : videoJson({ error: 'Family authority unavailable' }, { status: 503 }) };
    }
    const decision = await resolveParentStudentAccess(subject.id, student.id, action);
    if (decision.status === 'AUTHORITY_UNAVAILABLE') {
      return { ok: false, response: videoJson({ error: 'Family authority unavailable' }, { status: 503 }) };
    }
    if (!(action === 'read' ? familyReadAllowed(decision) : decision.status === 'LEGACY_ALLOWED')) {
      return { ok: false, response: videoJson({ error: 'Session non trouvée' }, { status: 404 }) };
    }
    participantWhere = { studentId: identity.studentId };
  } else {
    return { ok: false, response: videoJson({ error: 'Session non trouvée' }, { status: 404 }) };
  }
  const bookingSession = await prisma.sessionBooking.findFirst({
    where: {
      id: sessionId,
      ...participantWhere,
    },
    select: {
      id: true,
      studentId: true,
      coachId: true,
      scheduledDate: true,
      startTime: true,
      duration: true,
      status: true,
      subject: true,
      student: { select: { firstName: true, lastName: true } },
      coach: { select: { firstName: true, lastName: true } },
    },
  });

  if (!bookingSession) {
    return { ok: false, response: videoJson({ error: 'Session non trouvée' }, { status: 404 }) };
  }

  // A cancelled or already-completed booking is never joinable, no
  // matter the time window — the dead code this replaces had no such
  // guard at all.
  if (bookingSession.status === SessionStatus.CANCELLED) {
    return { ok: false, response: videoJson({ error: 'Cette session a été annulée.' }, { status: 410 }) };
  }
  if (bookingSession.status === SessionStatus.COMPLETED) {
    return { ok: false, response: videoJson({ error: 'Cette session est déjà terminée.' }, { status: 410 }) };
  }

  const sessionStart = tunisWallClockToUtcInstant(bookingSession.scheduledDate, bookingSession.startTime);
  const sessionEnd = new Date(sessionStart.getTime() + bookingSession.duration * 60 * 1000);
  const now = new Date();

  if (now.getTime() < sessionStart.getTime() - JOIN_EARLY_WINDOW_MS) {
    return { ok: false, response: videoJson({ error: "La session n'est pas encore disponible." }, { status: 400 }) };
  }
  // The previous logic only checked "too early" despite its own error
  // message claiming to also cover "or a expiré" — there was no upper
  // bound at all. A session stays joinable up to 30 minutes past its
  // scheduled end before being treated as expired.
  if (now.getTime() > sessionEnd.getTime() + JOIN_LATE_TOLERANCE_MS) {
    return { ok: false, response: videoJson({ error: 'La fenêtre de cette session a expiré.' }, { status: 410 }) };
  }

  return { ok: true, booking: bookingSession, sessionStart };
}

function serializeBooking(booking: JoinableBookingSession, sessionStart: Date, displayStatus: SessionStatus) {
  // Deterministic AND stable for the booking: every participant who
  // calls this endpoint for the same sessionId gets the exact same
  // room name, every time — never regenerated per call (the bug this
  // replaces: both the page and the old dead route minted a fresh
  // random/Date.now()-seeded name on every request, so the coach and
  // the student never landed in the same Jitsi room).
  const roomName = resolveJitsiRoomNameForSession(booking.id);

  return {
    id: booking.id,
    studentName: `${booking.student.firstName ?? ''} ${booking.student.lastName ?? ''}`.trim(),
    coachName: `${booking.coach.firstName ?? ''} ${booking.coach.lastName ?? ''}`.trim(),
    subject: booking.subject,
    scheduledAt: sessionStart.toISOString(),
    duration: booking.duration,
    status: displayStatus,
    roomName,
  };
}

async function guardRequest(request: NextRequest) {
  // Same registered scopes (lib/rate-limit/sensitive.ts) for GET and POST:
  // both hit the same booking lookup and are worth rate-limiting
  // identically — no need for the read/join split to also fork the
  // rate-limit registry.
  const ipBlocked = await guardSensitiveRateLimit(request, {
    scope: 'session-video-ip',
    dimensions: ['ip'],
  });
  if (ipBlocked) {
    ipBlocked.headers.set('Cache-Control', 'private, no-store');
    ipBlocked.headers.append('Vary', 'Cookie, Authorization');
    return { blocked: ipBlocked, session: null };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { blocked: videoJson({ error: 'Non autorisé' }, { status: 401 }), session: null };
  }

  const userBlocked = await guardSensitiveRateLimit(request, {
    scope: 'session-video-user',
    identity: session.user.id,
    dimensions: ['identity'],
  });
  if (userBlocked) {
    userBlocked.headers.set('Cache-Control', 'private, no-store');
    userBlocked.headers.append('Vary', 'Cookie, Authorization');
    return { blocked: userBlocked, session: null };
  }

  return { blocked: null, session };
}

/** Read-only status check — never mutates the booking. */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { blocked, session } = await guardRequest(request);
    if (blocked) return blocked;

    const { sessionId } = await params;
    if (!sessionId || sessionId.length > 128) {
      return videoJson({ error: 'ID de session invalide' }, { status: 400 });
    }

    const resolved = await resolveJoinableBooking(sessionId, session!.user, 'read');
    if (!resolved.ok) return resolved.response;

    if (getVideoMode() === 'DISABLED') return videoDisabledResponse();

    return videoJson(
      serializeBooking(resolved.booking, resolved.sessionStart, resolved.booking.status)
    );
  } catch {
    console.error('SESSION_VIDEO_READ_FAILED');
    return videoJson({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Explicit join action — same eligibility as GET, plus the SCHEDULED→IN_PROGRESS transition. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { blocked, session } = await guardRequest(request);
    if (blocked) return blocked;

    const { sessionId } = await params;
    if (!sessionId || sessionId.length > 128) {
      return videoJson({ error: 'ID de session invalide' }, { status: 400 });
    }

    const resolved = await resolveJoinableBooking(sessionId, session!.user, 'mutation');
    if (!resolved.ok) return resolved.response;

    if (getVideoMode() === 'DISABLED') return videoDisabledResponse();

    let displayStatus = resolved.booking.status;
    if (resolved.booking.status === SessionStatus.SCHEDULED) {
      // TOCTOU guard: `resolveJoinableBooking` above only PROVES the booking
      // was SCHEDULED at read time. Without a conditional write, a CANCEL or
      // COMPLETE committing in the gap between that read and this write would
      // be silently overwritten back to IN_PROGRESS by an unconditional
      // update — resurrecting a terminal booking. `updateMany`'s WHERE
      // clause makes the SCHEDULED->IN_PROGRESS transition a single atomic
      // compare-and-swap at the database level: it can only ever affect a
      // row that is STILL SCHEDULED at the instant Postgres executes it.
      const transition = await prisma.sessionBooking.updateMany({
        where: { id: sessionId, status: SessionStatus.SCHEDULED,
          studentId: resolved.booking.studentId, coachId: resolved.booking.coachId },
        data: { status: SessionStatus.IN_PROGRESS },
      });

      if (transition.count === 0) {
        // Lost the race: something else changed the booking's status between
        // our read and this write. Re-resolve from scratch rather than
        // trusting anything we read earlier — this reuses the exact same
        // eligibility/messaging rules as GET (CANCELLED -> 410 "annulée",
        // COMPLETED -> 410 "terminée"), and if the booking is already
        // IN_PROGRESS (a concurrent join won first), that is a valid,
        // idempotent outcome, not an error.
        const reResolved = await resolveJoinableBooking(sessionId, session!.user, 'mutation');
        if (!reResolved.ok) return reResolved.response;
        if (reResolved.booking.status === SessionStatus.SCHEDULED) {
          return videoJson({ error: 'Session modifiée. Réessayez.' }, { status: 409 });
        }
        return videoJson(
          serializeBooking(reResolved.booking, reResolved.sessionStart, reResolved.booking.status)
        );
      }

      displayStatus = SessionStatus.IN_PROGRESS;
    }

    return videoJson(
      serializeBooking(resolved.booking, resolved.sessionStart, displayStatus)
    );
  } catch {
    console.error('SESSION_VIDEO_JOIN_FAILED');
    return videoJson({ error: 'Internal server error' }, { status: 500 });
  }
}
