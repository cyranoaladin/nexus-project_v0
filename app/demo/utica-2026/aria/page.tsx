/**
 * Dashboard ARIA scénarisé (brief §22-§27). Phrase centrale : "Ton travail
 * autonome reste structuré entre deux séances." 100 % scénarisé, hors
 * ligne : aucun appel au vrai moteur ARIA/OpenAI/RAG (amendements A6/A7).
 */
import { AriaObjectiveCard } from '@/components/demo/utica-2026/AriaObjectiveCard';
import { AriaCycleTimeline } from '@/components/demo/utica-2026/AriaCycleTimeline';
import { AriaWeeklyPath } from '@/components/demo/utica-2026/AriaWeeklyPath';
import { NexusInterventionsList } from '@/components/demo/utica-2026/NexusInterventionsList';
import {
  describeFocusForAria,
  getLearningEvidence,
  getNexusInterventions,
  getPedagogicalFocus,
  getTeacherTeam,
} from '@/lib/demo/utica-2026/selectors';

export default function UticaDemoAriaPage() {
  const focus = getPedagogicalFocus();
  const ariaDescription = describeFocusForAria(focus);
  const teachers = getTeacherTeam();
  const focusTeacher = teachers.find((t) => t.subject === focus.subject);
  const journal = getNexusInterventions('ARIA');
  const [fragileEvidence] = getLearningEvidence(focus.fragileCompetencyId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-50">Ton parcours autonome</h1>
        <p className="mt-1 text-sm font-medium text-neutral-400">
          Ton travail autonome reste structuré entre deux séances.
        </p>
      </div>

      {/* Fold : comment Nexus accompagne en autonomie */}
      <AriaObjectiveCard
        focus={focus}
        description={ariaDescription}
        evidenceReference={fragileEvidence ? { dateLabel: fragileEvidence.dateLabel, label: fragileEvidence.label } : null}
      />

      <AriaCycleTimeline activeIndex={1} />

      <AriaWeeklyPath focus={focus} teacherFirstName={focusTeacher?.firstName ?? 'ton enseignant Nexus'} />

      <NexusInterventionsList title="Mon journal d'apprentissage" interventions={journal} />
    </div>
  );
}
