/**
 * Analyse collective pour le dossier enseignant (une matière × un niveau).
 *
 * Fonctions pures, aucun accès Prisma : le service (`staff/teacher-dossier-service.ts`)
 * assemble les données, ce module se contente de les agréger. Deux axes
 * distincts coexistent volontairement, comme dans le reste du domaine bilans :
 *  - les DOMAINES du bilan (`FactSheet.domains`), pour la vue d'ensemble, le
 *    détail par élève et la lecture croisée (sections B, D, F) ;
 *  - les NŒUDS CPS (`CpsCatalog`), pour le plan des séances (section G),
 *    identique au moteur déjà utilisé par le plan de groupe coach
 *    (`group-plan/plan.ts`), simplement sans la borne de taille de ce
 *    dernier (trois à cinq élèves) — un groupe de dossier (une matière ×
 *    un niveau) n'est pas borné en taille.
 */

import type { CpsCatalog } from '../catalog/bank-validation';
import { COVERAGE_MIN } from '../facts/constants';
import type { FactSheet } from '../facts/fact-sheet';
import type { NodeProfile } from '../facts/types';
import {
  allocateGroupMinutes,
  aggregateProfiles,
  GROUP_PROFILE_BASE_MINUTES,
  GROUP_PROFILE_TREATMENT,
  planGroupSessions,
  type GroupNodeProfile,
  type GroupSessionPlan,
} from '../group-plan/plan';
import { chosenOption, evidenceItemStatus, type QuestionEvidence } from '../render/question-evidence';

export const TEACHER_DOSSIER_AGGREGATE_VERSION = 'teacher-dossier-aggregate.v1' as const;

/** Seuil d'écart-type au-delà duquel un groupe est jugé à différencier plutôt qu'homogène. */
export const HETEROGENEITY_STDDEV_THRESHOLD = 15;

/** Part du groupe (0-1) au-delà de laquelle un même distracteur est une erreur collective. */
export const COLLECTIVE_ERROR_RATIO = 0.5;

export type DossierMember = Readonly<{ displayName: string; factSheet: FactSheet; evidence: QuestionEvidence }>;

type ProfileCounts = Readonly<Record<NodeProfile, number>>;

function emptyCounts(): Record<NodeProfile, number> {
  return { MAITRISE: 0, MAITRISE_FRAGILE: 0, LACUNE_CONSCIENTE: 0, ERREUR_CONFIANTE: 0, NON_TRAITE: 0 };
}

function addCounts(target: Record<NodeProfile, number>, source: ProfileCounts): void {
  for (const profile of Object.keys(target) as NodeProfile[]) target[profile] += source[profile];
}

export type DomainGroupAnalysis = Readonly<{
  domainId: string;
  profile: GroupNodeProfile;
  profileCounts: ProfileCounts;
  /** Poids de gravité — le même barème que l'allocation des minutes de séance (G). */
  severityWeight: number;
}>;

export type ItemGroupAnalysis = Readonly<{
  itemId: string;
  domainId: string;
  questionText: string;
  totalMembers: number;
  correctCount: number;
  notTreatedCount: number;
  distractorCounts: Readonly<Record<string, number>>;
  majorityDistractorOptionId: string | null;
  collectiveError: boolean;
}>;

export type CalibrationStats = Readonly<{ mean: number | null; stddev: number | null; sampleSize: number }>;

export type HeterogeneityStats = Readonly<{
  scoreMean: number;
  scoreStddev: number;
  classification: 'HOMOGENE' | 'A_DIFFERENCIER';
  thresholdStddev: number;
}>;

export type AtypicalReason = 'TRES_EN_AVANCE' | 'TRES_EN_DIFFICULTE' | 'BEAUCOUP_NON_TRAITE';

export type AtypicalStudent = Readonly<{ displayName: string; reason: AtypicalReason }>;

export type StudentCluster = Readonly<{ domainId: string; profile: NodeProfile; students: readonly string[] }>;

