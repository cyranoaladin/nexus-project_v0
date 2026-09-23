'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { type ApiFail, type DiagnosticAssignment, describeFailure, v2 } from './api';
import { PublishedBilanContentView, type PublishedBilanContent } from './PublishedBilanContentView';
import { StatusMessage } from './StatusMessage';
import { selectCurrentDiagnosticSubmission } from '@/lib/diagnostics/current-submission';

/**
 * Espace candidat — "Diagnostics libres" (mission §7). Le candidat retrouve
 * ses attributions, consulte le sujet scellé (accès par attribution +
 * identité, jamais un chemin public deviné) et dépose ses réponses. Un
 * second dépôt crée une nouvelle version, jamais un écrasement silencieux.
 */
export function DiagnosticsLibresWorkspace() {
  const [assignments, setAssignments] = useState<DiagnosticAssignment[] | null>(null);
  const [failure, setFailure] = useState<ApiFail | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await v2<DiagnosticAssignment[]>('/student/diagnostics/assignments');
    if (result.ok) {
      setAssignments(result.data);
      setFailure(null);
    } else {
      setFailure(result);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return <p role="status" className="text-neutral-300">Chargement de vos diagnostics…</p>;
  }
  if (failure) {
    return <StatusMessage kind="error">{describeFailure(failure)}</StatusMessage>;
  }

  return (
    <div className="core-v2 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Diagnostics libres</h1>
        <p className="text-sm text-neutral-400">Vos diagnostics attribués, leurs consignes et le dépôt de vos réponses.</p>
      </header>

      {(assignments ?? []).length === 0 && (
        <p role="status" className="text-neutral-400">Aucun diagnostic ne vous a été attribué pour l’instant.</p>
      )}

      <div className="space-y-4">
        {(assignments ?? []).map((assignment) => (
          <AssignmentCard key={assignment.id} assignment={assignment} onDeposited={refresh} />
        ))}
      </div>
    </div>
  );
}

const STATUS_LABELS: Record<DiagnosticAssignment['status'], string> = {
  ASSIGNED: 'À faire',
  SUBMITTED: 'Réponses déposées',
  REVOKED: 'Révoqué',
};

