import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { auth } from '@/auth';
import { isActiveForInternalStaff } from '@/lib/quotes/pipeline-flag';
import { CandidatIndividuelWorkspace } from '@/components/dashboard/assistante/CandidatIndividuelWorkspace';

export const metadata = {
  title: 'Candidat individuel (interne) | Nexus Réussite',
  robots: { index: false, follow: false },
};

export default async function AssistanteCandidatIndividuelPage() {
  const session = await auth();
  if (!session?.user) redirect('/auth/signin?callbackUrl=/dashboard/assistante/candidat-individuel');
  if (session.user.role !== UserRole.ASSISTANTE && session.user.role !== UserRole.ADMIN) redirect('/dashboard');

  const active = isActiveForInternalStaff();

  return (
    <div className="min-h-[calc(100vh-6rem)] space-y-4 text-neutral-100">
      <div className="flex flex-col gap-2 rounded-micro border border-white/10 bg-surface-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-brand-accent">Usage interne — mission recâblage</p>
          <h1 className="mt-1 text-xl font-semibold text-white md:text-2xl">Candidat individuel — nouveau moteur (carte + tarification)</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Interface de travail, réservée à l'équipe Nexus Réussite. Estimation/simulation uniquement — jamais un devis définitif tant que la
            revue réglementaire et l'arbitrage direction ne sont pas passés.
          </p>
        </div>
        <span className="w-fit rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-100">
          Ne pas partager aux familles
        </span>
      </div>

      {active ? (
        <CandidatIndividuelWorkspace />
      ) : (
        <div className="rounded-micro border border-white/10 bg-surface-card p-6 text-sm text-neutral-300">
          <p className="font-medium text-white">Nouveau moteur non activé.</p>
          <p className="mt-2 text-neutral-400">
            <code className="rounded bg-black/30 px-1.5 py-0.5">pricing.candidatIndividuelPipeline.state</code> doit être{' '}
            <code className="rounded bg-black/30 px-1.5 py-0.5">ACTIVE_INTERNAL</code> (ou plus) pour que cette interface fonctionne. Statut
            NO-GO tant que l'activation n'est pas décidée par la direction — voir docs/candidat-individuel/.
          </p>
        </div>
      )}
    </div>
  );
}
