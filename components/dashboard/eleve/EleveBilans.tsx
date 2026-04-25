'use client';

import { ExternalLink, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EleveBilan } from './types';

type EleveBilansProps = {
  recentBilans: EleveBilan[];
  lastBilan: EleveBilan | null;
};

const TRUST_BADGE: Record<'high' | 'medium' | 'low', { label: string; className: string }> = {
  high:   { label: 'Fiable',  className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' },
  medium: { label: 'Moyen',   className: 'bg-amber-500/15 text-amber-300 border-amber-500/20' },
  low:    { label: 'Partiel', className: 'bg-rose-500/15 text-rose-300 border-rose-500/20' },
};

function BilanCard({ bilan }: { bilan: EleveBilan }) {
  const trust = bilan.trustLevel ? TRUST_BADGE[bilan.trustLevel] : null;

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-100">{bilan.subjectLabel}</p>
          <p className="text-xs text-neutral-500">
            {new Date(bilan.createdAt).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {trust && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${trust.className}`}
            >
              {trust.label}
            </span>
          )}
          {bilan.globalScore != null && (
            <span className="text-sm font-semibold text-white">
              {bilan.globalScore}%
            </span>
          )}
        </div>
      </div>

      {bilan.topPriorities.length > 0 && (
        <ul className="space-y-1" role="list" aria-label="Priorités">
          {bilan.topPriorities.map((p, i) => (
            <li key={i} className="flex items-center gap-2 text-xs text-neutral-400">
              <span
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-accent"
                aria-hidden="true"
              />
              {p}
            </li>
          ))}
        </ul>
      )}

      <a
        href={bilan.resultUrl}
        className="mt-1 inline-flex items-center gap-1 text-xs text-brand-accent hover:underline"
        aria-label={`Voir le bilan ${bilan.subjectLabel}`}
      >
        Voir le bilan
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
    </article>
  );
}

export function EleveBilans({ recentBilans, lastBilan }: EleveBilansProps) {
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
          {recentBilans.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <FileText className="h-10 w-10 text-neutral-500" aria-hidden="true" />
              <p className="text-sm text-neutral-400">
                Aucun bilan disponible pour le moment.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {lastBilan && recentBilans.length > 1 && (
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Dernier bilan
                </p>
              )}
              {lastBilan && <BilanCard bilan={lastBilan} />}
              {recentBilans.length > 1 && (
                <>
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Historique
                  </p>
                  <div className="space-y-2">
                    {recentBilans.filter((b) => b.id !== lastBilan?.id).map((b) => (
                      <BilanCard key={b.id} bilan={b} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
