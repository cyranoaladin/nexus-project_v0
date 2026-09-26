import { act, renderHook, waitFor } from '@testing-library/react';
import { useAriaConversation } from '@/components/aria/useAriaConversation';
import {
  fetchAriaCurriculum,
  fetchAriaConversationHistory,
  fetchLatestAriaConversation,
  streamAriaConversation,
  cancelAriaTurn,
} from '@/lib/aria/client';

jest.mock('@/components/auth/SessionRecoveryProvider', () => ({
  useCanonicalSession: () => ({ data: { user: { authority: 'CORE_V2' } } }),
}));
jest.mock('@/lib/aria/client', () => ({
  ...jest.requireActual('@/lib/aria/client'),
  fetchAriaCurriculum: jest.fn(),
  fetchAriaConversationHistory: jest.fn(),
  fetchLatestAriaConversation: jest.fn(),
  streamAriaConversation: jest.fn(),
  cancelAriaTurn: jest.fn(),
}));

const clientRequestId = 'd9428888-122b-4fd9-806c-02948637efeb';

describe('Core v2 active Turn restoration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchAriaCurriculum as jest.Mock).mockResolvedValue({
      courses: [{
        courseKey: 'eds-nsi-terminale', label: 'NSI', capabilities: { hasChat: true },
        access: { status: 'AVAILABLE', commerciallyEntitled: true },
      }],
      profile: {
        version: 1, pinnedCourseKeys: ['eds-nsi-terminale'],
        focusedCourseKey: 'eds-nsi-terminale', courseOrder: ['eds-nsi-terminale'],
        showCitations: true,
      },
    });
    (fetchLatestAriaConversation as jest.Mock).mockResolvedValue('conversation-existing');
    (fetchAriaConversationHistory as jest.Mock).mockResolvedValue({
      activeTurn: {
        turnId: 'turn-running', clientRequestId, status: 'RUNNING', pedagogicalMode: 'DISCOVERY',
      },
      messages: [
        { id: 'user-existing', turnId: 'turn-running', role: 'user', content: 'Question existante', status: 'COMPLETED', citations: [], feedback: null },
        { id: 'assistant-existing', turnId: 'turn-running', role: 'assistant', content: '', status: 'STREAMING', citations: [], feedback: null },
      ],
    });
    (streamAriaConversation as jest.Mock).mockImplementation(() => new Promise(() => {}));
  });

  test('reload reconnects the existing Turn through the Core v2 endpoint with the same request id', async () => {
    const { result } = renderHook(() => useAriaConversation({ open: true }));

    await waitFor(() => expect(streamAriaConversation).toHaveBeenCalledTimes(1));
    expect(fetchLatestAriaConversation).toHaveBeenCalledWith('eds-nsi-terminale', expect.any(AbortSignal), 'CORE_V2');
    expect(fetchAriaConversationHistory).toHaveBeenCalledWith('conversation-existing', expect.any(AbortSignal), 'CORE_V2');
    expect(streamAriaConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        clientRequestId,
        conversationId: 'conversation-existing',
        courseKey: 'eds-nsi-terminale',
        content: 'Question existante',
        pedagogicalMode: 'DISCOVERY',
        authority: 'CORE_V2',
      }),
      expect.any(Object),
      expect.any(AbortSignal),
    );
    expect(result.current.phase).toBe('STREAMING');
    expect(result.current.messages).toHaveLength(2);
  });

  test('Stop after reload uses the restored request id and reloads a cancelled assistant status', async () => {
    (cancelAriaTurn as jest.Mock).mockResolvedValue({
      turnId: 'turn-running', conversationId: 'conversation-existing',
      status: 'CANCELLED', disposition: 'TERMINAL_REPLAY',
    });
    (fetchAriaConversationHistory as jest.Mock).mockResolvedValueOnce({
      activeTurn: {
        turnId: 'turn-running', clientRequestId, status: 'RUNNING', pedagogicalMode: 'DISCOVERY',
      },
      messages: [
        { id: 'user-existing', turnId: 'turn-running', role: 'user', content: 'Question existante', status: 'COMPLETED', citations: [], feedback: null },
        { id: 'assistant-existing', turnId: 'turn-running', role: 'assistant', content: '', status: 'STREAMING', citations: [], feedback: null },
      ],
    }).mockResolvedValueOnce({
      activeTurn: null,
      messages: [
        { id: 'user-existing', turnId: 'turn-running', role: 'user', content: 'Question existante', status: 'COMPLETED', citations: [], feedback: null },
        { id: 'assistant-existing', turnId: 'turn-running', role: 'assistant', content: 'Réponse partielle', status: 'CANCELLED', citations: [], feedback: null },
      ],
    });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('STREAMING'));

    await act(async () => { await result.current.stop(); });

    expect(cancelAriaTurn).toHaveBeenCalledWith('turn-running', clientRequestId, 'CORE_V2');
    expect(fetchAriaConversationHistory).toHaveBeenCalledTimes(2);
    expect(result.current.phase).toBe('READY');
    expect(result.current.messages.find(({ role }) => role === 'assistant'))
      .toMatchObject({ content: 'Réponse partielle', status: 'CANCELLED' });
  });
});
