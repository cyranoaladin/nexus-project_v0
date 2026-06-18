"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildAdaptivePlanning, getDefaultProfile } from "@/content/stage-eam-stmg/core";
import type { DiagnosticAnswers, DiagnosticProfile, DomainId } from "@/content/stage-eam-stmg/types";

export interface AutomatismRun {
  id: string;
  date: string;
  domainId: DomainId;
  score: number;
  total: number;
  averageSeconds: number;
}

export interface StageProgressState {
  eleveId: string;
  diagnosticAnswers: DiagnosticAnswers;
  profile: DiagnosticProfile;
  validatedNotions: Record<DomainId, string[]>;
  automatismHistory: AutomatismRun[];
  settings: {
    countdownEnabled: boolean;
    gamificationEnabled: boolean;
  };
  updatedAt: string;
}

const domainIds: DomainId[] = ["fonctions", "suites", "statistiques", "probabilites", "algorithmique-information"];

function emptyValidatedNotions(): Record<DomainId, string[]> {
  return {
    fonctions: [],
    suites: [],
    statistiques: [],
    probabilites: [],
    "algorithmique-information": [],
  };
}

export function storageKey(eleveId: string) {
  return `nexus:stage-eam-stmg:${eleveId}`;
}

export function createInitialStageState(eleveId: string): StageProgressState {
  return {
    eleveId,
    diagnosticAnswers: { qcm: {}, exercises: {} },
    profile: getDefaultProfile(),
    validatedNotions: emptyValidatedNotions(),
    automatismHistory: [],
    settings: { countdownEnabled: true, gamificationEnabled: true },
    updatedAt: new Date().toISOString(),
  };
}

export function parseStageState(raw: string | null, eleveId: string): StageProgressState {
  if (!raw) return createInitialStageState(eleveId);
  try {
    const parsed = JSON.parse(raw) as Partial<StageProgressState>;
    return {
      ...createInitialStageState(eleveId),
      ...parsed,
      eleveId,
      diagnosticAnswers: parsed.diagnosticAnswers ?? { qcm: {}, exercises: {} },
      validatedNotions: { ...emptyValidatedNotions(), ...(parsed.validatedNotions ?? {}) },
      settings: { countdownEnabled: true, gamificationEnabled: true, ...(parsed.settings ?? {}) },
    };
  } catch {
    return createInitialStageState(eleveId);
  }
}

export function serializeStageState(state: StageProgressState): string {
  return JSON.stringify(state, null, 2);
}

export function useStageProgress(eleveId: string) {
  const [state, setState] = useState<StageProgressState>(() => createInitialStageState(eleveId));
  const [hydrated, setHydrated] = useState(false);
  const suppressPersistRef = useRef(false);

  useEffect(() => {
    setState(parseStageState(window.localStorage.getItem(storageKey(eleveId)), eleveId));
    setHydrated(true);
  }, [eleveId]);

  useEffect(() => {
    if (!hydrated) return;
    if (suppressPersistRef.current) {
      suppressPersistRef.current = false;
      return;
    }
    window.localStorage.setItem(storageKey(eleveId), JSON.stringify(state));
  }, [eleveId, hydrated, state]);

  const update = useCallback((updater: (current: StageProgressState) => StageProgressState) => {
    setState((current) => ({ ...updater(current), updatedAt: new Date().toISOString() }));
  }, []);

  const saveDiagnostic = useCallback((answers: DiagnosticAnswers, profile: DiagnosticProfile) => {
    update((current) => ({ ...current, diagnosticAnswers: answers, profile }));
  }, [update]);

  const toggleNotion = useCallback((domainId: DomainId, notion: string) => {
    update((current) => {
      const existing = current.validatedNotions[domainId] ?? [];
      const next = existing.includes(notion) ? existing.filter((item) => item !== notion) : [...existing, notion];
      return { ...current, validatedNotions: { ...current.validatedNotions, [domainId]: next } };
    });
  }, [update]);

  const addAutomatismRun = useCallback((run: Omit<AutomatismRun, "id" | "date">) => {
    update((current) => ({
      ...current,
      automatismHistory: [
        { ...run, id: `run-${Date.now()}`, date: new Date().toISOString() },
        ...current.automatismHistory,
      ].slice(0, 20),
    }));
  }, [update]);

  const setSetting = useCallback((key: keyof StageProgressState["settings"], value: boolean) => {
    update((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  }, [update]);

  const exportJson = useCallback(() => serializeStageState(state), [state]);

  const importJson = useCallback((raw: string) => {
    const parsed = parseStageState(raw, eleveId);
    setState({ ...parsed, updatedAt: new Date().toISOString() });
  }, [eleveId]);

  const reset = useCallback(() => {
    const next = createInitialStageState(eleveId);
    suppressPersistRef.current = true;
    setState(next);
    window.localStorage.removeItem(storageKey(eleveId));
  }, [eleveId]);

  const planning = useMemo(() => buildAdaptivePlanning(state.profile.priorities), [state.profile.priorities]);

  return {
    hydrated,
    state,
    planning,
    saveDiagnostic,
    toggleNotion,
    addAutomatismRun,
    setSetting,
    exportJson,
    importJson,
    reset,
  };
}
