import { ArrowRight, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function PreRentreeAssessmentCard() {
  return (
    <Card className="border-brand-accent/30 bg-gradient-to-r from-brand-accent/15 to-surface-card shadow-premium">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="mt-0.5 h-6 w-6 shrink-0 text-brand-accent" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-bold text-white">Bilan de pré-rentrée</h2>
            <p className="mt-1 text-sm leading-6 text-neutral-300">
              Choisis d’abord la matière, puis réponds au questionnaire à ton rythme.
            </p>
          </div>
        </div>
        <Link href="/bilan-gratuit/assessment" className="shrink-0">
          <Button className="w-full bg-brand-accent text-surface-darker sm:w-auto">
            Passer le bilan de pré-rentrée
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
