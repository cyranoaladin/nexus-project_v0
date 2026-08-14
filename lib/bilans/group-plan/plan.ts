import type { CpsCatalog } from '../catalog/bank-validation';
import type { FactSheet } from '../facts/fact-sheet';
import type { GroupBand, NodeProfile } from '../facts/types';

export const GROUP_PLAN_VERSION = 'nexus-group-plan.v1' as const;
export const GROUP_STAGE_MINUTES = 600;
export const GROUP_SESSION_TARGET_MINUTES = 120;
export const GROUP_SESSION_MIN_MINUTES = 105;
export const GROUP_SESSION_MAX_MINUTES = 135;

export type GroupNodeProfile = NodeProfile | 'DIVISE';

export const GROUP_PROFILE_BASE_MINUTES: Readonly<Record<GroupNodeProfile, number>> = Object.freeze({
  ERREUR_CONFIANTE: 75,
  DIVISE: 60,
  LACUNE_CONSCIENTE: 55,
  MAITRISE_FRAGILE: 38,
  MAITRISE: 20,
  NON_TRAITE: 55,
});

export const GROUP_PROFILE_TREATMENT: Readonly<Record<GroupNodeProfile, string>> = Object.freeze({
  ERREUR_CONFIANTE: "Reprise complète : déconstruction explicite de l'erreur",
  DIVISE: 'Tronc commun puis différenciation',
  LACUNE_CONSCIENTE: 'Enseignement direct, puis entraînement guidé',
  MAITRISE_FRAGILE: 'Automatisation par répétition, sans ré-explication',
  MAITRISE: 'Rappel actif et réactivation',
  NON_TRAITE: 'Diagnostic ciblé avant décision pédagogique',
});

export type GroupMember = Readonly<{ displayName: string; factSheet: FactSheet }>;

export type GroupNodeAllocation = Readonly<{
  nodeCpsId: string;
  label: string;
  sequenceOrder: number;
  profile: GroupNodeProfile;
  minutes: number;
  treatment: string;
  profileCounts: Readonly<Record<NodeProfile, number>>;
  dividedGroups: Readonly<{ acquired: readonly string[]; difficulty: readonly string[] }> | null;
  studentGuidance: readonly Readonly<{ displayName: string; profile: NodeProfile; guidance: string }>[];
}>;

export type GroupNodeSessionSegment = Readonly<Omit<GroupNodeAllocation, 'minutes'> & {
  segmentMinutes: number;
  totalMinutes: number;
  segmentPosition: 'WHOLE' | 'START' | 'CONTINUATION';
}>;

export type GroupSessionPlan = Readonly<{
  status: 'READY' | 'TEACHER_ARBITRATION_REQUIRED';
  cuts: readonly number[];
  sessions: readonly Readonly<{ index: number; contentMinutes: number; nodes: readonly GroupNodeSessionSegment[] }>[];
  warnings: readonly string[];
}>;

export type GroupPlan = Readonly<{
  version: typeof GROUP_PLAN_VERSION;
  packSlug: string;
  packVersion: number;
  students: readonly string[];
  nodes: readonly GroupNodeAllocation[];
  sessions: GroupSessionPlan['sessions'];
  schedulingStatus: GroupSessionPlan['status'];
  schedulingWarnings: readonly string[];
  calibrationRange: Readonly<{ lowest: GroupBand; highest: GroupBand; indicative: true }>;
  summary: Readonly<{ acquiredByAll: readonly string[]; generalizedDifficulty: readonly string[]; divided: readonly string[] }>;
}>;

const BAND_ORDER: readonly GroupBand[] = Object.freeze([
  'CONSOLIDATION_PRIORITAIRE', 'CONSOLIDATION_STANDARD', 'RENFORCEMENT', 'APPROFONDISSEMENT',
]);

function emptyProfileCounts(): Record<NodeProfile, number> {
  return { MAITRISE: 0, MAITRISE_FRAGILE: 0, LACUNE_CONSCIENTE: 0, ERREUR_CONFIANTE: 0, NON_TRAITE: 0 };
}

