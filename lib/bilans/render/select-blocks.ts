/**
 * Sélection déterministe des contenus de restitution, par audience.
 * Spec : docs/specs/bilans/05-restitution-bilans.md
 *
 * Ce module SÉLECTIONNE des blocs. Il ne rédige pas : les formulations viennent
 * d'un catalogue de fragments versionné, injecté via `FragmentCatalog`.
 * Aucun appel LLM, ici comme dans le moteur.
 */

import { PRIORITY_NODES_MAX, STRENGTH_NODES_MAX } from '../facts/constants';
import type { NodeResult, ResultFlag, ScoringOutput } from '../facts/types';

export type Audience = 'ELEVE' | 'PARENT' | 'NEXUS';

export interface FragmentCatalog {
  /** Libellé pédagogique d'un nœud, formulé en compétence. */
  nodeLabel(nodeCpsId: string, audience: Audience): string;
  /** Correction courte de l'item le plus discriminant du nœud. */
  nodeShortCorrection(nodeCpsId: string): string;
  /** Action de micro-plan associée au nœud, pour l'élève. */
  nodeAction(nodeCpsId: string): { verb: string; object: string; durationMin: number };
  /** Module du programme couvrant le nœud, s'il existe. */
  nodeModule(nodeCpsId: string): string | null;
}

export interface BilanBlock {
  readonly key: string;
  readonly kind: 'strengths' | 'priorities' | 'microplan' | 'calibration' | 'reliability' | 'frame' | 'raw';
  readonly payload: unknown;
}

export interface BilanPayload {
  readonly audience: Audience;
  readonly renderVersion: string;
  readonly blocks: readonly BilanBlock[];
}

export const RENDER_VERSION = '1.0.0';

/** Nœuds acquis, du plus solide au moins solide, tie-break sur l'identifiant. */
export function selectStrengths(nodes: readonly NodeResult[]): NodeResult[] {
  return nodes
    .filter((n) => n.profile === 'MAITRISE')
    .slice()
    .sort((a, b) => b.nodeScore - a.nodeScore || (a.nodeCpsId < b.nodeCpsId ? -1 : 1))
    .slice(0, STRENGTH_NODES_MAX);
}

/** Nœuds prioritaires : l'ordre vient déjà du moteur (spec 02 §9). */
export function selectPriorities(nodes: readonly NodeResult[]): NodeResult[] {
  return nodes.filter((n) => n.profile !== 'MAITRISE').slice(0, PRIORITY_NODES_MAX);
}

/** Une restitution PARENT automatique est interdite dans ces cas. */
export function requiresHumanReview(flags: readonly ResultFlag[]): boolean {
  return flags.includes('COUVERTURE_INSUFFISANTE') || flags.includes('PASSATION_EXPRESS');
}

export function buildBilan(
  result: ScoringOutput,
  audience: Audience,
  catalog: FragmentCatalog,
): BilanPayload {
  const strengths = selectStrengths(result.nodes);
  const priorities = selectPriorities(result.nodes);
  const blocks: BilanBlock[] = [];

  blocks.push({
    key: 'frame',
    kind: 'frame',
    payload: {
      nature: 'positionnement',
      // Mention obligatoire : ni évaluation notée, ni pronostic.
      notAGrade: true,
      notAForecast: true,
    },
  });

  blocks.push({
    key: 'strengths',
    kind: 'strengths',
    payload: strengths.map((n) => ({
      nodeCpsId: n.nodeCpsId,
      label: catalog.nodeLabel(n.nodeCpsId, audience),
    })),
  });

  blocks.push({
    key: 'priorities',
    kind: 'priorities',
    payload: priorities.map((n) => ({
      nodeCpsId: n.nodeCpsId,
      label: catalog.nodeLabel(n.nodeCpsId, audience),
      correction: audience === 'PARENT' ? null : catalog.nodeShortCorrection(n.nodeCpsId),
      module: catalog.nodeModule(n.nodeCpsId),
    })),
  });

  if (audience === 'ELEVE') {
    blocks.push({
      key: 'microplan',
      kind: 'microplan',
      payload: priorities.map((n) => catalog.nodeAction(n.nodeCpsId)),
    });
  }

  if (result.flags.includes('CALIBRATION_A_TRAVAILLER')) {
    blocks.push({
      key: 'calibration',
      kind: 'calibration',
      // Présenté comme une compétence à acquérir, jamais comme un défaut.
      payload: { focus: 'verification', framing: 'competence' },
    });
  }

  if (requiresHumanReview(result.flags)) {
    blocks.push({
      key: 'reliability',
      kind: 'reliability',
      payload: { partial: true, flags: result.flags },
    });
  }

  // Les données brutes ne sortent JAMAIS de l'audience NEXUS.
  if (audience === 'NEXUS') {
    blocks.push({
      key: 'raw',
      kind: 'raw',
      payload: {
        engineVersion: result.engineVersion,
        globalScore: result.globalScore,
        coverage: result.coverage,
        calibrationIndex: result.calibrationIndex,
        groupBand: result.groupBand,
        flags: result.flags,
        nodes: result.nodes,
        items: result.items,
      },
    });
  }

  return { audience, renderVersion: RENDER_VERSION, blocks };
}
