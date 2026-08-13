import { SEVERITY_RANK } from './constants';
import { computeDomainScores } from './domain-scores';
import type {
  GroupBand,
  NodeProfile,
  NodeResult,
  ResultFlag,
  ScoringOutput,
} from './types';

export type FactSheet = Readonly<{
  engineVersion: string;
  bankSlug: string;
  bankVersion: number;
  student: Readonly<{ alias: string; level: string }>;
  globalScore: number;
  /** Proportion d'items traites dans cette passation. Ce n'est pas une couverture de programme. */
  coverage: number;
  calibrationIndex: number | null;
  domains: readonly Readonly<{ id: string; score: number; profile: NodeProfile }>[];
  nodes: readonly NodeResult[];
  flags: readonly ResultFlag[];
  groupBand: GroupBand;
}>;

export type FactSheetFactsInput = Readonly<{
  result: ScoringOutput;
  student: Readonly<{ alias: string; level: string }>;
}>;

export type FactSheetPackInput = Readonly<{
  slug: string;
  version: number;
  scoring: Readonly<{ domains: readonly string[] }>;
  questionnaire: Readonly<{
    items: readonly Readonly<{ id: string; nodeCpsId: string; domainId: string }>[];
  }>;
}>;

function assertUniqueNonEmpty(values: readonly string[], label: string): void {
  if (values.some((value) => value.trim() === '') || new Set(values).size !== values.length) {
    throw new TypeError(`${label} must contain unique, non-empty identifiers`);
  }
}

/**
 * Profil hérité du pire nœud, selon l'UNIQUE échelle de sévérité du moteur
 * (`SEVERITY_RANK`, constants.ts) : ERREUR_CONFIANTE > LACUNE_CONSCIENTE >
 * NON_TRAITE > MAITRISE_FRAGILE > MAITRISE.
 *
 * Doublon supprimé (13/08/2026) : ce fichier portait sa propre échelle locale
 * qui plaçait NON_TRAITE AU-DESSUS d'ERREUR_CONFIANTE. Un domaine mêlant un
 * nœud non traité et un nœud en erreur confiante héritait « non traité »,
 * pendant que la priorisation (SEVERITY_RANK) classait l'erreur confiante en
 * tête — le tableau et les priorités pouvaient se contredire sur un même
 * document. Une seule échelle fait foi désormais.
 */
function worstProfile(nodes: readonly NodeResult[]): NodeProfile {
  if (nodes.length === 0) return 'NON_TRAITE';
  return nodes.slice(1).reduce<NodeProfile>((worst, node) => (
    SEVERITY_RANK[node.profile] > SEVERITY_RANK[worst] ? node.profile : worst
  ), nodes[0].profile);
}

export function buildFactSheet(
  pack: FactSheetPackInput,
  facts: FactSheetFactsInput,
): FactSheet {
  const packDomains = [...pack.scoring.domains];
  assertUniqueNonEmpty(packDomains, 'Pack domains');
  if (!/^ELEVE_[A-Z]+$/.test(facts.student.alias)) {
    throw new TypeError('FactSheet student alias must be pseudonymous');
  }
  if (!pack.slug.trim() || !Number.isInteger(pack.version) || pack.version < 1) {
    throw new TypeError('FactSheet bank identity is invalid');
  }

  const nodeDomains: Record<string, string> = {};
  for (const item of pack.questionnaire.items) {
    const current = nodeDomains[item.nodeCpsId];
    if (current !== undefined && current !== item.domainId) {
      throw new Error(`Pack node ${item.nodeCpsId} is bound to multiple domains`);
    }
    nodeDomains[item.nodeCpsId] = item.domainId;
  }
  const nodesByDomain = new Map<string, NodeResult[]>();
  for (const node of facts.result.nodes) {
    const domain = nodeDomains[node.nodeCpsId];
    if (domain === undefined || !packDomains.includes(domain)) {
      throw new Error(`Fact node ${node.nodeCpsId} is not bound to a pack domain`);
    }
    const bucket = nodesByDomain.get(domain) ?? [];
    bucket.push(node);
    nodesByDomain.set(domain, bucket);
  }
  const scoreByDomain = new Map(computeDomainScores(packDomains, nodeDomains, facts.result.items)
    .map(({ domain, score }) => [domain, score]));
  const domains = packDomains.map((id) => Object.freeze({
    id,
    score: scoreByDomain.get(id) as number,
    profile: worstProfile(nodesByDomain.get(id) ?? []),
  }));

  return Object.freeze({
    engineVersion: facts.result.engineVersion,
    bankSlug: pack.slug,
    bankVersion: pack.version,
    student: Object.freeze({ ...facts.student }),
    globalScore: facts.result.globalScore,
    coverage: facts.result.coverage,
    calibrationIndex: facts.result.calibrationIndex,
    domains: Object.freeze(domains),
    nodes: Object.freeze(facts.result.nodes.map((node) => Object.freeze({ ...node }))),
    flags: Object.freeze([...facts.result.flags]),
    groupBand: facts.result.groupBand,
  });
}