function profileFor(member: GroupMember, nodeCpsId: string): NodeProfile {
  return member.factSheet.nodes.find((node) => node.nodeCpsId === nodeCpsId)?.profile ?? 'NON_TRAITE';
}

/**
 * Agrège un profil de groupe pour un nœud, sans contrainte de taille. Séparée
 * d'`aggregateGroupProfile` (13/08/2026) pour être réutilisable par le dossier
 * enseignant, dont les groupes (une matière × un niveau) n'ont pas la borne
 * de taille du plan de groupe coach (trois à cinq élèves).
 */
export function aggregateProfiles(profiles: readonly NodeProfile[]): GroupNodeProfile {
  const counts = emptyProfileCounts();
  for (const profile of profiles) counts[profile] += 1;
  const acquired = counts.MAITRISE + counts.MAITRISE_FRAGILE;
  const difficulty = counts.ERREUR_CONFIANTE + counts.LACUNE_CONSCIENTE + counts.NON_TRAITE;
  if (difficulty / profiles.length >= 0.5) {
    if (counts.NON_TRAITE > counts.ERREUR_CONFIANTE + counts.LACUNE_CONSCIENTE) return 'LACUNE_CONSCIENTE';
    return counts.ERREUR_CONFIANTE >= counts.LACUNE_CONSCIENTE ? 'ERREUR_CONFIANTE' : 'LACUNE_CONSCIENTE';
  }
  if (acquired > 0 && difficulty > 0 && acquired / profiles.length < 2 / 3 && difficulty / profiles.length < 2 / 3) return 'DIVISE';
  return counts.MAITRISE >= counts.MAITRISE_FRAGILE ? 'MAITRISE' : 'MAITRISE_FRAGILE';
}

export function aggregateGroupProfile(profiles: readonly NodeProfile[]): GroupNodeProfile {
  if (profiles.length < 3 || profiles.length > 5) throw new Error('GROUP_SIZE_MUST_BE_3_TO_5');
  return aggregateProfiles(profiles);
}

function guidanceFor(profile: NodeProfile, label: string): string {
  const byProfile: Readonly<Record<NodeProfile, string>> = {
    MAITRISE: `Réactiver ${label} et expliciter une démarche sûre.`,
    MAITRISE_FRAGILE: `Stabiliser ${label} par répétition sans reprendre tout le cours.`,
    LACUNE_CONSCIENTE: `Reprendre les repères essentiels de ${label}, puis les appliquer avec guidage.`,
    ERREUR_CONFIANTE: `Confronter le raisonnement tenu pour juste sur ${label}, puis le reconstruire.`,
    NON_TRAITE: `Réaliser le diagnostic ciblé de ${label} avant de choisir le travail.`,
  };
  return byProfile[profile];
}

export function allocateGroupMinutes(
  nodes: readonly Readonly<{ nodeCpsId: string; sequenceOrder: number; profile: GroupNodeProfile }>[],
): readonly Readonly<{ nodeCpsId: string; sequenceOrder: number; profile: GroupNodeProfile; minutes: number }>[] {
  if (nodes.length !== 9) throw new Error(`GROUP_PLAN_REQUIRES_NINE_NODES:${nodes.length}`);
  const baseTotal = nodes.reduce((sum, node) => sum + GROUP_PROFILE_BASE_MINUTES[node.profile], 0);
  const allocations = nodes.map((node) => ({
    ...node,
    minutes: Math.max(15, Math.min(90, Math.round((GROUP_PROFILE_BASE_MINUTES[node.profile] * GROUP_STAGE_MINUTES / baseTotal) / 5) * 5)),
  }));
  let residual = GROUP_STAGE_MINUTES - allocations.reduce((sum, node) => sum + node.minutes, 0);
  while (residual !== 0) {
    const selected = allocations
      .filter(({ minutes }) => residual > 0 ? minutes < 90 : minutes > 15)
      .sort((left, right) => right.minutes - left.minutes || left.nodeCpsId.localeCompare(right.nodeCpsId))[0];
    if (selected === undefined) throw new Error(`GROUP_ALLOCATION_RESIDUAL_UNABSORBED:${residual}`);
    selected.minutes += residual > 0 ? 5 : -5;
    residual += residual > 0 ? -5 : 5;
  }
  return Object.freeze(allocations.map((allocation) => Object.freeze({ ...allocation })));
}

