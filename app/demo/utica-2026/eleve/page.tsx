/**
 * Dashboard Élève (brief §14-§21). Phrase centrale : "Tu sais toujours
 * quelle est ta prochaine étape." Première question : "Qu'est-ce que je
 * dois faire maintenant ?" — pas 15 statistiques.
 */
import { NextBestActionCard } from '@/components/demo/utica-2026/NextBestActionCard';
import { UpcomingEventsList } from '@/components/demo/utica-2026/UpcomingEventsList';
import { TaskBoardCard } from '@/components/demo/utica-2026/TaskBoardCard';
import { SubjectProgressGrid } from '@/components/demo/utica-2026/SubjectProgressGrid';
import { TeacherTeamCard } from '@/components/demo/utica-2026/TeacherTeamCard';
import { WeeklyScheduleGrid } from '@/components/demo/utica-2026/WeeklyScheduleGrid';
import { StudentResourcesCard } from '@/components/demo/utica-2026/StudentResourcesCard';
import { MasteryCard } from '@/components/demo/utica-2026/MasteryCard';
import { LearningEvidenceCard } from '@/components/demo/utica-2026/LearningEvidenceCard';
import { AssessmentTrajectoryCard } from '@/components/demo/utica-2026/AssessmentTrajectoryCard';
import { DocumentVaultCard } from '@/components/demo/utica-2026/DocumentVaultCard';
import {
  describeFocusForStudent,
  getAssessmentTrajectory,
  getCompetencyOverview,
  getDemoDocuments,
  getLearningEvidence,
  getPedagogicalFocus,
  getStudentResources,
  getStudentTasks,
  getSubjectProgress,
  getTeacherTeam,
  getUpcomingEvents,
  getWeeklySchedule,
} from '@/lib/demo/utica-2026/selectors';
import { demoScenario } from '@/lib/demo/utica-2026/scenario';

export default function UticaDemoElevePage() {
  const focus = getPedagogicalFocus();
  const studentDescription = describeFocusForStudent(focus);
  const tasks = getStudentTasks();
  const subjectProgress = getSubjectProgress();
  const teachers = getTeacherTeam();
  const upcoming = getUpcomingEvents().slice(0, 4);
  const schedule = getWeeklySchedule();
  const resources = getStudentResources();
  const mathsTrack = subjectProgress.find((t) => t.subject === focus.subject)!;
  const competencies = getCompetencyOverview(focus.subject);
  const evidence = getLearningEvidence().filter((e) => e.subject === focus.subject);
  const trajectory = getAssessmentTrajectory();
  const documents = getDemoDocuments();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-50">Bonjour {demoScenario.student.firstName}</h1>
        <p className="mt-1 text-sm font-medium text-neutral-400">
          Tu sais toujours quelle est ta prochaine étape.
        </p>
      </div>

      {/* Fold : qu'est-ce que je dois faire maintenant */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NextBestActionCard
            description={studentDescription}
            ctaLabel="Commencer"
            expandedDetail={focus.evidenceSummary}
          />
        </div>
        <UpcomingEventsList title="À venir" events={upcoming} />
      </div>

      <TaskBoardCard today={tasks.today} thisWeek={tasks.thisWeek} completed={tasks.completed} />

      <WeeklyScheduleGrid
        events={schedule}
        heading="Ma semaine"
        subheading="Que dois-je faire, et quand ?"
      />

      <MasteryCard subjectLabel={mathsTrack.label} nextStep={mathsTrack.nextStep} competencies={competencies} />

      <div className="grid gap-4 lg:grid-cols-2">
        <LearningEvidenceCard title="Mes preuves de progression" evidence={evidence} />
        <AssessmentTrajectoryCard steps={trajectory} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">Mes matières</h2>
        <SubjectProgressGrid tracks={subjectProgress} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TeacherTeamCard teachers={teachers} />
        <StudentResourcesCard
          resources={resources.resources}
          recommended={resources.recommended}
          whyRecommended={focus.evidenceSummary}
        />
      </div>

      <DocumentVaultCard documents={documents} />
    </div>
  );
}
