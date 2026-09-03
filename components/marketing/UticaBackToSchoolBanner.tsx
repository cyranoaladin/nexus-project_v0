import Link from 'next/link';
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react';

export function UticaBackToSchoolBanner() {
  return (
    <section
      aria-label="Nexus Réussite au salon B@ck to School 2026, UTICA Tunis, stand 46"
      data-testid="utica-back-to-school-banner"
      className="relative z-10 bg-lux-paper px-4 pb-6 pt-[5.75rem] sm:px-6 md:pb-8 md:pt-[6.75rem]"
    >
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-2xl border border-lux-gold/60 border-l-[5px] bg-lux-ivory shadow-[0_22px_55px_rgba(7,26,58,0.32)] lg:grid-cols-[9.5rem_minmax(0,1fr)_15.5rem]">
        <div className="flex items-center gap-4 bg-lux-ink px-5 py-4 text-lux-ivory sm:justify-center sm:gap-5 lg:flex-col lg:gap-1 lg:px-4 lg:py-6 lg:text-center">
          <CalendarDays className="h-5 w-5 shrink-0 text-lux-gold" aria-hidden="true" />
          <p className="sr-only">Du 2 au 5 septembre 2026</p>
          <p aria-hidden="true" className="font-fraunces text-4xl leading-none sm:text-5xl">2–5</p>
          <div aria-hidden="true" className="flex items-baseline gap-2 lg:flex-col lg:items-center lg:gap-0">
            <span className="text-sm font-semibold tracking-[0.18em] text-lux-gold-wash">SEPT.</span>
            <span className="text-sm font-medium text-lux-on-dark-muted">2026</span>
          </div>
        </div>

        <div className="px-5 py-5 sm:px-7 sm:py-6 lg:px-8">
          <span className="inline-flex min-h-7 items-center rounded-full border border-lux-evergreen/30 bg-lux-evergreen/10 px-3 py-1 text-xs font-semibold text-lux-evergreen">
            En ce moment
          </span>
          <h2
            className="mt-3 font-fraunces text-2xl leading-tight sm:text-3xl"
            style={{ color: 'var(--color-lux-ink)' }}
          >
            Nexus Réussite au salon B@ck to School 2026
          </h2>
          <p className="mt-2 font-semibold text-lux-ink">Parents, élèves et candidats individuels, venez nous rencontrer</p>
          <p className="mt-3 text-sm leading-6 text-lux-slate">
            Échangez avec notre équipe sur l’accompagnement scolaire à l’année, les stages intensifs, la préparation au Brevet, à l’EAF et au Baccalauréat, et l’accompagnement des candidats individuels.
          </p>

          <ul className="mt-4 grid grid-cols-2 gap-2 text-xs font-medium text-lux-ink sm:flex sm:flex-wrap">
            <li className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-lux-line bg-white px-3"><MapPin className="h-3.5 w-3.5 text-lux-gold-deep" aria-hidden="true" />UTICA — Tunis</li>
            <li className="inline-flex min-h-9 items-center rounded-full border border-lux-line bg-white px-3">Stand N°46</li>
            <li className="inline-flex min-h-9 items-center rounded-full border border-lux-line bg-white px-3">Du 2 au 5 septembre</li>
          </ul>
        </div>

        <div className="grid content-center gap-3 border-t border-lux-line bg-lux-paper px-5 py-5 sm:px-7 lg:border-l lg:border-t-0 lg:px-6">
          <Link
            href="/contact"
            className="lux-cta-reserve inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 py-3 text-center text-sm font-semibold lux-focus"
          >
            Nous rencontrer au stand 46
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
