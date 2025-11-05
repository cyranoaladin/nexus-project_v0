export type UUID = string;

export interface KPI {
  progress_overall: number;
  streak_days: number;
  last_eval_score: number;
}

export type UpcomingKind = 'Visio' | 'Présentiel' | 'Stage' | 'Épreuve' | 'Rappel';

export interface UpcomingItem {
  id: UUID;
  at: string;
  kind: UpcomingKind;
  title: string;
  status?: string | null;
  location?: string | null;
}

export type TaskStatus = 'Todo' | 'Done' | 'Skipped';
export type TaskSource = 'Agent' | 'Coach' | 'System';

export interface TaskItem {
  id: UUID;
  label: string;
  due_at: string | null;
  weight: number;
  status: TaskStatus;
  source?: TaskSource | null;
}

export interface TaskBucket {
  label: string;
  tasks: TaskItem[];
}

export interface DashboardSummaryResponse {
  kpis: KPI;
  upcoming: UpcomingItem[];
  tasks: TaskItem[];
  backlog?: TaskBucket[];
}

export interface TasksBulkResponse {
  tasks: TaskItem[];
}

export interface ProgressEntry {
  subject: string;
  chapter_code: string;
  competence_code?: string | null;
  score: number;
  updated_at: string;
}

export interface ProgressionResponse {
  entries: ProgressEntry[];
}

export interface AgendaItem {
  id: UUID;
  start_at: string;
  end_at: string;
  kind: 'Visio' | 'Présentiel' | 'Stage';
  title: string;
  status: 'Proposé' | 'Confirmé' | 'Annulé';
  location?: string | null;
}

export interface EvaluationFeedbackItem {
  step: string;
  comment: string;
}

export interface EvaluationHistoryEntry {
  graded_at: string;
  score_20: number;
}

export interface EvaluationSubmissionFile {
  name: string;
  content_type?: string | null;
  size_bytes: number;
  sha256: string;
}

export interface EvaluationSubmission {
  submitted_at: string;
  submitted_by: 'student' | 'coach' | 'admin';
  files: EvaluationSubmissionFile[];
}

export interface EvalGenerateRequest {
  student_id: UUID;
  subject: string;
  level: string;
  duration: number;
  constraints?: Record<string, string>;
}

export interface EvaluationResponse {
  id: UUID;
  student_id: UUID;
  subject: string;
  status: 'Proposé' | 'Soumis' | 'Corrigé';
  duration_min: number;
  score_20?: number | null;
  created_at: string;
  metadata: Record<string, string>;
  feedback?: EvaluationFeedbackItem[] | null;
  submissions?: EvaluationSubmission[] | null;
  history?: EvaluationHistoryEntry[] | null;
}

export interface EvalFeedbackRequest {
  score_20: number;
  feedback: EvaluationFeedbackItem[];
}

export interface SessionResponse {
  id: UUID;
  student_id: UUID;
  kind: string;
  status: string;
  slot_start: string;
  slot_end?: string | null;
  coach_id?: UUID | null;
  capacity: number;
  price_cents: number;
  booking_status?: string | null;
}

export interface SessionListResponse {
  items: SessionResponse[];
}

export interface EpreuveItem {
  code: string;
  label: string;
  weight: number;
  scheduled_at?: string | null;
  format: string;
}

export interface EpreuvesResponse {
  track: 'Premiere' | 'Terminale';
  profile: 'Scolarise' | 'CandidatLibre';
  items: EpreuveItem[];
}

export interface RagHit {
  document_id: UUID;
  chunk_id: UUID;
  title: string;
  snippet: string;
  score: number;
  metadata: Record<string, any>;
}

export interface RagSearchResponse {
  q: string;
  filters?: string | null;
  hits: RagHit[];
}

export interface RagDocumentChunk {
  id: UUID;
  content: string;
  meta: Record<string, any>;
}

export interface RagDocumentResponse {
  id: UUID;
  source: string;
  path?: string | null;
  version: string;
  meta: Record<string, any>;
  chunks: RagDocumentChunk[];
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';

export class NexusApiError extends Error {
  status: number;
  statusText: string;
  bodyText: string;
  detail: unknown;

