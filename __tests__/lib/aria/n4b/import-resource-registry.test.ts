import {
  AriaN4bImportError,
  applyResourceRegistryImport,
  assertNotHistoricalRelease,
  buildResourceRegistrySnapshot,
  computeRegistrySha256,
  computeResourceRegistryDiff,
  HISTORICAL_RAG_RELEASE_PRODUCER_COMMIT,
  HISTORICAL_RAG_RELEASE_PRODUCER_REPOSITORY,
  mapInventoryPlacements,
  validateBootstrapInventory,
  type AriaResourceRegistryDocument,
  type BootstrapInventory,
  type BootstrapResourceVersion,
} from '@/lib/aria/n4b/import-resource-registry';

const EMPTY_REGISTRY: AriaResourceRegistryDocument = Object.freeze({
  schemaVersion: '2',
  registryVersion: 'aria-resource-registry-test.0',
  idNamespace: '8c63b9aa-7d72-5fa2-a34c-82f8ee13254e',
  resources: Object.freeze([]),
});

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const RAG_ARTIFACT_A = 'c'.repeat(64);

function nsiPremiereResourceVersion(overrides: Partial<BootstrapResourceVersion> = {}): BootstrapResourceVersion {
  return {
    resource_id: '11111111-1111-4111-8111-111111111111',
    resource_version_id: '22222222-2222-4222-8222-222222222222',
    content_sha256: SHA_A,
    rag_artifact_id: RAG_ARTIFACT_A,
    size_bytes: 12_345,
    mime_type: 'application/pdf',
    source_label: 'Fiche méthode NSI — récursivité',
    source_uri: 'https://example.invalid/nsi-recursivite.pdf',
    rights: 'officiel_public',
    official: true,
    source_kind: 'eduscol',
    type_doc: 'fiche_methode',
    placements: [
      {
        tenant: 'nexus_reussite',
        collection: 'nsi_premiere',
        niveau: 'premiere',
        voie: 'generale',
        matiere: 'nsi',
        candidat: 'libre',
        audience: ['libre'],
        visibility: 'public',
        school_year: '2026-2027',
        programme_version: 'v1',
        statut_enseignement: 'specialite',
      },
    ],
    chunks: [{ chunk_id: 'chunk-1', locator: {} }],
    ...overrides,
  };
}

function inventory(overrides: Partial<BootstrapInventory> = {}, resources = [nsiPremiereResourceVersion()]): BootstrapInventory {
  return {
    protocol_version: '1',
    producer_repository: 'cyranoaladin/RAG',
    producer_commit: 'a'.repeat(40),
    package_version: '2.0.0',
    source_snapshot_sha256: SHA_B,
    generated_at: '2026-09-10T00:00:00.000Z',
    resources,
    inventory_sha256: SHA_A,
    ...overrides,
  };
}

describe('validateBootstrapInventory', () => {
  it('accepts a well-formed inventory', () => {
    expect(() => validateBootstrapInventory(inventory())).not.toThrow();
  });

  it('fails closed on a structurally malformed inventory, before any mapping/diff logic runs', () => {
    expect(() => validateBootstrapInventory({ not: 'an inventory' })).toThrow(AriaN4bImportError);
    try {
      validateBootstrapInventory({ not: 'an inventory' });
    } catch (error) {
      expect(error).toBeInstanceOf(AriaN4bImportError);
      expect((error as AriaN4bImportError).code).toBe('INVENTORY_SCHEMA_INVALID');
    }
  });
});

