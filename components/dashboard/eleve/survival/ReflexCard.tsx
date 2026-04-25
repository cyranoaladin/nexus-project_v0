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
    <Card className="border-white/10 bg-surface-card">
      <CardHeader className="space-y-3">
        <div className={`w-fit rounded-full border px-3 py-1 text-xs ${survivalStatusClass(state)}`}>
          <span aria-hidden="true">{survivalStatusIcon(state)}</span> {survivalStatusLabel(state)}
        </div>
        <CardTitle className="text-base text-white">
          {reflex.order}. {reflex.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-neutral-300">{reflex.hook}</p>
        <Button type="button" variant="outline" className="min-h-11 w-full border-brand-accent/30 text-brand-accent" onClick={() => onOpen?.(reflex.id)}>
          Ouvrir le reflexe
        </Button>
      </CardContent>
    </Card>
  );
}
