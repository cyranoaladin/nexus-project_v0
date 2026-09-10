/**
 * N4B — the one-time Nexus-side bootstrap import of RAG's audited resource
 * identities into the canonical Resource Registry (`ARIA_V1.md` §9, step 2:
 * "Nexus importe une fois les identités RAG auditées, les scelle dans son
 * Resource Registry et exporte le registre canonique").
 *
 * Pure functions only — no filesystem, no network. The CLI
 * (`scripts/aria/import-resource-registry-bootstrap.ts`) owns all I/O.
 *
 * Every step below is fail-closed and non-heuristic by construction:
 *  - the historical, immutable RAG release (`production-profile-gate-
 *    2026-2027-v1`) can never be imported as if it were a new canonical
 *    release (`assertNotHistoricalRelease`);
 *  - academic placement mapping is delegated entirely to
 *    `mapBootstrapPlacementToCourseKey` — this module never invents a
 *    matiere/courseKey correspondence;
 *  - only bootstrap resources whose rights/mime/type_doc cleanly and
 *    unambiguously fit the registry's own vocabulary are imported; every
 *    other resource is reported as SKIPPED, never guessed into a shape
 *    that doesn't truthfully describe it.
 */

import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import bootstrapSchema from '@/data/aria/generated/rag-contracts/v1/resource-registry-bootstrap-v1.json';
import snapshotSchema from '@/data/aria/generated/rag-contracts/v1/resource-registry-snapshot-v1.json';
import { mapBootstrapPlacementToCourseKey } from '@/lib/aria/infrastructure/rag/rag-placement-to-course-key';
import { sha256AriaRagJson } from '@/lib/aria/infrastructure/rag/internal-identity';
import type { AriaResourceRecord, AriaResourceVersionRecord } from '@/lib/aria/manifests/resource-registry';

// ── Bootstrap inventory shape (mirrors resource-registry-bootstrap-v1.json) ─

export interface BootstrapPlacement {
  readonly tenant: string;
  readonly collection: string;
  readonly niveau: string;
  readonly voie: string;
  readonly matiere: string;
  readonly candidat: string;
  readonly audience: readonly string[];
  readonly visibility: 'public' | 'internal' | 'restricted' | 'private';
  readonly school_year: string;
  readonly programme_version: string;
  readonly statut_enseignement: string;
}

export interface BootstrapResourceVersion {
  readonly resource_id: string;
  readonly resource_version_id: string;
  readonly content_sha256: string;
  readonly rag_artifact_id: string;
  readonly size_bytes: number;
  readonly mime_type: string;
  readonly source_label: string;
  readonly source_uri: string;
  readonly rights: string;
  readonly official: boolean;
  readonly source_kind: string;
  readonly type_doc: string;
  readonly placements: readonly BootstrapPlacement[];
  readonly chunks: readonly unknown[];
}

export interface BootstrapInventory {
  readonly protocol_version: '1';
  readonly producer_repository: string;
  readonly producer_commit: string;
  readonly package_version: string;
  readonly source_snapshot_sha256: string;
  readonly generated_at: string;
  readonly resources: readonly BootstrapResourceVersion[];
  readonly inventory_sha256: string;
}

// ── Registry snapshot shape (mirrors resource-registry-snapshot-v1.json) ───

export interface ResourceRegistrySnapshot {
  readonly protocol_version: '1';
  readonly registry_version: string;
  readonly producer_repository: 'cyranoaladin/nexus-project_v0';
  readonly producer_commit: string;
  readonly generated_at: string;
  readonly bootstrap_inventory_sha256: string;
  readonly resources: readonly {
    readonly resource_id: string;
    readonly resource_version_id: string;
    readonly content_sha256: string;
  }[];
  readonly registry_sha256: string;
}

// ── Registry document shape (the subset this module reads/writes) ─────────

export interface AriaResourceRegistryDocument {
  readonly schemaVersion: '2';
  readonly registryVersion: string;
  readonly idNamespace: string;
  readonly resources: readonly AriaResourceRecord[];
}

// ── Errors ──────────────────────────────────────────────────────────────

export type AriaN4bImportErrorCode =
  | 'INVENTORY_SCHEMA_INVALID'
  | 'HISTORICAL_RELEASE_REUSE_FORBIDDEN'
  | 'PLACEMENT_MAPPING_FAILED'
  | 'REGISTRY_CONFLICT'
  | 'REGISTRY_SCHEMA_INVALID';

export class AriaN4bImportError extends Error {
  readonly code: AriaN4bImportErrorCode;
  readonly details: readonly string[];

