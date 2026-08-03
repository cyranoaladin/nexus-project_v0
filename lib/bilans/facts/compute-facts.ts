/**
 * Moteur de scoring du positionnement — implémentation de référence.
 *
 * Spec : docs/specs/bilans/02-moteur-de-faits.md
 * En cas de divergence entre ce fichier et la spec, ce fichier est faux.
 *
 * CONTRAINTES ABSOLUES (AGENTS.bilans.md) :
 *   - fonction pure : aucune I/O, aucun réseau, aucune horloge, aucun LLM
 *   - déterminisme total : aucun Math.random, tous les tris ont un tie-break sur l'id
 *   - monotonie : rendre une réponse juste ne peut jamais faire baisser un score
 */

import {
  CALIBRATION_MIN,
  CONFIDENCE_THRESHOLD,
  CONFIDENT_ERROR_NODES_MIN,
  COVERAGE_MIN,
  DEFAULT_NODE_CRITICALITY,
  ENGINE_VERSION,
  EXPRESS_RATIO,
  GROUP_BANDS,
  SEVERITY_RANK,
  SUCCESS_THRESHOLD,
} from './constants';
import type {
  GroupBand,
  ItemProfile,
  ItemResult,
  NodeProfile,
  NodeResult,
  ResultFlag,
  ScoringAnswer,
  ScoringInput,
  ScoringItem,
  ScoringOutput,
} from './types';

/* -------------------------------------------------------------------------- */
/* Utilitaires                                                                 */
/* -------------------------------------------------------------------------- */

const roundTo = (value: number, decimals: number): number => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};

const roundToQuarter = (value: number): number => Math.round(value * 4) / 4;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Normalisation SHORT_TEXT : minuscules, sans accents, espaces compressés, ponctuation finale retirée. */
export const normalizeText = (raw: string): string =>
  raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.;,:!?\s]+$/g, '')
    .trim();

const isBlank = (v: ScoringAnswer['rawAnswer']): boolean =>
  v === null ||
  v === undefined ||
  (typeof v === 'string' && v.trim() === '') ||
  (Array.isArray(v) && v.length === 0);

/* -------------------------------------------------------------------------- */
/* Réussite d'un item — spec §2                                                */
/* -------------------------------------------------------------------------- */

