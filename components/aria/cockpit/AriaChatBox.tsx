'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Square,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  AlertCircle,
} from 'lucide-react';
import { parseAriaSSEStream, type AriaSSECallbacks } from '@/lib/aria/sse';
import type { AriaCitationHit } from '@/lib/aria/contracts';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'STREAMING' | 'COMPLETED' | 'CANCELLED' | 'ERROR';
  citations?: AriaCitationHit[];
  feedback?: boolean | null;
}

interface AriaChatBoxProps {
  courseKey: string;
  skillId?: string | null;
  resourceId?: string | null;
  conversationId?: string | null;
  initialMessages?: Message[];
}

export const AriaChatBox: React.FC<AriaChatBoxProps> = ({
  courseKey,
  skillId,
  resourceId,
  conversationId: initialConvId,
  initialMessages = [],
}) => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | null>(initialConvId || null);
  const [selectedCitation, setSelectedCitation] = useState<AriaCitationHit | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  // Envoi d'un message
  const handleSendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;

    setInput('');
    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;

    // Ajout message utilisateur
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: trimmed, status: 'COMPLETED' },
      { id: assistantMsgId, role: 'assistant', content: '', status: 'STREAMING', citations: [] },
    ]);

    setIsGenerating(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/aria/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          courseKey,
          content: trimmed,
          conversationId: activeConvId || undefined,
          skillId: skillId || undefined,
          resourceId: resourceId || undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error('Erreur lors de la communication avec ARIA');
      }

      const callbacks: AriaSSECallbacks = {
        onStart: (payload) => {
          if (payload.conversationId) {
            setActiveConvId(payload.conversationId);
          }
        },
        onCitation: (payload) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, citations: [...(msg.citations || []), payload.citation] }
                : msg
            )
          );
        },
        onDelta: (payload) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: msg.content + payload.text }
                : msg
            )
          );
        },
        onDone: (payload) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    status: payload.status,
                    content: payload.fullText !== undefined ? payload.fullText : msg.content,
                  }
                : msg
            )
          );
          setIsGenerating(false);
        },
        onError: (payload) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    status: 'ERROR',
                    content: msg.content || payload.message,
                  }
                : msg
            )
          );
          setIsGenerating(false);
        },
      };

      await parseAriaSSEStream(response.body, callbacks);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Interruption utilisateur
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId ? { ...msg, status: 'CANCELLED' } : msg
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  status: 'ERROR',
                  content: 'Une interruption technique est survenue. Veuillez réessayer.',
                }
              : msg
          )
        );
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Interruption par l'élève
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Feedback utile / pas utile
  const handleFeedback = async (messageId: string, helpful: boolean) => {
    try {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedback: helpful } : m))
      );

      await fetch('/api/aria/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, feedback: helpful }),
      });
    } catch {
      // Ignorer
    }
  };

  // Raccourcis clavier : Entrée pour envoyer, Maj+Entrée pour nouvelle ligne
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl">
      {/* Context focus header si focus skill ou ressource */}
      {(skillId || resourceId) && (
        <div className="bg-sky-950/40 border-b border-sky-800/40 px-4 py-2 flex items-center justify-between text-xs text-sky-300">
          <div className="flex items-center gap-2 truncate">
            <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="truncate">
              {skillId ? `Focus compétence : ${skillId}` : `Document : ${resourceId}`}
            </span>
          </div>
          <span className="text-[10px] text-sky-400/80 bg-sky-900/60 px-2 py-0.5 rounded-full shrink-0">
            Guidage actif
          </span>
        </div>
      )}

      {/* Zone des messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">
              Posez votre question à ARIA
            </h3>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              ARIA vous accompagne pas à pas sur le programme officiel du Bac et du Brevet avec
              méthode et rigueur.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isAssistant = msg.role === 'assistant';

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isAssistant ? 'justify-start' : 'justify-end'}`}
              >
                {isAssistant && (
                  <div className="w-8 h-8 rounded-xl bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                    isAssistant
                      ? 'bg-slate-900/80 border border-slate-800 text-slate-200'
                      : 'bg-sky-600 text-white rounded-br-none'
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans">{msg.content}</div>

                  {msg.status === 'STREAMING' && (
                    <span className="inline-block w-2 h-4 ml-1 bg-sky-400 animate-pulse align-middle" />
                  )}

                  {msg.status === 'CANCELLED' && (
                    <div className="mt-2 text-xs text-amber-400/80 italic flex items-center gap-1.5">
                      <AlertCircle className="w-3 h-3" />
                      <span>Génération interrompue</span>
                    </div>
                  )}

                  {/* Citations de sources officielles */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <BookOpen className="w-3 h-3 text-sky-400" />
                        <span>Sources officielles citées :</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.citations.map((c, i) => (
                          <button
                            key={i}
                            onClick={() => setSelectedCitation(c)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-sky-300 transition-colors"
                          >
                            <span>{c.sourceTitle}</span>
                            {c.sourceLocation && (
                              <span className="text-slate-400">({c.sourceLocation})</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Boutons de feedback */}
                  {isAssistant && msg.status === 'COMPLETED' && (
                    <div className="mt-3 flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleFeedback(msg.id, true)}
                        className={`p-1 rounded transition-colors ${
                          msg.feedback === true
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                        title="Cette réponse m'a aidé"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.id, false)}
                        className={`p-1 rounded transition-colors ${
                          msg.feedback === false
                            ? 'text-rose-400 bg-rose-500/10'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                        title="Cette réponse ne m'a pas aidé"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Modal aperçu citation si cliquée */}
      {selectedCitation && (
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-start justify-between gap-3 text-xs">
          <div className="min-w-0">
            <span className="font-semibold text-sky-300">{selectedCitation.sourceTitle}</span>
            {selectedCitation.sourceLocation && (
              <span className="text-slate-400 ml-1.5">[{selectedCitation.sourceLocation}]</span>
            )}
            <p className="text-slate-300 mt-1 italic line-clamp-2">
              "{selectedCitation.snippet}"
            </p>
          </div>
          <button
            onClick={() => setSelectedCitation(null)}
            className="text-slate-500 hover:text-slate-300 font-bold px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Zone de saisie */}
      <div className="p-3 bg-slate-900/60 border-t border-slate-800">
        <div className="relative flex items-end gap-2 bg-slate-900 rounded-xl border border-slate-800 focus-within:border-sky-500/60 p-2 transition-colors">
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez votre question (ex: Comment démontrer qu'une suite est géométrique ?)"
            className="flex-1 bg-transparent border-0 resize-none text-slate-100 text-sm focus:outline-none placeholder:text-slate-500"
          />

          {isGenerating ? (
            <button
              onClick={handleStop}
              className="p-2 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
              title="Arrêter la génération"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              onClick={handleSendMessage}
              disabled={!input.trim()}
              className="p-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white transition-colors"
              title="Envoyer"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-500">
          <span>Entrée pour envoyer, Maj+Entrée pour un saut de ligne</span>
          <span>Posture socratique active</span>
        </div>
      </div>
    </div>
  );
};
