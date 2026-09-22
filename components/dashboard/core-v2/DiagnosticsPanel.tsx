'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CATALOG_STATUS_LABELS,
  type DiagnosticAssignment,
  type DiagnosticInstrumentRef,
  describeFailure,
  isAttributableCatalogStatus,
  v2,
} from './api';
import { useAction } from './actions';
import { useStaffActor } from './useStaffActor';
import { StatusMessage } from './StatusMessage';

/**
 * Dossier candidat — onglet "Diagnostics" (mission §6/§7). Attribution
 * depuis le dossier, état après rechargement, suivi des dépôts sans accès
 * au contenu académique (celui-ci reste réservé à ADMIN côté API).
 */
export function DiagnosticsPanel({ studentId }: { studentId: string }) {
  const { can } = useStaffActor();
  const [catalog, setCatalog] = useState<DiagnosticInstrumentRef[] | null>(null);
  const [assignments, setAssignments] = useState<DiagnosticAssignment[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const [catalogResult, assignmentsResult] = await Promise.all([
      v2<DiagnosticInstrumentRef[]>('/staff/diagnostics/catalog'),
      v2<DiagnosticAssignment[]>(`/staff/students/${studentId}/diagnostics`),
    ]);
    if (catalogResult.ok) setCatalog(catalogResult.data);
    if (assignmentsResult.ok) setAssignments(assignmentsResult.data);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const revokeAction = useAction(refresh);

  if (loading) {
    return <p role="status" className="text-sm text-neutral-400">Chargement des diagnostics…</p>;
  }

  const attributable = (catalog ?? []).filter((i) => isAttributableCatalogStatus(i.catalogStatus));
  const alreadyAttributedIds = new Set((assignments ?? []).filter((a) => a.status !== 'REVOKED').map((a) => a.instrumentRef.id));

  return (
    <section aria-label="Diagnostics" className="mt-4 space-y-3 rounded-lg border border-white/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-neutral-100">Diagnostics</h4>
        <AttributeDialog
          studentId={studentId}
          instruments={attributable.filter((i) => !alreadyAttributedIds.has(i.id))}
          onDone={refresh}
        />
      </div>

      {(catalog ?? []).some((i) => !isAttributableCatalogStatus(i.catalogStatus)) && (
        <p className="text-xs text-neutral-500">
          Le catalogue contient aussi des instruments non attribuables (
          {(catalog ?? [])
            .filter((i) => !isAttributableCatalogStatus(i.catalogStatus))
            .map((i) => CATALOG_STATUS_LABELS[i.catalogStatus])
            .join(', ')}
          ) — non proposés ci-dessus.
        </p>
      )}

      {(assignments ?? []).length === 0 && <p role="status" className="text-sm text-neutral-400">Aucun diagnostic attribué.</p>}

      <ul className="space-y-2">
        {(assignments ?? []).map((assignment) => {
          // A REJECTED deposit (failed antivirus / write-verification) is
          // never presented as "the current submission" — it still exists
          // for audit, but never as something usable.
          const usableSubmissions = assignment.submissions.filter((s) => s.status !== 'REJECTED');
          const currentSubmission = usableSubmissions.length
            ? usableSubmissions.reduce((max, s) => (s.version > max.version ? s : max))
            : null;
          const rejectedCount = assignment.submissions.length - usableSubmissions.length;
          return (
            <li key={assignment.id} className="rounded border border-white/10 p-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-neutral-100">
                    {assignment.instrumentRef.title}
                    <span className="ml-2 text-xs text-neutral-500">
                      {assignment.instrumentKeySnapshot}@{assignment.instrumentVersionSnapshot}
                    </span>
                  </p>
                  <p className="text-xs text-neutral-400">
                    Statut : {assignment.status}
                    {assignment.dueAt && ` · échéance ${assignment.dueAt.slice(0, 10)}`}
                  </p>
                  {currentSubmission ? (
                    <p className="text-xs text-neutral-400">
                      Dépôt v{currentSubmission.version} reçu ({currentSubmission.status}) — {currentSubmission.originalFilename}
                      {can('DIAGNOSTIC_BILAN_REVIEW') && (
                        <>
                          {' · '}
                          <Link href={`/dashboard/admin/diagnostics-candidat-libre/${currentSubmission.id}`} className="underline">
                            Voir le traitement / bilan
                          </Link>
                        </>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-500">Aucun dépôt reçu pour l’instant.</p>
                  )}
                  {rejectedCount > 0 && (
                    <p className="text-xs text-amber-400">
                      {rejectedCount} dépôt{rejectedCount > 1 ? 's' : ''} refusé{rejectedCount > 1 ? 's' : ''} (contrôle de sécurité).
                    </p>
                  )}
                </div>
                {assignment.status !== 'REVOKED' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={revokeAction.pending !== null}
                    onClick={() =>
                      void revokeAction.run(
                        `revoke:${assignment.id}`,
                        () =>
                          v2(`/staff/diagnostics/assignments/${assignment.id}/revoke`, {
                            method: 'POST',
                            json: { reason: 'Révocation manuelle depuis le dossier.' },
                          }),
                        'Diagnostic révoqué.',
                      )
                    }
                  >
                    Révoquer
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {revokeAction.failure && <StatusMessage kind="error">{describeFailure(revokeAction.failure)}</StatusMessage>}
      {revokeAction.success && <StatusMessage kind="success">{revokeAction.success}</StatusMessage>}
    </section>
  );
}

function AttributeDialog({
  studentId,
  instruments,
  onDone,
}: {
  studentId: string;
  instruments: DiagnosticInstrumentRef[];
  onDone: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [instrumentRefId, setInstrumentRefId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [modalities, setModalities] = useState('');
  const action = useAction(async () => {
    setOpen(false);
    setInstrumentRefId('');
    setDueAt('');
    setModalities('');
    await onDone();
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" disabled={instruments.length === 0}>
          Attribuer un diagnostic
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attribuer un diagnostic</DialogTitle>
          <DialogDescription>
            La version, le barème et les conditions de l’instrument sont figés au moment de l’attribution.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!instrumentRefId) return;
            void action.run(
              'attribute',
              () =>
                v2(`/staff/students/${studentId}/diagnostics`, {
                  method: 'POST',
                  json: {
                    instrumentRefId,
                    dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
                    modalities: modalities.trim() || undefined,
                  },
                }),
              'Diagnostic attribué.',
            );
          }}
        >
          <div>
            <Label htmlFor="diagnostic-instrument">Instrument</Label>
            <select
              id="diagnostic-instrument"
              required
              className="w-full rounded border border-white/20 bg-surface-dark p-2 text-sm text-neutral-100"
              value={instrumentRefId}
              onChange={(e) => setInstrumentRefId(e.target.value)}
            >
              <option value="">— Choisir —</option>
              {instruments.map((instrument) => (
                <option key={instrument.id} value={instrument.id}>
                  {instrument.title} ({CATALOG_STATUS_LABELS[instrument.catalogStatus]})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="diagnostic-due-at">Échéance (optionnel)</Label>
            <Input id="diagnostic-due-at" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="diagnostic-modalities">Modalités (optionnel)</Label>
            <Input id="diagnostic-modalities" value={modalities} onChange={(e) => setModalities(e.target.value)} />
          </div>
          {action.failure && <StatusMessage kind="error">{describeFailure(action.failure)}</StatusMessage>}
          <div className="flex justify-end">
            <Button type="submit" disabled={action.pending !== null || !instrumentRefId}>
              {action.pending ? 'Attribution…' : 'Confirmer l’attribution'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
