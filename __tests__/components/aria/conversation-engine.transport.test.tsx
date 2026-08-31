import { act, renderHook, waitFor } from '@testing-library/react';
import { useAriaConversation } from '@/components/aria/useAriaConversation';
import {
  fetchAriaCurriculum,
  fetchAriaConversationHistory,
  fetchLatestAriaConversation,
} from '@/lib/aria/client';

jest.mock('@/lib/aria/client', () => ({
  ...jest.requireActual('@/lib/aria/client'),
  fetchAriaCurriculum: jest.fn(),
  fetchLatestAriaConversation: jest.fn(),
  fetchAriaConversationHistory: jest.fn(),
}));

describe('useAriaConversation real transport normalization', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    (fetchAriaCurriculum as jest.Mock).mockResolvedValue({
      courses: [{
        courseKey: 'eds-nsi-terminale', label: 'NSI', capabilities: { hasChat: true },
        access: { status: 'AVAILABLE', commerciallyEntitled: true },
      }],
      profile: {
        version: 1,
        pinnedCourseKeys: ['eds-nsi-terminale'],
        focusedCourseKey: 'eds-nsi-terminale',
        courseOrder: ['eds-nsi-terminale'],
        showCitations: true,
      },
    });
    (fetchLatestAriaConversation as jest.Mock).mockResolvedValue(null);
    (fetchAriaConversationHistory as jest.Mock).mockResolvedValue({
      messages: [], activeTurn: null,
    });
  });

  it('surfaces a callback identity mismatch as INVALID_RESPONSE through fetch and SSE', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response([
      'event: start',
      `data: ${JSON.stringify({
        turnId: 'turn-real-transport', conversationId: 'conversation-real-transport',
        messageId: 'assistant-real-transport', courseKey: 'eds-maths-premiere',
        status: 'RUNNING', disposition: 'EXECUTED',
      })}`,
      '',
      'event: done',
      `data: ${JSON.stringify({
        turnId: 'turn-real-transport', messageId: 'assistant-real-transport',
        status: 'COMPLETED', fullText: 'Ne doit pas terminer',
      })}`,
      '',
    ].join('\n'), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    }));
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question NSI'));

    await act(async () => { await result.current.send(); });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.errorCode).toBe('INVALID_RESPONSE');
    expect(result.current.phase).toBe('RETRY_REQUIRED');
    expect(result.current.messages.filter(({ role }) => role === 'assistant')).toEqual([]);
  });
});
