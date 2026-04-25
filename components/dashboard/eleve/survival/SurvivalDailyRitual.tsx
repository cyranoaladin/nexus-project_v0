import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SurvivalRitual } from '@/lib/survival/types';

type SurvivalDailyRitualProps = {
  ritual: SurvivalRitual;
  onStart?: (targetId: string) => void;
};

export function SurvivalDailyRitual({ ritual, onStart }: SurvivalDailyRitualProps) {
  return (
    <Card className="border-eaf-indigo/20 bg-eaf-hero-gradient">
      <CardHeader>
        <CardTitle className="font-fraunces text-lg text-eaf-text-primary">Rituel du jour</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-semibold text-eaf-text-primary">{ritual.title}</p>
          <p className="mt-1 text-sm text-eaf-text-secondary">{ritual.description}</p>
          <div className="mt-3 flex items-center gap-2 text-sm text-eaf-orange">
            <Clock className="h-4 w-4" aria-hidden="true" />
            {ritual.durationMinutes} minutes
          </div>
        </div>
        <Button type="button" className="min-h-11 bg-eaf-orange text-eaf-text-primary" onClick={() => onStart?.(ritual.targetId)}>
          Commencer maintenant
        </Button>
      </CardContent>
    </Card>
  );
}
