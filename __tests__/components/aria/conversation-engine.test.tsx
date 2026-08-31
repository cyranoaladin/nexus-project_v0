import { act, renderHook, waitFor } from '@testing-library/react';
import { useAriaConversation } from '@/components/aria/useAriaConversation';
import {
  AriaClientError,
  cancelAriaTurn,
  fetchAriaCurriculum,
  fetchAriaConversationHistory,
  fetchLatestAriaConversation,
  streamAriaConversation,
  submitAriaFeedback,
  type AriaConversationTransportCallbacks,
} from '@/lib/aria/client';

jest.mock('@/lib/aria/client', () => ({
  ...jest.requireActual('@/lib/aria/client'),
  fetchAriaCurriculum: jest.fn(),
  fetchLatestAriaConversation: jest.fn(),
  fetchAriaConversationHistory: jest.fn(),
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
    (fetchAriaConversationHistory as jest.Mock).mockResolvedValue({ messages: [], activeTurn: null });
    (streamAriaConversation as jest.Mock).mockResolvedValue(undefined);
    (cancelAriaTurn as jest.Mock).mockImplementation(async (turnId: string) => ({
      turnId, conversationId: 'conversation-1', status: 'RUNNING',
      disposition: 'CANCELLATION_REQUESTED',
    }));
    (submitAriaFeedback as jest.Mock).mockImplementation(async (_messageId: string, useful: boolean) => ({
      id: 'feedback-canonical', useful, reason: null, updatedAt: '2026-08-31T00:00:00.000Z',
    }));
  });

  it('does no network work while closed', () => {
    const { result } = renderHook(() => useAriaConversation({ open: false }));
    expect(fetchAriaCurriculum).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('LOADING');
  });

  it('fails closed while curriculum access is revalidated on reopen', async () => {
    let resolveRevalidation: ((value: unknown) => void) | undefined;
    const revalidation = new Promise((resolve) => { resolveRevalidation = resolve; });
    (fetchAriaCurriculum as jest.Mock)
      .mockResolvedValueOnce({
        courses,
        profile: {
          version: 1, pinnedCourseKeys: [], focusedCourseKey: 'eds-nsi-terminale',
          courseOrder: [], showCitations: true,
        },
      })
      .mockReturnValueOnce(revalidation);
    const { result, rerender } = renderHook(
      ({ open }) => useAriaConversation({ open }),
      { initialProps: { open: true } },
    );
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    expect(fetchAriaCurriculum).toHaveBeenCalledTimes(1);
    expect(result.current.selectedCourseKey).toBe('eds-nsi-terminale');

    rerender({ open: false });
    rerender({ open: true });
    await waitFor(() => expect(fetchAriaCurriculum).toHaveBeenCalledTimes(2));
    expect(result.current.phase).toBe('LOADING');
    expect(result.current.selectedCourseKey).toBeNull();
    expect(result.current.messages).toEqual([]);
    act(() => result.current.setInput('Tentative pendant revalidation'));
    await act(async () => { await result.current.send(); });
    expect(streamAriaConversation).not.toHaveBeenCalled();

    resolveRevalidation?.({
      courses: [],
      profile: {
        version: 1, pinnedCourseKeys: [], focusedCourseKey: null,
        courseOrder: [], showCitations: true,
      },
    });
    await waitFor(() => expect(result.current.phase).toBe('READY'));
  });

  it('loads the first Academic Map-derived available course when no focus exists', async () => {
    (fetchAriaCurriculum as jest.Mock).mockResolvedValueOnce({
      courses,
      profile: {
        version: 1, pinnedCourseKeys: [], focusedCourseKey: null,
        courseOrder: [], showCitations: true,
      },
    });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    expect(result.current.selectedCourseKey).toBe('eds-nsi-terminale');
    expect(result.current.messages).toEqual([]);
    expect(fetchLatestAriaConversation).toHaveBeenCalledWith(
      'eds-nsi-terminale', expect.any(AbortSignal),
    );
  });

  it('keeps the explicit empty state when no chat course is available', async () => {
    (fetchAriaCurriculum as jest.Mock).mockResolvedValueOnce({
      courses: [{
        courseKey: 'stmg-sgn-premiere', label: 'Sciences de gestion',
        capabilities: { hasChat: false },
        access: { status: 'UNSUPPORTED' as const, commerciallyEntitled: true },
      }],
      profile: {
        version: 1, pinnedCourseKeys: [], focusedCourseKey: null,
        courseOrder: [], showCitations: true,
      },
    });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    expect(result.current.selectedCourseKey).toBeNull();
    expect(result.current.announcement).toBe('Aucun cours ARIA avec chat n’est disponible.');
  });

  it('loads the latest resumable history before exposing READY', async () => {
    (fetchLatestAriaConversation as jest.Mock).mockResolvedValueOnce('conversation-history');
    (fetchAriaConversationHistory as jest.Mock).mockResolvedValueOnce({ messages: [{
      id: 'assistant-history', role: 'assistant', content: 'Historique', status: 'COMPLETED',
      citations: [], feedback: null,
    }], activeTurn: null });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    expect(fetchAriaConversationHistory).toHaveBeenCalledWith(
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
    expect(result.current.selectedCourseKey).toBe('eds-nsi-terminale');
  });

  it('does not submit an empty message or a message without explicit course context', async () => {
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    await act(async () => { await result.current.send(); });
    expect(streamAriaConversation).not.toHaveBeenCalled();

    (fetchAriaCurriculum as jest.Mock).mockResolvedValueOnce({
      courses: [{
        courseKey: 'stmg-sgn-premiere', label: 'Sciences de gestion',
        capabilities: { hasChat: false },
        access: { status: 'UNSUPPORTED' as const, commerciallyEntitled: true },
      }], profile: {
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

  it('starts only one transport when send is invoked twice in the same render tick', async () => {
    (streamAriaConversation as jest.Mock).mockImplementation(
      async (_request, _callbacks, signal: AbortSignal) => new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve(), { once: true });
      }),
    );
    const { result, unmount } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Une seule demande'));

    act(() => {
      void result.current.send();
      void result.current.send();
    });

    await waitFor(() => expect(result.current.phase).toBe('STARTING'));
    expect(streamAriaConversation).toHaveBeenCalledTimes(1);
    expect(result.current.messages.filter(({ role }) => role === 'user')).toHaveLength(1);
    expect(result.current.messages[0]?.content).toBe('Une seule demande');
    unmount();
  });

  it('distinguishes pre-reservation STARTING from a cancellable running Turn', async () => {
    let release: (() => void) | undefined;
    (streamAriaConversation as jest.Mock).mockImplementationOnce(async () => new Promise<void>(
      (resolve) => { release = resolve; },
    ));
    const { result, unmount } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question'));
    act(() => { void result.current.send(); });
    await waitFor(() => expect(result.current.phase).toBe('STARTING'));
    await act(async () => { await result.current.stop(); });
    expect(cancelAriaTurn).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('STARTING');
    unmount();
    release?.();
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

  it('rejects course switching while a Turn is active', async () => {
    let streamSignal: AbortSignal | undefined;
    (streamAriaConversation as jest.Mock).mockImplementationOnce(
      async (_request, callbacks, signal: AbortSignal) => {
        streamSignal = signal;
        callbacks.onStart({
          turnId: 'turn-1', conversationId: 'conversation-1', messageId: 'assistant-1',
          courseKey: 'eds-nsi-terminale', status: 'RUNNING', disposition: 'EXECUTED',
        });
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
    expect(result.current.selectedCourseKey).toBe('eds-nsi-terminale');
    expect(result.current.phase).toBe('STREAMING');
    expect(streamSignal?.aborted).toBe(false);
  });

  it('reconstructs an active Turn after close/reopen and reconnects it to normal completion', async () => {
    let originalRequest: { clientRequestId: string; courseKey: string; content: string } | undefined;
    let completeReplay: (() => void) | undefined;
    (fetchLatestAriaConversation as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('conversation-reopen');
    (fetchAriaConversationHistory as jest.Mock).mockImplementationOnce(async () => ({
      activeTurn: {
        turnId: 'turn-reopen', clientRequestId: originalRequest?.clientRequestId,
        status: 'RUNNING', pedagogicalMode: 'METHODOLOGY',
      },
      messages: [
        {
          id: 'user-reopen', turnId: 'turn-reopen', role: 'user',
          content: 'Question avant fermeture', status: 'COMPLETED', citations: [], feedback: null,
        },
        {
          id: 'assistant-reopen', turnId: 'turn-reopen', role: 'assistant',
          content: 'Partiel', status: 'STREAMING', citations: [], feedback: null,
        },
      ],
    }));
    (streamAriaConversation as jest.Mock)
      .mockImplementationOnce(async (request, callbacks, signal: AbortSignal) => {
        originalRequest = request;
        callbacks.onStart({
          turnId: 'turn-reopen', conversationId: 'conversation-reopen',
          messageId: 'assistant-reopen', courseKey: 'eds-nsi-terminale',
          status: 'RUNNING', disposition: 'EXECUTED',
        });
        await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
      })
      .mockImplementationOnce(async (request, callbacks) => {
        expect(request.clientRequestId).toBe(originalRequest?.clientRequestId);
        expect(request.pedagogicalMode).toBe('METHODOLOGY');
        callbacks.onStart({
          turnId: 'turn-reopen', conversationId: 'conversation-reopen',
          messageId: 'assistant-reopen', courseKey: 'eds-nsi-terminale',
          status: 'RUNNING', disposition: 'REPLAY',
        });
        await new Promise<void>((resolve) => { completeReplay = resolve; });
        callbacks.onDone({
          turnId: 'turn-reopen', messageId: 'assistant-reopen',
          status: 'COMPLETED', fullText: 'Réponse terminée après reconnexion',
        });
      });
    const { result, rerender } = renderHook(
      ({ open }) => useAriaConversation({ open }),
      { initialProps: { open: true } },
    );
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question avant fermeture'));
    act(() => { void result.current.send(); });
    await waitFor(() => expect(result.current.phase).toBe('STREAMING'));

    rerender({ open: false });
    rerender({ open: true });
    await waitFor(() => expect(streamAriaConversation).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.phase).toBe('STREAMING'));
    expect(result.current.messages).toHaveLength(2);
    act(() => result.current.selectCourse('eds-maths-premiere'));
    expect(result.current.selectedCourseKey).toBe('eds-nsi-terminale');

    await act(async () => { completeReplay?.(); });
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    expect(result.current.messages.find(({ id }) => id === 'assistant-reopen')).toMatchObject({
      status: 'COMPLETED', content: 'Réponse terminée après reconnexion',
    });
    expect(cancelAriaTurn).not.toHaveBeenCalled();
  });

  it('preserves a pre-reservation idempotency key across close/reopen', async () => {
    let firstRequest: { clientRequestId: string } | undefined;
    (streamAriaConversation as jest.Mock)
      .mockImplementationOnce(async (request, _callbacks, signal: AbortSignal) => {
        firstRequest = request;
        await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
      })
      .mockImplementationOnce(async (request, callbacks) => {
        expect(request.clientRequestId).toBe(firstRequest?.clientRequestId);
        callbacks.onStart({
          turnId: 'turn-after-reopen', conversationId: 'conversation-after-reopen',
          messageId: 'assistant-after-reopen', courseKey: 'eds-nsi-terminale',
          status: 'RUNNING', disposition: 'EXECUTED',
        });
        callbacks.onDone({
          turnId: 'turn-after-reopen', messageId: 'assistant-after-reopen',
          status: 'COMPLETED', fullText: 'Réponse sans duplication',
        });
      });
    const { result, rerender } = renderHook(
      ({ open }) => useAriaConversation({ open }),
      { initialProps: { open: true } },
    );
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question avant réservation'));
    act(() => { void result.current.send(); });
    await waitFor(() => expect(result.current.phase).toBe('STARTING'));
    rerender({ open: false });
    rerender({ open: true });
    await waitFor(() => expect(result.current.phase).toBe('RETRY_REQUIRED'));

    await act(async () => { await result.current.retry(); });

    expect(streamAriaConversation).toHaveBeenCalledTimes(2);
    expect(result.current.phase).toBe('READY');
    expect(result.current.messages.find(({ id }) => id === 'assistant-after-reopen')).toMatchObject({
      status: 'COMPLETED', content: 'Réponse sans duplication',
    });
  });

  it('ignores stale callbacks from a detached pre-reservation transport after reopen', async () => {
    let staleCallbacks: AriaConversationTransportCallbacks | undefined;
    (streamAriaConversation as jest.Mock).mockImplementationOnce(
      async (_request, callbacks) => {
        staleCallbacks = callbacks;
        await new Promise<void>(() => undefined);
      },
    );
    const { result, rerender } = renderHook(
      ({ open }) => useAriaConversation({ open }),
      { initialProps: { open: true } },
    );
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question avant reconnexion'));
    act(() => { void result.current.send(); });
    await waitFor(() => expect(result.current.phase).toBe('STARTING'));

    rerender({ open: false });
    rerender({ open: true });
    await waitFor(() => expect(result.current.phase).toBe('RETRY_REQUIRED'));
    expect(result.current.messages).toEqual([]);

    act(() => {
      staleCallbacks?.onStart?.({
        turnId: 'stale-turn', conversationId: 'stale-conversation',
        messageId: 'stale-assistant', courseKey: 'eds-nsi-terminale',
        status: 'RUNNING', disposition: 'EXECUTED',
      });
      staleCallbacks?.onDone?.({
        turnId: 'stale-turn', messageId: 'stale-assistant',
        status: 'COMPLETED', fullText: 'Réponse obsolète',
      });
    });

    expect(result.current.phase).toBe('RETRY_REQUIRED');
    expect(result.current.messages).toEqual([]);
    expect(result.current.announcement).toBe(
      'Reprenez la même demande ARIA sans créer une seconde génération.',
    );
  });

  it('preserves a pre-reservation idempotency key when the course already has history', async () => {
    let firstRequest: { clientRequestId: string; conversationId?: string } | undefined;
    (fetchLatestAriaConversation as jest.Mock).mockResolvedValue('conversation-existing');
    (fetchAriaConversationHistory as jest.Mock).mockResolvedValue({
      activeTurn: null,
      messages: [{
        id: 'assistant-old', turnId: 'turn-old', role: 'assistant',
        content: 'Ancienne réponse', status: 'COMPLETED', citations: [], feedback: null,
      }],
    });
    (streamAriaConversation as jest.Mock)
      .mockImplementationOnce(async (request, _callbacks, signal: AbortSignal) => {
        firstRequest = request;
        await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
      })
      .mockImplementationOnce(async (request, callbacks) => {
        expect(request.clientRequestId).toBe(firstRequest?.clientRequestId);
        expect(request.conversationId).toBe('conversation-existing');
        callbacks.onStart({
          turnId: 'turn-existing-retry', conversationId: 'conversation-existing',
          messageId: 'assistant-existing-retry', courseKey: 'eds-nsi-terminale',
          status: 'RUNNING', disposition: 'EXECUTED',
        });
        callbacks.onDone({
          turnId: 'turn-existing-retry', messageId: 'assistant-existing-retry',
          status: 'COMPLETED', fullText: 'Réponse idempotente',
        });
      });
    const { result, rerender } = renderHook(
      ({ open }) => useAriaConversation({ open }),
      { initialProps: { open: true } },
    );
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question après historique'));
    act(() => { void result.current.send(); });
    await waitFor(() => expect(result.current.phase).toBe('STARTING'));

    rerender({ open: false });
    rerender({ open: true });
    await waitFor(() => expect(result.current.phase).toBe('RETRY_REQUIRED'));
    await act(async () => { await result.current.retry(); });

    expect(streamAriaConversation).toHaveBeenCalledTimes(2);
    expect(result.current.phase).toBe('READY');
    expect(result.current.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'assistant-old', content: 'Ancienne réponse' }),
      expect.objectContaining({
        id: 'assistant-existing-retry', status: 'COMPLETED', content: 'Réponse idempotente',
      }),
    ]));
  });

  it('U025 THREAD_CANCEL_PERSISTED_ERROR: keeps STOPPING until the canonical stream reports persisted CANCELLED', async () => {
    let streamCallbacks: {
      onDone: (event: { turnId: string; messageId: string; status: 'CANCELLED'; fullText: string }) => void;
    } | null = null;
    let streamSignal: AbortSignal | undefined;
    let completeStream: (() => void) | null = null;
    (cancelAriaTurn as jest.Mock).mockResolvedValue({
      turnId: 'turn-2', conversationId: 'conversation-1', status: 'RUNNING',
      disposition: 'CANCELLATION_REQUESTED',
    });
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

  it('HOOK_COALESCES_CONCURRENT_STOP_FOR_THE_SAME_TURN', async () => {
    let resolveCancellation: ((value: unknown) => void) | undefined;
    (cancelAriaTurn as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => {
      resolveCancellation = resolve;
    }));
    (streamAriaConversation as jest.Mock).mockImplementationOnce(
      async (_request, callbacks, signal: AbortSignal) => {
        callbacks.onStart({
          turnId: 'turn-stop-once', conversationId: 'conversation-stop-once',
          messageId: 'assistant-stop-once', courseKey: 'eds-nsi-terminale',
          status: 'RUNNING', disposition: 'EXECUTED',
        });
        await new Promise<void>((resolve) => {
          signal.addEventListener('abort', () => resolve(), { once: true });
        });
      },
    );
    const { result, unmount } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question à arrêter une seule fois'));
    act(() => { void result.current.send(); });
    await waitFor(() => expect(result.current.phase).toBe('STREAMING'));

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.stop();
      second = result.current.stop();
    });

    expect(cancelAriaTurn).toHaveBeenCalledTimes(1);
    act(() => resolveCancellation?.({
      turnId: 'turn-stop-once', conversationId: 'conversation-stop-once',
      status: 'RUNNING', disposition: 'CANCELLATION_REQUESTED',
    }));
    await act(async () => { await Promise.all([first, second]); });
    expect(result.current.phase).toBe('STOPPING');
    unmount();
  });

  it('HOOK_TERMINAL_CANCEL_HISTORY_FAILURE_NEVER_RESTORES_RUNNING_UI', async () => {
    (streamAriaConversation as jest.Mock).mockImplementationOnce(
      async (_request, callbacks) => {
        callbacks.onStart({
          turnId: 'turn-terminal-drift', conversationId: 'conversation-terminal-drift',
          messageId: 'assistant-terminal-drift', courseKey: 'eds-nsi-terminale',
          status: 'RUNNING', disposition: 'EXECUTED',
        });
        callbacks.onDelta({ text: 'Réponse partielle' });
        await new Promise<void>(() => undefined);
      },
    );
    (cancelAriaTurn as jest.Mock).mockResolvedValueOnce({
      turnId: 'turn-terminal-drift', conversationId: 'conversation-terminal-drift',
      status: 'CANCELLED', disposition: 'TERMINAL_REPLAY',
    });
    (fetchAriaConversationHistory as jest.Mock).mockResolvedValueOnce({
      messages: [{
        id: 'assistant-terminal-drift', turnId: 'turn-terminal-drift', role: 'assistant',
        content: 'État contradictoire', status: 'STREAMING', citations: [], feedback: null,
      }],
      activeTurn: {
        turnId: 'turn-terminal-drift', clientRequestId: 'request-terminal-drift',
        status: 'RUNNING', pedagogicalMode: 'DISCOVERY',
      },
    });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question à arrêter'));
    act(() => { void result.current.send(); });
    await waitFor(() => expect(result.current.phase).toBe('STREAMING'));

    await act(async () => { await result.current.stop(); });

    expect(result.current.errorCode).toBe('INVALID_RESPONSE');
    expect(result.current.phase).toBe('READY');
    expect(result.current.messages.find(({ id }) => id === 'assistant-terminal-drift')).toMatchObject({
      content: 'Réponse partielle', status: 'CANCELLED',
    });
    expect(result.current.announcement).toBe(
      'Réponse ARIA arrêtée, mais l’historique n’a pas pu être rechargé.',
    );
    await act(async () => { await result.current.stop(); });
    expect(cancelAriaTurn).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['assistant status', {
      assistantId: 'assistant-terminal-replay', assistantTurnId: 'turn-terminal-replay',
      assistantStatus: 'STREAMING', userTurnId: 'turn-terminal-replay',
    }],
    ['assistant identity', {
      assistantId: 'assistant-forged', assistantTurnId: 'turn-terminal-replay',
      assistantStatus: 'CANCELLED', userTurnId: 'turn-terminal-replay',
    }],
    ['turn identity', {
      assistantId: 'assistant-terminal-replay', assistantTurnId: 'turn-forged',
      assistantStatus: 'CANCELLED', userTurnId: 'turn-forged',
    }],
  ] as const)(
    'HOOK_TERMINAL_REPLAY_REJECTS_HISTORY_IDENTITY_OR_STATUS_MISMATCH_%s',
    async (_label, mismatch) => {
      (streamAriaConversation as jest.Mock).mockImplementationOnce(
        async (_request, callbacks, signal: AbortSignal) => {
          callbacks.onStart({
            turnId: 'turn-terminal-replay', conversationId: 'conversation-terminal-replay',
            messageId: 'assistant-terminal-replay', courseKey: 'eds-nsi-terminale',
            status: 'RUNNING', disposition: 'EXECUTED',
          });
          callbacks.onDelta({ text: 'Réponse partielle auditée' });
          await new Promise<void>((resolve) => {
            signal.addEventListener('abort', () => resolve(), { once: true });
          });
        },
      );
      (cancelAriaTurn as jest.Mock).mockResolvedValueOnce({
        turnId: 'turn-terminal-replay', conversationId: 'conversation-terminal-replay',
        status: 'CANCELLED', disposition: 'TERMINAL_REPLAY',
      });
      (fetchAriaConversationHistory as jest.Mock).mockResolvedValueOnce({
        activeTurn: null,
        messages: [{
          id: 'user-terminal-replay', turnId: mismatch.userTurnId, role: 'user',
          content: 'Question terminale auditée', status: 'COMPLETED', citations: [], feedback: null,
        }, {
          id: mismatch.assistantId, turnId: mismatch.assistantTurnId, role: 'assistant',
          content: 'Réponse persistée contradictoire', status: mismatch.assistantStatus,
          citations: [], feedback: null,
        }],
      });
      const { result } = renderHook(() => useAriaConversation({ open: true }));
      await waitFor(() => expect(result.current.phase).toBe('READY'));
      act(() => result.current.setInput('Question terminale auditée'));
      act(() => { void result.current.send(); });
      await waitFor(() => expect(result.current.phase).toBe('STREAMING'));

      await act(async () => { await result.current.stop(); });

      expect(result.current.errorCode).toBe('INVALID_RESPONSE');
      expect(result.current.phase).toBe('READY');
      expect(result.current.messages).not.toContainEqual(
        expect.objectContaining({ id: 'assistant-forged' }),
      );
      expect(result.current.messages.find(({ id }) => id === 'assistant-terminal-replay'))
        .toMatchObject({ content: 'Réponse partielle auditée', status: 'CANCELLED' });
      expect(result.current.messages.find(({ role }) => role === 'user'))
        .toMatchObject({ content: 'Question terminale auditée', status: 'COMPLETED' });
    },
  );

  it('HOOK_TERMINAL_REPLAY_ACCEPTS_EXACT_CANONICAL_HISTORY', async () => {
    (streamAriaConversation as jest.Mock).mockImplementationOnce(
      async (_request, callbacks, signal: AbortSignal) => {
        callbacks.onStart({
          turnId: 'turn-terminal-canonical', conversationId: 'conversation-terminal-canonical',
          messageId: 'assistant-terminal-canonical', courseKey: 'eds-nsi-terminale',
          status: 'RUNNING', disposition: 'EXECUTED',
        });
        callbacks.onDelta({ text: 'Réponse partielle' });
        await new Promise<void>((resolve) => {
          signal.addEventListener('abort', () => resolve(), { once: true });
        });
      },
    );
    (cancelAriaTurn as jest.Mock).mockResolvedValueOnce({
      turnId: 'turn-terminal-canonical', conversationId: 'conversation-terminal-canonical',
      status: 'CANCELLED', disposition: 'TERMINAL_REPLAY',
    });
    (fetchAriaConversationHistory as jest.Mock).mockResolvedValueOnce({
      activeTurn: null,
      messages: [{
        id: 'user-terminal-canonical', turnId: 'turn-terminal-canonical', role: 'user',
        content: 'Question terminale canonique', status: 'COMPLETED', citations: [], feedback: null,
      }, {
        id: 'assistant-terminal-canonical', turnId: 'turn-terminal-canonical', role: 'assistant',
        content: 'Réponse partielle persistée', status: 'CANCELLED', citations: [], feedback: null,
      }],
    });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question terminale canonique'));
    act(() => { void result.current.send(); });
    await waitFor(() => expect(result.current.phase).toBe('STREAMING'));

    await act(async () => { await result.current.stop(); });

    expect(result.current.errorCode).toBeNull();
    expect(result.current.phase).toBe('READY');
    expect(result.current.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'user-terminal-canonical', turnId: 'turn-terminal-canonical',
        content: 'Question terminale canonique', status: 'COMPLETED',
      }),
      expect.objectContaining({
        id: 'assistant-terminal-canonical', turnId: 'turn-terminal-canonical',
        content: 'Réponse partielle persistée', status: 'CANCELLED',
      }),
    ]));
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

    expect(result.current.phase).toBe('READY');
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
  ])('reattaches the same started Turn after transport failure until cancellation is terminal %#', async (failure, expectedCode) => {
    (cancelAriaTurn as jest.Mock).mockResolvedValueOnce({
      turnId: 'turn-throw', conversationId: 'conversation-throw', status: 'RUNNING',
      disposition: 'CANCELLATION_REQUESTED',
    });
    (streamAriaConversation as jest.Mock)
      .mockImplementationOnce(async (_request, callbacks) => {
        callbacks.onStart({
          turnId: 'turn-throw', conversationId: 'conversation-throw', messageId: 'assistant-throw',
          courseKey: 'eds-nsi-terminale', status: 'RUNNING', disposition: 'EXECUTED',
        });
        callbacks.onDelta({ text: 'Partiel' });
        throw failure;
      })
      .mockImplementationOnce(async (_request, callbacks) => {
        callbacks.onStart({
          turnId: 'turn-throw', conversationId: 'conversation-throw', messageId: 'assistant-throw',
          courseKey: 'eds-nsi-terminale', status: 'RUNNING', disposition: 'REPLAY',
        });
        callbacks.onDone({
          turnId: 'turn-throw', messageId: 'assistant-throw', status: 'CANCELLED',
          fullText: 'Partiel',
        });
      });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question'));
    await act(async () => { await result.current.send(); });
    expect(result.current.errorCode).toBe(expectedCode);
    expect(result.current.messages.find(({ id }) => id === 'assistant-throw')).toMatchObject({
      content: 'Partiel', status: 'STREAMING',
    });
    expect(result.current.phase).toBe('STREAMING');
    await act(async () => { await result.current.stop(); });
    expect(cancelAriaTurn).toHaveBeenCalledWith('turn-throw', expect.any(String));
    expect(streamAriaConversation).toHaveBeenCalledTimes(2);
    expect((streamAriaConversation as jest.Mock).mock.calls[1]?.[0].clientRequestId)
      .toBe((streamAriaConversation as jest.Mock).mock.calls[0]?.[0].clientRequestId);
    expect(result.current.phase).toBe('READY');
    expect(result.current.messages.find(({ id }) => id === 'assistant-throw')).toMatchObject({
      content: 'Partiel', status: 'CANCELLED',
    });
  });

  it('keeps a transport failure before start from inventing an assistant message', async () => {
    (streamAriaConversation as jest.Mock).mockRejectedValueOnce(new Error('connection'));
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question'));
    await act(async () => { await result.current.send(); });
    expect(result.current.messages.filter(({ role }) => role === 'assistant')).toEqual([]);
    expect(result.current.phase).toBe('RETRY_REQUIRED');
  });

  it('retries a pre-start transport failure with the exact same idempotency key', async () => {
    (streamAriaConversation as jest.Mock)
      .mockRejectedValueOnce(new Error('headers lost after reservation'))
      .mockImplementationOnce(async (_request, callbacks) => {
        callbacks.onStart({
          turnId: 'turn-resumed', conversationId: 'conversation-resumed',
          messageId: 'assistant-resumed', courseKey: 'eds-nsi-terminale',
          status: 'RUNNING', disposition: 'REPLAY',
        });
        callbacks.onDone({
          turnId: 'turn-resumed', messageId: 'assistant-resumed', status: 'COMPLETED',
          fullText: 'Réponse reprise',
        });
      });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question idempotente'));
    await act(async () => { await result.current.send(); });
    expect(result.current.phase).toBe('RETRY_REQUIRED');
    const originalRequest = (streamAriaConversation as jest.Mock).mock.calls[0]?.[0];

    await act(async () => { await result.current.retry(); });

    expect(streamAriaConversation).toHaveBeenCalledTimes(2);
    expect((streamAriaConversation as jest.Mock).mock.calls[1]?.[0]).toEqual(originalRequest);
    expect(result.current.phase).toBe('READY');
    expect(result.current.messages.find(({ id }) => id === 'assistant-resumed')).toMatchObject({
      content: 'Réponse reprise', status: 'COMPLETED',
    });
  });

  it('does not create a second request after the server exposes a pending Turn', async () => {
    (streamAriaConversation as jest.Mock).mockImplementationOnce(async (_request, callbacks) => {
      callbacks.onPending({
        turnId: 'turn-pending', status: 'RUNNING', disposition: 'IN_PROGRESS', retryAfterMs: 100,
      });
      throw new AriaClientError('MODEL_UNAVAILABLE', 503, true);
    });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question réservée'));
    await act(async () => { await result.current.send(); });
    expect(result.current.phase).toBe('PENDING');
    act(() => result.current.setInput('Nouvelle question interdite'));
    await act(async () => { await result.current.send(); });
    expect(streamAriaConversation).toHaveBeenCalledTimes(1);
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

  it.each(['messageId', 'conversationId'] as const)(
    'rejects a replay that changes the canonical %s',
    async (field) => {
      (streamAriaConversation as jest.Mock).mockImplementationOnce(
        async (_request, callbacks) => {
          const start = {
            turnId: 'turn-identity', conversationId: 'conversation-identity',
            messageId: 'assistant-identity', courseKey: 'eds-nsi-terminale',
            status: 'RUNNING', disposition: 'EXECUTED',
          };
          callbacks.onStart(start);
          callbacks.onStart({
            ...start,
            disposition: 'REPLAY',
            [field]: field === 'messageId'
              ? 'assistant-contradictory'
              : 'conversation-contradictory',
          });
          callbacks.onDone({
            turnId: start.turnId, messageId: start.messageId,
            status: 'COMPLETED', fullText: 'Ne doit pas terminer',
          });
        },
      );
      const { result } = renderHook(() => useAriaConversation({ open: true }));
      await waitFor(() => expect(result.current.phase).toBe('READY'));
      act(() => result.current.setInput('Question avec identité canonique'));

      await act(async () => { await result.current.send(); });

      expect(result.current.errorCode).toBe('INVALID_RESPONSE');
      expect(result.current.phase).toBe('STREAMING');
      expect(result.current.messages.filter(({ role }) => role === 'assistant')).toEqual([
        expect.objectContaining({
          id: 'assistant-identity', status: 'STREAMING', content: '',
        }),
      ]);
    },
  );

  it('rejects a first start that changes the requested course', async () => {
    (streamAriaConversation as jest.Mock).mockImplementationOnce(async (_request, callbacks) => {
      callbacks.onStart({
        turnId: 'turn-course-first', conversationId: 'conversation-course-first',
        messageId: 'assistant-course-first', courseKey: 'eds-maths-premiere',
        status: 'RUNNING', disposition: 'EXECUTED',
      });
    });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question NSI'));

    await act(async () => { await result.current.send(); });

    expect(result.current.errorCode).toBe('INVALID_RESPONSE');
    expect(result.current.phase).toBe('RETRY_REQUIRED');
    expect(result.current.messages.filter(({ role }) => role === 'assistant')).toEqual([]);
  });

  it.each(['courseKey', 'turnId'] as const)(
    'rejects a replay that changes the canonical %s',
    async (field) => {
      (streamAriaConversation as jest.Mock).mockImplementationOnce(
        async (_request, callbacks) => {
          const start = {
            turnId: 'turn-replay-identity', conversationId: 'conversation-replay-identity',
            messageId: 'assistant-replay-identity', courseKey: 'eds-nsi-terminale',
            status: 'RUNNING', disposition: 'EXECUTED',
          };
          callbacks.onStart(start);
          callbacks.onDelta({ text: 'Réponse canonique' });
          callbacks.onStart({
            ...start,
            disposition: 'REPLAY',
            [field]: field === 'courseKey' ? 'eds-maths-premiere' : 'turn-contradictory',
          });
        },
      );
      const { result } = renderHook(() => useAriaConversation({ open: true }));
      await waitFor(() => expect(result.current.phase).toBe('READY'));
      act(() => result.current.setInput('Question avec replay'));

      await act(async () => { await result.current.send(); });

      expect(result.current.errorCode).toBe('INVALID_RESPONSE');
      expect(result.current.phase).toBe('STREAMING');
      expect(result.current.messages.find(
        ({ id }) => id === 'assistant-replay-identity',
      )).toMatchObject({ content: 'Réponse canonique', status: 'STREAMING' });
    },
  );

  it('rejects a pending replay that changes the canonical turn', async () => {
    (streamAriaConversation as jest.Mock).mockImplementationOnce(async (_request, callbacks) => {
      callbacks.onPending({
        turnId: 'turn-pending-identity', status: 'RUNNING',
        disposition: 'IN_PROGRESS', retryAfterMs: 100,
      });
      callbacks.onPending({
        turnId: 'turn-pending-contradictory', status: 'RUNNING',
        disposition: 'IN_PROGRESS', retryAfterMs: 100,
      });
    });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question réservée'));

    await act(async () => { await result.current.send(); });

    expect(result.current.errorCode).toBe('INVALID_RESPONSE');
    expect(result.current.phase).toBe('PENDING');
    expect(result.current.messages.filter(({ role }) => role === 'assistant')).toEqual([]);
  });

  it.each(['turnId', 'messageId'] as const)(
    'rejects a terminal event that changes the canonical %s',
    async (field) => {
      (streamAriaConversation as jest.Mock).mockImplementationOnce(
        async (_request, callbacks) => {
          const start = {
            turnId: 'turn-terminal-identity', conversationId: 'conversation-terminal-identity',
            messageId: 'assistant-terminal-identity', courseKey: 'eds-nsi-terminale',
            status: 'RUNNING', disposition: 'EXECUTED',
          };
          callbacks.onStart(start);
          callbacks.onDelta({ text: 'Partiel canonique' });
          callbacks.onDone({
            turnId: field === 'turnId' ? 'turn-contradictory' : start.turnId,
            messageId: field === 'messageId' ? 'assistant-contradictory' : start.messageId,
            status: 'COMPLETED', fullText: 'Terminal contradictoire',
          });
        },
      );
      const { result } = renderHook(() => useAriaConversation({ open: true }));
      await waitFor(() => expect(result.current.phase).toBe('READY'));
      act(() => result.current.setInput('Question avec terminal canonique'));

      await act(async () => { await result.current.send(); });

      expect(result.current.errorCode).toBe('INVALID_RESPONSE');
      expect(result.current.phase).toBe('STREAMING');
      expect(result.current.messages.find(
        ({ id }) => id === 'assistant-terminal-identity',
      )).toMatchObject({ content: 'Partiel canonique', status: 'STREAMING' });
    },
  );

  it('rejects a first start that contradicts the requested conversation', async () => {
    (fetchLatestAriaConversation as jest.Mock).mockResolvedValueOnce('conversation-requested');
    (fetchAriaConversationHistory as jest.Mock).mockResolvedValueOnce({
      messages: [], activeTurn: null,
    });
    (streamAriaConversation as jest.Mock).mockImplementationOnce(async (request, callbacks) => {
      expect(request.conversationId).toBe('conversation-requested');
      callbacks.onStart({
        turnId: 'turn-requested', conversationId: 'conversation-contradictory',
        messageId: 'assistant-requested', courseKey: 'eds-nsi-terminale',
        status: 'RUNNING', disposition: 'EXECUTED',
      });
      callbacks.onDone({
        turnId: 'turn-requested', messageId: 'assistant-requested',
        status: 'COMPLETED', fullText: 'Ne doit pas terminer',
      });
    });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question dans la conversation existante'));

    await act(async () => { await result.current.send(); });

    expect(result.current.errorCode).toBe('INVALID_RESPONSE');
    expect(result.current.phase).toBe('RETRY_REQUIRED');
    expect(result.current.messages.filter(({ role }) => role === 'assistant')).toEqual([]);
  });

  it.each(['turnId', 'conversationId'] as const)(
    'rejects a cancellation response with a contradictory %s and retains the same Turn',
    async (field) => {
    let canonicalClientRequestId: string | undefined;
    let streamCallbacks: AriaConversationTransportCallbacks | undefined;
    (streamAriaConversation as jest.Mock).mockImplementationOnce(
      async (request, callbacks, signal: AbortSignal) => {
        canonicalClientRequestId = request.clientRequestId;
        streamCallbacks = callbacks;
        callbacks.onStart({
          turnId: 'turn-cancel-identity', conversationId: 'conversation-cancel-identity',
          messageId: 'assistant-cancel-identity', courseKey: 'eds-nsi-terminale',
          status: 'RUNNING', disposition: 'EXECUTED',
        });
        callbacks.onDelta({ text: 'Réponse partielle conservée' });
        await new Promise<void>((resolve) => signal.addEventListener(
          'abort', () => resolve(), { once: true },
        ));
      },
    );
    (cancelAriaTurn as jest.Mock)
      .mockResolvedValueOnce({
        turnId: field === 'turnId' ? 'turn-contradictory' : 'turn-cancel-identity',
        conversationId: field === 'conversationId'
          ? 'conversation-contradictory'
          : 'conversation-cancel-identity',
        status: 'RUNNING', disposition: 'CANCELLATION_REQUESTED',
      })
      .mockResolvedValueOnce({
        turnId: 'turn-cancel-identity', conversationId: 'conversation-cancel-identity',
        status: 'RUNNING', disposition: 'CANCELLATION_REQUESTED',
      });
    const { result, unmount } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question à arrêter'));
    act(() => { void result.current.send(); });
    await waitFor(() => expect(result.current.phase).toBe('STREAMING'));

    await act(async () => { await result.current.stop(); });

    expect(result.current.errorCode).toBe('INVALID_RESPONSE');
    expect(result.current.phase).toBe('STREAMING');
    expect(result.current.announcement).toBe('Impossible d’arrêter proprement la réponse ARIA.');
    expect(result.current.messages.find(
      ({ id }) => id === 'assistant-cancel-identity',
    )).toMatchObject({ content: 'Réponse partielle conservée', status: 'STREAMING' });
    expect(cancelAriaTurn).toHaveBeenNthCalledWith(
      1, 'turn-cancel-identity', canonicalClientRequestId,
    );

    await act(async () => { await result.current.stop(); });

    expect(cancelAriaTurn).toHaveBeenNthCalledWith(
      2, 'turn-cancel-identity', canonicalClientRequestId,
    );
    expect(result.current.phase).toBe('STOPPING');
    act(() => streamCallbacks?.onDone?.({
      turnId: 'turn-cancel-identity', messageId: 'assistant-cancel-identity',
      status: 'CANCELLED', fullText: 'Réponse partielle conservée',
    }));
    expect(result.current.phase).toBe('READY');
    expect(result.current.messages.find(
      ({ id }) => id === 'assistant-cancel-identity',
    )).toMatchObject({ content: 'Réponse partielle conservée', status: 'CANCELLED' });
    unmount();
    },
  );

  it('announces feedback persistence failure without an unhandled rejection', async () => {
    (submitAriaFeedback as jest.Mock).mockRejectedValueOnce(
      new Error('private database detail'),
    );
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));

    await act(async () => { await result.current.submitFeedback('assistant-4', true); });

    expect(result.current.errorCode).toBe('INTERNAL_ERROR');
    expect(result.current.phase).toBe('READY');
    expect(result.current.announcement).toBe('Impossible d’enregistrer votre avis ARIA.');
  });

  it('updates only the canonical assistant message after feedback persistence succeeds', async () => {
    (fetchLatestAriaConversation as jest.Mock).mockResolvedValueOnce('conversation-feedback');
    (fetchAriaConversationHistory as jest.Mock).mockResolvedValueOnce({ messages: [
      { id: 'assistant-feedback', role: 'assistant', content: 'Réponse', status: 'COMPLETED', citations: [], feedback: null },
      { id: 'user-other', role: 'user', content: 'Question', status: 'COMPLETED', citations: [], feedback: null },
    ], activeTurn: null });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    await act(async () => { await result.current.submitFeedback('assistant-feedback', false); });
    expect(result.current.messages).toEqual([
      expect.objectContaining({ id: 'assistant-feedback', feedback: false }),
      expect.objectContaining({ id: 'user-other', feedback: null }),
    ]);
    expect(result.current.announcement).toBe('Votre avis ARIA est enregistré.');
  });

  it('clears a prior feedback failure after the canonical retry succeeds', async () => {
    (submitAriaFeedback as jest.Mock)
      .mockRejectedValueOnce(new Error('first write failed'))
      .mockResolvedValueOnce({
        id: 'feedback-canonical', useful: true, reason: null,
        updatedAt: '2026-08-31T00:00:00.000Z',
      });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    await act(async () => { await result.current.submitFeedback('assistant-feedback', true); });
    expect(result.current.errorCode).toBe('INTERNAL_ERROR');
    await act(async () => { await result.current.submitFeedback('assistant-feedback', true); });
    expect(result.current.errorCode).toBeNull();
    expect(result.current.announcement).toBe('Votre avis ARIA est enregistré.');
  });

  it('does not let delayed feedback success erase a newer generation error', async () => {
    let completeFeedback: ((value: unknown) => void) | undefined;
    (submitAriaFeedback as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => {
      completeFeedback = resolve;
    }));
    (streamAriaConversation as jest.Mock).mockImplementationOnce(async (_request, callbacks) => {
      callbacks.onStart({
        turnId: 'turn-new-error', conversationId: 'conversation-new-error',
        messageId: 'assistant-new-error', courseKey: 'eds-nsi-terminale',
        status: 'RUNNING', disposition: 'EXECUTED',
      });
      callbacks.onError({ code: 'MODEL_UNAVAILABLE', requestId: 'request-new-error', retryable: true });
    });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => { void result.current.submitFeedback('assistant-old', true); });
    act(() => result.current.setInput('Nouvelle génération'));
    await act(async () => { await result.current.send(); });
    expect(result.current.errorCode).toBe('MODEL_UNAVAILABLE');
    expect(result.current.announcement).toBe('La réponse ARIA a échoué.');
    await act(async () => {
      completeFeedback?.({
        id: 'feedback-old', useful: true, reason: null,
        updatedAt: '2026-08-31T00:00:00.000Z',
      });
    });
    expect(result.current.errorCode).toBe('MODEL_UNAVAILABLE');
    expect(result.current.announcement).toBe('La réponse ARIA a échoué.');
  });

  it('does not let delayed feedback failure replace a newer generation error', async () => {
    let failFeedback: ((error: Error) => void) | undefined;
    (submitAriaFeedback as jest.Mock).mockImplementationOnce(() => new Promise((_resolve, reject) => {
      failFeedback = reject;
    }));
    (streamAriaConversation as jest.Mock).mockImplementationOnce(async (_request, callbacks) => {
      callbacks.onStart({
        turnId: 'turn-after-feedback', conversationId: 'conversation-after-feedback',
        messageId: 'assistant-after-feedback', courseKey: 'eds-nsi-terminale',
        status: 'RUNNING', disposition: 'EXECUTED',
      });
      callbacks.onError({ code: 'RAG_UNAVAILABLE', requestId: 'request-after-feedback', retryable: true });
    });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => { void result.current.submitFeedback('assistant-old', true); });
    act(() => result.current.setInput('Question groundée'));
    await act(async () => { await result.current.send(); });
    await act(async () => { failFeedback?.(new Error('old feedback failed')); });
    expect(result.current.errorCode).toBe('RAG_UNAVAILABLE');
    expect(result.current.announcement).toBe('La réponse ARIA a échoué.');
  });

  it('serializes opposite feedback votes and applies each canonical persisted value', async () => {
    (fetchLatestAriaConversation as jest.Mock).mockResolvedValueOnce('conversation-feedback-order');
    (fetchAriaConversationHistory as jest.Mock).mockResolvedValueOnce({ messages: [{
      id: 'assistant-vote', role: 'assistant', content: 'Réponse', status: 'COMPLETED',
      citations: [], feedback: null,
    }], activeTurn: null });
    let finishFirst: ((value: unknown) => void) | undefined;
    (submitAriaFeedback as jest.Mock)
      .mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }))
      .mockResolvedValueOnce({
        id: 'feedback-vote', useful: false, reason: null,
        updatedAt: '2026-08-31T00:00:01.000Z',
      });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.submitFeedback('assistant-vote', true);
      second = result.current.submitFeedback('assistant-vote', false);
    });
    expect(submitAriaFeedback).toHaveBeenCalledTimes(1);
    await act(async () => {
      finishFirst?.({
        id: 'feedback-vote', useful: true, reason: null,
        updatedAt: '2026-08-31T00:00:00.000Z',
      });
      await first;
    });
    expect(submitAriaFeedback).toHaveBeenCalledTimes(2);
    await act(async () => { await second; });
    expect(result.current.messages[0]?.feedback).toBe(false);
  });

  it.each([
    [new AriaClientError('INTERNAL_ERROR', 500, true), 'INTERNAL_ERROR'],
    [new Error('private cancel failure'), 'INTERNAL_ERROR'],
  ])('surfaces cancellation command failure without mutating content %#', async (failure, expectedCode) => {
    let holdStream: (() => void) | undefined;
    let terminal: ((event: {
      turnId: string; messageId: string; status: 'CANCELLED'; fullText: string;
    }) => void) | undefined;
    (streamAriaConversation as jest.Mock).mockImplementationOnce(async (_request, callbacks) => {
      terminal = callbacks.onDone;
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
    expect(result.current.phase).toBe('STREAMING');
    expect(result.current.announcement).toBe('Impossible d’arrêter proprement la réponse ARIA.');
    act(() => terminal?.({
      turnId: 'turn-cancel-error', messageId: 'assistant-cancel-error',
      status: 'CANCELLED', fullText: '',
    }));
    expect(result.current.phase).toBe('READY');
    expect(result.current.errorCode).toBeNull();
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

  it('allows a second provider execution after a terminal model error', async () => {
    (streamAriaConversation as jest.Mock)
      .mockImplementationOnce(async (_request, callbacks) => {
        callbacks.onStart({
          turnId: 'turn-first', conversationId: 'conversation-retry-error',
          messageId: 'assistant-first', courseKey: 'eds-nsi-terminale',
          status: 'RUNNING', disposition: 'EXECUTED',
        });
        callbacks.onError({ code: 'MODEL_UNAVAILABLE', requestId: 'request-first', retryable: true });
      })
      .mockImplementationOnce(async (_request, callbacks) => {
        callbacks.onStart({
          turnId: 'turn-second', conversationId: 'conversation-retry-error',
          messageId: 'assistant-second', courseKey: 'eds-nsi-terminale',
          status: 'RUNNING', disposition: 'EXECUTED',
        });
        callbacks.onDone({
          turnId: 'turn-second', messageId: 'assistant-second', status: 'COMPLETED',
          fullText: 'Réponse après retry',
        });
      });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Premier essai'));
    await act(async () => { await result.current.send(); });
    expect(result.current.phase).toBe('READY');
    expect(result.current.errorCode).toBe('MODEL_UNAVAILABLE');

    act(() => result.current.setInput('Deuxième essai'));
    await act(async () => { await result.current.send(); });
    expect(streamAriaConversation).toHaveBeenCalledTimes(2);
    expect(result.current.messages.find(({ id }) => id === 'assistant-second')).toMatchObject({
      content: 'Réponse après retry', status: 'COMPLETED',
    });
  });

  it.each(['resolve', 'reject'] as const)(
    'keeps canonical terminal state when a cancellation response arrives late (%s)',
    async (outcome) => {
      let callbacks: { onDone: (event: unknown) => void } | undefined;
      let releaseStream: (() => void) | undefined;
      let settleCancel: (() => void) | undefined;
      (streamAriaConversation as jest.Mock).mockImplementationOnce(async (_request, handlers) => {
        callbacks = handlers;
        handlers.onStart({
          turnId: 'turn-cancel-race', conversationId: 'conversation-cancel-race',
          messageId: 'assistant-cancel-race', courseKey: 'eds-nsi-terminale',
          status: 'RUNNING', disposition: 'EXECUTED',
        });
        await new Promise<void>((resolve) => { releaseStream = resolve; });
      });
      (cancelAriaTurn as jest.Mock).mockImplementationOnce(() => new Promise<void>((resolve, reject) => {
        settleCancel = () => outcome === 'resolve' ? resolve() : reject(new Error('late cancel failure'));
      }));
      const { result } = renderHook(() => useAriaConversation({ open: true }));
      await waitFor(() => expect(result.current.phase).toBe('READY'));
      act(() => result.current.setInput('Question'));
      act(() => { void result.current.send(); });
      await waitFor(() => expect(result.current.phase).toBe('STREAMING'));
      act(() => { void result.current.stop(); });
      await waitFor(() => expect(result.current.phase).toBe('STOPPING'));
      act(() => callbacks?.onDone({
        turnId: 'turn-cancel-race', messageId: 'assistant-cancel-race',
        status: 'COMPLETED', fullText: 'Réponse canonique',
      }));
      act(() => settleCancel?.());
      await waitFor(() => expect(result.current.phase).toBe('READY'));
      expect(result.current.announcement).toBe('Réponse ARIA terminée.');
      expect(result.current.errorCode).toBeNull();
      releaseStream?.();
    },
  );

  it('ignores a cancellation rejection after the panel was closed and revalidated', async () => {
    let rejectCancel: ((error: Error) => void) | undefined;
    (streamAriaConversation as jest.Mock)
      .mockImplementationOnce(async (_request, handlers, signal: AbortSignal) => {
        handlers.onStart({
          turnId: 'turn-old-course', conversationId: 'conversation-old-course',
          messageId: 'assistant-old-course', courseKey: 'eds-nsi-terminale',
          status: 'RUNNING', disposition: 'EXECUTED',
        });
        await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
      })
      .mockImplementationOnce(async (_request, handlers, signal: AbortSignal) => {
        handlers.onStart({
          turnId: 'turn-old-course', conversationId: 'conversation-old-course',
          messageId: 'assistant-old-course', courseKey: 'eds-nsi-terminale',
          status: 'RUNNING', disposition: 'REPLAY',
        });
        await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
      });
    (cancelAriaTurn as jest.Mock).mockImplementationOnce(() => new Promise<void>((_resolve, reject) => {
      rejectCancel = reject;
    }));
    const { result, rerender } = renderHook(
      ({ open }) => useAriaConversation({ open }),
      { initialProps: { open: true } },
    );
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question'));
    act(() => { void result.current.send(); });
    await waitFor(() => expect(result.current.phase).toBe('STREAMING'));
    act(() => { void result.current.stop(); });
    await waitFor(() => expect(result.current.phase).toBe('STOPPING'));
    rerender({ open: false });
    rerender({ open: true });
    await waitFor(() => expect(streamAriaConversation).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.phase).toBe('STOPPING'));
    act(() => rejectCancel?.(new Error('old cancellation failed')));
    expect(result.current.errorCode).toBeNull();
    expect(result.current.phase).toBe('STOPPING');
    rerender({ open: false });
  });

  it('HOOK_RECONNECTS_ACTIVE_TURN_WITHOUT_ASSISTANT_AS_PENDING', async () => {
    (fetchLatestAriaConversation as jest.Mock).mockResolvedValueOnce('conversation-pending');
    (fetchAriaConversationHistory as jest.Mock).mockResolvedValueOnce({
      messages: [{
        id: 'user-pending', turnId: 'turn-pending', role: 'user', content: 'Question en attente',
        status: 'COMPLETED', citations: [], feedback: null,
      }],
      activeTurn: {
        turnId: 'turn-pending', clientRequestId: '2a0ee5e4-1d7d-4f83-b4c3-b532dc0e0101',
        status: 'PENDING', pedagogicalMode: 'DISCOVERY',
      },
    });
    (streamAriaConversation as jest.Mock).mockImplementationOnce(
      async (_request, _callbacks, signal: AbortSignal) => new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve(), { once: true });
      }),
    );
    const { result, unmount } = renderHook(() => useAriaConversation({ open: true }));

    await waitFor(() => expect(result.current.phase).toBe('PENDING'));
    expect(result.current.messages).toEqual([
      expect.objectContaining({ id: 'user-pending', turnId: 'turn-pending' }),
    ]);
    expect(streamAriaConversation).toHaveBeenCalledWith(
      expect.objectContaining({ clientRequestId: '2a0ee5e4-1d7d-4f83-b4c3-b532dc0e0101' }),
      expect.any(Object),
      expect.any(AbortSignal),
    );
    unmount();
  });

  it.each([
    ['NO_USER', [{
      id: 'assistant-only', turnId: 'turn-invalid-history', role: 'assistant', content: '',
      status: 'STREAMING', citations: [], feedback: null,
    }]],
    ['TWO_USERS', [
      { id: 'user-a', turnId: 'turn-invalid-history', role: 'user', content: 'A', status: 'COMPLETED', citations: [], feedback: null },
      { id: 'user-b', turnId: 'turn-invalid-history', role: 'user', content: 'B', status: 'COMPLETED', citations: [], feedback: null },
    ]],
    ['TWO_ASSISTANTS', [
      { id: 'user-one', turnId: 'turn-invalid-history', role: 'user', content: 'A', status: 'COMPLETED', citations: [], feedback: null },
      { id: 'assistant-a', turnId: 'turn-invalid-history', role: 'assistant', content: '', status: 'STREAMING', citations: [], feedback: null },
      { id: 'assistant-b', turnId: 'turn-invalid-history', role: 'assistant', content: '', status: 'STREAMING', citations: [], feedback: null },
    ]],
  ])('HOOK_REJECTS_ACTIVE_HISTORY_WITH_INVALID_CARDINALITY_%s', async (_name, historyMessages) => {
    (fetchLatestAriaConversation as jest.Mock).mockResolvedValueOnce('conversation-invalid-history');
    (fetchAriaConversationHistory as jest.Mock).mockResolvedValueOnce({
      messages: historyMessages,
      activeTurn: {
        turnId: 'turn-invalid-history', clientRequestId: '2a0ee5e4-1d7d-4f83-b4c3-b532dc0e0102',
        status: 'RUNNING', pedagogicalMode: 'DISCOVERY',
      },
    });
    const { result } = renderHook(() => useAriaConversation({ open: true }));

    await waitFor(() => expect(result.current.phase).toBe('ERROR'));
    expect(result.current.errorCode).toBe('INVALID_RESPONSE');
    expect(streamAriaConversation).not.toHaveBeenCalled();
  });

  it('HOOK_REJECTS_TRANSPORT_RESOLUTION_WITHOUT_TERMINAL_CALLBACK', async () => {
    (streamAriaConversation as jest.Mock).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Transport incomplet'));

    await act(async () => { await result.current.send(); });

    expect(result.current.phase).toBe('RETRY_REQUIRED');
    expect(result.current.errorCode).toBe('INVALID_RESPONSE');
  });

  it('HOOK_IGNORES_STALE_PENDING_AND_ERROR_CALLBACKS_AFTER_REOPEN', async () => {
    let staleCallbacks: AriaConversationTransportCallbacks | undefined;
    (streamAriaConversation as jest.Mock)
      .mockImplementationOnce(async (_request, callbacks, signal: AbortSignal) => {
        staleCallbacks = callbacks;
        callbacks.onStart({
          turnId: 'turn-stale-callback', conversationId: 'conversation-stale-callback',
          messageId: 'assistant-stale-callback', courseKey: 'eds-nsi-terminale',
          status: 'RUNNING', disposition: 'EXECUTED',
        });
        await new Promise<void>((resolve) => {
          signal.addEventListener('abort', () => resolve(), { once: true });
        });
      })
      .mockImplementationOnce(async (_request, _callbacks, signal: AbortSignal) =>
        new Promise<void>((resolve) => {
          signal.addEventListener('abort', () => resolve(), { once: true });
        }));
    const { result, rerender } = renderHook(
      ({ open }) => useAriaConversation({ open }),
      { initialProps: { open: true } },
    );
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question stable'));
    act(() => { void result.current.send(); });
    await waitFor(() => expect(result.current.phase).toBe('STREAMING'));

    rerender({ open: false });
    rerender({ open: true });
    await waitFor(() => expect(streamAriaConversation).toHaveBeenCalledTimes(2));
    act(() => {
      staleCallbacks?.onPending?.({
        turnId: 'turn-stale-callback', status: 'RUNNING', disposition: 'IN_PROGRESS', retryAfterMs: 0,
      });
      staleCallbacks?.onError?.({ code: 'MODEL_UNAVAILABLE', requestId: 'stale', retryable: true });
    });

    expect(result.current.phase).toBe('STREAMING');
    expect(result.current.errorCode).toBeNull();
    rerender({ open: false });
  });

  it('HOOK_TERMINAL_ERROR_HISTORY_FAILURE_PRESERVES_TYPED_TERMINAL_STATE', async () => {
    (streamAriaConversation as jest.Mock).mockImplementationOnce(
      async (_request, callbacks, signal: AbortSignal) => {
        callbacks.onStart({
          turnId: 'turn-terminal-error', conversationId: 'conversation-terminal-error',
          messageId: 'assistant-terminal-error', courseKey: 'eds-nsi-terminale',
          status: 'RUNNING', disposition: 'EXECUTED',
        });
        callbacks.onDelta({ text: 'Sortie partielle auditée' });
        await new Promise<void>((resolve) => {
          signal.addEventListener('abort', () => resolve(), { once: true });
        });
      },
    );
    (cancelAriaTurn as jest.Mock).mockResolvedValueOnce({
      turnId: 'turn-terminal-error', conversationId: 'conversation-terminal-error',
      status: 'ERROR', disposition: 'TERMINAL_REPLAY',
    });
    (fetchAriaConversationHistory as jest.Mock).mockRejectedValueOnce(new Error('private reload failure'));
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question terminale'));
    act(() => { void result.current.send(); });
    await waitFor(() => expect(result.current.phase).toBe('STREAMING'));

    await act(async () => { await result.current.stop(); });

    expect(result.current.errorCode).toBe('INTERNAL_ERROR');
    expect(result.current.phase).toBe('READY');
    expect(result.current.messages.find(({ id }) => id === 'assistant-terminal-error')).toMatchObject({
      content: 'Sortie partielle auditée', status: 'ERROR',
    });
    expect(result.current.announcement).toBe(
      'État final ARIA conservé, mais l’historique n’a pas pu être rechargé.',
    );
  });

  it('HOOK_FEEDBACK_ARIA_CLIENT_ERROR_PRESERVES_PUBLIC_CODE', async () => {
    (fetchLatestAriaConversation as jest.Mock).mockResolvedValueOnce('conversation-feedback-code');
    (fetchAriaConversationHistory as jest.Mock).mockResolvedValueOnce({ messages: [{
      id: 'assistant-feedback-code', role: 'assistant', content: 'Réponse', status: 'COMPLETED',
      citations: [], feedback: null,
    }], activeTurn: null });
    (submitAriaFeedback as jest.Mock).mockRejectedValueOnce(
      new AriaClientError('MODEL_UNAVAILABLE', 503, true),
    );
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    await act(async () => {
      await result.current.submitFeedback('assistant-feedback-code', true);
    });

    expect(result.current.errorCode).toBe('MODEL_UNAVAILABLE');
  });

  it('HOOK_RETRY_IS_NOOP_WITHOUT_DETACHED_REQUEST', async () => {
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));

    await act(async () => { await result.current.retry(); });

    expect(streamAriaConversation).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('READY');
  });

  it('HOOK_PENDING_PROJECTS_RESERVED_AND_CANCELLING_PHASES', async () => {
    let callbacks: AriaConversationTransportCallbacks | undefined;
    let releaseStream: (() => void) | undefined;
    let resolveCancel: ((value: unknown) => void) | undefined;
    (streamAriaConversation as jest.Mock).mockImplementationOnce(async (_request, handlers) => {
      callbacks = handlers;
      await new Promise<void>((resolve) => { releaseStream = resolve; });
    });
    (cancelAriaTurn as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => {
      resolveCancel = resolve;
    }));
    const { result, unmount } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question réservée'));
    act(() => { void result.current.send(); });
    await waitFor(() => expect(result.current.phase).toBe('STARTING'));

    act(() => {
      callbacks?.onStart?.({
        turnId: 'turn-pending-phase', conversationId: 'conversation-pending-phase',
        messageId: 'assistant-pending-phase', courseKey: 'eds-nsi-terminale',
        status: 'RUNNING', disposition: 'EXECUTED',
      });
      callbacks?.onPending?.({
        turnId: 'turn-pending-phase', status: 'RUNNING',
        disposition: 'IN_PROGRESS', retryAfterMs: 100,
      });
    });
    expect(result.current.phase).toBe('STREAMING');
    expect(result.current.announcement).toBe('La réponse ARIA est en cours de préparation.');

    let stopPromise!: Promise<void>;
    act(() => { stopPromise = result.current.stop(); });
    await waitFor(() => expect(result.current.phase).toBe('STOPPING'));
    act(() => callbacks?.onPending?.({
      turnId: 'turn-pending-phase', status: 'RUNNING',
      disposition: 'IN_PROGRESS', retryAfterMs: 100,
    }));
    expect(result.current.phase).toBe('STOPPING');
    expect(result.current.announcement).toBe('Arrêt de la réponse ARIA en cours.');
    act(() => resolveCancel?.({
      turnId: 'turn-pending-phase', conversationId: 'conversation-pending-phase',
      status: 'RUNNING', disposition: 'CANCELLATION_REQUESTED',
    }));
    await act(async () => { await stopPromise; });
    unmount();
    releaseStream?.();
  });

  it('HOOK_CANCEL_FAILURE_WITH_PENDING_TURN_RETURNS_TO_PENDING', async () => {
    (fetchLatestAriaConversation as jest.Mock).mockResolvedValueOnce('conversation-pending-cancel');
    (fetchAriaConversationHistory as jest.Mock).mockResolvedValueOnce({
      messages: [{
        id: 'user-pending-cancel', turnId: 'turn-pending-cancel', role: 'user',
        content: 'Question en attente', status: 'COMPLETED', citations: [], feedback: null,
      }],
      activeTurn: {
        turnId: 'turn-pending-cancel',
        clientRequestId: '00000000-0000-4000-8000-000000000030',
        status: 'PENDING', pedagogicalMode: 'DISCOVERY',
      },
    });
    (streamAriaConversation as jest.Mock).mockImplementationOnce(
      async (_request, _callbacks, signal: AbortSignal) => new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve(), { once: true });
      }),
    );
    (cancelAriaTurn as jest.Mock).mockRejectedValueOnce(new Error('private cancel failure'));
    const { result, unmount } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('PENDING'));

    await act(async () => { await result.current.stop(); });

    expect(result.current.phase).toBe('PENDING');
    expect(result.current.errorCode).toBe('INTERNAL_ERROR');
    expect(result.current.announcement).toBe('Impossible d’arrêter proprement la réponse ARIA.');
    unmount();
  });

  it('HOOK_TERMINAL_ERROR_HISTORY_SUCCESS_ANNOUNCES_RELOADED_STATE', async () => {
    (streamAriaConversation as jest.Mock).mockImplementationOnce(
      async (_request, callbacks, signal: AbortSignal) => {
        callbacks.onStart({
          turnId: 'turn-error-reload', conversationId: 'conversation-error-reload',
          messageId: 'assistant-error-reload', courseKey: 'eds-nsi-terminale',
          status: 'RUNNING', disposition: 'EXECUTED',
        });
        callbacks.onDelta({ text: 'Sortie partielle' });
        await new Promise<void>((resolve) => {
          signal.addEventListener('abort', () => resolve(), { once: true });
        });
      },
    );
    (cancelAriaTurn as jest.Mock).mockResolvedValueOnce({
      turnId: 'turn-error-reload', conversationId: 'conversation-error-reload',
      status: 'ERROR', disposition: 'TERMINAL_REPLAY',
    });
    (fetchAriaConversationHistory as jest.Mock).mockResolvedValueOnce({
      activeTurn: null,
      messages: [{
        id: 'user-error-reload', turnId: 'turn-error-reload', role: 'user',
        content: 'Question erreur', status: 'COMPLETED', citations: [], feedback: null,
      }, {
        id: 'assistant-error-reload', turnId: 'turn-error-reload', role: 'assistant',
        content: 'Sortie partielle persistée', status: 'ERROR', citations: [], feedback: null,
      }],
    });
    const { result } = renderHook(() => useAriaConversation({ open: true }));
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question erreur'));
    act(() => { void result.current.send(); });
    await waitFor(() => expect(result.current.phase).toBe('STREAMING'));

    await act(async () => { await result.current.stop(); });

    expect(result.current.phase).toBe('READY');
    expect(result.current.errorCode).toBeNull();
    expect(result.current.announcement).toBe('État final de la réponse ARIA rechargé.');
    expect(result.current.messages.find(({ id }) => id === 'assistant-error-reload'))
      .toMatchObject({ status: 'ERROR', content: 'Sortie partielle persistée' });
  });

  it.each(['resolve', 'reject'] as const)(
    'HOOK_IGNORES_STALE_CURRICULUM_SETTLEMENT_%s',
    async (outcome) => {
      let resolveOld: ((value: unknown) => void) | undefined;
      let rejectOld: ((error: Error) => void) | undefined;
      (fetchAriaCurriculum as jest.Mock).mockImplementationOnce(() => new Promise((resolve, reject) => {
        resolveOld = resolve;
        rejectOld = reject;
      }));
      const { result, rerender } = renderHook(
        ({ open }) => useAriaConversation({ open }),
        { initialProps: { open: true } },
      );
      await waitFor(() => expect(fetchAriaCurriculum).toHaveBeenCalledTimes(1));
      rerender({ open: false });
      rerender({ open: true });
      await waitFor(() => expect(result.current.phase).toBe('READY'));

      await act(async () => {
        if (outcome === 'resolve') {
          resolveOld?.({
            courses: [],
            profile: {
              version: 1, pinnedCourseKeys: [], focusedCourseKey: null,
              courseOrder: [], showCitations: false,
            },
          });
        } else {
          rejectOld?.(new Error('stale curriculum failure'));
        }
      });

      expect(result.current.phase).toBe('READY');
      expect(result.current.courses).toEqual(courses);
      expect(result.current.errorCode).toBeNull();
    },
  );

  it.each(['resolve', 'reject'] as const)(
    'HOOK_IGNORES_STALE_LATEST_CONVERSATION_SETTLEMENT_%s',
    async (outcome) => {
      let resolveOld: ((value: string) => void) | undefined;
      let rejectOld: ((error: Error) => void) | undefined;
      (fetchLatestAriaConversation as jest.Mock).mockImplementationOnce(() => new Promise((resolve, reject) => {
        resolveOld = resolve;
        rejectOld = reject;
      }));
      const { result, rerender } = renderHook(
        ({ open }) => useAriaConversation({ open }),
        { initialProps: { open: true } },
      );
      await waitFor(() => expect(fetchLatestAriaConversation).toHaveBeenCalledTimes(1));
      rerender({ open: false });
      rerender({ open: true });
      await waitFor(() => expect(result.current.phase).toBe('READY'));

      await act(async () => {
        if (outcome === 'resolve') resolveOld?.('conversation-stale');
        else rejectOld?.(new Error('stale latest failure'));
      });

      expect(result.current.phase).toBe('READY');
      expect(result.current.messages).toEqual([]);
      expect(result.current.errorCode).toBeNull();
      expect(fetchAriaConversationHistory).not.toHaveBeenCalled();
    },
  );

  it('HOOK_IGNORES_STALE_HISTORY_SETTLEMENT_AFTER_REOPEN', async () => {
    let resolveOldHistory: ((value: unknown) => void) | undefined;
    (fetchLatestAriaConversation as jest.Mock).mockResolvedValueOnce('conversation-stale-history');
    (fetchAriaConversationHistory as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => {
      resolveOldHistory = resolve;
    }));
    const { result, rerender } = renderHook(
      ({ open }) => useAriaConversation({ open }),
      { initialProps: { open: true } },
    );
    await waitFor(() => expect(fetchAriaConversationHistory).toHaveBeenCalledTimes(1));
    rerender({ open: false });
    rerender({ open: true });
    await waitFor(() => expect(result.current.phase).toBe('READY'));

    await act(async () => {
      resolveOldHistory?.({
        activeTurn: null,
        messages: [{
          id: 'assistant-stale-history', turnId: null, role: 'assistant',
          content: 'Historique obsolète', status: 'COMPLETED', citations: [], feedback: null,
        }],
      });
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.errorCode).toBeNull();
  });

  it('HOOK_IGNORES_ABORT_REJECTION_FROM_DETACHED_TRANSPORT', async () => {
    (streamAriaConversation as jest.Mock).mockImplementationOnce(
      async (_request, _callbacks, signal: AbortSignal) => new Promise<void>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
          once: true,
        });
      }),
    );
    const { result, rerender } = renderHook(
      ({ open }) => useAriaConversation({ open }),
      { initialProps: { open: true } },
    );
    await waitFor(() => expect(result.current.phase).toBe('READY'));
    act(() => result.current.setInput('Question avant détachement'));
    act(() => { void result.current.send(); });
    await waitFor(() => expect(result.current.phase).toBe('STARTING'));
    rerender({ open: false });
    rerender({ open: true });

    await waitFor(() => expect(result.current.phase).toBe('RETRY_REQUIRED'));
    expect(result.current.errorCode).toBeNull();
    rerender({ open: false });
  });
});
