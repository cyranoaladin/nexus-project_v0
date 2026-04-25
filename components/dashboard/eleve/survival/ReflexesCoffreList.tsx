import { REFLEXES } from '@/lib/survival/reflex-data';
import type { SurvivalProgressSnapshot } from '@/lib/survival/types';
import { ReflexCard } from './ReflexCard';

type ReflexesCoffreListProps = {
  progress: SurvivalProgressSnapshot;
  onOpenReflex?: (id: string) => void;
};

export function ReflexesCoffreList({ progress, onOpenReflex }: ReflexesCoffreListProps) {
  return (
    <section aria-labelledby="survival-fiches-title" className="space-y-4">
      <div>
        <h2 id="survival-fiches-title" className="font-fraunces text-xl font-semibold text-eaf-text-primary">
          Coffre des 7 réflexes
        </h2>
        <p className="text-sm text-eaf-text-tertiary">Une carte. Trois questions. Un point à grappiller.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {REFLEXES.map((reflex) => (
          <ReflexCard
            key={reflex.id}
            reflex={reflex}
            state={progress.reflexesState[reflex.id]}
            onOpen={onOpenReflex}
          />
        ))}
      </div>
    </section>
  );
}
