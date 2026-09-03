/**
 * Service de persistance Nexus Planning Studio.
 *
 * Un document canonique par année scolaire + chaîne de révisions immuables.
 * Toute écriture est un verrou optimiste : elle porte la révision attendue et
 * échoue (PlanningConflictError) si un autre utilisateur a enregistré entre
 * temps. Jamais de « dernier écrivain gagne » silencieux.
 *
 * Le client base de données est injecté (`PlanningDb`) pour permettre des
 * tests unitaires avec un double en mémoire et des tests d'intégration avec
 * PostgreSQL réel.
 */
import type { PlanningStudioAction, Prisma } from '@prisma/client';
import { PLANNING_ACADEMIC_YEAR, PLANNING_BOOTSTRAP, getPlanningEngine, type PlanningPayload } from './engine';
import { hashPayload, planningStats, validatePlanningPayload, type PlanningStats } from './validate-payload';
import type { PlanningIssue } from './engine';

export class PlanningConflictError extends Error {
  readonly currentRevision: number;
  readonly updatedAt: Date;
  readonly updatedBy: ActorSummary | null;
  constructor(currentRevision: number, updatedAt: Date, updatedBy: ActorSummary | null) {
    super('PLANNING_REVISION_CONFLICT');
    this.name = 'PlanningConflictError';
    this.currentRevision = currentRevision;
    this.updatedAt = updatedAt;
    this.updatedBy = updatedBy;
  }
}

export class PlanningValidationError extends Error {
  readonly errors: string[];
  readonly blocking: PlanningIssue[];
  constructor(errors: string[], blocking: PlanningIssue[]) {
    super('PLANNING_PAYLOAD_INVALID');
    this.name = 'PlanningValidationError';
    this.errors = errors;
    this.blocking = blocking;
  }
}

export class PlanningNotFoundError extends Error {
  constructor(message = 'PLANNING_NOT_FOUND') {
    super(message);
    this.name = 'PlanningNotFoundError';
  }
}

export interface ActorSummary {
  id: string;
  name: string;
  role: string;
}

export interface DocumentRecord {
  id: string;
  academicYear: string;
  schemaVersion: number;
  revision: number;
  payload: unknown;
  payloadHash: string;
  createdAt: Date;
  updatedAt: Date;
  updatedById: string | null;
  updatedBy?: UserRef | null;
}

export interface RevisionRecord {
  id: string;
  documentId: string;
  revision: number;
  action: PlanningStudioAction;
  summary: string | null;
  payload: unknown;
  payloadHash: string;
  createdAt: Date;
  createdById: string | null;
  createdBy?: UserRef | null;
}

export interface UserRef {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: string;
}

/** Sous-ensemble du client Prisma utilisé par le service (injectable). */
export interface PlanningDb {
  $transaction<T>(fn: (tx: PlanningTx) => Promise<T>): Promise<T>;
  planningStudioDocument: PlanningTx['planningStudioDocument'];
  planningStudioRevision: PlanningTx['planningStudioRevision'];
}

export interface PlanningTx {
  planningStudioDocument: {
    findUnique(args: { where: { academicYear: string }; include?: { updatedBy: { select: UserSelect } } }): Promise<DocumentRecord | null>;
    create(args: { data: Record<string, unknown> }): Promise<DocumentRecord>;
    updateMany(args: { where: { id: string; revision: number }; data: Record<string, unknown> }): Promise<{ count: number }>;
  };
  planningStudioRevision: {
    create(args: { data: Record<string, unknown> }): Promise<RevisionRecord>;
    findMany(args: {
      where: { documentId: string };
      orderBy: { revision: 'desc' | 'asc' };
      take?: number;
      select?: Record<string, unknown>;
      include?: { createdBy: { select: UserSelect } };
    }): Promise<Array<Partial<RevisionRecord>>>;
    findUnique(args: { where: { documentId_revision: { documentId: string; revision: number } } }): Promise<RevisionRecord | null>;
  };
}

type UserSelect = { id: true; firstName: true; lastName: true; email: true; role: true };
const USER_SELECT: UserSelect = { id: true, firstName: true, lastName: true, email: true, role: true };

export function actorFromUser(user: UserRef | null | undefined): ActorSummary | null {
  if (!user) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || 'Utilisateur';
  return { id: user.id, name, role: user.role };
}

function isUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { code?: string }).code === 'P2002');
}

export interface SaveInput {
  expectedRevision: number;
  payload: unknown;
  actorId: string | null;
  action?: PlanningStudioAction;
  summary?: string | null;
}

export interface SaveResult {
  revision: number;
  payloadHash: string;
  updatedAt: Date;
  stats: PlanningStats;
  warnings: number;
}

export interface RevisionSummary {
  revision: number;
  action: PlanningStudioAction;
  summary: string | null;
  createdAt: Date;
  createdBy: ActorSummary | null;
  payloadHash: string;
}

export function createPlanningStudioService(db: PlanningDb, academicYear: string = PLANNING_ACADEMIC_YEAR) {
  async function findDocument(tx: PlanningTx | PlanningDb = db): Promise<DocumentRecord | null> {
    return tx.planningStudioDocument.findUnique({ where: { academicYear }, include: { updatedBy: { select: USER_SELECT } } });
  }

  /**
   * Initialisation idempotente : si aucun document n'existe pour l'année,
   * il est créé depuis le planning de démarrage livré (révision 1, INIT).
   * Une relance ne crée jamais de doublon (contrainte d'unicité + reprise).
   */
  async function getOrInitDocument(actorId: string | null = null): Promise<DocumentRecord & { initialized: boolean }> {
    const existing = await findDocument();
    if (existing) return { ...existing, initialized: false };
    const validation = validatePlanningPayload(PLANNING_BOOTSTRAP);
    if (!validation.ok) throw new PlanningValidationError(validation.errors, validation.blocking);
    const engine = getPlanningEngine();
    try {
      const created = await db.$transaction(async (tx) => {
        const doc = await tx.planningStudioDocument.create({
          data: {
            academicYear,
            schemaVersion: engine.SCHEMA_VERSION,
            revision: 1,
            payload: validation.payload as unknown as Prisma.InputJsonValue,
            payloadHash: validation.hash,
            updatedById: actorId,
          },
        });
        await tx.planningStudioRevision.create({
          data: {
            documentId: doc.id,
            revision: 1,
            action: 'INIT',
            summary: describe(null, validation.payload) + ' · initialisation depuis le planning livré',
            payload: validation.payload as unknown as Prisma.InputJsonValue,
            payloadHash: validation.hash,
            createdById: actorId,
          },
        });
        return doc;
      });
      const withUser = await findDocument();
      return { ...(withUser ?? created), initialized: true };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const raced = await findDocument();
      if (!raced) throw err;
      return { ...raced, initialized: false };
    }
  }

  /** Enregistre une nouvelle révision sous verrou optimiste. */
  async function saveDocument(input: SaveInput): Promise<SaveResult> {
    const validation = validatePlanningPayload(input.payload);
    if (!validation.ok) throw new PlanningValidationError(validation.errors, validation.blocking);
    const action: PlanningStudioAction = input.action ?? 'SAVE';
    const current = await getOrInitDocument(input.actorId);
    if (current.revision !== input.expectedRevision) {
      throw new PlanningConflictError(current.revision, current.updatedAt, actorFromUser(current.updatedBy));
    }
    const nextRevision = current.revision + 1;
    const summary = (input.summary && input.summary.trim().slice(0, 200)) || describe(current.payload as PlanningPayload, validation.payload);
    const saved = await db.$transaction(async (tx) => {
      const updated = await tx.planningStudioDocument.updateMany({
        where: { id: current.id, revision: input.expectedRevision },
        data: {
          revision: nextRevision,
          payload: validation.payload as unknown as Prisma.InputJsonValue,
          payloadHash: validation.hash,
          schemaVersion: validation.payload.schemaVersion,
          updatedById: input.actorId,
        },
      });
      if (updated.count !== 1) {
        const latest = await findDocument(tx);
        throw new PlanningConflictError(latest?.revision ?? -1, latest?.updatedAt ?? new Date(), actorFromUser(latest?.updatedBy));
      }
      const revision = await tx.planningStudioRevision.create({
        data: {
          documentId: current.id,
          revision: nextRevision,
          action,
          summary,
          payload: validation.payload as unknown as Prisma.InputJsonValue,
          payloadHash: validation.hash,
          createdById: input.actorId,
        },
      });
      return revision;
    });
    return { revision: nextRevision, payloadHash: validation.hash, updatedAt: saved.createdAt, stats: validation.stats, warnings: validation.warnings };
  }

  async function listRevisions(limit = 50): Promise<RevisionSummary[]> {
    const doc = await getOrInitDocument(null);
    const rows = await db.planningStudioRevision.findMany({
      where: { documentId: doc.id },
      orderBy: { revision: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      include: { createdBy: { select: USER_SELECT } },
    });
    return rows.map((r) => ({
      revision: r.revision as number,
      action: r.action as PlanningStudioAction,
      summary: (r.summary as string | null) ?? null,
      createdAt: r.createdAt as Date,
      createdBy: actorFromUser(r.createdBy ?? null),
      payloadHash: r.payloadHash as string,
    }));
  }

  async function getRevision(revision: number): Promise<RevisionRecord> {
    const doc = await getOrInitDocument(null);
    const row = await db.planningStudioRevision.findUnique({ where: { documentId_revision: { documentId: doc.id, revision } } });
    if (!row) throw new PlanningNotFoundError(`Révision ${revision} introuvable`);
    return row;
  }

  /** Restaure une révision antérieure EN CRÉANT une nouvelle révision (historique intact). */
  async function restoreRevision(input: { revision: number; expectedRevision: number; actorId: string | null }): Promise<SaveResult> {
    const target = await getRevision(input.revision);
    return saveDocument({
      expectedRevision: input.expectedRevision,
      payload: target.payload,
      actorId: input.actorId,
      action: 'RESTORE',
      summary: `Restauration de la révision ${input.revision}`,
    });
  }

  /** Réinitialise au planning livré (nouvelle révision RESET, historique conservé). */
  async function resetToBootstrap(input: { expectedRevision: number; actorId: string | null }): Promise<SaveResult> {
    return saveDocument({
      expectedRevision: input.expectedRevision,
      payload: PLANNING_BOOTSTRAP,
      actorId: input.actorId,
      action: 'RESET',
      summary: 'Réinitialisation au planning livré avec l\'application',
    });
  }

  return { getOrInitDocument, saveDocument, listRevisions, getRevision, restoreRevision, resetToBootstrap, academicYear };
}

export type PlanningStudioService = ReturnType<typeof createPlanningStudioService>;

/** Résumé lisible d'une révision : inventaire et différences avec la précédente. */
export function describe(previous: PlanningPayload | null, next: PlanningPayload): string {
  const stats = planningStats(next);
  const parts = [`${stats.sessions} séances (${stats.activeSessions} actives)`, `${stats.teachers} enseignants`, `${stats.rooms} salles`];
  if (previous) {
    const before = new Map(previous.sessions.map((s) => [s.id, hashPayload(s)]));
    const after = new Map(next.sessions.map((s) => [s.id, hashPayload(s)]));
    let added = 0, removed = 0, changed = 0;
    after.forEach((h, id) => { if (!before.has(id)) added += 1; else if (before.get(id) !== h) changed += 1; });
    before.forEach((_h, id) => { if (!after.has(id)) removed += 1; });
    const delta: string[] = [];
    if (added) delta.push(`+${added} séance${added > 1 ? 's' : ''}`);
    if (removed) delta.push(`−${removed} séance${removed > 1 ? 's' : ''}`);
    if (changed) delta.push(`${changed} modifiée${changed > 1 ? 's' : ''}`);
    const teachersChanged = hashPayload(previous.teachers) !== hashPayload(next.teachers);
    const roomsChanged = hashPayload(previous.rooms) !== hashPayload(next.rooms);
    const subjectsChanged = hashPayload(previous.subjects) !== hashPayload(next.subjects);
    const groupsChanged = hashPayload(previous.groups) !== hashPayload(next.groups);
    const config = [teachersChanged && 'enseignants', roomsChanged && 'salles', subjectsChanged && 'matières', groupsChanged && 'groupes'].filter(Boolean);
    if (config.length) delta.push('configuration : ' + config.join(', '));
    parts.push(delta.length ? delta.join(', ') : 'aucun changement de séance');
  }
  return parts.join(' · ');
}
