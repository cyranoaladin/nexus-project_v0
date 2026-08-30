import { act, renderHook, waitFor } from '@testing-library/react';
import { useAriaConversation } from '@/components/aria/useAriaConversation';
import {
  cancelAriaTurn,
  fetchAriaCurriculum,
  fetchLatestAriaConversation,
  streamAriaConversation,
  submitAriaFeedback,
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
      profile: {
        version: 1,
        pinnedCourseKeys: ['eds-nsi-terminale'],
        focusedCourseKey: 'eds-nsi-terminale',
        courseOrder: ['eds-nsi-terminale'],
        showCitations: true,
      },
    });
    (fetchLatestAriaConversation as jest.Mock).mockResolvedValue(null);
  });

  it('propagates the canonical citation visibility preference to the shared panel engine', async () => {
    (fetchAriaCurriculum as jest.Mock).mockResolvedValueOnce({
      courses,
      profile: {
        version: 1,
        pinnedCourseKeys: ['eds-nsi-terminale'],
        focusedCourseKey: 'eds-nsi-terminale',
        courseOrder: ['eds-nsi-terminale'],
        showCitations: false,
      },
    });

    const { result } = renderHook(() => useAriaConversation({ open: true }));

    await waitFor(() => expect(result.current.phase).toBe('READY'));
    expect(result.current.showCitations).toBe(false);
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

  it('U025 THREAD_CANCEL_PERSISTED_ERROR: keeps STOPPING until the canonical stream reports persisted CANCELLED', async () => {
    let streamCallbacks: {
      onDone: (event: { turnId: string; messageId: string; status: 'CANCELLED'; fullText: string }) => void;
    } | null = null;
    let streamSignal: AbortSignal | undefined;
    let completeStream: (() => void) | null = null;
    (cancelAriaTurn as jest.Mock).mockResolvedValue(undefined);
    (streamAriaConversation as jest.Mock).mockImplementationOnce(
      async (_request, callbacks, signal: AbortSignal) => {
        streamCallbacks = callbacks;
        streamSignal = signal;
        callbacks.onStart({
          turnId: 'turn-2', conversationId: 'conversation-1', messageId: 'assistant-2',
          courseKey: 'eds-nsi-terminale', status: 'RUNNING', disposition: 'EXECUTED',
        });
        callbacks.onDelta({ text: 'Réponse partielle' });
        await new Promise<void>((resolve) => { completeStream = resolve; });
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
    expect(result.current.phase).toBe('STOPPING');
    expect(streamSignal?.aborted).toBe(false);
    expect(result.current.messages.find(({ id }) => id === 'assistant-2')).toMatchObject({
      content: 'Réponse partielle',
      status: 'STREAMING',
    });

    act(() => {
      streamCallbacks?.onDone({
        turnId: 'turn-2',
        messageId: 'assistant-2',
        status: 'CANCELLED',
        fullText: 'Réponse partielle',
      });
      completeStream?.();
    });

    await waitFor(() => expect(result.current.phase).toBe('READY'));
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

  it('reconciles a retried SSE replay into one assistant message', async () => {
    (streamAriaConversation as jest.Mock).mockImplementationOnce(
      async (_request, callbacks) => {
        const start = {
          turnId: 'turn-retry', conversationId: 'conversation-retry', messageId: 'assistant-retry',
          courseKey: 'eds-nsi-terminale', status: 'RUNNING', disposition: 'EXECUTED',
        };
        callbacks.onStart(start);
        callbacks.onDelta({ text: 'Réponse interrompue' });
        callbacks.onStart({ ...start, disposition: 'REPLAY' });
        callbacks.onDelta({ text: 'Réponse persistée' });
        callbacks.onDone({
          turnId: 'turn-retry', messageId: 'assistant-retry', status: 'COMPLETED',
          fullText: 'Réponse persistée',
        });
      },
    );
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question avec reconnexion'));

    await act(async () => { await result.current.send(); });

    expect(result.current.messages.filter(({ id }) => id === 'assistant-retry')).toEqual([
      expect.objectContaining({ content: 'Réponse persistée', status: 'COMPLETED' }),
    ]);
  });

  it('announces feedback persistence failure without an unhandled rejection', async () => {
    (submitAriaFeedback as jest.Mock).mockRejectedValueOnce(
      new Error('private database detail'),
    );
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));

    await act(async () => { await result.current.submitFeedback('assistant-4', true); });

    expect(result.current.errorCode).toBe('INTERNAL_ERROR');
    expect(result.current.phase).toBe('ERROR');
    expect(result.current.announcement).toBe('Impossible d’enregistrer votre avis ARIA.');
  });
});
