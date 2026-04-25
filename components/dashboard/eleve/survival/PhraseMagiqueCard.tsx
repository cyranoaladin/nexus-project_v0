'use client';

import { Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PhraseMagique } from '@/lib/survival/types';

type PhraseMagiqueCardProps = {
  phrase: PhraseMagique;
  copiedCount: number;
};

export function PhraseMagiqueCard({ phrase, copiedCount }: PhraseMagiqueCardProps) {
  const [count, setCount] = useState(copiedCount);

  async function copyPhrase() {
    await navigator.clipboard?.writeText(phrase.template).catch(() => undefined);
    setCount((value) => value + 1);
    await fetch(`/api/student/survival/phrases/${phrase.id}/copied`, { method: 'POST' }).catch(() => undefined);
  }

  return (
    <Card className="border-white/10 bg-surface-card">
      <CardHeader>
        <CardTitle className="text-sm text-white">{phrase.context}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-relaxed text-neutral-200">{phrase.template}</p>
        <p className="text-xs text-neutral-400">{phrase.example}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-brand-accent">Copiee {count} fois</span>
          <Button type="button" className="min-h-11 min-w-11 bg-brand-accent text-white" onClick={copyPhrase} aria-label="Copier la phrase magique">
            <Copy className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
