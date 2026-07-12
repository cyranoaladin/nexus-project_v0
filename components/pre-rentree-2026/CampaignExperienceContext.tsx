'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { EntryLevelCode } from '@/lib/campaigns/pre-rentree-2026/schema';

interface CampaignExperienceValue {
  configuredEntryLevel: EntryLevelCode | null;
  setConfiguredEntryLevel: (level: EntryLevelCode) => void;
}

const noopSetEntryLevel = (_level: EntryLevelCode) => undefined;

const CampaignExperienceContext = createContext<CampaignExperienceValue>({
  configuredEntryLevel: null,
  setConfiguredEntryLevel: noopSetEntryLevel,
});

export function CampaignExperienceProvider({ children }: { children: ReactNode }) {
  const [configuredEntryLevel, setConfiguredEntryLevel] = useState<EntryLevelCode | null>(null);
  const value = useMemo(
    () => ({ configuredEntryLevel, setConfiguredEntryLevel }),
    [configuredEntryLevel],
  );
  return (
    <CampaignExperienceContext.Provider value={value}>
      {children}
    </CampaignExperienceContext.Provider>
  );
}

export function useCampaignExperience(): CampaignExperienceValue {
  return useContext(CampaignExperienceContext);
}
