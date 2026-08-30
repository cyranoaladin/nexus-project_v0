import { act, renderHook, waitFor } from '@testing-library/react';
import { useAriaConversation } from '@/components/aria/useAriaConversation';
import {
  AriaClientError,
  cancelAriaTurn,
  fetchAriaCurriculum,
  fetchAriaMessages,
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
    (fetchAriaMessages as jest.Mock).mockResolvedValue([]);
    (streamAriaConversation as jest.Mock).mockResolvedValue(undefined);
    (cancelAriaTurn as jest.Mock).mockResolvedValue(undefined);
    (submitAriaFeedback as jest.Mock).mockResolvedValue(undefined);
  });

  it('does no network work while closed', () => {
    const { result } = renderHook(() => useAriaConversation({ open: false }));
    expect(fetchAriaCurriculum).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('LOADING');
  });

  it.each([
    [courses, 'Choisissez un cours ARIA.'],
    [[{
      courseKey: 'stmg-sgn-premiere', label: 'Sciences de gestion', capabilities: { hasChat: false },
      access: { status: 'UNSUPPORTED' as const, commerciallyEntitled: true },
    }], 'Aucun cours ARIA avec chat n’est disponible.'],
  ])('requires an explicit context when no focused course is available %#', async (availableCourses, announcement) => {
    (fetchAriaCurriculum as jest.Mock).mockResolvedValueOnce({
      courses: availableCourses,
      profile: {
        version: 1, pinnedCourseKeys: [], focusedCourseKey: null,
        courseOrder: [], showCitations: true,
      },
    });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    expect(result.current.selectedCourseKey).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.announcement).toBe(announcement);
  });

  it('loads the latest resumable history before exposing READY', async () => {
    (fetchLatestAriaConversation as jest.Mock).mockResolvedValueOnce('conversation-history');
    (fetchAriaMessages as jest.Mock).mockResolvedValueOnce([{
      id: 'assistant-history', role: 'assistant', content: 'Historique', status: 'COMPLETED',
      citations: [], feedback: null,
    }]);
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    expect(fetchAriaMessages).toHaveBeenCalledWith(
      'conversation-history', expect.any(AbortSignal),
    );
    expect(result.current.messages).toEqual([
      expect.objectContaining({ id: 'assistant-history', content: 'Historique' }),
    ]);
  });

  it.each([
    [new AriaClientError('NOT_ENTITLED', 403, false), 'NOT_ENTITLED'],
    [new Error('private curriculum failure'), 'INTERNAL_ERROR'],
  ])('surfaces a safe curriculum loading error %#', async (failure, expectedCode) => {
    (fetchAriaCurriculum as jest.Mock).mockRejectedValueOnce(failure);
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('ERROR'));
    expect(result.current.errorCode).toBe(expectedCode);
    expect(result.current.announcement).toBe('Impossible de charger ARIA.');
  });

  it.each([
    [new AriaClientError('CONVERSATION_NOT_FOUND', 404, false), 'CONVERSATION_NOT_FOUND'],
    [new Error('private history failure'), 'INTERNAL_ERROR'],
  ])('surfaces a safe course history error %#', async (failure, expectedCode) => {
    (fetchLatestAriaConversation as jest.Mock).mockRejectedValueOnce(failure);
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('ERROR'));
    expect(result.current.errorCode).toBe(expectedCode);
    expect(result.current.announcement).toBe('Impossible de charger l’historique ARIA.');
  });

  it('rejects selecting unknown or unavailable courses without starting history work', async () => {
    const unavailableCourse = {
      courseKey: 'stmg-sgn-premiere', label: 'Sciences de gestion', capabilities: { hasChat: false },
      access: { status: 'UNSUPPORTED' as const, commerciallyEntitled: true },
    };
    (fetchAriaCurriculum as jest.Mock).mockResolvedValueOnce({
      courses: [...courses, unavailableCourse],
      profile: {
        version: 1, pinnedCourseKeys: [], focusedCourseKey: null,
        courseOrder: [], showCitations: true,
      },
    });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    jest.clearAllMocks();
    act(() => result.current.selectCourse('missing'));
    act(() => result.current.selectCourse('stmg-sgn-premiere'));
    expect(fetchLatestAriaConversation).not.toHaveBeenCalled();
    expect(result.current.selectedCourseKey).toBeNull();
  });

  it('does not submit an empty message or a message without explicit course context', async () => {
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    await act(async () => { await result.current.send(); });
    expect(streamAriaConversation).not.toHaveBeenCalled();

    (fetchAriaCurriculum as jest.Mock).mockResolvedValueOnce({
      courses, profile: {
        version: 1, pinnedCourseKeys: [], focusedCourseKey: null,
        courseOrder: [], showCitations: true,
      },
    });
    const noCourse = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(noCourse.result.current.phase).toBe('READY'));
    act(() => noCourse.result.current.setInput('Question'));
    await act(async () => { await noCourse.result.current.send(); });
    expect(streamAriaConversation).not.toHaveBeenCalled();
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

  it('applies canonical citations and RAG metadata only after a start event', async () => {
    const citation = {
      id: 'citation-1', sourceTitle: 'Programme officiel', traceability: 'CANONICAL' as const,
    };
    (streamAriaConversation as jest.Mock).mockImplementationOnce(async (_request, callbacks) => {
      callbacks.onDelta({ text: 'ignoré' });
      callbacks.onCitation({ citation });
      callbacks.onMetadata({ ragStatus: 'NO_RESULTS' });
      callbacks.onStart({
        turnId: 'turn-citations', conversationId: 'conversation-citations',
        messageId: 'assistant-citations', courseKey: 'eds-nsi-terminale',
        status: 'RUNNING', disposition: 'EXECUTED',
      });
      callbacks.onDelta({ text: 'Réponse ' });
      callbacks.onCitation({ citation });
      callbacks.onMetadata({});
      callbacks.onDone({
        turnId: 'turn-citations', messageId: 'assistant-citations', status: 'COMPLETED',
        fullText: 'Réponse complète',
      });
    });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question'));
    await act(async () => { await result.current.send(); });
    expect(result.current.ragStatus).toBeNull();
    expect(result.current.messages.find(({ id }) => id === 'assistant-citations')).toMatchObject({
      content: 'Réponse complète', status: 'COMPLETED', citations: [citation],
    });
    expect(result.current.announcement).toBe('Réponse ARIA terminée.');
  });

  it.each([
    [new AriaClientError('MODEL_UNAVAILABLE', 503, true), 'MODEL_UNAVAILABLE'],
    [new Error('private provider error'), 'INTERNAL_ERROR'],
  ])('marks a started assistant message ERROR when streaming throws %#', async (failure, expectedCode) => {
    (streamAriaConversation as jest.Mock).mockImplementationOnce(async (_request, callbacks) => {
      callbacks.onStart({
        turnId: 'turn-throw', conversationId: 'conversation-throw', messageId: 'assistant-throw',
        courseKey: 'eds-nsi-terminale', status: 'RUNNING', disposition: 'EXECUTED',
      });
      callbacks.onDelta({ text: 'Partiel' });
      throw failure;
    });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question'));
    await act(async () => { await result.current.send(); });
    expect(result.current.errorCode).toBe(expectedCode);
    expect(result.current.messages.find(({ id }) => id === 'assistant-throw')).toMatchObject({
      content: 'Partiel', status: 'ERROR',
    });
  });

  it('keeps a transport failure before start from inventing an assistant message', async () => {
    (streamAriaConversation as jest.Mock).mockRejectedValueOnce(new Error('connection'));
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question'));
    await act(async () => { await result.current.send(); });
    expect(result.current.messages.filter(({ role }) => role === 'assistant')).toEqual([]);
    expect(result.current.phase).toBe('ERROR');
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

  it('updates only the canonical assistant message after feedback persistence succeeds', async () => {
    (fetchLatestAriaConversation as jest.Mock).mockResolvedValueOnce('conversation-feedback');
    (fetchAriaMessages as jest.Mock).mockResolvedValueOnce([
      { id: 'assistant-feedback', role: 'assistant', content: 'Réponse', status: 'COMPLETED', citations: [], feedback: null },
      { id: 'user-other', role: 'user', content: 'Question', status: 'COMPLETED', citations: [], feedback: null },
    ]);
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    await act(async () => { await result.current.submitFeedback('assistant-feedback', false); });
    expect(result.current.messages).toEqual([
      expect.objectContaining({ id: 'assistant-feedback', feedback: false }),
      expect.objectContaining({ id: 'user-other', feedback: null }),
    ]);
    expect(result.current.announcement).toBe('Votre avis ARIA est enregistré.');
  });

  it.each([
    [new AriaClientError('INTERNAL_ERROR', 500, true), 'INTERNAL_ERROR'],
    [new Error('private cancel failure'), 'INTERNAL_ERROR'],
  ])('surfaces cancellation command failure without mutating content %#', async (failure, expectedCode) => {
    let holdStream: (() => void) | undefined;
    (streamAriaConversation as jest.Mock).mockImplementationOnce(async (_request, callbacks) => {
      callbacks.onStart({
        turnId: 'turn-cancel-error', conversationId: 'conversation-cancel-error',
        messageId: 'assistant-cancel-error', courseKey: 'eds-nsi-terminale',
        status: 'RUNNING', disposition: 'EXECUTED',
      });
      await new Promise<void>((resolve) => { holdStream = resolve; });
    });
    (cancelAriaTurn as jest.Mock).mockRejectedValueOnce(failure);
    const { result, unmount } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question'));
    act(() => { void result.current.send(); });
    await waitFor(() => expect(result.current.phase).toBe('STREAMING'));
    await act(async () => { await result.current.stop(); });
    expect(result.current.errorCode).toBe(expectedCode);
    expect(result.current.phase).toBe('ERROR');
    expect(result.current.announcement).toBe('Impossible d’arrêter proprement la réponse ARIA.');
    unmount();
    holdStream?.();
  });

  it('ignores stop when no canonical turn is active', async () => {
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    await act(async () => { await result.current.stop(); });
    expect(cancelAriaTurn).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('READY');
  });
});
