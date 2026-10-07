import { CheckCircle2, Circle, XCircle } from 'lucide-react';

import { RichText } from '@/components/espace/shared/RichText';
import { formatBilanAnswer, type BilanAnswerFormat } from '@/lib/espace/bilan-display';

export interface ViewerStepDef {
  id: string;
  title: string;
  short: string;
  starter: string | null;
  questions: { id: string; text: string; choices: string[]; correct: number }[];
  fields: { id: string; label: string; format?: BilanAnswerFormat; scopeModule?: string; requiredSkills?: string[] }[];
}

export interface ViewerStepContent {
  code?: string;
  fields?: Record<string, string>;
  choices?: Record<string, number>;
  tests?: { passed: number; total: number; ranAt?: string };
  tries?: Record<string, number>;
  solved?: Record<string, boolean>;
  hints?: number;
}

export interface ViewerAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

interface Props {
  workId: string;
  steps: ViewerStepDef[];
  content: { steps: Record<string, ViewerStepContent> };
  attachments: ViewerAttachment[];
  /** Facultatifs : sans eux la vue est strictement passive (pas de boutons d'annotation). */
  onPickStep?: (stepId: string) => void;
  onPickQuestion?: (stepId: string, questionId: string) => void;
  onPickLine?: (stepId: string, line: number) => void;
}

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} Ko` : `${(n / 1024 / 1024).toFixed(1)} Mo`);

/**
 * Travail d'un élève en LECTURE SEULE. Tout texte d'élève (code, réponses) est
 * rendu comme du texte échappé par React ; jamais de dangerouslySetInnerHTML,
 * jamais exécuté. L'enseignant ne modifie jamais ce contenu.
 */
export function WorkViewer({ workId, steps, content, attachments, onPickStep, onPickQuestion, onPickLine }: Props) {
  return (
    <div className="space-y-6" data-testid="work-viewer">
      {attachments.length > 0 && (
        <section aria-labelledby="pieces-jointes" className="rounded-lg border border-white/10 p-4">
          <h2 id="pieces-jointes" className="text-sm font-semibold text-neutral-100">
            Fichiers déposés par l’élève
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {attachments.map((a) => (
              <li key={a.id}>
                <a
                  className="text-brand-accent underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                  href={`/api/espace/works/${workId}/attachments/${a.id}`}
                >
                  {a.originalName}
                </a>{' '}
                <span className="text-neutral-400">
                  ({a.mimeType.replace('application/', '').replace('image/', '').toUpperCase()}, {kb(a.sizeBytes)})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {steps.map((def) => {
        const step = content.steps[def.id];
        const visibleFields = def.fields.filter(f => !f.scopeModule || (
          content.steps.scope?.fields?.[f.scopeModule] === 'yes' &&
          (f.requiredSkills ?? []).every(id => content.steps.mastery?.fields?.[id] !== 'notworked')
        ));
        const hasQuestions = def.questions.length > 0;
        const hasFields = visibleFields.length > 0;
        const empty = !step || (!step.code?.trim() && !Object.keys(step.fields ?? {}).length && !Object.keys(step.choices ?? {}).length);
        return (
          <section key={def.id} aria-labelledby={`step-${def.id}`} className="rounded-lg border border-white/10 bg-surface-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id={`step-${def.id}`} className="text-base font-semibold text-neutral-50">
                {def.short} — {def.title}
              </h2>
              {onPickStep && (
                <button type="button" onClick={() => onPickStep(def.id)} className="rounded-md border border-white/15 px-2 py-1 text-xs text-neutral-200 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">
                  Commenter cette étape
                </button>
              )}
            </div>

            {empty && <p className="mt-2 text-sm text-neutral-400">Étape non renseignée.</p>}
            {!hasFields && def.fields.some(f => f.scopeModule) && <p className="mt-2 text-sm text-neutral-400">Aucun contenu retenu dans le périmètre de cette version. Aucun échec n’est déduit.</p>}
            {(step?.hints ?? 0) > 0 && (
              <p className="mt-2 text-xs text-neutral-400" data-testid={`hints-${def.id}`}>
                Aides ouvertes : {step?.hints} (information, jamais une pénalité)
              </p>
            )}

            {step?.code?.trim() && (
              <div className="mt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Code de l’élève</p>
                <pre className="mt-1 overflow-x-auto rounded-md bg-black/40 p-3 text-sm leading-6 text-neutral-100">
                  <code data-testid={`code-${def.id}`}>
                    {step.code.split('\n').map((line, i) => (
                      <span key={i} className="block">
                        {onPickLine ? (
                          <button
                            type="button"
                            onClick={() => onPickLine(def.id, i + 1)}
                            aria-label={`Annoter la ligne ${i + 1}`}
                            className="mr-3 inline-block w-8 select-none text-right text-neutral-500 hover:text-brand-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent"
                          >
                            {i + 1}
                          </button>
                        ) : (
                          <span aria-hidden="true" className="mr-3 inline-block w-8 select-none text-right text-neutral-500">
                            {i + 1}
                          </span>
                        )}
                        {line}
                      </span>
                    ))}
                  </code>
                </pre>
              </div>
            )}

            {step?.tests && (
              <p className="mt-2 text-sm text-neutral-300" data-testid={`tests-${def.id}`}>
                Tests formatifs : {step.tests.passed}/{step.tests.total} réussis (indicatif — la correction reste la vôtre).
              </p>
            )}

            {hasQuestions && (
              <ul className="mt-3 space-y-3">
                {def.questions.map((q) => {
                  const picked = step?.choices?.[q.id];
                  return (
                    <li key={q.id} className="rounded-md border border-white/10 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-medium text-neutral-100"><RichText text={q.text} /></p>
                        {onPickQuestion && (
                          <button type="button" onClick={() => onPickQuestion(def.id, q.id)} className="rounded-md border border-white/15 px-2 py-1 text-xs text-neutral-200 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">
                            Commenter
                          </button>
                        )}
                      </div>
                      <ul className="mt-2 space-y-1 text-sm">
                        {q.choices.map((choice, idx) => {
                          const isPicked = picked === idx;
                          const isCorrect = q.correct === idx;
                          return (
                            <li key={idx} className="flex items-start gap-2" data-testid={`choice-${def.id}-${q.id}-${idx}`}>
                              {isPicked ? (isCorrect ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" aria-hidden="true" />) : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-neutral-600" aria-hidden="true" />}
                              <span className={isPicked ? 'text-neutral-50' : 'text-neutral-400'}>
                                <RichText text={choice} />
                                {isPicked && <strong className="ml-2 text-xs">· Choix de l’élève{isCorrect ? ' (bonne réponse)' : ' (réponse attendue différente)'}</strong>}
                                {!isPicked && isCorrect && <em className="ml-2 text-xs not-italic text-emerald-300">· Bonne réponse</em>}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      {picked === undefined && <p className="mt-2 text-xs text-neutral-400">Pas de réponse.</p>}
                    </li>
                  );
                })}
              </ul>
            )}

            {hasFields && (
              <dl className="mt-3 space-y-3">
                {visibleFields.map((f) => (
                  <div key={f.id} className="rounded-md border border-white/10 p-3">
                    <dt className="text-sm font-medium text-neutral-100"><RichText text={f.label} /></dt>
                    <dd className="mt-1 text-sm text-neutral-200">
                      <div className="whitespace-pre-wrap break-words" data-testid={`field-${def.id}-${f.id}`}>
                        {step?.fields?.[f.id]?.trim() ? formatBilanAnswer(f.format, step.fields[f.id]) : <span className="text-neutral-400">Pas de réponse.</span>}
                      </div>
                      {step?.tries?.[f.id] !== undefined && (
                        <p className="mt-1 text-xs text-neutral-400" data-testid={`tries-${def.id}-${f.id}`}>
                          {step.tries[f.id]} essai{step.tries[f.id]! > 1 ? 's' : ''} · {step.solved?.[f.id] ? 'réponse validée par la vérification' : 'pas encore validée'}
                        </p>
                      )}
                      {onPickQuestion && (
                        <button type="button" onClick={() => onPickQuestion(def.id, f.id)} className="mt-2 rounded-md border border-white/15 px-2 py-1 text-xs text-neutral-200 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">
                          Commenter
                        </button>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        );
      })}
    </div>
  );
}
