'use client';

/**
 * Real ARIA collective workshop administration for staff (P7d) — no
 * manual SQL/script is required to schedule a workshop or mark
 * attendance (mission section 8/9's own requirement). Schedules a real
 * `AriaWorkshopSession`, lists the real roster per session, marks real
 * attendance — every mutation goes through the real, authorized API.
 */

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AriaWorkshopAttendeeForStaff {
  readonly attendeeId: string;
  readonly studentId: string;
  readonly studentName: string;
  readonly status: 'REGISTERED' | 'ATTENDED' | 'ABSENT' | 'CANCELLED';
}

interface AriaWorkshopSessionForStaff {
  readonly id: string;
  readonly courseKey: string;
  readonly title: string;
  readonly scheduledDate: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
  readonly attendees: readonly AriaWorkshopAttendeeForStaff[];
}

const ATTENDEE_STATUS_LABELS: Record<AriaWorkshopAttendeeForStaff['status'], string> = {
  REGISTERED: 'Inscrit·e',
  ATTENDED: 'Présent·e',
  ABSENT: 'Absent·e',
  CANCELLED: 'Annulé',
};

const EMPTY_FORM = {
  courseKey: '',
  title: '',
  scheduledDate: '',
  startTime: '',
  endTime: '',
  modality: 'ONLINE' as const,
  location: '',
};

export function AriaWorkshopsAdmin() {
  const [sessions, setSessions] = useState<readonly AriaWorkshopSessionForStaff[] | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch('/api/assistante/aria/workshops');
    if (!response.ok) {
      setSessions([]);
      return;
    }
    const body = (await response.json()) as { workshops: readonly AriaWorkshopSessionForStaff[] };
    setSessions(body.workshops);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      const response = await fetch('/api/assistante/aria/workshops', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          courseKey: form.courseKey,
          title: form.title,
          scheduledDate: new Date(form.scheduledDate).toISOString(),
          startTime: form.startTime,
          endTime: form.endTime,
          modality: form.modality,
          location: form.location || null,
        }),
      });
      if (!response.ok) {
        setFormError('La planification de l’atelier a échoué. Vérifiez les champs.');
        return;
      }
      setForm(EMPTY_FORM);
      await load();
    } finally {
      setSubmitting(false);
    }
  }, [form, load]);

  const markAttendance = useCallback(
    async (attendeeId: string, status: 'ATTENDED' | 'ABSENT') => {
      setMarkingId(attendeeId);
      try {
        await fetch(`/api/assistante/aria/workshops/attendees/${encodeURIComponent(attendeeId)}/attendance`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        await load();
      } finally {
        setMarkingId(null);
      }
    },
    [load],
  );

  return (
    <div className="space-y-6 p-6">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-white">
        <CalendarDays className="h-5 w-5 text-brand-accent" aria-hidden="true" />
        Ateliers collectifs ARIA
      </h1>

      <Card className="border-white/10 bg-surface-card" data-testid="aria-workshop-schedule-form">
        <CardHeader>
          <CardTitle className="text-base text-white">Planifier un atelier</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="workshop-course-key">Clé de cours</Label>
            <Input
              id="workshop-course-key"
              value={form.courseKey}
              onChange={(event) => setForm((current) => ({ ...current, courseKey: event.target.value }))}
              placeholder="eds-maths-premiere"
            />
          </div>
          <div>
            <Label htmlFor="workshop-title">Titre</Label>
            <Input
              id="workshop-title"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Atelier révisions suites arithmétiques"
            />
          </div>
          <div>
            <Label htmlFor="workshop-date">Date</Label>
            <Input
              id="workshop-date"
              type="date"
              value={form.scheduledDate}
              onChange={(event) => setForm((current) => ({ ...current, scheduledDate: event.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="workshop-start">Début</Label>
              <Input
                id="workshop-start"
                type="time"
                value={form.startTime}
                onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="workshop-end">Fin</Label>
              <Input
                id="workshop-end"
                type="time"
                value={form.endTime}
                onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="workshop-modality">Modalité</Label>
            <select
              id="workshop-modality"
              value={form.modality}
              onChange={(event) =>
                setForm((current) => ({ ...current, modality: event.target.value as typeof current.modality }))
              }
              className="flex h-10 w-full rounded-md border border-white/10 bg-surface-darker px-3 py-2 text-sm text-white"
            >
              <option value="ONLINE">En ligne</option>
              <option value="IN_PERSON">En présentiel</option>
              <option value="HYBRID">Hybride</option>
            </select>
          </div>
          <div>
            <Label htmlFor="workshop-location">Lieu (optionnel)</Label>
            <Input
              id="workshop-location"
              value={form.location}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            {formError && <p className="mb-2 text-sm text-red-400">{formError}</p>}
            <Button
              onClick={() => void submit()}
              disabled={submitting || !form.courseKey || !form.title || !form.scheduledDate || !form.startTime || !form.endTime}
              data-testid="aria-workshop-schedule-submit"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Planifier'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {sessions === null && <Loader2 className="h-5 w-5 animate-spin text-brand-accent" aria-label="Chargement" />}
        {sessions?.map((session) => (
          <Card key={session.id} className="border-white/10 bg-surface-card" data-testid={`aria-workshop-session-${session.id}`}>
            <CardHeader>
              <CardTitle className="text-sm text-white">
                {session.title} — {session.courseKey}
              </CardTitle>
              <p className="text-xs text-neutral-400">
                {new Date(session.scheduledDate).toLocaleDateString('fr-FR')} · {session.startTime}–{session.endTime}
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {session.attendees.length === 0 ? (
                <p className="text-xs text-neutral-500">Aucune inscription pour le moment.</p>
              ) : (
                session.attendees.map((attendee) => (
                  <div
                    key={attendee.attendeeId}
                    data-testid={`aria-workshop-attendee-${attendee.attendeeId}`}
                    className="flex items-center justify-between gap-2 rounded-micro border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-neutral-300"
                  >
                    <span>{attendee.studentName || attendee.studentId}</span>
                    <div className="flex items-center gap-2">
                      <span className="rounded-micro bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300">
                        {ATTENDEE_STATUS_LABELS[attendee.status]}
                      </span>
                      {attendee.status === 'REGISTERED' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={markingId === attendee.attendeeId}
                            onClick={() => void markAttendance(attendee.attendeeId, 'ATTENDED')}
                            data-testid={`aria-workshop-mark-attended-${attendee.attendeeId}`}
                          >
                            Présent·e
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={markingId === attendee.attendeeId}
                            onClick={() => void markAttendance(attendee.attendeeId, 'ABSENT')}
                            data-testid={`aria-workshop-mark-absent-${attendee.attendeeId}`}
                          >
                            Absent·e
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
