export interface AriaConversationHistoryItem {
  readonly id: string;
  readonly courseKey: string | null;
  readonly contextState: 'ACTIVE' | 'LEGACY_CONTEXT_UNRESOLVED';
  readonly resumable: boolean;
  readonly title: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AriaHistoryCitation {
  readonly id: string;
  readonly sourceTitle: string;
  readonly sourceDocument: string;
  readonly sourceLocation: string | null;
  readonly courseKey: string;
  readonly provenance: string;
  readonly url: string | null;
  readonly resourceId: string | null;
  readonly resourceVersionId: string | null;
  readonly contentSha256: string | null;
  readonly chunkId: string | null;
  readonly locator: unknown;
  readonly corpusId: string | null;
  readonly corpusVersionId: string | null;
  readonly manifestSha256: string | null;
}

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
    >;
    messages: readonly AriaConversationHistoryMessage[];
    nextCursor: string | null;
  }>>;
}
