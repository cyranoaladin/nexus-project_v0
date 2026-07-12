'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics';

export function CampaignPageTracker() {
  useEffect(() => {
    track.preRentreePageView();
  }, []);
  return null;
}
