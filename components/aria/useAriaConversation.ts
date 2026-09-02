'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AriaClientError,
  cancelAriaTurn,
  createAriaClientRequest,
  fetchAriaCurriculum,
  fetchAriaConversationHistory,
  fetchLatestAriaConversation,
  streamAriaConversation,
  submitAriaFeedback as persistAriaFeedback,
  type AriaClientCourse,
  type AriaClientMessage,
  type AriaClientRequest,
  type AriaConversationTransportCallbacks,
} from '@/lib/aria/client';

export type AriaConversationPhase =
  | 'LOADING' | 'READY' | 'STARTING' | 'PENDING' | 'RETRY_REQUIRED'
  | 'STREAMING' | 'STOPPING' | 'ERROR';

interface ActiveAriaTransport {
  generation: number;
  turnId: string | null;
  conversationId: string | null;
  readonly clientRequestId: string;
  messageId: string | null;
  readonly request: AriaClientRequest;
  callbacks: AriaConversationTransportCallbacks;
  transportAttached: boolean;
  cancellationRequested: boolean;
}

function isAvailable(course: Pick<AriaClientCourse, 'capabilities' | 'access'>): boolean {
  return course.capabilities.hasChat
    && course.access.status === 'AVAILABLE'
    && course.access.commerciallyEntitled;
}

export function selectInitialAriaCourse(
  courses: readonly Pick<AriaClientCourse, 'courseKey' | 'capabilities' | 'access'>[],
  focusedCourseKey: string | null | undefined,
  requestedCourseKey: string | undefined,
  currentCourseKey?: string | null,
): string | null {
  const available = courses.filter(isAvailable);
  if (requestedCourseKey && available.some(({ courseKey }) => courseKey === requestedCourseKey)) {
    return requestedCourseKey;
  }
  if (currentCourseKey && available.some(({ courseKey }) => courseKey === currentCourseKey)) {
    return currentCourseKey;
  }
  if (focusedCourseKey && available.some(({ courseKey }) => courseKey === focusedCourseKey)) {
    return focusedCourseKey;
  }
  return null;
}

