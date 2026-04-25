'use client';

import { TrajectoireCard, type TrajectoireDataProp } from '@/components/dashboard/TrajectoireCard';

type EleveTrajectoryProps = {
  trajectory: TrajectoireDataProp;
};

/**
 * EleveTrajectory — wraps TrajectoireCard in data mode (SSoT: payload-driven, no internal fetch).
 */
export function EleveTrajectory({ trajectory }: EleveTrajectoryProps) {
  return (
    <section id="trajectory" aria-labelledby="eleve-trajectory-title">
      <h2 id="eleve-trajectory-title" className="sr-only">Trajectoire</h2>
      <TrajectoireCard data={trajectory} role="ELEVE" />
    </section>
  );
}
