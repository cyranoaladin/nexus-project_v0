'use client';

import { useEffect, useRef } from 'react';
import { track } from '@/lib/analytics';

export function CampaignPageTracker() {
  const pageViewSent = useRef(false);

  useEffect(() => {
    if (pageViewSent.current) return;
    pageViewSent.current = true;
    track.preRentreePageView();
  }, []);
  return null;
}
