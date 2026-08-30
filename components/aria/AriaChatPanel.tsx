'use client';

import { useEffect, useRef } from 'react';
import { Send, Sparkles, Square, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { useAriaConversation } from './useAriaConversation';
import { ARIA_PERFORMANCE_BUDGETS } from '@/lib/aria/domain/observability/performance-budgets';

export interface AriaChatPanelProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly initialCourseKey?: string;
}

function disabledReason(course: ReturnType<typeof useAriaConversation>['courses'][number]): string {
  if (!course.capabilities.hasChat) return 'chat indisponible';
  if (!course.access.commerciallyEntitled) return 'non inclus';
  if (course.access.status !== 'AVAILABLE') return 'indisponible';
  return '';
}

function publicErrorLabel(code: string | null): string | null {
  if (!code) return null;
  if (code === 'RAG_UNAVAILABLE') return 'Les sources pédagogiques sont temporairement indisponibles.';
  if (code === 'MODEL_UNAVAILABLE') return 'ARIA met trop de temps à répondre. Réessayez dans un instant.';
  if (code === 'NOT_ENTITLED') return 'Ce cours n’est pas inclus dans votre accès ARIA.';
  return 'ARIA rencontre une difficulté technique. Vous pouvez réessayer.';
}

function citationSummary(
  citations: readonly { readonly traceability?: 'CANONICAL' | 'LEGACY_UNTRACEABLE' }[],
): string {
  const legacyCount = citations.filter(
    ({ traceability }) => traceability === 'LEGACY_UNTRACEABLE',
  ).length;
  const canonicalCount = citations.length - legacyCount;
  const legacyLabel = `${legacyCount} référence${legacyCount > 1 ? 's' : ''} historique${legacyCount > 1 ? 's' : ''}`;
  if (canonicalCount > 0 && legacyCount > 0) {
    return `${canonicalCount} source${canonicalCount > 1 ? 's' : ''} vérifiée${canonicalCount > 1 ? 's' : ''} et ${legacyLabel}`;
  }
  if (legacyCount > 0) return legacyLabel;
  return `${canonicalCount} source${canonicalCount > 1 ? 's' : ''}`;
}

