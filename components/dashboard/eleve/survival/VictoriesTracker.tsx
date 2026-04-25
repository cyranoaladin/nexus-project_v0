import type { SurvivalProgressSnapshot } from '@/lib/survival/types';
import { REFLEXES } from '@/lib/survival/reflexes';

type VictoriesTrackerProps = {
  progress: SurvivalProgressSnapshot;
};

export function VictoriesTracker({ progress }: VictoriesTrackerProps) {
  const acquired = REFLEXES.filter((reflex) => progress.reflexesState[reflex.id] === 'ACQUIS').length;
  const phrasesReady = Object.values(progress.phrasesState).filter((count) => count >= 3).length;

  return (
    <section className="rounded-lg border border-white/10 bg-surface-card p-4" aria-labelledby="survival-victories-title">
      <h2 id="survival-victories-title" className="text-lg font-semibold text-white">Mes victoires</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-success/30 bg-success/10 p-3">
          <p className="text-sm text-neutral-200">Reflexes acquis</p>
          <p className="mt-1 text-2xl font-semibold text-white">{acquired} / 7</p>
        </div>
        <div className="rounded-lg border border-brand-accent/30 bg-brand-accent/10 p-3">
          <p className="text-sm text-neutral-200">Phrases pretes</p>
          <p className="mt-1 text-2xl font-semibold text-white">{phrasesReady} / 8</p>
        </div>
      </div>
    </section>
  );
}
