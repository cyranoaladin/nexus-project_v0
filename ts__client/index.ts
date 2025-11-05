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

export interface DashboardSummaryResponse {
  kpis: KPI;
  upcoming: UpcomingItem[];
  tasks: TaskItem[];
}

export interface TasksBulkResponse {
  tasks: TaskItem[];
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

export interface EvalGenerateRequest {
  student_id: UUID;
  subject: string;
  level: string;
  duration: number;
  constraints?: Record<string, unknown>;
}

export interface EvalGenerateResponse {
  eval_id: UUID;
  subject: string;
  duration: number;
  instructions_md: string;
  attachments: { name: string; uri: string }[];
}

export interface EvalGradeResponse {
  score_20: number;
  feedback: { competence_code: string; comment: string; delta: number }[];
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

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';

export class NexusApiClient {
  constructor(private cfg: { baseUrl: string; token?: string }) {}

  private async call<T>(path: string, method: HttpMethod = 'GET', body?: any, headers: Record<string,string> = {}): Promise<T> {
    const h: Record<string,string> = { 'Content-Type': 'application/json', ...headers };
    if (this.cfg.token) h['Authorization'] = `Bearer ${this.cfg.token}`;

    const res = await fetch(`${this.cfg.baseUrl}${path}`, {
      method,
      headers: h,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${txt}`);
    }
    return (await res.json()) as T;
  }

  // Health
  health() { return this.call<{status: string}>(`/health/`); }

  // Dashboard
  dashboard = {
    summary: (student_id: UUID) => this.call<DashboardSummaryResponse>(`/dashboard/summary?student_id=${student_id}`),
    agenda: (student_id: UUID, from?: string, to?: string) => {
      const q = new URLSearchParams({ student_id });
      if (from) q.append('from', from);
      if (to) q.append('to', to);
      return this.call<{ items: AgendaItem[] }>(`/dashboard/agenda?${q.toString()}`);
    },
    progression: (student_id: UUID, subject?: string) => {
      const q = new URLSearchParams({ student_id });
      if (subject) q.append('subject', subject);
      return this.call<{ entries: any[] }>(`/dashboard/progression?${q.toString()}`);
    },
    tasks: {
      list: (student_id: UUID) => this.call<TasksBulkResponse>(`/dashboard/tasks?student_id=${student_id}`),
      bulk: (student_id: UUID, tasks: Array<{ id?: UUID; label: string; status?: TaskStatus; due_at?: string | null; weight?: number; source?: TaskSource }>) =>
        this.call<TasksBulkResponse>(`/dashboard/tasks?student_id=${student_id}`, 'PUT', tasks),
      complete: (task_id: UUID, status: TaskStatus = 'Done') =>
        this.call<TasksBulkResponse>(`/dashboard/tasks/complete`, 'POST', { task_id, status }),
    },
    epreuves: {
      get: (student_id: UUID) => this.call<EpreuvesResponse>(`/dashboard/epreuves?student_id=${student_id}`),
    }
  };

  // Sessions
  sessions = {
    cancel: (session_id: UUID) => this.call<{status:string; id:string}>(`/sessions/${session_id}/cancel`, 'POST'),
    bulkCancel: (ids: UUID[]) => this.call<{results: Array<{id: UUID; status: string}>}>(`/sessions/cancel`, 'POST', { ids }),
  };

  // Evaluations
  eval = {
    generate: (body: EvalGenerateRequest) => this.call<EvalGenerateResponse>(`/eval/generate`, 'POST', body),
    grade: async (eval_id: UUID, files: File[]) => {
      const form = new FormData();
      form.append('eval_id', eval_id);
      for (const f of files) form.append('files', f);
      const headers: Record<string,string> = {};
      if (this.cfg.token) headers['Authorization'] = `Bearer ${this.cfg.token}`;
      const res = await fetch(`${this.cfg.baseUrl}/eval/grade`, { method: 'POST', body: form, headers, credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return (await res.json()) as EvalGradeResponse;
    }
  };

  // RAG
  rag = {
    search: (q: string, filters?: string) => {
      const qs = new URLSearchParams({ q });
      if (filters) qs.append('filters', filters);
      return this.call<{ q: string; filters?: string | null; hits: any[] }>(`/rag/search?${qs.toString()}`);
    }
  };

  // Parents
  parent = {
    report: (student_id: UUID, period: string) => this.call<{ student_id: UUID; period: string; kpis: KPI; summary_md: string }>(`/parent/report?student_id=${student_id}&period=${encodeURIComponent(period)}`),
  };
}