export function computeRawSuccess(item: ScoringItem, raw: ScoringAnswer['rawAnswer']): number {
  if (isBlank(raw)) return 0;
  const key = item.answerKey;

  switch (key.kind) {
    case 'QCM_SIMPLE':
      return typeof raw === 'string' && raw === key.correct ? 1 : 0;

    case 'QCM_MULTIPLE': {
      const picked = Array.isArray(raw) ? raw : [String(raw)];
      const unique = Array.from(new Set(picked));
      const correctSet = new Set(key.correct);
      const good = unique.filter((k) => correctSet.has(k)).length;
      const bad = unique.length - good;
      const total = key.correct.length;
      if (total === 0) return 0;
      return roundToQuarter(clamp01((good - bad) / total));
    }

    case 'NUMERIC': {
      const value = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
      if (!Number.isFinite(value)) return 0;
      return Math.abs(value - key.target) <= key.tolerance ? 1 : 0;
    }

    case 'SHORT_TEXT': {
      if (typeof raw !== 'string') return 0;
      const norm = normalizeText(raw);
      return key.accepted.some((a) => normalizeText(a) === norm) ? 1 : 0;
    }

    default: {
      const corrupted = key as unknown as { kind?: unknown };
      throw new TypeError(`Unsupported answer key kind: ${String(corrupted.kind)}`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Profil d'item — spec §4                                                     */
/* -------------------------------------------------------------------------- */

export function computeItemProfile(
  answered: boolean,
  isSuccess: boolean,
  isConfident: boolean,
): ItemProfile {
  if (!answered) return 'NON_TRAITE';
  if (isSuccess) return isConfident ? 'MAITRISE' : 'MAITRISE_FRAGILE';
  return isConfident ? 'ERREUR_CONFIANTE' : 'LACUNE_CONSCIENTE';
}

/* -------------------------------------------------------------------------- */
/* Profil d'un nœud — spec §6                                                  */
/* -------------------------------------------------------------------------- */

export function computeNodeProfile(mass: Readonly<Record<ItemProfile, number>>): NodeProfile {
  const total =
    mass.ERREUR_CONFIANTE +
    mass.LACUNE_CONSCIENTE +
    mass.NON_TRAITE +
    mass.MAITRISE_FRAGILE +
    mass.MAITRISE;

  if (total === 0) return 'NON_TRAITE';

  // Règle 1
  if (mass.NON_TRAITE / total > 0.5) return 'NON_TRAITE';

  // Règle 2
  const difficulty = mass.ERREUR_CONFIANTE + mass.LACUNE_CONSCIENTE + mass.NON_TRAITE;
  if (difficulty / total >= 0.5) {
    if (mass.ERREUR_CONFIANTE === 0 && mass.LACUNE_CONSCIENTE === 0) {
      return 'NON_TRAITE';
    }
    return mass.ERREUR_CONFIANTE >= mass.LACUNE_CONSCIENTE
      ? 'ERREUR_CONFIANTE'
      : 'LACUNE_CONSCIENTE';
  }

  // Règle 3
  return mass.MAITRISE >= mass.MAITRISE_FRAGILE ? 'MAITRISE' : 'MAITRISE_FRAGILE';
}

/* -------------------------------------------------------------------------- */
/* Bande de groupe — spec §10                                                  */
/* -------------------------------------------------------------------------- */

export function computeGroupBand(globalScore: number): GroupBand {
  for (const { min, band } of GROUP_BANDS) {
    if (globalScore >= min) return band;
  }
  return 'CONSOLIDATION_PRIORITAIRE';
}

/* -------------------------------------------------------------------------- */
/* Moteur principal                                                            */
/* -------------------------------------------------------------------------- */

export function score(input: ScoringInput): ScoringOutput {
  const { items, answers, targetDurationMin } = input;

  const answerByItem = new Map<string, ScoringAnswer>();
  for (const a of answers) answerByItem.set(a.itemId, a);

  /* --- Niveau item ------------------------------------------------------- */

  const itemResults: ItemResult[] = items.map((item) => {
    const answer = answerByItem.get(item.id);
    const answered = answer !== undefined && !isBlank(answer.rawAnswer);
    const rawSuccess = answered ? computeRawSuccess(item, answer!.rawAnswer) : 0;
    const isSuccess = rawSuccess >= SUCCESS_THRESHOLD;
    const isConfident =
      answered && answer!.confidence !== null && answer!.confidence >= CONFIDENCE_THRESHOLD;

    return {
      itemId: item.id,
      nodeCpsId: item.nodeCpsId,
      weight: item.difficulty,
      rawSuccess,
      isSuccess,
      isConfident,
      profile: computeItemProfile(answered, isSuccess, isConfident),
      answered,
      elapsedMs: answer?.elapsedMs ?? 0,
    };
  });

  /* --- Score global et couverture — spec §7 ------------------------------ */

  const totalWeight = itemResults.reduce((s, r) => s + r.weight, 0);
  const weightedSuccess = itemResults.reduce((s, r) => s + r.rawSuccess * r.weight, 0);
  const globalScore = totalWeight === 0 ? 0 : roundTo((100 * weightedSuccess) / totalWeight, 1);

  const answeredCount = itemResults.filter((r) => r.answered).length;
  const coverage = items.length === 0 ? 0 : roundTo((100 * answeredCount) / items.length, 1);

  /* --- Indice de calibration — spec §8 ----------------------------------- */

  const treated = itemResults.filter((r) => r.answered);
  const treatedWeight = treated.reduce((s, r) => s + r.weight, 0);
  const concordantWeight = treated.reduce((s, r) => {
    const concordant = r.isSuccess === r.isConfident;
    return s + (concordant ? r.weight : 0);
  }, 0);
  const calibrationIndex =
    treatedWeight === 0 ? null : roundTo((100 * concordantWeight) / treatedWeight, 1);

  /* --- Agrégation par nœud — spec §6 ------------------------------------- */

  const criticalityByNode = new Map<string, number>();
  for (const item of items) {
    if (!criticalityByNode.has(item.nodeCpsId)) {
      criticalityByNode.set(item.nodeCpsId, item.nodeCriticality ?? DEFAULT_NODE_CRITICALITY);
    }
  }

  const grouped = new Map<string, ItemResult[]>();
  for (const r of itemResults) {
    const bucket = grouped.get(r.nodeCpsId);
    if (bucket) bucket.push(r);
    else grouped.set(r.nodeCpsId, [r]);
  }

  const nodesUnranked = Array.from(grouped.entries()).map(([nodeCpsId, rs]) => {
    const w = rs.reduce((s, r) => s + r.weight, 0);
    const nodeScore = w === 0 ? 0 : roundTo((100 * rs.reduce((s, r) => s + r.rawSuccess * r.weight, 0)) / w, 1);

    const mass: Record<ItemProfile, number> = {
      MAITRISE: 0,
      MAITRISE_FRAGILE: 0,
      LACUNE_CONSCIENTE: 0,
      ERREUR_CONFIANTE: 0,
      NON_TRAITE: 0,
    };
    for (const r of rs) mass[r.profile] += r.weight;

    return {
      nodeCpsId,
      // `grouped` and `criticalityByNode` are built from the same item list.
      criticality: criticalityByNode.get(nodeCpsId) as number,
      nodeScore,
      profile: computeNodeProfile(mass),
      itemIds: rs.map((r) => r.itemId).sort(),
    };
  });

  /* --- Priorisation — spec §9 -------------------------------------------- */

  const nodes: NodeResult[] = nodesUnranked
    .slice()
    .sort((a, b) => {
      const sev = SEVERITY_RANK[b.profile] - SEVERITY_RANK[a.profile];
      if (sev !== 0) return sev;
      const crit = b.criticality - a.criticality;
      if (crit !== 0) return crit;
      const sc = a.nodeScore - b.nodeScore;
      if (sc !== 0) return sc;
      return a.nodeCpsId.localeCompare(b.nodeCpsId);
    })
    .map((n, index) => ({ ...n, priorityRank: index }));

  /* --- Drapeaux — spec §11 ----------------------------------------------- */

  const flags: ResultFlag[] = [];
  if (coverage < COVERAGE_MIN) flags.push('COUVERTURE_INSUFFISANTE');
  if (calibrationIndex !== null && calibrationIndex < CALIBRATION_MIN) {
    flags.push('CALIBRATION_A_TRAVAILLER');
  }
  if (nodes.filter((n) => n.profile === 'ERREUR_CONFIANTE').length >= CONFIDENT_ERROR_NODES_MIN) {
    flags.push('ERREURS_CONFIANTES_MULTIPLES');
  }
  const elapsedMinutes = itemResults.reduce((s, r) => s + r.elapsedMs, 0) / 60000;
  if (targetDurationMin > 0 && elapsedMinutes < EXPRESS_RATIO * targetDurationMin) {
    flags.push('PASSATION_EXPRESS');
  }
  if (input.partial === true) flags.push('PASSATION_PARTIELLE');

  return {
    engineVersion: ENGINE_VERSION,
    globalScore,
    coverage,
    calibrationIndex,
    items: itemResults,
    nodes,
    flags,
    groupBand: computeGroupBand(globalScore),
  };
}
