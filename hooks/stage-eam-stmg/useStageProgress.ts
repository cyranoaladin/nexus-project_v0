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

interface ProgrammeProgressPayload {
  completed_chapters: string[];
  mastered_chapters: string[];
  total_xp: number;
  quiz_score: number;
  combo_count: number;
  best_combo: number;
  streak: number;
  streak_freezes: number;
  last_activity_date: string | null;
  daily_challenge: Record<string, unknown>;
  exercise_results: Record<string, number[]>;
  hint_usage: Record<string, number>;
  badges: string[];
  srs_queue: Record<string, unknown>;
  diagnostic_results?: Record<string, unknown>;
  time_per_chapter?: Record<string, number>;
  formulaire_viewed?: boolean;
  grand_oral_seen?: number;
  lab_archimede_opened?: boolean;
  euler_max_steps?: number;
  newton_best_iterations?: number | null;
  printed_fiche?: boolean;
}

const domainIds: DomainId[] = ["fonctions", "derivation", "suites", "statistiques", "probabilites", "algorithmique-tableur"];

function emptyValidatedNotions(): Record<DomainId, string[]> {
  return {
    fonctions: [],
    derivation: [],
    suites: [],
    statistiques: [],
    probabilites: [],
    "algorithmique-tableur": [],
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

export function createEmptyProgrammeProgress(): ProgrammeProgressPayload {
  return {
    completed_chapters: [],
    mastered_chapters: [],
    total_xp: 0,
    quiz_score: 0,
    combo_count: 0,
    best_combo: 0,
    streak: 0,
    streak_freezes: 0,
    last_activity_date: null,
    daily_challenge: {},
    exercise_results: {},
    hint_usage: {},
    badges: [],
    srs_queue: {},
    diagnostic_results: {},
    time_per_chapter: {},
    formulaire_viewed: false,
    grand_oral_seen: 0,
    lab_archimede_opened: false,
    euler_max_steps: 0,
    newton_best_iterations: null,
    printed_fiche: false,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function extractStageStateFromProgrammeProgress(raw: unknown, eleveId: string): StageProgressState | null {
  const data = asRecord(raw);
  const diagnostics = asRecord(data.diagnostic_results);
  const stage = diagnostics.stage_eam_stmg;
  if (!stage || typeof stage !== "object") return null;
  return parseStageState(JSON.stringify(stage), eleveId);
}

export function mergeStageStateIntoProgrammeProgress(raw: unknown, stageState: StageProgressState): ProgrammeProgressPayload {
  const current = { ...createEmptyProgrammeProgress(), ...asRecord(raw) } as ProgrammeProgressPayload;
  return {
    ...current,
    diagnostic_results: {
      ...asRecord(current.diagnostic_results),
      stage_eam_stmg: stageState,
    },
  };
}

export function useStageProgress(eleveId: string) {
  const [state, setState] = useState<StageProgressState>(() => createInitialStageState(eleveId));
  const [hydrated, setHydrated] = useState(false);
  const serverPayloadRef = useRef<unknown>(null);
  const loadedServerRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadedServerRef.current = false;
    const localState = parseStageState(window.localStorage.getItem(storageKey(eleveId)), eleveId);
    setState(localState);
    setHydrated(true);

    fetch("/api/programme/maths-1ere-stmg/progress")
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (cancelled || !payload?.data) return;
        serverPayloadRef.current = payload.data;
        const serverStageState = extractStageStateFromProgrammeProgress(payload.data, eleveId);
        if (serverStageState && serverStageState.updatedAt >= localState.updatedAt) {
          setState(serverStageState);
          window.localStorage.setItem(storageKey(eleveId), JSON.stringify(serverStageState));
        }
      })
      .catch(() => {
        // Local cache remains the immediate fallback if server progress is unavailable.
      })
      .finally(() => {
        loadedServerRef.current = true;
      });

    return () => {
      cancelled = true;
    };
  }, [eleveId]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey(eleveId), JSON.stringify(state));
    if (!loadedServerRef.current) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      const payload = mergeStageStateIntoProgrammeProgress(serverPayloadRef.current, state);
      serverPayloadRef.current = payload;
      void fetch("/api/programme/maths-1ere-stmg/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => undefined);
    }, 700);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
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
