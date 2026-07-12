import { LEGAL } from '@/lib/legal';
import {
  formatCampaignVenue,
  formatFrenchDecisionDate,
} from '@/lib/campaigns/pre-rentree-2026/presentation';

function fullDate(date: string): string {
  return new Intl.DateTimeFormat('fr-TN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Tunis' })
    .format(new Date(`${date}T12:00:00+01:00`));
}

export function PracticalInformation({ campaign, blocks, capacity, pack, depositPercentage, content, cgvPath }: {
  campaign: { startDate: string; endDate: string; noClassDates: string[]; decisionDeadline: string; venue: { name: string; neighborhood: string; city: string } };
  blocks: Array<{ id: string; startTime: string; endTime: string }>;
  capacity: { minPerCohort: number; maxPerCohort: number };
  pack: { totalHours: number } | undefined;
  depositPercentage: number;
  content: { audience: string; material: string; preRegistrationNotice: string; noOnlinePaymentNotice: string; groupNotOpenedProcedure: string };
  cgvPath: string;
}) {
  const decision = formatFrenchDecisionDate(campaign.decisionDeadline);
  return (
    <section className="bg-lux-paper px-4 py-14 md:py-20" aria-labelledby="practical-heading">
      <div className="mx-auto max-w-6xl">
        <h2 id="practical-heading" className="font-fraunces text-3xl text-lux-ink md:text-4xl">Informations pratiques et conditions</h2>
        <dl className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="font-semibold text-lux-ink">Classes de rentrée</dt><dd className="mt-1 text-sm text-lux-slate">{content.audience}</dd></div>
          <div><dt className="font-semibold text-lux-ink">Lieu</dt><dd className="mt-1 text-sm text-lux-slate">{formatCampaignVenue(campaign.venue)}</dd></div>
          <div><dt className="font-semibold text-lux-ink">Dates</dt><dd className="mt-1 text-sm text-lux-slate">Du {fullDate(campaign.startDate)} au {fullDate(campaign.endDate)} · aucun cours les {campaign.noClassDates.map(fullDate).join(' et ')}</dd></div>
          <div><dt className="font-semibold text-lux-ink">Horaires</dt><dd className="mt-1 text-sm text-lux-slate">{blocks.map((block) => `Bloc ${block.id} ${block.startTime}–${block.endTime}`).join(' · ')}</dd></div>
          <div><dt className="font-semibold text-lux-ink">Volume par matière</dt><dd className="mt-1 text-sm text-lux-slate">{pack?.totalHours} heures selon le créneau choisi</dd></div>
          <div><dt className="font-semibold text-lux-ink">Matériel</dt><dd className="mt-1 text-sm text-lux-slate">{content.material}</dd></div>
          <div><dt className="font-semibold text-lux-ink">Contact</dt><dd className="mt-1 text-sm text-lux-slate"><a className="underline" href={`mailto:${LEGAL.contact.email}`}>{LEGAL.contact.email}</a> · <a className="underline" href={`tel:${LEGAL.contact.phoneRaw}`}>{LEGAL.contact.phone}</a></dd></div>
          <div><dt className="font-semibold text-lux-ink">Ouverture du groupe</dt><dd className="mt-1 text-sm text-lux-slate">À partir de {capacity.minPerCohort} élèves, maximum {capacity.maxPerCohort}. Décision le {decision}.</dd></div>
          <div><dt className="font-semibold text-lux-ink">Acompte</dt><dd className="mt-1 text-sm text-lux-slate">{depositPercentage} % selon le pack, demandé après validation du groupe et du profil.</dd></div>
          <div><dt className="font-semibold text-lux-ink">Si le groupe n'ouvre pas</dt><dd className="mt-1 text-sm text-lux-slate">{content.groupNotOpenedProcedure}</dd></div>
        </dl>
        <div className="mt-8 space-y-3 rounded-2xl border border-lux-gold/30 bg-white p-5 text-sm text-lux-ink"><p>{content.preRegistrationNotice}</p><p>{content.noOnlinePaymentNotice}</p><p><a href={cgvPath} className="font-semibold underline">Consulter les conditions générales de vente</a></p></div>
      </div>
    </section>
  );
}
