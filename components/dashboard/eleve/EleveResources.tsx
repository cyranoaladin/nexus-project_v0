'use client';

import { HardDrive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function EleveResources() {
  return (
    <section id="resources" aria-labelledby="eleve-resources-title">
      <Card className="border-white/10 bg-surface-card">
        <CardHeader>
          <CardTitle id="eleve-resources-title" className="flex items-center gap-2 text-white">
            <HardDrive className="h-5 w-5 text-brand-accent" aria-hidden="true" />
            Mes ressources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-400">
            Les ressources coach, documents et fiches RAG seront consolidés ici via les APIs documents.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
