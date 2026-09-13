import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { SessionStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { tunisWallClockToUtcInstant } from '@/lib/planning/invariants';
import { resolveJitsiRoomNameForSession } from '@/lib/jitsi-server';

/**
 * /api/sessions/[sessionId] — the real backend for the video join flow
 * (app/session/video/page.tsx). Replaces the previous, entirely dead
 * app/api/sessions/video/route.ts (never called by any client — the page
 * called this exact path and always got a 404, since it didn't exist) and
 * the client-side, non-deterministic room-name generation the page used
 * to fall back to (`session-${sessionId}-${Date.now()}`, which gave every
 * participant a different, private room).
 *
 * GET is read-only (a safe, cacheable status check) and never mutates the
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

const JOIN_EARLY_WINDOW_MS = 15 * 60 * 1000;
const JOIN_LATE_TOLERANCE_MS = 30 * 60 * 1000;

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

interface JoinableBookingSession {
  id: string;
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
async function resolveJoinableBooking(sessionId: string, userId: string): Promise<ResolveResult> {
  const bookingSession = await prisma.sessionBooking.findFirst({
    where: {
      id: sessionId,
      OR: [
        { studentId: userId },
        { coachId: userId },
        { parentId: userId },
      ],
    },
    select: {
      id: true,
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
    return { ok: false, response: NextResponse.json({ error: 'Session non trouvée' }, { status: 404 }) };
  }

  // A cancelled or already-completed booking is never joinable, no
  // matter the time window — the dead code this replaces had no such
  // guard at all.
  if (bookingSession.status === SessionStatus.CANCELLED) {
    return { ok: false, response: NextResponse.json({ error: 'Cette session a été annulée.' }, { status: 410 }) };
  }
  if (bookingSession.status === SessionStatus.COMPLETED) {
    return { ok: false, response: NextResponse.json({ error: 'Cette session est déjà terminée.' }, { status: 410 }) };
  }

  const sessionStart = tunisWallClockToUtcInstant(bookingSession.scheduledDate, bookingSession.startTime);
  const sessionEnd = new Date(sessionStart.getTime() + bookingSession.duration * 60 * 1000);
  const now = new Date();

  if (now.getTime() < sessionStart.getTime() - JOIN_EARLY_WINDOW_MS) {
    return { ok: false, response: NextResponse.json({ error: "La session n'est pas encore disponible." }, { status: 400 }) };
  }
  // The previous logic only checked "too early" despite its own error
  // message claiming to also cover "or a expiré" — there was no upper
  // bound at all. A session stays joinable up to 30 minutes past its
  // scheduled end before being treated as expired.
  if (now.getTime() > sessionEnd.getTime() + JOIN_LATE_TOLERANCE_MS) {
    return { ok: false, response: NextResponse.json({ error: 'La fenêtre de cette session a expiré.' }, { status: 410 }) };
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
  if (ipBlocked) return { blocked: ipBlocked, session: null };

  const session = await auth();
  if (!session?.user) {
    return { blocked: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }), session: null };
  }

  const userBlocked = await guardSensitiveRateLimit(request, {
    scope: 'session-video-user',
    identity: session.user.id,
    dimensions: ['identity'],
  });
  if (userBlocked) return { blocked: userBlocked, session: null };

  return { blocked: null, session };
}

/** Read-only status check — never mutates the booking. */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { blocked, session } = await guardRequest(request);
    if (blocked) return blocked;

    const { sessionId } = await params;
    if (!sessionId || sessionId.length > 128) {
      return NextResponse.json({ error: 'ID de session invalide' }, { status: 400 });
    }

    const resolved = await resolveJoinableBooking(sessionId, session!.user.id);
    if (!resolved.ok) return resolved.response;

    return NextResponse.json(
      serializeBooking(resolved.booking, resolved.sessionStart, resolved.booking.status)
    );
  } catch (error) {
    console.error('[GET /api/sessions/[sessionId]]', serializeError(error));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Explicit join action — same eligibility as GET, plus the SCHEDULED→IN_PROGRESS transition. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { blocked, session } = await guardRequest(request);
    if (blocked) return blocked;

    const { sessionId } = await params;
    if (!sessionId || sessionId.length > 128) {
      return NextResponse.json({ error: 'ID de session invalide' }, { status: 400 });
    }

    const resolved = await resolveJoinableBooking(sessionId, session!.user.id);
    if (!resolved.ok) return resolved.response;

    let displayStatus = resolved.booking.status;
    if (resolved.booking.status === SessionStatus.SCHEDULED) {
      await prisma.sessionBooking.update({
        where: { id: sessionId },
        data: { status: SessionStatus.IN_PROGRESS },
      });
      displayStatus = SessionStatus.IN_PROGRESS;
    }

    return NextResponse.json(
      serializeBooking(resolved.booking, resolved.sessionStart, displayStatus)
    );
  } catch (error) {
    console.error('[POST /api/sessions/[sessionId]]', serializeError(error));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