describe('assertNotHistoricalRelease', () => {
  it('refuses an inventory declaring the historical, immutable release identity', () => {
    const historical = validateBootstrapInventory(inventory({
      producer_repository: HISTORICAL_RAG_RELEASE_PRODUCER_REPOSITORY,
      producer_commit: HISTORICAL_RAG_RELEASE_PRODUCER_COMMIT,
    }));
    expect(() => assertNotHistoricalRelease(historical)).toThrow(AriaN4bImportError);
    try {
      assertNotHistoricalRelease(historical);
    } catch (error) {
      expect((error as AriaN4bImportError).code).toBe('HISTORICAL_RELEASE_REUSE_FORBIDDEN');
    }
  });

  // Fixture release: "production-profile-gate-2026-2027-v2-TEST-FIXTURE-DO-NOT-USE".
  // The bootstrap schema has no free-text release-name field — only
  // producer_repository+producer_commit identify a release — so the
  // distinguishing fixture value below is the commit, not a label.
  it('accepts a non-historical (test fixture) release identity — same repository, different commit', () => {
    const nonHistorical = validateBootstrapInventory(inventory({
      producer_repository: HISTORICAL_RAG_RELEASE_PRODUCER_REPOSITORY,
      producer_commit: 'f'.repeat(40),
    }));
    expect(() => assertNotHistoricalRelease(nonHistorical)).not.toThrow();
  });
});

describe('mapInventoryPlacements', () => {
  it('maps a valid, officiel_public, fiche_methode PDF resource to its real courseKey', () => {
    const result = mapInventoryPlacements(inventory());
    expect(result.failures).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.mapped).toHaveLength(1);
    expect(result.mapped[0]!.courseKeys).toEqual(['eds-nsi-premiere']);
    expect(result.mapped[0]!.registryType).toBe('METHODE');
  });

  it('skips (never fails the whole import for) a resource with unsupported rights', () => {
    const result = mapInventoryPlacements(inventory({}, [
      nsiPremiereResourceVersion({ rights: 'usage_interne', resource_version_id: '33333333-3333-4333-8333-333333333333' }),
    ]));
    expect(result.mapped).toEqual([]);
    expect(result.failures).toEqual([]);
    expect(result.skipped).toEqual([
      { resourceVersionId: '33333333-3333-4333-8333-333333333333', reason: 'UNSUPPORTED_RIGHTS' },
    ]);
  });

  it('skips a resource whose mime type is not application/pdf even if type_doc would otherwise map', () => {
    const result = mapInventoryPlacements(inventory({}, [
      nsiPremiereResourceVersion({ mime_type: 'text/markdown', resource_version_id: '44444444-4444-4444-8444-444444444444' }),
    ]));
    expect(result.mapped).toEqual([]);
    expect(result.skipped).toEqual([
      { resourceVersionId: '44444444-4444-4444-8444-444444444444', reason: 'UNSUPPORTED_TYPE_DOC_OR_MIME' },
    ]);
  });

  it('falls back to the generic PDF type for an unmapped type_doc on a real PDF', () => {
    const result = mapInventoryPlacements(inventory({}, [
      nsiPremiereResourceVersion({ type_doc: 'diaporama', resource_version_id: '55555555-5555-4555-8555-555555555555' }),
    ]));
    expect(result.mapped).toHaveLength(1);
    expect(result.mapped[0]!.registryType).toBe('PDF');
  });

  it('fails closed (never guesses) when a placement is unmapped — collects every failure rather than stopping at the first', () => {
    const result = mapInventoryPlacements(inventory({}, [
      nsiPremiereResourceVersion({
        resource_version_id: '66666666-6666-4666-8666-666666666666',
        placements: [
          {
            tenant: 'nexus_reussite',
            collection: 'unknown_collection',
            niveau: 'seconde',
            voie: 'college',
            matiere: 'philosophie',
            candidat: 'libre',
            audience: ['libre'],
            visibility: 'public',
            school_year: '2026-2027',
            programme_version: 'v1',
            statut_enseignement: 'tronc_commun',
          },
        ],
      }),
    ]));
    expect(result.mapped).toEqual([]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]!.kind).toBe('PLACEMENT_UNKNOWN');
  });
});

