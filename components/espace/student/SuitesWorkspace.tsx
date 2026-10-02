'use client';

import { FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { StatusBadge } from '@/components/espace/shared/StatusBadge';
import { EspaceApiError, espaceApi } from '@/lib/espace/client/api';
import type { AnnotationDto } from '@/lib/espace/annotations';
import type { WorkStatus } from '@/lib/espace/work-state';
import { isStudentEditable } from '@/lib/espace/work-state';

import { AlertDialog } from './AlertDialog';
import { annotationTarget, formatBytes } from './poo-logic';

export interface AttachmentItem {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

interface Props {
  workId: string;
  activitySlug: string;
  title: string;
  status: WorkStatus;
  resources: { key: string; label: string }[];
  attachments: AttachmentItem[];
  annotations: AnnotationDto[];
}

function messageFor(error: unknown): string {
  if (error instanceof EspaceApiError) {
    if (error.code === 'WORK_LOCKED') return 'Ce travail est remis : tu ne peux plus modifier tes fichiers.';
    if (error.code === 'RATE_LIMITED') return 'Trop d’envois d’un coup. Attends un instant puis réessaie.';
    if (error.status === 401) return 'Ta session a expiré : reconnecte-toi.';
    return error.message;
  }
  return 'Envoi impossible : vérifie ta connexion puis réessaie.';
}

export function SuitesWorkspace({ workId, activitySlug, title, status: initialStatus, resources, attachments: initial, annotations }: Props) {
  const [status, setStatus] = useState<WorkStatus>(initialStatus);
  const [files, setFiles] = useState<AttachmentItem[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const editable = isStudentEditable(status);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (list.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of list) {
        const { attachment } = await espaceApi.upload(workId, file);
        setFiles((f) => [...f, attachment]);
        setStatus((s) => (s === 'DRAFT' ? 'IN_PROGRESS' : s));
      }
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await espaceApi.deleteAttachment(workId, id);
      setFiles((f) => f.filter((x) => x.id !== id));
    } catch (e) {
      setError(messageFor(e));
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      // La route de remise exige la révision courante : on la relit côté serveur.
      const { work } = await espaceApi.getWork(workId);
      const res = await fetch(`/api/espace/works/${workId}/submit`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseRevision: work.revision }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new EspaceApiError(res.status, body?.error ?? 'UNKNOWN', body?.message ?? 'La remise a échoué.');
      setStatus('SUBMITTED');
      setConfirming(false);
    } catch (e) {
      setError(messageFor(e));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-neutral-50">{title}</h1>
        <p className="text-neutral-300">Mathématiques — Suites numériques, récurrence, convergence</p>
        <StatusBadge status={status} audience="student" />
      </header>

      {!editable && (
        <p role="status" className="rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-neutral-100" data-testid="work-banner">
          {status === 'CORRECTED' || status === 'DONE' ? 'Travail corrigé : lecture seule.' : 'Travail remis : lecture seule. Ton enseignant le corrigera.'}
        </p>
      )}
      {status === 'REOPENED' && (
        <p role="status" className="rounded-lg border border-orange-400/50 bg-orange-400/10 p-3 text-sm text-orange-100">
          Ton enseignant te demande de reprendre ce travail.
        </p>
      )}

      <section aria-labelledby="sujet" className="rounded-xl border border-white/10 bg-surface-card p-5">
        <h2 id="sujet" className="text-lg font-semibold text-neutral-50">
          Le sujet
        </h2>
        <ul className="mt-3 space-y-2">
          {resources.map((r) => (
            <li key={r.key}>
              <a
                href={`/api/espace/resources/${activitySlug}/${r.key}`}
                className="inline-flex items-center gap-2 text-brand-accent underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent"
              >
                <FileText className="h-4 w-4" aria-hidden="true" />
                {r.label} (PDF)
              </a>
            </li>
          ))}
          {resources.length === 0 && <li className="text-neutral-300">Aucune ressource disponible.</li>}
        </ul>
      </section>

      <section aria-labelledby="copie" className="rounded-xl border border-white/10 bg-surface-card p-5">
        <h2 id="copie" className="text-lg font-semibold text-neutral-50">
          Ta copie
        </h2>
        <p className="mt-1 text-sm text-neutral-300">Photographie ta copie manuscrite ou envoie un PDF (JPEG, PNG ou PDF, 8 Mo maximum par fichier).</p>

        {editable && (
          <div className="mt-4">
            <label htmlFor="copie-fichier" className="sr-only">
              Ajouter un fichier
            </label>
            <input
              ref={input}
              id="copie-fichier"
              data-testid="input-fichier"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              capture="environment"
              multiple
              onChange={onPick}
              disabled={busy}
              className="sr-only"
            />
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/20 px-4 text-neutral-100 hover:bg-white/5 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
              Ajouter une photo ou un PDF
            </button>
          </div>
        )}

        {error && (
          <p role="alert" data-testid="upload-erreur" className="mt-3 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">
            {error}
          </p>
        )}

        {files.length === 0 ? (
          <p className="mt-4 text-neutral-300">Aucun fichier envoyé pour l’instant.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/10" data-testid="fichiers">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                <a
                  href={`/api/espace/works/${workId}/attachments/${f.id}`}
                  className="min-w-0 truncate text-neutral-100 underline-offset-2 hover:underline"
                >
                  {f.originalName}
                </a>
                <span className="shrink-0 text-sm text-neutral-300">{formatBytes(f.sizeBytes)}</span>
                {editable && (
                  <button
                    type="button"
                    onClick={() => remove(f.id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm text-neutral-200 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent"
                    aria-label={`Supprimer ${f.originalName}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Supprimer
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {editable && (
          <div className="mt-5">
            <button
              type="button"
              data-testid="btn-remettre"
              disabled={files.length === 0 || busy}
              onClick={() => setConfirming(true)}
              className="h-11 rounded-lg bg-brand-accent px-5 font-medium text-neutral-950 hover:opacity-90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Remettre mon travail
            </button>
            {files.length === 0 && <p className="mt-2 text-sm text-neutral-300">Ajoute au moins un fichier pour pouvoir remettre.</p>}
          </div>
        )}
      </section>

      {annotations.length > 0 && (
        <section aria-labelledby="retour" className="rounded-xl border border-brand-accent/40 bg-surface-card p-5">
          <h2 id="retour" className="text-lg font-semibold text-neutral-50">
            Retour de ton enseignant
          </h2>
          <ul className="mt-3 space-y-3">
            {annotations.map((a) => (
              <li key={a.id} data-testid="annotation">
                <p className="text-xs text-neutral-300">{annotationTarget(a)}</p>
                <p className="whitespace-pre-wrap text-neutral-100">{a.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {confirming && (
        <AlertDialog
          title="Remettre ton travail ?"
          onEscape={() => setConfirming(false)}
          actions={[
            { label: 'Annuler', onClick: () => setConfirming(false), autoFocus: true, disabled: busy },
            { label: busy ? 'Remise en cours…' : 'Remettre', onClick: submit, variant: 'primary', disabled: busy },
          ]}
        >
          <p>
            Une fois remis ({files.length} fichier{files.length > 1 ? 's' : ''}), ton travail passe en lecture seule jusqu’à la correction.
          </p>
        </AlertDialog>
      )}
    </div>
  );
}
