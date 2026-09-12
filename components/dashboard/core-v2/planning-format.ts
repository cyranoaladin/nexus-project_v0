/**
 * Presentation of booking instants. Every booking is displayed in the zone
 * its series was planned in (captured from organization configuration on
 * the series row) — not the browser's zone — so staff in Tunis and a parent
 * abroad read the same wall-clock time the lesson was planned at.
 */
import type { BookingView } from './api';

export const BOOKING_STATUS_LABEL: Record<BookingView['status'], string> = {
  SCHEDULED: 'Planifiée',
  CONFIRMED: 'Confirmée',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
  NO_SHOW: 'Absence',
  RESCHEDULED: 'Déplacée',
};

export const MODALITY_LABEL: Record<BookingView['modality'], string> = { ONLINE: 'en ligne', IN_PERSON: 'présentiel', HYBRID: 'hybride' };

export const LIVE_STATUSES: ReadonlyArray<BookingView['status']> = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'];

export function bookingZone(booking: Pick<BookingView, 'series'>): string {
  return booking.series?.timezone ?? 'UTC';
}

/** `YYYY-MM-DD` of the booking start in its planning zone. */
export function bookingLocalDate(booking: Pick<BookingView, 'startsAt' | 'series'>): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: bookingZone(booking), year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(booking.startsAt));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function formatBookingDay(booking: Pick<BookingView, 'startsAt' | 'series'>): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: bookingZone(booking), weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(booking.startsAt));
}

export function formatBookingTime(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant)).replace(':', 'h');
}

export function formatBookingSlot(booking: Pick<BookingView, 'startsAt' | 'endsAt' | 'series'>): string {
  const zone = bookingZone(booking);
  return `${formatBookingTime(booking.startsAt, zone)}–${formatBookingTime(booking.endsAt, zone)}`;
}

/** Monday 00:00 (browser-local calendar) of the week containing `date`, as an ISO date string. */
export function mondayOf(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}