describe('computeResourceRegistryDiff + applyResourceRegistryImport', () => {
  it('produces a correct addition against an empty registry and never mutates its input', () => {
    const { mapped } = mapInventoryPlacements(inventory());
    const diff = computeResourceRegistryDiff(EMPTY_REGISTRY, mapped, '2026-09-10T00:00:00.000Z');
    expect(diff.additions).toHaveLength(1);
    expect(diff.additions[0]!.resourceId).toBe('11111111-1111-4111-8111-111111111111');
    expect(diff.additions[0]!.versions[0]!.storage).toEqual({ provider: 'RAG_GOVERNED' });
    expect(diff.alreadyPresent).toEqual([]);
    expect(diff.conflicts).toEqual([]);
    expect(EMPTY_REGISTRY.resources).toEqual([]); // input untouched

    const next = applyResourceRegistryImport(EMPTY_REGISTRY, diff);
    expect(next.resources).toHaveLength(1);
    expect(EMPTY_REGISTRY.resources).toEqual([]); // still untouched after apply
  });

  it('is idempotent: importing the same inventory twice yields zero new additions the second time', () => {
    const { mapped } = mapInventoryPlacements(inventory());
    const firstDiff = computeResourceRegistryDiff(EMPTY_REGISTRY, mapped, '2026-09-10T00:00:00.000Z');
    const afterFirst = applyResourceRegistryImport(EMPTY_REGISTRY, firstDiff);

    const secondDiff = computeResourceRegistryDiff(afterFirst, mapped, '2026-09-10T00:00:00.000Z');
    expect(secondDiff.additions).toEqual([]);
    expect(secondDiff.alreadyPresent).toEqual(['11111111-1111-4111-8111-111111111111']);
    expect(secondDiff.conflicts).toEqual([]);

    const afterSecond = applyResourceRegistryImport(afterFirst, secondDiff);
    expect(computeRegistrySha256(afterSecond)).toBe(computeRegistrySha256(afterFirst));
  });

  it('detects a conflict when the same resourceId already exists with different content, and applyResourceRegistryImport refuses to write', () => {
    // AriaResourceRegistryDocument/AriaResourceRecord are z.infer (mutable)
    // shapes — plain object literals here, no Object.freeze/readonly.
    const existingRegistry: AriaResourceRegistryDocument = {
      ...EMPTY_REGISTRY,
      resources: [
        {
          resourceId: '11111111-1111-4111-8111-111111111111',
          legacyAliases: [],
          placements: [{ courseKey: 'eds-nsi-premiere' }],
          title: 'A completely different pre-existing title',
          description: 'Pre-existing, unrelated to the bootstrap import.',
          type: 'PDF' as const,
          status: 'ACTIVE' as const,
          activeVersionId: '22222222-2222-4222-8222-222222222222',
          visibility: 'PUBLIC' as const,
          ownerStudentId: null,
          source: {
            label: 'Different source',
            uri: 'https://example.invalid/different.pdf',
            reference: 'different-ref',
            official: true,
            rights: 'OFFICIAL_PUBLIC' as const,
          },
          versions: [{
            resourceVersionId: '22222222-2222-4222-8222-222222222222',
            versionLabel: 'v1',
            status: 'ACTIVE' as const,
            publishedAt: '2020-01-01T00:00:00.000Z',
            retiredAt: null,
            contentSha256: SHA_B,
            sizeBytes: 999,
            mimeType: 'application/pdf' as const,
            storage: { provider: 'RAG_GOVERNED' as const },
          }],
        },
      ],
    };

    const { mapped } = mapInventoryPlacements(inventory());
    const diff = computeResourceRegistryDiff(existingRegistry, mapped, '2026-09-10T00:00:00.000Z');
    expect(diff.additions).toEqual([]);
    expect(diff.conflicts).toHaveLength(1);
    expect(diff.conflicts[0]!.resourceId).toBe('11111111-1111-4111-8111-111111111111');

    expect(() => applyResourceRegistryImport(existingRegistry, diff)).toThrow(AriaN4bImportError);
    try {
      applyResourceRegistryImport(existingRegistry, diff);
    } catch (error) {
      expect((error as AriaN4bImportError).code).toBe('REGISTRY_CONFLICT');
    }
  });
});

