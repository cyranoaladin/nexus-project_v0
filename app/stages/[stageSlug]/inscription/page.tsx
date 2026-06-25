export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { StageInscriptionForm } from '@/components/stages/StageInscriptionForm';
import { formatStageDateRange, formatStagePrice, getPublicStageBySlug } from '@/lib/stages/public';

type PageProps = {
  params: Promise<{ stageSlug: string }>;
};

export default async function StageInscriptionPage({ params }: PageProps) {
  const { stageSlug } = await params;
  const stage = await getPublicStageBySlug(stageSlug);

  if (!stage) {
    notFound();
  }

  return (
    <div className="relative min-h-screen bg-lux-ink">
      <CorporateNavbar />

      <main id="main-content" className="relative z-10 pt-28">
        <section className="mx-auto max-w-7xl px-6 pb-20">
          <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="rounded-[28px] border border-lux-line/40 bg-white/5 p-6 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-lux-on-dark-subtle">Inscription publique</p>
              <h1 className="mt-3 font-fraunces text-3xl font-light tracking-tight text-lux-ivory">{stage.title}</h1>
              <p className="mt-4 text-sm leading-7 text-lux-on-dark-muted">{formatStageDateRange(stage.startDate, stage.endDate)}</p>
              <p className="mt-2 text-sm text-lux-on-dark-muted">{formatStagePrice(stage.priceAmount, stage.priceCurrency)}</p>
              <p className="mt-6 text-sm leading-7 text-lux-on-dark-muted">
                Le formulaire se remplit en trois étapes. Une fois envoyé, notre équipe vous recontacte pour la confirmation, les modalités de paiement et les derniers détails logistiques.
              </p>
              <div className="mt-8 rounded-[24px] border border-lux-line/40 bg-white/5 p-5">
                <p className="text-sm font-semibold text-lux-ivory">Après validation</p>
                <p className="mt-2 text-sm leading-6 text-lux-on-dark-muted">
                  Vous recevez un email avec votre statut de réservation. Si le stage est complet, votre demande bascule automatiquement en liste d&apos;attente.
                </p>
              </div>
              <Link href={`/stages/${stage.slug}`} className="mt-6 inline-flex items-center text-sm font-medium text-lux-gold transition hover:text-lux-ivory">
                Retour à la fiche du stage
              </Link>
            </aside>

            <section>
              {!stage.isOpen ? (
                <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-8">
                  <h2 className="font-fraunces text-2xl font-light text-lux-ivory">Les inscriptions pour ce stage sont fermées.</h2>
                  <p className="mt-3 text-sm leading-7 text-lux-on-dark-muted">
                    Vous pouvez revenir à la fiche du stage ou parcourir les autres programmes encore ouverts.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link href={`/stages/${stage.slug}`} className="inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-lux-ink transition hover:bg-lux-ivory">
                      Retour au stage
                    </Link>
                    <Link href="/stages" className="inline-flex rounded-full border border-lux-line/40 bg-white/5 px-5 py-3 text-sm font-semibold text-lux-ivory transition hover:bg-white/10">
                      Voir les autres stages
                    </Link>
                  </div>
                </div>
              ) : (
                <StageInscriptionForm
                  stage={{
                    slug: stage.slug,
                    title: stage.title,
                    startDate: stage.startDate,
                    endDate: stage.endDate,
                    priceAmount: stage.priceAmount,
                    priceCurrency: stage.priceCurrency,
                    isOpen: stage.isOpen,
                  }}
                />
              )}
            </section>
          </div>
        </section>
      </main>

      <CorporateFooter />
    </div>
  );
}
