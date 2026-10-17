import Link from 'next/link';
import { ArrowRight, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { fmtTND } from '@/components/premium/format';
import { ProcessSteps, ReassuranceChips } from '@/components/marketing/acadomia-inspired';
import type { PreparationLink } from '@/content/marketing/preparation-links';
import { getCandidatsLibres2027, getParcoursCandidatLibre, type ParcoursCandidatLibreId } from '@/lib/candidats-libres-2027';
import { LEGAL } from '@/lib/legal';
import {
  getAnnualOffer,
  getPack,
  getPonctuelOffer,
  type AnnualOffer,
  type Pack,
  type PonctuelOffer,
} from '@/lib/pricing';
import { filArianeJsonLd, serialiserJsonLd } from '@/lib/seo';

export type OfferRef = {
  /** `candidat-libre` : parcours de la session 2027 (bloc candidats_libres_2027), détaillés sur /bac-candidat-libre. */
  type: 'annual' | 'ponctuel' | 'pack' | 'candidat-libre';
  id: string;
};

export type NicheSection = {
  heading: string;
  body?: string[];
  bullets?: string[];
};

export type RelatedLink = {
  label: string;
  description?: string;
} & (
  | {
    /** Les quatre pages de préparation, plus les dossiers d'inscription datés. */
    href: PreparationLink['href'] | '/inscription-bac-2027';
    externe?: false;
  }
  | {
    /**
     * Une adresse officielle hors du site — portail d'examen, autorité. Elle
     * vient du manifeste des dossiers audités, jamais d'une saisie, et sort
     * en nouvel onglet annoncé.
     */
    href: string;
    externe: true;
  }
);

type ResolvedOffer = {
  id: string;
  title: string;
  description: string;
  price: number | null;
  href: string;
};

export type LandingNicheProps = {
  /** Chemin public de la page : sert au fil d'Ariane, jamais réécrit à la main. */
  path: string;
  title: string;
  intro: string;
  offerRefs: OfferRef[];
  faq: { question: string; answer: string }[];
  jsonLdName: string;
  sections?: NicheSection[];
  relatedLinks?: RelatedLink[];
};

function resolveOffer(ref: OfferRef): ResolvedOffer | null {
  if (ref.type === 'candidat-libre') {
    const parcours = getParcoursCandidatLibre(ref.id as ParcoursCandidatLibreId);
    if (!parcours) return null;
    return {
      id: parcours.id,
      title: `Candidat libre — ${parcours.titre}`,
      description: `${parcours.heures_cours}\u00a0h de cours en groupes de ${getCandidatsLibres2027().groupe.max} au plus · ${parcours.copies_corrigees} copies corrigées · ${parcours.bilans} bilans · session 2027`,
      price: parcours.prix_annuel,
      href: `/bac-candidat-libre#${parcours.id}`,
    };
  }

  if (ref.type === 'annual') {
    const offer: AnnualOffer | undefined = getAnnualOffer(ref.id);
    if (!offer) return null;
    return {
      id: offer.id,
      title: offer.title,
      description: offer.included.slice(0, 2).join(' · ') || offer.subjects,
      price: offer.price_annual,
      href: `/offres#${offer.id}`,
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
      href: `/offres#${offer.id}`,
    };
  }

  const pack: Pack | undefined = getPack(ref.id);
  if (!pack) return null;
  return {
    id: pack.id,
    title: pack.title,
    description: pack.public,
    price: pack.price,
    href: `/offres#${pack.id}`,
  };
}

export function LandingNiche({
  path,
  title,
  intro,
  offerRefs,
  faq,
  jsonLdName,
  sections = [],
  relatedLinks = [],
}: LandingNicheProps) {
  const offers = offerRefs.map(resolveOffer).filter((offer): offer is ResolvedOffer => Boolean(offer));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: jsonLdName,
    provider: {
      '@type': 'EducationalOrganization',
      name: 'Nexus Réussite',
      url: LEGAL.web.url,
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
      url: `${LEGAL.web.url}${offer.href}`,
    })),
  };
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <main className="luxury min-h-screen bg-lux-paper" id="main-content">
      {/* JSON-LD statique construit par JSON.stringify sur des données du dépôt (aucune entrée utilisateur) — même motif que app/layout.tsx. */}
      {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiserJsonLd(jsonLd) }} />
      {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml — même justification : fil d'Ariane statique. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiserJsonLd(filArianeJsonLd(path, title)) }} />
      {faq.length > 0 ? (
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml — même justification : JSON-LD FAQ statique.
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiserJsonLd(faqJsonLd) }} />
      ) : null}
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

      {sections.length > 0 ? (
        <section className="px-4 py-14 md:px-6">
          <div className="mx-auto max-w-4xl space-y-10">
            {sections.map((section) => (
              <article key={section.heading}>
                <p className="lux-eyebrow">Repère</p>
                <h2 className="mt-2 text-2xl font-fraunces text-lux-ink md:text-3xl">{section.heading}</h2>
                <div className="lux-filet-gold mt-3 w-16" />
                {section.body?.map((paragraph) => (
                  <p key={paragraph} className="mt-4 text-base leading-8 text-lux-slate">
                    {paragraph}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className="mt-4 space-y-3">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-3 text-base leading-7 text-lux-slate">
                        <CheckCircle2 className="mt-1 h-4 w-4 flex-none text-lux-evergreen" aria-hidden="true" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

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
                  href={offer.href}
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

      {relatedLinks.length > 0 ? (
        <section className="px-4 py-14 md:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8">
              <p className="lux-eyebrow">Aller plus loin</p>
              <h2 className="mt-2 text-2xl font-fraunces text-lux-ink md:text-3xl">Préparations dédiées</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {relatedLinks.map((link) => {
                const contenu = (
                  <>
                    <h3 className="flex items-center justify-between gap-4 font-fraunces text-xl text-lux-ink">
                      <span>
                        {link.label}
                        {link.externe ? <span className="sr-only"> (nouvel onglet)</span> : null}
                      </span>
                      {link.externe ? (
                        <ArrowUpRight
                          className="h-4 w-4 flex-none text-lux-slate transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      ) : (
                        <ArrowRight
                          className="h-4 w-4 flex-none text-lux-slate transition-transform group-hover:translate-x-1"
                          aria-hidden="true"
                        />
                      )}
                    </h3>
                    {link.description ? (
                      <p className="mt-3 text-sm leading-6 text-lux-slate">{link.description}</p>
                    ) : null}
                  </>
                );
                const classe = 'group rounded-2xl border border-lux-line bg-lux-white p-5 lux-shadow';
                // Une sortie du site n'est pas une navigation interne : pas de
                // préchargement, une cible annoncée, et la flèche change de sens.
                return link.externe ? (
                  <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className={classe}>
                    {contenu}
                  </a>
                ) : (
                  <Link key={link.href} href={link.href} className={classe}>
                    {contenu}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

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
