/**
 * Planning Studio — service de persistance (double en mémoire).
 * Couvre : initialisation idempotente, verrou optimiste (409), validation
 * serveur (422 : structure, conflits bloquants, taille), restauration et
 * réinitialisation créant de nouvelles révisions, résumés lisibles.
 */
import {
  createPlanningStudioService,
  describe as describeRevision,
  PlanningConflictError,
  PlanningNotFoundError,
  PlanningValidationError,
  type DocumentRecord,
  type PlanningDb,
  type PlanningTx,
  type RevisionRecord,
} from '@/lib/planning-studio/service';
import { PLANNING_BOOTSTRAP, getPlanningEngine, type PlanningPayload } from '@/lib/planning-studio/engine';
import { hashPayload, validatePlanningPayload, PLANNING_PAYLOAD_MAX_BYTES } from '@/lib/planning-studio/validate-payload';

/** Double en mémoire reproduisant la sémantique Prisma utilisée par le service. */
function createFakeDb() {
  const documents: DocumentRecord[] = [];
  const revisions: RevisionRecord[] = [];
  let seq = 0;
  const users: Record<string, { id: string; firstName: string; lastName: string; email: string; role: string }> = {
    'admin-1': { id: 'admin-1', firstName: 'Alaeddine', lastName: 'Ben Rhouma', email: 'admin@example.test', role: 'ADMIN' },
    'assist-1': { id: 'assist-1', firstName: 'Sonia', lastName: 'Assistante', email: 'assist@example.test', role: 'ASSISTANTE' },
  };
  const withUser = (doc: DocumentRecord | null) => (doc ? { ...doc, updatedBy: doc.updatedById ? users[doc.updatedById] ?? null : null } : null);
  const tx: PlanningTx = {
    planningStudioDocument: {
      async findUnique({ where }) {
        return withUser(documents.find((d) => d.academicYear === where.academicYear) ?? null);
      },
      async create({ data }) {
        if (documents.some((d) => d.academicYear === data.academicYear)) {
          const err = new Error('Unique constraint') as Error & { code: string };
          err.code = 'P2002';
          throw err;
        }
        const now = new Date();
        const doc: DocumentRecord = {
          id: 'doc-' + (++seq), academicYear: data.academicYear as string, schemaVersion: data.schemaVersion as number,
          revision: data.revision as number, payload: data.payload, payloadHash: data.payloadHash as string,
          createdAt: now, updatedAt: now, updatedById: (data.updatedById as string | null) ?? null,
        };
        documents.push(doc);
        return doc;
      },
      async updateMany({ where, data }) {
        const doc = documents.find((d) => d.id === where.id && d.revision === where.revision);
        if (!doc) return { count: 0 };
        Object.assign(doc, data, { updatedAt: new Date() });
        return { count: 1 };
      },
    },
    planningStudioRevision: {
      async create({ data }) {
        if (revisions.some((r) => r.documentId === data.documentId && r.revision === data.revision)) {
          const err = new Error('Unique constraint') as Error & { code: string };
          err.code = 'P2002';
          throw err;
        }
        const row: RevisionRecord = {
          id: 'rev-' + (++seq), documentId: data.documentId as string, revision: data.revision as number,
          action: data.action as RevisionRecord['action'], summary: (data.summary as string | null) ?? null,
          payload: data.payload, payloadHash: data.payloadHash as string, createdAt: new Date(),
          createdById: (data.createdById as string | null) ?? null,
        };
        revisions.push(row);
        return row;
      },
      async findMany({ where, orderBy, take }) {
        const rows = revisions.filter((r) => r.documentId === where.documentId)
          .sort((a, b) => (orderBy.revision === 'desc' ? b.revision - a.revision : a.revision - b.revision))
          .slice(0, take ?? rows_default);
        return rows.map((r) => ({ ...r, createdBy: r.createdById ? users[r.createdById] ?? null : null }));
      },
      async findUnique({ where }) {
        return revisions.find((r) => r.documentId === where.documentId_revision.documentId && r.revision === where.documentId_revision.revision) ?? null;
      },
    },
  };
  const rows_default = 1000;
  const db: PlanningDb = {
    async $transaction(fn) {
      // Transaction simulée : snapshot + rollback en cas d'exception.
      const docsSnapshot = documents.map((d) => ({ ...d }));
      const revSnapshot = revisions.map((r) => ({ ...r }));
      try {
        return await fn(tx);
      } catch (err) {
        documents.splice(0, documents.length, ...docsSnapshot);
        revisions.splice(0, revisions.length, ...revSnapshot);
        throw err;
      }
    },
    planningStudioDocument: tx.planningStudioDocument,
    planningStudioRevision: tx.planningStudioRevision,
  };
  return { db, documents, revisions };
}

