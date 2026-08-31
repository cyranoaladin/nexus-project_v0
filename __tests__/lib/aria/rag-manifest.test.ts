import fixture from '@/data/aria/generated/rag-contracts/v1/fixtures/internal-identity-envelope-v1.json';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  computeAriaServableManifestSha256,
  loadConfiguredAriaServableManifest,
  resolveAriaRagCorpusCapability,
} from '@/lib/aria/infrastructure/rag/manifest';
import { resolveAriaCourseCorpusId } from '@/lib/aria/manifests/course-capabilities';
import {
  ARIA_RESOURCE_REGISTRY_SHA256,
  ARIA_RESOURCE_REGISTRY_VERSION,
} from '@/lib/aria/manifests/resource-registry';
import { sha256AriaRagJson } from '@/lib/aria/infrastructure/rag/internal-identity';

function manifestFixture() {
  const retrievalScope = {
    ...fixture.retrievalScope,
    scope_id: 'aria_maths_terminale_v1',
    target_policy: {
      ...fixture.retrievalScope.target_policy,
      niveau: 'terminale' as const,
    },
    evidence_subject: {
      ...fixture.retrievalScope.evidence_subject,
      niveau: 'terminale' as const,
      collection: 'rag_nexus_maths_terminale_gen_specialite',
    },
  };
  const payload = {
    protocol_version: '1' as const,
    manifest_version: '2026.08.30.1',
    resource_registry_version: ARIA_RESOURCE_REGISTRY_VERSION,
    resource_registry_sha256: ARIA_RESOURCE_REGISTRY_SHA256,
    producer_repository: 'cyranoaladin/RAG',
    producer_commit: 'b'.repeat(40),
    generated_at: '2026-08-30T12:00:00Z',
    corpora: [{
      corpus_id: 'aria-maths-terminale',
      corpus_version_id: fixture.request.corpus_version_id,
      academic_year: '2026-2027',
      curriculum_version: 'fr-national-2026',
      physical_collection: retrievalScope.evidence_subject.collection,
      retrieval_scope: retrievalScope,
      resources: [{
        resource_id: '202269df-9b59-5c61-aa20-1f13a7558910',
        resource_version_id: 'f69965ee-0e3a-51d9-ab4d-55f58a003beb',
        content_sha256: 'eb8369e7c1611e90f51491fecc5a7c2081a9c57f9c7fbb08d0414677b56ce16f',
        chunks: [{
          chunk_id: 'chunk-1',
          locator: {
            chunk_index: null,
            page: 1,
            page_start: null,
            page_end: null,
            section: null,
            start_char: null,
            end_char: null,
          },
        }],
      }],
    }],
  };
  return { ...payload, manifest_sha256: computeAriaServableManifestSha256(payload) };
}

function withRecomputedDigest<T extends Record<string, unknown>>(candidate: T) {
  const { manifest_sha256: _discarded, ...payload } = candidate;
  return { ...payload, manifest_sha256: computeAriaServableManifestSha256(payload) };
}

function resolveManifest(candidate: unknown, overrides: Readonly<{
  courseKey?: string;
  expectedResourceRegistrySha256?: string;
}> = {}) {
  return resolveAriaRagCorpusCapability({
    courseKey: overrides.courseKey ?? 'eds-maths-terminale',
    pedagogicalMode: 'DISCOVERY',
    agentRole: 'TUTOR',
    manifest: candidate,
    expectedResourceRegistrySha256:
      overrides.expectedResourceRegistrySha256 ?? ARIA_RESOURCE_REGISTRY_SHA256,
  });
}

