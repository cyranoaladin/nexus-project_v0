/**
 * Appels HTTP de l'espace pédagogique côté navigateur.
 * Les erreurs métier sont normalisées en `EspaceApiError` (code stable + statut).
 */
import type { AnnotationDto } from '../annotations';
import type { AttachmentDto } from '../files';
import type { TeacherOverview } from '../overview';
import type { WorkContent } from '../work-content';
import type { WorkDto } from '../works';
import type { SaveApi, SaveResponse, Steps } from './sync-engine';

type SessionSummary = { id: string; status: string; participants?: number };
type VersionMeta = { id: string; revision: number; reason: string; createdAt: string };

export class EspaceApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'EspaceApiError';
  }
}

async function call<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new EspaceApiError(res.status, body?.error ?? 'UNKNOWN', body?.message ?? 'Une erreur est survenue', body?.details);
  return body as T;
}

export const espaceApi = {
  openWork: (activitySlug: string, sessionId?: string | null) =>
    call<{ work: WorkDto }>('/api/espace/works', { method: 'POST', json: { activitySlug, sessionId: sessionId ?? null } }),
  getWork: (workId: string) => call<{ mode: 'student' | 'teacher'; work: WorkDto; annotations: AnnotationDto[]; attachments: AttachmentDto[] }>(`/api/espace/works/${workId}`),
  submit: (workId: string, baseRevision: number) =>
    call<{ work: WorkDto }>(`/api/espace/works/${workId}/submit`, { method: 'POST', json: { baseRevision } }),
  review: (workId: string, action: 'MARK_CORRECTED' | 'REOPEN' | 'MARK_DONE') =>
    call<{ work: WorkDto }>(`/api/espace/works/${workId}/review`, { method: 'POST', json: { action } }),
  addAnnotation: (workId: string, body: Record<string, unknown>) =>
    call<{ annotation: AnnotationDto }>(`/api/espace/works/${workId}/annotations`, { method: 'POST', json: body }),
  deleteAnnotation: (workId: string, annotationId: string) =>
    call(`/api/espace/works/${workId}/annotations/${annotationId}`, { method: 'DELETE' }),
  versions: (workId: string) => call<{ versions: VersionMeta[] }>(`/api/espace/works/${workId}/versions`),
  version: (workId: string, versionId: string) => call<{ version: VersionMeta & { content: WorkContent } }>(`/api/espace/works/${workId}/versions/${versionId}`),
  upload: (workId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return call<{ attachment: AttachmentDto }>(`/api/espace/works/${workId}/attachments`, { method: 'POST', body: form });
  },
  deleteAttachment: (workId: string, attachmentId: string) => call(`/api/espace/works/${workId}/attachments/${attachmentId}`, { method: 'DELETE' }),
  overview: (activitySlug: string) => call<TeacherOverview>(`/api/espace/teacher/overview?activity=${encodeURIComponent(activitySlug)}`),
  snippets: () => call<{ snippets: { id: string; body: string }[] }>('/api/espace/teacher/snippets'),
  addSnippet: (body: string) => call<{ snippet: { id: string; body: string } }>('/api/espace/teacher/snippets', { method: 'POST', json: { body } }),
  deleteSnippet: (id: string) => call(`/api/espace/teacher/snippets/${id}`, { method: 'DELETE' }),
  createSession: (body: Record<string, unknown>) => call<{ session: SessionSummary }>('/api/espace/teacher/sessions', { method: 'POST', json: body }),
  publishSession: (id: string) => call<{ session: SessionSummary }>(`/api/espace/teacher/sessions/${id}/publish`, { method: 'POST' }),
  closeSession: (id: string) => call<{ session: SessionSummary }>(`/api/espace/teacher/sessions/${id}/close`, { method: 'POST' }),
};

/** Adaptateur du moteur d'autosave : traduit les statuts HTTP en réponses typées. */
export function createSaveApi(workId: string): SaveApi {
  return {
    async save(input): Promise<SaveResponse> {
      const res = await fetch(`/api/espace/works/${workId}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseRevision: input.baseRevision,
          patch: { stepId: input.stepId, step: input.step },
          ...(input.currentStep !== undefined ? { currentStep: input.currentStep } : {}),
          ...(input.snapshot ? { snapshot: input.snapshot } : {}),
        }),
      }); // une coupure réseau lève TypeError : le moteur la traite comme « hors connexion »
      const body = await res.json().catch(() => null);
      if (res.ok) {
        if (!Number.isInteger(body?.revision) || body.revision < 0) throw new Error('Réponse de sauvegarde invalide');
        return { kind: 'ok', revision: body.revision, replayed: body.replayed, ...(body.content?.steps ? { steps: body.content.steps as Steps } : {}) };
      }
      if (res.status === 409 && body?.error === 'REVISION_CONFLICT') {
        const current = body.details?.current;
        return { kind: 'conflict', current: { revision: current.revision, steps: (current.content?.steps ?? {}) as Steps } };
      }
      if (res.status === 423) return { kind: 'locked' };
      if (res.status === 400) return { kind: 'rejected', message: body?.message ?? 'Contenu refusé', code: body?.error };
      if (res.status === 401) return { kind: 'rejected', message: 'Votre session a expiré : reconnectez-vous.', code: 'UNAUTHENTICATED' };
      if (res.status === 403 || res.status === 404) return { kind: 'rejected', message: 'Ce travail n’est plus accessible. Contactez votre professeur.', code: 'NOT_FOUND' };
      throw new Error(`HTTP ${res.status}`); // 5xx, 429… : réessai avec temporisation
    },
    async submit(input) {
      const res = await fetch(`/api/espace/works/${workId}/submit`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseRevision: input.baseRevision }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        if (!Number.isInteger(body?.work?.revision) || body.work.revision < 0) throw new Error('Réponse de remise invalide');
        return { kind: 'ok' as const, revision: body.work.revision };
      }
      if (res.status === 409) {
        const current = body?.details?.current;
        return { kind: 'conflict' as const, message: body?.message,
          ...(current && Number.isInteger(current.revision) && current.content?.steps
            ? { current: { revision: current.revision, steps: current.content.steps as Steps } } : {}) };
      }
      if (res.status === 423) return { kind: 'locked' as const, message: body?.message };
      return { kind: 'rejected' as const, message: body?.message };
    },
  };
}
