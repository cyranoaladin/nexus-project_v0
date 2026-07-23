import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { CampaignFAQ } from '@/components/pre-rentree-2026/CampaignFAQ';
import { CampaignPageTracker } from '@/components/pre-rentree-2026/CampaignPageTracker';
import { CanonicalOfferCatalogue } from '@/components/pre-rentree-2026/CanonicalOfferCatalogue';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { getPreRentreePublicSurfaceDTO } from '@/lib/campaigns/pre-rentree-2026/public-surface';
import { getPreRentreeReleaseGate } from '@/lib/campaigns/pre-rentree-2026/release-gate';

export function generateMetadata(): Metadata {
  if (!getPreRentreeReleaseGate().isPublicReady) {
    return {
      title: 'Contenu indisponible | Nexus Réussite',
      robots: { index: false, follow: false, nocache: true },
    };
  }
  const dto = getPreRentreePublicSurfaceDTO();
  if (!dto) {
    return {
      title: 'Contenu indisponible | Nexus Réussite',
      robots: { index: false, follow: false, nocache: true },
    };
  }
  return {
    title: dto.seo.title,
    description: dto.seo.description,
    alternates: { canonical: dto.seo.canonical },
    robots: dto.publication.indexable
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true },
    openGraph: {
      type: 'website',
      title: dto.seo.title,
      description: dto.seo.description,
      url: dto.seo.canonical,
      siteName: 'Nexus Réussite',
      locale: 'fr_FR',
      images: [{ url: dto.seo.image, alt: dto.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: dto.seo.title,
      description: dto.seo.description,
      images: [dto.seo.image],
    },
  };
}

export default function PreRentree2026Page() {
  const dto = getPreRentreePublicSurfaceDTO();
  if (!dto) notFound();
  const whatsappUrl = buildWhatsAppUrl(dto.contact.whatsappMessage, { exactMessage: true });
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        mainEntity: dto.faq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
      {
        '@type': 'ItemList',
        name: dto.title,
        itemListElement: dto.offers.map((offer, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'Course',
            name: `${offer.levelLabel} · ${offer.pricingKind === 'FOUNDATIONS' ? offer.subjectLabels[0] : `${offer.subjectCount} ${offer.subjectCount === 1 ? 'matière' : 'matières'}`}`,
            description: offer.objectives.join('. '),
            provider: { '@type': 'EducationalOrganization', name: 'Nexus Réussite' },
            offers: {
              '@type': 'Offer',
              price: offer.price,
              priceCurrency: offer.currency,
              url: `${dto.canonicalPath}#offres-pre-rentree`,
            },
          },
        })),
      },
    ],
  };

  return (
    <main id="main-content" className="min-h-screen overflow-x-clip bg-lux-paper">
      <CorporateNavbar />
      <CampaignPageTracker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />

      <section className="bg-lux-ink px-4 pb-16 pt-28 md:px-6 md:pb-24 md:pt-32" aria-labelledby="pre-rentree-heading">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lux-gold-wash">{dto.startLabel} · {dto.venue}</p>
          <h1 id="pre-rentree-heading" className="mt-4 max-w-4xl font-fraunces text-4xl text-lux-on-dark md:text-6xl">{dto.title}</h1>
          <p className="mt-6 max-w-3xl text-xl leading-8 text-lux-on-dark-muted">{dto.promise}</p>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-lux-on-dark-subtle">{dto.audience}</p>
          <ul className="mt-8 flex flex-wrap gap-3 text-sm text-lux-on-dark">
            {dto.levels.map((level) => <li key={level.id} className="rounded-full bg-white/10 px-4 py-2">{level.label}</li>)}
            <li className="rounded-full bg-white/10 px-4 py-2">Effectifs annoncés offre par offre</li>
          </ul>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a href="#offres-pre-rentree" className="lux-cta-reserve inline-flex min-h-11 items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold">Voir les offres et tarifs</a>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-lux-line/50 px-6 py-3 text-sm font-semibold text-lux-on-dark">WhatsApp {dto.contact.whatsappDisplay}</a>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14 md:px-6 md:py-20" aria-labelledby="subjects-heading">
        <div className="mx-auto max-w-6xl">
          <h2 id="subjects-heading" className="font-fraunces text-3xl text-lux-ink md:text-4xl">Matières disponibles selon le niveau</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {dto.levels.map((level) => (
              <article key={level.id} className="rounded-2xl border border-lux-line bg-lux-paper p-5">
                <h3 className="font-fraunces text-xl text-lux-ink">{level.label}</h3>
                <ul className="mt-4 space-y-2 text-sm text-lux-slate">{level.subjects.map((subject) => <li key={subject.id}>{subject.label}</li>)}</ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div id="offres-pre-rentree" className="scroll-mt-24">
        <CanonicalOfferCatalogue data={dto} />
      </div>

      <section className="bg-lux-ink px-4 py-14 md:px-6 md:py-20" aria-labelledby="method-heading">
        <div className="mx-auto max-w-6xl">
          <h2 id="method-heading" className="font-fraunces text-3xl text-lux-on-dark md:text-4xl">Ce qui distingue les dix heures Nexus</h2>
          <p className="mt-3 max-w-3xl text-lux-on-dark-muted">Le volume horaire est associé à une organisation explicite et à des éléments réellement inclus dans les offres publiées.</p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {dto.method.map((item, index) => <li key={item} className="rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-lux-on-dark"><span className="mb-2 block font-fraunces text-2xl text-lux-gold-wash">{index + 1}</span>{item}</li>)}
          </ol>
        </div>
      </section>

      <section className="bg-white px-4 py-14 md:px-6 md:py-20" aria-labelledby="reservation-heading">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-lux-line bg-lux-paper p-6">
            <h2 id="reservation-heading" className="font-fraunces text-2xl text-lux-ink">Demande d&apos;information</h2>
            <p className="mt-4 font-semibold text-lux-ink">{dto.reservation.rule}</p>
            <p className="mt-3 text-sm leading-6 text-lux-slate">{dto.reservation.explanation}</p>
          </article>
          <article className="rounded-2xl border border-lux-line bg-lux-paper p-6">
            <h2 className="font-fraunces text-2xl text-lux-ink">Demander le bon parcours</h2>
            <p className="mt-4 text-sm leading-6 text-lux-slate">Indiquez la classe de rentrée, la ou les matières recherchées et le statut scolaire. L’équipe vérifie ensuite l’offre applicable.</p>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="lux-cta-reserve mt-6 inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold">Écrire au {dto.contact.whatsappDisplay}</a>
          </article>
        </div>
      </section>

      <CampaignFAQ items={[...dto.faq]} />
      <CorporateFooter />
    </main>
  );
}
