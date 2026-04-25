import { PHRASES_MAGIQUES } from '@/lib/survival/phrases';
import type { SurvivalProgressSnapshot } from '@/lib/survival/types';
import { PhraseMagiqueCard } from './PhraseMagiqueCard';

type PhrasesMagiquesListProps = {
  progress: SurvivalProgressSnapshot;
};

export function PhrasesMagiquesList({ progress }: PhrasesMagiquesListProps) {
  return (
    <section aria-labelledby="survival-phrases-title" className="space-y-4">
      <div>
        <h2 id="survival-phrases-title" className="font-fraunces text-xl font-semibold text-eaf-text-primary">
          8 phrases magiques
        </h2>
        <p className="text-sm text-eaf-text-tertiary">À recopier telles quelles, avec les trous à compléter.</p>
      </div>
      <div className="grid gap-3">
        {PHRASES_MAGIQUES.map((phrase) => (
          <PhraseMagiqueCard key={phrase.id} phrase={phrase} copiedCount={progress.phrasesState[phrase.id] ?? 0} />
        ))}
      </div>
    </section>
  );
}
