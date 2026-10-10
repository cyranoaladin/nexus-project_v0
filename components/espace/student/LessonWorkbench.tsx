'use client';

import { CheckCircle2, CircleAlert, Lightbulb, Loader2, Play, Printer, ShieldCheck, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { RichText, richHtml } from '@/components/espace/shared/RichText';
import { SaveIndicator } from '@/components/espace/shared/SaveIndicator';
import { useWorkSync } from '@/components/espace/shared/useWorkSync';
import type { AnnotationDto } from '@/lib/espace/annotations';
import { evaluateAnswer, type AnswerVerdict } from '@/lib/espace/answer-check';
import type { FigureSpec, LessonContent, LessonField, LessonQuestion } from '@/lib/espace/lesson-types';
import { PythonRunner, type PythonRunResult, type RunnerPhase } from '@/lib/espace/client/python-runner';
import type { Step } from '@/lib/espace/client/sync-engine';
import type { WorkStatus } from '@/lib/espace/work-state';

import { AlertDialog } from './AlertDialog';
import { FigureView } from './figures/FigureView';
import {
  annotationTarget,
  bannerFor,
  clampStep,
  currentCode,
  groupAnnotations,
  insertIndent,
  parseLesson,
  unplaced,
  isEditable,
  missingSteps,
  stepLabel,
  submitBlockedMessage,
  submitWarning,
} from './poo-logic';

export interface LessonWorkbenchProps {
  userId: string;
  work: {
    id: string;
    status: WorkStatus;
    revision: number;
    currentStep: number;
    lastSavedAt: string;
    steps: Record<string, Step>;
  };
  content: LessonContent;
  /** Harnais Python de la leçon, ou `null` (leçon sans éditeur de code). */
  runnerSource: string | null;
  annotations: AnnotationDto[];
}

const FIELD =
  'block w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-neutral-50 placeholder:text-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent disabled:opacity-70';

export function LessonWorkbench({ userId, work, content, runnerSource, annotations }: LessonWorkbenchProps) {
  const defs = content.steps;
  const [status, setStatus] = useState<WorkStatus>(work.status);
  const sync = useWorkSync({
    workId: work.id,
    userId,
    initial: { revision: work.revision, steps: work.steps, lastSavedAt: work.lastSavedAt, locked: !isEditable(work.status, 'saved') },
  });
  const editable = isEditable(status, sync.state);
  const banner = bannerFor(status, editable);

  const [index, setIndex] = useState(() => clampStep(work.currentStep, defs.length));
  const step = defs[index]!;
  const stepContent: Step = sync.steps[step.id] ?? {};
  const fields = (stepContent.fields ?? {}) as Record<string, string>;
  const choices = (stepContent.choices ?? {}) as Record<string, number>;
  const code = currentCode(step, stepContent as { code?: string });

  // Dernière vue des étapes, pour que les callbacks asynchrones (résultat d'exécution) n'écrasent rien.
  const stepsRef = useRef(sync.steps);
  stepsRef.current = sync.steps;

  const [localHints, setLocalHints] = useState<Record<string, number>>({});
  const [verdicts, setVerdicts] = useState<Record<string, AnswerVerdict>>({});
  const [results, setResults] = useState<Record<string, PythonRunResult>>({});
  const [phase, setPhase] = useState<RunnerPhase>('idle');
  const runnerRef = useRef<PythonRunner | null>(null);
  const escapeTab = useRef(false);

  const [confirming, setConfirming] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!runnerSource) return undefined;
    const runner = new PythonRunner({ runnerSource, onPhase: setPhase });
    runnerRef.current = runner;
    return () => {
      runner.terminate();
      runnerRef.current = null;
    };
  }, [runnerSource]);

  const update = useCallback(
    (patch: Partial<Step>, meta?: { snapshot?: 'STEP_CHANGE' | 'RUN' }) => {
      if (!editable) return;
      const base = stepsRef.current[step.id] ?? {};
      sync.edit(step.id, { ...base, ...patch }, { currentStep: index, ...meta });
    },
    // `sync.edit` est stable ; on ne dépend pas de l'objet `sync` entier.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editable, step.id, index, sync.edit],
  );

  function goTo(next: number) {
    const target = clampStep(next, defs.length);
    if (target === index) return;
    if (editable) {
      // Persiste l'étape courante et un instantané « changement d'étape ».
      sync.edit(step.id, stepsRef.current[step.id] ?? {}, { currentStep: target, snapshot: 'STEP_CHANGE' });
    }
    setIndex(target);
  }

  async function execute(mode: 'run' | 'test') {
    const runner = runnerRef.current;
    if (!runner || phase !== 'idle') return;
    const stepId = step.id;
    const result = await runner.run(code, stepId, mode);
    setResults((r) => ({ ...r, [stepId]: result }));
    if (!editable) return;
    const base = stepsRef.current[stepId] ?? {};
    const tests =
      mode === 'test' && result.tests.length > 0
        ? { ranAt: new Date().toISOString(), passed: result.tests.filter((t) => t.pass).length, total: result.tests.length }
        : base.tests;
    sync.edit(stepId, { ...base, ...(tests ? { tests } : {}) }, { currentStep: index, snapshot: 'RUN' });
  }

  function onCodeKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape') {
      escapeTab.current = true; // le Tab suivant quitte l'éditeur
      return;
    }
    if (event.key !== 'Tab' || event.shiftKey) {
      escapeTab.current = false;
      return;
    }
    if (escapeTab.current) {
      escapeTab.current = false;
      return;
    }
    event.preventDefault();
    const el = event.currentTarget;
    const next = insertIndent(el.value, el.selectionStart, el.selectionEnd);
    update({ code: next.value });
    requestAnimationFrame(() => el.setSelectionRange(next.cursor, next.cursor));
  }

  async function confirmSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    const res = await sync.submit();
    setSubmitting(false);
    if (res.kind === 'ok') {
      setStatus('SUBMITTED');
      setConfirming(false);
    } else if (res.kind === 'blocked') {
      setSubmitError(submitBlockedMessage(res.reason));
    } else {
      setSubmitError(res.message ?? 'La remise a échoué. Réessaie dans un instant.');
    }
  }

  const groups = useMemo(() => groupAnnotations(annotations), [annotations]);
  const stepNotes = groups.byStep[step.id] ?? [];
  const result = results[step.id];
  const shownHints = Math.max(localHints[step.id] ?? 0, (stepContent.hints as number | undefined) ?? 0);
  const missing = missingSteps(defs, sync.steps);
  const hasNotes = annotations.length > 0;

  const phases = content.ui?.phases === true;
  const segments = useMemo(
    () => parseLesson(step.lesson).map((seg) => (seg.kind === 'html' ? { ...seg, html: richHtml(seg.html) } : seg)),
    [step.lesson],
  );
  const rest = unplaced(step, segments);
  const triesNow = (stepContent.tries ?? {}) as Record<string, number>;
  const solvedNow = (stepContent.solved ?? {}) as Record<string, boolean>;

  function verify(f: LessonField) {
    if (!f.check) return;
    const verdict = evaluateAnswer(f.check, fields[f.id] ?? '');
    setVerdicts((v) => ({ ...v, [`${step.id}:${f.id}`]: verdict }));
    if (verdict.empty || !editable) return;
    const base = stepsRef.current[step.id] ?? {};
    const prevTries = (base.tries ?? {}) as Record<string, number>;
    const prevSolved = (base.solved ?? {}) as Record<string, boolean>;
    sync.edit(
      step.id,
      { ...base, tries: { ...prevTries, [f.id]: (prevTries[f.id] ?? 0) + 1 }, solved: { ...prevSolved, [f.id]: verdict.ok || prevSolved[f.id] === true } },
      { currentStep: index },
    );
  }

  function openHint() {
    const next = shownHints + 1;
    setLocalHints((h) => ({ ...h, [step.id]: next }));
    if (editable) update({ hints: next });
  }

  const Phase = ({ children }: { children: string }) =>
    phases ? (
      <p data-testid="phase" className="text-xs font-semibold uppercase tracking-wide text-brand-accent">
        {children}
      </p>
    ) : null;

  const renderQuestion = (q: LessonQuestion) => {
    const picked = choices[q.id];
    const targeted = typeof picked === 'number' && picked !== q.correct ? q.choiceFeedback?.[picked] : undefined;
    return (
      <fieldset key={`q-${q.id}`} className="space-y-2" disabled={!editable}>
        <legend className="font-medium text-neutral-50">
          <RichText text={q.text} />
        </legend>
        {q.choices.map((c, ci) => (
          <label key={ci} className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-white/5">
            <input
              type="radio"
              name={`q-${step.id}-${q.id}`}
              checked={picked === ci}
              onChange={() => update({ choices: { ...choices, [q.id]: ci } })}
              className="mt-1 h-4 w-4 accent-brand-accent"
            />
            <span className="text-neutral-100">
              <RichText text={c} />
            </span>
          </label>
        ))}
        {typeof picked === 'number' && (
          <p role="status" className="flex items-start gap-2 text-sm text-neutral-100" data-testid="qcm-feedback">
            {picked === q.correct ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
            ) : (
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
            )}
            <span>
              <strong>{picked === q.correct ? 'Bonne réponse. ' : 'Pas tout à fait. '}</strong>
              <RichText text={targeted ? `${targeted} ${q.feedback}` : q.feedback} />
            </span>
          </p>
        )}
      </fieldset>
    );
  };

  const renderField = (f: LessonField) => {
    const key = `${step.id}:${f.id}`;
    const verdict = verdicts[key];
    const value = fields[f.id] ?? '';
    const id = `f-${step.id}-${f.id}`;
    const onChange = (v: string) => {
      update({ fields: { ...fields, [f.id]: v } });
      if (verdict) setVerdicts((all) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== key)));
    };
    return (
      <div key={`f-${f.id}`}>
        <label htmlFor={id} className="font-medium text-neutral-50">
          <RichText text={f.label} />
        </label>
        {f.input === 'line' ? (
          <input
            id={id}
            type="text"
            value={value}
            readOnly={!editable}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && f.check) {
                e.preventDefault();
                verify(f);
              }
            }}
            placeholder={f.placeholder}
            className={`${FIELD} mt-2 h-11`}
          />
        ) : (
          <textarea id={id} value={value} readOnly={!editable} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} rows={4} className={`${FIELD} mt-2`} />
        )}
        {f.check && (
          <div className="mt-2 space-y-2">
            <button
              type="button"
              onClick={() => verify(f)}
              disabled={!editable}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/20 px-4 text-sm text-neutral-100 hover:bg-white/5 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {phases ? 'Je vérifie' : 'Vérifier ma réponse'}
            </button>
            <div role="status" aria-live="polite" data-testid="check-feedback">
              {verdict ? (
                <p className="flex items-start gap-2 text-sm text-neutral-100">
                  {verdict.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                  ) : (
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
                  )}
                  <span>
                    <strong>{verdict.ok ? 'Correct. ' : verdict.empty ? '' : 'Pas encore. '}</strong>
                    <RichText text={verdict.feedback} />
                  </span>
                </p>
              ) : solvedNow[f.id] ? (
                <p className="text-sm text-neutral-300">Réponse déjà validée ({triesNow[f.id] ?? 1} essai{(triesNow[f.id] ?? 1) > 1 ? 's' : ''}).</p>
              ) : null}
            </div>
            {verdict && !verdict.ok && !verdict.empty && verdict.solution && (
              <details data-testid="check-solution" className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-neutral-100">
                <summary className="cursor-pointer font-medium text-brand-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">
                  Voir la correction détaillée
                </summary>
                <div className="mt-2">
                  <RichText text={verdict.solution} />
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCode = () => (
    <div>
              <label htmlFor="editeur-code" className="font-medium text-neutral-50">
                Ton code Python
              </label>
              <textarea
                id="editeur-code"
                data-testid="code-editor"
                value={code}
                readOnly={!editable}
                onChange={(e) => update({ code: e.target.value })}
                onKeyDown={onCodeKeyDown}
                onBlur={() => (escapeTab.current = false)}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                rows={Math.min(18, Math.max(8, code.split('\n').length + 2))}
                aria-describedby="editeur-aide"
                className={`${FIELD} mt-2 max-h-[22rem] overflow-y-auto font-mono text-sm leading-relaxed`}
              />
              <p id="editeur-aide" className="mt-1 text-xs text-neutral-400">
                Tab insère des espaces. Pour quitter l’éditeur au clavier : Échap, puis Tab.
              </p>
              <div className={`mt-3 flex flex-wrap gap-3 ${runnerSource ? '' : 'hidden'}`}>
                <button
                  type="button"
                  onClick={() => execute('run')}
                  disabled={phase !== 'idle'}
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/20 px-4 text-neutral-100 hover:bg-white/5 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent"
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Exécuter
                </button>
                <button
                  type="button"
                  onClick={() => execute('test')}
                  disabled={phase !== 'idle'}
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/20 px-4 text-neutral-100 hover:bg-white/5 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Vérifier mon code
                </button>
              </div>
              <div role="status" aria-live="polite" className="mt-3 space-y-2" data-testid="run-results">
                {phase === 'loading' && (
                  <p className="flex items-center gap-2 text-neutral-200">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Chargement du moteur Python…
                  </p>
                )}
                {phase === 'running' && (
                  <p className="flex items-center gap-2 text-neutral-200">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Exécution en cours…
                  </p>
                )}
                {result && phase === 'idle' && (
                  <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                    {result.error && (
                      <p className="flex items-start gap-2 text-amber-200">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>Erreur : {result.error}</span>
                      </p>
                    )}
                    {result.output && (
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-sm text-neutral-100" aria-label="Affichage du programme">
                        {result.output}
                      </pre>
                    )}
                    {result.tests.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {result.tests.map((t) => (
                          <li key={t.label} className="flex items-start gap-2 text-sm text-neutral-100">
                            {t.pass ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />}
                            <span>
                              <strong>{t.pass ? 'Réussi' : 'À revoir'} — </strong>
                              {t.label}
                              {!t.pass && t.message ? ` : ${t.message}` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {!result.error && result.tests.length === 0 && !result.output && <p className="text-neutral-200">Programme exécuté, rien à afficher.</p>}
                  </div>
                )}
              </div>
            </div>
  );

  const renderFigure = (fig: FigureSpec) => (
    <FigureView key={`fig-${fig.id}`} spec={fig} overlay={fig.type === 'function' && fig.overlayFieldId ? (fields[fig.overlayFieldId] ?? null) : null} />
  );

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <p className="text-sm text-neutral-300">{content.session}</p>
        <h1 className="text-2xl font-semibold text-neutral-50">{content.title}</h1>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SaveIndicator state={sync.state} lastSavedAt={sync.lastSavedAt} />
          <p className="text-sm text-neutral-300">
            Étape {index + 1} sur {defs.length}
          </p>
        </div>
      </header>

      {banner && (
        <p
          role="status"
          data-testid="work-banner"
          className={`rounded-lg border p-3 text-sm ${banner.tone === 'warn' ? 'border-orange-400/50 bg-orange-400/10 text-orange-100' : 'border-white/15 bg-white/5 text-neutral-100'}`}
        >
          {banner.text}
        </p>
      )}

      {hasNotes && groups.general.length > 0 && (
        <section aria-labelledby="retour-general" className="rounded-xl border border-brand-accent/40 bg-surface-card p-4">
          <h2 id="retour-general" className="font-medium text-neutral-50">
            Retour de ton enseignant
          </h2>
          <ul className="mt-2 space-y-2">
            {groups.general.map((a) => (
              <li key={a.id} className="whitespace-pre-wrap text-neutral-100" data-testid="annotation">
                {a.body}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-5 md:grid-cols-[14rem_1fr]">
        <div>
          <div className="md:hidden">
            <label htmlFor="etape-select" className="text-sm font-medium text-neutral-200">
              Étape
            </label>
            <select
              id="etape-select"
              value={index}
              onChange={(e) => goTo(Number(e.target.value))}
              className={`${FIELD} mt-1 h-11`}
            >
              {defs.map((s, i) => (
                <option key={s.id} value={i}>
                  {i + 1}. {stepLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <nav aria-label="Étapes du TP" className="hidden md:block">
            <ol className="space-y-1">
              {defs.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={i === index ? 'step' : undefined}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent ${
                      i === index ? 'bg-white/10 font-medium text-neutral-50' : 'text-neutral-300 hover:bg-white/5'
                    }`}
                  >
                    {i + 1}. {stepLabel(s)}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </div>

        <article className="min-w-0 space-y-6" aria-labelledby="etape-titre">
          <div>
            <p className="text-sm text-neutral-300">
              {step.level} · {step.minutes > 0 ? `${step.minutes} min` : `hors des ${content.duration} min`}
            </p>
            <h2 id="etape-titre" className="text-xl font-semibold text-neutral-50">
              {step.title}
            </h2>
            <p className="mt-2 text-neutral-200">
              <RichText text={step.intro} />
            </p>
          </div>

          <div id={step.printable ? 'print-sheet' : undefined} className="space-y-6">
            <Phase>Je comprends</Phase>
            {/* Contenu pédagogique du dépôt (fiable) : seul endroit où du HTML est injecté. */}
            {segments.map((seg, i) => {
              switch (seg.kind) {
                case 'html':
                  return (
                    <div
                      key={i}
                      className="space-y-3 text-neutral-100 [&_.method-box]:rounded-lg [&_.method-box]:border [&_.method-box]:border-brand-accent/40 [&_.method-box]:bg-brand-accent/10 [&_.method-box]:p-4 [&_ol]:mt-2 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:leading-relaxed [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-black/40 [&_pre]:p-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-white/15 [&_td]:p-2 [&_th]:border [&_th]:border-white/15 [&_th]:p-2 [&_ul]:list-disc"
                      dangerouslySetInnerHTML={{ __html: seg.html }}
                    />
                  );
                case 'q': {
                  const q = step.questions.find((x) => x.id === seg.id);
                  return q ? renderQuestion(q) : null;
                }
                case 'f': {
                  const f = step.fields.find((x) => x.id === seg.id);
                  return f ? renderField(f) : null;
                }
                case 'fig': {
                  const fig = step.figures?.find((x) => x.id === seg.id);
                  return fig ? renderFigure(fig) : null;
                }
                case 'code':
                  return step.starter !== null ? renderCode() : null;
              }
            })}
            {step.printable && (
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/20 px-4 text-neutral-100 hover:bg-white/5 print:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                Imprimer la fiche
              </button>
            )}
          </div>

          {rest.figures.length > 0 && (
            <div className="space-y-3">
              <Phase>J’observe</Phase>
              {rest.figures.map(renderFigure)}
            </div>
          )}

          <div className="space-y-6">
            <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-neutral-100">
              {phases && <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-brand-accent">J’essaie</span>}
              <span className="font-medium">À faire : </span>
              <RichText text={step.task} />
            </p>
            {rest.questions.map(renderQuestion)}
            {rest.code && renderCode()}
            {rest.fields.map(renderField)}
          </div>

          {step.hints.length > 0 && (
            <div>
              {step.hints.slice(0, shownHints).map((h, i) => (
                <p key={i} className="mb-2 flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-neutral-100">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
                  <span>
                    <strong>Indice {i + 1} sur {step.hints.length} — </strong>
                    <RichText text={h} />
                  </span>
                </p>
              ))}
              {shownHints < step.hints.length && (
                <button
                  type="button"
                  onClick={openHint}
                  className="text-sm text-brand-accent underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent"
                >
                  {shownHints === 0 ? 'Un indice ?' : 'Un indice de plus ?'}
                </button>
              )}
            </div>
          )}

          {step.takeaway && (
            <div>
              <Phase>Je retiens</Phase>
              <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-neutral-100">
                <span className="font-medium">À retenir : </span>
                <RichText text={step.takeaway} />
              </p>
            </div>
          )}

          {stepNotes.length > 0 && (
            <section aria-labelledby="retour-etape" className="rounded-xl border border-brand-accent/40 bg-surface-card p-4">
              <h3 id="retour-etape" className="font-medium text-neutral-50">
                Retour de ton enseignant sur cette étape
              </h3>
              <ul className="mt-2 space-y-3">
                {stepNotes.map((a) => (
                  <li key={a.id} data-testid="annotation">
                    <p className="text-xs text-neutral-300">{annotationTarget(a, step)}</p>
                    <p className="whitespace-pre-wrap text-neutral-100">{a.body}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => goTo(index - 1)}
                disabled={index === 0}
                className="h-11 rounded-lg border border-white/20 px-4 text-neutral-100 hover:bg-white/5 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent"
              >
                Étape précédente
              </button>
              <button
                type="button"
                onClick={() => goTo(index + 1)}
                disabled={index === defs.length - 1}
                className="h-11 rounded-lg border border-white/20 px-4 text-neutral-100 hover:bg-white/5 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent"
              >
                Étape suivante
              </button>
            </div>
            {editable && (
              <button
                type="button"
                data-testid="btn-remettre"
                onClick={() => {
                  setSubmitError(null);
                  setConfirming(true);
                }}
                className="h-11 rounded-lg bg-brand-accent px-5 font-medium text-neutral-950 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Remettre mon travail
              </button>
            )}
          </div>
        </article>
      </div>

      {confirming && (
        <AlertDialog
          title="Remettre ton travail ?"
          onEscape={() => !submitting && setConfirming(false)}
          actions={[
            { label: 'Annuler', onClick: () => setConfirming(false), autoFocus: true, disabled: submitting },
            { label: submitting ? 'Remise en cours…' : 'Remettre', onClick: confirmSubmit, variant: 'primary', disabled: submitting },
          ]}
        >
          <p>{submitWarning(missing)}</p>
          {submitError && (
            <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">
              {submitError}
            </p>
          )}
        </AlertDialog>
      )}

      {sync.conflict && (
        <AlertDialog
          title="Ce travail a été modifié ailleurs"
          actions={[
            { label: 'Garder ma version', onClick: () => void sync.resolveConflict('keep-mine'), variant: 'primary' },
            { label: 'Prendre l’autre version', onClick: () => void sync.resolveConflict('take-theirs'), autoFocus: true },
          ]}
        >
          <p>
            Tu as ouvert ce travail dans un autre onglet ou sur un autre appareil. Pour l’étape « {defs.find((d) => d.id === sync.conflict?.stepId)?.title ?? sync.conflict.stepId} », choisis la version à conserver. L’autre
            sera remplacée pour cette étape seulement.
          </p>
          <details className="rounded-lg border border-white/10 p-3 text-sm">
            <summary className="cursor-pointer">Voir les deux versions</summary>
            <p className="mt-2 font-medium">Ma version</p>
            <pre className="overflow-x-auto whitespace-pre-wrap">{summarize(sync.conflict.mine)}</pre>
            <p className="mt-2 font-medium">L’autre version</p>
            <pre className="overflow-x-auto whitespace-pre-wrap">{summarize(sync.conflict.theirs)}</pre>
          </details>
        </AlertDialog>
      )}
    </div>
  );
}

function summarize(step: Step): string {
  const code = typeof step.code === 'string' ? step.code : '';
  const fields = Object.values((step.fields ?? {}) as Record<string, string>).filter(Boolean);
  return [code, ...fields].join('\n---\n').slice(0, 1500) || '(vide)';
}
