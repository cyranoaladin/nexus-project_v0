'use client';

import { useState } from 'react';
import { Copy, KeyRound, Loader2 } from 'lucide-react';

import { AlertDialog } from '@/components/espace/student/AlertDialog';

/**
 * Compte de l'élève, côté enseignant : on ne peut QUE réinitialiser (jamais lire) le code.
 * Le code temporaire n'existe en clair que dans la réponse de la réinitialisation : il est affiché une fois
 * et disparaît de l'écran quand on le ferme.
 */
export function StudentAccountPanel({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/espace/teacher/students/${encodeURIComponent(studentId)}/reset-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        credentials: 'same-origin',
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; temporaryCode?: string; message?: string };
      if (res.ok && data.ok && data.temporaryCode) {
        setCode(data.temporaryCode);
        setConfirming(false);
      } else {
        setConfirming(false);
        setError(res.status === 429 ? 'Trop de réinitialisations en peu de temps. Réessayez dans quelques minutes.' : data.message ?? 'La réinitialisation n’a pas pu être enregistrée. Le code actuel reste valide.');
      }
    } catch {
      setConfirming(false);
      setError('La réinitialisation n’a pas pu être enregistrée. Le code actuel reste valide.');
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-300">
        Le code personnel de l’élève est secret : il n’est pas lisible, même par l’enseignant. En cas d’oubli, vous pouvez le réinitialiser :
        un code temporaire est généré, et l’élève devra choisir son propre code à sa prochaine connexion.
      </p>
      <button
        type="button"
        data-testid="btn-reset-code"
        onClick={() => { setError(null); setCode(null); setCopied(false); setConfirming(true); }}
        className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm text-neutral-100 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
      >
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        Réinitialiser le code personnel
      </button>

      {error && (
        <p role="alert" data-testid="reset-error" className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">{error}</p>
      )}

      {code && (
        <div role="status" data-testid="reset-result" className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-4">
          <p className="text-sm font-medium text-emerald-100">Code temporaire de {studentName} — affiché une seule fois</p>
          <p className="mt-2 font-mono text-2xl tracking-widest text-neutral-50" data-testid="temporary-code">{code}</p>
          <p className="mt-2 text-sm text-emerald-100">
            Notez-le et transmettez-le à l’élève de vive voix ou sur papier. Il ne pourra plus être affiché : fermez ce cadre une fois transmis.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={copy} className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-sm text-neutral-100 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">
              <Copy className="h-4 w-4" aria-hidden="true" />
              {copied ? 'Copié' : 'Copier'}
            </button>
            <button type="button" data-testid="btn-close-code" onClick={() => { setCode(null); setCopied(false); }} className="rounded-md border border-white/20 px-3 py-2 text-sm text-neutral-100 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent">
              Fermer et effacer
            </button>
          </div>
        </div>
      )}

      {confirming && (
        <AlertDialog
          title={`Réinitialiser le code de ${studentName} ?`}
          onEscape={() => setConfirming(false)}
          actions={[
            { label: 'Annuler', onClick: () => setConfirming(false), variant: 'secondary', autoFocus: true, disabled: pending },
            { label: pending ? 'Réinitialisation…' : 'Réinitialiser', onClick: () => void reset(), variant: 'primary', disabled: pending },
          ]}
        >
          <p>
            Le code actuel cessera de fonctionner immédiatement et les sessions ouvertes de l’élève seront fermées. Un code temporaire sera
            affiché une seule fois ; l’élève choisira ensuite son propre code.
          </p>
          {pending && <Loader2 className="mt-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        </AlertDialog>
      )}
    </div>
  );
}
