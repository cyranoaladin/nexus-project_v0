'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function ParentPhoneAccess({ token }: { token: string }) {
  const router = useRouter();
  const live = useRef(true);
  const [renewalPhone, setRenewalPhone] = useState('');
  const [renewalState, setRenewalState] = useState<'idle'|'submitting'|'sent'|'error'>('idle');
  const [state, setState] = useState<'loading'|'ready'|'invalid'|'submitting'>('loading');
  const [purpose, setPurpose] = useState('ACTIVATION');
  const [phoneHint, setPhoneHint] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    live.current = true;
    setState('loading');
    fetch(`/api/auth/parent-phone?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async response => {
        const data = await response.json();
        if (!live.current) return;
        if (!response.ok || !data.valid) { setState('invalid'); return; }
        setPhoneHint(data.phoneHint); setPurpose(data.purpose); setState('ready');
      }).catch(() => { if (live.current) setState('invalid'); });
    return () => { live.current = false; };
  }, [token]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (password !== confirmation) { setError('Les mots de passe ne correspondent pas.'); return; }
    setState('submitting');
    try {
      const response = await fetch('/api/auth/parent-phone', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
      const data = await response.json();
      if (!live.current) return;
      if (!response.ok || !data.success) { setError(data.error || 'Impossible de finaliser votre accès.'); setState('ready'); return; }
      router.replace('/auth/signin?activated=true&callbackUrl=%2Fdashboard%2Fparent%2Finscription');
    } catch { if (!live.current) return; setError('Connexion interrompue. Veuillez réessayer.'); setState('ready'); }
  };
  const renewActivation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (renewalState === 'submitting' || !renewalPhone.trim()) return;
    setRenewalState('submitting');
    try {
      const response = await fetch('/api/auth/parent-phone/recovery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: renewalPhone.trim(), purpose: 'ACTIVATION' }),
      });
      if (!live.current) return;
      setRenewalState(response.ok ? 'sent' : 'error');
    } catch { if (live.current) setRenewalState('error'); }
  };
  return <main className="min-h-screen bg-lux-ink text-lux-ivory px-4 py-16">
    <section className="mx-auto max-w-md rounded-2xl border border-lux-line/40 bg-white/5 p-6 sm:p-8">
      <p className="text-sm text-lux-gold">Nexus Réussite · Espace parent</p>
      <h1 className="mt-3 text-2xl font-semibold">{purpose === 'RECOVERY' ? 'Retrouver mon accès' : 'Activer mon espace parent'}</h1>
      {state === 'loading' ? <p role="status" className="mt-6">Vérification de votre lien…</p> : state === 'invalid' ? <div className="mt-6 space-y-4">
        <p>Ce lien est invalide, expiré ou a déjà été utilisé.</p>
        <p className="text-sm text-lux-on-dark-muted">Pour activer votre espace, demandez un nouveau lien avec le numéro communiqué à Nexus Réussite.</p>
        {renewalState === 'sent' ? <p role="status">Si ce numéro permet de retrouver votre compte, un lien personnel sera envoyé sur WhatsApp.</p> : <form onSubmit={renewActivation} className="space-y-4">
          <div><Label htmlFor="renewal-phone">Numéro WhatsApp du parent</Label><Input id="renewal-phone" type="tel" autoComplete="tel" required maxLength={64} value={renewalPhone} onChange={event => setRenewalPhone(event.target.value)} className="mt-2 bg-white/5" /></div>
          {renewalState === 'error' && <p role="alert" className="text-amber-200">La demande n’a pas pu être traitée. Veuillez réessayer plus tard.</p>}
          <Button type="submit" disabled={renewalState === 'submitting'} className="w-full">{renewalState === 'submitting' ? 'Demande en cours…' : 'Demander un nouveau lien d’activation'}</Button>
        </form>}
        <Link className="block underline text-lux-gold" href="/auth/signin">Mon espace est déjà activé : me connecter ou retrouver mon accès</Link>
      </div> : <form onSubmit={submit} className="mt-6 space-y-5">
        <p className="text-sm text-lux-on-dark-muted">Accès lié au numéro {phoneHint}. Choisissez votre mot de passe, puis connectez-vous pour compléter votre dossier familial.</p>
        <div><Label htmlFor="parent-password">Nouveau mot de passe</Label><Input id="parent-password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={password} onChange={event => setPassword(event.target.value)} className="mt-2 bg-white/5"/><p className="mt-1 text-xs text-lux-on-dark-muted">Au moins 8 caractères.</p></div>
        <div><Label htmlFor="parent-password-confirm">Confirmer le mot de passe</Label><Input id="parent-password-confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={confirmation} onChange={event => setConfirmation(event.target.value)} className="mt-2 bg-white/5"/></div>
        {error && <p role="alert" className="text-amber-200">{error}</p>}
        <Button type="submit" disabled={state === 'submitting'} className="w-full">{state === 'submitting' ? 'Validation…' : 'Valider mon accès'}</Button>
      </form>}
    </section>
  </main>;
}
function ParentPhoneLink() {
  const params = useSearchParams();
  const token = params?.get('token') ?? '';
  // A new link gets a fresh form, including passwords and asynchronous state.
  return <ParentPhoneAccess key={token} token={token} />;
}
export default function ParentPhonePage() { return <Suspense fallback={<p role="status">Chargement…</p>}><ParentPhoneLink/></Suspense>; }