describe('buildResourceRegistrySnapshot', () => {
  it('produces a schema-valid snapshot cross-referencing the bootstrap inventory and an exact registry SHA', () => {
    const { mapped } = mapInventoryPlacements(inventory());
    const diff = computeResourceRegistryDiff(EMPTY_REGISTRY, mapped, '2026-09-10T00:00:00.000Z');
    const registry = applyResourceRegistryImport(EMPTY_REGISTRY, diff);
    const snapshot = buildResourceRegistrySnapshot({
      registry,
      inventory: inventory(),
      nexusProducerCommit: 'b'.repeat(40),
      generatedAt: '2026-09-10T01:00:00.000Z',
    });
    expect(snapshot.producer_repository).toBe('cyranoaladin/nexus-project_v0');
    expect(snapshot.bootstrap_inventory_sha256).toBe(SHA_A);
    expect(snapshot.resources).toEqual([
      { resource_id: '11111111-1111-4111-8111-111111111111', resource_version_id: '22222222-2222-4222-8222-222222222222', content_sha256: SHA_A },
    ]);
    expect(snapshot.registry_sha256).toBe(computeRegistrySha256(registry));
  });

  it('excludes a RETIRED resource entirely while including an otherwise-identical ACTIVE one', () => {
    const { mapped } = mapInventoryPlacements(inventory());
    const diff = computeResourceRegistryDiff(EMPTY_REGISTRY, mapped, '2026-09-10T00:00:00.000Z');
    const activeOnlyRegistry = applyResourceRegistryImport(EMPTY_REGISTRY, diff);

    // A retired resource: no activeVersionId, its sole version RETIRED —
    // matches the existing fallback-to-versions[0] shape, per the schema's
    // own superRefine invariant for a retired resource.
    const retiredResource = {
      resourceId: '99999999-9999-4999-8999-999999999999',
      legacyAliases: [],
      placements: [{ courseKey: 'eds-nsi-terminale' }],
      title: 'Ancienne fiche retirée',
      description: 'Ressource retirée, ne doit jamais apparaître dans le snapshot.',
      type: 'PDF' as const,
      status: 'RETIRED' as const,
      activeVersionId: null,
      visibility: 'PUBLIC' as const,
      ownerStudentId: null,
      source: {
        label: 'Ancienne fiche retirée',
        uri: 'https://example.invalid/retired.pdf',
        reference: 'retired-ref',
        official: true,
        rights: 'OFFICIAL_PUBLIC' as const,
      },
      versions: [{
        resourceVersionId: '88888888-8888-4888-8888-888888888888',
        versionLabel: 'v1',
        status: 'RETIRED' as const,
        publishedAt: '2020-01-01T00:00:00.000Z',
        retiredAt: '2026-01-01T00:00:00.000Z',
        contentSha256: SHA_B,
        sizeBytes: 999,
        mimeType: 'application/pdf' as const,
        storage: { provider: 'RAG_GOVERNED' as const },
      }],
    };
    const registryWithRetired: AriaResourceRegistryDocument = {
      ...activeOnlyRegistry,
      resources: [...activeOnlyRegistry.resources, retiredResource],
    };

    const snapshot = buildResourceRegistrySnapshot({
      registry: registryWithRetired,
      inventory: inventory(),
      nexusProducerCommit: 'b'.repeat(40),
      generatedAt: '2026-09-10T01:00:00.000Z',
    });

    expect(snapshot.resources).toEqual([
      { resource_id: '11111111-1111-4111-8111-111111111111', resource_version_id: '22222222-2222-4222-8222-222222222222', content_sha256: SHA_A },
    ]);
    expect(snapshot.resources.some((entry) => entry.resource_id === '99999999-9999-4999-8999-999999999999')).toBe(false);
  });
});
