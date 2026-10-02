'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Download, History, Trash2 } from 'lucide-react';

import { StatusBadge } from '@/components/espace/shared/StatusBadge';
import { useEspaceTimezone } from '@/components/espace/shared/EspaceProvider';
import { espaceApi } from '@/lib/espace/client/api';
import { formatDateTime } from '@/lib/espace/format';
import type { WorkStatus } from '@/lib/espace/work-state';

import {
  EMPTY_DRAFT,
  MAX_BODY,
  buildAnnotationPayload,
  canApplyReview,
  describeTarget,
  type AnnotationDraft,
  type AnnotationKind,
  type ReviewAction,
} from './annotation-draft';
import { describeError } from './describe-error';
import { nextInQueue, orderQueue } from './correction-queue';
import { WorkViewer, type ViewerAttachment, type ViewerStepContent, type ViewerStepDef } from './WorkViewer';

export interface AnnotationView {
  id: string;
  kind: string;
  body: string;
  stepId: string | null;
  questionId: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  workRevision: number | null;
  authorName: string;
  mine: boolean;
  createdAt: string;
}

export interface QueueItem {
  studentId: string;
  workId: string | null;
  name: string;
  status: string;
  progress: string;
}

interface Props {
  work: { id: string; status: WorkStatus; revision: number; activityTitle: string; content: { steps: Record<string, ViewerStepContent> } };
  studentName: string;
  steps: ViewerStepDef[];
  attachments: ViewerAttachment[];
  annotations: AnnotationView[];
  queue: QueueItem[];
  isAdmin: boolean;
}

const REASON_LABEL: Record<string, string> = {
  STEP_CHANGE: 'Changement d’étape',
  RUN: 'Exécution',
  SUBMIT: 'Remise',
  REOPEN: 'Réouverture',
  CORRECTION: 'Correction',
  INTERVAL: 'Sauvegarde périodique',
  LEGACY_IMPORT: 'Import de l’archive',
};

const KIND_LABEL: Record<AnnotationKind, string> = {
  GENERAL: 'Commentaire général',
  STEP: 'Une étape',
  QUESTION: 'Une question',
  CODE: 'Des lignes de code',
};

const inputClass = 'mt-1 block w-full rounded-md border border-white/15 bg-white/5 px-2 py-2 text-sm text-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent';
const btn = 'rounded-md border border-white/15 px-3 py-2 text-sm text-neutral-100 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent';

