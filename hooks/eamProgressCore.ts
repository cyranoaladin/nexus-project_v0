export interface EAMQuizResult {
  score: number;
  total: number;
  done: boolean;
  completedAt?: string;
}

export interface EAMProgressData {
  checks: Record<string, boolean>;
  quiz: Record<string, EAMQuizResult>;
  lastUpdated: string;
}

const EMPTY_PROGRESS: EAMProgressData = {
  checks: {},
  quiz: {},
  lastUpdated: new Date(0).toISOString(),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeChecks(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean")
  );
}

function normalizeQuiz(value: unknown): Record<string, EAMQuizResult> {
  if (!isRecord(value)) return {};

  const entries: Array<[string, EAMQuizResult]> = [];
  for (const [key, raw] of Object.entries(value)) {
    if (!isRecord(raw)) continue;
    const score = raw.score;
    const total = raw.total;
    const done = raw.done;
    if (typeof score !== "number" || typeof total !== "number" || typeof done !== "boolean") continue;
    const completedAt = typeof raw.completedAt === "string" ? raw.completedAt : undefined;
    entries.push([key, { score, total, done, completedAt }]);
  }

  return Object.fromEntries(entries);
}

function normalizeDate(value: unknown): string {
  if (typeof value !== "string") return new Date().toISOString();
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString();
}

export function createEmptyEAMProgress(): EAMProgressData {
  return { checks: {}, quiz: {}, lastUpdated: new Date().toISOString() };
}

export function normalizeProgress(value: unknown): EAMProgressData {
  if (!isRecord(value)) return { ...EMPTY_PROGRESS, lastUpdated: new Date().toISOString() };
  return {
    checks: normalizeChecks(value.checks),
    quiz: normalizeQuiz(value.quiz),
    lastUpdated: normalizeDate(value.lastUpdated),
  };
}

export function mergeProgressByLastUpdated(
  local: EAMProgressData | null | undefined,
  remote: EAMProgressData | null | undefined
): EAMProgressData {
  if (!local) return remote ?? createEmptyEAMProgress();
  if (!remote) return local;
  return Date.parse(remote.lastUpdated) > Date.parse(local.lastUpdated) ? remote : local;
}

export function calculateProgressPercent(checked: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((checked / total) * 100)));
}
