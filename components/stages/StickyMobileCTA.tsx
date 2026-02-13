'use client';

import React, { useState, useEffect } from 'react';
import { analytics } from '@/lib/analytics-stages';

export function StickyMobileCTA() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling 300px
      setIsVisible(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleClick = () => {
    analytics.ctaClick('sticky-mobile', 'Bilan Gratuit');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <a
        href="#reservation"
        onClick={handleClick}
        className="btn-stage-gradient w-full text-center"
        aria-label="Réserver un bilan gratuit"
      >
        📅 Bilan Gratuit
      </a>
    </div>
  );
}
