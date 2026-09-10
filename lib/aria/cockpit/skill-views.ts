/**
 * ARIA Cockpit — vues dérivées des graphes de compétences.
 *
 * Adapte le module CANONIQUE `lib/aria/curriculum/skill-graph.ts` (point
 * d'accès unique, déjà utilisé par le pipeline de prompt du moteur de
 * conversation — `lib/aria/application/conversation/build-context.ts` et
 * `build-prompt.ts`) vers la projection plate que le cockpit expose dans son
 * DTO. Le module canonique n'est jamais modifié ici.
 *
 * ── Pourquoi une table de correspondance ────────────────────────────────────
 * Le module canonique indexe ses graphes par une clé de registre propre
 * (`eds-maths-premiere`, `stmg-sgn-premiere`, …) héritée du nom des fichiers
 * `*.domains.json`. Le catalogue de cours du cockpit (`curriculum/catalog.ts`)
 * indexe ses cours par une clé produit différente (`maths-premiere-eds`,
 * `sgn-premiere-stmg`, …). Les deux clés désignent exactement le même cours
 * — la correspondance ci-dessous est une bijection 1:1 vérifiée contre les 8
 * entrées du registre canonique ; aucun cours du catalogue n'a besoin de
 * plus d'une définition de graphe de compétences.
 */

import 'server-only';

import {
  getSkillGraph as getCanonicalSkillGraph,
} from '@/lib/aria/curriculum/skill-graph';
import { getAriaCourse } from '@/lib/aria/curriculum/catalog';
import type {
  AriaCompetency,
  AriaCourseKey,
  AriaDomain,
  AriaSkillGraph,
  AriaSkillGraphSummary,
} from '@/lib/aria/cockpit/contracts';

const COURSE_KEY_TO_CANONICAL_REGISTRY_KEY: Readonly<Record<string, string>> = Object.freeze({
  'maths-premiere-eds': 'eds-maths-premiere',
  'maths-terminale-eds': 'eds-maths-terminale',
  'nsi-premiere-eds': 'eds-nsi-premiere',
  'nsi-terminale-eds': 'eds-nsi-terminale',
  'maths-premiere-stmg': 'stmg-maths-premiere',
  'sgn-premiere-stmg': 'stmg-sgn-premiere',
  'management-premiere-stmg': 'stmg-management-premiere',
  'droit-eco-premiere-stmg': 'stmg-droit-eco-premiere',
});

/**
 * `lookupCanonicalSkillGraph` defaults to the real canonical module and is
 * only ever overridden in tests: the course↔registry-key map is a verified
 * 1:1 bijection against the real canonical registry (see module docstring),
 * so neither guard below can be reached through real data without this seam
 * — mirroring the same injectable-mapper pattern used in
 * `lib/aria/n4b/import-resource-registry.ts` for its own unreachable-in-
 * practice AMBIGUOUS branch.
 */
export function adaptSkillGraph(
  courseKey: AriaCourseKey,
  definitionKey: string,
  lookupCanonicalSkillGraph: typeof getCanonicalSkillGraph = getCanonicalSkillGraph,
): AriaSkillGraph | null {
  const registryKey = COURSE_KEY_TO_CANONICAL_REGISTRY_KEY[courseKey];
  if (!registryKey) return null;

  const source = lookupCanonicalSkillGraph(registryKey);
  if (!source) return null;

  const domains: AriaDomain[] = [];
  const competencies: AriaCompetency[] = [];

  for (const domain of source.domains) {
    domains.push({
      id: domain.id,
      domainId: domain.rawDomainId,
      label: domain.label,
      competencyCount: domain.competencies.length,
    });
    for (const competency of domain.competencies) {
      competencies.push({
        id: competency.id,
        skillId: competency.rawSkillId,
        label: competency.label,
        domainId: domain.rawDomainId,
        chapterId: competency.chapterId ?? null,
        prerequisite: competency.prerequisite === true,
      });
    }
  }

  return {
    courseKey,
    definitionKey,
    version: null,
    domains,
    competencies,
  };
}

/**
 * Graphe de compétences complet d'un cours, projeté pour le cockpit.
 *
 * Résout le `definitionKey` en interne via le catalogue (`AriaCourse`,
 * type interne) plutôt que de l'exiger de l'appelant : la projection
 * publique `AriaCourseProjection` n'expose délibérément que `hasSkillGraph`,
 * pas le `definitionKey` brut — ce n'est pas un oubli à combler côté appelant.
 */
export function getCockpitSkillGraph(courseKey: AriaCourseKey): AriaSkillGraph | null {
  const course = getAriaCourse(courseKey);
  if (!course?.definitionKey) return null;
  return adaptSkillGraph(courseKey, course.definitionKey);
}

/** Résumé non sensible d'un skill graph, exposable par l'API curriculum. */
export function getCockpitSkillGraphSummary(courseKey: AriaCourseKey): AriaSkillGraphSummary {
  const graph = getCockpitSkillGraph(courseKey);
  if (!graph) {
    return {
      courseKey,
      available: false,
      domainCount: 0,
      competencyCount: 0,
      version: null,
    };
  }
  return {
    courseKey: graph.courseKey,
    available: true,
    domainCount: graph.domains.length,
    competencyCount: graph.competencies.length,
    version: graph.version,
  };
}
