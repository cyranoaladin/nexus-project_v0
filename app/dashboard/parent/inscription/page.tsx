'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ParentRegistrationForm, type ParentRegistrationData, type ParentRegistrationInput } from '@/components/dashboard/parent/ParentRegistrationForm';

export default function ParentRegistrationPage() {
  const { data: session, status } = useSession();
  return <ParentRegistrationContent key={`${status}:${session?.user.id ?? ''}`} role={session?.user.role} status={status} />;
}

function ParentRegistrationContent({ role, status }: { role?: string; status: 'loading' | 'authenticated' | 'unauthenticated' }) {
  const router = useRouter();
  const [data, setData] = useState<ParentRegistrationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (status === 'loading') return;
    if (role !== 'PARENT') {
      router.replace('/auth/signin?callbackUrl=%2Fdashboard%2Fparent%2Finscription');
      return;
    }
    const controller = new AbortController();
    setData(null); setError(null);
    fetch('/api/parent/registration', { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Votre dossier ne peut pas être chargé. Réessayez ou contactez l’assistante.');
        const result = await response.json();
        if (!controller.signal.aborted) setData(result);
      }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Le service est indisponible.'); });
    return () => controller.abort();
  }, [status, role, router, reload]);
  async function submit(input: ParentRegistrationInput) {
    setNotice(null);
    const response = await fetch('/api/parent/registration', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    if (!response.ok) {
      if (response.status === 409) {
        setNotice('Le dossier a changé. Vérifiez les informations actualisées avant de confirmer.');
        setReload(value => value + 1);
        throw new Error('Le dossier a changé. Vérifiez les informations actualisées avant de confirmer.');
      }
      throw new Error('La confirmation n’a pas abouti. Vos choix sont conservés ; vous pouvez réessayer.');
    }
    setSaved(true);
  }
  return <main className="min-h-screen bg-surface-darker px-4 py-10 text-neutral-100 sm:px-6">
    <div className="mx-auto max-w-3xl space-y-6">
      <p className="text-sm text-brand-accent">Nexus Réussite · Espace famille</p>
      <h1 className="text-3xl font-semibold">Finaliser mon inscription</h1>
      <p className="text-neutral-300">Vérifiez le dossier préparé par l’assistante. Chaque enfant conserve son parcours et son suivi.</p>
      {notice && <p role="alert" className="text-amber-200">{notice}</p>}
      {saved ? <section role="status" className="space-y-4 rounded-xl border border-emerald-500/30 bg-surface-card p-6">
        <h2 className="text-xl font-semibold">Votre dossier est confirmé</h2>
        <p className="text-neutral-300">Vous pouvez retrouver vos enfants et les bilans dont la consultation est autorisée. L’équipe vous accompagne pour les prochaines étapes pédagogiques.</p>
        <Button asChild><Link href="/dashboard/parent">Accéder à mon espace famille</Link></Button>
      </section> : error ? <section className="space-y-4"><p role="alert" className="text-rose-200">{error}</p><Button onClick={() => setReload(value => value + 1)}>Réessayer</Button></section> : data ? <>
        {data.completedAt && <p className="text-sm text-neutral-300">Votre dossier a déjà été confirmé. Vous pouvez vérifier et actualiser vos informations.</p>}
        <ParentRegistrationForm key={reload} data={data} onSubmit={submit} />
      </> : <p role="status">Chargement de votre dossier…</p>}
      <Link href="/dashboard/parent" className="inline-block text-sm text-neutral-300 underline">Retour à mon espace famille</Link>
    </div>
  </main>;
}
