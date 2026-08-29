/**
 * Rollout flag for the carte-aware candidat-individuel recommendation
 * pipeline (mission "recâblage" §2) — a BusinessConfig namespace
 * (lib/config/schemas.ts::'pricing.candidatIndividuelPipeline'), reusing
 * the existing versioned/audited/ADMIN-gated config mechanism rather than
 * a new flag system (no generic feature-flag infra exists in this repo —
 * confirmed by repo-wide search before building this).
 *
 * Fail-closed default: OFF. No canonical-JSON fallback exists for this
 * namespace (it's rollout state, not a pricing parameter) — the default is
 * asserted explicitly here via getOverrideOr(), not derived from
 * data/pricing.canonical.json.
 */
import 'server-only';
import { getOverrideOr } from '@/lib/config/snapshot';

export type PipelineState = 'OFF' | 'SHADOW' | 'ACTIVE_INTERNAL' | 'ACTIVE_PUBLIC_PERCENTAGE' | 'ACTIVE_PUBLIC';

const NAMESPACE = 'pricing.candidatIndividuelPipeline';

export function getPipelineState(): PipelineState {
  return getOverrideOr<PipelineState>(NAMESPACE, 'state', 'OFF');
}

export function getPipelinePublicPercentage(): number {
  return getOverrideOr<number>(NAMESPACE, 'publicPercentage', 0);
}

/** Runs the new pipeline in parallel with legacy, never visible to the family, never persisted as a contractual Quote. */
export function isShadowModeEnabled(): boolean {
  const state = getPipelineState();
  return state === 'SHADOW' || state === 'ACTIVE_INTERNAL';
}

/** ADMIN/ASSISTANTE may use the new pipeline directly — still gated by the regulatory/pricing gates, never a public bypass. */
export function isActiveForInternalStaff(): boolean {
  return getPipelineState() === 'ACTIVE_INTERNAL';
}

export function isActiveForPublic(): boolean {
  return false;
}
