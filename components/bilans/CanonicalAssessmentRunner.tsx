'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Confidence = 1 | 2 | 3 | 4;
type SavedAnswer = Readonly<{ optionId: string | null; confidence: Confidence | null }>;
type AttemptItem = Readonly<{
  id: string;
  prompt: string;
  options: readonly Readonly<{ id: string; label: string }>[];
  savedAnswer: SavedAnswer;
}>;
type AttemptDto = Readonly<{
  attemptId: string;
  pack: Readonly<{ slug: string; version: number; title: string }>;
  status: 'DRAFT';
  revision: number;
  expiresAt: string;
  items: readonly AttemptItem[];
}>;
type PendingAnswer = Readonly<{ itemId: string; optionId: string; confidence: Confidence }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAttemptDto(value: unknown): AttemptDto {
  if (!isRecord(value) || !Array.isArray(value.items) || typeof value.attemptId !== 'string') {
    throw new Error('RUNNER_RESPONSE_INVALID');
  }
  return value as AttemptDto;
}

async function loadAttempt(attemptId: string): Promise<AttemptDto> {
  const response = await fetch(`/api/bilans/attempts/${encodeURIComponent(attemptId)}`, {
    method: 'GET',
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error('RUNNER_LOAD_FAILED');
  return parseAttemptDto(await response.json());
}

function answersFrom(dto: AttemptDto): Record<string, SavedAnswer> {
  return Object.fromEntries(dto.items.map((item) => [item.id, item.savedAnswer]));
}

function confidenceLabel(value: Confidence): string {
  const labels = {
    1: 'Réponse choisie avec beaucoup d’incertitude',
    2: 'Réponse choisie avec une certaine incertitude',
    3: 'Réponse choisie avec assez de confiance',
    4: 'Réponse choisie avec beaucoup de confiance',
  } as const;
  return labels[value];
}

function idempotencyKey(kind: 'answer' | 'submit', attemptId: string, revision: number, suffix = ''): string {
  return `a87-${kind}-${attemptId}-${revision}-${suffix}`.slice(0, 180);
}

export function CanonicalAssessmentRunner({ attemptId }: Readonly<{ attemptId: string }>) {
  const [attempt, setAttempt] = useState<AttemptDto | null>(null);
  const [answers, setAnswers] = useState<Record<string, SavedAnswer>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<PendingAnswer | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const hydrate = useCallback(async () => {
    const loaded = await loadAttempt(attemptId);
    setAttempt(loaded);
    setAnswers(answersFrom(loaded));
    const firstIncomplete = loaded.items.findIndex(({ id }) => {
      const answer = loaded.items.find((item) => item.id === id)?.savedAnswer;
      return answer?.optionId === null || answer?.confidence === null;
    });
    setCurrentIndex(firstIncomplete < 0 ? 0 : firstIncomplete);
    return loaded;
  }, [attemptId]);

  useEffect(() => {
    let active = true;
    loadAttempt(attemptId)
      .then((loaded) => {
        if (!active) return;
        setAttempt(loaded);
        setAnswers(answersFrom(loaded));
        const firstIncomplete = loaded.items.findIndex((item) => (
          item.savedAnswer.optionId === null || item.savedAnswer.confidence === null
        ));
        setCurrentIndex(firstIncomplete < 0 ? 0 : firstIncomplete);
      })
      .catch(() => { if (active) setError('Le questionnaire ne peut pas être chargé. Réessayez.'); });
    return () => { active = false; };
  }, [attemptId]);

  const persist = useCallback(async (pending: PendingAnswer, baseRevision: number) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/bilans/attempts/${encodeURIComponent(attemptId)}/answers`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': idempotencyKey('answer', attemptId, baseRevision, `${pending.itemId}-${pending.optionId}-${pending.confidence}`),
        },
        body: JSON.stringify({ revision: baseRevision, answers: [pending] }),
      });
      if (response.status === 409) {
        const body = await response.json() as unknown;
        const serverRevision = isRecord(body)
          && isRecord(body.error)
          && isRecord(body.error.details)
          && typeof body.error.details.serverRevision === 'number'
          ? body.error.details.serverRevision
          : null;
        const reloaded = await hydrate();
        setAttempt({ ...reloaded, revision: serverRevision ?? reloaded.revision });
        setAnswers((current) => ({ ...current, [pending.itemId]: { optionId: pending.optionId, confidence: pending.confidence } }));
        setConflict(pending);
        return;
      }
      if (!response.ok) throw new Error('RUNNER_SAVE_FAILED');
      const body = await response.json() as { revision?: unknown };
      if (typeof body.revision !== 'number') throw new Error('RUNNER_SAVE_INVALID');
      const savedRevision = body.revision;
      setAttempt((current) => current === null ? current : { ...current, revision: savedRevision });
      setConflict(null);
    } catch {
      setError('La réponse n’a pas été enregistrée. Votre choix reste affiché; réessayez avant de continuer.');
      setConflict(pending);
    } finally {
      setSaving(false);
    }
  }, [attemptId, hydrate]);

  const currentItem = attempt?.items[currentIndex];
  const currentAnswer = currentItem === undefined ? undefined : answers[currentItem.id];
  const allComplete = useMemo(() => attempt !== null && attempt.items.every(({ id }) => (
    answers[id]?.optionId !== null
    && answers[id]?.optionId !== undefined
    && answers[id]?.confidence !== null
    && answers[id]?.confidence !== undefined
  )), [answers, attempt]);

  async function chooseConfidence(confidence: Confidence) {
    if (attempt === null || currentItem === undefined || currentAnswer?.optionId === null || currentAnswer?.optionId === undefined) return;
    const pending = { itemId: currentItem.id, optionId: currentAnswer.optionId, confidence } as const;
    setAnswers((current) => ({ ...current, [currentItem.id]: { optionId: pending.optionId, confidence } }));
    await persist(pending, attempt.revision);
  }

  async function submit() {
    if (attempt === null || !allComplete) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/bilans/attempts/${encodeURIComponent(attemptId)}/submit`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': idempotencyKey('submit', attemptId, attempt.revision),
        },
        body: JSON.stringify({ revision: attempt.revision }),
      });
      if (!response.ok) throw new Error('RUNNER_SUBMIT_FAILED');
      setSubmitted(true);
      setConfirming(false);
    } catch {
      setError('La soumission n’a pas abouti. Vos réponses restent enregistrées; réessayez.');
    } finally {
      setSaving(false);
    }
  }

  if (error !== null && attempt === null) {
    return <p role="alert" className="mx-auto max-w-xl rounded-2xl bg-red-50 p-5 text-red-900">{error}</p>;
  }
  if (attempt === null || currentItem === undefined) {
    return <p className="py-16 text-center text-slate-600">Chargement du questionnaire…</p>;
  }
  if (submitted) {
    return (
      <section className="mx-auto max-w-2xl rounded-3xl border border-emerald-200 bg-emerald-50 p-10 text-center">
        <h1 className="font-serif text-3xl font-semibold text-slate-950">Questionnaire envoyé</h1>
        <p className="mt-4 text-slate-700">Votre bilan est maintenant en cours de préparation et de revue.</p>
      </section>
    );
  }

  return (
    <main className="min-h-[75vh] bg-[radial-gradient(circle_at_top,#eef6ff_0%,#fffaf0_48%,#f8fafc_100%)] px-4 py-8 sm:py-12">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
        <header className="border-b border-slate-200 bg-slate-950 px-6 py-6 text-white sm:px-9">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Bilan Nexus</p>
          <p className="mt-2 text-xl font-semibold">{attempt.pack.title}</p>
          <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm text-slate-300">
            <span>Question {currentIndex + 1} sur {attempt.items.length}</span>
            <span>Expire le {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(attempt.expiresAt))}</span>
          </div>
        </header>

        <div className="p-6 sm:p-9">
          <h1 className="font-serif text-2xl font-semibold leading-snug text-slate-950 sm:text-3xl">{currentItem.prompt}</h1>
          <fieldset className="mt-7 space-y-3">
            <legend className="sr-only">Choisissez une réponse</legend>
            {currentItem.options.map((option) => (
              <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 hover:border-amber-500">
                <input
                  type="radio"
                  name={`answer-${currentItem.id}`}
                  aria-label={option.label}
                  checked={currentAnswer?.optionId === option.id}
                  onChange={() => {
                    setConflict(null);
                    setAnswers((current) => ({ ...current, [currentItem.id]: { optionId: option.id, confidence: null } }));
                  }}
                  className="mt-1 h-4 w-4 accent-amber-600"
                />
                <span className="text-base leading-6 text-slate-800">{option.label}</span>
              </label>
            ))}
          </fieldset>

          {currentAnswer?.optionId !== null && currentAnswer?.optionId !== undefined && (
            <section className="mt-8 rounded-2xl bg-slate-50 p-5" aria-labelledby="confidence-title">
              <h2 id="confidence-title" className="font-semibold text-slate-950">Quel est votre niveau de confiance ?</h2>
              <p className="mt-1 text-sm text-slate-600">Choisissez de 1 à 4. Il n’y a volontairement pas de valeur médiane.</p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {([1, 2, 3, 4] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`Confiance ${value} — ${confidenceLabel(value)}`}
                    disabled={saving}
                    onClick={() => void chooseConfidence(value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-3 font-semibold text-slate-900 disabled:opacity-50"
                  >
                    {value}
                  </button>
                ))}
              </div>
            </section>
          )}

          {conflict !== null && (
            <div role="alert" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              Un conflit de révision a été détecté. Les réponses du serveur ont été rechargées et votre choix non enregistré est conservé.
              <button type="button" disabled={saving} onClick={() => void persist(conflict, attempt.revision)} className="ml-2 font-semibold underline">
                Réessayer
              </button>
            </div>
          )}
          {error !== null && conflict === null && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-900">{error}</p>}

          <nav className="mt-8 flex flex-wrap items-center justify-between gap-3" aria-label="Navigation du questionnaire">
            <button type="button" disabled={currentIndex === 0 || saving} onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))} className="rounded-xl border border-slate-300 px-4 py-2 disabled:opacity-40">
              Précédente
            </button>
            {currentIndex < attempt.items.length - 1 ? (
              <button type="button" disabled={currentAnswer?.confidence == null || saving || conflict !== null} onClick={() => setCurrentIndex((value) => Math.min(attempt.items.length - 1, value + 1))} className="rounded-xl bg-slate-950 px-5 py-2.5 font-semibold text-white disabled:opacity-40">
                Question suivante
              </button>
            ) : (
              <button type="button" disabled={!allComplete || saving || conflict !== null} onClick={() => setConfirming(true)} className="rounded-xl bg-amber-600 px-5 py-2.5 font-semibold text-white disabled:opacity-40">
                Terminer le questionnaire
              </button>
            )}
          </nav>

          {allComplete && currentIndex !== attempt.items.length - 1 && (
            <button type="button" disabled={saving || conflict !== null} onClick={() => setConfirming(true)} className="mt-6 w-full rounded-xl bg-amber-600 px-5 py-3 font-semibold text-white disabled:opacity-40">
              Terminer le questionnaire
            </button>
          )}

          {confirming && (
            <section className="mt-6 rounded-2xl border-2 border-amber-500 bg-amber-50 p-5">
              <h2 className="font-semibold text-slate-950">Confirmer une action irréversible</h2>
              <p className="mt-2 text-sm text-slate-700">Après l’envoi, vos réponses seront scellées et ne pourront plus être modifiées.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => setConfirming(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2">Revenir au questionnaire</button>
                <button type="button" disabled={saving} onClick={() => void submit()} className="rounded-xl bg-slate-950 px-4 py-2 font-semibold text-white disabled:opacity-50">Confirmer l’envoi</button>
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
