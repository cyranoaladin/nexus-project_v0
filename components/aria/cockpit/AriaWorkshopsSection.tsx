'use client';

/**
 * Real ARIA collective workshops for the current course (P7d) — a
 * self-fetching leaf, same pattern as `AriaMasteryCard.tsx`: fetches its
 * own real data given only a `courseKey`, fails silently (no ARIA
 * collective workshop for this student/course simply means this section
 * doesn't render, never an error blocking the rest of the workspace).
 */

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AriaWorkshopForStudent {
  readonly id: string;
  readonly title: string;
  readonly scheduledDate: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly location: string | null;
  readonly coachName: string | null;
  readonly myAttendanceStatus: 'REGISTERED' | 'ATTENDED' | 'ABSENT' | 'CANCELLED' | null;
}

const ATTENDANCE_LABELS: Record<NonNullable<AriaWorkshopForStudent['myAttendanceStatus']>, string> = {
  REGISTERED: 'Inscrit·e',
  ATTENDED: 'Présent·e',
  ABSENT: 'Absent·e',
  CANCELLED: 'Annulé',
};

export function AriaWorkshopsSection({ courseKey }: Readonly<{ courseKey: string }>) {
  const [workshops, setWorkshops] = useState<readonly AriaWorkshopForStudent[] | null>(null);
  const [registeringId, setRegisteringId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/aria/workshops?courseKey=${encodeURIComponent(courseKey)}`);
      if (!response.ok) {
        setWorkshops(null);
        return;
      }
      const body = (await response.json()) as { workshops: readonly AriaWorkshopForStudent[] };
      setWorkshops(body.workshops);
    } catch {
      // A read-only workshops section is a non-essential enhancement — a
      // failed fetch simply leaves it absent, never blocks the workspace.
      setWorkshops(null);
    }
  }, [courseKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const register = useCallback(
    async (workshopId: string) => {
      setRegisteringId(workshopId);
      try {
        await fetch(`/api/aria/workshops/${encodeURIComponent(workshopId)}/register`, { method: 'POST' });
        await load();
      } finally {
        setRegisteringId(null);
      }
    },
    [load],
  );

  if (!workshops || workshops.length === 0) return null;

  return (
    <Card className="border-white/10 bg-surface-card" data-testid="aria-workshops-section">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <CalendarDays className="h-4 w-4 text-brand-accent" aria-hidden="true" />
          Ateliers collectifs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {workshops.map((workshop) => (
          <div
            key={workshop.id}
            data-testid={`aria-workshop-${workshop.id}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-micro border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-200"
          >
            <div>
              <p className="font-medium">{workshop.title}</p>
              <p className="text-xs text-neutral-400">
                {new Date(workshop.scheduledDate).toLocaleDateString('fr-FR')} · {workshop.startTime}–{workshop.endTime}
                {workshop.location ? ` · ${workshop.location}` : ''}
                {workshop.coachName ? ` · ${workshop.coachName}` : ''}
              </p>
            </div>
            {workshop.myAttendanceStatus ? (
              <span className="rounded-micro bg-brand-accent/15 px-2 py-1 text-xs font-medium text-brand-accent">
                {ATTENDANCE_LABELS[workshop.myAttendanceStatus]}
              </span>
            ) : (
              <Button
                size="sm"
                disabled={registeringId === workshop.id}
                onClick={() => void register(workshop.id)}
                data-testid={`aria-workshop-register-${workshop.id}`}
              >
                {registeringId === workshop.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "S'inscrire"}
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
