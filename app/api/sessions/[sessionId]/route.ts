import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { SessionStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { deterministicRoomSeedForSession, generateDeterministicRoomName } from '@/lib/jitsi';

/**
 * GET /api/sessions/[sessionId] — the single real backend for the video
 * join flow (app/session/video/page.tsx). Replaces the previous, entirely
 * dead app/api/sessions/video/route.ts (never called by any client — the
 * page called this exact path and always got a 404, since it didn't
 * exist) and the client-side, non-deterministic room-name generation the
 * page used to fall back to (`session-${sessionId}-${Date.now()}`, which
 * gave every participant a different, private room).
 *
 * Ownership is scoped strictly server-side to the booking's own
 * student/coach/parent (never a client-supplied id). Whether staff
 * (ADMIN/ASSISTANTE) should also be able to open a session they are not
 * assigned to (supervision) is a real, open product question — not
 * decided here; see the go-live audit's blocker register.
 */

// Africa/Tunis: fixed UTC+1, no DST since 2009 — the same assumption
// already relied on elsewhere in this codebase (lib/planning/series.ts'
// tunisNowAsPretendUtc). Written correctly here (explicit UTC arithmetic,
// never a bare `new Date(localString)` whose interpretation depends on
// the server process' own timezone) rather than reintroducing a THIRD,
// naive ad hoc implementation. Full convergence onto a real IANA
// timezone authority is tracked separately (audit.md TZ-1) — this is a
// correct instance of the existing, already-documented convention, not a
// new one.
const TUNIS_UTC_OFFSET_HOURS = 1;

function resolveTunisWallClockToUtc(calendarDate: Date, hhmm: string): Date {
  const dateOnly = calendarDate.toISOString().split('T')[0];
  const asIfUtc = new Date(`${dateOnly}T${hhmm}:00.000Z`);
  return new Date(asIfUtc.getTime() - TUNIS_UTC_OFFSET_HOURS * 60 * 60 * 1000);
}

const JOIN_EARLY_WINDOW_MS = 15 * 60 * 1000;
const JOIN_LATE_TOLERANCE_MS = 30 * 60 * 1000;

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // IP-based rate-limit first — blocks anonymous abuse before auth()
    const ipBlocked = await guardSensitiveRateLimit(request, {
      scope: 'session-video-ip',
      dimensions: ['ip'],
    });
    if (ipBlocked) return ipBlocked;

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Refine with userId-based rate-limit post-auth
    const userBlocked = await guardSensitiveRateLimit(request, {
      scope: 'session-video-user',
      identity: session.user.id,
      dimensions: ['identity'],
    });
    if (userBlocked) return userBlocked;

    const { sessionId } = await params;
    if (!sessionId || sessionId.length > 128) {
      return NextResponse.json({ error: 'ID de session invalide' }, { status: 400 });
    }

    // Ownership: strictly the booking's own student/coach/parent, resolved
    // server-side from the authenticated session — sessionId never grants
    // access by itself, and the client never supplies who it thinks it is.
    const bookingSession = await prisma.sessionBooking.findFirst({
      where: {
        id: sessionId,
        OR: [
          { studentId: session.user.id },
          { coachId: session.user.id },
          { parentId: session.user.id },
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
      return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });
    }

    // A cancelled or already-completed booking is never joinable, no
    // matter the time window — the dead code this replaces had no such
    // guard at all.
    if (bookingSession.status === SessionStatus.CANCELLED) {
      return NextResponse.json({ error: 'Cette session a été annulée.' }, { status: 410 });
    }
    if (bookingSession.status === SessionStatus.COMPLETED) {
      return NextResponse.json({ error: 'Cette session est déjà terminée.' }, { status: 410 });
    }

    const sessionStart = resolveTunisWallClockToUtc(bookingSession.scheduledDate, bookingSession.startTime);
    const sessionEnd = new Date(sessionStart.getTime() + bookingSession.duration * 60 * 1000);
    const now = new Date();

    if (now.getTime() < sessionStart.getTime() - JOIN_EARLY_WINDOW_MS) {
      return NextResponse.json({ error: "La session n'est pas encore disponible." }, { status: 400 });
    }
    // The previous logic only checked "too early" despite its own error
    // message claiming to also cover "or a expiré" — there was no upper
    // bound at all. A session stays joinable up to 30 minutes past its
    // scheduled end before being treated as expired.
    if (now.getTime() > sessionEnd.getTime() + JOIN_LATE_TOLERANCE_MS) {
      return NextResponse.json({ error: 'La fenêtre de cette session a expiré.' }, { status: 410 });
    }

    if (bookingSession.status === SessionStatus.SCHEDULED) {
      await prisma.sessionBooking.update({
        where: { id: sessionId },
        data: { status: SessionStatus.IN_PROGRESS },
      });
    }

    // Deterministic AND stable for the booking: every participant who
    // calls this endpoint for the same sessionId gets the exact same
    // room name, every time — never regenerated per call (the bug this
    // replaces: both the page and the old dead route minted a fresh
    // random/Date.now()-seeded name on every request, so the coach and
    // the student never landed in the same Jitsi room).
    const roomName = generateDeterministicRoomName(sessionId, deterministicRoomSeedForSession(sessionId));

    return NextResponse.json({
      id: bookingSession.id,
      studentName: `${bookingSession.student.firstName ?? ''} ${bookingSession.student.lastName ?? ''}`.trim(),
      coachName: `${bookingSession.coach.firstName ?? ''} ${bookingSession.coach.lastName ?? ''}`.trim(),
      subject: bookingSession.subject,
      scheduledAt: sessionStart.toISOString(),
      duration: bookingSession.duration,
      status: bookingSession.status === SessionStatus.SCHEDULED ? SessionStatus.IN_PROGRESS : bookingSession.status,
      roomName,
    });
  } catch (error) {
    console.error('[GET /api/sessions/[sessionId]]', serializeError(error));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
