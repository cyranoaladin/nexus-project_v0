'use client';

import { GraduationCap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function EleveStages() {
  return (
    <section id="stages" aria-labelledby="eleve-stages-title">
      <Card className="border-white/10 bg-surface-card">
        <CardHeader>
          <CardTitle id="eleve-stages-title" className="flex items-center gap-2 text-white">
            <GraduationCap className="h-5 w-5 text-brand-accent" aria-hidden="true" />
            Stages intensifs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-400">
            Les stages disponibles et bilans de stage seront consolidés dans cette section.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
