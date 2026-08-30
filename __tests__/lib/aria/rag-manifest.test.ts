import {
  computeAriaServableManifestSha256,
  resolveAriaRagCorpusCapability,
  type AriaServableCorpusManifest,
} from '@/lib/aria/infrastructure/rag/manifest';

function manifestFixture(): AriaServableCorpusManifest {
  const payload = {
    protocol_version: '1' as const,
    manifest_version: '2026.08.30.1',
    resource_registry_version: 'registry-v1',
    resource_registry_sha256: 'a'.repeat(64),
    producer_repository: 'nexus-reussite/rag',
    producer_commit: 'b'.repeat(40),
    generated_at: '2026-08-30T12:00:00+00:00',
    corpora: [{
      corpus_id: 'aria-maths-premiere',
      corpus_version_id: '2026.08.30.1',
      academic_year: '2026-2027',
      curriculum_version: 'fr-lycee-2026',
      physical_collection: 'maths_premiere_verified',
      scope_id: 'maths-premiere',
      scope_sha256: 'c'.repeat(64),
      resources: [{
        resource_id: '11111111-1111-4111-8111-111111111111',
        resource_version_id: '22222222-2222-4222-8222-222222222222',
        content_sha256: 'd'.repeat(64),
        chunks: [{ chunk_id: 'chunk-1', locator: { page: 1 } }],
      }],
    }],
  };
  return { ...payload, manifest_sha256: computeAriaServableManifestSha256(payload) };
}

describe('ARIA servable RAG manifest', () => {
  it('returns NOT_CONFIGURED without an imported companion manifest', () => {
    expect(resolveAriaRagCorpusCapability({
      courseKey: 'eds-maths-premiere',
      pedagogicalMode: 'DISCOVERY',
      agentRole: 'TUTOR',
      manifest: null,
      expectedResourceRegistrySha256: 'a'.repeat(64),
    })).toMatchObject({ status: 'NOT_CONFIGURED' });
  });

  it('resolves a physical collection only through the digest-verified companion manifest', () => {
    const manifest = manifestFixture();
    expect(resolveAriaRagCorpusCapability({
      courseKey: 'eds-maths-premiere',
      pedagogicalMode: 'DISCOVERY',
      agentRole: 'TUTOR',
      manifest,
      expectedResourceRegistrySha256: 'a'.repeat(64),
    })).toMatchObject({
      status: 'AVAILABLE',
      corpus: {
        corpusId: 'aria-maths-premiere',
        physicalCollection: 'maths_premiere_verified',
        manifestSha256: manifest.manifest_sha256,
      },
    });
  });

  it('fails closed on manifest, registry or corpus mismatch', () => {
    const manifest = manifestFixture();
    const badDigest = { ...manifest, manifest_sha256: 'e'.repeat(64) };
    for (const result of [
      resolveAriaRagCorpusCapability({
        courseKey: 'eds-maths-premiere', pedagogicalMode: 'DISCOVERY', agentRole: 'TUTOR',
        manifest: badDigest, expectedResourceRegistrySha256: 'a'.repeat(64),
      }),
      resolveAriaRagCorpusCapability({
        courseKey: 'eds-maths-premiere', pedagogicalMode: 'DISCOVERY', agentRole: 'TUTOR',
        manifest, expectedResourceRegistrySha256: 'f'.repeat(64),
      }),
      resolveAriaRagCorpusCapability({
        courseKey: 'eds-nsi-premiere', pedagogicalMode: 'DISCOVERY', agentRole: 'TUTOR',
        manifest, expectedResourceRegistrySha256: 'a'.repeat(64),
      }),
    ]) {
      expect(result.status).toBe('UNAVAILABLE');
    }
  });

  it('never approximates an undeclared STMG course to another corpus', () => {
    expect(resolveAriaRagCorpusCapability({
      courseKey: 'stmg-sgn-premiere',
      pedagogicalMode: 'DISCOVERY',
      agentRole: 'TUTOR',
      manifest: manifestFixture(),
      expectedResourceRegistrySha256: 'a'.repeat(64),
    })).toMatchObject({ status: 'NOT_CONFIGURED', reasonCode: 'COURSE_HAS_NO_DECLARED_CORPUS' });
  });
});