type NodeInterval = Readonly<{ node: GroupNodeAllocation; start: number; end: number }>;
type CutCandidate = Readonly<{
  cuts: readonly number[];
  durations: readonly number[];
  splitNodeCount: number;
  maxDeviation: number;
  totalDeviation: number;
}>;

function nodeIntervals(nodes: readonly GroupNodeAllocation[]): readonly NodeInterval[] {
  let elapsed = 0;
  return nodes.map((node) => {
    const interval = Object.freeze({ node, start: elapsed, end: elapsed + node.minutes });
    elapsed = interval.end;
    return interval;
  });
}

function candidateFor(cuts: readonly number[], intervals: readonly NodeInterval[]): CutCandidate | null {
  const edges = [0, ...cuts, GROUP_STAGE_MINUTES];
  const durations = edges.slice(1).map((edge, index) => edge - edges[index]);
  const fragments = intervals.map(({ start, end }) => edges.slice(0, -1)
    .map((sessionStart, index) => Math.max(0, Math.min(end, edges[index + 1]) - Math.max(start, sessionStart)))
    .filter((minutes) => minutes > 0));
  if (fragments.some((parts) => parts.length > 2 || parts.some((minutes) => minutes < 15))) return null;
  const deviations = durations.map((duration) => Math.abs(duration - GROUP_SESSION_TARGET_MINUTES));
  return Object.freeze({
    cuts: Object.freeze([...cuts]),
    durations: Object.freeze(durations),
    splitNodeCount: fragments.filter((parts) => parts.length > 1).length,
    maxDeviation: Math.max(...deviations),
    totalDeviation: deviations.reduce((sum, deviation) => sum + deviation, 0),
  });
}

function compareCandidates(left: CutCandidate, right: CutCandidate): number {
  if (left.splitNodeCount !== right.splitNodeCount) return left.splitNodeCount - right.splitNodeCount;
  if (left.maxDeviation !== right.maxDeviation) return left.maxDeviation - right.maxDeviation;
  if (left.totalDeviation !== right.totalDeviation) return left.totalDeviation - right.totalDeviation;
  for (let index = 0; index < left.cuts.length; index += 1) if (left.cuts[index] !== right.cuts[index]) return left.cuts[index] - right.cuts[index];
  return 0;
}

function bestHardCandidate(intervals: readonly NodeInterval[]): CutCandidate | undefined {
  let best: CutCandidate | undefined;
  for (let firstDuration = GROUP_SESSION_MIN_MINUTES; firstDuration <= GROUP_SESSION_MAX_MINUTES; firstDuration += 5) {
    for (let secondDuration = GROUP_SESSION_MIN_MINUTES; secondDuration <= GROUP_SESSION_MAX_MINUTES; secondDuration += 5) {
      for (let thirdDuration = GROUP_SESSION_MIN_MINUTES; thirdDuration <= GROUP_SESSION_MAX_MINUTES; thirdDuration += 5) {
        for (let fourthDuration = GROUP_SESSION_MIN_MINUTES; fourthDuration <= GROUP_SESSION_MAX_MINUTES; fourthDuration += 5) {
          const cuts = [
            firstDuration,
            firstDuration + secondDuration,
            firstDuration + secondDuration + thirdDuration,
            firstDuration + secondDuration + thirdDuration + fourthDuration,
          ];
          const fifthDuration = GROUP_STAGE_MINUTES - cuts[3];
          if (fifthDuration < GROUP_SESSION_MIN_MINUTES || fifthDuration > GROUP_SESSION_MAX_MINUTES) continue;
          const candidate = candidateFor(cuts, intervals);
          if (candidate !== null && (best === undefined || compareCandidates(candidate, best) < 0)) best = candidate;
        }
      }
    }
  }
  return best;
}

