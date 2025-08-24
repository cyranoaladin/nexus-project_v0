'use client';

import 'katex/dist/katex.min.css';
import { useSession } from 'next-auth/react';
import { FormEvent, useEffect, useState } from 'react';
import { MessageRenderer } from './MessageRenderer';
import { SubscriptionPrompt } from './SubscriptionPrompt';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Attachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

export function ChatWindow() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);
  const [currentSubject, setCurrentSubject] = useState('MATHEMATIQUES'); // Valeur par défaut valide et conforme à l'enum
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      const res = await fetch('/api/uploads/analyse', {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || 'Upload échoué');
      }
      setAttachments(prev => [...prev, { url: data.url as string, name: file.name, type: file.type, size: file.size }]);
      setMessages(prev => [...prev, { role: 'assistant', content: `Fichier ajouté: ${file.name} (${Math.round(file.size/1024)} Ko)` }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Échec de l'upload: ${(e as Error).message}` }]);
    }
  }

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
        body: JSON.stringify({ message: input, subject: currentSubject, attachments }),
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

      // Afficher un lien PDF lorsque disponible
      if (data.documentUrl) {
        const linkMsg: Message = { role: 'assistant', content: `PDF généré: [Télécharger le document](${data.documentUrl})` };
        setMessages(prev => [...prev, linkMsg]);
      }

    } catch (error) {
      console.error("Erreur lors de l'appel API:", error);
      const errorMessage: Message = { role: 'assistant', content: "Désolé, une erreur est survenue. Veuillez réessayer." };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!hydrated) {
    return null;
  }

  const isE2E = process.env.NEXT_PUBLIC_E2E === '1';
  const allowUI = isE2E || !!session;
  if (!allowUI) {
    return <div className="text-center text-red-700">Veuillez vous connecter pour utiliser ARIA.</div>;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg max-w-4xl mx-auto" data-testid="nexus-aria-container">
      {/* Mascotte ARIA */}
      <div className="p-4 flex items-center gap-3">
        <img src="/images/logo_nexus_reussite.png" alt="ARIA mascotte" className="h-8 w-8 rounded-full" data-testid="nexus-aria-mascotte" />
        <div className="text-sm text-gray-600">Assistant ARIA</div>
      </div>
      {showSubscriptionPrompt && (
        <div data-testid="nexus-subscription-prompt">
          <SubscriptionPrompt onClose={() => setShowSubscriptionPrompt(false)} />
        </div>
      )}

      <div className="p-4 border-b">
        {/* TODO: Remplacer par un vrai sélecteur Radix UI */}
        <label htmlFor="subject-select" className="mr-2 font-semibold">Matière :</label>
        <select
          id="subject-select"
          value={currentSubject}
          onChange={e => setCurrentSubject(e.target.value)}
          className="p-2 border rounded-md"
          data-testid="nexus-aria-subject"
        >
          <option value="MATHEMATIQUES">Mathématiques</option>
          <option value="NSI">NSI</option>
          <option value="FRANCAIS">Français</option>
          <option value="PHILOSOPHIE">Philosophie</option>
          <option value="HISTOIRE_GEO">Histoire-Géographie</option>
          <option value="ANGLAIS">Anglais</option>
          <option value="ESPAGNOL">Espagnol</option>
          <option value="PHYSIQUE_CHIMIE">Physique-Chimie</option>
          <option value="SVT">SVT</option>
          <option value="SES">SES</option>
        </select>
        <div className="mt-3 flex items-center gap-3">
          <label htmlFor="aria-file" className="text-sm font-semibold">Ajouter un fichier (PDF/PNG/JPEG) :</label>
          <input id="aria-file" type="file" accept=".pdf,image/png,image/jpeg" onChange={(e) => handleUpload(e.target.files)} data-testid="nexus-upload-input" />
        </div>
        {attachments.length > 0 && (
          <div className="mt-2 text-sm text-gray-700">
            Pièces jointes:
            <ul className="list-disc pl-6">
              {attachments.map((att, idx) => (
                <li key={idx}>
                  <a href={att.url} className="text-blue-600 underline" target="_blank" rel="noreferrer">{att.name}</a> ({Math.round(att.size/1024)} Ko)
                </li>
              ))}
            </ul>
          </div>
        )}
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
          data-testid="nexus-aria-input"
          aria-label="Entrée de message ARIA"
        />
        <button
          type="submit"
          aria-label="Envoyer le message"
          data-testid="nexus-aria-send"
          disabled={isE2E ? false : isLoading}
          className="bg-bleu-primaire text-white p-3 rounded-r-lg font-bold hover:bg-opacity-90 disabled:bg-gray-400"
        >
          Envoyer
        </button>
      </form>
    </div>
  );
}
