import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { fmtTND } from '@/components/premium/format';
import { ProcessSteps, ReassuranceChips } from '@/components/marketing/acadomia-inspired';
import {
  getAnnualOffer,
  getPack,
  getPonctuelOffer,
  type AnnualOffer,
  type Pack,
  type PonctuelOffer,
} from '@/lib/pricing';

type OfferRef = {
  type: 'annual' | 'ponctuel' | 'pack';
  id: string;
};

type ResolvedOffer = {
  id: string;
  title: string;
  description: string;
  price: number | null;
};

export type LandingNicheProps = {
  title: string;
  intro: string;
  offerRefs: OfferRef[];
  faq: { question: string; answer: string }[];
  jsonLdName: string;
};

function resolveOffer(ref: OfferRef): ResolvedOffer | null {
  if (ref.type === 'annual') {
    const offer: AnnualOffer | undefined = getAnnualOffer(ref.id);
    if (!offer) return null;
    return {
      id: offer.id,
      title: offer.title,
      description: offer.included.slice(0, 2).join(' · ') || offer.subjects,
      price: offer.price_annual,
    };
  }

  if (ref.type === 'ponctuel') {
    const offer: PonctuelOffer | undefined = getPonctuelOffer(ref.id);
    if (!offer) return null;
    return {
      id: offer.id,
      title: offer.title,
      description: offer.description,
      price: offer.price_per_student,
    };
  }

  const pack: Pack | undefined = getPack(ref.id);
  if (!pack) return null;
  return {
    id: pack.id,
    title: pack.title,
    description: pack.public,
    price: pack.price,
  };
}

export function LandingNiche({ title, intro, offerRefs, faq, jsonLdName }: LandingNicheProps) {
  const offers = offerRefs.map(resolveOffer).filter((offer): offer is ResolvedOffer => Boolean(offer));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: jsonLdName,
    provider: {
      '@type': 'EducationalOrganization',
      name: 'Nexus Réussite',
      url: 'https://nexusreussite.academy',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Tunis',
        addressCountry: 'TN',
      },
    },
    offers: offers.map((offer) => ({
      '@type': 'Offer',
      name: offer.title,
      price: offer.price ?? undefined,
      priceCurrency: 'TND',
      url: `https://nexusreussite.academy/offres#${offer.id}`,
    })),
  };

  return (
    <main className="luxury min-h-screen bg-lux-paper" id="main-content">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CorporateNavbar />

      <section className="bg-lux-ink px-4 pb-16 pt-32 md:px-6">
        <div className="mx-auto max-w-5xl">
          <p className="lux-eyebrow text-lux-gold-wash">Nexus Réussite</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-fraunces font-light text-lux-ivory md:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-lux-on-dark-muted md:text-lg">
            {intro}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/bilan-gratuit" className="lux-cta-reserve rounded-lg px-6 py-3.5 text-sm font-semibold">
              Demander un bilan gratuit
            </Link>
            <Link href="/recommandation" className="inline-flex min-h-[44px] items-center rounded-lg border border-white/15 px-6 py-3 text-sm font-semibold text-lux-ivory">
              Trouver ma formule
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 md:px-6">
        <div className="mx-auto max-w-6xl">
          <ReassuranceChips />
        </div>
      </section>

      <section className="px-4 py-14 md:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <p className="lux-eyebrow">Offres liées</p>
            <h2 className="mt-2 text-2xl font-fraunces text-lux-ink md:text-3xl">Parcours recommandés</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {offers.map((offer) => (
              <article key={offer.id} className="rounded-2xl border border-lux-line bg-lux-white p-5 lux-shadow">
                <h3 className="font-fraunces text-xl text-lux-ink">{offer.title}</h3>
                <p className="mt-3 text-sm leading-6 text-lux-slate">{offer.description}</p>
                {offer.price ? (
                  <p className="mt-4 font-mono text-sm font-semibold tabular-nums text-lux-ink">{fmtTND(offer.price)}</p>
                ) : null}
                <Link
                  href={`/offres#${offer.id}`}
                  className="mt-5 inline-flex min-h-[44px] items-center rounded-lg border border-lux-line px-4 py-2 text-sm font-semibold text-lux-ink"
                >
                  Voir l’offre
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ProcessSteps />

      <section className="px-4 py-14 md:px-6">
        <div className="mx-auto max-w-4xl rounded-2xl border border-lux-line bg-lux-white p-6 lux-shadow md:p-8">
          <p className="lux-eyebrow">Questions fréquentes</p>
          <div className="mt-6 space-y-5">
            {faq.map((item) => (
              <div key={item.question} className="rounded-xl border border-lux-line/70 bg-lux-paper/70 p-4">
                <h2 className="flex items-start gap-2 text-base font-semibold text-lux-ink">
                  <CheckCircle2 className="mt-1 h-4 w-4 flex-none text-lux-evergreen" aria-hidden="true" />
                  {item.question}
                </h2>
                <p className="mt-2 text-sm leading-6 text-lux-slate">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-lux-ink px-4 py-14 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-fraunces font-light text-lux-ivory">Construire un parcours adapté</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-lux-on-dark-muted">
            Le bilan gratuit permet de choisir une formule claire, avec des tarifs publics en TND et un suivi parent lisible.
          </p>
          <Link href="/bilan-gratuit" className="lux-cta-reserve mt-7 rounded-lg px-6 py-3.5 text-sm font-semibold">
            Demander un bilan gratuit
          </Link>
        </div>
      </section>

      <CorporateFooter />
    </main>
  );
}
