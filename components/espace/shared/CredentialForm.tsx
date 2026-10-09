'use client';

import { signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';

interface Props {
  kind: 'code' | 'password';
  /** Vrai quand l'élève doit remplacer un code temporaire avant d'utiliser l'espace. */
  mandatory?: boolean;
}

const FIELD =
  'mt-2 block h-12 w-full rounded-lg border border-white/15 bg-white/5 px-3 pr-12 text-neutral-50 placeholder:text-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent';

function SecretInput({ id, label, value, onChange, autoComplete, hint, testId, disabled }: {
  id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; hint?: string; testId: string; disabled: boolean;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-neutral-200">{label}</label>
      <div className="relative">
        <input
          id={id}
          name={id}
          data-testid={testId}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={FIELD}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? `Masquer : ${label}` : `Afficher : ${label}`}
          aria-pressed={shown}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-neutral-300 hover:text-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent"
        >
          {shown ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
      {hint && <p id={`${id}-hint`} className="mt-2 text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}

/** Changement autonome du code personnel (élève) ou du mot de passe (enseignant), depuis la session ouverte. */
export function CredentialForm({ kind, mandatory = false }: Props) {
  const isCode = kind === 'code';
  const noun = isCode ? 'code personnel' : 'mot de passe';
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError(`Les deux nouveaux ${isCode ? 'codes' : 'mots de passe'} ne correspondent pas.`);
      return;
    }
    setPending(true);
    try {
      const res = await fetch('/api/espace/account/credential', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current, next, confirm }),
        credentials: 'same-origin',
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
      if (res.ok && data.ok) {
        // Jamais de succès affiché si l'enregistrement a échoué ; les sessions sont révoquées : on se reconnecte.
        setDone(true);
        setCurrent('');
        setNext('');
        setConfirm('');
        window.setTimeout(() => void signOut({ callbackUrl: '/espace/connexion?modifie=1' }), 2500);
        return;
      }
      if (res.status === 429) setError('Trop d’essais. Patientez quelques minutes avant de réessayer.');
      else setError(data.message ?? `Le changement n’a pas pu être enregistré. Votre ${noun} actuel reste valide.`);
    } catch {
      setError(`Le changement n’a pas pu être enregistré. Votre ${noun} actuel reste valide.`);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div role="status" data-testid="credential-success" className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-5 text-emerald-100">
        <p className="font-medium">{isCode ? 'Votre code personnel a été modifié.' : 'Votre mot de passe a été modifié.'}</p>
        <p className="mt-2 text-sm">
          Reconnectez-vous avec votre nouveau {noun}. Vous allez être redirigé vers la page de connexion.
        </p>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-5 rounded-xl border border-white/10 bg-surface-card p-6" aria-describedby={error ? 'credential-erreur' : undefined}>
      {mandatory && (
        <p role="note" data-testid="credential-mandatory" className="rounded-lg border border-brand-accent/40 bg-brand-accent/10 p-3 text-sm text-neutral-100">
          Ton code actuel est temporaire. Choisis ton propre code personnel pour continuer : le code temporaire ne fonctionnera plus ensuite.
        </p>
      )}
      <SecretInput
        id="credential-current"
        testId="input-current"
        label={isCode ? 'Code personnel actuel' : 'Mot de passe actuel'}
        value={current}
        onChange={setCurrent}
        autoComplete="current-password"
        disabled={!ready || pending}
      />
      <SecretInput
        id="credential-next"
        testId="input-next"
        label={isCode ? 'Nouveau code personnel' : 'Nouveau mot de passe'}
        value={next}
        onChange={setNext}
        autoComplete="new-password"
        disabled={!ready || pending}
        hint={isCode ? '6 caractères au minimum, lettres et chiffres. Évite 123456, ton prénom ou ton identifiant.' : '12 caractères au minimum. Une phrase de passe longue et mémorisable convient très bien.'}
      />
      <SecretInput
        id="credential-confirm"
        testId="input-confirm"
        label={isCode ? 'Confirmer le nouveau code' : 'Confirmer le nouveau mot de passe'}
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        disabled={!ready || pending}
      />

      {error && (
        <p id="credential-erreur" role="alert" data-testid="credential-error" className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!ready || pending}
        data-testid="btn-credential"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-accent font-medium text-neutral-950 hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <KeyRound className="h-5 w-5" aria-hidden="true" />}
        {isCode ? 'Modifier mon code' : 'Modifier mon mot de passe'}
      </button>
    </form>
  );
}
