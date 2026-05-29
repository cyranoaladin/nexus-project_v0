import {
  createInitialStageState,
  parseStageState,
  serializeStageState,
} from "@/hooks/stage-eam-stmg/useStageProgress";

describe("stage EAM STMG progress state", () => {
  it("round-trips an exported state through import parsing", () => {
    const initial = createInitialStageState("student-1");
    const changed = {
      ...initial,
      settings: { countdownEnabled: false, gamificationEnabled: false },
      validatedNotions: {
        ...initial.validatedNotions,
        fonctions: ["Variations"],
      },
    };

    const parsed = parseStageState(serializeStageState(changed), "student-1");

    expect(parsed.settings).toEqual(changed.settings);
    expect(parsed.validatedNotions.fonctions).toEqual(["Variations"]);
    expect(parsed.eleveId).toBe("student-1");
  });

  it("reset baseline has isolated student id and empty history", () => {
    const state = createInitialStageState("student-2");

    expect(state.eleveId).toBe("student-2");
    expect(state.automatismHistory).toEqual([]);
    expect(state.validatedNotions.suites).toEqual([]);
  });
});
