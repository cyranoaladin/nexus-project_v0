'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { EleveTrackItem } from './types';

type TrackContentEDSProps = {
  specialties: EleveTrackItem[];
  readOnly?: boolean;
};

export function TrackContentEDS({ specialties, readOnly = false }: TrackContentEDSProps) {
  return (
    <section id="programme-maths" aria-labelledby="eds-track-title" className="space-y-4">
      <div>
        <h2 id="eds-track-title" className="text-xl font-semibold text-neutral-100">
          Mes spécialités
        </h2>
        <p className="text-sm text-neutral-400">Parcours Première générale EDS.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {specialties.map((item) => {
          const subject = item.subject ?? 'MATHEMATIQUES';
          const href = subject === 'MATHEMATIQUES'
            ? '/dashboard/eleve/programme/maths'
            : `/dashboard/eleve/programme/${String(subject).toLowerCase()}`;

          return (
            <Card key={`${subject}-${item.skillGraphRef}`} className="border-white/10 bg-surface-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <BookOpen className="h-4 w-4 text-brand-accent" aria-hidden="true" />
                  {String(subject).replaceAll('_', ' ')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-neutral-400">Skill graph</p>
                  <p className="font-mono text-xs text-neutral-200">{item.skillGraphRef}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-neutral-400">XP</p>
                    <p className="text-lg font-semibold text-white">{item.progress.totalXp}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-neutral-400">Chapitres</p>
                    <p className="text-lg font-semibold text-white">{item.progress.completedChapters.length}</p>
                  </div>
                </div>
                {!readOnly && (
                  <Button asChild className="w-full">
                    <Link href={href}>
                      Ouvrir
                      <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
