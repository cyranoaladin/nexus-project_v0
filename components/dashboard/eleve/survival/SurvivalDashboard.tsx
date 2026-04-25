'use client';

import { useMemo, useState } from 'react';
import { REFLEXES, getReflex } from '@/lib/survival/reflexes';
import { DEFAULT_EXAM_DATE, snapshotFromStoredProgress, type StoredSurvivalProgress } from '@/lib/survival/progress';
import { chooseDailyRitual } from '@/lib/survival/ritual-engine';
import { computeNotePotentielle } from '@/lib/survival/score-simulator';
import type { SurvivalProgressSnapshot } from '@/lib/survival/types';
import { SurvivalHeroBanner } from './SurvivalHeroBanner';
import { SurvivalDailyRitual } from './SurvivalDailyRitual';
import { ReflexesCoffreList } from './ReflexesCoffreList';
import { ReflexPracticeWorkspace } from './ReflexPracticeWorkspace';
import { QcmTrainerWorkspace } from './QcmTrainerWorkspace';
import { PhrasesMagiquesList } from './PhrasesMagiquesList';
import { VictoriesTracker } from './VictoriesTracker';
import { GoldenRuleBanner } from './GoldenRuleBanner';
import { ScoreSimulator } from './ScoreSimulator';

type SurvivalDashboardProps = {
  progress?: StoredSurvivalProgress | null;
};

export function SurvivalDashboard({ progress }: SurvivalDashboardProps) {
  const snapshot = useMemo<SurvivalProgressSnapshot>(() => snapshotFromStoredProgress(progress), [progress]);
  const examDate = useMemo(() => new Date(progress?.examDate ?? DEFAULT_EXAM_DATE), [progress?.examDate]);
  const ritual = useMemo(() => chooseDailyRitual(snapshot, new Date(), examDate), [snapshot, examDate]);
  const [activeReflexId, setActiveReflexId] = useState<string>(ritual.targetId.startsWith('reflex_') ? ritual.targetId : REFLEXES[0].id);
  const activeReflex = getReflex(activeReflexId) ?? REFLEXES[0];

  return (
    <section className="space-y-6" aria-label="Mode Survie STMG">
      <SurvivalHeroBanner examDate={examDate} noteToday={computeNotePotentielle(snapshot)} />
      <SurvivalDailyRitual ritual={ritual} onStart={(targetId) => targetId.startsWith('reflex_') && setActiveReflexId(targetId)} />

      <div className="grid gap-6 xl:grid-cols-[minmax(220px,0.85fr)_minmax(0,1.5fr)_minmax(260px,0.9fr)]">
        <ReflexesCoffreList progress={snapshot} onOpenReflex={setActiveReflexId} />
        <section aria-label="Zone d entrainement" className="space-y-4">
          <ReflexPracticeWorkspace reflex={activeReflex} />
          <QcmTrainerWorkspace />
        </section>
        <PhrasesMagiquesList progress={snapshot} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <VictoriesTracker progress={snapshot} />
        <ScoreSimulator progress={snapshot} examDate={examDate} />
        <GoldenRuleBanner />
      </div>
    </section>
  );
}
