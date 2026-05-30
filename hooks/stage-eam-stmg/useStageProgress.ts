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
  retryQueue: string[];
  sessionChecklist: Record<string, boolean>;
  mockExam: {
    qcmAnswers: Record<string, number>;
    qcmScore: number;
    part2Score: number;
    submitted: boolean;
    updatedAt: string | null;
  };
  settings: {
    countdownEnabled: boolean;
    gamificationEnabled: boolean;
  };
  updatedAt: string;
}

type ServerSyncStatus = "pending" | "ok" | "failed";

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
    retryQueue: [],
    sessionChecklist: {},
    mockExam: { qcmAnswers: {}, qcmScore: 0, part2Score: 0, submitted: false, updatedAt: null },
    settings: { countdownEnabled: true, gamificationEnabled: true },
    updatedAt: new Date().toISOString(),
  };
}

export function parseStageState(raw: string | null, eleveId: string): StageProgressState {
  if (!raw) return createInitialStageState(eleveId);
  try {
    const parsed = JSON.parse(raw) as Partial<StageProgressState>;
    const validatedNotions = { ...emptyValidatedNotions(), ...(parsed.validatedNotions ?? {}) };
    const legacyAlgorithmique = (parsed.validatedNotions as Record<string, string[]> | undefined)?.["algorithmique-information"];
    if (Array.isArray(legacyAlgorithmique) && validatedNotions["algorithmique-tableur"].length === 0) {
      validatedNotions["algorithmique-tableur"] = legacyAlgorithmique;
    }
    return {
      ...createInitialStageState(eleveId),
      ...parsed,
      eleveId,
      diagnosticAnswers: parsed.diagnosticAnswers ?? { qcm: {}, exercises: {} },
      validatedNotions,
      retryQueue: Array.isArray(parsed.retryQueue) ? parsed.retryQueue : [],
      sessionChecklist: { ...(parsed.sessionChecklist ?? {}) },
      mockExam: {
        qcmAnswers: {},
        qcmScore: 0,
        part2Score: 0,
        submitted: false,
        updatedAt: null,
        ...(parsed.mockExam ?? {}),
      },
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
  const [serverSyncStatus, setServerSyncStatus] = useState<ServerSyncStatus>("pending");
  const serverSyncStatusRef = useRef<ServerSyncStatus>("pending");
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    serverSyncStatusRef.current = "pending";
    setServerSyncStatus("pending");
    const localState = parseStageState(window.localStorage.getItem(storageKey(eleveId)), eleveId);
    setState(localState);
    setHydrated(true);

    fetch("/api/programme/maths-1ere-stmg/stage-progress")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("stage-progress-load-failed")))
      .then((payload) => {
        if (cancelled || payload?.ok !== true) return;
        serverSyncStatusRef.current = "ok";
        setServerSyncStatus("ok");
        const serverStageState = payload.data ? parseStageState(JSON.stringify(payload.data), eleveId) : null;
        if (serverStageState && serverStageState.updatedAt >= localState.updatedAt) {
          setState(serverStageState);
          window.localStorage.setItem(storageKey(eleveId), JSON.stringify(serverStageState));
        }
      })
      .catch(() => {
        if (cancelled) return;
        serverSyncStatusRef.current = "failed";
        setServerSyncStatus("failed");
      });

    return () => {
      cancelled = true;
    };
  }, [eleveId]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey(eleveId), JSON.stringify(state));
    if (serverSyncStatusRef.current !== "ok") return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void fetch("/api/programme/maths-1ere-stmg/stage-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
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

  const addRetryItems = useCallback((itemIds: string[]) => {
    update((current) => ({
      ...current,
      retryQueue: [...itemIds, ...current.retryQueue.filter((id) => !itemIds.includes(id))].slice(0, 36),
    }));
  }, [update]);

  const clearRetryItem = useCallback((itemId: string) => {
    update((current) => ({
      ...current,
      retryQueue: current.retryQueue.filter((id) => id !== itemId),
    }));
  }, [update]);

  const toggleSessionItem = useCallback((itemId: string) => {
    update((current) => ({
      ...current,
      sessionChecklist: {
        ...current.sessionChecklist,
        [itemId]: !current.sessionChecklist[itemId],
      },
    }));
  }, [update]);

  const saveMockExam = useCallback((qcmAnswers: Record<string, number>, qcmScore: number, part2Score: number) => {
    update((current) => ({
      ...current,
      mockExam: {
        qcmAnswers,
        qcmScore,
        part2Score,
        submitted: true,
        updatedAt: new Date().toISOString(),
      },
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
    serverSyncStatus,
    state,
    planning,
    saveDiagnostic,
    toggleNotion,
    addAutomatismRun,
    addRetryItems,
    clearRetryItem,
    toggleSessionItem,
    saveMockExam,
    setSetting,
    exportJson,
    importJson,
    reset,
  };
}
