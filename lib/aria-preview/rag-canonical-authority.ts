/**
 * Volumétrie canonique du corpus RAG, par identifiant de corpus ARIA.
 *
 * Ces chiffres proviennent de l'autorité Profile Gate versionnée dans le dépôt
 * RAG (`production-profile-gate-2026-2027-v1`, manifest sha256
 * `50162cad2ca5e19a5db8fdac44fe3b9ea021854d132c433c0cc7ff6445636efa`,
 * `subjects/rag_nexus_nsi_terminale_specialite.release.json`). Ce ne sont PAS
 * des mesures runtime : le corpus servable canonique n'est pas encore
 * reconstruit (TRACK B). Afficher ces nombres ne prétend jamais que le RAG est
 * qualifié — voir `ragStatus` dans `capability-status.ts`, toujours
 * `IN_QUALIFICATION` ou `NOT_CONFIGURED` dans cet aperçu.
 */

export interface RagCanonicalVolumetry {
  readonly releaseId: string;
  readonly physicalCollection: string;
  readonly expectedArtifacts: number;
  readonly expectedChunks: number;
}

const RAG_CANONICAL_VOLUMETRY_BY_CORPUS_ID: Readonly<Record<string, RagCanonicalVolumetry>> = Object.freeze({
  'aria-nsi-terminale': Object.freeze({
    releaseId: 'production-profile-gate-2026-2027-v1',
    physicalCollection: 'rag_nexus_nsi_terminale_specialite',
    expectedArtifacts: 47,
    expectedChunks: 904,
  }),
});

export function getRagCanonicalVolumetry(corpusId: string): RagCanonicalVolumetry | null {
  return RAG_CANONICAL_VOLUMETRY_BY_CORPUS_ID[corpusId] ?? null;
}
