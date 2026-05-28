"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { MODULES } from "@/components/EAMPrep/data";
import {
  calculateProgressPercent,
  createEmptyEAMProgress,
  mergeProgressByLastUpdated,
  normalizeProgress,
  type EAMProgressData,
} from "./eamProgressCore";

const STORAGE_PREFIX = "nexus_eam_progress_";
const ANON_STORAGE_KEY = "nexus_eam_progress_anonymous";

function getStorageKey(userId?: string) {
  return userId ? `${STORAGE_PREFIX}${userId}` : ANON_STORAGE_KEY;
}

function readLocalProgress(key: string): EAMProgressData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? normalizeProgress(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeLocalProgress(key: string, data: EAMProgressData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Offline/local quota failures must never block the dashboard.
  }
}

export function useEAMProgress() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const storageKey = useMemo(() => getStorageKey(userId), [userId]);
  const [state, setState] = useState<EAMProgressData>(() => createEmptyEAMProgress());
  const mountedRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);
  const pendingSyncRef = useRef<EAMProgressData | null>(null);

  const totalItems = useMemo(() => MODULES.reduce((sum, module) => sum + module.checklist.length, 0), []);
  const totalChecked = useMemo(() => Object.values(state.checks).filter(Boolean).length, [state.checks]);
  const quizDone = useMemo(() => Object.values(state.quiz).filter((result) => result.done).length, [state.quiz]);
  const pct = calculateProgressPercent(totalChecked, totalItems);

  const syncToAPI = useCallback((next: EAMProgressData) => {
    pendingSyncRef.current = next;

    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
    }

    syncTimerRef.current = window.setTimeout(() => {
      const payload = pendingSyncRef.current;
      pendingSyncRef.current = null;
      syncTimerRef.current = null;
      if (!payload) return;

      void fetch("/api/eam/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => undefined);
    }, 600);
  }, []);

  const persist = useCallback(
    (next: EAMProgressData) => {
      writeLocalProgress(storageKey, next);
      syncToAPI(next);
    },
    [storageKey, syncToAPI]
  );

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    mountedRef.current = false;
    const local = readLocalProgress(storageKey);
    setState(local ?? createEmptyEAMProgress());

    let cancelled = false;
    fetch("/api/eam/progress")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (cancelled) return;
        const remoteRaw = payload && typeof payload === "object" && "data" in payload ? (payload as { data: unknown }).data : null;
        const remote = remoteRaw ? normalizeProgress(remoteRaw) : null;
        const merged = mergeProgressByLastUpdated(local, remote);
        setState(merged);
        writeLocalProgress(storageKey, merged);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) mountedRef.current = true;
      });

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const commit = useCallback(
    (updater: (current: EAMProgressData) => EAMProgressData) => {
      setState((current) => {
        const next = updater(current);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const toggleCheck = useCallback(
    (key: string) => {
      commit((current) => ({
        ...current,
        checks: { ...current.checks, [key]: !current.checks[key] },
        lastUpdated: new Date().toISOString(),
      }));
    },
    [commit]
  );

  const saveQuizResult = useCallback(
    (modId: string, score: number, total: number) => {
      commit((current) => ({
        ...current,
        quiz: {
          ...current.quiz,
          [modId]: { score, total, done: true, completedAt: new Date().toISOString() },
        },
        lastUpdated: new Date().toISOString(),
      }));
    },
    [commit]
  );

  const resetModule = useCallback(
    (modId: string) => {
      commit((current) => {
        const checks = Object.fromEntries(Object.entries(current.checks).filter(([key]) => !key.startsWith(`${modId}_`)));
        const quiz = { ...current.quiz };
        delete quiz[modId];
        return { ...current, checks, quiz, lastUpdated: new Date().toISOString() };
      });
    },
    [commit]
  );

  const getModuleProgress = useCallback(
    (modId: string) => {
      const module = MODULES.find((item) => item.id === modId);
      const total = module?.checklist.length ?? 0;
      const checked = Object.entries(state.checks).filter(([key, value]) => key.startsWith(`${modId}_`) && value).length;
      return { checked, total, pct: calculateProgressPercent(checked, total) };
    },
    [state.checks]
  );

  return {
    state,
    totalChecked,
    totalItems,
    pct,
    quizDone,
    lastUpdated: state.lastUpdated,
    isHydrated: mountedRef.current,
    toggleCheck,
    saveQuizResult,
    resetModule,
    getModuleProgress,
  };
}

export type { EAMProgressData };
