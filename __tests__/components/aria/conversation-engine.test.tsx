import { act, renderHook, waitFor } from '@testing-library/react';
import { useAriaConversation } from '@/components/aria/useAriaConversation';
import {
  cancelAriaTurn,
  fetchAriaCurriculum,
  fetchLatestAriaConversation,
  streamAriaConversation,
} from '@/lib/aria/client';

jest.mock('@/lib/aria/client', () => ({
  ...jest.requireActual('@/lib/aria/client'),
  fetchAriaCurriculum: jest.fn(),
  fetchLatestAriaConversation: jest.fn(),
  fetchAriaMessages: jest.fn(),
  streamAriaConversation: jest.fn(),
  cancelAriaTurn: jest.fn(),
  submitAriaFeedback: jest.fn(),
}));

const courses = [
  {
    courseKey: 'eds-nsi-terminale', label: 'NSI', capabilities: { hasChat: true },
    access: { status: 'AVAILABLE' as const, commerciallyEntitled: true },
  },
  {
    courseKey: 'eds-maths-premiere', label: 'Mathématiques', capabilities: { hasChat: true },
    access: { status: 'AVAILABLE' as const, commerciallyEntitled: true },
  },
];

describe('useAriaConversation stream isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchAriaCurriculum as jest.Mock).mockResolvedValue({
      courses,
      focusedCourseKey: 'eds-nsi-terminale',
    });
    (fetchLatestAriaConversation as jest.Mock).mockResolvedValue(null);
  });

  it('aborts the active stream and rejects its late events when the course changes', async () => {
    let lateDelta: ((payload: { text: string }) => void) | undefined;
    let streamSignal: AbortSignal | undefined;
    (streamAriaConversation as jest.Mock).mockImplementationOnce(
      async (_request, callbacks, signal: AbortSignal) => {
        streamSignal = signal;
        callbacks.onStart({
          turnId: 'turn-1', conversationId: 'conversation-1', messageId: 'assistant-1',
          courseKey: 'eds-nsi-terminale', status: 'RUNNING', disposition: 'EXECUTED',
        });
        lateDelta = callbacks.onDelta;
        await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
      },
    );
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));

    act(() => result.current.setInput('Question NSI'));
    act(() => { void result.current.send(); });
    await waitFor(() => expect(result.current.phase).toBe('STREAMING'));
    expect(result.current.messages.some(({ id }) => id === 'assistant-1')).toBe(true);

    act(() => result.current.selectCourse('eds-maths-premiere'));
    await waitFor(() => expect(result.current.selectedCourseKey).toBe('eds-maths-premiere'));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    expect(streamSignal?.aborted).toBe(true);

    act(() => lateDelta?.({ text: 'événement tardif interdit' }));
    expect(result.current.messages).toEqual([]);
  });

  it('settles STOPPING to CANCELLED after the canonical cancel command succeeds', async () => {
    (cancelAriaTurn as jest.Mock).mockResolvedValue(undefined);
    (streamAriaConversation as jest.Mock).mockImplementationOnce(
      async (_request, callbacks, signal: AbortSignal) => {
        callbacks.onStart({
          turnId: 'turn-2', conversationId: 'conversation-1', messageId: 'assistant-2',
          courseKey: 'eds-nsi-terminale', status: 'RUNNING', disposition: 'EXECUTED',
        });
        callbacks.onDelta({ text: 'Réponse partielle' });
        await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
      },
    );
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question'));
    act(() => { void result.current.send(); });
    await waitFor(() => expect(result.current.phase).toBe('STREAMING'));

    await act(async () => { await result.current.stop(); });

    expect(cancelAriaTurn).toHaveBeenCalledWith(
      'turn-2',
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
    expect(result.current.phase).toBe('READY');
    expect(result.current.messages.find(({ id }) => id === 'assistant-2')).toMatchObject({
      content: 'Réponse partielle',
      status: 'CANCELLED',
    });
    expect(result.current.announcement).toBe('Réponse ARIA arrêtée.');
  });

  it('marks partial assistant output ERROR when the canonical stream terminates with an error', async () => {
    (streamAriaConversation as jest.Mock).mockImplementationOnce(
      async (_request, callbacks) => {
        callbacks.onStart({
          turnId: 'turn-3', conversationId: 'conversation-1', messageId: 'assistant-3',
          courseKey: 'eds-nsi-terminale', status: 'RUNNING', disposition: 'EXECUTED',
        });
        callbacks.onDelta({ text: 'Réponse partielle auditée' });
        callbacks.onError({ code: 'MODEL_UNAVAILABLE', requestId: 'request-1', retryable: true });
      },
    );
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question'));
    await act(async () => { await result.current.send(); });

    expect(result.current.phase).toBe('ERROR');
    expect(result.current.messages.find(({ id }) => id === 'assistant-3')).toMatchObject({
      content: 'Réponse partielle auditée',
      status: 'ERROR',
    });
  });
});
