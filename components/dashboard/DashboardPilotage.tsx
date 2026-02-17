'use client';

import { NexusIndexCard } from './NexusIndexCard';
import { NextStepCard } from './NextStepCard';
import { EvolutionCard } from './EvolutionCard';
import { TrajectoireCard } from './TrajectoireCard';
import { CoachOverviewCard } from './CoachOverviewCard';
import { OperationsCard } from './OperationsCard';
import { CapActuelCard } from './CapActuelCard';
import { SynthesisCard } from './SynthesisCard';

/**
 * DashboardPilotage — Strategic dashboard layout.
 *
 * Structure (top → bottom):
 * 1. Hero signature (role-specific tagline)
 * 2. Cap actuel (trajectory direction — student roles)
 * 3. Action prioritaire (NextStepCard — dominant, all roles)
 * 4. Vision + Indicateurs (two-column: NexusIndex | Evolution + Synthesis)
 * 5. Role-specific children
 */

export type DashboardRole = 'ELEVE' | 'PARENT' | 'COACH' | 'ASSISTANTE' | 'ADMIN';

// ─── Hero copy per role ──────────────────────────────────────────────────────

const HERO_COPY: Record<DashboardRole, { title: string; subtitle: string }> = {
  ELEVE: {
    title: 'Pilotez votre trajectoire.',
    subtitle: 'Progression mesurée. Cap structuré. Actions prioritaires.',
  },
  PARENT: {
    title: 'Suivez la trajectoire de votre enfant.',
    subtitle: 'Clarté. Vision. Décisions éclairées.',
  },
  COACH: {
    title: 'Structurez l\u2019accompagnement.',
    subtitle: 'Suivi. Anticipation. Impact.',
  },
  ASSISTANTE: {
    title: 'Pilotez les flux.',
    subtitle: 'Clarté opérationnelle. Priorités structurées.',
  },
  ADMIN: {
    title: 'Supervision stratégique.',
    subtitle: 'Vue globale. Cohérence. Maîtrise.',
  },
};

interface DashboardPilotageProps {
  /** User role for conditional rendering */
  role: DashboardRole;
  /** Student ID for scoped data (parent multi-children) */
  studentId?: string | null;
  /** Role-specific content rendered below the pilotage zone */
  children?: React.ReactNode;
}

export function DashboardPilotage({ role, studentId, children }: DashboardPilotageProps) {
  const showStudentPilotage = role === 'ELEVE' || role === 'PARENT';
  const showCoachPilotage = role === 'COACH';
  const showOperationsPilotage = role === 'ASSISTANTE';
  const hero = HERO_COPY[role];

  return (
    <div className="space-y-6">
      {/* Hero signature — role-specific */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-100">{hero.title}</h2>
        <p className="text-xs text-neutral-500">{hero.subtitle}</p>
      </div>

      {/* Cap actuel — student roles only */}
      {showStudentPilotage && (
        <section aria-label="Cap actuel">
          <CapActuelCard studentId={studentId} />
        </section>
      )}

      {/* Action prioritaire — dominant, all roles */}
      <section aria-label="Action prioritaire">
        <NextStepCard />
      </section>

      {/* Vision + Indicateurs: two-column layout */}
      {(showStudentPilotage || showCoachPilotage || showOperationsPilotage) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Zone 1: Vision globale (left column, 1/3 width) */}
          <section aria-label="Vision globale" className="space-y-6">
            {showStudentPilotage && (
              <>
                <NexusIndexCard studentId={studentId} />
                <TrajectoireCard studentId={studentId} role={role} />
              </>
            )}
            {showCoachPilotage && <CoachOverviewCard />}
            {showOperationsPilotage && <OperationsCard />}
          </section>

          {/* Zone 3: Indicateurs clés (right column, 2/3 width) */}
          <section aria-label="Indicateurs clés" className="lg:col-span-2 space-y-6">
            {showStudentPilotage && (
              <>
                <EvolutionCard studentId={studentId} />
                <SynthesisCard studentId={studentId} role={role} />
              </>
            )}
            {(showCoachPilotage || showOperationsPilotage) && (
              <SynthesisCard role={role} />
            )}
            {children}
          </section>
        </div>
      )}

      {/* Admin: synthesis + children below NextStep */}
      {role === 'ADMIN' && (
        <div className="space-y-6">
          <SynthesisCard role={role} />
          {children}
        </div>
      )}
    </div>
  );
}
