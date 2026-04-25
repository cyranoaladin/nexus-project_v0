import { computeScoreProjection } from '@/lib/survival/score-simulator';
import type { SurvivalProgressSnapshot } from '@/lib/survival/types';

type ScoreSimulatorProps = {
  progress: SurvivalProgressSnapshot;
  examDate: Date;
};

export function ScoreSimulator({ progress, examDate }: ScoreSimulatorProps) {
  const daysLeft = Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  const projection = computeScoreProjection(progress, daysLeft);

  return (
    <section className="rounded-lg border border-white/10 bg-surface-card p-4" aria-label="Simulation de score">
      <div className="space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-neutral-300">Note potentielle aujourd'hui</span>
          <strong className="text-white">{projection.today} / 20</strong>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-neutral-300">Note realiste dans {daysLeft} j</span>
          <strong className="text-white">{projection.realistic} / 20</strong>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-neutral-300">Note possible avec effort restant</span>
          <strong className="text-white">{projection.possible} / 20</strong>
        </div>
      </div>
    </section>
  );
}
