'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type ApiFail, type Page, describeFailure, displayName, v2 } from './api';
import { StatusMessage } from './StatusMessage';
import { useStaffActor } from './useStaffActor';

/** Mirror of lib/core-v2/queries/diagnostics-queue.ts's DiagnosticQueueState/Filter. */
export type DiagnosticQueueState =
  | 'NOT_PROCESSED'
  | 'PROCESSING'
  | 'READY_FOR_REVIEW'
  | 'VALIDATED_UNPUBLISHED'
  | 'PUBLISHED'
  | 'FAILED';

type DiagnosticQueueFilter = DiagnosticQueueState | 'ACTION_REQUIRED' | 'ALL';

const FILTERS: readonly { value: DiagnosticQueueFilter; label: string }[] = [
  { value: 'ACTION_REQUIRED', label: 'Action requise' },
  { value: 'NOT_PROCESSED', label: 'Non traité' },
  { value: 'PROCESSING', label: 'Traitement en cours' },
  { value: 'READY_FOR_REVIEW', label: 'Prêt pour revue' },
  { value: 'VALIDATED_UNPUBLISHED', label: 'Validé, non publié' },
  { value: 'PUBLISHED', label: 'Publié' },
  { value: 'FAILED', label: 'Échec' },
  { value: 'ALL', label: 'Tous' },
];

const EMPTY_LABEL: Record<DiagnosticQueueFilter, string> = {
  ACTION_REQUIRED: 'Aucune copie ne nécessite d’action pour le moment.',
  NOT_PROCESSED: 'Aucune copie en attente de traitement.',
  PROCESSING: 'Aucune copie en cours de traitement.',
  READY_FOR_REVIEW: 'Aucune copie prête pour revue.',
  VALIDATED_UNPUBLISHED: 'Aucune copie validée en attente de publication.',
  PUBLISHED: 'Aucun bilan publié pour le moment.',
  FAILED: 'Aucune copie en échec.',
  ALL: 'Aucune soumission de diagnostic candidat libre pour le moment.',
};

const STATE_LABEL: Record<DiagnosticQueueState, string> = {
  NOT_PROCESSED: 'Non traité',
  PROCESSING: 'Traitement en cours',
  READY_FOR_REVIEW: 'Prêt pour revue',
  VALIDATED_UNPUBLISHED: 'Validé, non publié',
  PUBLISHED: 'Publié',
  FAILED: 'Échec',
};

const STATE_BADGE_VARIANT: Record<DiagnosticQueueState, BadgeProps['variant']> = {
  NOT_PROCESSED: 'outline',
  PROCESSING: 'default',
  READY_FOR_REVIEW: 'warning',
  VALIDATED_UNPUBLISHED: 'warning',
  PUBLISHED: 'success',
  FAILED: 'destructive',
};

export interface DiagnosticQueueRow {
  readonly submissionId: string;
  readonly state: DiagnosticQueueState;
  readonly candidate: { readonly id: string; readonly firstName: string | null; readonly lastName: string | null };
  readonly instrument: { readonly instrumentKey: string; readonly version: string; readonly title: string };
  readonly submission: { readonly version: number; readonly status: string; readonly createdAt: string };
  readonly processingStatus: string | null;
  readonly draftStatus: string | null;
  readonly lastActivityAt: string;
}

interface DiagnosticQueuePage extends Page<DiagnosticQueueRow> {
  readonly listChanged: boolean;
}

function reconcileDiagnosticQueueRows(
  current: readonly DiagnosticQueueRow[],
  incoming: readonly DiagnosticQueueRow[],
  replace: boolean,
): DiagnosticQueueRow[] {
  const rows = replace ? [] : [...current];
  const seen = new Set(rows.map((row) => row.submissionId));
  for (const row of incoming) {
    if (seen.has(row.submissionId)) continue;
    seen.add(row.submissionId);
    rows.push(row);
  }
  return rows;
}

function formatDate(iso: string, organizationTimezone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: organizationTimezone,
  }).format(date);
}

