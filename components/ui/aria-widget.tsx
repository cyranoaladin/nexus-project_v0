"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, Sparkles, X } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

interface AriaWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

export function AriaWidget({ isOpen, onClose, initialPrompt = "Quel est mon profil d'apprenant ?" }: AriaWidgetProps) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Bonjour ! Je suis ARIA, votre assistant IA pédagogique. ${initialPrompt ? `Parlons de : "${initialPrompt}"` : 'Comment puis-je vous aider aujourd\'hui ?'}`
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [showEmailCapture, setShowEmailCapture] = useState(false);

  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage = currentMessage;
    setCurrentMessage('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    // Simuler une réponse ARIA (en production, appel API réel)
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `C'est une excellente question ! Basé sur votre demande "${userMessage}", je peux vous donner des conseils personnalisés. Pour vous fournir une recommandation vraiment adaptée à votre profil, j'aurais besoin de votre email pour continuer notre échange.`
      }]);
      setIsLoading(false);
      setShowEmailCapture(true);
    }, 1500);
  };

  const handleEmailSubmit = async () => {
    if (!userEmail.trim()) return;

    // TODO: Enregistrer l'email en base avec tag "Prospect via Quiz IA"
    console.log('Email capturé :', userEmail, 'Tag: Prospect via Quiz IA');

    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `Merci ${userEmail} ! Je vais maintenant pouvoir vous proposer un accompagnement personnalisé. Basé sur nos échanges, je recommande de commencer par notre bilan stratégique gratuit pour identifier précisément vos besoins et objectifs.`
    }]);
    setShowEmailCapture(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md h-[600px] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Image
                  src="/images/aria.png"
                  alt="ARIA"
                  width={40}
                  height={40}
                  className="rounded-full bg-white/20 p-1"
                />
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
              </div>
              <div>
                <h3 className="font-semibold">ARIA</h3>
                <p className="text-xs opacity-90">Assistant IA Pédagogique</p>
              </div>
            </div>
            <button onClick={onClose} className="hover:bg-white/20 rounded-full p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl p-3 ${message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                    }`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-medium text-blue-600">ARIA</span>
                    </div>
                  )}
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl p-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t">
            {showEmailCapture ? (
              <div className="space-y-3">
                <Input
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="Votre email pour continuer..."
                  className="w-full"
                  onKeyPress={(e) => e.key === 'Enter' && handleEmailSubmit()}
                />
                <Button
                  onClick={handleEmailSubmit}
                  className="w-full"
                  disabled={!userEmail.trim()}
                >
                  Continuer l'échange
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  placeholder="Posez votre message..."
                  aria-label="Votre message"
                  data-testid="aria-input"
                  className="flex-1"
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSendMessage}
                  className="px-3"
                  disabled={isLoading || !currentMessage.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