  constructor(code: AriaN4bImportErrorCode, details: readonly string[]) {
    super(`${code}: ${details.join('; ')}`);
    this.name = 'AriaN4bImportError';
    this.code = code;
    this.details = details;
  }
}

// ── Step 1: validation ──────────────────────────────────────────────────

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateBootstrapSchema = ajv.compile(bootstrapSchema);
const validateSnapshotSchema = ajv.compile(snapshotSchema);

export function validateBootstrapInventory(raw: unknown): BootstrapInventory {
  if (!validateBootstrapSchema(raw)) {
    const details = (validateBootstrapSchema.errors ?? []).map(
      (error) => `${error.instancePath || '<root>'} ${error.message ?? 'invalid'}`,
    );
    throw new AriaN4bImportError('INVENTORY_SCHEMA_INVALID', details.length > 0 ? details : ['unknown schema violation']);
  }
  return raw as unknown as BootstrapInventory;
}

/** Structural-only check, used to validate a snapshot this module just produced. */
export function validateResourceRegistrySnapshot(raw: unknown): ResourceRegistrySnapshot {
  if (!validateSnapshotSchema(raw)) {
    const details = (validateSnapshotSchema.errors ?? []).map(
      (error) => `${error.instancePath || '<root>'} ${error.message ?? 'invalid'}`,
    );
    throw new AriaN4bImportError('REGISTRY_SCHEMA_INVALID', details.length > 0 ? details : ['unknown schema violation']);
  }
  return raw as unknown as ResourceRegistrySnapshot;
}

// ── Step 2: historical-release guard ────────────────────────────────────

/**
 * The historical, immutable, already-sealed RAG release. A separate,
 * concurrent RAG-side governance decision (ADR-0050-equivalent) forbids
 * ever reusing its identity for a new canonical release. N4B must never
 * import an inventory produced from it — even a schema-valid, well-formed
 * one — as if it were the new canonical corpus.
 */
export const HISTORICAL_RAG_RELEASE_PRODUCER_REPOSITORY = 'cyranoaladin/RAG';
export const HISTORICAL_RAG_RELEASE_PRODUCER_COMMIT = 'dd0ae3d9490703c0c180b12a7fce11f5c222427d';

export function assertNotHistoricalRelease(inventory: BootstrapInventory): void {
  if (
    inventory.producer_repository === HISTORICAL_RAG_RELEASE_PRODUCER_REPOSITORY
    && inventory.producer_commit === HISTORICAL_RAG_RELEASE_PRODUCER_COMMIT
  ) {
    throw new AriaN4bImportError('HISTORICAL_RELEASE_REUSE_FORBIDDEN', [
      `inventory declares the historical, immutable release (producer_commit=${inventory.producer_commit}) — `
      + 'a new canonical release must never reuse this identity',
    ]);
  }
}

// ── Step 3: academic mapping + resource-shape derivation ───────────────

/** Explicit, non-heuristic subset of `type_doc` → registry `type`. Anything else falls back to the registry's own generic 'PDF' bucket only when the file is actually a PDF — never guessed into a more specific category. */
const TYPE_DOC_TO_REGISTRY_TYPE: Readonly<Record<string, AriaResourceRecord['type']>> = Object.freeze({
  fiche_synthese: 'SYNTHESE',
  fiche_methode: 'METHODE',
  exercice: 'EXERCICE',
  exercice_corrige: 'EXERCICE',
  annale: 'ANNALE_BAC',
  sujet_zero: 'ANNALE_BAC',
});

/**
 * Every version this registry schema can represent is required to declare
 * `mimeType: 'application/pdf'` — regardless of its `type` category. A
 * bootstrap resource whose real `mime_type` isn't a PDF cannot be
 * truthfully represented here at all, no matter how well its `type_doc`
 * maps — checked before any category mapping, not just the generic
 * fallback.
 */
function resolveRegistryType(typeDoc: string, mimeType: string): AriaResourceRecord['type'] | null {
  if (mimeType !== 'application/pdf') return null;
  return TYPE_DOC_TO_REGISTRY_TYPE[typeDoc] ?? 'PDF';
}

export interface MappedBootstrapResource {
  readonly bootstrapVersion: BootstrapResourceVersion;
  readonly courseKeys: readonly string[];
  readonly registryType: AriaResourceRecord['type'];
}

export type MappingFailure =
  | { readonly kind: 'PLACEMENT_UNKNOWN'; readonly resourceVersionId: string; readonly placement: BootstrapPlacement }
  | { readonly kind: 'PLACEMENT_AMBIGUOUS'; readonly resourceVersionId: string; readonly placement: BootstrapPlacement; readonly courseKeys: readonly string[] };

