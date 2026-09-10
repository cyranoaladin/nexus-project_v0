import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseArgs,
  runN4bImport,
} from '@/scripts/aria/import-resource-registry-bootstrap';
import type { AriaResourceRegistryDocument, BootstrapInventory, BootstrapResourceVersion } from '@/lib/aria/n4b/import-resource-registry';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const RAG_ARTIFACT_A = 'c'.repeat(64);

const EMPTY_REGISTRY: AriaResourceRegistryDocument = Object.freeze({
  schemaVersion: '2',
  registryVersion: 'aria-resource-registry-cli-test.0',
  idNamespace: '8c63b9aa-7d72-5fa2-a34c-82f8ee13254e',
  resources: Object.freeze([]),
});

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
    producer_commit: 'f'.repeat(40),
    package_version: '2.0.0',
    source_snapshot_sha256: SHA_B,
    generated_at: '2026-09-10T00:00:00.000Z',
    resources,
    inventory_sha256: SHA_A,
    ...overrides,
  };
}

let repoRoot: string;

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), 'aria-n4b-cli-test-'));
  mkdirSync(join(repoRoot, 'data', 'aria'), { recursive: true });
  writeFileSync(join(repoRoot, 'data', 'aria', 'resources.v2.json'), JSON.stringify(EMPTY_REGISTRY, null, 2));
  process.exitCode = undefined;
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
  process.exitCode = undefined;
});

function writeInventoryFixture(name: string, doc: BootstrapInventory): string {
  const path = join(repoRoot, name);
  writeFileSync(path, JSON.stringify(doc, null, 2));
  return name;
}

describe('parseArgs', () => {
  it('throws when --inventory is missing', () => {
    expect(() => parseArgs([])).toThrow('--inventory');
  });

  it('defaults apply to false and snapshotOutPath to null when neither flag is given', () => {
    expect(parseArgs(['--inventory', 'x.json'])).toEqual({
      inventoryPath: 'x.json',
      apply: false,
      snapshotOutPath: null,
    });
  });

  it('parses --apply and --snapshot-out when both are given', () => {
    expect(parseArgs(['--inventory', 'x.json', '--apply', '--snapshot-out', 'snap.json'])).toEqual({
      inventoryPath: 'x.json',
      apply: true,
      snapshotOutPath: 'snap.json',
    });
  });
});

describe('runN4bImport', () => {
  it('dry-run: reports the diff and never writes the registry', () => {
    const inventoryFile = writeInventoryFixture('inventory.json', inventory());
    runN4bImport({
      repositoryRoot: repoRoot,
      args: { inventoryPath: inventoryFile, apply: false, snapshotOutPath: null },
    });
    expect(process.exitCode).toBeUndefined();
    const registryOnDisk = JSON.parse(readFileSync(join(repoRoot, 'data', 'aria', 'resources.v2.json'), 'utf8'));
    expect(registryOnDisk.resources).toEqual([]);
  });

  it('apply: writes the registry with the new resource', () => {
    const inventoryFile = writeInventoryFixture('inventory.json', inventory());
    runN4bImport({
      repositoryRoot: repoRoot,
      args: { inventoryPath: inventoryFile, apply: true, snapshotOutPath: null },
    });
    expect(process.exitCode).toBeUndefined();
    const registryOnDisk = JSON.parse(readFileSync(join(repoRoot, 'data', 'aria', 'resources.v2.json'), 'utf8'));
    expect(registryOnDisk.resources).toHaveLength(1);
    expect(registryOnDisk.resources[0].resourceId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('apply with --snapshot-out: writes both the registry and the RAG-facing snapshot', () => {
    const inventoryFile = writeInventoryFixture('inventory.json', inventory());
    runN4bImport({
      repositoryRoot: repoRoot,
      args: { inventoryPath: inventoryFile, apply: true, snapshotOutPath: 'snapshot.json' },
    });
    expect(process.exitCode).toBeUndefined();
    const snapshotPath = join(repoRoot, 'snapshot.json');
    expect(existsSync(snapshotPath)).toBe(true);
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    expect(snapshot.resources).toHaveLength(1);
    expect(typeof snapshot.registry_sha256).toBe('string');
  });

  it('reports a resource skipped for unsupported rights, without failing the run', () => {
    const inventoryFile = writeInventoryFixture('inventory.json', inventory({}, [
      nsiPremiereResourceVersion({ rights: 'usage_interne', resource_version_id: '33333333-3333-4333-8333-333333333333' }),
    ]));
    runN4bImport({
      repositoryRoot: repoRoot,
      args: { inventoryPath: inventoryFile, apply: true, snapshotOutPath: null },
    });
    expect(process.exitCode).toBeUndefined();
    const registryOnDisk = JSON.parse(readFileSync(join(repoRoot, 'data', 'aria', 'resources.v2.json'), 'utf8'));
    expect(registryOnDisk.resources).toEqual([]);
  });

  it('fails closed and never writes when a placement cannot be mapped', () => {
    const inventoryFile = writeInventoryFixture('inventory.json', inventory({}, [
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
    runN4bImport({
      repositoryRoot: repoRoot,
      args: { inventoryPath: inventoryFile, apply: true, snapshotOutPath: null },
    });
    expect(process.exitCode).toBe(1);
    const registryOnDisk = JSON.parse(readFileSync(join(repoRoot, 'data', 'aria', 'resources.v2.json'), 'utf8'));
    expect(registryOnDisk.resources).toEqual([]);
  });

  it('fails closed and never writes when the derived entry conflicts with an existing, differently-shaped one', () => {
    const conflicting: AriaResourceRegistryDocument = {
      ...EMPTY_REGISTRY,
      resources: [{
        resourceId: '11111111-1111-4111-8111-111111111111',
        legacyAliases: [],
        placements: [{ courseKey: 'eds-nsi-terminale' }],
        title: 'Titre déjà différent',
        description: 'Une entrée existante avec un contenu différent.',
        type: 'PDF',
        status: 'ACTIVE',
        activeVersionId: '99999999-9999-4999-8999-999999999999',
        visibility: 'PUBLIC',
        ownerStudentId: null,
        source: {
          label: 'Titre déjà différent',
          uri: 'https://example.invalid/existing.pdf',
          reference: 'existing-ref',
          official: true,
          rights: 'OFFICIAL_PUBLIC',
        },
        versions: [{
          resourceVersionId: '99999999-9999-4999-8999-999999999999',
          versionLabel: 'v1',
          status: 'ACTIVE',
          publishedAt: '2020-01-01T00:00:00.000Z',
          retiredAt: null,
          contentSha256: SHA_B,
          sizeBytes: 999,
          mimeType: 'application/pdf',
          storage: { provider: 'RAG_GOVERNED' },
        }],
      }],
    };
    writeFileSync(join(repoRoot, 'data', 'aria', 'resources.v2.json'), JSON.stringify(conflicting, null, 2));
    const inventoryFile = writeInventoryFixture('inventory.json', inventory());

    runN4bImport({
      repositoryRoot: repoRoot,
      args: { inventoryPath: inventoryFile, apply: true, snapshotOutPath: null },
    });
    expect(process.exitCode).toBe(1);
    const registryOnDisk = JSON.parse(readFileSync(join(repoRoot, 'data', 'aria', 'resources.v2.json'), 'utf8'));
    expect(registryOnDisk).toEqual(conflicting);
  });
});