export type DossierGroupAnalysis = Readonly<{
  version: typeof TEACHER_DOSSIER_AGGREGATE_VERSION;
  memberCount: number;
  profileDistribution: ProfileCounts;
  domains: readonly DomainGroupAnalysis[];
  items: readonly ItemGroupAnalysis[];
  calibration: CalibrationStats;
  heterogeneity: HeterogeneityStats;
  acquiredByAll: readonly string[];
  atypicalStudents: readonly AtypicalStudent[];
  clusters: readonly StudentCluster[];
}>;

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: readonly number[], average: number): number {
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function domainAnalyses(members: readonly DossierMember[]): readonly DomainGroupAnalysis[] {
  const domainIds = members[0].factSheet.domains.map(({ id }) => id);
  return domainIds.map((domainId) => {
    const profiles = members.map((member) => member.factSheet.domains.find((domain) => domain.id === domainId)?.profile ?? 'NON_TRAITE');
    const counts = emptyCounts();
    for (const profile of profiles) counts[profile] += 1;
    const profile = aggregateProfiles(profiles);
    return Object.freeze({ domainId, profile, profileCounts: Object.freeze(counts), severityWeight: GROUP_PROFILE_BASE_MINUTES[profile] });
  }).sort((left, right) => right.severityWeight - left.severityWeight);
}

function itemAnalyses(members: readonly DossierMember[]): readonly ItemGroupAnalysis[] {
  const [first] = members;
  return first.evidence.items.map((referenceItem) => {
    const distractorCounts: Record<string, number> = {};
    let correctCount = 0;
    let notTreatedCount = 0;
    for (const member of members) {
      const item = member.evidence.items.find(({ itemId }) => itemId === referenceItem.itemId);
      if (item === undefined) continue;
      const status = evidenceItemStatus(item);
      if (status === 'JUSTE') correctCount += 1;
      else if (status === 'NON_TRAITE') notTreatedCount += 1;
      else {
        const option = chosenOption(item);
        if (option !== null) distractorCounts[option.id] = (distractorCounts[option.id] ?? 0) + 1;
      }
    }
    const [majorityId, majorityCount] = Object.entries(distractorCounts).sort((left, right) => right[1] - left[1])[0] ?? [null, 0];
    const majorityDistractorOptionId = majorityId !== null && majorityCount / members.length >= COLLECTIVE_ERROR_RATIO ? majorityId : null;
    return Object.freeze({
      itemId: referenceItem.itemId, domainId: referenceItem.domainId, questionText: referenceItem.questionText,
      totalMembers: members.length, correctCount, notTreatedCount,
      distractorCounts: Object.freeze(distractorCounts), majorityDistractorOptionId, collectiveError: majorityDistractorOptionId !== null,
    });
  });
}

function calibrationStats(members: readonly DossierMember[]): CalibrationStats {
  const values = members.map((member) => member.factSheet.calibrationIndex).filter((value): value is number => value !== null);
  if (values.length === 0) return Object.freeze({ mean: null, stddev: null, sampleSize: 0 });
  const average = mean(values);
  return Object.freeze({ mean: average, stddev: stddev(values, average), sampleSize: values.length });
}

function heterogeneityStats(members: readonly DossierMember[]): HeterogeneityStats {
  const scores = members.map((member) => member.factSheet.globalScore);
  const average = mean(scores);
  const spread = stddev(scores, average);
  return Object.freeze({
    scoreMean: average, scoreStddev: spread,
    classification: spread > HETEROGENEITY_STDDEV_THRESHOLD ? 'A_DIFFERENCIER' : 'HOMOGENE',
    thresholdStddev: HETEROGENEITY_STDDEV_THRESHOLD,
  });
}

const DIFFICULTY_PROFILES: readonly NodeProfile[] = Object.freeze(['ERREUR_CONFIANTE', 'LACUNE_CONSCIENTE']);
const NOT_ADVANCED_PROFILES: readonly NodeProfile[] = Object.freeze(['ERREUR_CONFIANTE', 'LACUNE_CONSCIENTE', 'NON_TRAITE']);

function atypicalReason(member: DossierMember): AtypicalReason | null {
  const profiles = member.factSheet.domains.map(({ profile }) => profile);
  const total = profiles.length;
  if (total === 0) return null;
  const nonTraiteRatio = profiles.filter((profile) => profile === 'NON_TRAITE').length / total;
  if (nonTraiteRatio >= 0.5 || member.factSheet.coverage < COVERAGE_MIN) return 'BEAUCOUP_NON_TRAITE';
  const difficultyRatio = profiles.filter((profile) => DIFFICULTY_PROFILES.includes(profile)).length / total;
  if (difficultyRatio >= 0.5) return 'TRES_EN_DIFFICULTE';
  if (profiles.every((profile) => !NOT_ADVANCED_PROFILES.includes(profile)) && member.factSheet.coverage >= COVERAGE_MIN) return 'TRES_EN_AVANCE';
  return null;
}

function atypicalStudents(members: readonly DossierMember[]): readonly AtypicalStudent[] {
  return members.flatMap((member) => {
    const reason = atypicalReason(member);
    return reason === null ? [] : [Object.freeze({ displayName: member.displayName, reason })];
  });
}

function clusters(members: readonly DossierMember[], domains: readonly DomainGroupAnalysis[]): readonly StudentCluster[] {
  const result: StudentCluster[] = [];
  for (const domain of domains) {
    const byProfile = new Map<NodeProfile, string[]>();
    for (const member of members) {
      const profile = member.factSheet.domains.find(({ id }) => id === domain.domainId)?.profile ?? 'NON_TRAITE';
      const bucket = byProfile.get(profile) ?? [];
      bucket.push(member.displayName);
      byProfile.set(profile, bucket);
    }
    for (const [profile, students] of byProfile) {
      if (students.length >= 2) result.push(Object.freeze({ domainId: domain.domainId, profile, students: Object.freeze(students) }));
    }
  }
  return Object.freeze(result);
}

export function buildDossierGroupAnalysis(members: readonly DossierMember[]): DossierGroupAnalysis {
  if (members.length === 0) throw new Error('DOSSIER_GROUP_MUST_HAVE_AT_LEAST_ONE_MEMBER');
  const domains = domainAnalyses(members);
  const distribution = emptyCounts();
  for (const domain of domains) addCounts(distribution, domain.profileCounts);
  const acquiredByAll = members[0].factSheet.domains
    .map(({ id }) => id)
    .filter((domainId) => {
      const domain = domains.find((entry) => entry.domainId === domainId) as DomainGroupAnalysis;
      return domain.profileCounts.MAITRISE + domain.profileCounts.MAITRISE_FRAGILE === members.length;
    });
  return Object.freeze({
    version: TEACHER_DOSSIER_AGGREGATE_VERSION,
    memberCount: members.length,
    profileDistribution: Object.freeze(distribution),
    domains,
    items: itemAnalyses(members),
    calibration: calibrationStats(members),
    heterogeneity: heterogeneityStats(members),
    acquiredByAll: Object.freeze(acquiredByAll),
    atypicalStudents: atypicalStudents(members),
    clusters: clusters(members, domains),
  });
}

export type DossierSessionNode = Readonly<{
  nodeCpsId: string;
  label: string;
  sequenceOrder: number;
  profile: GroupNodeProfile;
  minutes: number;
  treatment: string;
  profileCounts: ProfileCounts;
}>;

export type DossierSessionPlan = Readonly<{
  nodes: readonly DossierSessionNode[];
  sessions: GroupSessionPlan['sessions'];
  schedulingStatus: GroupSessionPlan['status'];
  schedulingWarnings: readonly string[];
}>;

export function buildDossierSessionPlan(
  catalog: CpsCatalog,
  members: readonly Readonly<{ displayName: string; factSheet: FactSheet }>[],
): DossierSessionPlan {
  if (members.length === 0) throw new Error('DOSSIER_GROUP_MUST_HAVE_AT_LEAST_ONE_MEMBER');
  const packSlug = members[0].factSheet.bankSlug;
  const packVersion = members[0].factSheet.bankVersion;
  if (members.some(({ factSheet }) => factSheet.bankSlug !== packSlug || factSheet.bankVersion !== packVersion)) {
    throw new Error('GROUP_MEMBERS_MUST_SHARE_PACK');
  }
  const orderedCatalog = [...catalog.nodes].sort((left, right) => left.sequenceOrder - right.sequenceOrder);
  if (orderedCatalog.length !== 9 || orderedCatalog.some((node, index) => node.sequenceOrder !== index + 1)) {
    throw new Error('GROUP_CATALOG_SEQUENCE_INVALID');
  }
  const aggregates = orderedCatalog.map((node) => {
    const profiles = members.map((member) => member.factSheet.nodes.find((entry) => entry.nodeCpsId === node.id)?.profile ?? 'NON_TRAITE');
    const counts = emptyCounts();
    for (const profile of profiles) counts[profile] += 1;
    return { node, profile: aggregateProfiles(profiles), counts };
  });
  const minutes = allocateGroupMinutes(aggregates.map(({ node, profile }) => ({ nodeCpsId: node.id, sequenceOrder: node.sequenceOrder, profile })));
  const minuteByNode = new Map(minutes.map((allocation) => [allocation.nodeCpsId, allocation.minutes]));
  // `dividedGroups`/`studentGuidance` satisfy planGroupSessions' GroupNodeAllocation shape but
  // are dropped from the public DossierSessionNode below: they serve the coach's small-group
  // (three-to-five-student) differentiation table, which doesn't scale to a whole matière×niveau
  // cohort — per-student detail already lives in section D of the dossier.
  const forScheduling = aggregates.map(({ node, profile, counts }) => Object.freeze({
    nodeCpsId: node.id, label: node.label, sequenceOrder: node.sequenceOrder, profile,
    minutes: minuteByNode.get(node.id) as number, treatment: GROUP_PROFILE_TREATMENT[profile], profileCounts: Object.freeze(counts),
    dividedGroups: null, studentGuidance: Object.freeze([]),
  }));
  const scheduling = planGroupSessions(forScheduling);
  const nodes = Object.freeze(forScheduling.map(({ dividedGroups: _dividedGroups, studentGuidance: _studentGuidance, ...node }) => Object.freeze(node)));
  return Object.freeze({ nodes, sessions: scheduling.sessions, schedulingStatus: scheduling.status, schedulingWarnings: scheduling.warnings });
}
