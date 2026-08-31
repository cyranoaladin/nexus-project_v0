import type { AriaHistoryCitation } from '../../domain/retrieval/history-citation';
import type { AriaPedagogicalMode } from '../../domain/pedagogy/pedagogical-mode';

export interface AriaConversationHistoryItem {
  readonly id: string;
  readonly courseKey: string | null;
  readonly contextState: 'ACTIVE' | 'LEGACY_CONTEXT_UNRESOLVED';
  readonly resumable: boolean;
  readonly title: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type { AriaHistoryCitation } from '../../domain/retrieval/history-citation';

export interface AriaConversationHistoryMessage {
  readonly courseKey: string | null;
  readonly conversationId: string;
  readonly turnId: string | null;
  readonly messageId: string;
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
  /** Compatibility projection: USER stays COMPLETED; only ASSISTANT mirrors Turn lifecycle. */
  readonly status: 'PENDING' | 'STREAMING' | 'COMPLETED' | 'CANCELLED' | 'ERROR';
  readonly citations: readonly AriaHistoryCitation[];
  readonly feedback: boolean | null;
  readonly createdAt: string;
}

export interface AriaConversationActiveTurn {
  readonly turnId: string;
  readonly clientRequestId: string;
  readonly status: 'PENDING' | 'RUNNING';
  readonly pedagogicalMode: AriaPedagogicalMode;
}

export interface AriaHistoryRepository {
  listConversations(input: Readonly<{
    actorUserId: string;
    courseKey?: string;
    contextState: 'ACTIVE' | 'LEGACY_CONTEXT_UNRESOLVED';
    cursor?: string;
    limit: number;
  }>): Promise<Readonly<{
    conversations: readonly AriaConversationHistoryItem[];
    nextCursor: string | null;
  }>>;
  listMessages(input: Readonly<{
    actorUserId: string;
    conversationId: string;
    cursor?: string;
    limit: number;
  }>): Promise<Readonly<{
    conversation: Pick<
      AriaConversationHistoryItem,
      'id' | 'courseKey' | 'contextState' | 'resumable'
    > & { readonly activeTurn: AriaConversationActiveTurn | null };
    messages: readonly AriaConversationHistoryMessage[];
    nextCursor: string | null;
  }>>;
}
