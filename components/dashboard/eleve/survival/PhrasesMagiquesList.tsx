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
        <h2 id="survival-phrases-title" className="text-xl font-semibold text-white">
          8 phrases magiques
        </h2>
        <p className="text-sm text-neutral-400">A recopier telles quelles, avec les trous a completer.</p>
      </div>
      <div className="grid gap-3">
        {PHRASES_MAGIQUES.map((phrase) => (
          <PhraseMagiqueCard key={phrase.id} phrase={phrase} copiedCount={progress.phrasesState[phrase.id] ?? 0} />
        ))}
      </div>
    </section>
  );
}
