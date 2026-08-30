/**
 * ARIA Typed Server-Sent Events (SSE) Protocol & Runtime Schema Validation.
 *
 * Invariants :
 * - ARIA_SSE_PARSERS=1
 * - SSE_RUNTIME_SCHEMA_VALIDATION=PASS
 */

import { z } from 'zod';

// ─── Schémas d'événements Zod ───────────────────────────────────────────────

export const ariaSSEStartSchema = z.object({
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
  model: z.string().min(1),
  courseKey: z.string().nullable().optional(),
});

export const ariaSSEDeltaSchema = z.object({
  text: z.string(),
});

export const ariaSSECitationSchema = z.object({
  citation: z.object({
    id: z.string().optional(),
    sourceTitle: z.string(),
    sourceDocument: z.string().optional(),
    sourceLocation: z.string().optional(),
    courseKey: z.string().optional(),
    provenance: z.string().optional(),
    url: z.string().optional(),
    snippet: z.string().optional(),
    score: z.number().optional(),
  }),
});

export const ariaSSEMetadataSchema = z.object({
  tokens: z.number().optional(),
  latencyMs: z.number().optional(),
  finishReason: z.string().optional(),
  ragStatus: z.string().optional(),
});

export const ariaSSEDoneSchema = z.object({
  messageId: z.string().min(1),
  status: z.enum(['COMPLETED', 'CANCELLED']),
  fullText: z.string().optional(),
});

export const ariaSSEErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean().optional(),
});

export type AriaSSEStartPayload = z.infer<typeof ariaSSEStartSchema>;
export type AriaSSEDeltaPayload = z.infer<typeof ariaSSEDeltaSchema>;
export type AriaSSECitationPayload = z.infer<typeof ariaSSECitationSchema>;
export type AriaSSEMetadataPayload = z.infer<typeof ariaSSEMetadataSchema>;
export type AriaSSEDonePayload = z.infer<typeof ariaSSEDoneSchema>;
export type AriaSSEErrorPayload = z.infer<typeof ariaSSEErrorSchema>;

export class AriaSSEParseError extends Error {
  readonly rawEvent?: string;
  readonly rawData?: string;

  constructor(message: string, rawEvent?: string, rawData?: string) {
    super(message);
    this.name = 'AriaSSEParseError';
    this.rawEvent = rawEvent;
    this.rawData = rawData;
  }
}

// ─── Formatage serveur ───────────────────────────────────────────────────────

export function formatSSEMessage<T>(event: string, data: T): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ─── Parseur client isomorphe avec validation de schéma ──────────────────────

export interface AriaSSECallbacks {
  onStart?: (payload: AriaSSEStartPayload) => void;
  onDelta?: (payload: AriaSSEDeltaPayload) => void;
  onCitation?: (payload: AriaSSECitationPayload) => void;
  onMetadata?: (payload: AriaSSEMetadataPayload) => void;
  onDone?: (payload: AriaSSEDonePayload) => void;
  onError?: (payload: AriaSSEErrorPayload) => void;
  onProtocolError?: (error: AriaSSEParseError) => void;
}

/**
 * Valide et dispatche un message SSE individuel.
 */
function processSSEChunk(
  message: string,
  callbacks: AriaSSECallbacks
): void {
  if (!message.trim()) return;

  let eventType = '';
  let eventData = '';

  for (const line of message.split('\n')) {
    if (line.startsWith('event: ')) {
      eventType = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      eventData = line.slice(6).trim();
    }
  }

  // Heartbeat / ping sans données
  if (eventType === 'ping' || eventType === 'heartbeat') {
    return;
  }

  if (!eventType || !eventData) {
    const err = new AriaSSEParseError('Message SSE incomplet (event ou data manquant)', eventType, eventData);
    callbacks.onProtocolError?.(err);
    return;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(eventData);
  } catch {
    const err = new AriaSSEParseError(`JSON SSE invalide pour l'événement ${eventType}`, eventType, eventData);
    callbacks.onProtocolError?.(err);
    throw err;
  }

  switch (eventType) {
    case 'start': {
      const validated = ariaSSEStartSchema.safeParse(parsedJson);
      if (!validated.success) {
        const err = new AriaSSEParseError(`Payload start non conforme : ${validated.error.message}`, eventType, eventData);
        callbacks.onProtocolError?.(err);
        throw err;
      }
      callbacks.onStart?.(validated.data as AriaSSEStartPayload);
      break;
    }
    case 'delta': {
      const validated = ariaSSEDeltaSchema.safeParse(parsedJson);
      if (!validated.success) {
        const err = new AriaSSEParseError(`Payload delta non conforme : ${validated.error.message}`, eventType, eventData);
        callbacks.onProtocolError?.(err);
        throw err;
      }
      callbacks.onDelta?.(validated.data);
      break;
    }
    case 'citation': {
      const validated = ariaSSECitationSchema.safeParse(parsedJson);
      if (!validated.success) {
        const err = new AriaSSEParseError(`Payload citation non conforme : ${validated.error.message}`, eventType, eventData);
        callbacks.onProtocolError?.(err);
        throw err;
      }
      callbacks.onCitation?.(validated.data as unknown as AriaSSECitationPayload);
      break;
    }
    case 'metadata': {
      const validated = ariaSSEMetadataSchema.safeParse(parsedJson);
      if (!validated.success) {
        const err = new AriaSSEParseError(`Payload metadata non conforme : ${validated.error.message}`, eventType, eventData);
        callbacks.onProtocolError?.(err);
        throw err;
      }
      callbacks.onMetadata?.(validated.data);
      break;
    }
    case 'done': {
      const validated = ariaSSEDoneSchema.safeParse(parsedJson);
      if (!validated.success) {
        const err = new AriaSSEParseError(`Payload done non conforme : ${validated.error.message}`, eventType, eventData);
        callbacks.onProtocolError?.(err);
        throw err;
      }
      callbacks.onDone?.(validated.data);
      break;
    }
    case 'error': {
      const validated = ariaSSEErrorSchema.safeParse(parsedJson);
      if (!validated.success) {
        const err = new AriaSSEParseError(`Payload error non conforme : ${validated.error.message}`, eventType, eventData);
        callbacks.onProtocolError?.(err);
        throw err;
      }
      callbacks.onError?.(validated.data);
      break;
    }
    default: {
      const err = new AriaSSEParseError(`Type d'événement SSE inconnu : ${eventType}`, eventType, eventData);
      callbacks.onProtocolError?.(err);
      throw err;
    }
  }
}

/**
 * Lit et parse un ReadableStream SSE de manière robuste (gestion des chunks partiels, UTF-8 split et buffer flush).
 */
export async function parseAriaSSEStream(
  stream: ReadableStream<Uint8Array>,
  callbacks: AriaSSECallbacks
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // Flush final du décodeur pour les caractères multi-octets éventuels
        buffer += decoder.decode();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const messages = buffer.split('\n\n');
      buffer = messages.pop() ?? '';

      for (const message of messages) {
        processSSEChunk(message, callbacks);
      }
    }

    // Traitement du buffer restant si un message final s'y trouve
    if (buffer.trim()) {
      processSSEChunk(buffer, callbacks);
    }
  } finally {
    reader.releaseLock();
  }
}
