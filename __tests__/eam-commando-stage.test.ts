import {
  EXAM_DATE,
  MODULES,
  PLAN,
  STAGE_SESSIONS,
  WEEKEND_PROTOCOL,
  getDaysUntilExam,
  getPlanDayMeta,
  isToday,
} from "@/components/EAMPrep/data";

describe("EAM Commando 10h stage data", () => {
  it("calculates dynamic J-X labels from the exam date", () => {
    expect(getDaysUntilExam(new Date("2026-05-30T10:30:00+02:00"))).toBe(9);
    expect(getDaysUntilExam(new Date("2026-06-08T08:00:00+02:00"))).toBe(0);
    expect(getDaysUntilExam(new Date("2026-06-09T08:00:00+02:00"))).toBe(-1);
    expect(isToday("2026-05-30", new Date("2026-05-30T22:00:00+02:00"))).toBe(true);
    expect(isToday("2026-05-30", new Date("2026-05-31T00:30:00+02:00"))).toBe(false);
  });

  it("keeps the plan dynamic and free from static today flags", () => {
    expect(PLAN.some((day) => "today" in day)).toBe(false);

    const meta = getPlanDayMeta(PLAN[0], new Date("2026-05-28T12:00:00+02:00"));

    expect(meta.isCurrentDay).toBe(true);
    expect(meta.jLabel).toBe("J-11");
    expect(meta.isFinalDay).toBe(false);
  });

  it("defines exactly five coherent editable stage sessions", () => {
    const moduleIds = new Set(MODULES.map((module) => module.id));

    expect(STAGE_SESSIONS).toHaveLength(5);
    expect(STAGE_SESSIONS.reduce((sum, session) => sum + session.durationMin, 0)).toBe(600);

    for (const session of STAGE_SESSIONS) {
      expect(session.id).toMatch(/^S[1-5]$/);
      expect(Date.parse(session.date)).toBeGreaterThan(0);
      expect(session.durationMin).toBe(120);
      expect(session.objectifs.length).toBeGreaterThanOrEqual(3);
      expect(session.objectifs.length).toBeLessThanOrEqual(5);
      expect(session.deroule.length).toBeGreaterThanOrEqual(4);
      expect(session.moduleIds.length).toBeGreaterThan(0);
      expect(session.livrables.length).toBeGreaterThan(0);
      expect(session.interSeance.length).toBeGreaterThan(0);

      for (const moduleId of session.moduleIds) {
        expect(moduleIds.has(moduleId)).toBe(true);
      }

      for (const block of session.deroule) {
        expect(block.tranche).toMatch(/\d/);
        expect(block.activite.length).toBeGreaterThan(10);
        for (const moduleId of block.moduleIds) {
          expect(moduleIds.has(moduleId)).toBe(true);
        }
      }
    }
  });

  it("defines a light final weekend protocol through exam day", () => {
    expect(WEEKEND_PROTOCOL.map((item) => item.id)).toEqual(["J-2", "J-1", "J-0"]);
    expect(WEEKEND_PROTOCOL[0].date).toBe("2026-06-06");
    expect(WEEKEND_PROTOCOL[1].date).toBe("2026-06-07");
    expect(WEEKEND_PROTOCOL[2].date).toBe(EXAM_DATE.toISOString().slice(0, 10));
    expect(WEEKEND_PROTOCOL.every((item) => item.actions.length >= 3)).toBe(true);
  });
});