function bestFallbackCandidate(intervals: readonly NodeInterval[]): CutCandidate | undefined {
  const values = Array.from({ length: 79 }, (_unused, index) => 105 + index * 5);
  let best: CutCandidate | undefined;
  const current: number[] = [];
  const visit = (start: number): void => {
    if (current.length === 4) {
      const candidate = candidateFor(current, intervals);
      if (candidate !== null && (best === undefined || compareCandidates(candidate, best) < 0)) best = candidate;
      return;
    }
    for (let index = start; index <= values.length - (4 - current.length); index += 1) {
      current.push(values[index]);
      visit(index + 1);
      current.pop();
    }
  };
  visit(0);
  return best;
}

function sessionsFor(candidate: CutCandidate, intervals: readonly NodeInterval[]): GroupSessionPlan['sessions'] {
  const edges = [0, ...candidate.cuts, GROUP_STAGE_MINUTES];
  return Object.freeze(candidate.durations.map((contentMinutes, sessionIndex) => {
    const sessionStart = edges[sessionIndex];
    const sessionEnd = edges[sessionIndex + 1];
    const nodes = intervals.flatMap(({ node, start, end }): GroupNodeSessionSegment[] => {
      const segmentStart = Math.max(start, sessionStart);
      const segmentEnd = Math.min(end, sessionEnd);
      if (segmentEnd <= segmentStart) return [];
      const startsNode = segmentStart === start;
      const endsNode = segmentEnd === end;
      if (!startsNode && !endsNode) throw new Error(`GROUP_NODE_SPLIT_MORE_THAN_TWICE:${node.nodeCpsId}`);
      return [Object.freeze({
        ...node,
        segmentMinutes: segmentEnd - segmentStart,
        totalMinutes: node.minutes,
        segmentPosition: startsNode && endsNode ? 'WHOLE' : startsNode ? 'START' : 'CONTINUATION',
      })];
    });
    return Object.freeze({ index: sessionIndex + 1, contentMinutes, nodes: Object.freeze(nodes) });
  }));
}

export function planGroupSessions(nodes: readonly GroupNodeAllocation[]): GroupSessionPlan {
  const ordered = [...nodes].sort((left, right) => left.sequenceOrder - right.sequenceOrder);
  if (ordered.reduce((sum, node) => sum + node.minutes, 0) !== GROUP_STAGE_MINUTES) throw new Error('GROUP_SESSION_NODE_MINUTES_MUST_TOTAL_600');
  const intervals = nodeIntervals(ordered);
  const hardCandidate = bestHardCandidate(intervals);
  const selected = hardCandidate ?? bestFallbackCandidate(intervals);
  if (selected === undefined) throw new Error('GROUP_SESSION_CUTS_UNAVAILABLE');
  const warnings = hardCandidate === undefined ? selected.durations.flatMap((duration, index) => duration < GROUP_SESSION_MIN_MINUTES || duration > GROUP_SESSION_MAX_MINUTES
    ? [`Séance ${index + 1} : ${duration} minutes de contenu, hors fenêtre 105–135 ; arbitrage enseignant requis.`]
    : []) : [];
  return Object.freeze({
    status: hardCandidate === undefined ? 'TEACHER_ARBITRATION_REQUIRED' : 'READY',
    cuts: selected.cuts,
    sessions: sessionsFor(selected, intervals),
    warnings: Object.freeze(warnings),
  });
}

