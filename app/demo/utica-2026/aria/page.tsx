/**
 * Dashboard ARIA scénarisé (brief §22-§27). Phrase centrale : "Ton travail
 * autonome reste structuré entre deux séances." 100 % scénarisé, hors
 * ligne : aucun appel au vrai moteur ARIA/OpenAI/RAG (amendements A6/A7).
 */
import { AriaObjectiveCard } from '@/components/demo/utica-2026/AriaObjectiveCard';
import { AriaCycleTimeline } from '@/components/demo/utica-2026/AriaCycleTimeline';
import { AriaWeeklyPath } from '@/components/demo/utica-2026/AriaWeeklyPath';
import { AriaResourceCockpit } from '@/components/demo/utica-2026/AriaResourceCockpit';
import { NexusInterventionsList } from '@/components/demo/utica-2026/NexusInterventionsList';
import {
  describeFocusForAria,
  getLearningEvidence,
  getNexusInterventions,
  getPedagogicalFocus,
  getTeacherTeam,
} from '@/lib/demo/utica-2026/selectors';
import { getRecommendedCatalogResource, getResourceById } from '@/lib/demo/utica-2026/resources';

/** Parcours proposés dans cet exemple (P3 §15) — sélection fixe, jamais un moteur de recommandation. */
const EXAMPLE_PATH_IDS = ['maths-b3-derivation', 'nsi-programme-structures-donnees', 'maths-checklist-etude-fonction'];

export default async function UticaDemoAriaPage({
  searchParams,
}: {
  searchParams: Promise<{ resource?: string }>;
}) {
  const { resource: resourceIdParam } = await searchParams;
  // Allowlist stricte (P3 §13/§32) : un id inconnu retombe simplement sur la
  // ressource recommandée, jamais une erreur ni une lecture arbitraire.
  const activeResource = (resourceIdParam ? getResourceById(resourceIdParam) : undefined) ?? getRecommendedCatalogResource();
  const alternativeResources = EXAMPLE_PATH_IDS.map((id) => getResourceById(id)).filter(
    (r): r is NonNullable<typeof r> => !!r && r.id !== activeResource.id,
  );

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

      <AriaResourceCockpit resource={activeResource} alternatives={alternativeResources} />

      <AriaCycleTimeline activeIndex={1} />

      <AriaWeeklyPath focus={focus} teacherFirstName={focusTeacher?.firstName ?? 'ton enseignant Nexus'} />

      <NexusInterventionsList title="Mon journal d'apprentissage" interventions={journal} />
    </div>
  );
}
