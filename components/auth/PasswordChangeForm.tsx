"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCanonicalSignOut, useProtectedFetch } from './SessionRecoveryProvider';

export function PasswordChangeForm() {
  const router = useRouter();
  const fetch = useProtectedFetch();
  const signOut = useCanonicalSignOut();
  const submitting = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setHydrated(true); }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !hydrated || completed) return;
    setError('');
    if (newPassword !== confirmation) {
      setError('Les mots de passe ne correspondent pas.'); return;
    }
    if (newPassword.length < 8 || new TextEncoder().encode(newPassword).length > 72) {
      setError('Choisissez au moins 8 caractères, dans la limite de 72 octets UTF-8.'); return;
    }
    submitting.current = true; setPending(true);
    let changed = false;
    try {
      const response = await fetch('/api/v2/auth/password-change', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await response.json();
      if (!response.ok || body?.ok !== true || body?.data?.sessionsRevoked !== true) {
        setError(response.status === 403 ? 'Vérifiez votre mot de passe actuel.'
          : response.status === 429 ? 'Trop de tentatives. Réessayez dans quelques minutes.'
          : response.status === 401 || response.status === 409 ? 'Reconnectez-vous avant de réessayer.'
          : 'Le changement a échoué. Vérifiez les champs ou réessayez plus tard.');
        return;
      }
      changed = true;
      setCurrentPassword(''); setNewPassword(''); setConfirmation(''); setCompleted(true);
      try {
        await signOut({ redirect: false, callbackUrl: '/auth/signin' });
        router.replace('/auth/signin');
      }
      catch { setError('Votre mot de passe est modifié. La fermeture locale de la session reste à confirmer : retournez à la connexion.'); }
    } catch {
      setError('Connexion interrompue. Le changement n’est pas confirmé ; reconnectez-vous ou utilisez la récupération de compte.');
    } finally {
      if (!changed) submitting.current = false;
      setPending(false);
    }
  }

  if (completed) return <div className="space-y-4">
    <p role="status">Votre mot de passe est modifié et vos anciennes sessions sont révoquées.</p>
    {error && <p role="alert">{error}</p>}
    <Link href="/auth/signin" className="underline focus-visible:outline focus-visible:outline-2">Se reconnecter</Link>
  </div>;

  return <form onSubmit={submit} className="max-w-lg space-y-5" aria-busy={pending}>
    <p id="password-change-help">Après le changement, reconnectez-vous sur chacun de vos appareils.</p>
    <fieldset disabled={!hydrated || pending} className="space-y-4">
      <legend className="sr-only">Modifier mon mot de passe</legend>
      <div><label htmlFor="account-current-password" className="block mb-2">Mot de passe actuel</label>
        <input id="account-current-password" type="password" autoComplete="current-password" required maxLength={200}
          value={currentPassword} onChange={event => setCurrentPassword(event.target.value)}
          className="w-full rounded border border-slate-500 bg-white p-3 text-slate-900 focus-visible:outline focus-visible:outline-2" /></div>
      <div><label htmlFor="account-new-password" className="block mb-2">Nouveau mot de passe</label>
        <input id="account-new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={72}
          aria-describedby="password-length-help" value={newPassword} onChange={event => setNewPassword(event.target.value)}
          className="w-full rounded border border-slate-500 bg-white p-3 text-slate-900 focus-visible:outline focus-visible:outline-2" />
        <p id="password-length-help" className="mt-2 text-sm">8 caractères minimum, 72 octets UTF-8 maximum. Certains caractères comptent pour plusieurs octets.</p></div>
      <div><label htmlFor="account-confirm-password" className="block mb-2">Confirmer le nouveau mot de passe</label>
        <input id="account-confirm-password" type="password" autoComplete="new-password" required minLength={8} maxLength={72}
          value={confirmation} onChange={event => setConfirmation(event.target.value)}
          className="w-full rounded border border-slate-500 bg-white p-3 text-slate-900 focus-visible:outline focus-visible:outline-2" /></div>
      <button type="submit" className="rounded bg-blue-900 px-5 py-3 text-white disabled:opacity-60 focus-visible:outline focus-visible:outline-2">
        {pending ? 'Changement en cours…' : 'Changer mon mot de passe'}
      </button>
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <Link href="/auth/mot-de-passe-oublie" className="inline-block underline focus-visible:outline focus-visible:outline-2">Mot de passe actuel oublié</Link>
  </form>;
}