export function buildGroupPlan(catalog: CpsCatalog, members: readonly GroupMember[]): GroupPlan {
  if (members.length < 3 || members.length > 5) throw new Error('GROUP_SIZE_MUST_BE_3_TO_5');
  const names = members.map(({ displayName }) => displayName.trim());
  if (names.some((name) => name === '') || new Set(names).size !== names.length) throw new Error('GROUP_STUDENT_NAMES_INVALID');
  const packSlug = members[0].factSheet.bankSlug;
  const packVersion = members[0].factSheet.bankVersion;
  if (members.some(({ factSheet }) => factSheet.bankSlug !== packSlug || factSheet.bankVersion !== packVersion)) throw new Error('GROUP_MEMBERS_MUST_SHARE_PACK');
  const orderedCatalog = [...catalog.nodes].sort((left, right) => left.sequenceOrder - right.sequenceOrder);
  if (orderedCatalog.length !== 9 || orderedCatalog.some((node, index) => node.sequenceOrder !== index + 1)) throw new Error('GROUP_CATALOG_SEQUENCE_INVALID');
  const aggregates = orderedCatalog.map((node) => {
    const individualProfiles = members.map((member) => profileFor(member, node.id));
    const counts = emptyProfileCounts();
    for (const profile of individualProfiles) counts[profile] += 1;
    const profile = aggregateGroupProfile(individualProfiles);
    const acquired = members.filter((_member, index) => ['MAITRISE', 'MAITRISE_FRAGILE'].includes(individualProfiles[index])).map(({ displayName }) => displayName);
    const difficulty = members.filter((_member, index) => !['MAITRISE', 'MAITRISE_FRAGILE'].includes(individualProfiles[index])).map(({ displayName }) => displayName);
    return { node, profile, counts, dividedGroups: profile === 'DIVISE' ? Object.freeze({ acquired: Object.freeze(acquired), difficulty: Object.freeze(difficulty) }) : null, studentGuidance: Object.freeze(members.map((member, index) => Object.freeze({ displayName: member.displayName, profile: individualProfiles[index], guidance: guidanceFor(individualProfiles[index], node.label) }))) };
  });
  const minutes = allocateGroupMinutes(aggregates.map(({ node, profile }) => ({ nodeCpsId: node.id, sequenceOrder: node.sequenceOrder, profile })));
  const minuteByNode = new Map(minutes.map((allocation) => [allocation.nodeCpsId, allocation.minutes]));
  const nodes = Object.freeze(aggregates.map(({ node, profile, counts, dividedGroups, studentGuidance }) => Object.freeze({ nodeCpsId: node.id, label: node.label, sequenceOrder: node.sequenceOrder, profile, minutes: minuteByNode.get(node.id) as number, treatment: GROUP_PROFILE_TREATMENT[profile], profileCounts: Object.freeze({ ...counts }), dividedGroups, studentGuidance })));
  const scheduling = planGroupSessions(nodes);
  const bandIndexes = members.map(({ factSheet }) => BAND_ORDER.indexOf(factSheet.groupBand));
  return Object.freeze({
    version: GROUP_PLAN_VERSION, packSlug, packVersion, students: Object.freeze(names), nodes,
    sessions: scheduling.sessions, schedulingStatus: scheduling.status, schedulingWarnings: scheduling.warnings,
    calibrationRange: Object.freeze({ lowest: BAND_ORDER[Math.min(...bandIndexes)], highest: BAND_ORDER[Math.max(...bandIndexes)], indicative: true as const }),
    summary: Object.freeze({
      acquiredByAll: Object.freeze(nodes.filter(({ profileCounts }) => profileCounts.MAITRISE + profileCounts.MAITRISE_FRAGILE === members.length).map(({ nodeCpsId }) => nodeCpsId)),
      generalizedDifficulty: Object.freeze(nodes.filter(({ profile }) => profile === 'ERREUR_CONFIANTE' || profile === 'LACUNE_CONSCIENTE').map(({ nodeCpsId }) => nodeCpsId)),
      divided: Object.freeze(nodes.filter(({ profile }) => profile === 'DIVISE').map(({ nodeCpsId }) => nodeCpsId)),
    }),
  });
}
