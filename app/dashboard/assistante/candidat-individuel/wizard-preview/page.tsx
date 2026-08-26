import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { auth } from '@/auth';
import { isActiveForInternalStaff } from '@/lib/quotes/pipeline-flag';
import { PublicWizardPreview } from '@/components/dashboard/assistante/PublicWizardPreview';

export const metadata = {
  title: 'Aperçu parcours public (interne) | Nexus Réussite',
  robots: { index: false, follow: false },
};

/**
 * Route de prévisualisation strictement protégée (mission "vers un produit
 * complet" §6) — laisse ADMIN/ASSISTANTE tester le futur parcours candidat
 * individuel avant toute décision de le publier. Ne remplace PAS
 * /devis-bac (le wizard public actuel, components/quotes/DevisWizard.tsx,
 * moteur legacy) — reste un point d'entrée séparé, jamais lié depuis une
 * page publique. Même garde que le reste du workspace assistante : rôle
 * ADMIN/ASSISTANTE + pricing.candidatIndividuelPipeline.state >=
 * ACTIVE_INTERNAL (cohérent avec le fait que cette prévisualisation est,
 * elle aussi, un usage interne du nouveau moteur).
 */
export default async function CandidatIndividuelWizardPreviewPage() {
  const session = await auth();
  if (!session?.user) redirect('/auth/signin?callbackUrl=/dashboard/assistante/candidat-individuel/wizard-preview');
  if (session.user.role !== UserRole.ASSISTANTE && session.user.role !== UserRole.ADMIN) redirect('/dashboard');

  const active = isActiveForInternalStaff();

  return (
    <div className="min-h-[calc(100vh-6rem)] space-y-4 text-neutral-100">
      <div className="flex flex-col gap-2 rounded-micro border border-white/10 bg-surface-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-brand-accent">Usage interne — prévisualisation</p>
          <h1 className="mt-1 text-xl font-semibold text-white md:text-2xl">Aperçu du futur parcours public candidat individuel</h1>
          <p className="mt-1 text-sm text-neutral-300">
            Reproduction du futur wizard public (nouveau moteur carte-aware), réservée à l'équipe. Ne remplace pas
            /devis-bac, qui reste le wizard public réel et actif.
          </p>
        </div>
        <span className="w-fit rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-100">
          Ne jamais lier depuis une page publique
        </span>
      </div>

      {active ? (
        <div className="mx-auto max-w-3xl rounded-2xl border border-lux-line bg-lux-white p-6 shadow-md md:p-10">
          <PublicWizardPreview />
        </div>
      ) : (
        <div className="rounded-micro border border-white/10 bg-surface-card p-6 text-sm text-neutral-300">
          <p className="font-medium text-white">Nouveau moteur non activé.</p>
          <p className="mt-2 text-neutral-300">
            <code className="rounded bg-black/30 px-1.5 py-0.5">pricing.candidatIndividuelPipeline.state</code> doit être{' '}
            <code className="rounded bg-black/30 px-1.5 py-0.5">ACTIVE_INTERNAL</code> (ou plus) pour prévisualiser ce
            parcours.
          </p>
        </div>
      )}
    </div>
  );
}
