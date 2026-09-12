'use client';

import { useEffect, useState } from 'react';
import { type ApiFail, type BookingView, describeFailure, displayName, v2 } from './api';
import { LIVE_STATUSES, MODALITY_LABEL, formatBookingDay, formatBookingSlot } from './planning-format';
import { StatusMessage } from './StatusMessage';

/** How far ahead a family or a coach sees their planned sessions (the API caps self-service ranges at 120 days). */
export const UPCOMING_WINDOW_DAYS = 120;

/**
 * Read-only list of the signed-in user's own upcoming sessions, from the
 * self-service planning endpoint of their role. Shows who the other party
 * is by name only; times in the planning zone of each series.
 */
export function UpcomingSessions({ scope, now = () => new Date() }: { scope: 'parent' | 'student' | 'coach'; now?: () => Date }) {
  const [bookings, setBookings] = useState<BookingView[] | null>(null);
  const [failure, setFailure] = useState<ApiFail | null>(null);

  useEffect(() => {
    let cancelled = false;
    const from = now();
    const to = new Date(from.getTime() + UPCOMING_WINDOW_DAYS * 86_400_000);
    void v2<BookingView[]>(`/${scope}/planning?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`).then((result) => {
      if (cancelled) return;
      if (result.ok) setBookings(result.data.filter((b) => LIVE_STATUSES.includes(b.status)));
      else setFailure(result);
    });
    return () => {
      cancelled = true;
    };
  }, [scope, now]);

  return (
    <section aria-labelledby="core-v2-upcoming-sessions" className="core-v2 rounded-md border border-white/10 bg-surface-card p-4">
      <h2 id="core-v2-upcoming-sessions" className="text-lg font-semibold text-white">Prochaines séances</h2>
      {failure && <StatusMessage kind="error">{describeFailure(failure)}</StatusMessage>}
      {bookings === null && !failure && <p role="status" className="text-sm text-neutral-300">Chargement des séances…</p>}
      {bookings !== null && bookings.length === 0 && (
        <p role="status" className="text-sm text-neutral-400">Aucune séance planifiée dans les {UPCOMING_WINDOW_DAYS} prochains jours.</p>
      )}
      {bookings !== null && bookings.length > 0 && (
        <ul className="mt-2 space-y-2 text-sm">
          {bookings.map((b) => (
            <li key={b.id} className="rounded border border-white/10 p-2">
              <p className="font-medium text-neutral-100">
                {formatBookingDay(b)} · {formatBookingSlot(b)}
              </p>
              <p className="text-neutral-400">
                {b.courseKey} · {scope === 'coach' ? `Élève ${displayName(b.student.user)}` : `Coach ${displayName(b.coach.user)}`} · {MODALITY_LABEL[b.modality]}
                {b.location && ` · ${b.location}`}
                {b.overridesBookingId && ' · séance déplacée'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
