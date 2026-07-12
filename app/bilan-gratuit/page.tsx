import { OG_DEFAULT_IMAGE } from '@/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { BilanStrategiqueClient } from './BilanStrategiqueClient';
import { Badge } from '@/components/ui/badge';
import { WhatsAppLogo, WHATSAPP_BRAND_GREEN } from '@/components/ui/whatsapp-logo';
import { PaymentMethodsNote } from '@/components/marketing/PaymentMethodsNote';
import { fmtTND } from '@/components/premium/format';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import {
  resolveProgrammeLabel,
  resolveSelectedOfferContext,
  type SelectedOfferContext,
} from './selected-offer';
import { parsePreRentreeBilanPrefill, type CampaignSearchParams } from '@/lib/campaigns/pre-rentree-2026/bilan-prefill';
import { getPreRentreeLandingDTO } from '@/lib/campaigns/pre-rentree-2026/getters';
import { formatAcademicProfile } from '@/lib/campaigns/pre-rentree-2026/configurator';

export const metadata: Metadata = {
  title: 'Bilan stratégique gratuit | Nexus Réussite',
  description:
    'Identifiez les priorités de votre enfant avant de choisir une formule. Bilan gratuit, réponse personnalisée et orientation vers la bonne solution.',
  alternates: { canonical: '/bilan-gratuit' },
  openGraph: {
    images: [OG_DEFAULT_IMAGE],
    title: 'Bilan stratégique gratuit | Nexus Réussite',
    description:
      'Un échange simple pour comprendre le niveau, les besoins et les matières prioritaires de votre enfant.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

type BilanGratuitPageProps = {
  searchParams?: Promise<CampaignSearchParams>;
};

function SelectedOfferSummary({ selectedOffer }: { selectedOffer: SelectedOfferContext }) {
  return (
    <div className="mx-auto mt-5 max-w-2xl rounded-2xl border border-lux-line/30 bg-white/5 p-4 text-left text-sm text-lux-on-dark-muted">
      <p className="font-semibold text-lux-gold-wash">Offre repérée&nbsp;: {selectedOffer.title}</p>
      <p className="mt-1">
        Tarif {fmtTND(selectedOffer.price)}
        {selectedOffer.deposit != null && !selectedOffer.full_at_booking
          ? ` · acompte ${fmtTND(selectedOffer.deposit)}`
          : ''}
        {selectedOffer.full_at_booking
          ? ` · règlement intégral à la réservation`
          : selectedOffer.installments && selectedOffer.installments.length > 0
            ? ` · ${selectedOffer.installments.length} × ${fmtTND(selectedOffer.installments[0])}${
                selectedOffer.installments[selectedOffer.installments.length - 1] !== selectedOffer.installments[0]
                  ? ` puis ${fmtTND(selectedOffer.installments[selectedOffer.installments.length - 1])}`
                  : ''
              }`
            : selectedOffer.solde != null
              ? ` · solde ${fmtTND(selectedOffer.solde)}`
              : selectedOffer.solde_schedule && selectedOffer.solde_schedule.length > 0
                ? ` · ${selectedOffer.solde_schedule.length} soldes`
                : ''}
      </p>
      <div className="mt-4">
        <PaymentMethodsNote tone="dark" />
      </div>
    </div>
  );
}

function BilanHero({
  programmeLabel,
  selectedOffer,
}: {
  programmeLabel: string | null;
  selectedOffer: SelectedOfferContext | null;
}) {
  return (
    <section className="bg-lux-ink px-4 py-16 pt-28 md:px-6">
      <div className="mx-auto max-w-5xl text-center">
        <Badge className="mb-4 border border-lux-line/40 bg-white/5 text-lux-gold-wash">
          Diagnostic gratuit
        </Badge>
        <h1 className="font-fraunces text-4xl font-light tracking-tight text-lux-ivory md:text-5xl">
          Bilan stratégique gratuit
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-lux-on-dark-muted">
          Identifier les priorités de votre enfant avant de choisir une formule. Réponse personnalisée,
          orientation vers la bonne solution et échange humain avec notre équipe pédagogique.
        </p>
        {programmeLabel && (
          <p className="mt-3 text-sm text-lux-gold-wash">
            Contexte repéré&nbsp;: {programmeLabel}
          </p>
        )}
        {selectedOffer && <SelectedOfferSummary selectedOffer={selectedOffer} />}

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={buildWhatsAppUrl('le bilan gratuit')}
            target="_blank"
            rel="noopener noreferrer"
            className="lux-cta-secondary rounded-lg px-6 py-3.5 text-sm font-semibold text-lux-ivory border-lux-line/40"
          >
            <WhatsAppLogo className="mr-2 h-4 w-4" style={{ color: WHATSAPP_BRAND_GREEN }} />
            Écrire sur WhatsApp
          </a>
          <Link href="/offres" className="lux-cta-reserve rounded-lg px-6 py-3.5 text-sm font-semibold">
            Voir les offres
          </Link>
        </div>
      </div>
    </section>
  );
}

export default async function BilanGratuitPage({ searchParams }: BilanGratuitPageProps) {
  const params = await searchParams;
  const preRentreePrefill = parsePreRentreeBilanPrefill(params);
  const rawProgramme = typeof params?.programme === 'string' ? params.programme : null;
  const programme = preRentreePrefill?.programme ?? (rawProgramme === 'pre-rentree-2026' ? null : rawProgramme);
  const legacyOffer = typeof params?.offer === 'string' ? params.offer : null;
  const offerId = preRentreePrefill?.packId ?? legacyOffer;
  const programmeLabel = resolveProgrammeLabel(programme);
  const selectedOffer = resolveSelectedOfferContext(offerId);
  const campaignDto = preRentreePrefill ? getPreRentreeLandingDTO() : null;
  const profileLabels = campaignDto ? Object.fromEntries([
    ...campaignDto.academicProfiles.PREMIERE.voies,
    ...campaignDto.academicProfiles.PREMIERE.mathsProfiles,
    ...campaignDto.academicProfiles.PREMIERE.eafProfiles,
    ...campaignDto.academicProfiles.TERMINALE.retainedSpecialties.options,
    ...campaignDto.academicProfiles.TERMINALE.mathsOptions,
  ].map((option) => [option.id, option.label])) : {};

  return (
    <main className="luxury min-h-screen" id="main-content">
      <CorporateNavbar />
      <BilanHero programmeLabel={programmeLabel} selectedOffer={selectedOffer} />
      <BilanStrategiqueClient
        programme={programme}
        selectedOffer={selectedOffer}
        prefill={preRentreePrefill ? {
          studentGrade: preRentreePrefill.level.toLowerCase(),
          subjects: preRentreePrefill.subjectIds,
          contextLabel: programmeLabel ?? 'Pré-rentrée 2026',
          entryLevelLabel: campaignDto?.levels.find(
            (level) => level.id === preRentreePrefill.level,
          )?.label ?? preRentreePrefill.level,
          profileLabel: formatAcademicProfile(preRentreePrefill.profile, profileLabels),
          campaignContext: preRentreePrefill,
        } : null}
      />
    </main>
  );
}
