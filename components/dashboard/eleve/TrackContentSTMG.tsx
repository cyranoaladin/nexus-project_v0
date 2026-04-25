'use client';

import Link from 'next/link';
import { ArrowRight, Calculator, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { EleveTrackItem } from './types';

type TrackContentSTMGProps = {
  modules: EleveTrackItem[];
  eafUrl?: string;
  readOnly?: boolean;
};

export function TrackContentSTMG({
  modules,
  eafUrl = process.env.NEXT_PUBLIC_EAF_DEEP_LINK_BASE_URL ?? 'https://eaf.nexusreussite.academy',
  readOnly = false,
}: TrackContentSTMGProps) {
  return (
    <section id="programme-stmg" aria-labelledby="stmg-track-title" className="space-y-4">
      <div>
        <h2 id="stmg-track-title" className="text-xl font-semibold text-neutral-100">
          Programme Première STMG
        </h2>
        <p className="text-sm text-neutral-400">Modules distincts du parcours EDS.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {modules.map((item) => {
          const moduleKey = item.module ?? item.skillGraphRef;
          const href = moduleKey === 'MATHS_STMG'
            ? '/dashboard/eleve/programme/maths'
            : `/dashboard/eleve/programme/${moduleKey.toLowerCase()}`;

          return (
            <Card key={`${moduleKey}-${item.skillGraphRef}`} className="border-white/10 bg-surface-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Calculator className="h-4 w-4 text-brand-accent" aria-hidden="true" />
                  {item.label ?? moduleKey.replaceAll('_', ' ')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="font-mono text-xs text-neutral-300">{item.skillGraphRef}</p>
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

        <Card className="border-white/10 bg-surface-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <ExternalLink className="h-4 w-4 text-brand-accent" aria-hidden="true" />
              Français EAF
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-neutral-400">Préparation EAF sur la plateforme soeur Nexus.</p>
            {!readOnly && (
              <Button asChild variant="outline" className="w-full border-brand-accent/30 text-brand-accent">
                <Link href={eafUrl}>
                  Accéder
                  <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
