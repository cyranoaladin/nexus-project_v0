'use client';

import { TrajectoireCard } from '@/components/dashboard/TrajectoireCard';

type EleveTrajectoryProps = {
  studentId?: string | null;
};

export function EleveTrajectory({ studentId }: EleveTrajectoryProps) {
  return (
    <section id="trajectory" aria-labelledby="eleve-trajectory-title">
      <h2 id="eleve-trajectory-title" className="sr-only">Trajectoire</h2>
      <TrajectoireCard studentId={studentId} role="ELEVE" />
    </section>
  );
}