  constructor(status: number, statusText: string, bodyText: string) {
    const parsed = NexusApiError.tryParseBody(bodyText);
    const detailMessage = NexusApiError.extractDetailMessage(parsed);
    super(detailMessage ?? `${status} ${statusText}`);
    this.name = 'NexusApiError';
    this.status = status;
    this.statusText = statusText;
    this.bodyText = bodyText;
    this.detail = parsed;
  }

  private static tryParseBody(bodyText: string): unknown {
    if (!bodyText) return undefined;
    try {
      return JSON.parse(bodyText);
    } catch {
      return bodyText;
    }
  }

  private static extractDetailMessage(parsed: unknown): string | null {
    if (!parsed) return null;
    if (typeof parsed === 'string') return parsed;
    if (typeof parsed === 'object') {
      const candidate = (parsed as { detail?: unknown; message?: unknown }).detail ?? (parsed as { detail?: unknown; message?: unknown }).message;
      if (typeof candidate === 'string') return candidate;
    }
    return null;
  }
}

export class NexusApiClient {
  private readonly baseUrl: string;

  constructor(private cfg: { baseUrl: string; token?: string }) {
    this.baseUrl = NexusApiClient.resolveBaseUrl(cfg.baseUrl);
  }

  private static resolveBaseUrl(input: string): string {
    if (/^https?:\/\//i.test(input)) {
      return input.replace(/\/+$/, '');
    }

    if (typeof window !== 'undefined') {
      const normalized = input.startsWith('/') ? input : `/${input}`;
      return normalized.replace(/\/+$/, '');
    }

    const origin =
      process.env.NEXUS_API_BASE_URL ??
      process.env.NEXTAUTH_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

    if (!origin) {
      throw new Error(
        `NexusApiClient: unable to resolve absolute base URL for "${input}". Provide an absolute baseUrl or set NEXTAUTH_URL.`,
      );
    }

    const url = new URL(input, origin);
    return url.toString().replace(/\/+$/, '');
  }

  private async call<T>(path: string, method: HttpMethod = 'GET', body?: any, headers: Record<string,string> = {}): Promise<T> {
    const h: Record<string,string> = { 'Content-Type': 'application/json', ...headers };
    if (this.cfg.token) h['Authorization'] = `Bearer ${this.cfg.token}`;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: h,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new NexusApiError(res.status, res.statusText, txt);
    }
    return (await res.json()) as T;
  }

  // Health
  health() { return this.call<{status: string}>(`/health/`); }

  // Dashboard
  dashboard = {
    summary: (student_id: UUID, options?: { headers?: Record<string,string> }) =>
      this.call<DashboardSummaryResponse>(`/dashboard/summary?student_id=${student_id}`, 'GET', undefined, options?.headers ?? {}),
    agenda: (student_id: UUID, from?: string, to?: string, options?: { headers?: Record<string,string> }) => {
      const q = new URLSearchParams({ student_id });
      if (from) q.append('from', from);
      if (to) q.append('to', to);
      return this.call<{ items: AgendaItem[] }>(`/dashboard/agenda?${q.toString()}`, 'GET', undefined, options?.headers ?? {});
    },
    progression: (student_id: UUID, subject?: string, options?: { headers?: Record<string,string> }) => {
      const q = new URLSearchParams({ student_id });
      if (subject) q.append('subject', subject);
      return this.call<ProgressionResponse>(`/dashboard/progression?${q.toString()}`, 'GET', undefined, options?.headers ?? {});
    },
    tasks: {
      list: (student_id: UUID, options?: { headers?: Record<string,string> }) =>
        this.call<TasksBulkResponse>(`/dashboard/tasks?student_id=${student_id}`, 'GET', undefined, options?.headers ?? {}),
      bulk: (
        student_id: UUID,
        tasks: Array<{ id?: UUID; label: string; status?: TaskStatus; due_at?: string | null; weight?: number; source?: TaskSource }>,
        options?: { headers?: Record<string,string> }
      ) =>
        this.call<TasksBulkResponse>(`/dashboard/tasks?student_id=${student_id}`, 'PUT', tasks, options?.headers ?? {}),
      complete: (task_id: UUID, status: TaskStatus = 'Done', options?: { headers?: Record<string,string> }) =>
        this.call<TasksBulkResponse>(`/dashboard/tasks/complete`, 'POST', { task_id, status }, options?.headers ?? {}),
    },
    epreuves: {
      get: (student_id: UUID, options?: { headers?: Record<string,string> }) =>
        this.call<EpreuvesResponse>(`/dashboard/epreuves?student_id=${student_id}`, 'GET', undefined, options?.headers ?? {}),
    }
  };

