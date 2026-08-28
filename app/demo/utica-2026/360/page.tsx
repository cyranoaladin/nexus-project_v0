/**
 * Vue 360° du parcours (P1A) — synthèse du système Nexus Réussite, pas un
 * quatrième dashboard générique. Toutes les données dérivent de
 * demoScenario + selectors (amendement A3) ; les jalons officiels
 * proviennent exclusivement du référentiel réglementaire réel (amendement A5).
 */
import { StatusBanner } from '@/components/demo/utica-2026/StatusBanner';
import { JourneyPriorityHero } from '@/components/demo/utica-2026/JourneyPriorityHero';
import { JourneyDimensionsGrid } from '@/components/demo/utica-2026/JourneyDimensionsGrid';
import { NexusPulseCard } from '@/components/demo/utica-2026/NexusPulseCard';
import { Journey360Timeline } from '@/components/demo/utica-2026/Journey360Timeline';
import {
  getJourneyMilestones,
  getJourneyOverview,
  getJourneyPriority,
  getNexusPulse,
  getNextJourneyMilestone,
} from '@/lib/demo/utica-2026/selectors';
import { getDemoRegulatoryMilestones } from '@/lib/demo/utica-2026/regulatory';
import { demoScenario } from '@/lib/demo/utica-2026/scenario';

export default function UticaDemo360Page() {
  const priority = getJourneyPriority();
  const dimensions = getJourneyOverview();
  const pulse = getNexusPulse();
  const milestones = getJourneyMilestones();
  const nextMilestone = getNextJourneyMilestone();
  const regulatoryMilestones = getDemoRegulatoryMilestones();

  return (
    <div className="space-y-6">
      <StatusBanner
        student={demoScenario.student}
        centralLine="Un seul parcours. Une vision complète."
        subtitle="Cours, progression, organisation, administratif et autonomie réunis dans un même pilotage."
      />

      {/* Niveau 1 : priorité actuelle */}
      <JourneyPriorityHero priority={priority} />

      {/* Niveau 2 : les 4 dimensions */}
      <JourneyDimensionsGrid dimensions={dimensions} />

      {/* Niveau 3 : Nexus Pulse */}
      <NexusPulseCard pulse={pulse} />

      {/* Niveau 4 : timeline / détails */}
      <Journey360Timeline
        milestones={milestones}
        regulatoryMilestones={regulatoryMilestones.value}
        sourceLabel={regulatoryMilestones.sourceLabel ?? ''}
        nextMilestoneLabel={nextMilestone?.label}
      />
    </div>
  );
}
