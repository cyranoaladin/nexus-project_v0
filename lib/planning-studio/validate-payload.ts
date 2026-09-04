/**
 * Validation serveur d'une charge utile Planning Studio avant persistance.
 *
 * Le serveur ne fait jamais confiance au navigateur : taille, structure,
 * schéma, identifiants, références, horaires et conflits bloquants sont
 * contrôlés ici avec le même moteur que l'interface. Seule la version
 * NORMALISÉE (champs connus uniquement) est conservée : les clés inconnues
 * sont ignorées, ce qui interdit l'injection de données arbitraires.
 */
import { createHash } from 'node:crypto';
import { getPlanningEngine, type PlanningIssue, type PlanningPayload } from './engine';

export const PLANNING_PAYLOAD_MAX_BYTES = 1_000_000;
export const PLANNING_MAX_SESSIONS = 2_000;

export type PayloadValidation =
  | { ok: true; payload: PlanningPayload; hash: string; stats: PlanningStats; warnings: number }
  | { ok: false; errors: string[]; blocking: PlanningIssue[] };

export interface PlanningStats {
  sessions: number;
  activeSessions: number;
  teachers: number;
  rooms: number;
  subjects: number;
  groups: number;
}

/** Sérialisation canonique (clés triées) pour un hachage stable. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function hashPayload(payload: unknown): string {
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

export function planningStats(payload: PlanningPayload): PlanningStats {
  return {
    sessions: payload.sessions.length,
    activeSessions: payload.sessions.filter((s) => s.active).length,
    teachers: payload.teachers.length,
    rooms: payload.rooms.length,
    subjects: payload.subjects.length,
    groups: payload.groups.length,
  };
}

export function validatePlanningPayload(raw: unknown): PayloadValidation {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['Le planning doit être un objet JSON.'], blocking: [] };
  }
  const size = Buffer.byteLength(JSON.stringify(raw), 'utf8');
  if (size > PLANNING_PAYLOAD_MAX_BYTES) {
    return { ok: false, errors: [`Planning trop volumineux (${size} octets, maximum ${PLANNING_PAYLOAD_MAX_BYTES}).`], blocking: [] };
  }
  const engine = getPlanningEngine();
  const inspection = engine.inspectImport(raw);
  if (!inspection.ok) return { ok: false, errors: inspection.errors, blocking: [] };
  const declaredVersion = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (declaredVersion !== undefined) {
    if (
      typeof declaredVersion !== 'number' ||
      !Number.isInteger(declaredVersion) ||
      declaredVersion < 1 ||
      declaredVersion > engine.SCHEMA_VERSION
    ) {
      return {
        ok: false,
        errors: [`schemaVersion ${String(declaredVersion)} non pris en charge (entier attendu entre 1 et ${engine.SCHEMA_VERSION}).`],
        blocking: [],
      };
    }
  }

  const rawObj = raw as Record<string, unknown>;
  const collections = ['teachers', 'rooms', 'subjects', 'groups', 'sessions'] as const;
  const idErrors: string[] = [];
  for (const col of collections) {
    const list = rawObj[col];
    if (Array.isArray(list)) {
      const seen = new Set<string>();
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (!item || typeof item !== 'object') continue;
        const id = (item as { id?: unknown }).id;
        if (id === undefined || id === null || typeof id !== 'string' || !id.trim()) {
          idErrors.push(`Élément #${i + 1} de la collection "${col}" sans identifiant (id requis).`);
        } else {
          if (seen.has(id)) {
            idErrors.push(`Identifiant dupliqué "${id}" dans la collection "${col}".`);
          } else {
            seen.add(id);
          }
        }
      }
    }
  }
  if (idErrors.length) {
    return { ok: false, errors: idErrors, blocking: [] };
  }

  const payload = engine.normalize(raw);
  if (payload.sessions.length > PLANNING_MAX_SESSIONS) {
    return { ok: false, errors: [`Trop de séances (${payload.sessions.length}, maximum ${PLANNING_MAX_SESSIONS}).`], blocking: [] };
  }
  const result = engine.validate(payload);
  const blocking = result.issues.filter((i) => i.severity === 'error');
  if (blocking.length) {
    return {
      ok: false,
      errors: [`${blocking.length} conflit(s) bloquant(s) : le planning partagé ne peut pas contenir d'erreur bloquante.`],
      blocking,
    };
  }
  return { ok: true, payload, hash: hashPayload(payload), stats: planningStats(payload), warnings: result.counts.warning };
}
