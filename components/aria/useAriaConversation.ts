'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AriaClientError,
  cancelAriaTurn,
  createAriaClientRequest,
  fetchAriaCurriculum,
  fetchAriaMessages,
  fetchLatestAriaConversation,
  streamAriaConversation,
  submitAriaFeedback as persistAriaFeedback,
  type AriaClientCourse,
  type AriaClientMessage,
} from '@/lib/aria/client';

export type AriaConversationPhase =
  | 'LOADING' | 'READY' | 'STREAMING' | 'STOPPING' | 'ERROR';

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
  const activeController = useRef<AbortController | null>(null);
  const selectedCourseRef = useRef<string | null>(null);
  const activeTurn = useRef<{
    turnId: string;
    clientRequestId: string;
    messageId: string;
  } | null>(null);

  const detach = useCallback(() => {
    generation.current += 1;
    activeController.current?.abort();
    activeController.current = null;
    activeTurn.current = null;
  }, []);

  const loadCourse = useCallback(async (courseKey: string, token: number) => {
    const controller = new AbortController();
    activeController.current = controller;
    setPhase('LOADING');
    setMessages([]);
    setConversationId(null);
    setErrorCode(null);
    setRagStatus(null);
    try {
      const latest = await fetchLatestAriaConversation(courseKey, controller.signal);
      if (token !== generation.current) return;
      setConversationId(latest);
      if (latest) {
        const history = await fetchAriaMessages(latest, controller.signal);
        if (token !== generation.current) return;
        setMessages(history);
      }
      setPhase('READY');
      setAnnouncement('Historique ARIA chargé.');
    } catch (error: unknown) {
      if (controller.signal.aborted || token !== generation.current) return;
      setErrorCode(error instanceof AriaClientError ? error.code : 'INTERNAL_ERROR');
      setPhase('ERROR');
      setAnnouncement('Impossible de charger l’historique ARIA.');
    } finally {
      if (activeController.current === controller) activeController.current = null;
    }
  }, []);

  useEffect(() => {
    if (!input.open) {
      detach();
      return;
    }
    const token = generation.current + 1;
    generation.current = token;
    const controller = new AbortController();
    activeController.current = controller;
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
      setErrorCode(error instanceof AriaClientError ? error.code : 'INTERNAL_ERROR');
      setPhase('ERROR');
      setAnnouncement('Impossible de charger ARIA.');
    });
    return detach;
  }, [detach, input.initialCourseKey, input.open, loadCourse]);

  const selectCourse = useCallback((courseKey: string) => {
    const course = courses.find((candidate) => candidate.courseKey === courseKey);
    if (!course || !isAvailable(course)) return;
    detach();
    const token = generation.current;
    selectedCourseRef.current = courseKey;
    setSelectedCourseKey(courseKey);
    void loadCourse(courseKey, token);
  }, [courses, detach, loadCourse]);

  const send = useCallback(async () => {
    const content = composerInput.trim();
    if (!content || !selectedCourseKey || phase === 'STREAMING' || phase === 'STOPPING') return;
    const request = createAriaClientRequest({ courseKey: selectedCourseKey, content, conversationId });
    const controller = new AbortController();
    detach();
    const token = generation.current;
    activeController.current = controller;
    setComposerInput('');
    setErrorCode(null);
    setRagStatus(null);
    setPhase('STREAMING');
    setAnnouncement('ARIA prépare sa réponse.');
    setMessages((current) => [...current, {
      id: `local-${request.clientRequestId}`,
      role: 'user', content, status: 'COMPLETED', citations: [], feedback: null,
    }]);
    let assistantMessageId: string | null = null;
    try {
      await streamAriaConversation(request, {
        onStart(start) {
          if (token !== generation.current) return;
          assistantMessageId = start.messageId;
          activeTurn.current = {
            turnId: start.turnId,
            clientRequestId: request.clientRequestId,
            messageId: start.messageId,
          };
          setConversationId(start.conversationId);
          setMessages((current) => current.some(({ id }) => id === start.messageId)
            ? current.map((message) => message.id === start.messageId
              ? { ...message, content: '', status: 'STREAMING', citations: [] }
              : message)
            : [...current, {
              id: start.messageId, role: 'assistant', content: '', status: 'STREAMING',
              citations: [], feedback: null,
            }]);
          setAnnouncement('ARIA répond.');
        },
        onDelta(delta) {
          if (token !== generation.current || !assistantMessageId) return;
          const id = assistantMessageId;
          setMessages((current) => current.map((message) => message.id === id
            ? { ...message, content: `${message.content}${delta.text}` }
            : message));
        },
        onCitation(event) {
          if (token !== generation.current || !assistantMessageId) return;
          const id = assistantMessageId;
          setMessages((current) => current.map((message) => message.id === id
            ? { ...message, citations: [...message.citations, event.citation] }
            : message));
        },
        onMetadata(metadata) {
          if (token === generation.current) setRagStatus(metadata.ragStatus ?? null);
        },
        onDone(done) {
          if (token !== generation.current) return;
          setMessages((current) => current.map((message) => message.id === done.messageId
            ? { ...message, content: done.fullText, status: done.status }
            : message));
          setPhase('READY');
          setAnnouncement(done.status === 'CANCELLED' ? 'Réponse ARIA arrêtée.' : 'Réponse ARIA terminée.');
          activeTurn.current = null;
        },
        onError(error) {
          if (token !== generation.current) return;
          if (assistantMessageId) {
            const id = assistantMessageId;
            setMessages((current) => current.map((message) => message.id === id
              ? { ...message, status: 'ERROR' }
              : message));
          }
          setErrorCode(error.code);
          setPhase('ERROR');
          setAnnouncement('La réponse ARIA a échoué.');
          activeTurn.current = null;
        },
      }, controller.signal);
    } catch (error: unknown) {
      if (controller.signal.aborted || token !== generation.current) return;
      if (assistantMessageId) {
        const id = assistantMessageId;
        setMessages((current) => current.map((message) => message.id === id
          ? { ...message, status: 'ERROR' }
          : message));
      }
      setErrorCode(error instanceof AriaClientError ? error.code : 'INTERNAL_ERROR');
      setPhase('ERROR');
      setAnnouncement('La réponse ARIA a échoué.');
    } finally {
      if (activeController.current === controller) activeController.current = null;
    }
  }, [composerInput, conversationId, detach, phase, selectedCourseKey]);

  const stop = useCallback(async () => {
    const active = activeTurn.current;
    if (!active) return;
    setPhase('STOPPING');
    setAnnouncement('Arrêt de la réponse ARIA.');
    try {
      await cancelAriaTurn(active.turnId, active.clientRequestId);
      setAnnouncement('Arrêt demandé. Confirmation en cours.');
    } catch (error: unknown) {
      setErrorCode(error instanceof AriaClientError ? error.code : 'INTERNAL_ERROR');
      setPhase('ERROR');
      setAnnouncement('Impossible d’arrêter proprement la réponse ARIA.');
    }
  }, []);

  const submitFeedback = useCallback(async (messageId: string, useful: boolean) => {
    try {
      await persistAriaFeedback(messageId, useful);
      setMessages((current) => current.map((message) =>
        message.id === messageId ? { ...message, feedback: useful } : message));
      setAnnouncement('Votre avis ARIA est enregistré.');
    } catch (error: unknown) {
      setErrorCode(error instanceof AriaClientError ? error.code : 'INTERNAL_ERROR');
      setPhase('ERROR');
      setAnnouncement('Impossible d’enregistrer votre avis ARIA.');
    }
  }, []);

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
    stop,
    submitFeedback,
  } as const;
}
