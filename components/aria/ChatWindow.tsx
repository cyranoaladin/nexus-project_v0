'use client';

import 'katex/dist/katex.min.css';
import { useSession } from 'next-auth/react';
import { FormEvent, useState } from 'react';
import { MessageRenderer } from './MessageRenderer';
import { SubscriptionPrompt } from './SubscriptionPrompt';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatWindow() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);
  const [currentSubject, setCurrentSubject] = useState('MATHEMATIQUES'); // Valeur par défaut valide et conforme à l'enum

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/aria/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, subject: currentSubject }),
      });

      if (res.status === 429) {
        setShowSubscriptionPrompt(true);
        setMessages(prev => [...prev, { role: 'assistant', content: "Vous avez atteint votre limite pour aujourd'hui." }]);
        setIsLoading(false); // Correction : S'assurer de désactiver le chargement
        return;
      }

      if (!res.ok) {
        throw new Error(`Erreur API: ${res.statusText}`);
      }

      const data = await res.json();
      const assistantMessage: Message = { role: 'assistant', content: data.response };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error("Erreur lors de l'appel API:", error);
      const errorMessage: Message = { role: 'assistant', content: "Désolé, une erreur est survenue. Veuillez réessayer." };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const isE2E = typeof window !== 'undefined' && (process.env.NEXT_PUBLIC_E2E === '1');
  const allowUI = isE2E || !!session;
  if (!allowUI) {
    return <div className="text-center text-red-500">Veuillez vous connecter pour utiliser ARIA.</div>;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg max-w-4xl mx-auto">
      {showSubscriptionPrompt && <SubscriptionPrompt onClose={() => setShowSubscriptionPrompt(false)} />}

      <div className="p-4 border-b">
        {/* TODO: Remplacer par un vrai sélecteur Radix UI */}
        <label htmlFor="subject-select" className="mr-2 font-semibold">Matière :</label>
        <select
          id="subject-select"
          value={currentSubject}
          onChange={e => setCurrentSubject(e.target.value)}
          className="p-2 border rounded-md"
        >
          <option value="MATHEMATIQUES">Mathématiques</option>
          <option value="PHYSIQUE_CHIMIE">Physique-Chimie</option>
          <option value="NSI">NSI</option>
          <option value="FRANCAIS">Français</option>
        </select>
      </div>

      <div className="h-[60vh] overflow-y-auto p-6 space-y-4" data-testid="aria-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-lg p-3 rounded-2xl ${msg.role === 'user' ? 'bg-bleu-primaire text-white' : 'bg-gray-200 text-gray-800'}`}>
              <MessageRenderer content={msg.content} />
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-lg p-3 rounded-2xl bg-gray-200 text-gray-800">
              <span className="animate-pulse">ARIA réfléchit...</span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t flex items-center">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Posez votre question à ARIA..."
          disabled={isE2E ? false : isLoading}
          className="flex-grow p-3 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-bleu-primaire"
          data-testid="aria-input"
        />
        <button
          type="submit"
          aria-label="Envoyer le message"
          data-testid="aria-send"
          disabled={isE2E ? false : isLoading}
          className="bg-bleu-primaire text-white p-3 rounded-r-lg font-bold hover:bg-opacity-90 disabled:bg-gray-400"
        >
          Envoyer
        </button>
      </form>
    </div>
  );
}
