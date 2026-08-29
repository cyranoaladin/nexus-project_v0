import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { CandidatIndividuelWorkspace } from '@/components/dashboard/assistante/CandidatIndividuelWorkspace';
import { isActiveForInternalStaff } from '@/lib/quotes/pipeline-flag';

export const metadata = {
  title: 'Simulateur de devis - Candidat individuel | Nexus Réussite',
  robots: { index: false, follow: false },
};

export default async function AssistanteCandidatIndividuelPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin?callbackUrl=/dashboard/assistante/candidat-individuel');
  }
  if (session.user.role !== UserRole.ASSISTANTE && session.user.role !== UserRole.ADMIN) {
    redirect('/dashboard');
  }

  const active = isActiveForInternalStaff();

  return (
    <div className="min-h-[calc(100vh-6rem)] space-y-5 text-neutral-100">
      <header className="relative overflow-hidden rounded-micro border border-white/10 bg-surface-card p-5 shadow-sm md:p-6">
        <div className="absolute inset-y-0 right-0 w-48 bg-[radial-gradient(circle_at_center,rgba(201,168,76,0.13),transparent_68%)]" aria-hidden="true" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">Outil interne Nexus</p>
            <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">Simulateur de devis - Candidat individuel</h1>
            <p className="mt-2 text-sm leading-6 text-neutral-300">
              Construisez une proposition personnalisée, contrôlez les conditions de publication et remettez à la famille un devis clair et sécurisé.
            </p>
          </div>
          <span className="w-fit rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-xs font-medium text-amber-100">Usage équipe uniquement</span>
        </div>
      </header>

      {active ? (
        <CandidatIndividuelWorkspace />
      ) : (
        <div className="rounded-micro border border-amber-300/25 bg-amber-300/10 p-6 text-sm text-amber-50" role="status">
          <p className="font-semibold">Le simulateur interne n&apos;est pas activé.</p>
          <p className="mt-2 text-amber-100/80">Aucune simulation ni publication n&apos;est disponible tant que son activation interne n&apos;a pas été validée.</p>
        </div>
      )}
    </div>
  );
}
