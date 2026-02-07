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
        className="block w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center py-4 px-6 font-black text-lg shadow-2xl hover:from-blue-700 hover:to-purple-700 transition-all"
        aria-label="Réserver un bilan gratuit"
      >
        📅 Bilan Gratuit
      </a>
    </div>
  );
}
