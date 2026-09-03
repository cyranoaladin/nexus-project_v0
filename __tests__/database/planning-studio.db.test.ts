/**
 * Planning Studio — intégration PostgreSQL réelle (jest.config.db.js).
 * Prouve sur la vraie base : initialisation idempotente sous concurrence,
 * verrou optimiste transactionnel, cascade des révisions, restauration.
 *
 *   npm run planning:test:db   (DATABASE_URL vers une base jetable migrée)
 */
import { PrismaClient } from '@prisma/client';
import { createPlanningStudioService, PlanningConflictError, type PlanningDb } from '@/lib/planning-studio/service';
import { getPlanningEngine, PLANNING_BOOTSTRAP, type PlanningPayload } from '@/lib/planning-studio/engine';

const YEAR = 'test-' + Date.now();
const prisma = new PrismaClient();
const db = prisma as unknown as PlanningDb;

function payload(): PlanningPayload {
  return getPlanningEngine().normalize(PLANNING_BOOTSTRAP);
}

afterAll(async () => {
  await prisma.planningStudioDocument.deleteMany({ where: { academicYear: { startsWith: 'test-' } } });
  await prisma.$disconnect();
});

describe('Planning Studio — PostgreSQL', () => {
  it('initialisation concurrente : un seul document, une seule révision INIT', async () => {
    const service = createPlanningStudioService(db, YEAR);
    const results = await Promise.all([1, 2, 3, 4].map(() => service.getOrInitDocument(null)));
    const ids = new Set(results.map((r) => r.id));
    expect(ids.size).toBe(1);
    expect(results.filter((r) => r.initialized)).toHaveLength(1);
    const revisions = await prisma.planningStudioRevision.count({ where: { document: { academicYear: YEAR } } });
    expect(revisions).toBe(1);
  });

  it('verrou optimiste : deux écrivains sur la même révision, un seul gagne, aucune perte', async () => {
    const service = createPlanningStudioService(db, YEAR);
    const doc = await service.getOrInitDocument(null);
    const a = payload(); a.teachers[0].name = 'Écrivain A';
    const b = payload(); b.rooms[0].name = 'Écrivain B';
    const outcomes = await Promise.allSettled([
      service.saveDocument({ expectedRevision: doc.revision, payload: a, actorId: null }),
      service.saveDocument({ expectedRevision: doc.revision, payload: b, actorId: null }),
    ]);
    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o) => o.status === 'rejected') as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(PlanningConflictError);
    const current = await service.getOrInitDocument(null);
    expect(current.revision).toBe(doc.revision + 1);
    const rows = await prisma.planningStudioRevision.findMany({ where: { documentId: current.id }, orderBy: { revision: 'asc' } });
    expect(rows.map((r) => r.revision)).toEqual([1, 2]);
    expect(rows[1].payloadHash).toBe(current.payloadHash);
  });

  it('restauration : nouvelle révision, historique intact, payload identique', async () => {
    const service = createPlanningStudioService(db, YEAR);
    const current = await service.getOrInitDocument(null);
    const restored = await service.restoreRevision({ revision: 1, expectedRevision: current.revision, actorId: null });
    expect(restored.revision).toBe(current.revision + 1);
    const after = await service.getOrInitDocument(null);
    const first = await prisma.planningStudioRevision.findUnique({ where: { documentId_revision: { documentId: after.id, revision: 1 } } });
    expect(after.payloadHash).toBe(first?.payloadHash);
    expect(await prisma.planningStudioRevision.count({ where: { documentId: after.id } })).toBe(3);
  });

  it('suppression du document : révisions supprimées en cascade', async () => {
    const service = createPlanningStudioService(db, YEAR);
    const doc = await service.getOrInitDocument(null);
    await prisma.planningStudioDocument.delete({ where: { id: doc.id } });
    expect(await prisma.planningStudioRevision.count({ where: { documentId: doc.id } })).toBe(0);
  });
});