export function DiagnosticsQueueWorkspace({
  basePath,
  organizationTimezone,
}: {
  basePath: string;
  organizationTimezone: string;
}) {
  const { can, failure: actorFailure, loading: actorLoading } = useStaffActor();
  const [filter, setFilter] = useState<DiagnosticQueueFilter>('ACTION_REQUIRED');
  const [items, setItems] = useState<DiagnosticQueueRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failure, setFailure] = useState<ApiFail | null>(null);
  const [listRefreshed, setListRefreshed] = useState(false);
  const latest = useRef(0);

  const load = useCallback(
    async (cursor: string | null) => {
      const requestId = ++latest.current;
      if (cursor) setLoadingMore(true);
      else setLoading(true);
      setFailure(null);
      const params = new URLSearchParams({ status: filter, limit: '20' });
      if (cursor) params.set('cursor', cursor);
      const result = await v2<DiagnosticQueuePage>(`/staff/diagnostics/submissions?${params.toString()}`);
      if (requestId !== latest.current) return;
      if (result.ok) {
        setItems((prev) => reconcileDiagnosticQueueRows(prev, result.data.items, !cursor || result.data.listChanged));
        setNextCursor(result.data.nextCursor);
        setListRefreshed(Boolean(cursor && result.data.listChanged));
      } else {
        if (!cursor) {
          setItems([]);
          setNextCursor(null);
          setListRefreshed(false);
        }
        setFailure(result);
      }
      setLoading(false);
      setLoadingMore(false);
    },
    [filter],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  const noPermission = !actorLoading && !actorFailure && !can('DIAGNOSTIC_SUBMISSION_TRACK');

  return (
    <div className="core-v2 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Diagnostics candidats libres — copies à traiter</h1>
        <p className="text-sm text-neutral-400">
          Retrouvez une copie déposée sans connaître son identifiant : filtrez par état, ouvrez son dossier.
        </p>
      </header>

      {actorFailure && <StatusMessage kind="error">{describeFailure(actorFailure)}</StatusMessage>}

      {/* flex-wrap: on un mobile étroit, les 8 filtres passent sur plusieurs lignes plutôt que de déborder (même convention que HouseholdsWorkspace). */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrer la file par état">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            type="button"
            size="sm"
            variant={filter === f.value ? 'default' : 'outline'}
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className="w-full sm:w-auto"
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card className="border-white/10 bg-surface-dark">
        <CardHeader>
          <h2 className="text-base font-semibold text-white">{FILTERS.find((f) => f.value === filter)?.label}</h2>
        </CardHeader>
        <CardContent>
          {noPermission ? (
            <StatusMessage kind="error">
              Vous n’avez pas les droits nécessaires pour suivre les diagnostics candidats libres.
            </StatusMessage>
          ) : (
            <>
              {failure && <StatusMessage kind="error">{describeFailure(failure)}</StatusMessage>}
              {listRefreshed && <p role="status" className="mb-4 text-sm text-neutral-400">Liste actualisée</p>}
              {loading || actorLoading ? (
                <p role="status" className="flex items-center gap-2 text-neutral-300">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Chargement…
                </p>
              ) : items.length === 0 && !failure ? (
                <p role="status" className="text-neutral-400">
                  {EMPTY_LABEL[filter]}
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Candidat</TableHead>
                          <TableHead>Instrument</TableHead>
                          <TableHead>Dépôt</TableHead>
                          <TableHead>État</TableHead>
                          <TableHead>Dernière activité</TableHead>
                          <TableHead className="sr-only">Ouvrir</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((row) => (
                          <TableRow key={row.submissionId}>
                            <TableCell className="text-neutral-100">{displayName(row.candidate)}</TableCell>
                            <TableCell>
                              <div className="text-neutral-100">{row.instrument.title}</div>
                              <div className="text-xs text-neutral-400">
                                {row.instrument.instrumentKey}@{row.instrument.version}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-neutral-100">v{row.submission.version}</div>
                              <div className="text-xs text-neutral-400">{formatDate(row.submission.createdAt, organizationTimezone)}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={STATE_BADGE_VARIANT[row.state]}>{STATE_LABEL[row.state]}</Badge>
                            </TableCell>
                            <TableCell className="text-neutral-300">{formatDate(row.lastActivityAt, organizationTimezone)}</TableCell>
                            <TableCell>
                              <Button asChild size="sm" variant="outline">
                                <Link
                                  href={`${basePath}/${row.submissionId}`}
                                  aria-label={`Ouvrir la copie de ${displayName(row.candidate)}`}
                                >
                                  Ouvrir
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {nextCursor && (
                    <div className="mt-4 flex justify-center">
                      <Button type="button" variant="outline" disabled={loadingMore} onClick={() => void load(nextCursor)}>
                        {loadingMore ? 'Chargement…' : 'Afficher plus'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
