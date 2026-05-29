import { isPremiereStmg } from "@/content/stage-eam-stmg/eligibility";

describe("isPremiereStmg", () => {
  it("accepts the exact created-account shape", () => {
    expect(isPremiereStmg({ gradeLevel: "PREMIERE", academicTrack: "STMG" })).toBe(true);
  });

  it.each([
    [{ gradeLevel: "PREMIERE", academicTrack: "STMG" }],
    [{ grade: "PREMIERE", academicTrack: "STMG_NON_LYCEEN" }],
    [{ classe: "1ère STMG" }],
    [{ niveau: "Première", filiere: "stmg" }],
    [{ series: "premiere-stmg" }],
    [{ gradeLevel: "1ere", academicTrack: "Sciences et technologies du management et de la gestion" }],
  ])("accepts Première STMG variant %#", (student) => {
    expect(isPremiereStmg(student)).toBe(true);
  });

  it.each([
    [{ gradeLevel: "TERMINALE", academicTrack: "STMG" }],
    [{ gradeLevel: "PREMIERE", academicTrack: "EDS_GENERALE" }],
    [{ classe: "Terminale STMG" }],
    [{ niveau: "Première", filiere: "STI2D" }],
    [{}],
    [null],
  ])("rejects non Première STMG variant %#", (student) => {
    expect(isPremiereStmg(student)).toBe(false);
  });
});
