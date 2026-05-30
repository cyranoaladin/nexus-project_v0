import {
  buildAdaptivePlanning,
  computeDiagnosticProfile,
  getDomainPriorities,
} from "@/content/stage-eam-stmg/core";
import type { DiagnosticAnswers } from "@/content/stage-eam-stmg/types";

describe("stage EAM STMG core", () => {
  const answers: DiagnosticAnswers = {
    qcm: {
      "fon-q1": 0,
      "fon-q2": 1,
      "sui-q1": 0,
      "sta-q1": 2,
      "pro-q1": 1,
      "alg-q1": 0,
    },
    exercises: {
      "ex-fon": "partial",
      "ex-sui": "not_acquired",
      "ex-sta-pro": "acquired",
      "ex-alg": "partial",
    },
  };

  it("computes a score for each STMG domain", () => {
    const profile = computeDiagnosticProfile(answers);

    expect(profile.domainScores).toHaveLength(6);
    expect(profile.domainScores.map((entry) => entry.domainId)).toEqual([
      "fonctions",
      "derivation",
      "suites",
      "statistiques",
      "probabilites",
      "algorithmique-tableur",
    ]);
    expect(profile.domainScores.every((entry) => entry.score >= 0 && entry.score <= 100)).toBe(true);
  });

  it("orders priorities from weakest to strongest", () => {
    const priorities = getDomainPriorities({
      fonctions: 75,
      derivation: 60,
      suites: 20,
      statistiques: 95,
      probabilites: 55,
      "algorithmique-tableur": 40,
    });

    expect(priorities.map((entry) => entry.id)).toEqual([
      "suites",
      "algorithmique-tableur",
      "probabilites",
      "derivation",
      "fonctions",
      "statistiques",
    ]);
  });

  it("places the two weakest domains on J1 and J2", () => {
    const planning = buildAdaptivePlanning([
      "suites",
      "probabilites",
      "fonctions",
      "statistiques",
      "algorithmique-tableur",
      "derivation",
    ]);

    expect(planning.find((day) => day.id === "j1")?.domainIds).toContain("suites");
    expect(planning.find((day) => day.id === "j2")?.domainIds).toContain("probabilites");
  });

  it("computes a complete realistic profile from 30 QCM answers and 4 exercises", () => {
    const qcm = Object.fromEntries(
      Array.from({ length: 36 }, (_, index) => [`diag-q${index + 1}`, index % 4])
    );
    const profile = computeDiagnosticProfile(
      {
        qcm,
        exercises: {
          "ex-fon": "partial",
          "ex-sui": "not_acquired",
          "ex-sta-pro": "acquired",
          "ex-alg": "partial",
        },
      },
      "2026-05-30T08:00:00.000Z",
    );

    expect(profile.domainScores).toHaveLength(6);
    expect(profile.domainScores.every((entry) => entry.score >= 0 && entry.score <= 100)).toBe(true);
    expect(profile.priorities).toHaveLength(6);
    expect(new Set(profile.priorities).size).toBe(6);
  });

  it("keeps the STMG taxonomy aligned with the technological EAM perimeter", () => {
    const profile = computeDiagnosticProfile({ qcm: {}, exercises: {} });
    expect(profile.domainScores.map((entry) => entry.domainId)).toEqual([
      "fonctions",
      "derivation",
      "suites",
      "statistiques",
      "probabilites",
      "algorithmique-tableur",
    ]);
  });
});
