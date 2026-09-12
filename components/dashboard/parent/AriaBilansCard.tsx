'use client';

/**
 * Parent-facing real ARIA periodic bilans (P7b-2) — mirrors
 * `AriaWorkshopsCard.tsx`'s own self-fetching pattern exactly: nothing
 * shown until the child has a real, published ARIA_PERIODIC bilan.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AriaPeriodicBilanForParent {
  readonly id: string;
  readonly subject: string;
  readonly globalScore: number | null;
  readonly publishedAt: string;
}

export function AriaBilansCard({ studentId }: Readonly<{ studentId: string }>) {
  const [bilans, setBilans] = useState<readonly AriaPeriodicBilanForParent[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/parent/children/${encodeURIComponent(studentId)}/aria/bilans`);
      if (!response.ok) throw new Error('load failed');
      const body = (await response.json()) as { bilans: readonly AriaPeriodicBilanForParent[] };
      setBilans(body.bilans);
    } catch {
      setBilans(null);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Card className="bg-surface-card border-white/10 shadow-premium">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-brand-accent" aria-label="Chargement" />
        </CardContent>
      </Card>
    );
  }

  if (!bilans || bilans.length === 0) return null;

  return (
    <Card className="bg-surface-card border-white/10 shadow-premium" data-testid="aria-bilans-card">
      <CardHeader>
        <CardTitle className="text-white text-base flex items-center gap-2">
          <FileText className="w-4 h-4 text-brand-accent" aria-hidden="true" />
          Bilans ARIA périodiques
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {bilans.map((bilan) => (
            <li key={bilan.id}>
              <Link
                href={`/dashboard/parent/bilans/${bilan.id}`}
                data-testid="aria-bilan-card-item"
                className="flex items-center justify-between gap-2 rounded-micro border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-neutral-300 transition-colors hover:border-brand-accent/40"
              >
                <span>
                  Bilan ARIA — {new Date(bilan.publishedAt).toLocaleDateString('fr-FR')}
                </span>
                {bilan.globalScore !== null && (
                  <span className="shrink-0 rounded-micro bg-brand-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-brand-accent">
                    {bilan.globalScore}/100
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