  // Sessions
  sessions = {
    list: (student_id: UUID, options?: { headers?: Record<string,string> }) =>
      this.call<SessionListResponse>(`/sessions/list?student_id=${student_id}`, 'GET', undefined, options?.headers ?? {}),
    book: (
      payload: {
        student_id: UUID;
        kind: string;
        slot_start: string;
        slot_end?: string | null;
        coach_id?: UUID | null;
        capacity?: number;
        price_cents?: number;
      },
      options?: { headers?: Record<string,string> }
    ) => this.call<SessionResponse>(`/sessions/book`, 'POST', payload, options?.headers ?? {}),
    cancel: (session_id: UUID, options?: { headers?: Record<string,string> }) =>
      this.call<{status:string; id:string}>(`/sessions/${session_id}/cancel`, 'POST', undefined, options?.headers ?? {}),
    bulkCancel: (ids: UUID[], options?: { headers?: Record<string,string> }) =>
      this.call<{results: Array<{id: UUID; status: string}>}>(`/sessions/cancel`, 'POST', { ids }, options?.headers ?? {}),
  };

  // Evaluations
  eval = {
    list: (student_id: UUID, options?: { headers?: Record<string,string> }) =>
      this.call<EvaluationResponse[]>(`/dashboard/evaluations?student_id=${student_id}`, 'GET', undefined, options?.headers ?? {}),
    generate: (body: EvalGenerateRequest, options?: { headers?: Record<string,string> }) =>
      this.call<EvaluationResponse>(`/eval/generate`, 'POST', body, options?.headers ?? {}),
    provideFeedback: (evaluation_id: UUID, body: EvalFeedbackRequest, options?: { headers?: Record<string,string> }) =>
      this.call<EvaluationResponse>(`/dashboard/evaluations/${evaluation_id}/feedback`, 'POST', body, options?.headers ?? {}),
    grade: async (
      evaluation_id: UUID,
      files: File[],
      options?: { score_20?: number; feedback?: EvaluationFeedbackItem[]; headers?: Record<string,string> }
    ) => {
      const form = new FormData();
      form.append('evaluation_id', evaluation_id);
      if (options?.score_20 !== undefined) form.append('score_20', options.score_20.toString());
      if (options?.feedback) form.append('feedback', JSON.stringify(options.feedback));
      for (const file of files) form.append('files', file);
      const headers: Record<string,string> = { ...(options?.headers ?? {}) };
      if (this.cfg.token) headers['Authorization'] = `Bearer ${this.cfg.token}`;
      const res = await fetch(`${this.baseUrl}/eval/grade`, {
        method: 'POST',
        body: form,
        headers,
        credentials: 'include',
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new NexusApiError(res.status, res.statusText, txt);
      }
      return (await res.json()) as EvaluationResponse;
    },
  };

  // RAG
  rag = {
    search: (
      q: string,
      options?: { filters?: string; headers?: Record<string,string> }
    ) => {
      const qs = new URLSearchParams({ q });
      if (options?.filters) qs.append('filters', options.filters);
      return this.call<RagSearchResponse>(
        `/rag/search?${qs.toString()}`,
        'GET',
        undefined,
        options?.headers ?? {},
      );
    },
    doc: (
      documentId: UUID,
      options?: { headers?: Record<string,string> }
    ) =>
      this.call<RagDocumentResponse>(
        `/rag/doc/${documentId}`,
        'GET',
        undefined,
        options?.headers ?? {},
      ),
  };

  // Parents
  parent = {
    report: (student_id: UUID, period: string) => this.call<{ student_id: UUID; period: string; kpis: KPI; summary_md: string }>(`/parent/report?student_id=${student_id}&period=${encodeURIComponent(period)}`),
  };
}
