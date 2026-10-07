'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { createSaveApi } from '@/lib/espace/client/api';
import { createIdbDraftStore } from '@/lib/espace/client/idb-store';
import { WorkSyncEngine, type ConflictInfo, type SaveState, type Step, type Steps } from '@/lib/espace/client/sync-engine';

interface Options {
  workId: string;
  /** Inclus dans la clé du brouillon : deux élèves sur un même appareil ne se mélangent pas. */
  userId: string;
  initial: { revision: number; steps: Steps; lastSavedAt: string | null; locked: boolean };
}

export function useWorkSync({ workId, userId, initial }: Options) {
  const [state, setState] = useState<SaveState>(initial.locked ? 'locked' : 'saved');
  const [steps, setSteps] = useState<Steps>(initial.steps);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(initial.lastSavedAt ? new Date(initial.lastSavedAt) : null);
  const engineRef = useRef<WorkSyncEngine | null>(null);

  useEffect(() => {
    if (initial.locked) return undefined;
    const engine = new WorkSyncEngine({
      key: `${userId}:${workId}`,
      api: createSaveApi(workId),
      store: createIdbDraftStore(),
      initial: { revision: initial.revision, steps: initial.steps },
      onState: (next) => {
        setState(next);
        if (next === 'saved') setLastSavedAt(new Date());
        setConflict(engine.getConflict());
      },
      onSteps: setSteps,
    });
    engineRef.current = engine;
    void engine.init().then(() => {
      setSteps(engine.getSteps());
      setConflict(engine.getConflict());
    });

    const online = () => engine.notifyOnline();
    const hide = () => {
      if (document.visibilityState === 'hidden') engine.flushNow();
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (engine.hasPending()) {
        engine.flushNow();
        event.preventDefault(); // le navigateur affiche son propre avertissement
      }
    };
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('beforeunload', beforeUnload);
      engine.dispose();
      engineRef.current = null;
    };
    // L'état initial ne sert qu'à la création du moteur : le recréer effacerait la file d'attente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workId, userId]);

  const edit = useCallback((stepId: string, step: Step, meta?: { currentStep?: number; snapshot?: 'STEP_CHANGE' | 'RUN' }) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.edit(stepId, step, meta);
    setSteps(engine.getSteps());
  }, []);

  const resolveConflict = useCallback(async (choice: 'keep-mine' | 'take-theirs') => {
    await engineRef.current?.resolveConflict(choice);
    if (engineRef.current) {
      setSteps(engineRef.current.getSteps());
      setConflict(engineRef.current.getConflict());
    }
  }, []);

  const submit = useCallback(async () => engineRef.current?.submit() ?? { kind: 'failed' as const, message: 'Indisponible' }, []);

  return { state, steps, edit, conflict, resolveConflict, submit, lastSavedAt };
}
