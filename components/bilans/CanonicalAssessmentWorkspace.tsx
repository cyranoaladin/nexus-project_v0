'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Assignment = {
  id: string;
  definitionId: string;
  opensAt: string;
  dueAt: string | null;
  status: string;
};

type PublicItem = {
  id: string;
  prompt: string;
  responseMode: 'AUTOMATIC_QCM' | 'MANUAL_SHORT_RESPONSE';
  options?: Array<{ index: number; text: string }>;
  maxCharacters?: number;
};

type PublicDefinition = {
  id: string;
  title: string;
  framing: string;
  targetDurationMinutes: number;
  items: PublicItem[];
};

type SavedResponse = {
  itemId: string;
  selectedOptionIndex: number | null;
  textValue: string | null;
  version: number;
};

type Attempt = {
  id: string;
  status: string;
  pendingManualReviewCount?: number;
  responses?: SavedResponse[];
};

type DraftResponse = {
  selectedOptionIndex?: number;
  textValue?: string;
  version: number;
};

const apiRoot = '/api/bilan-gratuit/v1/requests/current';

function idempotencyKey(): string {
  return crypto.randomUUID();
}

async function jsonRequest<T>(
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
    error?: string;
    code?: string;
  };
  if (!response.ok) {
    throw new Error(body.code ?? body.error ?? 'REQUEST_FAILED');
  }
  return body as T;
}