function bootstrapPayload(): PlanningPayload {
  return getPlanningEngine().normalize(PLANNING_BOOTSTRAP);
}

describe('validatePlanningPayload', () => {
  it('accepte le planning livré (45 séances, 0 erreur)', () => {
    const v = validatePlanningPayload(PLANNING_BOOTSTRAP);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.stats.sessions).toBe(45);
      expect(v.stats.activeSessions).toBe(44);
      expect(v.hash).toHaveLength(64);
    }
  });

  it('refuse une structure invalide', () => {
    expect(validatePlanningPayload(null).ok).toBe(false);
    expect(validatePlanningPayload([]).ok).toBe(false);
    expect(validatePlanningPayload({ sessions: 'x' }).ok).toBe(false);
    const bad = bootstrapPayload();
    bad.sessions[0].start = '99:99';
    const v = validatePlanningPayload(bad);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors[0]).toMatch(/début/);
  });

  it('refuse un schemaVersion futur', () => {
    const v = validatePlanningPayload({ ...bootstrapPayload(), schemaVersion: 99 });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors[0]).toMatch(/schemaVersion 99/);
  });

  it('refuse les conflits bloquants (enseignant simultané)', () => {
    const p = bootstrapPayload();
    const nsi = p.sessions.find((s) => s.id === 'SAT-1115-T-NSI')!;
    nsi.start = '09:30'; nsi.end = '11:30';
    const v = validatePlanningPayload(p);
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.blocking.some((b) => b.code === 'TEACHER_OVERLAP')).toBe(true);
      expect(v.blocking.some((b) => b.code === 'ROOM_OVERLAP')).toBe(true);
    }
  });

  it('refuse une charge utile trop volumineuse', () => {
    const p = bootstrapPayload() as PlanningPayload & { meta: { source: string } };
    p.meta.source = 'x'.repeat(PLANNING_PAYLOAD_MAX_BYTES + 10);
    const v = validatePlanningPayload(p);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors[0]).toMatch(/volumineux/);
  });

  it('ignore les clés inconnues (liste blanche) et convertit le format v1', () => {
    const raw = { ...bootstrapPayload(), injected: '<script>', sessions: bootstrapPayload().sessions.map((s) => ({ ...s, evil: true })) };
    const v = validatePlanningPayload(raw);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect((v.payload as unknown as Record<string, unknown>).injected).toBeUndefined();
      expect((v.payload.sessions[0] as unknown as Record<string, unknown>).evil).toBeUndefined();
    }
  });
});

