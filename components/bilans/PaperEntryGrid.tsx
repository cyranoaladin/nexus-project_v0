'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { PaperEntryWorkflowSteps } from './PaperEntryWorkflowSteps';

export type PaperEntryGridOption = Readonly<{ id: string; label: string }>;

export type PaperEntryGridItem = Readonly<{
  id: string;
  position: number;
  prompt: string;
  options: readonly PaperEntryGridOption[];
}>;

export type PaperEntryGridProps = Readonly<{
  studentId: string;
  studentName: string;
  packSlug: string;
  packTitle: string;
  items: readonly PaperEntryGridItem[];
  childSelectionHref?: string;
}>;

/** `undefined` : la case n'a pas encore été traitée par le saisisseur. */
type EnteredConfidence = 1 | 2 | 3 | 4 | 'ABSENTE' | undefined;

const CONFIDENCE_LEVELS = [1, 2, 3, 4] as const;

function newIdempotencyKey(): string {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `saisie-papier-${suffix}`;
}

export function PaperEntryGrid({
  studentId,
  studentName,
  packSlug,
  packTitle,
  items,
  childSelectionHref = '/dashboard/assistante/bilans/saisie-papier',
}: PaperEntryGridProps) {
  const router = useRouter();
  // 'SANS_REPONSE' : l'élève n'a pas répondu — un état que la saisissante
  // choisit délibérément, jamais un oubli silencieux.
  const [options, setOptions] = useState<Record<string, string | 'SANS_REPONSE' | undefined>>({});
  const [confidences, setConfidences] = useState<Record<string, EnteredConfidence>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(newIdempotencyKey);

  const missingOption = useMemo(
    () => items.filter((item) => options[item.id] === undefined),
    [items, options],
  );
  // La certitude est renseignée sur les copies : l'écran la réclame pour chaque
  // item. « Absente de la copie » est un choix explicite du saisisseur, jamais
  // un défaut — une case laissée vide reste une saisie inachevée.
  const untouchedConfidence = useMemo(
    () => items.filter((item) => options[item.id] !== 'SANS_REPONSE' && confidences[item.id] === undefined),
    [items, options, confidences],
  );
  const absentConfidence = useMemo(
    () => items.filter((item) => options[item.id] !== 'SANS_REPONSE' && confidences[item.id] === 'ABSENTE'),
    [items, options, confidences],
  );
  const blankItems = useMemo(
    () => items.filter((item) => options[item.id] === 'SANS_REPONSE'),
    [items, options],
  );
  const complete = missingOption.length === 0 && untouchedConfidence.length === 0;
  const completedItems = items.filter((item) => (
    options[item.id] !== undefined && options[item.id] !== 'SANS_REPONSE' && confidences[item.id] !== undefined
  )).length;

  async function submit() {
    if (!complete || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/bilans/saisie-papier', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
        body: JSON.stringify({
          studentId,
          packSlug,
          answers: items.map((item) => ({
            itemId: item.id,
            optionId: options[item.id] === 'SANS_REPONSE' ? null : options[item.id],
            confidence: options[item.id] === 'SANS_REPONSE' || confidences[item.id] === 'ABSENTE'
              ? null
              : confidences[item.id],
          })),
        }),
      });
      if (!response.ok) throw new Error('PAPER_ENTRY_FAILED');
      router.replace('/dashboard/assistante/bilans');
      router.refresh();
    } catch {
      setError("La saisie n’a pas pu être enregistrée. Rien n’a été perdu : réessayez sans fermer cette page.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-8">
      <PaperEntryWorkflowSteps
        currentStep={complete ? 5 : 4}
        stepHrefs={{
          1: '/dashboard/assistante/bilans/saisie-papier',
          2: childSelectionHref,
          3: `/dashboard/assistante/bilans/saisie-papier?studentId=${encodeURIComponent(studentId)}`,
        }}
      />
      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Copie à saisir</p>
        <h2 className="mt-2 text-xl font-semibold text-white">{studentName}</h2>
        <p className="mt-1 text-sm text-slate-400">{packTitle}</p>
        <p role="status" className="mt-3 text-sm font-semibold text-amber-200">
          {completedItems} {completedItems === 1 ? 'réponse saisie' : 'réponses saisies'}
          {blankItems.length > 0 && <> · {blankItems.length} sans réponse</>}
          {' '}· {items.length - completedItems - blankItems.length} sur {items.length} restant
          {items.length - completedItems - blankItems.length === 1 ? '' : 's'}
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
          Reportez, pour chaque question, la réponse entourée sur la copie et la certitude cochée par l’élève.
          Si une case de certitude manque sur la copie, choisissez «&nbsp;Absente de la copie&nbsp;» :
          n’en devinez jamais une.
        </p>
      </div>

      <ol className="mt-6 space-y-4">
        {items.map((item) => {
          const chosen = options[item.id];
          const confidence = confidences[item.id];
          return (
            <li key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-mono text-xs text-slate-500">Q{item.position}</span>
                <p className="flex-1 text-sm leading-6 text-slate-100">{item.prompt}</p>
              </div>

              <fieldset className="mt-4">
                <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Réponse lue sur la copie
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.options.map((option) => (
                    <label
                      key={option.id}
                      className={`cursor-pointer rounded-xl border px-3 py-2 text-sm ${
                        chosen === option.id
                          ? 'border-amber-300 bg-amber-300/15 text-amber-100'
                          : 'border-white/15 text-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name={`option-${item.id}`}
                        value={option.id}
                        checked={chosen === option.id}
                        onChange={() => setOptions((current) => ({ ...current, [item.id]: option.id }))}
                      />
                      <span className="font-semibold">{option.id}</span>
                      <span className="ml-2 text-slate-300">{option.label}</span>
                    </label>
                  ))}
                  <label
                    className={`cursor-pointer rounded-xl border px-3 py-2 text-sm ${
                      chosen === 'SANS_REPONSE'
                        ? 'border-slate-300 bg-white/10 text-white'
                        : 'border-dashed border-white/20 text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      name={`option-${item.id}`}
                      value="SANS_REPONSE"
                      checked={chosen === 'SANS_REPONSE'}
                      onChange={() => {
                        setOptions((current) => ({ ...current, [item.id]: 'SANS_REPONSE' }));
                        setConfidences((current) => ({ ...current, [item.id]: undefined }));
                      }}
                    />
                    Sans réponse
                  </label>
                </div>
              </fieldset>

              <fieldset className="mt-4" disabled={chosen === 'SANS_REPONSE'}>
                <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Certitude cochée par l’élève
                  {chosen === 'SANS_REPONSE' && <span className="ml-2 normal-case tracking-normal text-slate-500">— sans objet pour une question sans réponse</span>}
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CONFIDENCE_LEVELS.map((level) => (
                    <label
                      key={level}
                      className={`cursor-pointer rounded-xl border px-3 py-2 text-sm ${
                        confidence === level
                          ? 'border-emerald-300 bg-emerald-300/15 text-emerald-100'
                          : 'border-white/15 text-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name={`confidence-${item.id}`}
                        value={level}
                        checked={confidence === level}
                        onChange={() => setConfidences((current) => ({ ...current, [item.id]: level }))}
                      />
                      {level}
                    </label>
                  ))}
                  <label
                    className={`cursor-pointer rounded-xl border px-3 py-2 text-sm ${
                      confidence === 'ABSENTE'
                        ? 'border-slate-300 bg-white/10 text-white'
                        : 'border-dashed border-white/20 text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      name={`confidence-${item.id}`}
                      value="ABSENTE"
                      checked={confidence === 'ABSENTE'}
                      onChange={() => setConfidences((current) => ({ ...current, [item.id]: 'ABSENTE' }))}
                    />
                    Absente de la copie
                  </label>
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>

      <div className="sticky bottom-4 mt-6 rounded-2xl border border-white/10 bg-slate-900/95 p-5 backdrop-blur">
        {!complete && (
          <p className="text-sm text-amber-200">
            {missingOption.length > 0 && (
              <>Réponse manquante&nbsp;: {missingOption.map(({ position }) => `Q${position}`).join(', ')}. </>
            )}
            {untouchedConfidence.length > 0 && (
              <>Certitude non traitée&nbsp;: {untouchedConfidence.map(({ position }) => `Q${position}`).join(', ')}.</>
            )}
          </p>
        )}
        {complete && blankItems.length > 0 && (
          <p className="text-sm text-slate-300">
            {blankItems.length === 1 ? 'Question laissée sans réponse' : 'Questions laissées sans réponse'}&nbsp;:{' '}
            {blankItems.map(({ position }) => `Q${position}`).join(', ')}. Une question vide nous renseigne
            aussi&nbsp;: elle sera signalée «&nbsp;à situer au démarrage&nbsp;», jamais comptée comme une erreur d’assurance.
          </p>
        )}
        {complete && absentConfidence.length > 0 && (
          <p className="text-sm text-slate-300">
            {absentConfidence.length} certitude(s) déclarée(s) absente(s) de la copie&nbsp;:{' '}
            {absentConfidence.map(({ position }) => `Q${position}`).join(', ')}. Elles seront enregistrées comme non
            renseignées, sans valeur de remplacement.
          </p>
        )}
        <button
          type="button"
          disabled={!complete || submitting}
          onClick={() => void submit()}
          className="mt-3 w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? 'Validation…' : 'Valider la saisie papier'}
        </button>
        <p className="mt-3 text-xs text-slate-400">
          La saisie est enregistrée comme telle&nbsp;: provenance «&nbsp;saisie papier&nbsp;», avec votre identifiant et
          la date. Le bilan passera ensuite par la validation assistante avant toute diffusion.
        </p>
        {error !== null && (
          <p role="alert" className="mt-3 rounded-xl bg-red-500/15 p-3 text-sm text-red-100">{error}</p>
        )}
      </div>
    </section>
  );
}
