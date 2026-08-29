'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

type TeamRole = 'ASSISTANTE' | 'COACH' | 'ADMIN';
type ReviewTask = {
  id: string;
  itemId: string;
  textValue: string | null;
  status: string;
  claimVersion: number;
  claimedByUserId: string | null;
  claimLeaseExpiresAt: string | null;
  attemptId: string;
  definitionRef: {
    definitionId: string;
    version: string;
    sha256: string;
  };
};
type TeamRequest = {
  id: string;
  studentId: string;
  subject: string;
  gradeLevel: string;
  schoolYear: string;
  status: string;
  lastActivityAt: string;
};
type TeamDefinition = {
  definitionId: string;
  moduleId: string;
  subject: string;
  level: string;
  title: string;
  publicationStatus: string;
  version: string;
  sha256: string;
  sessionCount: number;
  itemCount: number;
  manualResponseCount: number;
};

async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      'content-type': 'application/json',
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({})) as {
    code?: string;
    error?: string;
  };
  if (!response.ok) throw new Error(body.code ?? body.error ?? 'REQUEST_FAILED');
  return body as T;
}

const key = () => crypto.randomUUID();
const teamApi = '/api/bilan-gratuit/v1/team';

export function CanonicalAssessmentTeamWorkspace({ role }: { role: TeamRole }) {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [requests, setRequests] = useState<TeamRequest[]>([]);
  const [definitions, setDefinitions] = useState<TeamDefinition[]>([]);
  const [message, setMessage] = useState('Prêt.');
  const [attemptId, setAttemptId] = useState('');
  const [audience, setAudience] = useState<'NEXUS' | 'PARENT' | 'STUDENT'>('NEXUS');
  const [revisionId, setRevisionId] = useState('');
  const [publicationId, setPublicationId] = useState('');
  const approvedDefinitions = definitions.filter(
    ({ publicationStatus }) => publicationStatus === 'PUBLICATION_APPROVED',
  );

  const refreshQueue = useCallback(async () => {
    if (role === 'ASSISTANTE') return;
    try {
      const result = await api<{ tasks: ReviewTask[] }>(
        `${teamApi}/manual-reviews`,
      );
      setTasks(result.tasks);
    } catch {
      setMessage('La file de correction n’est pas accessible avec ce rôle.');
    }
  }, [role]);

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

  const refreshAssignmentData = useCallback(async () => {
    try {
      const [requestResult, catalogResult] = await Promise.all([
        api<{ requests: TeamRequest[] }>(`${teamApi}/requests`),
        api<{ definitions: TeamDefinition[] }>(`${teamApi}/catalog`),
      ]);
      setRequests(requestResult.requests);
      setDefinitions(catalogResult.definitions);
    } catch {
      setMessage('Les données d’affectation ne sont pas accessibles.');
    }
  }, []);

  useEffect(() => {
    void refreshAssignmentData();
  }, [refreshAssignmentData]);

  const createAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const request = requests.find(({ id }) => id === data.get('requestId'));
    const definition = approvedDefinitions.find(
      ({ definitionId }) => definitionId === data.get('definitionId'),
    );
    if (!request || !definition || role === 'COACH') {
      setMessage('Aucune définition pédagogiquement publiable n’est disponible.');
      return;
    }
    const opensAt = String(data.get('opensAt') ?? '');
    const dueAt = String(data.get('dueAt') ?? '');
    try {
      await api(`${teamApi}/assignments`, {
        method: 'POST',
        headers: { 'idempotency-key': key() },
        body: JSON.stringify({
          requestId: request.id,
          studentId: request.studentId,
          definitionId: definition.definitionId,
          definitionVersion: definition.version,
          definitionChecksum: definition.sha256,
          opensAt: new Date(opensAt).toISOString(),
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          maxAttempts: Number(data.get('maxAttempts')),
        }),
      });
      setMessage('Affectation créée avec sa provenance immuable.');
      await refreshAssignmentData();
      event.currentTarget.reset();
    } catch {
      setMessage('L’affectation a été refusée par les contrôles de provenance ou d’autorisation.');
    }
  };

  const claim = async (taskId: string) => {
    try {
      await api(`${teamApi}/manual-reviews/${taskId}/claim`, {
        method: 'POST',
        headers: { 'idempotency-key': key() },
        body: JSON.stringify({ leaseSeconds: 300 }),
      });
      setMessage('Correction prise en charge pour cinq minutes.');
      await refreshQueue();
    } catch {
      setMessage('Cette correction a déjà été prise en charge.');
    }
  };

  const complete = async (
    event: FormEvent<HTMLFormElement>,
    task: ReviewTask,
  ) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await api(`${teamApi}/manual-reviews/${task.id}/decision`, {
        method: 'POST',
        headers: { 'idempotency-key': key() },
        body: JSON.stringify({
          expectedClaimVersion: task.claimVersion,
          awardedPoints: Number(data.get('awardedPoints')),
          internalComment: String(data.get('internalComment') ?? ''),
          publishableComment: String(data.get('publishableComment') ?? ''),
          rubricVersion: 'canonical-raw-item-score-v1',
        }),
      });
      setMessage('Décision enregistrée et historisée.');
      await refreshQueue();
    } catch {
      setMessage('La décision n’a pas été enregistrée. Vérifiez la lease et les champs.');
    }
  };

  const score = async () => {
    try {
      await api(`${teamApi}/attempts/${attemptId}/score`, {
        method: 'POST',
        headers: { 'idempotency-key': key() },
        body: JSON.stringify({ resultKind: 'FINAL' }),
      });
      setMessage('Score final calculé avec la politique versionnée.');
    } catch (error) {
      setMessage(error instanceof Error && error.message === 'MANUAL_REVIEW_REQUIRED'
        ? 'Score final bloqué : une correction humaine manque.'
        : 'Le scoring n’a pas abouti.');
    }
  };

  const generate = async () => {
    try {
      const result = await api<{ revision: { id: string } }>(
        `${teamApi}/reports/generate`,
        {
          method: 'POST',
          headers: { 'idempotency-key': key() },
          body: JSON.stringify({ attemptId, audience }),
        },
      );
      setRevisionId(result.revision.id);
      setMessage('Bilan généré en brouillon de revue. Aucune publication automatique.');
    } catch {
      setMessage('La génération exige un score final et une provenance cohérente.');
    }
  };

  const approve = async () => {
    try {
      await api(`${teamApi}/reports/${revisionId}/approve`, {
        method: 'POST',
        headers: { 'idempotency-key': key() },
        body: JSON.stringify({ motif: 'Données factuelles et audience vérifiées.' }),
      });
      setMessage('Révision approuvée nominativement.');
    } catch {
      setMessage('Cette révision ne peut pas être approuvée avec ce rôle ou cet état.');
    }
  };

  const publish = async () => {
    try {
      const result = await api<{ publication: { id: string } }>(
        `${teamApi}/reports/${revisionId}/publish`,
        {
          method: 'POST',
          headers: { 'idempotency-key': key() },
        },
      );
      setPublicationId(result.publication.id);
      setMessage(`Publication ${audience} effectuée et auditée.`);
    } catch {
      setMessage('La publication exige une approbation préalable et le rôle adéquat.');
    }
  };

  const revoke = async () => {
    try {
      await api(`${teamApi}/publications/${publicationId}/revoke`, {
        method: 'POST',
        headers: { 'idempotency-key': key() },
        body: JSON.stringify({ reason: 'Révision interne requise.' }),
      });
      setMessage('Publication révoquée ; l’historique est conservé.');
    } catch {
      setMessage('La révocation n’a pas abouti.');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-accent">
          Bilans canoniques
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">
          Correction, scoring et publication
        </h1>
        <p role="status" aria-live="polite" className="mt-3 text-neutral-300">
          {message}
        </p>
      </header>

      <section className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5">
        <h2 className="font-semibold text-amber-100">Affectations verrouillées</h2>
        <p className="mt-2 text-sm text-amber-50/80">
          {definitions.length || 17} modules restent HUMAN_VALIDATION_REQUIRED.
          L’API refusera toute
          affectation réelle jusqu’à une validation disciplinaire et propriétaire
          liée au hash. Aucune validation n’est créée depuis cette interface.
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-xl font-semibold text-white">
          Demandes et définitions canoniques
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className="font-semibold text-neutral-100">Demandes admissibles</h3>
            {requests.map((request) => (
              <article
                key={request.id}
                className="rounded-xl border border-white/10 p-3 text-sm text-neutral-200"
              >
                <p className="font-semibold text-white">Demande {request.id}</p>
                <p>
                  {request.subject} · {request.gradeLevel} · {request.schoolYear}
                </p>
                <p className="text-neutral-400">{request.status}</p>
              </article>
            ))}
            {!requests.length ? (
              <p className="text-sm text-neutral-400">Aucune demande admissible.</p>
            ) : null}
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold text-neutral-100">Catalogue versionné</h3>
            {definitions.map((definition) => (
              <article
                key={definition.definitionId}
                className="rounded-xl border border-white/10 p-3 text-sm text-neutral-200"
              >
                <p className="font-semibold text-white">{definition.title}</p>
                <p>
                  {definition.sessionCount} séances · {definition.itemCount} items ·{' '}
                  {definition.manualResponseCount} corrections manuelles
                </p>
                <p className="break-all text-xs text-amber-200">
                  {definition.publicationStatus} · {definition.version} ·{' '}
                  {definition.sha256}
                </p>
              </article>
            ))}
          </div>
        </div>
        <form
          onSubmit={(event) => void createAssignment(event)}
          className="mt-6 grid gap-3 md:grid-cols-2"
        >
          <label className="text-sm text-neutral-200">
            Demande
            <select
              name="requestId"
              required
              className="mt-1 block w-full rounded-lg bg-surface-darker p-2"
            >
              <option value="">Sélectionner</option>
              {requests.map((request) => (
                <option key={request.id} value={request.id}>
                  {request.id} · {request.gradeLevel}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-neutral-200">
            Définition validée
            <select
              name="definitionId"
              required
              disabled={!approvedDefinitions.length}
              className="mt-1 block w-full rounded-lg bg-surface-darker p-2"
            >
              <option value="">
                {approvedDefinitions.length
                  ? 'Sélectionner'
                  : 'Aucune définition publiable'}
              </option>
              {approvedDefinitions.map((definition) => (
                <option
                  key={definition.definitionId}
                  value={definition.definitionId}
                >
                  {definition.title} · {definition.version}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-neutral-200">
            Ouverture
            <input
              name="opensAt"
              type="datetime-local"
              required
              className="mt-1 block w-full rounded-lg bg-surface-darker p-2"
            />
          </label>
          <label className="text-sm text-neutral-200">
            Échéance facultative
            <input
              name="dueAt"
              type="datetime-local"
              className="mt-1 block w-full rounded-lg bg-surface-darker p-2"
            />
          </label>
          <label className="text-sm text-neutral-200">
            Nombre maximal de tentatives
            <input
              name="maxAttempts"
              type="number"
              min="1"
              max="3"
              defaultValue="1"
              required
              className="mt-1 block w-full rounded-lg bg-surface-darker p-2"
            />
          </label>
          <button
            type="submit"
            disabled={
              role === 'COACH'
              || !requests.length
              || !approvedDefinitions.length
            }
            className="self-end rounded-lg bg-brand-accent px-4 py-2 font-semibold text-surface-darker disabled:cursor-not-allowed disabled:opacity-50"
          >
            Créer l’affectation
          </button>
        </form>
      </section>

      {role !== 'ASSISTANTE' ? (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">File de correction</h2>
            <button
              type="button"
              onClick={() => void refreshQueue()}
              className="rounded-lg border border-white/15 px-3 py-2 text-sm text-neutral-200"
            >
              Actualiser
            </button>
          </div>
          <div className="space-y-4">
            {tasks.map((task) => (
              <article
                key={task.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
              >
                <p className="text-xs text-neutral-400">
                  {task.definitionRef.definitionId} · {task.itemId} · {task.status}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-neutral-100">
                  {task.textValue}
                </p>
                {task.status === 'PENDING' ? (
                  <button
                    type="button"
                    onClick={() => void claim(task.id)}
                    className="mt-4 rounded-lg bg-brand-accent px-4 py-2 font-semibold text-surface-darker"
                  >
                    Prendre en charge
                  </button>
                ) : (
                  <form
                    onSubmit={(event) => void complete(event, task)}
                    className="mt-4 grid gap-3 md:grid-cols-2"
                  >
                    <label className="text-sm text-neutral-200">
                      Points (0 à 1)
                      <input
                        name="awardedPoints"
                        type="number"
                        min="0"
                        max="1"
                        step="0.25"
                        required
                        className="mt-1 block w-full rounded-lg bg-surface-darker p-2"
                      />
                    </label>
                    <label className="text-sm text-neutral-200">
                      Commentaire publiable
                      <input
                        name="publishableComment"
                        maxLength={1_000}
                        className="mt-1 block w-full rounded-lg bg-surface-darker p-2"
                      />
                    </label>
                    <label className="text-sm text-neutral-200 md:col-span-2">
                      Commentaire interne
                      <textarea
                        name="internalComment"
                        maxLength={2_000}
                        className="mt-1 block w-full rounded-lg bg-surface-darker p-2"
                      />
                    </label>
                    <button
                      type="submit"
                      className="rounded-lg bg-brand-accent px-4 py-2 font-semibold text-surface-darker"
                    >
                      Enregistrer la décision
                    </button>
                  </form>
                )}
              </article>
            ))}
            {!tasks.length ? (
              <p className="rounded-2xl border border-white/10 p-5 text-neutral-400">
                Aucune correction en attente.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-xl font-semibold text-white">
          Scoring et restitution par audience
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-neutral-200">
            Identifiant de tentative
            <input
              value={attemptId}
              onChange={(event) => setAttemptId(event.target.value)}
              className="mt-1 block w-full rounded-lg bg-surface-darker p-2"
            />
          </label>
          <label className="text-sm text-neutral-200">
            Audience
            <select
              value={audience}
              onChange={(event) => setAudience(
                event.target.value as 'NEXUS' | 'PARENT' | 'STUDENT',
              )}
              className="mt-1 block w-full rounded-lg bg-surface-darker p-2"
            >
              <option value="NEXUS">Équipe Nexus</option>
              <option value="PARENT">Parent</option>
              <option value="STUDENT">Élève</option>
            </select>
          </label>
          <label className="text-sm text-neutral-200">
            Révision
            <input
              value={revisionId}
              onChange={(event) => setRevisionId(event.target.value)}
              className="mt-1 block w-full rounded-lg bg-surface-darker p-2"
            />
          </label>
          <label className="text-sm text-neutral-200">
            Publication
            <input
              value={publicationId}
              onChange={(event) => setPublicationId(event.target.value)}
              className="mt-1 block w-full rounded-lg bg-surface-darker p-2"
            />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={() => void score()} className="rounded-lg border border-white/20 px-4 py-2">
            Calculer le score final
          </button>
          <button type="button" onClick={() => void generate()} className="rounded-lg border border-white/20 px-4 py-2">
            Générer
          </button>
          <button type="button" onClick={() => void approve()} className="rounded-lg border border-white/20 px-4 py-2">
            Approuver
          </button>
          <button type="button" onClick={() => void publish()} className="rounded-lg bg-brand-accent px-4 py-2 font-semibold text-surface-darker">
            Publier
          </button>
          <button type="button" onClick={() => void revoke()} className="rounded-lg border border-red-400/50 px-4 py-2 text-red-200">
            Révoquer
          </button>
        </div>
      </section>
    </div>
  );
}