export function useAriaConversation(input: Readonly<{
  open: boolean;
  initialCourseKey?: string;
}>) {
  const [courses, setCourses] = useState<readonly AriaClientCourse[]>([]);
  const [selectedCourseKey, setSelectedCourseKey] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<readonly AriaClientMessage[]>([]);
  const [composerInput, setComposerInput] = useState('');
  const [phase, setPhase] = useState<AriaConversationPhase>('LOADING');
  const [announcement, setAnnouncement] = useState('Chargement d’ARIA.');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [ragStatus, setRagStatus] = useState<string | null>(null);
  const [showCitations, setShowCitations] = useState(true);
  const generation = useRef(0);
  const errorRevision = useRef(0);
  const activeController = useRef<AbortController | null>(null);
  const selectedCourseRef = useRef<string | null>(null);
  const activeTurn = useRef<ActiveAriaTransport | null>(null);
  const feedbackQueues = useRef(new Map<string, Promise<void>>());

  const publishError = useCallback((code: string) => {
    errorRevision.current += 1;
    setErrorCode(code);
  }, []);

  const clearError = useCallback(() => {
    errorRevision.current += 1;
    setErrorCode(null);
  }, []);

  const detach = useCallback(() => {
    generation.current += 1;
    activeController.current?.abort();
    activeController.current = null;
    activeTurn.current = null;
  }, []);

  const suspend = useCallback(() => {
    generation.current += 1;
    activeController.current?.abort();
    activeController.current = null;
    if (activeTurn.current) activeTurn.current.transportAttached = false;
  }, []);

  const configureActiveTransport = useCallback((active: ActiveAriaTransport) => {
    const callbackGeneration = active.generation;
    const callbacks: AriaConversationTransportCallbacks = {
      onPending(pending) {
        if (callbackGeneration !== generation.current || activeTurn.current !== active) return;
        if (active.turnId && active.turnId !== pending.turnId) {
          throw new AriaClientError('INVALID_RESPONSE', 500, false);
        }
        active.turnId = pending.turnId;
        setPhase(active.cancellationRequested ? 'STOPPING' : active.messageId ? 'STREAMING' : 'PENDING');
        setAnnouncement(active.cancellationRequested
          ? 'Arrêt de la réponse ARIA en cours.'
          : 'La réponse ARIA est en cours de préparation.');
      },
      onStart(start) {
        if (callbackGeneration !== generation.current || activeTurn.current !== active) return;
        if (start.courseKey !== active.request.courseKey
          || (active.turnId && active.turnId !== start.turnId)
          || (active.conversationId && active.conversationId !== start.conversationId)
          || (active.messageId && active.messageId !== start.messageId)) {
          throw new AriaClientError('INVALID_RESPONSE', 500, false);
        }
        active.turnId = start.turnId;
        active.conversationId = start.conversationId;
        active.messageId = start.messageId;
        setConversationId(start.conversationId);
        setPhase(active.cancellationRequested ? 'STOPPING' : 'STREAMING');
        setMessages((current) => {
          const localUserId = `local-${active.clientRequestId}`;
          const withUserTurn = current.some(
            ({ turnId, role }) => turnId === start.turnId && role === 'user',
          )
            ? current
            : current.some(({ id }) => id === localUserId)
              ? current.map((message) => message.id === localUserId
                ? { ...message, turnId: start.turnId }
                : message)
              : [...current, {
                id: localUserId, turnId: start.turnId,
                role: 'user' as const, content: active.request.content,
                status: 'COMPLETED' as const, citations: [], feedback: null,
              }];
          return withUserTurn.some(({ id }) => id === start.messageId)
          ? withUserTurn.map((message) => message.id === start.messageId
            ? { ...message, content: '', status: 'STREAMING', citations: [] }
            : message)
          : [...withUserTurn, {
            id: start.messageId, turnId: start.turnId,
            role: 'assistant', content: '', status: 'STREAMING',
            citations: [], feedback: null,
          }];
        });
        setAnnouncement(active.cancellationRequested ? 'Arrêt de la réponse ARIA en cours.' : 'ARIA répond.');
      },
      onDelta(delta) {
        if (callbackGeneration !== generation.current
          || activeTurn.current !== active || !active.messageId) return;
        const id = active.messageId;
        setMessages((current) => current.map((message) => message.id === id
          ? { ...message, content: `${message.content}${delta.text}` }
          : message));
      },
      onCitation(event) {
        if (callbackGeneration !== generation.current
          || activeTurn.current !== active || !active.messageId) return;
        const id = active.messageId;
        setMessages((current) => current.map((message) => message.id === id
          ? { ...message, citations: [...message.citations, event.citation] }
          : message));
      },
      onMetadata(metadata) {
        if (callbackGeneration === generation.current && activeTurn.current === active) {
          setRagStatus(metadata.ragStatus ?? null);
        }
      },
      onDone(done) {
        if (callbackGeneration !== generation.current || activeTurn.current !== active) return;
        if (done.turnId !== active.turnId || done.messageId !== active.messageId) {
          throw new AriaClientError('INVALID_RESPONSE', 500, false);
        }
        setMessages((current) => current.map((message) => message.id === done.messageId
          ? { ...message, content: done.fullText, status: done.status }
          : message));
        clearError();
        setPhase('READY');
        setAnnouncement(done.status === 'CANCELLED' ? 'Réponse ARIA arrêtée.' : 'Réponse ARIA terminée.');
        activeTurn.current = null;
      },
      onError(error) {
        if (callbackGeneration !== generation.current || activeTurn.current !== active) return;
        if (active.messageId) {
          const id = active.messageId;
          setMessages((current) => current.map((message) => message.id === id
            ? { ...message, status: 'ERROR' }
            : message));
        }
        publishError(error.code);
        setPhase('READY');
        setAnnouncement('La réponse ARIA a échoué.');
        activeTurn.current = null;
      },
    };
    active.callbacks = callbacks;
    return active;
  }, [clearError, publishError]);

  const attachTransport = useCallback(async (active: ActiveAriaTransport, token: number) => {
    if (token !== generation.current || activeTurn.current !== active) return;
    const controller = new AbortController();
    active.transportAttached = true;
    activeController.current = controller;
    setPhase(active.cancellationRequested
      ? 'STOPPING'
      : active.messageId
        ? 'STREAMING'
        : active.turnId
          ? 'PENDING'
          : 'STARTING');
    try {
      await streamAriaConversation(active.request, active.callbacks, controller.signal);
      if (token === generation.current && activeTurn.current === active) {
        throw new AriaClientError('INVALID_RESPONSE', 500, false);
      }
    } catch (error: unknown) {
      if (controller.signal.aborted || token !== generation.current || activeTurn.current !== active) return;
      active.transportAttached = false;
      publishError(error instanceof AriaClientError ? error.code : 'INTERNAL_ERROR');
      setPhase(active.messageId ? 'STREAMING' : active.turnId ? 'PENDING' : 'RETRY_REQUIRED');
      setAnnouncement(active.turnId
        ? 'La connexion à la réponse ARIA a échoué. Vous pouvez demander son arrêt.'
        : 'La connexion à ARIA a échoué. Reprenez la même demande sans la dupliquer.');
    } finally {
      if (activeController.current === controller) activeController.current = null;
    }
  }, [publishError]);

  const loadCourse = useCallback(async (courseKey: string, token: number) => {
    const preservedTransport = activeTurn.current;
    const controller = new AbortController();
    activeController.current = controller;
    setPhase('LOADING');
    setMessages([]);
    setConversationId(null);
    clearError();
    setRagStatus(null);
    try {
      const latest = await fetchLatestAriaConversation(courseKey, controller.signal);
      if (token !== generation.current) return;
      setConversationId(latest);
      if (latest) {
        const history = await fetchAriaConversationHistory(latest, controller.signal);
        if (token !== generation.current) return;
        setMessages(history.messages);
        if (history.activeTurn) {
          const turnMessages = history.messages.filter(
            ({ turnId }) => turnId === history.activeTurn?.turnId,
          );
          const userMessages = turnMessages.filter(({ role }) => role === 'user');
          const assistantMessages = turnMessages.filter(({ role }) => role === 'assistant');
          if (userMessages.length !== 1 || assistantMessages.length > 1) {
            throw new AriaClientError('INVALID_RESPONSE', 500, false);
          }
          const userMessage = userMessages[0]!;
          const active = configureActiveTransport({
            generation: token,
            turnId: history.activeTurn.turnId,
            conversationId: latest,
            clientRequestId: history.activeTurn.clientRequestId,
            messageId: assistantMessages[0]?.id ?? null,
            request: {
              clientRequestId: history.activeTurn.clientRequestId,
              courseKey,
              content: userMessage.content,
              conversationId: latest,
              pedagogicalMode: history.activeTurn.pedagogicalMode,
            },
            callbacks: {},
            transportAttached: false,
            cancellationRequested: false,
          });
          activeTurn.current = active;
          setAnnouncement('Reconnexion à la réponse ARIA en cours.');
          void attachTransport(active, token);
          return;
        }
      }
      if (preservedTransport?.request.courseKey === courseKey) {
        preservedTransport.generation = token;
        preservedTransport.transportAttached = false;
        configureActiveTransport(preservedTransport);
        activeTurn.current = preservedTransport;
        if (preservedTransport.turnId) {
          setAnnouncement('Reconnexion à la réponse ARIA en cours.');
          void attachTransport(preservedTransport, token);
        } else {
          setPhase('RETRY_REQUIRED');
          setAnnouncement('Reprenez la même demande ARIA sans créer une seconde génération.');
        }
        return;
      }
      activeTurn.current = null;
      setPhase('READY');
      setAnnouncement('Historique ARIA chargé.');
    } catch (error: unknown) {
      if (controller.signal.aborted || token !== generation.current) return;
      publishError(error instanceof AriaClientError ? error.code : 'INTERNAL_ERROR');
      setPhase('ERROR');
      setAnnouncement('Impossible de charger l’historique ARIA.');
    } finally {
      if (activeController.current === controller) activeController.current = null;
    }
  }, [attachTransport, clearError, configureActiveTransport, publishError]);

  useEffect(() => {
    if (!input.open) return;
    const token = generation.current + 1;
    generation.current = token;
    const controller = new AbortController();
    activeController.current = controller;
    setCourses([]);
    setSelectedCourseKey(null);
    setConversationId(null);
    setMessages([]);
    setComposerInput('');
    clearError();
    setRagStatus(null);
    setPhase('LOADING');
    setAnnouncement('Chargement des cours ARIA.');
    void fetchAriaCurriculum(controller.signal).then((curriculum) => {
      if (token !== generation.current) return;
      setCourses(curriculum.courses);
      setShowCitations(curriculum.profile.showCitations);
      const initial = selectInitialAriaCourse(
        curriculum.courses,
        curriculum.profile.focusedCourseKey,
        input.initialCourseKey,
        selectedCourseRef.current,
      );
      selectedCourseRef.current = initial;
      setSelectedCourseKey(initial);
      if (!initial) {
        activeTurn.current = null;
        setMessages([]);
        setPhase('READY');
        setAnnouncement(curriculum.courses.some(isAvailable)
          ? 'Choisissez un cours ARIA.'
          : 'Aucun cours ARIA avec chat n’est disponible.');
        return;
      }
      void loadCourse(initial, token);
    }).catch((error: unknown) => {
      if (controller.signal.aborted || token !== generation.current) return;
      publishError(error instanceof AriaClientError ? error.code : 'INTERNAL_ERROR');
      setPhase('ERROR');
      setAnnouncement('Impossible de charger ARIA.');
    });
    return suspend;
  }, [clearError, input.initialCourseKey, input.open, loadCourse, publishError, suspend]);

  const selectCourse = useCallback((courseKey: string) => {
    if (phase !== 'READY') return;
    const course = courses.find((candidate) => candidate.courseKey === courseKey);
    if (!course || !isAvailable(course)) return;
    detach();
    const token = generation.current;
    selectedCourseRef.current = courseKey;
    setSelectedCourseKey(courseKey);
    void loadCourse(courseKey, token);
  }, [courses, detach, loadCourse, phase]);

  const send = useCallback(async () => {
    const content = composerInput.trim();
    if (!content || !selectedCourseKey || phase !== 'READY' || activeTurn.current) return;
    const request = createAriaClientRequest({ courseKey: selectedCourseKey, content, conversationId });
    detach();
    const token = generation.current;
    setComposerInput('');
    clearError();
    setRagStatus(null);
    setPhase('STARTING');
    setAnnouncement('ARIA prépare sa réponse.');
    setMessages((current) => [...current, {
      id: `local-${request.clientRequestId}`,
      turnId: null,
      role: 'user', content, status: 'COMPLETED', citations: [], feedback: null,
    }]);

    const active = configureActiveTransport({
      generation: token,
      turnId: null,
      conversationId: request.conversationId ?? null,
      clientRequestId: request.clientRequestId,
      messageId: null,
      request,
      callbacks: {},
      transportAttached: false,
      cancellationRequested: false,
    });
    activeTurn.current = active;
    await attachTransport(active, token);
  }, [attachTransport, clearError, composerInput, configureActiveTransport, conversationId, detach, phase, selectedCourseKey]);

  const retry = useCallback(async () => {
    const active = activeTurn.current;
    if (!active || active.transportAttached || active.turnId || phase !== 'RETRY_REQUIRED') return;
    clearError();
    setAnnouncement('Reprise de la même demande ARIA.');
    await attachTransport(active, generation.current);
  }, [attachTransport, clearError, phase]);

  const stop = useCallback(async () => {
    const active = activeTurn.current;
    if (!active?.turnId || active.cancellationRequested) return;
    const token = generation.current;
    const isCurrentTurn = () => token === generation.current && activeTurn.current === active;
    active.cancellationRequested = true;
    setPhase('STOPPING');
    clearError();
    setAnnouncement('Arrêt de la réponse ARIA.');
    try {
      const result = await cancelAriaTurn(active.turnId, active.clientRequestId);
      if (!isCurrentTurn()) return;
      if (result.turnId !== active.turnId
        || (active.conversationId && result.conversationId !== active.conversationId)) {
        throw new AriaClientError('INVALID_RESPONSE', 500, false);
      }
      active.conversationId = result.conversationId;
      setConversationId(result.conversationId);
      if (result.disposition === 'CANCELLATION_REQUESTED') {
        setAnnouncement('Arrêt demandé. Confirmation en cours.');
        if (!active.transportAttached) await attachTransport(active, token);
        return;
      }

      activeController.current?.abort();
      const controller = new AbortController();
      activeController.current = controller;
      let history: readonly AriaClientMessage[];
      try {
        try {
          const reloaded = await fetchAriaConversationHistory(result.conversationId, controller.signal);
          const turnMessages = reloaded.messages.filter(
            ({ turnId }) => turnId === result.turnId,
          );
          const userMessages = turnMessages.filter(({ role }) => role === 'user');
          const assistantMessages = turnMessages.filter(({ role }) => role === 'assistant');
          const userMessage = userMessages[0];
          const assistantMessage = assistantMessages[0];
          if (
            reloaded.activeTurn
            || turnMessages.length !== 2
            || userMessages.length !== 1
            || assistantMessages.length !== 1
            || userMessage?.status !== 'COMPLETED'
            || userMessage.content !== active.request.content
            || assistantMessage?.status !== result.status
            || (active.messageId !== null && assistantMessage.id !== active.messageId)
          ) {
            throw new AriaClientError('INVALID_RESPONSE', 500, false);
          }
          history = reloaded.messages;
        } catch (error: unknown) {
          if (!isCurrentTurn()) return;
          if (active.messageId) {
            const messageId = active.messageId;
            setMessages((current) => current.map((message) => message.id === messageId
              ? { ...message, status: result.status }
              : message));
          }
          activeTurn.current = null;
          publishError(error instanceof AriaClientError ? error.code : 'INTERNAL_ERROR');
          setPhase('READY');
          setAnnouncement(result.status === 'CANCELLED'
            ? 'Réponse ARIA arrêtée, mais l’historique n’a pas pu être rechargé.'
            : 'État final ARIA conservé, mais l’historique n’a pas pu être rechargé.');
          return;
        }
      } finally {
        if (activeController.current === controller) activeController.current = null;
      }
      if (!isCurrentTurn()) return;
      setMessages(history);
      activeTurn.current = null;
      clearError();
      setPhase('READY');
      setAnnouncement(result.status === 'CANCELLED'
        ? 'Réponse ARIA arrêtée.'
        : 'État final de la réponse ARIA rechargé.');
    } catch (error: unknown) {
      if (!isCurrentTurn()) return;
      active.cancellationRequested = false;
      publishError(error instanceof AriaClientError ? error.code : 'INTERNAL_ERROR');
      setPhase(active.messageId ? 'STREAMING' : active.turnId ? 'PENDING' : 'RETRY_REQUIRED');
      setAnnouncement('Impossible d’arrêter proprement la réponse ARIA.');
    }
  }, [attachTransport, clearError, publishError]);

  const submitFeedback = useCallback(async (messageId: string, useful: boolean) => {
    const previous = feedbackQueues.current.get(messageId);
    const perform = async () => {
      const revisionAtStart = errorRevision.current;
      try {
        const persisted = await persistAriaFeedback(messageId, useful);
        setMessages((current) => current.map((message) =>
          message.id === messageId ? { ...message, feedback: persisted.useful } : message));
        if (revisionAtStart === errorRevision.current) {
          clearError();
          setAnnouncement('Votre avis ARIA est enregistré.');
        }
      } catch (error: unknown) {
        if (revisionAtStart !== errorRevision.current) return;
        publishError(error instanceof AriaClientError ? error.code : 'INTERNAL_ERROR');
        setAnnouncement('Impossible d’enregistrer votre avis ARIA.');
      }
    };
    const operation = previous ? previous.then(perform, perform) : perform();
    feedbackQueues.current.set(messageId, operation);
    try {
      await operation;
    } finally {
      if (feedbackQueues.current.get(messageId) === operation) {
        feedbackQueues.current.delete(messageId);
      }
    }
  }, [clearError, publishError]);

  return {
    courses,
    selectedCourseKey,
    messages,
    input: composerInput,
    phase,
    announcement,
    errorCode,
    ragStatus,
    showCitations,
    setInput: setComposerInput,
    selectCourse,
    send,
    retry,
    stop,
    submitFeedback,
  } as const;
}
