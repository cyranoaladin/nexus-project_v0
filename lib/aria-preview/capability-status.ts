/**
 * Statuts ARIA affichés dans l'aperçu produit admin-only.
 *
 * Toute valeur ici est DÉRIVÉE des autorités canoniques existantes
 * (`lib/curriculum/catalog`, `lib/aria/manifests/course-capabilities`,
 * `lib/aria/manifests/resource-registry`, `lib/aria/curriculum/skill-graph`)
 * — jamais une liste écrite à la main. Ce module ne fait aucun appel modèle,
 * RAG ou base de données.
 */

import { getAriaCourseCapabilityDeclaration } from '@/lib/aria/manifests/course-capabilities';
import { listActiveAriaResourceRecords } from '@/lib/aria/manifests/resource-registry';
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
 * "Ressources" reflète le registre de ressources actif, PAS la simple
 * présence d'une déclaration de capacité : un cours peut être déclaré dans
 * `course-capabilities.v1.json` sans avoir la moindre ressource active
 * (ex. `stmg-maths-premiere`), ce qui ne doit jamais s'afficher "Prêt".
 *
 * "Prêt" ici affirme UNIQUEMENT une identité canonique de ressource dans le
 * registre — jamais, par elle seule, que le contenu est téléchargeable
 * localement, que le RAG est joignable, ou que le chat est fonctionnel
 * (Nexus Resource Registry v2, storage-aware) : une ressource
 * `RAG_GOVERNED` compte ici exactement comme une ressource
 * `NEXUS_REPOSITORY`, et ces trois capacités restent gouvernées par leurs
 * propres portes runtime indépendantes (`hasChat`, `hasRagCorpus`, l'aperçu
 * `ragStatus`/`chatStatus` ci-dessous).
 */
function deriveResourcesStatus(courseKey: string): AriaFeatureStatus {
  const hasActiveResource = listActiveAriaResourceRecords().some(
    (record) => record.placements.some((placement) => placement.courseKey === courseKey),
  );
  return hasActiveResource ? 'READY' : 'NOT_CONFIGURED';
}

/**
 * RAG et Chat ne sont JAMAIS "READY" dans cet aperçu, même quand le manifeste
 * de capacités déclare une liaison de corpus : la qualification runtime (RAG
 * canonique + modèle) n'est pas terminée. Voir TRACK B.
 */
function deriveRagAndChatStatus(courseKey: string): Pick<
  CourseAriaSummary,
  'ragStatus' | 'ragCorpusId' | 'chatStatus' | 'chatPolicy'
> {
  const declaration = getAriaCourseCapabilityDeclaration(courseKey);
  if (!declaration) {
    return { ragStatus: 'NOT_CONFIGURED', ragCorpusId: null, chatStatus: 'NOT_CONFIGURED', chatPolicy: null };
  }

  const chat = declaration.chat;
  const corpusId = chat?.corpusBindings[0]?.corpusId ?? null;

  return {
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
    resourcesStatus: deriveResourcesStatus(courseKey),
    ...ragAndChat,
  };
}
