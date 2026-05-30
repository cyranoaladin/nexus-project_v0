import {
  EAM_PREMIERE_EXAM_DATE,
  EAM_PREMIERE_FINAL_WEEKEND,
  EAM_PREMIERE_SPRINT_TOTAL_HOURS,
  eamPremiereCompetencies,
  eamPremiereSprintMissions,
} from "@/content/eam-premiere-generale";

describe("EAM Premiere generale sprint core", () => {
  it("defines the 10-hour sprint for the 8 June 2026 exam", () => {
    expect(EAM_PREMIERE_EXAM_DATE).toBe("2026-06-08");
    expect(EAM_PREMIERE_SPRINT_TOTAL_HOURS).toBe(10);
    expect(eamPremiereSprintMissions).toHaveLength(5);
    expect(eamPremiereSprintMissions.reduce((sum, mission) => sum + mission.durationHours, 0)).toBe(10);
  });

  it("keeps the final weekend focused on 6 and 7 June", () => {
    expect(EAM_PREMIERE_FINAL_WEEKEND.map((day) => day.date)).toEqual(["2026-06-06", "2026-06-07"]);
    expect(EAM_PREMIERE_FINAL_WEEKEND.every((day) => day.actions.length > 0)).toBe(true);
  });

  it("gives every mission a complete student workflow", () => {
    for (const mission of eamPremiereSprintMissions) {
      expect(mission.id).toMatch(/^eam-premiere-/);
      expect(mission.title).toBeTruthy();
      expect(mission.objective).toBeTruthy();
      expect(mission.competencies.length).toBeGreaterThan(0);
      expect(mission.exercises.length).toBeGreaterThan(0);
      expect(mission.frequentMistakes.length).toBeGreaterThan(0);
      expect(mission.deliverable).toBeTruthy();
      expect(mission.homework.durationMinutes).toBeGreaterThanOrEqual(25);
      expect(mission.homework.durationMinutes).toBeLessThanOrEqual(40);
      expect(["P0", "P1", "P2"]).toContain(mission.priority);
      expect(mission.allowedStatuses).toEqual(["todo", "in-progress", "secured"]);
    }
  });

  it("uses unique ids and a full competence barometer", () => {
    const ids = eamPremiereSprintMissions.map((mission) => mission.id);
    expect(new Set(ids).size).toBe(ids.length);

    expect(eamPremiereCompetencies.map((item) => item.id)).toEqual([
      "automatismes",
      "fonctions",
      "suites",
      "probabilites",
      "variables-aleatoires",
      "lecture-graphique",
      "redaction",
      "strategie-examen",
    ]);
  });

  it("does not mix the Premiere generale sprint with other workstreams", () => {
    const serialized = JSON.stringify({
      eamPremiereCompetencies,
      eamPremiereSprintMissions,
      EAM_PREMIERE_FINAL_WEEKEND,
    }).toLowerCase();

    expect(serialized).not.toContain("redis");
    expect(serialized).not.toContain("upstash");
    expect(serialized).not.toContain("totp");
    expect(serialized).not.toContain(["s", "t", "m", "g"].join(""));
    expect(serialized).not.toContain(["fa", "res"].join(""));
    expect(serialized).not.toContain(["la", "mis"].join(""));
  });
});
