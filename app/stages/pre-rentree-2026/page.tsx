import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { CampaignFAQ } from '@/components/pre-rentree-2026/CampaignFAQ';
import { CampaignPageTracker } from '@/components/pre-rentree-2026/CampaignPageTracker';
import { CanonicalOfferCatalogue } from '@/components/pre-rentree-2026/CanonicalOfferCatalogue';
import { CampaignExperienceProvider } from '@/components/pre-rentree-2026/CampaignExperienceContext';
import { ProgramsSection } from '@/components/pre-rentree-2026/ProgramsSection';
import { ScheduleSection } from '@/components/pre-rentree-2026/ScheduleSection';
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
          <ul className="mt-8 flex flex-wrap gap-3 text-sm text-lux-on-dark">
            <li className="rounded-full bg-white/10 px-4 py-2">5 séances de 2 h par matière</li>
            <li className="rounded-full bg-white/10 px-4 py-2">Groupes à effectif limité</li>
            <li className="rounded-full bg-white/10 px-4 py-2">Programmes ciblés par niveau</li>
            <li className="rounded-full bg-white/10 px-4 py-2">Planning compatible avec plusieurs matières</li>
          </ul>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a href="#planning" className="lux-cta-reserve inline-flex min-h-11 items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold">Construire mon planning</a>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-lux-line/50 px-6 py-3 text-center text-sm font-semibold text-lux-on-dark">Échanger sur WhatsApp</a>
            <a href={dto.contact.phoneHref} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-lux-line/50 px-6 py-3 text-sm font-semibold text-lux-on-dark">Appeler le {dto.contact.phoneDisplay}</a>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14 md:px-6 md:py-20" aria-labelledby="subjects-heading">
        <div className="mx-auto max-w-6xl">
          <h2 id="subjects-heading" className="font-fraunces text-3xl text-lux-ink md:text-4xl">Un stage adapté à sa classe de rentrée</h2>
          <p className="mt-3 max-w-3xl text-lux-slate">Choisissez le niveau de votre enfant pour découvrir les matières, les tarifs, les créneaux et le programme des cinq séances.</p>
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

      <CampaignExperienceProvider>
        <ScheduleSection
          schedule={dto.planning.schedule}
          scheduleWindows={dto.planning.scheduleWindows}
          levels={dto.planning.levels}
          subjects={dto.planning.subjects}
          blocks={dto.planning.blocks}
          organization={dto.planning.organization}
          roomsPubliclyConfirmed={dto.planning.roomsPubliclyConfirmed}
          offerOptions={dto.planning.offerOptions}
          capacityByOffer={dto.planning.capacityByOffer}
        />

      <section className="bg-lux-ink px-4 py-14 md:px-6 md:py-20" aria-labelledby="method-heading">
        <div className="mx-auto max-w-6xl">
          <h2 id="method-heading" className="font-fraunces text-3xl text-lux-on-dark md:text-4xl">Une méthode structurée pour progresser en cinq séances</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {dto.method.map((step, index) => <li key={step.title} className="rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-lux-on-dark"><span className="mb-2 block font-fraunces text-2xl text-lux-gold-wash">{index + 1}</span><span className="block font-semibold">{step.title}</span><span className="mt-1 block text-lux-on-dark/80">{step.description}</span></li>)}
          </ol>
        </div>
      </section>

        <ProgramsSection
          modules={dto.programs}
          levels={dto.planning.levels}
          documents={dto.documents}
        />
      </CampaignExperienceProvider>

      <CampaignFAQ items={[...dto.faq]} />

      <section className="bg-white px-4 py-14 md:px-6 md:py-20" aria-labelledby="reservation-heading">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="reservation-heading" className="font-fraunces text-3xl text-lux-ink md:text-4xl">Construisons le bon parcours pour votre enfant</h2>
          <p className="mt-4 text-lux-slate">Indiquez sa classe de rentrée et les matières souhaitées. Notre équipe vous confirme les créneaux disponibles et vous guide vers la formule adaptée.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="lux-cta-reserve inline-flex min-h-11 items-center justify-center rounded-lg px-6 py-3 text-center text-sm font-semibold">Échanger avec Nexus sur WhatsApp</a>
            <a href={dto.contact.phoneHref} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-lux-line px-6 py-3 text-sm font-semibold text-lux-ink">Appeler le {dto.contact.phoneDisplay}</a>
          </div>
          <p className="mt-4 text-sm text-lux-slate">{dto.reservation.rule}</p>
        </div>
      </section>

      <CorporateFooter />
    </main>
  );
}
