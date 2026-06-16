import {
  assertDatabaseCompatible,
  buildStudentInputsFromFile,
  normalizeStudentEmail,
  parseStudentInputs,
  runCreateStmgStudents,
  shouldApplyChanges,
} from "@/scripts/create-stmg-students";

describe("create-stmg-students helpers", () => {
  it("normalizes emails without changing identity fields", () => {
    expect(normalizeStudentEmail("  Prenom.NOM@NexusReussite.Academy ")).toBe("prenom.nom@nexusreussite.academy");
  });

  it("parses valid Première STMG student inputs", () => {
    expect(parseStudentInputs([
      { firstName: "Prenom", lastName: "NOM", email: "Prenom.NOM@NexusReussite.Academy", grade: "Première STMG" },
    ])).toEqual([
      { firstName: "Prenom", lastName: "NOM", email: "prenom.nom@nexusreussite.academy", grade: "Première STMG" },
    ]);
  });

  it("builds student inputs from a JSON file", () => {
    const readFile = jest.fn().mockReturnValue(JSON.stringify([
      { firstName: "Lina", lastName: "TEST", email: "lina.test@nexusreussite.academy", grade: "Première STMG" },
    ]));

    expect(buildStudentInputsFromFile("/tmp/stmg-students.json", readFile)).toEqual([
      { firstName: "Lina", lastName: "TEST", email: "lina.test@nexusreussite.academy", grade: "Première STMG" },
    ]);
  });

  it("rejects invalid emails", () => {
    expect(() => parseStudentInputs([
      { firstName: "Prenom", lastName: "NOM", email: "invalide", grade: "Première STMG" },
    ])).toThrow("email invalide");
  });

  it("rejects empty inputs", () => {
    expect(() => parseStudentInputs([])).toThrow("au moins un élève");
  });

  it("rejects duplicate emails after normalization", () => {
    expect(() => parseStudentInputs([
      { firstName: "A", lastName: "NOM", email: "same@nexusreussite.academy", grade: "Première STMG" },
      { firstName: "B", lastName: "NOM", email: " SAME@NEXUSREUSSITE.ACADEMY ", grade: "Première STMG" },
    ])).toThrow("doublon");
  });

  it("keeps dry-run as the default mode", () => {
    expect(shouldApplyChanges([])).toBe(false);
    expect(shouldApplyChanges(["--apply"])).toBe(true);
  });

  it("accepts a compatible Prisma client", async () => {
    await expect(assertDatabaseCompatible({ user: { findFirst: jest.fn().mockResolvedValue(null) } })).resolves.toBeUndefined();
  });

  it("refuses a Prisma client that points to an unaligned database", async () => {
    await expect(assertDatabaseCompatible({
      user: {
        findFirst: jest.fn().mockRejectedValue(new Error("The column `users.totpSecret` does not exist in the current database.")),
      },
    })).rejects.toThrow("Base incompatible avec le Prisma Client actuel");
  });

  it("--apply checks database compatibility before any write", async () => {
    const create = jest.fn();
    await expect(runCreateStmgStudents({
      user: {
        findFirst: jest.fn().mockRejectedValue(new Error("The column `users.totpSecret` does not exist in the current database.")),
        findUnique: jest.fn(),
        create,
        update: jest.fn(),
      },
      parentProfile: { create: jest.fn() },
      student: { upsert: jest.fn() },
    }, [
      { firstName: "Prenom", lastName: "NOM", email: "prenom.nom@nexusreussite.academy", grade: "Première STMG" },
    ], true)).rejects.toThrow("Base incompatible avec le Prisma Client actuel");

    expect(create).not.toHaveBeenCalled();
  });
});
