/**
 * Statuts ARIA affichés dans l'aperçu produit admin-only.
 *
 * Toute valeur ici est DÉRIVÉE des autorités canoniques existantes
 * (`lib/curriculum/catalog`, `lib/aria/manifests/course-capabilities`,
 * `lib/aria/curriculum/skill-graph`) — jamais une liste écrite à la main.
 * Ce module ne fait aucun appel modèle, RAG ou base de données.
 */

import { getAriaCourseCapabilityDeclaration } from '@/lib/aria/manifests/course-capabilities';
import { getSkillGraph } from '@/lib/aria/curriculum/skill-graph';

export type AriaFeatureStatus = 'READY' | 'IN_QUALIFICATION' | 'NOT_CONFIGURED';

export interface CourseAriaSummary {
  readonly courseKey: string;
  readonly skillGraphStatus: AriaFeatureStatus;
  readonly skillGraphCompetencyCount: number | null;
  readonly resourcesStatus: AriaFeatureStatus;
  readonly ragStatus: AriaFeatureStatus;
  readonly ragCorpusId: string | null;
  readonly chatStatus: AriaFeatureStatus;
  readonly chatPolicy: 'GENERAL_CHAT' | 'OPTIONAL_GROUNDING' | 'GROUNDED_REQUIRED' | null;
}

/**
 * Le graphe de compétences est la seule capacité qui peut être "prête" dans cet
 * aperçu : il est compilé statiquement, ne dépend d'aucun runtime ARIA.
 */
function deriveSkillGraphStatus(courseKey: string): { status: AriaFeatureStatus; competencyCount: number | null } {
  const graph = getSkillGraph(courseKey);
  if (!graph) return { status: 'NOT_CONFIGURED', competencyCount: null };
  return { status: 'READY', competencyCount: graph.totalCompetencies };
}

/**
 * RAG et Chat ne sont JAMAIS "READY" dans cet aperçu, même quand le manifeste
 * de capacités déclare une liaison de corpus : la qualification runtime (RAG
 * canonique + modèle) n'est pas terminée. Voir TRACK B.
 */
function deriveRagAndChatStatus(courseKey: string): Pick<
  CourseAriaSummary,
  'resourcesStatus' | 'ragStatus' | 'ragCorpusId' | 'chatStatus' | 'chatPolicy'
> {
  const declaration = getAriaCourseCapabilityDeclaration(courseKey);
  if (!declaration) {
    return {
      resourcesStatus: 'NOT_CONFIGURED',
      ragStatus: 'NOT_CONFIGURED',
      ragCorpusId: null,
      chatStatus: 'NOT_CONFIGURED',
      chatPolicy: null,
    };
  }

  const chat = declaration.chat;
  const corpusId = chat?.corpusBindings[0]?.corpusId ?? null;

  return {
    // La déclaration existe et est versionnée : la configuration ARIA de base
    // est réelle, même si RAG/Chat restent en qualification.
    resourcesStatus: 'READY',
    ragStatus: corpusId ? 'IN_QUALIFICATION' : 'NOT_CONFIGURED',
    ragCorpusId: corpusId,
    chatStatus: chat ? 'IN_QUALIFICATION' : 'NOT_CONFIGURED',
    chatPolicy: chat?.policy ?? null,
  };
}

export function getCourseAriaSummary(courseKey: string): CourseAriaSummary {
  const skillGraph = deriveSkillGraphStatus(courseKey);
  const ragAndChat = deriveRagAndChatStatus(courseKey);

  return {
    courseKey,
    skillGraphStatus: skillGraph.status,
    skillGraphCompetencyCount: skillGraph.competencyCount,
    ...ragAndChat,
  };
}
