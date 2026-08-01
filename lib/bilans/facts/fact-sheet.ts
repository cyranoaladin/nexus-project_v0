import type { ScoringV2Result } from '@/lib/diagnostics/types';

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
  coverage: number;
  calibrationIndex: number | null;
  domains: readonly Readonly<{ id: string; score: number; profile: NodeProfile }>[];
  nodes: readonly NodeResult[];
  flags: readonly ResultFlag[];
  groupBand: GroupBand;
}>;

export type FactSheetFactsInput = Readonly<{
  result: ScoringOutput;
  bank: Readonly<{ slug: string; version: number; domainIds: readonly string[] }>;
  student: Readonly<{ alias: string; level: string }>;
  nodeDomains: Readonly<Record<string, string>>;
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
  scoringV2: ScoringV2Result,
  facts: FactSheetFactsInput,
): FactSheet {
  const packDomains = [...facts.bank.domainIds];
  const scoringDomains = scoringV2.domainScores.map(({ domain }) => domain);
  assertUniqueNonEmpty(packDomains, 'Pack domains');
  assertUniqueNonEmpty(scoringDomains, 'Scoring V2 domains');

  if (
    packDomains.length !== scoringDomains.length
    || packDomains.some((domain) => !scoringDomains.includes(domain))
  ) {
    throw new Error('FactSheet domain mismatch between validated pack and Scoring V2');
  }
  if (!/^ELEVE_[A-Z]+$/.test(facts.student.alias)) {
    throw new TypeError('FactSheet student alias must be pseudonymous');
  }
  if (!facts.bank.slug.trim() || !Number.isInteger(facts.bank.version) || facts.bank.version < 1) {
    throw new TypeError('FactSheet bank identity is invalid');
  }

  const nodesByDomain = new Map<string, NodeResult[]>();
  for (const node of facts.result.nodes) {
    const domain = facts.nodeDomains[node.nodeCpsId];
    if (domain === undefined || !packDomains.includes(domain)) {
      throw new Error(`Fact node ${node.nodeCpsId} is not bound to a pack domain`);
    }
    const bucket = nodesByDomain.get(domain) ?? [];
    bucket.push(node);
    nodesByDomain.set(domain, bucket);
  }
  const scoreByDomain = new Map(
    scoringV2.domainScores.map(({ domain, score }) => [domain, score]),
  );
  const domains = packDomains.map((id) => Object.freeze({
    id,
    score: scoreByDomain.get(id) as number,
    profile: worstProfile(nodesByDomain.get(id) ?? []),
  }));

  return Object.freeze({
    engineVersion: facts.result.engineVersion,
    bankSlug: facts.bank.slug,
    bankVersion: facts.bank.version,
    student: Object.freeze({ ...facts.student }),
    globalScore: facts.result.globalScore,
    coverage: scoringV2.coverageIndex,
    calibrationIndex: facts.result.calibrationIndex,
    domains: Object.freeze(domains),
    nodes: Object.freeze(facts.result.nodes.map((node) => Object.freeze({ ...node }))),
    flags: Object.freeze([...facts.result.flags]),
    groupBand: facts.result.groupBand,
  });
}