export interface SkippedBootstrapResource {
  readonly resourceVersionId: string;
  readonly reason: 'UNSUPPORTED_RIGHTS' | 'UNSUPPORTED_TYPE_DOC_OR_MIME';
}

export interface MapInventoryPlacementsResult {
  readonly mapped: readonly MappedBootstrapResource[];
  readonly skipped: readonly SkippedBootstrapResource[];
  readonly failures: readonly MappingFailure[];
}

/**
 * Maps every eligible bootstrap resource version to its Nexus course keys.
 * Only `rights: 'officiel_public'` (with `official: true`) resources are
 * eligible — the only rights value that cleanly and unambiguously maps to
 * the registry's `OFFICIAL_PUBLIC`/`PUBLIC` vocabulary AND the only one
 * ARIA's chat pipeline can currently cite (`isAriaResourceRagCitable`).
 * Every other rights value is SKIPPED, never guessed.
 *
 * Throws nothing — callers must check `failures` before proceeding: any
 * unmapped/ambiguous placement blocks the WHOLE import (collected, not
 * fail-fast, so every problem surfaces in one report).
 */
export function mapInventoryPlacements(inventory: BootstrapInventory): MapInventoryPlacementsResult {
  const mapped: MappedBootstrapResource[] = [];
  const skipped: SkippedBootstrapResource[] = [];
  const failures: MappingFailure[] = [];

  for (const resource of inventory.resources) {
    if (resource.rights !== 'officiel_public' || !resource.official) {
      skipped.push({ resourceVersionId: resource.resource_version_id, reason: 'UNSUPPORTED_RIGHTS' });
      continue;
    }
    const registryType = resolveRegistryType(resource.type_doc, resource.mime_type);
    if (!registryType) {
      skipped.push({ resourceVersionId: resource.resource_version_id, reason: 'UNSUPPORTED_TYPE_DOC_OR_MIME' });
      continue;
    }

    const courseKeys = new Set<string>();
    let resourceHasFailure = false;
    for (const placement of resource.placements) {
      const result = mapBootstrapPlacementToCourseKey(placement);
      if (result.outcome === 'MATCHED') {
        courseKeys.add(result.courseKey);
      } else if (result.outcome === 'PLACEMENT_COURSE_MAPPING_UNKNOWN') {
        failures.push({ kind: 'PLACEMENT_UNKNOWN', resourceVersionId: resource.resource_version_id, placement });
        resourceHasFailure = true;
      } else {
        failures.push({
          kind: 'PLACEMENT_AMBIGUOUS',
          resourceVersionId: resource.resource_version_id,
          placement,
          courseKeys: result.courseKeys,
        });
        resourceHasFailure = true;
      }
    }
    if (resourceHasFailure) continue;

    mapped.push({ bootstrapVersion: resource, courseKeys: Object.freeze([...courseKeys].sort()), registryType });
  }

  return Object.freeze({ mapped: Object.freeze(mapped), skipped: Object.freeze(skipped), failures: Object.freeze(failures) });
}

/**
 * `AriaResourceRecord`/`AriaResourceVersionRecord` are `z.infer` types —
 * plain mutable shapes, not `readonly`. Deliberately built as plain object
 * literals (no `Object.freeze`/`readonly` wrapping) to stay assignable to
 * them; nothing downstream mutates these values regardless.
 */
function deriveResource(entry: MappedBootstrapResource, generatedAt: string): AriaResourceRecord {
  const bootstrap = entry.bootstrapVersion;
  const version: AriaResourceVersionRecord = {
    resourceVersionId: bootstrap.resource_version_id,
    versionLabel: 'v1',
    status: 'ACTIVE',
    // No independent publication timestamp exists on a bootstrap resource
    // version — the inventory's own `generated_at` (when RAG audited and
    // sealed this identity) is the one real, non-invented timestamp
    // available, and stands in for it.
    publishedAt: generatedAt,
    retiredAt: null,
    contentSha256: bootstrap.content_sha256,
    sizeBytes: bootstrap.size_bytes,
    mimeType: 'application/pdf',
    storage: { provider: 'RAG_GOVERNED' as const },
  };
  return {
    resourceId: bootstrap.resource_id,
    legacyAliases: [],
    placements: entry.courseKeys.map((courseKey) => ({ courseKey })),
    title: bootstrap.source_label,
    description: `Ressource officielle importée depuis RAG (${bootstrap.source_kind}).`,
    type: entry.registryType,
    status: 'ACTIVE',
    activeVersionId: bootstrap.resource_version_id,
    visibility: 'PUBLIC',
    ownerStudentId: null,
    source: {
      label: bootstrap.source_label,
      uri: bootstrap.source_uri,
      reference: bootstrap.rag_artifact_id,
      official: true,
      rights: 'OFFICIAL_PUBLIC' as const,
    },
    versions: [version],
  };
}

