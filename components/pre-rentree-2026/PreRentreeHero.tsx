import { buildWhatsAppUrl } from '@/lib/whatsapp';
import type { LandingPack, LandingScheduleSlot } from '@/lib/campaigns/pre-rentree-2026/configurator';

function compactDateRange(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T12:00:00+01:00`);
  const end = new Date(`${endDate}T12:00:00+01:00`);
  const startDay = new Intl.DateTimeFormat('fr-TN', { day: 'numeric', timeZone: 'Africa/Tunis' }).format(start);
  const endLabel = new Intl.DateTimeFormat('fr-TN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Tunis' }).format(end);
  return `${startDay}–${endLabel}`;
}

function sessionDuration(start: string, end: string): number {
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  return (endHour * 60 + endMinute - startHour * 60 - startMinute) / 60;
}

export function PreRentreeHero({ campaign, content, capacity, packs, schedule, whatsappMessage }: {
  campaign: { startDate: string; endDate: string; venue: { neighborhood: string } };
  content: { eyebrow: string; h1: string; subtitle: string };
  capacity: { minPerCohort: number; maxPerCohort: number };
  packs: LandingPack[];
  schedule: LandingScheduleSlot[];
  whatsappMessage: string;
}) {
  const firstModule = schedule.filter(
    (slot) => slot.level === schedule[0]?.level && slot.subject === schedule[0]?.subject,
  );
  const singlePack = packs.find((pack) => pack.subjectsCount === 1);
  const maximumSubjects = Math.max(...packs.map((pack) => pack.subjectsCount));
  const duration = schedule[0] ? sessionDuration(schedule[0].startTime, schedule[0].endTime) : 0;
  const whatsappUrl = buildWhatsAppUrl(whatsappMessage, { exactMessage: true });

  return (
    <section className="bg-lux-ink px-4 py-16 pt-28 md:py-24 md:pt-32" aria-labelledby="hero-heading">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lux-gold-wash">{content.eyebrow}</p>
        <h1 id="hero-heading" className="mt-4 max-w-4xl font-fraunces text-4xl text-lux-on-dark md:text-6xl">{content.h1}</h1>
        <p className="mt-6 max-w-3xl text-lg text-lux-on-dark-muted md:text-xl">{content.subtitle}</p>
        <ul className="mt-8 flex flex-wrap gap-3 text-sm text-lux-on-dark">
          <li className="rounded-full bg-white/10 px-4 py-2">{compactDateRange(campaign.startDate, campaign.endDate)}</li>
          <li className="rounded-full bg-white/10 px-4 py-2">{firstModule.length} séances de {duration} h par matière</li>
          <li className="rounded-full bg-white/10 px-4 py-2">Groupes de {capacity.minPerCohort} à {capacity.maxPerCohort} élèves</li>
          <li className="rounded-full bg-white/10 px-4 py-2">Présentiel à {campaign.venue.neighborhood}</li>
          <li className="rounded-full bg-white/10 px-4 py-2">{singlePack?.subjectsCount} à {maximumSubjects} matières · {singlePack?.totalHours} h chacune</li>
        </ul>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a href="#configurateur" className="lux-cta-reserve inline-flex min-h-11 items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold">Composer le stage de mon enfant</a>
          <a href="#planning" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-lux-on-dark">Voir les horaires</a>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-lux-evergreen bg-lux-evergreen/10 px-6 py-3 text-sm font-semibold text-green-300">Poser une question <span className="sr-only">(nouvel onglet)</span></a>
        </div>
        <p className="mt-5 text-sm text-lux-on-dark-muted">Groupes limités à {capacity.maxPerCohort} élèves.</p>
      </div>
    </section>
  );
}
