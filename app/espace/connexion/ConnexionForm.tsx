'use client';

import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';

/** Seules les destinations internes de l'espace sont acceptées après connexion. */
export function safeDestination(value: string | undefined): string {
  if (!value || !value.startsWith('/espace') || value.startsWith('//') || value.includes('\\')) return '/espace';
  return value;
}

export function ConnexionForm({ callbackUrl, credentialChanged = false }: { callbackUrl?: string; credentialChanged?: boolean }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await signIn('espace', { username, secret, redirect: false });
      if (!result || result.error) {
        // Message volontairement unique : on ne distingue pas identifiant, secret, rôle du compte ou limite d’essais.
        setError('Identifiant, code personnel ou mot de passe incorrect. Après plusieurs essais, patientez quelques minutes.');
        return;
      }
      router.replace(safeDestination(callbackUrl));
      router.refresh();
    } catch {
      setError('Connexion impossible pour le moment. Vérifiez votre réseau et réessayez.');
    } finally {
      setPending(false);
    }
  }

  const input =
    'mt-2 block h-12 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-neutral-50 placeholder:text-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent';

  return (
    <div className="mx-auto max-w-md pt-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
          <LogIn className="h-7 w-7 text-brand-accent" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold text-neutral-50">Espace Nexus Réussite</h1>
        <p className="mt-2 text-neutral-300">Connecte-toi pour retrouver ton travail.</p>
      </div>

      <form method="post" onSubmit={onSubmit} className="space-y-5 rounded-xl border border-white/10 bg-surface-card p-6" aria-describedby={error ? 'connexion-erreur' : undefined}>
        <div>
          <label htmlFor="username" className="text-sm font-medium text-neutral-200">
            Identifiant
          </label>
          <input
            id="username"
            name="username"
            data-testid="input-username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            disabled={!ready || pending}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="exemple : prenom.n"
            className={input}
          />
        </div>

        <div>
          <label htmlFor="secret" className="text-sm font-medium text-neutral-200">
            Code personnel ou mot de passe
          </label>
          <div className="relative">
            <input
              id="secret"
              name="secret"
              data-testid="input-secret"
              type={showSecret ? 'text' : 'password'}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              disabled={!ready || pending}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className={`${input} pr-12`}
            />
            <button
              type="button"
              disabled={!ready}
              onClick={() => setShowSecret((v) => !v)}
              aria-label={showSecret ? 'Masquer le code ou le mot de passe' : 'Afficher le code ou le mot de passe'}
              aria-pressed={showSecret}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-neutral-300 hover:text-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent"
            >
              {showSecret ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
          <div className="mt-2 space-y-1 text-xs text-neutral-400">
            <p>Élèves : pour le code personnel, majuscules, minuscules et tirets sont indifférents.</p>
            <p>Enseignants : saisissez votre mot de passe exact, en respectant majuscules, minuscules, espaces et tirets.</p>
          </div>
        </div>

        {credentialChanged && !error && (
          <p role="status" data-testid="connexion-modifie" className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm text-emerald-100">
            Votre code a été modifié. Reconnectez-vous avec votre nouveau code (ou mot de passe).
          </p>
        )}

        {error && (
          <p id="connexion-erreur" role="alert" data-testid="connexion-erreur" className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!ready || pending}
          data-testid="btn-connexion"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-accent font-medium text-neutral-950 hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
          Se connecter
        </button>
      </form>

      <div className="mt-6 space-y-2 text-center text-sm text-neutral-400">
        <p>Élèves : code oublié ou perdu ? Demandez-en un nouveau à votre enseignant.</p>
        <p>Enseignants : pour un mot de passe oublié, contactez l’administrateur.</p>
      </div>
    </div>
  );
}
