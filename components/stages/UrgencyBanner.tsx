'use client';

import React from 'react';
import { analytics } from '@/lib/analytics-stages';

interface UrgencyBannerProps {
  closingDate: string;
}

export function UrgencyBanner({ closingDate }: UrgencyBannerProps) {
  const handleCTAClick = () => {
    analytics.ctaClick('urgency-banner', 'Réserver une consultation gratuite');
  };

  return (
    <div className="sticky top-0 z-[60] bg-gradient-to-r from-slate-900 to-blue-900 text-white py-3 px-4 shadow-lg">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="animate-pulse">●</span>
          <span>STAGES FÉVRIER 2026 • Inscriptions ouvertes jusqu'au {closingDate}</span>
        </div>
        <a
          href="#reservation"
          onClick={handleCTAClick}
          className="btn-outline-strong whitespace-nowrap"
          aria-label="Réserver une consultation gratuite"
        >
          Réserver une consultation gratuite
        </a>
      </div>
    </div>
  );
}
