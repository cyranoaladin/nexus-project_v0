/**
 * Lecture SEULE de l'archive historique du TP POO (`traces.sqlite3`).
 *
 * La source est ouverte en lecture seule : toute tentative d'écriture échoue
 * côté SQLite. Aucune fonction de ce module ne supprime, ne modifie ni ne
 * « normalise » quoi que ce soit. L'empreinte SHA-256 du fichier est exposée
 * pour que les appelants prouvent qu'il n'a pas changé.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { z } from 'zod';

import { getPooContent } from '../catalog';
import { computeProgress, parseWorkContent, type WorkContent } from '../work-content';

export const LEGACY_SCHEMA = 'nexus-poo-trace/1';

export interface LegacyRow {
  id: string;
  clientId: string | null;
  received: string;
  sha: string;
  alias: string;
  groupe: string;
  session: string;
  payload: string;
}

export interface LegacyReader {
  readonly path: string;
  /** Empreinte du fichier source, recalculée à chaque appel. */
  fileSha256(): string;
  count(): number;
  list(): Omit<LegacyRow, 'payload'>[];
  get(id: string): LegacyRow | null;
  findByAlias(alias: string): LegacyRow[];
  close(): void;
}

export function openLegacySource(path: string): LegacyReader {
  const db = new DatabaseSync(path, { readOnly: true });
  const columns = 'id, client_id AS clientId, received, sha, alias, groupe, session';
  return {
    path,
    fileSha256: () => createHash('sha256').update(readFileSync(path)).digest('hex'),
    count: () => Number((db.prepare('SELECT COUNT(*) AS n FROM submissions').get() as { n: number | bigint }).n),
    list: () => db.prepare(`SELECT ${columns} FROM submissions ORDER BY received, id`).all() as unknown as Omit<LegacyRow, 'payload'>[],
    get: (id) => (db.prepare(`SELECT ${columns}, payload FROM submissions WHERE id = ?`).get(id) as unknown as LegacyRow | undefined) ?? null,
    findByAlias: (alias) => db.prepare(`SELECT ${columns}, payload FROM submissions WHERE alias = ? ORDER BY received, id`).all(alias) as unknown as LegacyRow[],
    close: () => db.close(),
  };
}

// ─── Schéma de trace (miroir de validate_trace du service historique) ───────

const text = (max: number) => z.string().max(max);
const run = z
  .object({
    at: text(50),
    mode: z.enum(['run', 'test']),
    code: text(20000),
    runtime: text(50),
    result: z
      .object({
        ok: z.boolean(),
        error: text(2000).nullable(),
        output: text(6000),
        tests: z.array(z.object({ label: text(200), pass: z.boolean(), message: text(800) }).strict()).max(30),
        mode: z.enum(['run', 'test']),
      })
      .strict(),
  })
  .strict();

const legacyStep = z
  .object({
    code: text(20000),
    answers: z.record(z.string(), z.number().int().min(0)),
    fields: z.record(z.string(), text(5000)),
    hintCount: z.number().int().min(0).max(2),
    quizChecked: z.boolean(),
    completed: z.boolean(),
    attemptCount: z.number().int().min(0).max(10000),
    seconds: z.number().min(0).max(86400),
    history: z.array(run).max(20),
    localRun: text(3000),
    localRunAt: text(50),
    last: run.nullable(),
  })
  .strict();

const legacyTrace = z
  .object({
    schema: z.literal(LEGACY_SCHEMA),
    lessonVersion: z.string(),
    id: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),
    revision: z.number().int().min(0).optional(),
    profile: z.object({ alias: text(60), groupe: text(80), session: text(80) }).strict(),
    createdAt: text(50),
    updatedAt: text(50),
    current: z.string(),
    elapsed: z.number().min(0).max(86400),
    steps: z.record(z.string(), legacyStep),
  })
  .strict();

export type LegacyTrace = z.infer<typeof legacyTrace>;

export class LegacyTraceError extends Error {
  constructor(readonly code: 'INVALID_TRACE' | 'INCOMPATIBLE_VERSION', message: string) {
    super(message);
    this.name = 'LegacyTraceError';
  }
}

export function parseLegacyTrace(payload: string): LegacyTrace {
  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    throw new LegacyTraceError('INVALID_TRACE', 'Trace illisible');
  }
  const parsed = legacyTrace.safeParse(raw);
  if (!parsed.success) throw new LegacyTraceError('INVALID_TRACE', 'Trace non conforme au format historique');
  if (parsed.data.lessonVersion !== getPooContent().version) {
    throw new LegacyTraceError('INCOMPATIBLE_VERSION', `Version de leçon incompatible (${parsed.data.lessonVersion})`);
  }
  const known = new Set(getPooContent().steps.map((s) => s.id));
  if (!Object.keys(parsed.data.steps).every((id) => known.has(id))) {
    throw new LegacyTraceError('INVALID_TRACE', 'Étape inconnue dans la trace');
  }
  return parsed.data;
}

/** Contenu du nouveau système construit à partir de la trace, sans rien inventer. */
export function traceToWorkContent(trace: LegacyTrace): WorkContent {
  const steps: Record<string, unknown> = {};
  for (const [id, s] of Object.entries(trace.steps)) {
    const tests = s.last?.result.tests ?? [];
    const hasData = s.code.trim() !== '' || Object.keys(s.answers).length > 0 || Object.values(s.fields).some((v) => v.trim() !== '');
    if (!hasData) continue;
    steps[id] = {
      ...(s.code.trim() ? { code: s.code } : {}),
      ...(Object.keys(s.fields).length ? { fields: s.fields } : {}),
      ...(Object.keys(s.answers).length ? { choices: s.answers } : {}),
      ...(tests.length && s.last
        ? { tests: { ranAt: s.last.at.slice(0, 40), passed: tests.filter((t) => t.pass).length, total: tests.length } }
        : {}),
    };
  }
  return parseWorkContent({ v: 1, steps });
}

export interface TraceSummary {
  completedSteps: number;
  requiredSteps: number;
  currentStep: string;
  elapsedSeconds: number;
  updatedAt: string;
}

export function summarizeTrace(trace: LegacyTrace): TraceSummary {
  const progress = computeProgress(getPooContent().steps, traceToWorkContent(trace));
  return { ...progress, currentStep: trace.current, elapsedSeconds: trace.elapsed, updatedAt: trace.updatedAt };
}