// ── Step 4: registry diff ───────────────────────────────────────────────

export interface ResourceRegistryDiff {
  readonly additions: readonly AriaResourceRecord[];
  readonly alreadyPresent: readonly string[];
  readonly conflicts: readonly { readonly resourceId: string; readonly reason: string }[];
}

function contentEquals(a: unknown, b: unknown): boolean {
  return sha256AriaRagJson(a) === sha256AriaRagJson(b);
}

/** Pure. Never mutates `currentRegistry`. */
export function computeResourceRegistryDiff(
  currentRegistry: AriaResourceRegistryDocument,
  mapped: readonly MappedBootstrapResource[],
  generatedAt: string,
): ResourceRegistryDiff {
  const byId = new Map(currentRegistry.resources.map((resource) => [resource.resourceId, resource]));
  const additions: AriaResourceRecord[] = [];
  const alreadyPresent: string[] = [];
  const conflicts: { resourceId: string; reason: string }[] = [];

  for (const entry of mapped) {
    const candidate = deriveResource(entry, generatedAt);
    const existing = byId.get(candidate.resourceId);
    if (!existing) {
      additions.push(candidate);
      continue;
    }
    if (contentEquals(existing, candidate)) {
      alreadyPresent.push(candidate.resourceId);
    } else {
      conflicts.push({
        resourceId: candidate.resourceId,
        reason: 'resourceId already exists in the registry with different content',
      });
    }
  }

  return Object.freeze({
    additions: Object.freeze(additions),
    alreadyPresent: Object.freeze(alreadyPresent),
    conflicts: Object.freeze(conflicts),
  });
}

// ── Step 5: deterministic import ────────────────────────────────────────

function sortResources(resources: readonly AriaResourceRecord[]): readonly AriaResourceRecord[] {
  return Object.freeze([...resources].sort((left, right) => left.resourceId.localeCompare(right.resourceId)));
}

/**
 * Pure. Never mutates `currentRegistry`. Throws `REGISTRY_CONFLICT` if
 * `diff.conflicts` is non-empty — callers must resolve every conflict, this
 * function never silently overwrites an existing resource.
 */
export function applyResourceRegistryImport(
  currentRegistry: AriaResourceRegistryDocument,
  diff: ResourceRegistryDiff,
): AriaResourceRegistryDocument {
  if (diff.conflicts.length > 0) {
    throw new AriaN4bImportError(
      'REGISTRY_CONFLICT',
      diff.conflicts.map((conflict) => `${conflict.resourceId}: ${conflict.reason}`),
    );
  }
  return Object.freeze({
    ...currentRegistry,
    resources: sortResources([...currentRegistry.resources, ...diff.additions]),
  });
}

// ── Step 6: exact registry SHA + snapshot ───────────────────────────────

export function computeRegistrySha256(registry: AriaResourceRegistryDocument): string {
  return sha256AriaRagJson(registry);
}

export function buildResourceRegistrySnapshot(input: {
  readonly registry: AriaResourceRegistryDocument;
  readonly inventory: BootstrapInventory;
  readonly nexusProducerCommit: string;
  readonly generatedAt: string;
}): ResourceRegistrySnapshot {
  const snapshot: ResourceRegistrySnapshot = Object.freeze({
    protocol_version: '1' as const,
    registry_version: input.registry.registryVersion,
    producer_repository: 'cyranoaladin/nexus-project_v0' as const,
    producer_commit: input.nexusProducerCommit,
    generated_at: input.generatedAt,
    bootstrap_inventory_sha256: input.inventory.inventory_sha256,
    resources: Object.freeze(
      input.registry.resources.map((resource) => {
        const active = resource.versions.find(
          (version) => version.resourceVersionId === resource.activeVersionId,
        ) ?? resource.versions[0]!;
        return Object.freeze({
          resource_id: resource.resourceId,
          resource_version_id: active.resourceVersionId,
          content_sha256: active.contentSha256,
        });
      }),
    ),
    registry_sha256: computeRegistrySha256(input.registry),
  });
  return validateResourceRegistrySnapshot(snapshot);
}
