'use client';

import { createContext, useContext } from 'react';

const TimezoneContext = createContext<string>('UTC');

export function EspaceProvider({ timezone, children }: { timezone: string; children: React.ReactNode }) {
  return <TimezoneContext.Provider value={timezone}>{children}</TimezoneContext.Provider>;
}

export function useEspaceTimezone(): string {
  return useContext(TimezoneContext);
}
