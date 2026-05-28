import {
  calculateProgressPercent,
  createEmptyEAMProgress,
  mergeProgressByLastUpdated,
  normalizeProgress,
} from "@/hooks/eamProgressCore";
import { MODULES } from "@/components/EAMPrep/data";
import fs from "fs";
import path from "path";

const RAW_FORMULA_PATTERNS = [/racine\(/i, /(?<!\\)\bDelta\b/, /->/, /u_\(/, /(?<!\\)\btau\s*=/i, / x /];

describe("EAM progress core", () => {
  it("keeps the most recently updated progress when merging", () => {
    const local = normalizeProgress({
      checks: { auto_0: true },
      quiz: {},
      lastUpdated: "2026-05-28T08:00:00.000Z",
    });
    const remote = normalizeProgress({
      checks: { suites_0: true },
      quiz: {},
      lastUpdated: "2026-05-28T09:00:00.000Z",
    });

    expect(mergeProgressByLastUpdated(local, remote)).toEqual(remote);
  });

  it("calculates a bounded percentage from checked items", () => {
    expect(calculateProgressPercent(0, 10)).toBe(0);
    expect(calculateProgressPercent(3, 10)).toBe(30);
    expect(calculateProgressPercent(10, 10)).toBe(100);
    expect(calculateProgressPercent(12, 10)).toBe(100);
    expect(calculateProgressPercent(1, 0)).toBe(0);
  });

  it("normalizes malformed progress to an empty safe state", () => {
    const normalized = normalizeProgress({ checks: null, quiz: [], lastUpdated: 42 });

    expect(normalized.checks).toEqual({});
    expect(normalized.quiz).toEqual({});
    expect(typeof normalized.lastUpdated).toBe("string");
  });

  it("preserves valid checklist and quiz keys when normalizing", () => {
    const normalized = normalizeProgress({
      checks: { auto_0: true, auto_1: false, bad: "yes" },
      quiz: {
        auto: { score: 4, total: 5, done: true, completedAt: "2026-05-28T08:00:00.000Z" },
        invalid: { score: "4", total: 5, done: true },
      },
      lastUpdated: "2026-05-28T08:00:00.000Z",
    });

    expect(normalized.checks).toEqual({ auto_0: true, auto_1: false });
    expect(normalized.quiz).toEqual({
      auto: { score: 4, total: 5, done: true, completedAt: "2026-05-28T08:00:00.000Z" },
    });
  });

  it("preserves Zeyneb-compatible existing progress keys through normalization and merge", () => {
    const existingRemote = normalizeProgress({
      checks: { auto_0: true, auto_1: true, auto_2: true, auto_6: true },
      quiz: {
        auto: { score: 3, total: 5, done: true, completedAt: "2026-05-28T09:00:00.000Z" },
        suites: { score: 2, total: 5, done: true, completedAt: "2026-05-28T09:05:00.000Z" },
      },
      lastUpdated: "2026-05-28T10:19:56.022Z",
    });
    const olderLocal = normalizeProgress({
      checks: { auto_0: true },
      quiz: {},
      lastUpdated: "2026-05-28T09:19:56.022Z",
    });

    const merged = mergeProgressByLastUpdated(olderLocal, existingRemote);

    expect(merged.checks).toEqual(existingRemote.checks);
    expect(merged.quiz).toEqual(existingRemote.quiz);
  });

  it("keeps the newest source without dropping valid keys", () => {
    const remote = normalizeProgress({
      checks: { auto_0: true, auto_1: true },
      quiz: { auto: { score: 4, total: 5, done: true } },
      lastUpdated: "2026-05-28T10:00:00.000Z",
    });
    const newerLocal = normalizeProgress({
      checks: { auto_0: true, suites_0: true },
      quiz: { suites: { score: 5, total: 5, done: true } },
      lastUpdated: "2026-05-28T11:00:00.000Z",
    });

    expect(mergeProgressByLastUpdated(newerLocal, remote)).toEqual(newerLocal);
    expect(mergeProgressByLastUpdated(remote, newerLocal)).toEqual(newerLocal);
  });

  it("creates an empty progress shape", () => {
    const empty = createEmptyEAMProgress();

    expect(empty.checks).toEqual({});
    expect(empty.quiz).toEqual({});
    expect(Date.parse(empty.lastUpdated)).toBeGreaterThan(0);
  });

  it("uses unique module ids and complete module content", () => {
    const ids = MODULES.map((module) => module.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const module of MODULES) {
      expect(module.formules.length).toBeGreaterThan(0);
      expect(module.methodes.length).toBeGreaterThan(0);
      expect(module.checklist.length).toBeGreaterThan(0);
      expect(module.questions.length).toBeGreaterThan(0);
    }
  });

  it("stores display formulas as LaTeX without raw ASCII placeholders", () => {
    for (const module of MODULES) {
      for (const formula of module.formules) {
        for (const pattern of RAW_FORMULA_PATTERNS) {
          expect(`${module.id}:${formula.title}:${formula.content}`).not.toMatch(pattern);
        }
      }
    }
  });

  it("exposes a dedicated responsive EAM page and responsive math shell classes", () => {
    const root = process.cwd();
    const pagePath = path.join(root, "app/dashboard/eleve/eam/page.tsx");
    const shellSource = fs.readFileSync(path.join(root, "components/EAMPrep/index.tsx"), "utf8");
    const formulaSource = fs.readFileSync(path.join(root, "components/EAMPrep/MathFormula.tsx"), "utf8");
    const dashboardSource = fs.readFileSync(path.join(root, "app/dashboard/eleve/page.tsx"), "utf8");

    expect(fs.existsSync(pagePath)).toBe(true);
    expect(shellSource).toContain("eam-shell");
    expect(formulaSource).toContain("overflow-x-auto");
    expect(dashboardSource).toContain("/dashboard/eleve/eam");
    expect(dashboardSource).not.toContain("{activeRubrique === 'eam' && <EAMPrep />}");
  });
});
