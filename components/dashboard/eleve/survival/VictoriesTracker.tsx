import type { SurvivalProgressSnapshot } from '@/lib/survival/types';
import { REFLEXES } from '@/lib/survival/reflex-data';

type VictoriesTrackerProps = {
  progress: SurvivalProgressSnapshot;
};

export function VictoriesTracker({ progress }: VictoriesTrackerProps) {
  const acquired = REFLEXES.filter((reflex) => progress.reflexesState[reflex.id] === 'ACQUIS').length;
  const phrasesReady = Object.values(progress.phrasesState).filter((count) => count >= 3).length;

  return (
    <section className="rounded-lg border border-eaf-indigo/20 bg-eaf-hero-gradient p-4" aria-labelledby="survival-victories-title">
      <h2 id="survival-victories-title" className="font-fraunces text-lg font-semibold text-eaf-text-primary">Mes victoires</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-eaf-teal/30 bg-eaf-teal/10 p-3">
          <p className="text-sm text-eaf-text-secondary">Réflexes acquis</p>
          <p className="mt-1 font-fraunces text-2xl font-semibold text-eaf-text-primary">{acquired} / 7</p>
        </div>
        <div className="rounded-lg border border-eaf-indigo/30 bg-eaf-indigo/10 p-3">
          <p className="text-sm text-eaf-text-secondary">Phrases prêtes</p>
          <p className="mt-1 font-fraunces text-2xl font-semibold text-eaf-text-primary">{phrasesReady} / 8</p>
        </div>
      </div>
    </section>
  );
}
