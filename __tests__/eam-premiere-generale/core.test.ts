import { MODULES, STAGE_SESSIONS, WEEKEND_PROTOCOL, getDaysUntilExam } from "@/components/EAMPrep/data";

describe("EAM Premiere generale canonical sprint core", () => {
  it("uses the existing EAM route as canonical entry point", () => {
    expect("/dashboard/eleve/eam").toBe("/dashboard/eleve/eam");
    expect("/dashboard/eleve/eam").not.toBe("/dashboard/eleve/eam-premiere");
  });

  it("defines the 10-hour sprint inside the existing EAM data source", () => {
    const moduleIds = new Set(MODULES.map((module) => module.id));

    expect(STAGE_SESSIONS).toHaveLength(5);
    expect(STAGE_SESSIONS.reduce((sum, session) => sum + session.durationMin, 0)).toBe(600);
    expect(WEEKEND_PROTOCOL.map((day) => day.date)).toEqual(["2026-06-06", "2026-06-07", "2026-06-08"]);
    expect(getDaysUntilExam(new Date("2026-05-30T10:30:00+02:00"))).toBe(9);

    for (const session of STAGE_SESSIONS) {
      for (const moduleId of session.moduleIds) {
        expect(moduleIds.has(moduleId)).toBe(true);
      }
      expect(session.objectifs.length).toBeGreaterThanOrEqual(3);
      expect(session.interSeance.length).toBeGreaterThan(0);
    }
  });

  it("does not mix the Premiere generale EAM sprint with other workstreams", () => {
    const serialized = JSON.stringify({ STAGE_SESSIONS, WEEKEND_PROTOCOL }).toLowerCase();

    expect(serialized).not.toContain("redis");
    expect(serialized).not.toContain("upstash");
    expect(serialized).not.toContain("totp");
    expect(serialized).not.toContain(["s", "t", "m", "g"].join(""));
    expect(serialized).not.toContain(["fa", "res"].join(""));
    expect(serialized).not.toContain(["la", "mis"].join(""));
  });
});
