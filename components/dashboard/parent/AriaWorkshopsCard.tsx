'use client';

/**
 * Parent-facing real ARIA collective workshops (P7d) — mirrors
 * `AriaMasteryCard.tsx`'s own self-fetching pattern exactly: no course
 * selector shown at all when the family has no ARIA course, no workshop
 * shown until the child has real attendance data for it (this card never
 * shows a workshop the child was merely eligible for but never joined —
 * that "browse and register" view is the student's own, not the
 * parent's).
 */

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AriaParentChildCourse {
  readonly courseKey: string;
  readonly label: string;
}
interface AriaWorkshopForParent {
  readonly id: string;
  readonly title: string;
  readonly scheduledDate: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly location: string | null;
  readonly childAttendanceStatus: 'REGISTERED' | 'ATTENDED' | 'ABSENT' | 'CANCELLED';
}

const ATTENDANCE_LABELS: Record<AriaWorkshopForParent['childAttendanceStatus'], string> = {
  REGISTERED: 'Inscrit·e',
  ATTENDED: 'Présent·e',
  ABSENT: 'Absent·e',
  CANCELLED: 'Annulé',
};

export function AriaWorkshopsCard({ studentId }: Readonly<{ studentId: string }>) {
  const [courses, setCourses] = useState<readonly AriaParentChildCourse[] | null>(null);
  const [workshops, setWorkshops] = useState<readonly AriaWorkshopForParent[] | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/parent/children/${encodeURIComponent(studentId)}/aria/courses`);
      if (!response.ok) throw new Error('load failed');
      const body = (await response.json()) as { courses: readonly AriaParentChildCourse[] };
      setCourses(body.courses);
    } catch {
      setCourses(null);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    if (!courses || courses.length === 0) {
      setWorkshops(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const results = await Promise.all(
          courses.map(async (course) => {
            const response = await fetch(
              `/api/parent/children/${encodeURIComponent(studentId)}/aria/workshops?courseKey=${encodeURIComponent(course.courseKey)}`,
            );
            if (!response.ok) return [];
            const body = (await response.json()) as { workshops: readonly AriaWorkshopForParent[] };
            return body.workshops;
          }),
        );
        if (!cancelled) setWorkshops(results.flat());
      } catch {
        if (!cancelled) setWorkshops(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, courses]);

  if (loading) {
    return (
      <Card className="bg-surface-card border-white/10 shadow-premium">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-brand-accent" aria-label="Chargement" />
        </CardContent>
      </Card>
    );
  }

  if (!workshops || workshops.length === 0) return null;

  return (
    <Card className="bg-surface-card border-white/10 shadow-premium" data-testid="aria-workshops-card">
      <CardHeader>
        <CardTitle className="text-white text-base flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-brand-accent" aria-hidden="true" />
          Ateliers collectifs ARIA
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {workshops.map((workshop) => (
            <li
              key={workshop.id}
              className="flex items-center justify-between gap-2 rounded-micro border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-neutral-300"
            >
              <span>
                {workshop.title} — {new Date(workshop.scheduledDate).toLocaleDateString('fr-FR')}
              </span>
              <span className="shrink-0 rounded-micro bg-brand-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-accent">
                {ATTENDANCE_LABELS[workshop.childAttendanceStatus]}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
