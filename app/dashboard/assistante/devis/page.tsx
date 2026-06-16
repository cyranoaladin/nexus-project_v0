import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';

import { auth } from '@/auth';

export const metadata = {
  title: 'Assistant devis | Nexus Réussite',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AssistanteDevisPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin?callbackUrl=/dashboard/assistante/devis');
  }

  if (session.user.role !== UserRole.ASSISTANTE && session.user.role !== UserRole.ADMIN) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-[calc(100vh-6rem)] space-y-4 text-neutral-100">
      <div className="flex flex-col gap-2 rounded-micro border border-white/10 bg-surface-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-brand-accent">
            Usage interne
          </p>
          <h1 className="mt-1 text-xl font-semibold text-white md:text-2xl">
            Assistant conseil & devis
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Interface confidentielle réservée à l&apos;équipe Nexus Réussite.
          </p>
        </div>
        <span className="w-fit rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-100">
          Ne pas partager aux familles
        </span>
      </div>

      <iframe
        title="Assistant conseil et devis Nexus Réussite"
        src="/dashboard/assistante/devis/app"
        className="h-[calc(100vh-14rem)] min-h-[760px] w-full rounded-micro border border-white/10 bg-white"
      />
    </div>
  );
}
