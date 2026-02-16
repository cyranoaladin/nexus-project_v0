'use client';

import { NexusIndexCard } from './NexusIndexCard';
import { NextStepCard } from './NextStepCard';
import { EvolutionCard } from './EvolutionCard';
import { TrajectoireCard } from './TrajectoireCard';

/**
 * DashboardPilotage — Strategic dashboard layout with 3 zones.
 *
 * Zone 1: Vision globale (Nexus Index + Trajectoire)
 * Zone 2: Prochaine action (NextStepCard)
 * Zone 3: Indicateurs clés (Evolution)
 *
 * This component is role-aware: it renders the pilotage view
 * for ELEVE and PARENT roles. Other roles get their existing dashboards.
 *
 * @param children - Role-specific dashboard content rendered below the pilotage zone
 */

interface DashboardPilotageProps {
  children?: React.ReactNode;
}

export function DashboardPilotage({ children }: DashboardPilotageProps) {
  return (
    <div className="space-y-6">
      {/* Zone 2: Prochaine action — Always on top for immediate guidance */}
      <section aria-label="Prochaine action">
        <NextStepCard />
      </section>

      {/* Zone 1 + Zone 3: Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Zone 1: Vision globale (left column, 1/3 width) */}
        <section aria-label="Vision globale" className="space-y-6">
          <NexusIndexCard />
          <TrajectoireCard />
        </section>

        {/* Zone 3: Indicateurs clés (right column, 2/3 width) */}
        <section aria-label="Indicateurs clés" className="lg:col-span-2 space-y-6">
          <EvolutionCard />
          {/* Role-specific content */}
          {children}
        </section>
      </div>
    </div>
  );
}
