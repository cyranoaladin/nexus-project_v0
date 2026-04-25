'use client';

import { FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type EleveBilansProps = {
  hasLastBilan?: boolean;
};

export function EleveBilans({ hasLastBilan = false }: EleveBilansProps) {
  return (
    <section id="bilans" aria-labelledby="eleve-bilans-title">
      <Card className="border-white/10 bg-surface-card">
        <CardHeader>
          <CardTitle id="eleve-bilans-title" className="flex items-center gap-2 text-white">
            <FileText className="h-5 w-5 text-brand-accent" aria-hidden="true" />
            Mes bilans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-400">
            {hasLastBilan ? 'Un bilan récent est disponible dans votre dossier.' : 'Aucun bilan récent.'}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
