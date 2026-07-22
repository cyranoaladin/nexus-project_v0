'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, MapPin, UsersRound } from 'lucide-react';
import { getViewportCategory, track } from '@/lib/analytics';
import type { PreRentreeHomepageSpotlightDTO } from '@/lib/campaigns/pre-rentree-2026/homepage-spotlight';

export function PreRentreeCampaignSpotlight({ campaign }: { campaign: PreRentreeHomepageSpotlightDTO }) {
  const impressionSent = useRef(false);

  useEffect(() => {
    if (impressionSent.current) return;
    impressionSent.current = true;
    track.preRentreeHomeSpotlightView({
      cta_location: 'home_spotlight',
      viewport_category: getViewportCategory(),
      destination: 'campaign_landing',
      campaign_id: campaign.campaignId,
    });
  }, [campaign.campaignId]);

  return (
    <section
      aria-label={campaign.ariaLabel}
      data-testid="pre-rentree-home-spotlight"
      className="relative z-10 bg-lux-ink px-4 pb-6 pt-[5.75rem] sm:px-6 md:pb-8 md:pt-[6.75rem]"
    >
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-2xl border border-lux-gold/60 border-l-[5px] bg-lux-ivory shadow-[0_22px_55px_rgba(7,26,58,0.32)] lg:grid-cols-[9.5rem_minmax(0,1fr)_15.5rem]">
        <div className="flex items-center gap-4 bg-lux-ink px-5 py-4 text-lux-ivory sm:justify-center sm:gap-5 lg:flex-col lg:gap-1 lg:px-4 lg:py-6 lg:text-center">
          <CalendarDays className="h-5 w-5 shrink-0 text-lux-gold" aria-hidden="true" />
          <p className="sr-only">{campaign.date.accessibleLabel}</p>
          <p aria-hidden="true" className="font-fraunces text-4xl leading-none sm:text-5xl">{campaign.date.days}</p>
          <div aria-hidden="true" className="flex items-baseline gap-2 lg:flex-col lg:items-center lg:gap-0">
            <span className="text-sm font-semibold tracking-[0.18em] text-lux-gold-wash">{campaign.date.month}</span>
            <span className="text-sm font-medium text-lux-on-dark-muted">{campaign.date.year}</span>
          </div>
        </div>

        <div className="px-5 py-5 sm:px-7 sm:py-6 lg:px-8">
          <span className="inline-flex min-h-7 items-center rounded-full border border-lux-evergreen/30 bg-lux-evergreen/10 px-3 py-1 text-xs font-semibold text-lux-evergreen">
            {campaign.publicStatus}
          </span>
          <h2
            className="mt-3 font-fraunces text-2xl leading-tight sm:text-3xl"
            style={{ color: 'var(--color-lux-ink)' }}
          >
            {campaign.title}
          </h2>
          <p className="mt-2 font-semibold text-lux-ink">{campaign.entryClassesLabel}</p>
          <p className="mt-2 text-sm font-medium text-lux-gold-deep">{campaign.subjectFamiliesLabel}</p>
          <p className="mt-3 text-sm leading-6 text-lux-slate">{campaign.editorialLine}</p>

          <ul className="mt-4 grid grid-cols-2 gap-2 text-xs font-medium text-lux-ink sm:flex sm:flex-wrap">
            <li className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-lux-line bg-white px-3"><UsersRound className="h-3.5 w-3.5 text-lux-gold-deep" aria-hidden="true" />{campaign.capacityLabel}</li>
            <li className="inline-flex min-h-9 items-center rounded-full border border-lux-line bg-white px-3">{campaign.volumeLabel}</li>
            <li className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-lux-line bg-white px-3"><MapPin className="h-3.5 w-3.5 text-lux-gold-deep" aria-hidden="true" />{campaign.venueLabel}</li>
            <li className="inline-flex min-h-9 items-center rounded-full border border-lux-line bg-white px-3">{campaign.date.chipLabel}</li>
          </ul>
        </div>

        <div className="grid content-center gap-3 border-t border-lux-line bg-lux-paper px-5 py-5 sm:px-7 lg:border-l lg:border-t-0 lg:px-6">
          <Link
            href={campaign.campaignPath}
            onClick={() => track.preRentreeHomeSpotlightClicked({
              cta_location: 'home_spotlight',
              viewport_category: getViewportCategory(),
              destination: 'campaign_landing',
              campaign_id: campaign.campaignId,
            })}
            className="lux-cta-reserve inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 py-3 text-center text-sm font-semibold lux-focus"
          >
            {campaign.primaryCtaLabel}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={campaign.secondaryCtaPath}
            onClick={() => track.preRentreeHomePlanningClicked({
              cta_location: 'home_spotlight',
              viewport_category: getViewportCategory(),
              destination: 'campaign_planning',
              campaign_id: campaign.campaignId,
            })}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-lux-gold/60 bg-white px-4 py-3 text-center text-sm font-semibold text-lux-ink transition-colors hover:bg-lux-gold/10 lux-focus"
          >
            {campaign.secondaryCtaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
