/**
 * ARIA Typed Server-Sent Events (SSE) Protocol.
 *
 * Invariant : ARIA_SSE_PROTOCOL=1.
 * Définit le format filaire canonique et le parseur client isomorphe.
 */

import type { AriaCitationHit, AriaCourseKey } from './contracts';

// ─── Types d'événements SSE ──────────────────────────────────────────────────

export interface AriaSSEStartPayload {
  readonly conversationId: string;
  readonly messageId: string;
  readonly model: string;
  readonly courseKey?: AriaCourseKey | null;
}

export interface AriaSSEDeltaPayload {
  readonly text: string;
}

export interface AriaSSECitationPayload {
  readonly citation: AriaCitationHit;
}

export interface AriaSSEMetadataPayload {
  readonly tokens?: number;
  readonly latencyMs?: number;
  readonly finishReason?: string;
}

export interface AriaSSEDonePayload {
  readonly messageId: string;
  readonly status: 'COMPLETED' | 'CANCELLED';
  readonly fullText?: string;
}

export interface AriaSSEErrorPayload {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

export type AriaSSEEvent =
  | { type: 'start'; payload: AriaSSEStartPayload }
  | { type: 'delta'; payload: AriaSSEDeltaPayload }
  | { type: 'citation'; payload: AriaSSECitationPayload }
  | { type: 'metadata'; payload: AriaSSEMetadataPayload }
  | { type: 'done'; payload: AriaSSEDonePayload }
  | { type: 'error'; payload: AriaSSEErrorPayload };

// ─── Formatage serveur ───────────────────────────────────────────────────────

/**
 * Formate un message SSE pour le flux de réponse.
 */
export function formatSSEMessage<T>(event: string, data: T): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ─── Parseur client isomorphe ────────────────────────────────────────────────

export interface AriaSSECallbacks {
  onStart?: (payload: AriaSSEStartPayload) => void;
  onDelta?: (payload: AriaSSEDeltaPayload) => void;
  onCitation?: (payload: AriaSSECitationPayload) => void;
  onMetadata?: (payload: AriaSSEMetadataPayload) => void;
  onDone?: (payload: AriaSSEDonePayload) => void;
  onError?: (payload: AriaSSEErrorPayload) => void;
}

/**
 * Lit et parse un ReadableStream SSE de manière robuste (gestion des chunks partiels).
 */
export async function parseAriaSSEStream(
  stream: ReadableStream<Uint8Array>,
  callbacks: AriaSSECallbacks
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const messages = buffer.split('\n\n');
      buffer = messages.pop() ?? '';

      for (const message of messages) {
        if (!message.trim()) continue;

        let eventType = '';
        let eventData = '';

        for (const line of message.split('\n')) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            eventData = line.slice(6).trim();
          }
        }

        if (!eventType || !eventData) continue;

        try {
          const parsed = JSON.parse(eventData);

          switch (eventType) {
            case 'start':
              callbacks.onStart?.(parsed as AriaSSEStartPayload);
              break;
            case 'delta':
              callbacks.onDelta?.(parsed as AriaSSEDeltaPayload);
              break;
            case 'citation':
              callbacks.onCitation?.(parsed as AriaSSECitationPayload);
              break;
            case 'metadata':
              callbacks.onMetadata?.(parsed as AriaSSEMetadataPayload);
              break;
            case 'done':
              callbacks.onDone?.(parsed as AriaSSEDonePayload);
              break;
            case 'error':
              callbacks.onError?.(parsed as AriaSSEErrorPayload);
              break;
          }
        } catch {
          // Ignore JSON parse error on malformed heartbeats
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