export function CorrectionWorkspace({ work, studentName, steps, attachments, annotations: initialAnnotations, queue, isAdmin }: Props) {
  const router = useRouter();
  const timezone = useEspaceTimezone();
  const [status, setStatus] = useState<WorkStatus>(work.status);
  const [annotations, setAnnotations] = useState(initialAnnotations);
  const [draft, setDraft] = useState<AnnotationDraft>(EMPTY_DRAFT);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [snippets, setSnippets] = useState<{ id: string; body: string }[]>([]);
  const [versions, setVersions] = useState<{ id: string; revision: number; reason: string; createdAt: string }[]>([]);
  const [viewing, setViewing] = useState<{ label: string; content: { steps: Record<string, ViewerStepContent> } } | null>(null);

  useEffect(() => setStatus(work.status), [work.status]);
  useEffect(() => setAnnotations(initialAnnotations), [initialAnnotations]);

  // Bibliothèque et historique : chargés une fois, sans bloquer la correction.
  useEffect(() => {
    let alive = true;
    espaceApi.snippets().then((r) => alive && setSnippets(r.snippets)).catch(() => undefined);
    espaceApi.versions(work.id).then((r) => alive && setVersions(r.versions)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [work.id]);

  const ordered = useMemo(() => orderQueue(queue.map((q) => ({ ...q }))), [queue]);
  const next = useMemo(() => nextInQueue(ordered, work.id), [ordered, work.id]);
  const stepDef = steps.find((s) => s.id === draft.stepId);
  const targets = stepDef ? [...stepDef.questions.map((q) => ({ id: q.id, label: q.text })), ...stepDef.fields.map((f) => ({ id: f.id, label: f.label }))] : [];

  const set = (patch: Partial<AnnotationDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const note = (kind: 'ok' | 'error', text: string) => setMessage({ kind, text });

  const saveAnnotation = useCallback(async (): Promise<boolean> => {
    const built = buildAnnotationPayload(draft);
    if (!built.ok) {
      note('error', built.error);
      return false;
    }
    try {
      const { annotation } = await espaceApi.addAnnotation(work.id, built.payload);
      setAnnotations((list) => [...list, annotation as AnnotationView]);
      setDraft((d) => ({ ...EMPTY_DRAFT, kind: d.kind, stepId: d.stepId }));
      note('ok', 'Annotation enregistrée.');
      return true;
    } catch (e) {
      note('error', describeError(e));
      return false;
    }
  }, [draft, work.id]);

  async function onSave() {
    setBusy(true);
    await saveAnnotation();
    setBusy(false);
  }

  async function onReview(action: ReviewAction, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      // Un commentaire en cours de saisie est enregistré avant de changer le statut.
      if (draft.body.trim() && !(await saveAnnotation())) return;
      const { work: updated } = await espaceApi.review(work.id, action);
      setStatus(updated.status as WorkStatus);
      note('ok', success);
      router.refresh();
    } catch (e) {
      note('error', describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    setBusy(true);
    try {
      await espaceApi.deleteAnnotation(work.id, id);
      setAnnotations((list) => list.filter((a) => a.id !== id));
      note('ok', 'Annotation supprimée.');
    } catch (e) {
      note('error', describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onPickVersion(id: string) {
    if (!id) return setViewing(null);
    try {
      const { version } = await espaceApi.version(work.id, id);
      setViewing({
        label: `révision ${version.revision} · ${REASON_LABEL[version.reason] ?? version.reason} · ${formatDateTime(version.createdAt, timezone)}`,
        content: { steps: (version.content?.steps ?? {}) as Record<string, ViewerStepContent> },
      });
    } catch (e) {
      note('error', describeError(e));
    }
  }

  async function onSaveSnippet() {
    const body = draft.body.trim();
    if (!body) return note('error', 'Écrivez d’abord le commentaire à conserver.');
    try {
      const { snippet } = await espaceApi.addSnippet(body.slice(0, 500));
      setSnippets((list) => [...list, snippet]);
      note('ok', 'Ajouté à votre bibliothèque de commentaires.');
    } catch (e) {
      note('error', describeError(e));
    }
  }

  const shown = viewing?.content ?? work.content;

  return (
    <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)_22rem]">
      {/* Colonne gauche : file de correction */}
      <nav aria-label="Élèves de cette activité" className="lg:sticky lg:top-4 lg:self-start">
        <h2 className="text-sm font-semibold text-neutral-100">Élèves</h2>
        <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto lg:max-h-[75vh]">
          {ordered.map((q) => (
            <li key={q.workId}>
              <Link
                href={`/espace/enseignant/corriger/${q.workId}`}
                aria-current={q.workId === work.id ? 'page' : undefined}
                className={`block rounded-md border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent ${q.workId === work.id ? 'border-brand-accent bg-white/10 text-neutral-50' : 'border-white/10 text-neutral-200 hover:bg-white/5'}`}
              >
                <span className="block font-medium">{q.name}</span>
                <span className="mt-1 flex items-center justify-between gap-2 text-xs text-neutral-400">
                  <span>{q.progress}</span>
                  <StatusBadge status={q.status as WorkStatus} audience="teacher" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Zone principale : travail en lecture seule */}
      <section aria-labelledby="travail-titre" className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 id="travail-titre" className="text-xl font-semibold text-neutral-50">{studentName}</h1>
            <p className="text-sm text-neutral-300">{work.activityTitle} · révision {work.revision}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={status} audience="teacher" />
            <a href={`/api/espace/teacher/export?workId=${work.id}`} className={`${btn} inline-flex items-center gap-1.5`}>
              <Download className="h-4 w-4" aria-hidden="true" /> Exporter
            </a>
          </div>
        </div>

        {versions.length > 0 && (
          <div className="mb-4 rounded-lg border border-white/10 p-3">
            <label className="flex flex-wrap items-center gap-2 text-sm text-neutral-200">
              <History className="h-4 w-4" aria-hidden="true" /> Version affichée
              <select className="h-9 rounded-md border border-white/15 bg-white/5 px-2 text-sm" onChange={(e) => void onPickVersion(e.target.value)} defaultValue="">
                <option value="">Version actuelle</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    Rév. {v.revision} · {REASON_LABEL[v.reason] ?? v.reason} · {formatDateTime(v.createdAt, timezone)}
                  </option>
                ))}
              </select>
            </label>
            {viewing && (
              <p role="status" className="mt-2 text-sm text-amber-200">
                Vous consultez une ancienne version ({viewing.label}). Vos commentaires portent sur le travail actuel.
              </p>
            )}
          </div>
        )}

        <WorkViewer
          workId={work.id}
          steps={steps}
          content={shown}
          attachments={attachments}
          onPickStep={(stepId) => set({ kind: 'STEP', stepId, questionId: '', lineStart: '', lineEnd: '' })}
          onPickQuestion={(stepId, questionId) => set({ kind: 'QUESTION', stepId, questionId, lineStart: '', lineEnd: '' })}
          onPickLine={(stepId, line) => set({ kind: 'CODE', stepId, questionId: '', lineStart: String(line), lineEnd: '' })}
        />
      </section>

      {/* Colonne droite : correction */}
      <aside aria-label="Correction" className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSave();
          }}
          className="space-y-3 rounded-xl border border-white/10 bg-surface-card p-4"
        >
          <h2 className="text-base font-semibold text-neutral-50">Votre retour</h2>

          <div className="block text-sm text-neutral-200">
            <label htmlFor="ann-kind">Porte sur</label>
            <select id="ann-kind" className={inputClass} value={draft.kind} onChange={(e) => set({ kind: e.target.value as AnnotationKind })}>
              {(Object.keys(KIND_LABEL) as AnnotationKind[]).map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </select>
          </div>

          {draft.kind !== 'GENERAL' && (
            <div className="block text-sm text-neutral-200">
              <label htmlFor="ann-step">Étape</label>
              <select id="ann-step" className={inputClass} value={draft.stepId} onChange={(e) => set({ stepId: e.target.value, questionId: '' })}>
                <option value="">Choisir…</option>
                {steps.map((s) => (
                  <option key={s.id} value={s.id}>{s.short} — {s.title}</option>
                ))}
              </select>
            </div>
          )}

          {draft.kind === 'QUESTION' && (
            <div className="block text-sm text-neutral-200">
              <label htmlFor="ann-question">Question</label>
              <select id="ann-question" className={inputClass} value={draft.questionId} onChange={(e) => set({ questionId: e.target.value })} disabled={!stepDef}>
                <option value="">Choisir…</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>{t.label.slice(0, 70)}</option>
                ))}
              </select>
            </div>
          )}

          {draft.kind === 'CODE' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="block text-sm text-neutral-200">
                <label htmlFor="ann-line-start">Ligne de début</label>
                <input id="ann-line-start" className={inputClass} inputMode="numeric" value={draft.lineStart} onChange={(e) => set({ lineStart: e.target.value })} />
              </div>
              <div className="block text-sm text-neutral-200">
                <label htmlFor="ann-line-end">Ligne de fin</label>
                <input id="ann-line-end" className={inputClass} inputMode="numeric" value={draft.lineEnd} onChange={(e) => set({ lineEnd: e.target.value })} placeholder="facultatif" />
              </div>
              <p className="col-span-2 text-xs text-neutral-400">Astuce : cliquez un numéro de ligne dans le code pour le renseigner.</p>
            </div>
          )}

          <div className="block text-sm text-neutral-200">
            <label htmlFor="ann-body">Commentaire</label>
            <textarea id="ann-body" className={`${inputClass} min-h-28`} value={draft.body} maxLength={MAX_BODY + 200} onChange={(e) => set({ body: e.target.value })} />
          </div>
          <p className="text-xs text-neutral-400">{draft.body.length}/{MAX_BODY}</p>

          {snippets.length > 0 && (
            <fieldset>
              <legend className="text-xs font-medium text-neutral-300">Commentaires réutilisables (facultatif)</legend>
              <ul className="mt-1 space-y-1">
                {snippets.map((s) => (
                  <li key={s.id} className="flex items-start gap-1">
                    <button type="button" onClick={() => set({ body: draft.body ? `${draft.body.trimEnd()} ${s.body}` : s.body })} className="flex-1 rounded-md border border-white/10 px-2 py-1 text-left text-xs text-neutral-200 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">
                      {s.body}
                    </button>
                    <button type="button" aria-label="Retirer ce commentaire réutilisable" onClick={() => void espaceApi.deleteSnippet(s.id).then(() => setSnippets((l) => l.filter((x) => x.id !== s.id))).catch((e) => note('error', describeError(e)))} className="rounded-md p-1 text-neutral-400 hover:text-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          <button type="button" onClick={() => void onSaveSnippet()} className="text-xs text-brand-accent underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">
            Garder ce texte comme commentaire réutilisable
          </button>

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="submit" disabled={busy} className="rounded-md bg-brand-accent px-4 py-2 text-sm font-medium text-neutral-950 hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Enregistrer
            </button>
          </div>
        </form>

        <div className="space-y-2 rounded-xl border border-white/10 bg-surface-card p-4">
          <h2 className="text-base font-semibold text-neutral-50">Statut du travail</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !canApplyReview(status, 'MARK_CORRECTED')} onClick={() => void onReview('MARK_CORRECTED', 'Travail marqué corrigé : l’élève voit vos retours.')} className={btn}>Corrigé</button>
            <button type="button" disabled={busy || !canApplyReview(status, 'REOPEN')} onClick={() => void onReview('REOPEN', 'Travail rouvert : l’élève peut le reprendre.')} className={btn}>À reprendre</button>
            {status === 'CORRECTED' && (
              <button type="button" disabled={busy || !canApplyReview(status, 'MARK_DONE')} onClick={() => void onReview('MARK_DONE', 'Travail terminé.')} className={btn}>Terminé</button>
            )}
          </div>
          <button type="button" disabled={!next} onClick={() => next?.workId && router.push(`/espace/enseignant/corriger/${next.workId}`)} className={`${btn} inline-flex w-full items-center justify-center gap-2`}>
            Élève suivant{next ? ` : ${next.name}` : ''} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          {!next && <p className="text-xs text-neutral-400">Aucun autre travail à corriger.</p>}
        </div>

        <div aria-live="polite">
          {message && (
            <p role={message.kind === 'error' ? 'alert' : 'status'} className={`rounded-md border p-3 text-sm ${message.kind === 'error' ? 'border-amber-400/40 bg-amber-400/10 text-amber-100' : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100'}`}>
              {message.text}
            </p>
          )}
        </div>

        <section aria-labelledby="retours-titre" className="rounded-xl border border-white/10 bg-surface-card p-4">
          <h2 id="retours-titre" className="text-base font-semibold text-neutral-50">Retours enregistrés ({annotations.length})</h2>
          {annotations.length === 0 && <p className="mt-2 text-sm text-neutral-400">Aucun retour pour l’instant.</p>}
          <ul className="mt-2 space-y-3">
            {annotations.map((a) => (
              <li key={a.id} className="rounded-md border border-white/10 p-3" data-testid="annotation">
                <p className="text-xs text-neutral-400">{describeTarget(a)} · {a.authorName} · {formatDateTime(a.createdAt, timezone)}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-100">{a.body}</p>
                {(isAdmin || a.mine) && (
                  <button type="button" disabled={busy} onClick={() => void onDelete(a.id)} className="mt-2 inline-flex items-center gap-1 text-xs text-neutral-300 underline hover:text-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Supprimer
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