export function CanonicalAssessmentWorkspace() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [definition, setDefinition] = useState<PublicDefinition | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftResponse>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('Chargement de votre espace sécurisé…');
  const [report, setReport] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    void jsonRequest<{ assignments: Assignment[] }>(`${apiRoot}/assignments`)
      .then(({ assignments: available }) => {
        if (!active) return;
        setAssignments(available);
        setAssignmentId(available.find(({ status }) => (
          status === 'AVAILABLE' || status === 'ASSIGNED'
        ))?.id ?? available[0]?.id ?? null);
        setMessage(available.length
          ? 'Une évaluation est disponible.'
          : 'Aucune évaluation ne vous est actuellement affectée.');
      })
      .catch(() => {
        if (active) setMessage(
          'Votre espace d’évaluation n’est pas disponible. Reconnectez-vous avec votre lien sécurisé.',
        );
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!assignmentId) return;
    let active = true;
    void jsonRequest<{ definition: PublicDefinition }>(
      `${apiRoot}/assignments/${assignmentId}/definition`,
    ).then(({ definition: publicDefinition }) => {
      if (active) setDefinition(publicDefinition);
    }).catch(() => {
      if (active) setMessage(
        'Cette évaluation reste bloquée jusqu’à sa validation pédagogique.',
      );
    });
    return () => {
      active = false;
    };
  }, [assignmentId]);

  const refreshAttempt = useCallback(async (attemptId: string) => {
    const { attempt: status } = await jsonRequest<{ attempt: Attempt }>(
      `${apiRoot}/attempts/${attemptId}/status`,
    );
    setAttempt(status);
    setDrafts(Object.fromEntries((status.responses ?? []).map((response) => [
      response.itemId,
      {
        ...(response.selectedOptionIndex === null
          ? {}
          : { selectedOptionIndex: response.selectedOptionIndex }),
        ...(response.textValue === null
          ? {}
          : { textValue: response.textValue }),
        version: response.version,
      },
    ])));
    return status;
  }, []);

  const start = async () => {
    if (!assignmentId) return;
    setMessage('Ouverture de votre tentative…');
    try {
      const { attempt: started } = await jsonRequest<{ attempt: Attempt }>(
        `${apiRoot}/assignments/${assignmentId}/attempt`,
        {
          method: 'POST',
          headers: { 'idempotency-key': idempotencyKey() },
        },
      );
      await refreshAttempt(started.id);
      setMessage('Votre travail est sauvegardé au fil de l’évaluation.');
    } catch {
      setMessage('Impossible d’ouvrir cette tentative pour le moment.');
    }
  };

  const save = async (item: PublicItem, draft: DraftResponse) => {
    if (!attempt || attempt.status !== 'IN_PROGRESS' || saving.has(item.id)) return;
    setSaving((current) => new Set(current).add(item.id));
    setMessage('Sauvegarde en cours…');
    try {
      const { response } = await jsonRequest<{
        response: { itemId: string; version: number };
      }>(
        `${apiRoot}/attempts/${attempt.id}/responses/${item.id}`,
        {
          method: 'PUT',
          headers: { 'idempotency-key': idempotencyKey() },
          body: JSON.stringify({
            expectedVersion: draft.version,
            response: item.responseMode === 'AUTOMATIC_QCM'
              ? { selectedOptionIndex: draft.selectedOptionIndex }
              : { textValue: draft.textValue },
          }),
        },
      );
      setDrafts((current) => ({
        ...current,
        [item.id]: { ...draft, version: response.version },
      }));
      setMessage('Sauvegarde effectuée.');
    } catch (error) {
      if (error instanceof Error && error.message === 'RESPONSE_VERSION_CONFLICT') {
        await refreshAttempt(attempt.id);
        setMessage('Une version plus récente a été restaurée.');
      } else {
        setMessage('La sauvegarde a échoué. Vérifiez votre connexion avant de continuer.');
      }
    } finally {
      setSaving((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  };

  const submit = async () => {
    if (!attempt || saving.size > 0) return;
    if (!window.confirm(
      'Confirmer la soumission ? Vos réponses ne pourront plus être modifiées.',
    )) return;
    try {
      const { attempt: submitted } = await jsonRequest<{ attempt: Attempt }>(
        `${apiRoot}/attempts/${attempt.id}/submit`,
        {
          method: 'POST',
          headers: { 'idempotency-key': idempotencyKey() },
        },
      );
      setAttempt(submitted);
      setMessage(
        submitted.status === 'PENDING_MANUAL_REVIEW'
          ? 'Soumission reçue. Une correction humaine est en cours.'
          : 'Soumission reçue. Le résultat est en préparation.',
      );
    } catch {
      setMessage('La soumission n’a pas abouti. Votre travail sauvegardé reste disponible.');
    }
  };

  const loadReport = async () => {
    if (!attempt) return;
    try {
      const publication = await jsonRequest<{ publication: unknown }>(
        `${apiRoot}/attempts/${attempt.id}/report`,
      );
      setReport(publication.publication);
      setMessage('Votre bilan publié est disponible.');
    } catch {
      setMessage('Le bilan n’est pas encore publié pour votre audience.');
    }
  };

  const answered = useMemo(() => Object.values(drafts).filter((draft) => (
    draft.selectedOptionIndex !== undefined || Boolean(draft.textValue?.trim())
  )).length, [drafts]);
  const editable = attempt?.status === 'IN_PROGRESS';

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-accent">
          Espace bilan sécurisé
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">
          Test de positionnement
        </h1>
        <p role="status" aria-live="polite" className="mt-3 text-neutral-300">
          {message}
        </p>

        {!attempt && assignmentId && definition ? (
          <div className="mt-8 rounded-2xl bg-surface-darker/70 p-5">
            <h2 className="text-xl font-semibold text-white">{definition.title}</h2>
            <p className="mt-2 text-neutral-300">{definition.framing}</p>
            <p className="mt-3 text-sm text-neutral-400">
              Durée indicative : {definition.targetDurationMinutes} minutes ·{' '}
              {definition.items.length} questions
            </p>
            <button
              type="button"
              onClick={start}
              className="mt-5 rounded-xl bg-brand-accent px-5 py-3 font-semibold text-surface-darker"
            >
              Commencer ou reprendre
            </button>
          </div>
        ) : null}

        {attempt && definition ? (
          <div className="mt-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-neutral-300">
                Progression : {answered}/{definition.items.length}
              </p>
              <p className="text-sm text-neutral-400">
                Statut : {attempt.status}
              </p>
            </div>
            <div className="space-y-5">
              {definition.items.map((item, index) => {
                const draft = drafts[item.id] ?? { version: 0 };
                return (
                  <fieldset
                    key={item.id}
                    disabled={!editable}
                    className="rounded-2xl border border-white/10 bg-surface-darker/60 p-5"
                  >
                    <legend className="px-2 text-sm text-neutral-400">
                      Question {index + 1}
                    </legend>
                    <p className="mb-4 font-medium text-white">{item.prompt}</p>
                    {item.responseMode === 'AUTOMATIC_QCM'
                      ? item.options?.map((option) => (
                        <label
                          key={option.index}
                          className="mb-2 flex cursor-pointer items-start gap-3 rounded-xl p-3 hover:bg-white/5"
                        >
                          <input
                            type="radio"
                            name={item.id}
                            checked={draft.selectedOptionIndex === option.index}
                            onChange={() => {
                              const next = {
                                selectedOptionIndex: option.index,
                                version: draft.version,
                              };
                              setDrafts((current) => ({ ...current, [item.id]: next }));
                              void save(item, next);
                            }}
                            className="mt-1"
                          />
                          <span className="text-neutral-200">{option.text}</span>
                        </label>
                      ))
                      : (
                        <div>
                          <label htmlFor={`response-${item.id}`} className="sr-only">
                            Votre réponse à la question {index + 1}
                          </label>
                          <textarea
                            id={`response-${item.id}`}
                            value={draft.textValue ?? ''}
                            maxLength={item.maxCharacters ?? 2_000}
                            onChange={(event) => {
                              const next = {
                                textValue: event.target.value,
                                version: draft.version,
                              };
                              setDrafts((current) => ({ ...current, [item.id]: next }));
                            }}
                            onBlur={() => {
                              if (drafts[item.id]?.textValue?.trim()) {
                                void save(item, drafts[item.id]);
                              }
                            }}
                            className="min-h-32 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-white"
                          />
                        </div>
                      )}
                    <p className="mt-2 text-xs text-neutral-400">
                      {saving.has(item.id) ? 'Sauvegarde…' : 'Sauvegarde automatique'}
                    </p>
                  </fieldset>
                );
              })}
            </div>
            {editable ? (
              <button
                type="button"
                onClick={submit}
                disabled={saving.size > 0}
                className="mt-7 rounded-xl bg-brand-accent px-5 py-3 font-semibold text-surface-darker disabled:opacity-50"
              >
                Soumettre définitivement
              </button>
            ) : (
              <button
                type="button"
                onClick={loadReport}
                className="mt-7 rounded-xl border border-brand-accent px-5 py-3 font-semibold text-brand-accent"
              >
                Vérifier la disponibilité du bilan
              </button>
            )}
          </div>
        ) : null}

        {report ? (
          <pre className="mt-8 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-black/20 p-5 text-sm text-neutral-200">
            {JSON.stringify(report, null, 2)}
          </pre>
        ) : null}

        {assignments.length > 1 && !attempt ? (
          <label className="mt-6 block text-sm text-neutral-300">
            Évaluation
            <select
              value={assignmentId ?? ''}
              onChange={(event) => setAssignmentId(event.target.value)}
              className="mt-2 block w-full rounded-xl bg-surface-darker p-3"
            >
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.definitionId}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </section>
  );
}
