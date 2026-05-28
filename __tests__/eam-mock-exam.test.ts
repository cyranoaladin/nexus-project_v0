import { MOCK_EXAM } from "@/components/EAMPrep/mockExamData";

const RAW_MATH_PATTERNS = [/racine\(/i, /u_\(/, /->/, /(?<!\\)\btau\s*=/i, /(?<!\\)\bDelta\s*=/];

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  return Object.values(value).flatMap(collectStrings);
}

describe("EAM mock exam", () => {
  it("contains a complete 20-point mock exam", () => {
    expect(MOCK_EXAM.title).toContain("Sujet blanc inédit");
    expect(MOCK_EXAM.calculator).toBe("Calculatrice interdite");
    expect(MOCK_EXAM.duration).toBe("2 heures");
    expect(MOCK_EXAM.qcm.questions).toHaveLength(12);
    expect(MOCK_EXAM.qcm.points).toBe("6 points");
    expect(MOCK_EXAM.exercises).toHaveLength(2);
    expect(MOCK_EXAM.exercises.map((exercise) => exercise.points)).toEqual(["7 points", "7 points"]);
  });

  it("gives every QCM question exactly four choices", () => {
    for (const question of MOCK_EXAM.qcm.questions) {
      expect(question.choices).toHaveLength(4);
      expect(question.choices?.map((choice) => choice.label)).toEqual(["a", "b", "c", "d"]);
    }
  });

  it("keeps QCM 3 with a single unambiguous correct choice", () => {
    const q3 = MOCK_EXAM.qcm.questions.find((question) => question.id === "q3");

    expect(q3?.choices.find((choice) => choice.label === "a")?.content).toBe(String.raw`\{-1,5\ ;\ -4\}`);
    expect(q3?.choices.map((choice) => choice.content)).toHaveLength(new Set(q3?.choices.map((choice) => choice.content)).size);
  });

  it("contains the Python threshold script", () => {
    const allText = collectStrings(MOCK_EXAM).join("\n");

    expect(allText).toContain("def seuil()");
    expect(allText).toContain("while u < 9500");
    expect(allText).toContain("return n");
    expect(allText).toContain("u_7 = 9581");
  });

  it("asks for a correct relative-position study in exercise 2", () => {
    const exercise2 = MOCK_EXAM.exercises.find((exercise) => exercise.id === "ex2");
    const question4 = exercise2?.questions.find((question) => question.id === "ex2-q4");
    const text = collectStrings(question4).join(" ");

    expect(text).toContain("Étudier la position relative");
    expect(text).not.toContain("toujours au-dessus");
  });

  it("stores formulas without forbidden raw placeholders", () => {
    const allText = collectStrings(MOCK_EXAM).join("\n");

    for (const pattern of RAW_MATH_PATTERNS) {
      expect(allText).not.toMatch(pattern);
    }
  });
});
