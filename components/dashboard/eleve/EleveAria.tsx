'use client';

import { MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type EleveAriaProps = {
  totalConversations: number;
  messagesToday: number;
  onOpenAria?: () => void;
  readOnly?: boolean;
};

export function EleveAria({ totalConversations, messagesToday, onOpenAria, readOnly = false }: EleveAriaProps) {
  return (
    <section id="aria" aria-labelledby="eleve-aria-title">
      <Card className="border-brand-accent/20 bg-surface-card">
        <CardHeader>
          <CardTitle id="eleve-aria-title" className="flex items-center gap-2 text-white">
            <MessageSquare className="h-5 w-5 text-brand-accent" aria-hidden="true" />
            ARIA
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-2xl font-semibold text-white">{totalConversations}</p>
            <p className="text-sm text-neutral-400">
              {messagesToday} message{messagesToday > 1 ? 's' : ''} aujourd'hui
            </p>
          </div>
          {!readOnly && (
            <Button onClick={onOpenAria} className="bg-brand-accent hover:bg-brand-accent/90">
              Ouvrir ARIA
            </Button>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