function AssignmentCard({ assignment, onDeposited }: { assignment: DiagnosticAssignment; onDeposited: () => Promise<void> }) {
  // A REJECTED deposit (failed the required security scan or write
  // verification) is never presented as a received submission.
  const currentSubmission = selectCurrentDiagnosticSubmission(assignment.submissions);
  const hasRejectedDeposit = assignment.submissions.some((submission) => submission.status === 'REJECTED');
  const revoked = assignment.status === 'REVOKED';

  return (
    <Card className="border-white/10 bg-surface-dark">
      <CardHeader>
        <h2 className="text-lg font-semibold text-white">{assignment.instrumentRef.title}</h2>
        <p className="text-sm text-neutral-400">
          {assignment.instrumentRef.subject} · {assignment.instrumentRef.durationMinutes} min · {STATUS_LABELS[assignment.status]}
          {assignment.dueAt && ` · à rendre avant le ${assignment.dueAt.slice(0, 10)}`}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {revoked ? (
          <StatusMessage kind="error">
            Cette attribution a été révoquée. Contactez l’équipe pédagogique pour la suite.
          </StatusMessage>
        ) : (
          <>
            {assignment.modalities && <p className="text-sm text-neutral-300">Modalités : {assignment.modalities}</p>}
            {assignment.conditionsSnapshot && <p className="text-sm text-neutral-400">{assignment.conditionsSnapshot}</p>}

            <a
              href={`/api/v2/student/diagnostics/assignments/${assignment.id}/subject`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex"
            >
              <Button type="button" variant="outline">
                Ouvrir le sujet
              </Button>
            </a>

            {currentSubmission ? (
              <p role="status" className="text-sm text-brand-accent">
                Dépôt reçu (version {currentSubmission.version}) — {currentSubmission.originalFilename}. Vous pouvez déposer
                une nouvelle version si nécessaire ; l’ancienne reste conservée.
              </p>
            ) : (
              <p className="text-sm text-neutral-500">Aucun dépôt pour l’instant.</p>
            )}
            {hasRejectedDeposit && (
              <StatusMessage kind="error">
                Un dépôt précédent a été refusé par le contrôle de sécurité et n’a pas été enregistré comme reçu. Vous pouvez déposer à nouveau.
              </StatusMessage>
            )}

            <DepositForm assignmentId={assignment.id} onDeposited={onDeposited} />
            {currentSubmission && <OwnBilanSection submissionId={currentSubmission.id} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Self-service bilan read (mission §7): fetched once on mount, never
 * polled in a loop — a manual "Actualiser" is offered instead. A 404
 * (nothing published yet) is not an error: it is simply not shown here at
 * all, the same as if the feature did not exist for this deposit yet.
 */
function OwnBilanSection({ submissionId }: { submissionId: string }) {
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'none' }
    | { kind: 'error'; failure: ApiFail }
    | { kind: 'ready'; revision: number; publishedAt: string | null; extractionTruncatedSnapshot: boolean; content: PublishedBilanContent }
  >({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    const result = await v2<{ revision: number; publishedAt: string | null; extractionTruncatedSnapshot: boolean; content: PublishedBilanContent }>(
      `/student/diagnostics/submissions/${submissionId}/bilan`,
    );
    if (result.ok) {
      setState({ kind: 'ready', ...result.data });
    } else if (result.status === 404) {
      setState({ kind: 'none' });
    } else {
      setState({ kind: 'error', failure: result });
    }
  }, [submissionId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === 'loading' || state.kind === 'none') return null;
  if (state.kind === 'error') {
    return (
      <div className="space-y-1">
        <StatusMessage kind="error">{describeFailure(state.failure)}</StatusMessage>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()}>Réessayer</Button>
      </div>
    );
  }
  return (
    <div className="space-y-2 border-t border-white/10 pt-4" data-testid="own-bilan-section">
      <h3 className="text-sm font-semibold text-white">Votre bilan (révision {state.revision})</h3>
      <PublishedBilanContentView content={state.content} truncated={state.extractionTruncatedSnapshot} />
    </div>
  );
}

function DepositForm({ assignmentId, onDeposited }: { assignmentId: string; onDeposited: () => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ApiFail | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  return (
    <form
      className="space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const file = inputRef.current?.files?.[0];
        if (!file || pending) return;
        setPending(true);
        setFailure(null);
        setSuccess(null);
        try {
          const formData = new FormData();
          formData.set('file', file);
          const response = await fetch(`/api/v2/student/diagnostics/assignments/${assignmentId}/submissions`, {
            method: 'POST',
            body: formData,
            credentials: 'same-origin',
          });
          const envelope = await response.json().catch(() => null);
          if (response.ok && envelope?.ok) {
            setSuccess(`Réponses déposées avec succès (version ${envelope.data.version}).`);
            if (inputRef.current) inputRef.current.value = '';
            await onDeposited();
          } else {
            setFailure({
              ok: false,
              status: response.status,
              code: envelope?.error?.code ?? `HTTP_${response.status}`,
              message: envelope?.error?.message ?? 'Dépôt refusé.',
              details: envelope?.error?.details,
            });
          }
        } finally {
          setPending(false);
        }
      }}
    >
      <label htmlFor={`deposit-${assignmentId}`} className="block text-sm text-neutral-300">
        Déposer vos réponses (PDF, 15 Mo maximum)
      </label>
      <input
        id={`deposit-${assignmentId}`}
        ref={inputRef}
        type="file"
        accept="application/pdf"
        required
        className="block w-full text-sm text-neutral-300"
      />
      {failure && <StatusMessage kind="error">{describeFailure(failure)}</StatusMessage>}
      {success && <StatusMessage kind="success">{success}</StatusMessage>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Envoi…' : 'Déposer'}
      </Button>
    </form>
  );
}
