'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  type AcademicYear,
  type ApiFail,
  type IndicatorPage,
  type PendingEnrollmentSummary,
  type UnassignedCourseEnrollment,
  describeFailure,
  displayName,
  v2,
} from './api';
import { CoachCapabilitiesPanel } from './CoachCapabilitiesPanel';
import { yearLabel } from './EnrollmentSummary';
import { StatusMessage } from './StatusMessage';
import { useStaffActor } from './useStaffActor';

/** Cursor-paginated indicator: counter and list come from one server round trip, never disagree. */
function useIndicator<T>(endpoint: string) {
  const [items, setItems] = useState<T[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failure, setFailure] = useState<ApiFail | null>(null);
  const latest = useRef(0);

  const load = useCallback(
    async (cursor: string | null) => {
      const requestId = ++latest.current;
      if (cursor) setLoadingMore(true);
      else setLoading(true);
      setFailure(null);
      const params = new URLSearchParams({ limit: '20' });
      if (cursor) params.set('cursor', cursor);
      const result = await v2<IndicatorPage<T>>(`${endpoint}?${params.toString()}`);
      if (requestId !== latest.current) return;
      if (result.ok) {
        setItems((prev) => (cursor ? [...prev, ...result.data.items] : result.data.items));
        setNextCursor(result.data.nextCursor);
        setTotalCount(result.data.totalCount);
      } else {
        setFailure(result);
      }
      setLoading(false);
      setLoadingMore(false);
    },
    [endpoint],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  return {
    items,
    totalCount,
    nextCursor,
    loading,
    loadingMore,
    failure,
    reload: () => load(null),
    loadMore: () => {
      if (nextCursor) void load(nextCursor);
    },
  };
}

/**
 * First Jalon B operational view (go-live mission): two indicators grounded
 * in the real Core v2 contract, each opening a list with the exact server
 * definition behind its counter, plus the coach-capability configuration
 * loop. Mutations happen through the existing, canonical household detail
 * screen (EnrollmentCard / AssignmentsPanel) — this view never reimplements
 * approve/assign, it only helps staff find the right dossier and jump into
 * it via a deep link to the exact enrollment.
 */
export function PilotageWorkspace({ basePath }: { basePath: string }) {
  const { can, failure: actorFailure, loading: actorLoading } = useStaffActor();
  const [years, setYears] = useState<AcademicYear[] | null>(null);
  const [yearsFailure, setYearsFailure] = useState<ApiFail | null>(null);
  const [yearsLoading, setYearsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void v2<AcademicYear[]>('/staff/academic-years').then((result) => {
      if (cancelled) return;
      if (result.ok) setYears(result.data);
      else setYearsFailure(result);
      setYearsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentYear = years?.find((y) => y.status === 'CURRENT') ?? null;

  return (
    <div className="core-v2 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Pilotage</h1>
        <p className="text-sm text-neutral-400">Indicateurs opérationnels — inscriptions et affectations à traiter.</p>
      </header>

      {actorFailure && <StatusMessage kind="error">{describeFailure(actorFailure)}</StatusMessage>}

      {yearsLoading || actorLoading ? (
        <p role="status" className="flex items-center gap-2 text-neutral-300">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Chargement…
        </p>
      ) : yearsFailure ? (
        <StatusMessage kind="error">{describeFailure(yearsFailure)}</StatusMessage>
      ) : !currentYear ? (
        <StatusMessage kind="info">
          Année scolaire courante à configurer — les indicateurs ci-dessous exigent une année marquée CURRENT.{' '}
          <Link className="underline" href={`${basePath}/annees`}>
            Gérer les années scolaires
          </Link>
        </StatusMessage>
      ) : (
        <>
          <p className="text-sm text-neutral-400">Année scolaire en cours : {yearLabel(currentYear)}.</p>
          <PendingEnrollmentsSection basePath={basePath} />
          <UnassignedCoursesSection basePath={basePath} />
        </>
      )}

      <CoachCapabilitiesPanel can={can} />
    </div>
  );
}

function IndicatorLoadMore({ nextCursor, loadingMore, loadMore }: { nextCursor: string | null; loadingMore: boolean; loadMore: () => void }) {
  if (!nextCursor) return null;
  return (
    <div className="mt-4 flex justify-center">
      <Button type="button" variant="outline" disabled={loadingMore} onClick={loadMore}>
        {loadingMore ? 'Chargement…' : 'Afficher plus'}
      </Button>
    </div>
  );
}

function PendingEnrollmentsSection({ basePath }: { basePath: string }) {
  const indicator = useIndicator<PendingEnrollmentSummary>('/staff/enrollments/pending');
  return (
    <Card className="border-white/10 bg-surface-dark" aria-labelledby="core-v2-pending-enrollments">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="core-v2-pending-enrollments" className="text-base font-semibold text-white">
            Inscriptions à valider
            {indicator.totalCount !== null && <span className="ml-1 text-brand-accent">({indicator.totalCount})</span>}
          </h2>
          <p className="text-xs text-neutral-400">
            Inscriptions pédagogiques PENDING de l’année scolaire en cours — comptées comme une inscription annuelle, jamais comme un nombre
            d’élèves distincts.
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" disabled={indicator.loading} onClick={indicator.reload}>
          Actualiser
        </Button>
      </CardHeader>
      <CardContent>
        {indicator.failure ? (
          <StatusMessage kind="error">{describeFailure(indicator.failure)}</StatusMessage>
        ) : indicator.loading ? (
          <p role="status" className="flex items-center gap-2 text-neutral-300">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Chargement des inscriptions en attente…
          </p>
        ) : indicator.items.length === 0 ? (
          <p role="status" className="text-neutral-400">Aucune inscription en attente pour l’instant.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Élève</TableHead>
                  <TableHead>Foyer</TableHead>
                  <TableHead>Niveau / parcours</TableHead>
                  <TableHead>Année</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="sr-only">Ouvrir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {indicator.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-neutral-100">{displayName(item.student.user)}</TableCell>
                    <TableCell className="text-neutral-300">{item.household.primaryContactName ?? '—'}</TableCell>
                    <TableCell className="text-neutral-300">
                      {item.gradeLevel}
                      {item.academicTrack ? ` · ${item.academicTrack}` : ''}
                    </TableCell>
                    <TableCell className="text-neutral-300">{yearLabel(item.academicYear)}</TableCell>
                    <TableCell className="text-neutral-300">En attente de validation</TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`${basePath}/${item.household.id}#core-v2-enrollment-${item.id}`}>Ouvrir le dossier</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <IndicatorLoadMore nextCursor={indicator.nextCursor} loadingMore={indicator.loadingMore} loadMore={indicator.loadMore} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function UnassignedCoursesSection({ basePath }: { basePath: string }) {
  const indicator = useIndicator<UnassignedCourseEnrollment>('/staff/assignments/needed');
  return (
    <Card className="border-white/10 bg-surface-dark" aria-labelledby="core-v2-unassigned-courses">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="core-v2-unassigned-courses" className="text-base font-semibold text-white">
            Inscriptions à un cours sans enseignant affecté
            {indicator.totalCount !== null && <span className="ml-1 text-brand-accent">({indicator.totalCount})</span>}
          </h2>
          <p className="text-xs text-neutral-400">
            Écart de couverture observé (aucune affectation ACTIVE pour ce cours) — pas une obligation pédagogique universelle. Un même élève
            peut apparaître sur plusieurs lignes, une par cours. Ne vérifie que l’existence d’une affectation, jamais l’activité du compte
            coach, sa capacité déclarée ou sa disponibilité de planning.
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" disabled={indicator.loading} onClick={indicator.reload}>
          Actualiser
        </Button>
      </CardHeader>
      <CardContent>
        {indicator.failure ? (
          <StatusMessage kind="error">{describeFailure(indicator.failure)}</StatusMessage>
        ) : indicator.loading ? (
          <p role="status" className="flex items-center gap-2 text-neutral-300">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Chargement des cours sans affectation…
          </p>
        ) : indicator.items.length === 0 ? (
          <p role="status" className="text-neutral-400">Aucun cours sans affectation active pour l’instant.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Élève</TableHead>
                  <TableHead>Foyer</TableHead>
                  <TableHead>Cours</TableHead>
                  <TableHead>Niveau / parcours</TableHead>
                  <TableHead>Année</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="sr-only">Ouvrir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {indicator.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-neutral-100">{displayName(item.student.user)}</TableCell>
                    <TableCell className="text-neutral-300">{item.household.primaryContactName ?? '—'}</TableCell>
                    <TableCell className="text-neutral-300">{item.courseKey}</TableCell>
                    <TableCell className="text-neutral-300">
                      {item.enrollment.gradeLevel}
                      {item.enrollment.academicTrack ? ` · ${item.enrollment.academicTrack}` : ''}
                    </TableCell>
                    <TableCell className="text-neutral-300">{yearLabel(item.enrollment.academicYear)}</TableCell>
                    <TableCell className="text-neutral-300">Sans affectation active</TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`${basePath}/${item.household.id}#core-v2-enrollment-${item.enrollment.id}`}>Ouvrir le dossier</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <IndicatorLoadMore nextCursor={indicator.nextCursor} loadingMore={indicator.loadingMore} loadMore={indicator.loadMore} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