describe('Planning Studio — service', () => {
  it('initialise le document une seule fois (idempotent) depuis le planning livré', async () => {
    const { db, documents, revisions } = createFakeDb();
    const service = createPlanningStudioService(db, '2026-2027');
    const first = await service.getOrInitDocument('admin-1');
    const second = await service.getOrInitDocument('assist-1');
    expect(first.initialized).toBe(true);
    expect(second.initialized).toBe(false);
    expect(documents).toHaveLength(1);
    expect(revisions).toHaveLength(1);
    expect(revisions[0].action).toBe('INIT');
    expect(first.revision).toBe(1);
    expect(first.payloadHash).toBe(hashPayload(bootstrapPayload()));
  });

  it('enregistre une révision et incrémente la révision courante', async () => {
    const { db, revisions } = createFakeDb();
    const service = createPlanningStudioService(db, '2026-2027');
    const doc = await service.getOrInitDocument('admin-1');
    const payload = bootstrapPayload();
    payload.teachers[0].name = 'Alaeddine Ben Rhouma';
    const result = await service.saveDocument({ expectedRevision: doc.revision, payload, actorId: 'admin-1' });
    expect(result.revision).toBe(2);
    expect(revisions.map((r) => r.revision)).toEqual([1, 2]);
    expect(revisions[1].summary).toMatch(/configuration : enseignants/);
    const reloaded = await service.getOrInitDocument(null);
    expect((reloaded.payload as PlanningPayload).teachers[0].name).toBe('Alaeddine Ben Rhouma');
    expect(reloaded.updatedById).toBe('admin-1');
  });

  it('verrou optimiste : une écriture sur une révision périmée est refusée sans perte', async () => {
    const { db } = createFakeDb();
    const service = createPlanningStudioService(db, '2026-2027');
    const doc = await service.getOrInitDocument('admin-1');
    const adminPayload = bootstrapPayload();
    adminPayload.teachers[0].name = 'Alaeddine';
    const assistPayload = bootstrapPayload();
    assistPayload.rooms[0].name = 'Salle Nord';
    await service.saveDocument({ expectedRevision: doc.revision, payload: adminPayload, actorId: 'admin-1' });
    await expect(service.saveDocument({ expectedRevision: doc.revision, payload: assistPayload, actorId: 'assist-1' }))
      .rejects.toBeInstanceOf(PlanningConflictError);
    try {
      await service.saveDocument({ expectedRevision: doc.revision, payload: assistPayload, actorId: 'assist-1' });
    } catch (err) {
      const conflict = err as PlanningConflictError;
      expect(conflict.currentRevision).toBe(2);
      expect(conflict.updatedBy?.name).toBe('Alaeddine Ben Rhouma');
    }
    const current = await service.getOrInitDocument(null);
    expect(current.revision).toBe(2);
    expect((current.payload as PlanningPayload).teachers[0].name).toBe('Alaeddine');
    expect((current.payload as PlanningPayload).rooms[0].name).toBe('Salle 1');
  });

  it('refuse un planning invalide (422) sans créer de révision', async () => {
    const { db, revisions } = createFakeDb();
    const service = createPlanningStudioService(db, '2026-2027');
    const doc = await service.getOrInitDocument(null);
    const bad = bootstrapPayload();
    bad.sessions[1].teacherId = bad.sessions[0].teacherId;
    bad.sessions[1].day = bad.sessions[0].day;
    bad.sessions[1].start = bad.sessions[0].start;
    bad.sessions[1].end = bad.sessions[0].end;
    await expect(service.saveDocument({ expectedRevision: doc.revision, payload: bad, actorId: 'admin-1' }))
      .rejects.toBeInstanceOf(PlanningValidationError);
    expect(revisions).toHaveLength(1);
  });

  it('restaure une révision antérieure en créant une nouvelle révision', async () => {
    const { db, revisions } = createFakeDb();
    const service = createPlanningStudioService(db, '2026-2027');
    const doc = await service.getOrInitDocument('admin-1');
    const p2 = bootstrapPayload(); p2.teachers[0].name = 'Version 2';
    const r2 = await service.saveDocument({ expectedRevision: doc.revision, payload: p2, actorId: 'admin-1' });
    const p3 = bootstrapPayload(); p3.teachers[0].name = 'Version 3';
    const r3 = await service.saveDocument({ expectedRevision: r2.revision, payload: p3, actorId: 'assist-1' });
    const restored = await service.restoreRevision({ revision: 1, expectedRevision: r3.revision, actorId: 'admin-1' });
    expect(restored.revision).toBe(4);
    expect(revisions).toHaveLength(4);
    expect(revisions[3].action).toBe('RESTORE');
    expect(revisions[3].summary).toBe('Restauration de la révision 1');
    const current = await service.getOrInitDocument(null);
    expect(current.payloadHash).toBe(revisions[0].payloadHash);
    await expect(service.getRevision(99)).rejects.toBeInstanceOf(PlanningNotFoundError);
    const list = await service.listRevisions(10);
    expect(list.map((r) => r.revision)).toEqual([4, 3, 2, 1]);
    expect(list[0].createdBy?.name).toBe('Alaeddine Ben Rhouma');
  });

  it('réinitialise au planning livré via une révision RESET', async () => {
    const { db, revisions } = createFakeDb();
    const service = createPlanningStudioService(db, '2026-2027');
    const doc = await service.getOrInitDocument('admin-1');
    const p2 = bootstrapPayload(); p2.sessions = p2.sessions.slice(0, 10);
    const r2 = await service.saveDocument({ expectedRevision: doc.revision, payload: p2, actorId: 'admin-1' });
    const reset = await service.resetToBootstrap({ expectedRevision: r2.revision, actorId: 'admin-1' });
    expect(reset.revision).toBe(3);
    expect(reset.stats.sessions).toBe(45);
    expect(revisions[2].action).toBe('RESET');
  });

  it('résumé lisible des différences', () => {
    const a = bootstrapPayload();
    const b = bootstrapPayload();
    b.sessions.pop();
    b.sessions[0].start = '10:00'; b.sessions[0].end = '12:00';
    b.sessions.push({ ...a.sessions[0], id: 'nouvelle' });
    expect(describeRevision(a, b)).toMatch(/\+1 séance, −1 séance, 1 modifiée/);
    expect(describeRevision(null, a)).toMatch(/^45 séances \(44 actives\)/);
  });
});
