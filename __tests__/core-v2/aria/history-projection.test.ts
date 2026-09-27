import { AriaConversationMessageRole, AriaConversationTurnStatus } from '@/lib/core-v2/client';
import {
  decodeCoreV2HistoryCursor,
  encodeCoreV2HistoryCursor,
  projectCoreV2MessageStatus,
} from '@/lib/core-v2/aria/history-projection';

describe('Core v2 history projection', () => {
  test.each([
    ['PENDING', 'PENDING'],
    ['RUNNING', 'STREAMING'],
    ['COMPLETED', 'COMPLETED'],
    ['CANCELLED', 'CANCELLED'],
    ['ERROR', 'ERROR'],
  ] as const)('derives assistant status %s from the Turn', (turnStatus, expected) => {
    expect(projectCoreV2MessageStatus(AriaConversationMessageRole.ASSISTANT, turnStatus as AriaConversationTurnStatus)).toBe(expected);
  });

  test('always marks the user message completed regardless of Turn lifecycle', () => {
    expect(projectCoreV2MessageStatus(AriaConversationMessageRole.USER, AriaConversationTurnStatus.RUNNING)).toBe('COMPLETED');
  });

  test('encodes and decodes an opaque deterministic keyset cursor', () => {
    const createdAt = new Date('2026-09-24T10:20:30.000Z');
    const cursor = encodeCoreV2HistoryCursor(createdAt, 'message-42');
    expect(cursor).not.toContain('message-42');
    expect(decodeCoreV2HistoryCursor(cursor)).toEqual({ createdAt, id: 'message-42' });
    expect(decodeCoreV2HistoryCursor(undefined)).toBeUndefined();
    expect(decodeCoreV2HistoryCursor('not-base64-json')).toBeUndefined();
    expect(decodeCoreV2HistoryCursor(Buffer.from(JSON.stringify({ createdAt: 'invalid', id: 'x' })).toString('base64url'))).toBeUndefined();
  });
});
