import { REFLEXES } from '@/lib/survival/reflexes';
import type { SurvivalProgressSnapshot } from '@/lib/survival/types';
import { ReflexCard } from './ReflexCard';

type ReflexesCoffreListProps = {
  progress: SurvivalProgressSnapshot;
  onOpenReflex?: (id: string) => void;
};

export function ReflexesCoffreList({ progress, onOpenReflex }: ReflexesCoffreListProps) {
  return (
    <section aria-labelledby="survival-reflexes-title" className="space-y-4">
      <div>
        <h2 id="survival-reflexes-title" className="text-xl font-semibold text-white">
          Coffre des 7 reflexes
        </h2>
        <p className="text-sm text-neutral-400">Une carte. Trois questions. Un point a grappiller.</p>
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
