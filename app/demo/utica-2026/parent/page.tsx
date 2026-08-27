/**
 * Dashboard Parent (brief §4-§13). Phrase centrale : "Vous gardez une vision
 * claire de tout son parcours." Toutes les données viennent des selectors
 * dérivés (amendement A3) — aucun chiffre recalculé ici.
 */
import { StatusBanner } from '@/components/demo/utica-2026/StatusBanner';
import { WeeklySnapshotCard } from '@/components/demo/utica-2026/WeeklySnapshotCard';
import { NextBestActionCard } from '@/components/demo/utica-2026/NextBestActionCard';
import { AdministrativeSummaryCard } from '@/components/demo/utica-2026/AdministrativeSummaryCard';
import { SubjectProgressGrid } from '@/components/demo/utica-2026/SubjectProgressGrid';
import { TeacherTeamCard } from '@/components/demo/utica-2026/TeacherTeamCard';
import { BacMapCard } from '@/components/demo/utica-2026/BacMapCard';
import { WeeklyScheduleGrid } from '@/components/demo/utica-2026/WeeklyScheduleGrid';
import { AdministrativeCockpitCard } from '@/components/demo/utica-2026/AdministrativeCockpitCard';
import { NexusInterventionsList } from '@/components/demo/utica-2026/NexusInterventionsList';
import { UpcomingEventsList } from '@/components/demo/utica-2026/UpcomingEventsList';
import { NexusPulseCard } from '@/components/demo/utica-2026/NexusPulseCard';
import { MasteryCard } from '@/components/demo/utica-2026/MasteryCard';
import {
  describeFocusForParent,
  getAdministrativeSummary,
  getCompetencyOverview,
  getNexusInterventions,
  getNexusPulse,
  getPedagogicalFocus,
  getSubjectProgress,
  getTeacherTeam,
  getUpcomingEvents,
  getWeeklySchedule,
  getWeeklySnapshot,
} from '@/lib/demo/utica-2026/selectors';
import { getDemoBacMap } from '@/lib/demo/utica-2026/regulatory';
import { demoScenario } from '@/lib/demo/utica-2026/scenario';

export default function UticaDemoParentPage() {
  const focus = getPedagogicalFocus();
  const parentDescription = describeFocusForParent(focus);
  const weeklySnapshot = getWeeklySnapshot();
  const administrative = getAdministrativeSummary();
  const subjectProgress = getSubjectProgress();
  const teachers = getTeacherTeam();
  const bacMap = getDemoBacMap();
  const schedule = getWeeklySchedule();
  const interventions = getNexusInterventions('EQUIPE_NEXUS');
  const upcoming = getUpcomingEvents();
  const pulse = getNexusPulse();
  const mathsTrack = subjectProgress.find((t) => t.subject === focus.subject)!;
  const competencies = getCompetencyOverview(focus.subject);

  return (
    <div className="space-y-6">
      <StatusBanner student={demoScenario.student} centralLine="Vous gardez une vision claire de tout son parcours." />

      {/* Fold : où en est mon enfant, sur quoi Nexus agit, dossier sous contrôle */}
      <div className="grid gap-4 lg:grid-cols-3">
        <WeeklySnapshotCard snapshot={weeklySnapshot} />
        <NextBestActionCard
          description={parentDescription}
          ctaLabel="Voir le détail"
          expandedDetail={focus.evidenceSummary}
          accent="parent"
        />
        <AdministrativeSummaryCard items={administrative.items} blockingCount={administrative.administrativeBlockingCount} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Progression par matière
          </h2>
          <SubjectProgressGrid tracks={subjectProgress} />
        </div>
        <TeacherTeamCard teachers={teachers} />
      </div>

      <BacMapCard sections={bacMap.value} sourceLabel={bacMap.sourceLabel ?? ''} />

      <WeeklyScheduleGrid
        events={schedule}
        heading="Comment la semaine est organisée"
        subheading="Cours Nexus, travail personnel et échéances, au même endroit."
      />

      <MasteryCard subjectLabel={mathsTrack.label} nextStep={mathsTrack.nextStep} competencies={competencies} />

      <AdministrativeCockpitCard summary={administrative} />

      <div className="grid gap-4 lg:grid-cols-2">
        <UpcomingEventsList title="Prochains rendez-vous" events={upcoming} />
        <NexusInterventionsList title="Ce que Nexus a fait récemment" interventions={interventions} />
      </div>

      <NexusPulseCard pulse={pulse} />
    </div>
  );
}
