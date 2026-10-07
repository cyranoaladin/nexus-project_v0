/** @jest-environment node */
jest.mock('@/lib/prisma', () => ({ prisma: { espaceLegacyLink: { findMany: jest.fn() } } }));
jest.mock('@/lib/documents/storage-root', () => ({ getDocumentStorageRoot: () => '/nonexistent-root' }));

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { prisma } from '@/lib/prisma';
import { MAX_SNAPSHOT_BYTES, getLegacyArchiveView, readLegacySnapshot } from '@/lib/espace/legacy/snapshot';

const findMany = prisma.espaceLegacyLink.findMany as jest.Mock;
let dir = '';

const trace = (id: string, alias = 'POO01') => ({
  id, alias, groupe: 'G1', session: 'S1', received: '2026-09-26T08:31:00Z', sha: 'abc',
  summary: { completedSteps: 3, requiredSteps: 7, currentStep: 'agir', elapsedSeconds: 600, updatedAt: '2026-09-26T08:30:00Z' },
  problem: null,
});
const snap = (traces: unknown[]) => ({ generatedAt: '2026-10-02T20:00:00Z', sourceSha256: 'a'.repeat(64), count: traces.length, traces });

beforeAll(async () => { dir = await mkdtemp(path.join(tmpdir(), 'snap-')); });
afterAll(async () => { await rm(dir, { recursive: true, force: true }); });
beforeEach(() => findMany.mockReset());

describe('instantané de l’archive POO', () => {
  it('absent : état vide propre, sans erreur', async () => {
    expect(await getLegacyArchiveView(path.join(dir, 'nope.json'))).toEqual({ state: 'ABSENT' });
  });

  it('chemin par défaut inexistant : traité comme absent', async () => {
    // getDocumentStorageRoot est mocké pour renvoyer un chemin inexistant
    expect(await getLegacyArchiveView()).toEqual({ state: 'ABSENT' });
  });

  it.each([
    ['JSON illisible', '{pas du json'],
    ['clé inattendue', JSON.stringify({ ...snap([]), extra: 1 })],
    ['empreinte invalide', JSON.stringify({ ...snap([]), sourceSha256: 'x' })],
    ['identifiant avec chemin', JSON.stringify(snap([trace('../../etc/passwd')]))],
  ])('fichier non fiable (%s) → INVALID', async (_n, content) => {
    const file = path.join(dir, `bad-${Math.random()}.json`);
    await writeFile(file, content);
    expect(await readLegacySnapshot(file)).toBe('INVALID');
  });

  it('fichier démesuré → INVALID sans le lire', async () => {
    const file = path.join(dir, 'big.json');
    await writeFile(file, ' '.repeat(MAX_SNAPSHOT_BYTES + 1));
    expect(await readLegacySnapshot(file)).toBe('INVALID');
  });

  it('vide : prêt, zéro trace', async () => {
    const file = path.join(dir, 'empty.json');
    await writeFile(file, JSON.stringify(snap([])));
    findMany.mockResolvedValue([]);
    expect(await getLegacyArchiveView(file)).toMatchObject({ state: 'READY', count: 0, traces: [] });
  });

  it('croise avec les liens en direct : « Non associé » par défaut, « Associé à … » si lié', async () => {
    const file = path.join(dir, 'two.json');
    await writeFile(file, JSON.stringify(snap([trace('a1b2c3d4e5f60001'), trace('a1b2c3d4e5f60002', 'POO02')])));
    findMany.mockResolvedValue([{ legacyTraceId: 'a1b2c3d4e5f60002', student: { firstName: 'Ada', lastName: 'A' } }]);
    const view = await getLegacyArchiveView(file);
    if (view.state !== 'READY') throw new Error('attendu READY');
    expect(view.traces.map((t) => [t.id, t.status, t.linkedTo])).toEqual([
      ['a1b2c3d4e5f60001', 'NON_ASSOCIE', null],
      ['a1b2c3d4e5f60002', 'ASSOCIE', 'Ada A'],
    ]);
  });

  it('n’écrit jamais : seul findMany est utilisé sur les liens', () => {
    expect(Object.keys(prisma.espaceLegacyLink)).toEqual(['findMany']);
  });
});
