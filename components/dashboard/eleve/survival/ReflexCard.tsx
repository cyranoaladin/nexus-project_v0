import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SurvivalReflex, SurvivalState } from '@/lib/survival/types';
import { survivalStatusClass, survivalStatusIcon, survivalStatusLabel } from './status';

type ReflexCardProps = {
  reflex: SurvivalReflex;
  state?: SurvivalState | string;
  onOpen?: (id: string) => void;
};

export function ReflexCard({ reflex, state, onOpen }: ReflexCardProps) {
  return (
    <Card className="border-eaf-indigo/20 bg-eaf-hero-gradient">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className={`w-fit rounded-full border px-3 py-1 text-xs ${survivalStatusClass(state)}`}>
            <span aria-hidden="true">{survivalStatusIcon(state)}</span> {survivalStatusLabel(state)}
          </div>
          <span className="w-fit rounded-full border border-eaf-indigo/30 bg-eaf-indigo/10 px-3 py-1 text-xs text-eaf-text-secondary">
            vaut ~{reflex.qcmPointsCovered.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} pt
          </span>
        </div>
        <CardTitle className="font-fraunces text-base text-eaf-text-primary">
          {reflex.order}. {reflex.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-eaf-text-secondary">{reflex.hook}</p>
        <Button type="button" variant="outline" className="min-h-11 w-full border-eaf-indigo/30 text-eaf-orange" onClick={() => onOpen?.(reflex.id)}>
          Ouvrir la fiche
        </Button>
      </CardContent>
    </Card>
  );
}
