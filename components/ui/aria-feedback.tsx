"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, MessageSquare, Send, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';

interface AriaFeedbackProps {
  messageId: string;
  onFeedback?: (feedback: {
    messageId: string;
    type: 'positive' | 'negative' | 'comment';
    content?: string;
  }) => void;
  className?: string;
}

export function AriaFeedback({ messageId, onFeedback, className = '' }: AriaFeedbackProps) {
  const [feedbackType, setFeedbackType] = useState<'positive' | 'negative' | 'comment' | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleFeedback = async (type: 'positive' | 'negative' | 'comment') => {
    if (isSubmitted) return;

    setIsSubmitting(true);

    try {
      const feedbackData = {
        messageId,
        type,
        content: type === 'comment' ? comment : undefined
      };

      // Appel API pour enregistrer le feedback
      const response = await fetch('/api/aria/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedbackData)
      });

      if (response.ok) {
        setIsSubmitted(true);
        if (onFeedback) {
          onFeedback(feedbackData);
        }
      } else {
        console.error('Erreur lors de l\'envoi du feedback');
      }
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommentSubmit = () => {
    if (comment.trim()) {
      handleFeedback('comment');
    }
  };

  if (isSubmitted) {
    return (
      <Card className={`bg-green-50 border-green-200 ${className}`}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">Merci pour votre feedback !</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-gray-50 border-gray-200 ${className}`}>
      <CardContent className="p-3">
        <div className="space-y-3">
          {/* Question de feedback */}
          <div className="text-sm text-gray-600">
            Cette réponse d'ARIA vous a-t-elle été utile ?
          </div>

          {/* Boutons de feedback rapide */}
          {feedbackType !== 'comment' && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFeedback('positive')}
                disabled={isSubmitting}
                className="flex items-center gap-1 hover:bg-green-50 hover:border-green-300"
              >
                <ThumbsUp className="w-4 h-4" />
                <span className="text-xs">Utile</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFeedback('negative')}
                disabled={isSubmitting}
                className="flex items-center gap-1 hover:bg-red-50 hover:border-red-300"
              >
                <ThumbsDown className="w-4 h-4" />
                <span className="text-xs">Pas utile</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setFeedbackType('comment')}
                disabled={isSubmitting}
                className="flex items-center gap-1 hover:bg-blue-50 hover:border-blue-300"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="text-xs">Commenter</span>
              </Button>
            </div>
          )}

          {/* Zone de commentaire */}
          {feedbackType === 'comment' && (
            <div className="space-y-2">
              <Textarea
                placeholder="Dites-nous comment améliorer cette réponse..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleCommentSubmit}
                  disabled={isSubmitting || !comment.trim()}
                  className="flex items-center gap-1"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Envoyer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFeedbackType(null);
                    setComment('');
                  }}
                  disabled={isSubmitting}
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {/* Feedback en cours */}
          {isSubmitting && feedbackType !== 'comment' && (
            <div className="flex items-center gap-2 text-blue-600">
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <span className="text-sm">Envoi en cours...</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Composant pour afficher un message ARIA avec feedback intégré
interface AriaMessageWithFeedbackProps {
  message: {
    id: string;
    content: string;
    timestamp: string;
    isUser: boolean;
  };
  showFeedback?: boolean;
  onFeedback?: (feedback: {
    messageId: string;
    type: 'positive' | 'negative' | 'comment';
    content?: string;
  }) => void;
}

export function AriaMessageWithFeedback({
  message,
  showFeedback = true,
  onFeedback
}: AriaMessageWithFeedbackProps) {
  return (
    <div className={`mb-4 ${message.isUser ? 'ml-8' : 'mr-8'}`}>
      <Card className={`${message.isUser
          ? 'bg-blue-500 text-white ml-auto'
          : 'bg-white border-gray-200'
        }`}>
        <CardContent className="p-4">
          <div className="space-y-2">
            {/* Contenu du message */}
            <div className="text-sm whitespace-pre-wrap">
              {message.content}
            </div>

            {/* Timestamp */}
            <div className={`text-xs ${message.isUser ? 'text-blue-100' : 'text-gray-500'
              }`}>
              {new Date(message.timestamp).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feedback pour les messages d'ARIA uniquement */}
      {!message.isUser && showFeedback && (
        <div className="mt-2">
          <AriaFeedback
            messageId={message.id}
            onFeedback={onFeedback}
          />
        </div>
      )}
    </div>
  );
}