describe('ARIA servable RAG manifest V3', () => {
  it('loads only a digest-addressed immutable manifest from an explicit runtime root', () => {
    const root = mkdtempSync(join(tmpdir(), 'aria-manifest-'));
    try {
      const manifest = manifestFixture();
      writeFileSync(
        join(root, `${manifest.manifest_sha256}.aria-rag-manifest`),
        JSON.stringify(manifest),
      );
      expect(loadConfiguredAriaServableManifest({
        ARIA_RAG_SERVABLE_MANIFEST_ROOT: root,
        ARIA_RAG_ACTIVE_MANIFEST_SHA256: manifest.manifest_sha256,
      })).toEqual(manifest);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed on partial configuration, digest mismatch, or a final symlink', () => {
    const root = mkdtempSync(join(tmpdir(), 'aria-manifest-'));
    try {
      const manifest = manifestFixture();
      expect(() => loadConfiguredAriaServableManifest({
        ARIA_RAG_SERVABLE_MANIFEST_ROOT: root,
      })).toThrow('ARIA_RAG_MANIFEST_CONFIGURATION_INVALID');
      writeFileSync(
        join(root, `${'f'.repeat(64)}.aria-rag-manifest`),
        JSON.stringify(manifest),
      );
      expect(() => loadConfiguredAriaServableManifest({
        ARIA_RAG_SERVABLE_MANIFEST_ROOT: root,
        ARIA_RAG_ACTIVE_MANIFEST_SHA256: 'f'.repeat(64),
      })).toThrow('ARIA_RAG_MANIFEST_DIGEST_MISMATCH');
      writeFileSync(join(root, 'target.aria-rag-manifest'), JSON.stringify(manifest));
      symlinkSync(
        join(root, 'target.aria-rag-manifest'),
        join(root, `${'e'.repeat(64)}.aria-rag-manifest`),
      );
      expect(() => loadConfiguredAriaServableManifest({
        ARIA_RAG_SERVABLE_MANIFEST_ROOT: root,
        ARIA_RAG_ACTIVE_MANIFEST_SHA256: 'e'.repeat(64),
      })).toThrow('ARIA_RAG_MANIFEST_FILE_UNSAFE');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('RAG_RUNTIME_MANIFEST_REJECTS_ANCESTOR_SYMLINK_ROOT', () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'aria-manifest-ancestor-'));
    try {
      const canonicalParent = join(sandbox, 'canonical-parent');
      const canonicalRoot = join(canonicalParent, 'runtime');
      mkdirSync(canonicalRoot, { recursive: true });
      const linkedParent = join(sandbox, 'linked-parent');
      symlinkSync(canonicalParent, linkedParent, 'dir');
      const manifest = manifestFixture();
      writeFileSync(
        join(canonicalRoot, `${manifest.manifest_sha256}.aria-rag-manifest`),
        JSON.stringify(manifest),
      );

      expect(() => loadConfiguredAriaServableManifest({
        ARIA_RAG_SERVABLE_MANIFEST_ROOT: join(linkedParent, 'runtime'),
        ARIA_RAG_ACTIVE_MANIFEST_SHA256: manifest.manifest_sha256,
      })).toThrow('ARIA_RAG_MANIFEST_FILE_UNSAFE');
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('U033 ARIA-B-R034 returns NOT_CONFIGURED without a promoted companion manifest', () => {
    expect(resolveAriaRagCorpusCapability({
      courseKey: 'eds-maths-premiere',
      pedagogicalMode: 'DISCOVERY',
      agentRole: 'TUTOR',
      manifest: null,
      expectedResourceRegistrySha256: ARIA_RESOURCE_REGISTRY_SHA256,
    })).toMatchObject({ status: 'NOT_CONFIGURED' });
  });

  it('resolves a physical collection only through the strict digest-verified V3 manifest', () => {
    const manifest = manifestFixture();
    expect(resolveAriaRagCorpusCapability({
      courseKey: 'eds-maths-terminale',
      pedagogicalMode: 'DISCOVERY',
      agentRole: 'TUTOR',
      manifest,
      expectedResourceRegistrySha256: ARIA_RESOURCE_REGISTRY_SHA256,
    })).toMatchObject({
      status: 'AVAILABLE',
      corpus: {
        corpusId: 'aria-maths-terminale',
        physicalCollection: 'rag_nexus_maths_terminale_gen_specialite',
        manifestSha256: manifest.manifest_sha256,
        retrievalScope: manifest.corpora[0].retrieval_scope,
        retrievalScopeSha256: sha256AriaRagJson(manifest.corpora[0].retrieval_scope),
      },
    });
  });

  it('resolves corpus identity from course + pedagogical mode + agent role', () => {
    expect(resolveAriaCourseCorpusId({
      courseKey: 'eds-maths-premiere', mode: 'DISCOVERY', agentRole: 'TUTOR',
    })).toBe('aria-maths-premiere');
    expect(resolveAriaCourseCorpusId({
      courseKey: 'eds-maths-premiere', mode: 'CORRECTION', agentRole: 'TUTOR',
    })).toBe('aria-maths-premiere');
    expect(resolveAriaCourseCorpusId({
      courseKey: 'eds-maths-premiere', mode: 'DISCOVERY', agentRole: 'COACH',
    })).toBeNull();
  });

  it('validates a multi-course manifest without treating another corpus as the requested course', () => {
    const manifest = manifestFixture();
    const { manifest_sha256: _oldDigest, ...payload } = manifest;
    expect(_oldDigest).toMatch(/^[0-9a-f]{64}$/);
    const mathsScope = manifest.corpora[0].retrieval_scope;
    const nsiScope = {
      ...mathsScope,
      scope_id: 'aria_nsi_terminale_v1',
      target_policy: {
        ...mathsScope.target_policy,
        matiere: 'nsi',
      },
      evidence_subject: {
        ...mathsScope.evidence_subject,
        matiere: 'nsi',
        collection: 'rag_nexus_nsi_terminale_gen_specialite',
      },
    };
    const multiPayload = {
      ...payload,
      corpora: [...payload.corpora, {
        corpus_id: 'aria-nsi-terminale',
        corpus_version_id: '2026-08-30.1',
        academic_year: '2026-2027',
        curriculum_version: 'fr-national-2026',
        physical_collection: nsiScope.evidence_subject.collection,
        retrieval_scope: nsiScope,
        resources: [{
          resource_id: '0ab79e77-4b86-59e5-ba3c-755893a2c591',
          resource_version_id: 'a2bb3436-4202-5f30-b2cd-bdb9fd0c7e31',
          content_sha256: '5ae36f4da9266c184c474a20644442ce5be00bf1427de3aab27b97b580f84590',
          chunks: [{
            chunk_id: 'nsi-chunk-1',
            locator: {
              chunk_index: 0, page: null, page_start: null, page_end: null,
              section: null, start_char: null, end_char: null,
            },
          }],
        }],
      }],
    };
    const multiManifest = {
      ...multiPayload,
      manifest_sha256: computeAriaServableManifestSha256(multiPayload),
    };

    expect(resolveAriaRagCorpusCapability({
      courseKey: 'eds-maths-terminale', pedagogicalMode: 'DISCOVERY', agentRole: 'TUTOR',
      manifest: multiManifest, expectedResourceRegistrySha256: ARIA_RESOURCE_REGISTRY_SHA256,
    }).status).toBe('AVAILABLE');
    expect(resolveAriaRagCorpusCapability({
      courseKey: 'eds-nsi-terminale', pedagogicalMode: 'DISCOVERY', agentRole: 'TUTOR',
      manifest: multiManifest, expectedResourceRegistrySha256: ARIA_RESOURCE_REGISTRY_SHA256,
    }).status).toBe('AVAILABLE');
  });

  it('U036 ARIA-B-R039 distinguishes schema, digest, registry, scope, and corpus failures', () => {
    const manifest = manifestFixture();
    expect(resolveManifest(withRecomputedDigest({ ...manifest, unknown: true })))
      .toMatchObject({ status: 'UNAVAILABLE', reasonCode: 'SERVABLE_MANIFEST_INVALID' });
    expect(resolveManifest({ ...manifest, manifest_sha256: 'e'.repeat(64) }))
      .toMatchObject({ status: 'UNAVAILABLE', reasonCode: 'SERVABLE_MANIFEST_DIGEST_MISMATCH' });
    expect(resolveManifest(manifest, { expectedResourceRegistrySha256: 'f'.repeat(64) }))
      .toMatchObject({ status: 'UNAVAILABLE', reasonCode: 'RESOURCE_REGISTRY_DIGEST_MISMATCH' });
    expect(resolveManifest(withRecomputedDigest({
      ...manifest,
      resource_registry_sha256: 'f'.repeat(64),
    }))).toMatchObject({ status: 'UNAVAILABLE', reasonCode: 'RESOURCE_REGISTRY_DIGEST_MISMATCH' });
    expect(resolveManifest(withRecomputedDigest({
      ...manifest,
      corpora: [{
        ...manifest.corpora[0],
        retrieval_scope: {
          ...manifest.corpora[0].retrieval_scope,
          evidence_subject: {
            ...manifest.corpora[0].retrieval_scope.evidence_subject,
            collection: 'different_collection',
          },
        },
      }],
    }))).toMatchObject({ status: 'UNAVAILABLE', reasonCode: 'SERVABLE_SCOPE_BINDING_MISMATCH' });
    expect(resolveManifest(manifest, { courseKey: 'eds-nsi-premiere' }))
      .toMatchObject({ status: 'UNAVAILABLE', reasonCode: 'DECLARED_CORPUS_NOT_SERVABLE' });
  });

  it('rejects semantic corpus and immutable document identity drift after digest validation', () => {
    const manifest = manifestFixture();
    const corpus = manifest.corpora[0];
    const resource = corpus.resources[0];
    const chunk = resource.chunks[0];
    const semanticFailures: readonly [unknown, string][] = [
      [withRecomputedDigest({ ...manifest, corpora: [corpus, corpus] }), 'SERVABLE_MANIFEST_INVALID'],
      [withRecomputedDigest({
        ...manifest,
        corpora: [{
          ...corpus,
          academic_year: '2026-2028',
          retrieval_scope: {
            ...corpus.retrieval_scope,
            evidence_subject: {
              ...corpus.retrieval_scope.evidence_subject,
              school_year: '2026-2028',
            },
          },
        }],
      }), 'SERVABLE_MANIFEST_INVALID'],
      [withRecomputedDigest({
        ...manifest,
        corpora: [{
          ...corpus,
          retrieval_scope: {
            ...corpus.retrieval_scope,
            evidence_subject: {
              ...corpus.retrieval_scope.evidence_subject,
              school_year: '2025-2026',
            },
          },
        }],
      }), 'SERVABLE_SCOPE_BINDING_MISMATCH'],
      [withRecomputedDigest({
        ...manifest,
        corpora: [{
          ...corpus,
          retrieval_scope: {
            ...corpus.retrieval_scope,
            evidence_subject: {
              ...corpus.retrieval_scope.evidence_subject,
              programme_version: 'fr-national-2025',
            },
          },
        }],
      }), 'SERVABLE_SCOPE_BINDING_MISMATCH'],
      [withRecomputedDigest({
        ...manifest,
        corpora: [{ ...corpus, resources: [resource, resource] }],
      }), 'SERVABLE_MANIFEST_INVALID'],
      [withRecomputedDigest({
        ...manifest,
        corpora: [{
          ...corpus,
          resources: [{ ...resource, content_sha256: 'f'.repeat(64) }],
        }],
      }), 'RESOURCE_VERSION_BINDING_MISMATCH'],
      [withRecomputedDigest({
        ...manifest,
        corpora: [{
          ...corpus,
          resources: [{ ...resource, chunks: [chunk, chunk] }],
        }],
      }), 'SERVABLE_MANIFEST_INVALID'],
      [withRecomputedDigest({
        ...manifest,
        corpora: [{
          ...corpus,
          resources: [{
            ...resource,
            chunks: [{
              ...chunk,
              locator: {
                chunk_index: null, page: null, page_start: null, page_end: null,
                section: null, start_char: null, end_char: null,
              },
            }],
          }],
        }],
      }), 'SERVABLE_MANIFEST_INVALID'],
      [withRecomputedDigest({
        ...manifest,
        corpora: [{
          ...corpus,
          resources: [{
            ...resource,
            chunks: [{
              ...chunk,
              locator: { ...chunk.locator, page: 1, page_start: 1, page_end: 2 },
            }],
          }],
        }],
      }), 'SERVABLE_MANIFEST_INVALID'],
    ];
    for (const [candidate, reasonCode] of semanticFailures) {
      expect(resolveManifest(candidate)).toMatchObject({ status: 'UNAVAILABLE', reasonCode });
    }
  });

  it.each([
    { chunk_index: null, page: null, page_start: 1, page_end: null, section: null, start_char: null, end_char: null },
    { chunk_index: null, page: null, page_start: 4, page_end: 3, section: null, start_char: null, end_char: null },
    { chunk_index: null, page: null, page_start: null, page_end: null, section: null, start_char: 1, end_char: null },
    { chunk_index: null, page: null, page_start: null, page_end: null, section: null, start_char: 4, end_char: 4 },
  ])('rejects inconsistent immutable chunk locator %#', (locator) => {
    const manifest = manifestFixture();
    const corpus = manifest.corpora[0];
    const resource = corpus.resources[0];
    const candidate = withRecomputedDigest({
      ...manifest,
      corpora: [{
        ...corpus,
        resources: [{
          ...resource,
          chunks: [{ ...resource.chunks[0], locator }],
        }],
      }],
    });
    expect(resolveManifest(candidate)).toMatchObject({
      status: 'UNAVAILABLE',
      reasonCode: 'SERVABLE_MANIFEST_INVALID',
    });
  });

  it('projects only non-null string and numeric locator identity fields', () => {
    const manifest = manifestFixture();
    const corpus = manifest.corpora[0];
    const resource = corpus.resources[0];
    const locator = {
      chunk_index: 3,
      page: null,
      page_start: null,
      page_end: null,
      section: 'Dérivation',
      start_char: null,
      end_char: null,
    };
    const candidate = withRecomputedDigest({
      ...manifest,
      corpora: [{
        ...corpus,
        resources: [{
          ...resource,
          chunks: [{ ...resource.chunks[0], locator }],
        }],
      }],
    });

    expect(resolveManifest(candidate)).toMatchObject({
      status: 'AVAILABLE',
      corpus: {
        resourceBindings: [{ chunks: [{ locator: { chunk_index: 3, section: 'Dérivation' } }] }],
      },
    });
  });

  it('never approximates an undeclared STMG course to another corpus', () => {
    expect(resolveAriaRagCorpusCapability({
      courseKey: 'stmg-sgn-premiere',
      pedagogicalMode: 'DISCOVERY',
      agentRole: 'TUTOR',
      manifest: manifestFixture(),
      expectedResourceRegistrySha256: ARIA_RESOURCE_REGISTRY_SHA256,
    })).toMatchObject({ status: 'NOT_CONFIGURED', reasonCode: 'COURSE_HAS_NO_DECLARED_CORPUS' });
  });
});
