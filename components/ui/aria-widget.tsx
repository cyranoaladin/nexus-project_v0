"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Send, Sparkles, X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveSubjectIcon } from '@/lib/ui-icons';

interface AriaWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Course Key to pre-select when opening from a course card */
  defaultCourseKey?: string;
  /** Legacy subject alias for compatibility */
  defaultSubject?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const COURSE_OPTIONS = [
  { value: 'eds-maths-terminale', label: 'Mathématiques (Terminale)', iconSubject: 'MATHEMATIQUES' },
  { value: 'eds-maths-premiere', label: 'Mathématiques (Première)', iconSubject: 'MATHEMATIQUES' },
  { value: 'eds-nsi-terminale', label: 'NSI (Terminale)', iconSubject: 'NSI' },
  { value: 'eds-nsi-premiere', label: 'NSI (Première)', iconSubject: 'NSI' },
  { value: 'tc-francais-premiere', label: 'Français (Première)', iconSubject: 'FRANCAIS' },
  { value: 'tc-philosophie-terminale', label: 'Philosophie (Terminale)', iconSubject: 'PHILOSOPHIE' },
] as const;

export function AriaWidget({ isOpen, onClose, defaultCourseKey, defaultSubject }: AriaWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCourseKey, setSelectedCourseKey] = useState<string | null>(
    defaultCourseKey ?? (defaultSubject === 'NSI' ? 'eds-nsi-terminale' : defaultSubject === 'FRANCAIS' ? 'tc-francais-premiere' : 'eds-maths-terminale')
  );
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when widget opens
  useEffect(() => {
    if (isOpen) {
      if (defaultCourseKey) {
        setSelectedCourseKey(defaultCourseKey);
      } else if (defaultSubject) {
        setSelectedCourseKey(defaultSubject === 'NSI' ? 'eds-nsi-terminale' : defaultSubject === 'FRANCAIS' ? 'tc-francais-premiere' : 'eds-maths-terminale');
      }
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, defaultCourseKey, defaultSubject]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSelectCourse = useCallback((courseKey: string) => {
    setSelectedCourseKey(courseKey);
    setMessages([]);
    setConversationId(null);
    setError(null);
    const label = COURSE_OPTIONS.find(c => c.value === courseKey)?.label ?? courseKey;
    setMessages([{
      role: 'assistant',
      content: `Je suis prête à t'aider en ${label} ! Pose-moi ta question — exercice, cours, méthode, je suis là.`
    }]);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!currentMessage.trim() || !selectedCourseKey || isLoading) return;

    const userMessage = currentMessage.trim();
    setCurrentMessage('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setError(null);

    try {
      // Invariant ACTIVE_SUBJECT_BASED_CHAT_CLIENTS=0 : envoi direct de courseKey
      const response = await fetch('/api/aria/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseKey: selectedCourseKey,
          content: userMessage,
          ...(conversationId ? { conversationId } : {}),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error || `Erreur ${response.status}`;

        if (response.status === 403) {
          setError('Accès ARIA non autorisé pour ce cours. Vérifie ton abonnement.');
        } else {
          setError(errMsg);
        }
        setIsLoading(false);
        return;
      }

      const data = await response.json();

      if (data.conversation?.id) {
        setConversationId(data.conversation.id);
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message?.content ?? 'Réponse reçue.',
      }]);

    } catch {
      setError('Impossible de contacter ARIA. Vérifie ta connexion.');
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [currentMessage, selectedCourseKey, isLoading, conversationId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const selectedOption = COURSE_OPTIONS.find(c => c.value === selectedCourseKey);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-4rem)] flex flex-col rounded-2xl bg-surface-darker/95 backdrop-blur-xl border border-border-gold/30 shadow-2xl shadow-black/50 overflow-hidden"
          role="dialog"
          aria-label="Assistant ARIA"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-gold/20 bg-surface-dark/60">
            <div className="flex items-center gap-3">
              <div className="relative w-8 h-8 rounded-full overflow-hidden border border-brand-accent/40 bg-brand-accent/10 flex items-center justify-center">
                <Image
                  src="/images/aria/aria_avatar.webp"
                  alt="ARIA"
                  width={32}
                  height={32}
                  className="object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <Sparkles className="w-4 h-4 text-brand-accent absolute" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm text-text-primary">ARIA</span>
                  <span className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-medium rounded-full bg-brand-accent/20 text-brand-accent border border-brand-accent/30">
                    IA Nexus
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary/70">
                  {selectedOption ? selectedOption.label : 'Choisis un cours'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-card/60 transition-colors"
              aria-label="Fermer ARIA"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Course Selector Pills */}
          <div className="px-3 py-2 border-b border-border-gold/10 bg-surface-dark/30 flex gap-1.5 overflow-x-auto no-scrollbar">
            {COURSE_OPTIONS.map((opt) => {
              const isSelected = selectedCourseKey === opt.value;
              const Icon = resolveSubjectIcon(opt.iconSubject);
              return (
                <button
                  key={opt.value}
                  onClick={() => handleSelectCourse(opt.value)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-brand-accent text-surface-darker font-semibold shadow-sm'
                      : 'bg-surface-card/60 text-text-secondary hover:text-text-primary hover:bg-surface-card border border-border-light/20'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {opt.label.split(' ')[0]}
                </button>
              );
            })}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && !selectedCourseKey && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <Sparkles className="w-8 h-8 text-brand-accent/60 mb-2" />
                <p className="text-sm font-medium text-text-primary mb-1">
                  Sélectionne un cours pour commencer
                </p>
                <p className="text-xs text-text-secondary/70">
                  ARIA est entraînée sur le programme officiel français.
                </p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-brand-accent/20 border border-brand-accent/40 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3 h-3 text-brand-accent" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-brand-accent text-surface-darker font-medium rounded-tr-none'
                      : 'bg-surface-card border border-border-gold/15 text-text-primary rounded-tl-none'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2 justify-start items-center">
                <div className="w-6 h-6 rounded-full bg-brand-accent/20 border border-brand-accent/40 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3 h-3 text-brand-accent animate-pulse" />
                </div>
                <div className="bg-surface-card border border-border-gold/15 rounded-xl rounded-tl-none px-3 py-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-accent/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-accent/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-accent/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-border-gold/20 bg-surface-dark/40">
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={selectedCourseKey ? 'Pose ta question...' : 'Choisis d\'abord un cours'}
                disabled={!selectedCourseKey || isLoading}
                className="flex-1 text-xs bg-surface-card/60 border-border-gold/20 focus:border-brand-accent text-text-primary placeholder:text-text-secondary/50 h-9"
              />
              <Button
                size="sm"
                onClick={handleSendMessage}
                disabled={!currentMessage.trim() || !selectedCourseKey || isLoading}
                className="h-9 px-3 bg-brand-accent hover:bg-brand-accent/90 text-surface-darker"
                aria-label="Envoyer"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
