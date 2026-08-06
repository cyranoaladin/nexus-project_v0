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

const PROFILE_SEVERITY: Readonly<Record<NodeProfile, number>> = {
  NON_TRAITE: 5,
  ERREUR_CONFIANTE: 4,
  LACUNE_CONSCIENTE: 3,
  MAITRISE_FRAGILE: 2,
  MAITRISE: 1,
};

function assertUniqueNonEmpty(values: readonly string[], label: string): void {
  if (values.some((value) => value.trim() === '') || new Set(values).size !== values.length) {
    throw new TypeError(`${label} must contain unique, non-empty identifiers`);
  }
}

function worstProfile(nodes: readonly NodeResult[]): NodeProfile {
  if (nodes.length === 0) return 'NON_TRAITE';
  return nodes.slice(1).reduce<NodeProfile>((worst, node) => (
    PROFILE_SEVERITY[node.profile] > PROFILE_SEVERITY[worst] ? node.profile : worst
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
