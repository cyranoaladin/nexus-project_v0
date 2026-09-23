'use client';

import { EmptyState } from './EmptyState';

/** État neutre pour une projection que cette autorité ne calcule pas encore. */
export function CapabilityUnavailable() {
  return <EmptyState title="Fonction non encore disponible pour ce profil" />;
}
