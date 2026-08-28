/**
 * Sélecteurs de ressources du cockpit ARIA.
 *
 * ── Règle ────────────────────────────────────────────────────────────────────
 * ARIA ne possède AUCUN catalogue de documents. Toutes les ressources
 * proviennent du Hub élève déjà construit par `buildHub()`
 * (`lib/dashboard/student-payload.ts`). Ce module ne fait que FILTRER et
 * RATTACHER ces ressources aux cours du catalogue curriculum.
 *
 * La catégorie `RAG_REFERENCE` reste volontairement vide : les sources
 * réellement consultées par ARIA ne sont pas encore persistées (le modèle
 * `AriaMessage` ne stocke aucune citation). Fabriquer des références ici
 * serait une citation inventée. Voir la roadmap P1.
 */

import type { EleveHub, EleveHubResource } from '@/components/dashboard/eleve/types';
import type { AriaCourseKey, AriaResourceDTO } from '@/lib/aria/contracts';
import { getAriaCourse, listAriaCourses } from '@/lib/aria/curriculum/catalog';

/** Catégories jamais exposées dans le cockpit (facturation, non pédagogique). */
const EXCLUDED_CATEGORIES = new Set(['INVOICE', 'RECEIPT']);

/**
 * Catégorie dont le contenu n'est pas encore réellement alimenté.
 * Conservée dans le type pour la roadmap, mais jamais remplie en P0.
 */
export const RAG_REFERENCE_CATEGORY = 'RAG_REFERENCE';

function flattenHub(hub: EleveHub): EleveHubResource[] {
  return Object.entries(hub.byCategory)
    .filter(([category]) => !EXCLUDED_CATEGORIES.has(category))
    .flatMap(([, resources]) => resources);
}

/**
 * Cours auxquels une ressource du Hub se rattache.
 *
 * Deux règles, dans cet ordre :
 *  1. rattachement EXPLICITE par identifiant (`course.hubResourceIds`) — seule
 *     façon fiable de distinguer les modules STMG, qui partagent tous la
 *     matière `SES` ;
 *  2. rattachement par matière, uniquement pour les cours dont la matière
 *     n'est PAS une approximation. Sans cette réserve, une ressource SES
 *     serait attribuée simultanément à SGN, Management et Droit-Économie.
 */
function courseKeysForResource(
  resource: EleveHubResource,
  candidateCourseKeys: readonly AriaCourseKey[],
): AriaCourseKey[] {
  const matched: AriaCourseKey[] = [];

  for (const key of candidateCourseKeys) {
    const course = getAriaCourse(key);
    if (!course) continue;

    if (course.hubResourceIds.includes(resource.id)) {
      matched.push(key);
      continue;
    }

    if (
      resource.subject &&
      course.chatSubject === resource.subject &&
      !course.support.capabilities.chatSubjectIsApproximate
    ) {
      matched.push(key);
    }
  }

  return matched;
}

function toDTO(resource: EleveHubResource, courseKeys: AriaCourseKey[]): AriaResourceDTO {
  return {
    id: resource.id,
    title: resource.title,
    subtitle: resource.subtitle,
    category: resource.category,
    type: resource.type,
    href: resource.externalUrl ?? resource.downloadUrl,
    badge: resource.badge,
    courseKeys,
  };
}

/**
 * Projette le Hub en ressources du cockpit, chacune annotée des cours
 * auxquels elle se rattache. Les ressources non rattachables restent
 * présentes avec `courseKeys: []` : elles sont réelles, on ne les cache pas.
 */
export function projectHubResources(
  hub: EleveHub,
  candidateCourseKeys: readonly AriaCourseKey[],
): AriaResourceDTO[] {
  return flattenHub(hub).map((resource) =>
    toDTO(resource, courseKeysForResource(resource, candidateCourseKeys)),
  );
}

/** Ressources du Hub rattachées à un cours donné. Jamais d'invention. */
export function resourcesForCourse(
  hub: EleveHub,
  courseKey: AriaCourseKey,
): AriaResourceDTO[] {
  const course = getAriaCourse(courseKey);
  if (!course) return [];

  return flattenHub(hub)
    .map((resource) => toDTO(resource, courseKeysForResource(resource, [courseKey])))
    .filter((dto) => dto.courseKeys.length > 0);
}

/**
 * Sous-ensemble mis en avant pour un cours.
 *
 * P0 n'applique AUCUN classement « intelligent » : la priorité suit
 * l'ordre éditorial déjà porté par le Hub (programme interactif, puis
 * ressources officielles, puis apports du coach), tronqué à `limit`.
 * Aucune recommandation générée par IA.
 */
export function recommendedResourcesForCourse(
  hub: EleveHub,
  courseKey: AriaCourseKey,
  limit = 3,
): AriaResourceDTO[] {
  const priority = [
    'INTERACTIVE_PROGRAM',
    'OFFICIAL_PROGRAM',
    'OFFICIAL_AUTOMATISMES',
    'OFFICIAL_SUJET',
    'COACH_RESOURCE',
    'STAGE_BILAN',
    'USER_DOCUMENT',
  ];

  return resourcesForCourse(hub, courseKey)
    .slice()
    .sort((a, b) => {
      const ia = priority.indexOf(a.category);
      const ib = priority.indexOf(b.category);
      return (ia === -1 ? priority.length : ia) - (ib === -1 ? priority.length : ib);
    })
    .slice(0, Math.max(0, limit));
}

/** Toutes les clés de cours du catalogue — utilisé pour un rattachement large. */
export function allCourseKeys(): readonly AriaCourseKey[] {
  return listAriaCourses().map((course) => course.key);
}
