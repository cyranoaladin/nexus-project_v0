"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Send, Sparkles, X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

interface AriaWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-select a subject when opening from a course card */
  defaultSubject?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUBJECT_OPTIONS = [
  { value: 'MATHEMATIQUES', label: 'Mathématiques', icon: '📐' },
  { value: 'NSI', label: 'NSI', icon: '💻' },
  { value: 'FRANCAIS', label: 'Français', icon: '📖' },
  { value: 'PHYSIQUE_CHIMIE', label: 'Physique-Chimie', icon: '🔬' },
  { value: 'SVT', label: 'SVT', icon: '🌿' },
  { value: 'HISTOIRE_GEO', label: 'Histoire-Géo', icon: '🌍' },
  { value: 'PHILOSOPHIE', label: 'Philosophie', icon: '🧠' },
  { value: 'ANGLAIS', label: 'Anglais', icon: '🇬🇧' },
  { value: 'ESPAGNOL', label: 'Espagnol', icon: '🇪🇸' },
  { value: 'SES', label: 'SES', icon: '📊' },
] as const;

export function AriaWidget({ isOpen, onClose, defaultSubject }: AriaWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(defaultSubject ?? null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when widget opens
  useEffect(() => {
    if (isOpen) {
      if (defaultSubject) {
        setSelectedSubject(defaultSubject);
      }
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, defaultSubject]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSelectSubject = useCallback((subject: string) => {
    setSelectedSubject(subject);
    setMessages([]);
    setConversationId(null);
    setError(null);
    const label = SUBJECT_OPTIONS.find(s => s.value === subject)?.label ?? subject;
    setMessages([{
      role: 'assistant',
      content: `Je suis prête à t'aider en ${label} ! Pose-moi ta question — exercice, cours, méthode, je suis là.`
    }]);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!currentMessage.trim() || !selectedSubject || isLoading) return;

    const userMessage = currentMessage.trim();
    setCurrentMessage('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/aria/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: selectedSubject,
          content: userMessage,
          ...(conversationId ? { conversationId } : {}),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error || `Erreur ${response.status}`;

        if (response.status === 403) {
          setError('Accès ARIA non autorisé pour cette matière. Vérifie ton abonnement.');
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
    }
  }, [currentMessage, selectedSubject, conversationId, isLoading]);

  const handleNewConversation = useCallback(() => {
    setSelectedSubject(null);
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-surface-card border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md h-[85vh] sm:h-[600px] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-primary to-brand-accent p-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Image
                  src="/images/aria.png"
                  alt="ARIA"
                  width={40}
                  height={40}
                  className="rounded-full bg-white/20 p-1"
                />
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white"></div>
              </div>
              <div>
                <h3 className="font-semibold">ARIA</h3>
                <p className="text-xs opacity-90">
                  {selectedSubject
                    ? SUBJECT_OPTIONS.find(s => s.value === selectedSubject)?.label ?? 'IA Pédagogique'
                    : 'IA Pédagogique'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedSubject && (
                <button
                  onClick={handleNewConversation}
                  className="text-xs bg-white/20 hover:bg-white/30 rounded-full px-3 py-1 transition-colors"
                  title="Nouvelle conversation"
                >
                  Nouveau
                </button>
              )}
              <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Subject Selection */}
          {!selectedSubject && (
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="text-center mb-6">
                <Sparkles className="w-8 h-8 text-brand-accent mx-auto mb-3" />
                <h4 className="font-semibold text-white text-lg">Choisis ta matière</h4>
                <p className="text-neutral-400 text-sm mt-1">
                  ARIA s&apos;adapte au programme officiel de chaque discipline.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {SUBJECT_OPTIONS.map((subject) => (
                  <button
                    key={subject.value}
                    onClick={() => handleSelectSubject(subject.value)}
                    data-testid={`aria-subject-${subject.value.toLowerCase()}`}
                    className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:border-brand-accent/40 hover:bg-brand-accent/5 transition-all text-left group"
                  >
                    <span className="text-xl">{subject.icon}</span>
                    <span className="text-sm font-medium text-neutral-200 group-hover:text-white transition-colors">
                      {subject.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {selectedSubject && (
            <>
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    data-testid={message.role === 'assistant' ? 'aria-message-assistant' : 'aria-message-user'}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 ${message.role === 'user'
                        ? 'bg-brand-accent text-white'
                        : 'bg-white/5 border border-white/10 text-neutral-100'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-3.5 h-3.5 text-brand-accent" />
                          <span className="text-xs font-medium text-brand-accent">ARIA</span>
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                      <div className="flex space-x-1.5">
                        <div className="w-2 h-2 bg-brand-accent/60 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-brand-accent/60 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                        <div className="w-2 h-2 bg-brand-accent/60 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex justify-center">
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 max-w-[90%]">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-rose-200">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-3 border-t border-white/10">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    placeholder="Pose ta question..."
                    aria-label="Votre message"
                    data-testid="aria-input"
                    className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-neutral-500"
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    disabled={isLoading}
                  />
                  <Button
                    onClick={handleSendMessage}
                    data-testid="aria-send"
                    className="px-3 bg-brand-accent hover:bg-brand-accent/90"
                    disabled={isLoading || !currentMessage.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-neutral-600 mt-1.5 text-center">
                  ARIA utilise l&apos;IA pour t&apos;aider. Vérifie toujours les réponses importantes.
                </p>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
