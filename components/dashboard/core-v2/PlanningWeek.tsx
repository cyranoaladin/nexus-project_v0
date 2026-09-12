'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type ApiFail, type BookingView, describeFailure, displayName, v2 } from './api';
import { isStaleConflict, useAction } from './actions';
import { BOOKING_STATUS_LABEL, LIVE_STATUSES, MODALITY_LABEL, addDaysIso, bookingLocalDate, formatBookingDay, formatBookingSlot, mondayOf } from './planning-format';
import { StatusMessage } from './StatusMessage';
import { useStaffActor } from './useStaffActor';

const WEEK_PARAM = 'semaine';

/**
 * Staff week view of the Core v2 planning: every materialized occurrence of
 * the week, grouped by day, with the exceptions a staff member may apply
 * (cancel one occurrence, move one occurrence, cancel the series from now on).
 * The week is in the URL so a link lands on the same week.
 */
export function PlanningWeek({ basePath }: { basePath: string }) {
  const { can } = useStaffActor();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams?.get(WEEK_PARAM);
  const weekStart = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? mondayOfIso(requested) : mondayOf(new Date());
  const weekEnd = addDaysIso(weekStart, 7);

  const [bookings, setBookings] = useState<BookingView[] | null>(null);
  const [failure, setFailure] = useState<ApiFail | null>(null);

  const load = useCallback(async () => {
    // Whole calendar days around the week: the API filters on instants, the grouping below uses the planning zone.
    const from = new Date(`${addDaysIso(weekStart, -1)}T00:00:00Z`).toISOString();
    const to = new Date(`${addDaysIso(weekEnd, 1)}T00:00:00Z`).toISOString();
    const result = await v2<BookingView[]>(`/staff/planning/bookings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    if (result.ok) {
      setFailure(null);
      setBookings(result.data.filter((b) => {
        const day = bookingLocalDate(b);
        return day >= weekStart && day < weekEnd;
      }));
    } else {
      setFailure(result);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    setBookings(null);
    void load();
  }, [load]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)), [weekStart]);
  const byDay = useMemo(() => {
    const map = new Map<string, BookingView[]>();
    for (const b of bookings ?? []) {
      const day = bookingLocalDate(b);
      map.set(day, [...(map.get(day) ?? []), b]);
    }
    return map;
  }, [bookings]);

  const go = (iso: string) => router.push(`${basePath}/planning?${WEEK_PARAM}=${iso}`);

  return (
    <div className="core-v2 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Planning</h1>
          <p className="text-sm text-neutral-400">
            Semaine du {formatIsoDay(weekStart)} — heures dans le fuseau de planification de chaque série.
          </p>
        </div>
        <nav aria-label="Navigation par semaine" className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => go(addDaysIso(weekStart, -7))}>Semaine précédente</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => go(mondayOf(new Date()))}>Cette semaine</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => go(addDaysIso(weekStart, 7))}>Semaine suivante</Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={basePath}>Familles</Link>
          </Button>
        </nav>
      </header>

      {failure && <StatusMessage kind="error">{describeFailure(failure)}</StatusMessage>}
      {bookings === null && !failure && <p role="status" className="text-neutral-300">Chargement du planning…</p>}
      {bookings !== null && bookings.length === 0 && <p role="status" className="text-neutral-400">Aucune séance planifiée cette semaine.</p>}

      {bookings !== null && bookings.length > 0 && (
        <div className="space-y-4">
          {days.map((day) => {
            const rows = byDay.get(day) ?? [];
            if (rows.length === 0) return null;
            return (
              <section key={day} aria-label={formatIsoDay(day)}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">{formatBookingDay(rows[0]!)}</h2>
                <ul className="space-y-2">
                  {rows.map((b) => (
                    <BookingRow key={b.id} booking={b} canManage={can('PLANNING_MANAGE')} refresh={load} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function mondayOfIso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return mondayOf(new Date(y, m - 1, d));
}

function formatIsoDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d));
}

function BookingRow({ booking, canManage, refresh }: { booking: BookingView; canManage: boolean; refresh: () => Promise<void> }) {
  const action = useAction(refresh);
  const live = LIVE_STATUSES.includes(booking.status);
  const label = `${formatBookingSlot(booking)} ${displayName(booking.student.user)} — ${booking.courseKey}`;
  return (
    <li aria-label={label} className={`rounded-md border border-white/10 p-3 ${live ? 'bg-surface-card' : 'bg-surface-darker opacity-75'}`}>
      <Card className="border-0 bg-transparent shadow-none">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="text-sm">
              <p className="font-medium text-neutral-100">
                {formatBookingSlot(booking)} · {displayName(booking.student.user)} — {booking.courseKey}
              </p>
              <p className="text-neutral-400">
                Coach {displayName(booking.coach.user)} · {MODALITY_LABEL[booking.modality]}
                {booking.location && ` · ${booking.location}`} · <span className={live ? 'text-brand-accent' : ''}>{BOOKING_STATUS_LABEL[booking.status]}</span>
                {booking.overridesBookingId && ' · séance déplacée'}
              </p>
            </div>
            {canManage && live && (
              <div className="flex flex-wrap gap-2">
                <CancelOccurrenceDialog booking={booking} onDone={refresh} />
                <RescheduleDialog booking={booking} onDone={refresh} />
                {booking.series && booking.series.status === 'ACTIVE' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-red-500/40 text-red-200 hover:text-red-100"
                    disabled={action.pending !== null}
                    onClick={() => void action.run('cancel-series', () => v2(`/staff/planning/series/${booking.series!.id}/cancel`, { method: 'POST', json: { expectedRevision: booking.series!.revision } }), 'Série annulée à partir de maintenant ; les séances passées restent.')}
                  >
                    Annuler la série
                  </Button>
                )}
              </div>
            )}
          </div>
          {action.failure && (
            <div className="mt-2">
              <StatusMessage kind="error">
                {describeFailure(action.failure)}
                {isStaleConflict(action.failure) && ' — la série a été modifiée entre-temps ; le planning a été rechargé.'}
              </StatusMessage>
            </div>
          )}
          {action.success && (
            <div className="mt-2">
              <StatusMessage kind="success">{action.success}</StatusMessage>
            </div>
          )}
        </CardContent>
      </Card>
    </li>
  );
}

function CancelOccurrenceDialog({ booking, onDone }: { booking: BookingView; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const action = useAction(async () => {
    setOpen(false);
    await onDone();
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">Annuler la séance</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annuler cette séance</DialogTitle>
          <DialogDescription>Uniquement cette occurrence ({formatBookingDay(booking)}, {formatBookingSlot(booking)}). La série continue.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!reason.trim()) return;
            void action.run('cancel', () => v2(`/staff/planning/bookings/${booking.id}/cancel`, { method: 'POST', json: { reason: reason.trim() } }), 'Séance annulée.');
          }}
        >
          <div>
            <Label htmlFor={`cancel-reason-${booking.id}`}>Motif</Label>
            <Input id={`cancel-reason-${booking.id}`} required value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {action.failure && <StatusMessage kind="error">{describeFailure(action.failure)}</StatusMessage>}
          <div className="flex justify-end">
            <Button type="submit" disabled={!reason.trim() || action.pending !== null}>{action.pending ? 'Annulation…' : 'Confirmer l’annulation'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RescheduleDialog({ booking, onDone }: { booking: BookingView; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ localDate: bookingLocalDate(booking), localStartTime: '', localEndTime: '', reason: '' });
  const action = useAction(async () => {
    setOpen(false);
    await onDone();
  });
  const ready = form.localDate && form.localStartTime && form.localEndTime && form.reason.trim();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">Déplacer</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Déplacer cette séance</DialogTitle>
          <DialogDescription>Nouveau créneau dans le fuseau de la série ({booking.series?.timezone ?? 'UTC'}). Un créneau déjà occupé par le coach ou l’élève est refusé.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!ready) return;
            void action.run('reschedule', () => v2(`/staff/planning/bookings/${booking.id}/reschedule`, { method: 'POST', json: { ...form, reason: form.reason.trim() } }), 'Séance déplacée.');
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor={`move-date-${booking.id}`}>Date</Label>
              <Input id={`move-date-${booking.id}`} type="date" required value={form.localDate} onChange={(e) => setForm({ ...form, localDate: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={`move-from-${booking.id}`}>Début</Label>
              <Input id={`move-from-${booking.id}`} type="time" required value={form.localStartTime} onChange={(e) => setForm({ ...form, localStartTime: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={`move-to-${booking.id}`}>Fin</Label>
              <Input id={`move-to-${booking.id}`} type="time" required value={form.localEndTime} onChange={(e) => setForm({ ...form, localEndTime: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor={`move-reason-${booking.id}`}>Motif</Label>
            <Input id={`move-reason-${booking.id}`} required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          {action.failure && <StatusMessage kind="error">{describeFailure(action.failure)}</StatusMessage>}
          <div className="flex justify-end">
            <Button type="submit" disabled={!ready || action.pending !== null}>{action.pending ? 'Déplacement…' : 'Déplacer'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