export function AriaChatPanel({ open, onClose, initialCourseKey }: AriaChatPanelProps) {
  const conversation = useAriaConversation({ open, initialCourseKey });
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const courseRef = useRef<HTMLSelectElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    window.requestAnimationFrame(() => {
      if (inputRef.current && !inputRef.current.disabled) {
        inputRef.current.focus();
        return;
      }
      courseRef.current?.focus();
    });
    return () => previousFocus.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;
  const hasAvailableCourse = conversation.courses.some((course) => !disabledReason(course));
  const noAvailableCourse = !hasAvailableCourse;
  const selectionRequired = hasAvailableCourse && conversation.selectedCourseKey === null;
  const busy = conversation.phase === 'STREAMING' || conversation.phase === 'STOPPING';
  const errorLabel = publicErrorLabel(conversation.errorCode);

  const onDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
    )];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Assistant pédagogique ARIA"
        aria-busy={busy}
        onKeyDown={onDialogKeyDown}
        className="flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden bg-surface-darker text-text-primary shadow-2xl sm:h-[min(760px,calc(100dvh-2rem))] sm:max-w-3xl sm:rounded-2xl sm:border sm:border-border-gold/30"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-border-gold/20 bg-surface-dark px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-accent/30 bg-brand-accent/10">
              <Sparkles className="h-5 w-5 text-brand-accent" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="font-fraunces text-lg text-white">ARIA</h2>
              <p className="truncate text-xs text-text-secondary">Assistant pédagogique Nexus Réussite</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer ARIA"
            className="min-h-11 min-w-11 rounded-lg p-2 text-text-secondary hover:bg-white/5 hover:text-white"
          >
            <X className="mx-auto h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="shrink-0 border-b border-border-gold/15 px-4 py-3">
          <label htmlFor="aria-course" className="mb-1 block text-xs font-medium text-text-secondary">
            Cours ARIA
          </label>
          <select
            ref={courseRef}
            id="aria-course"
            aria-label="Cours ARIA"
            value={conversation.selectedCourseKey ?? ''}
            onChange={(event) => conversation.selectCourse(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-border-gold/25 bg-surface-card px-3 text-sm text-white"
          >
            {noAvailableCourse && <option value="">Aucun cours disponible</option>}
            {selectionRequired && <option value="">Choisir un cours</option>}
            {conversation.courses.map((course) => {
              const reason = disabledReason(course);
              return (
                <option key={course.courseKey} value={course.courseKey} disabled={Boolean(reason)}>
                  {course.label}{reason ? ` — ${reason}` : ''}
                </option>
              );
            })}
          </select>
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-label="Conversation ARIA">
          {noAvailableCourse ? (
            <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center">
              <Sparkles className="mb-3 h-8 w-8 text-brand-accent/70" aria-hidden="true" />
              <p className="font-medium text-white">Aucun cours ARIA avec chat n’est disponible.</p>
              <p className="mt-2 text-sm text-text-secondary">
                Vos cours restent visibles dans votre cockpit. Un cours doit être supporté et inclus pour ouvrir le chat.
              </p>
            </div>
          ) : selectionRequired ? (
            <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center">
              <Sparkles className="mb-3 h-8 w-8 text-brand-accent/70" aria-hidden="true" />
              <p className="font-medium text-white">Choisissez le cours que vous souhaitez travailler.</p>
              <p className="mt-2 text-sm text-text-secondary">
                ARIA n’invente jamais de matière par défaut : le contexte vient de votre carte scolaire.
              </p>
            </div>
          ) : conversation.messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center">
              <p className="font-medium text-white">Que souhaitez-vous travailler aujourd’hui ?</p>
              <p className="mt-2 text-sm text-text-secondary">
                Demandez une explication, une méthode ou un accompagnement pas à pas.
              </p>
            </div>
          ) : (
            <ol className="space-y-4" aria-label="Messages">
              {conversation.messages.map((message) => (
                <li key={message.id} className={message.role === 'user' ? 'ml-auto max-w-[88%]' : 'mr-auto max-w-[92%]'}>
                  <article className={message.role === 'user'
                    ? 'rounded-2xl rounded-br-sm bg-brand-accent px-4 py-3 text-sm text-surface-darker'
                    : 'rounded-2xl rounded-bl-sm border border-white/10 bg-surface-card px-4 py-3 text-sm text-text-primary'}>
                    <p className="whitespace-pre-wrap break-words leading-6">{message.content}</p>
                    {conversation.showCitations && message.citations.length > 0 && (
                      <details className="mt-3 border-t border-white/10 pt-2 text-xs">
                        <summary className="flex min-h-11 cursor-pointer items-center text-brand-accent">
                          {citationSummary(message.citations)}
                        </summary>
                        <ul className="space-y-1 pt-1">
                          {message.citations.map((citation) => (
                            <li key={citation.id} className="text-text-secondary">
                              {citation.traceability === 'LEGACY_UNTRACEABLE'
                                ? `Historique — provenance non vérifiée : ${citation.sourceTitle}`
                                : citation.sourceTitle}
                              {citation.sourceLocation ? ` — ${citation.sourceLocation}` : ''}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {message.role === 'assistant' && message.status !== 'STREAMING' && (
                      <div className="mt-2 flex gap-1 border-t border-white/10 pt-2">
                        <button
                          type="button"
                          aria-label="Réponse utile"
                          aria-pressed={message.feedback === true}
                          onClick={() => void conversation.submitFeedback(message.id, true)}
                          className="min-h-11 min-w-11 rounded-lg p-2 hover:bg-white/5"
                        >
                          <ThumbsUp className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label="Réponse peu utile"
                          aria-pressed={message.feedback === false}
                          onClick={() => void conversation.submitFeedback(message.id, false)}
                          className="min-h-11 min-w-11 rounded-lg p-2 hover:bg-white/5"
                        >
                          <ThumbsDown className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </article>
                </li>
              ))}
            </ol>
          )}
        </main>

        {errorLabel && (
          <p role="alert" className="mx-4 mb-2 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
            {errorLabel}
          </p>
        )}
        {conversation.ragStatus === 'RUNTIME_UNAVAILABLE' && !errorLabel && (
          <p role="alert" className="mx-4 mb-2 rounded-lg border border-amber-300/30 bg-amber-400/10 p-3 text-sm text-amber-100">
            Les sources pédagogiques sont temporairement indisponibles.
          </p>
        )}

        <footer className="shrink-0 border-t border-border-gold/20 bg-surface-dark p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:p-4">
          <label htmlFor="aria-message" className="sr-only">Message à ARIA</label>
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              id="aria-message"
              aria-label="Message à ARIA"
              rows={2}
              maxLength={ARIA_PERFORMANCE_BUDGETS.messageCharactersMax}
              value={conversation.input}
              onChange={(event) => conversation.setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void conversation.send();
                }
              }}
              disabled={noAvailableCourse || busy}
              className="max-h-32 min-h-12 min-w-0 flex-1 resize-none rounded-xl border border-border-gold/25 bg-surface-card px-3 py-2 text-sm text-white placeholder:text-text-secondary"
              placeholder="Posez votre question à ARIA…"
            />
            {busy ? (
              <button
                type="button"
                onClick={() => void conversation.stop()}
                disabled={conversation.phase === 'STOPPING'}
                aria-label="Arrêter la réponse ARIA"
                className="min-h-12 min-w-12 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-red-200"
              >
                <Square className="mx-auto h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void conversation.send()}
                disabled={noAvailableCourse || !conversation.input.trim()}
                aria-label="Envoyer à ARIA"
                className="min-h-12 min-w-12 rounded-xl bg-brand-accent p-3 text-surface-darker disabled:opacity-50"
              >
                <Send className="mx-auto h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
          <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {conversation.announcement}
          </p>
        </footer>
      </div>
    </div>
  );
}
