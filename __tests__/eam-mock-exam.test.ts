import fs from "fs";
import path from "path";
import { MOCK_EXAM } from "@/components/EAMPrep/mockExamData";

const RAW_MATH_PATTERNS = [/racine\(/i, /u_\(/, /->/, /(?<!\\)\btau\s*=/i, /(?<!\\)\bDelta\s*=/];
const FORBIDDEN_OLD_SUBJECT = [
  "NexusFlix",
  "0,8u_n+2",
  "9500",
  "9 500",
  "8000",
  "8 000",
  String.raw`\ln(0,25)`,
  String.raw`\ln(0,8)`,
  String.raw`f(x)=(2x-1)e^{-x}+2`,
  "deux exercices rédigés",
];

function collectStrings(value: unknown, key = ""): string[] {
  if (key === "correctAnswer") return [];
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item) => collectStrings(item));
  return Object.entries(value).flatMap(([entryKey, entryValue]) => collectStrings(entryValue, entryKey));
}

function pointValue(points: string) {
  return Number(points.replace(",", ".").match(/\d+(?:\.\d+)?/)?.[0] ?? 0);
}

describe("EAM mock exam premium subject C", () => {
  it("contains the expected 20-point structure", () => {
    expect(MOCK_EXAM.title).toBe("Sujet blanc C — plateforme premium");
    expect(MOCK_EXAM.subtitle).toContain("Première spécialité mathématiques");
    expect(MOCK_EXAM.calculator).toBe("Calculatrice interdite");
    expect(MOCK_EXAM.duration).toBe("2 heures");
    expect(MOCK_EXAM.qcm.questions).toHaveLength(12);
    expect(MOCK_EXAM.qcm.points).toBe("6 points");
    expect(MOCK_EXAM.exercises).toHaveLength(3);
    expect(MOCK_EXAM.exercises.map((exercise) => exercise.points)).toEqual(["4 points", "5 points", "5 points"]);

    const total = pointValue(MOCK_EXAM.qcm.points) + MOCK_EXAM.exercises.reduce((sum, exercise) => sum + pointValue(exercise.points), 0);
    expect(total).toBe(20);
  });

  it("gives every QCM question exactly four choices and one hidden correction", () => {
    const expectedAnswers = ["b", "a", "b", "a", "b", "a", "b", "c", "b", "b", "b", "b"];

    MOCK_EXAM.qcm.questions.forEach((question, index) => {
      expect(question.choices).toHaveLength(4);
      expect(question.choices.map((choice) => choice.label)).toEqual(["a", "b", "c", "d"]);
      expect(question.correctAnswer).toBe(expectedAnswers[index]);
    });
  });

  it("uses the new independent exercises without old subject A/B content", () => {
    const allText = collectStrings(MOCK_EXAM).join("\n");

    expect(allText).toContain("Exercice 1 — Probabilités conditionnelles");
    expect(allText).toContain("Exercice 2 — Suites et algorithmique");
    expect(allText).toContain("Exercice 3 — Analyse et exponentielle");
    expect(allText).toContain(String.raw`u_{n+1}=0{,}6u_n+4`);
    expect(allText).toContain(String.raw`f(x)=(3-x)e^x+1`);
    expect(allText).toContain("trois exercices rédigés indépendants");

    for (const forbidden of FORBIDDEN_OLD_SUBJECT) {
      expect(allText).not.toContain(forbidden);
    }
    expect(allText.toLowerCase()).not.toContain("logarithme");
    expect(allText).not.toMatch(/\\ln|ln\(/);
  });

  it("stores formulas without forbidden raw placeholders", () => {
    const allText = collectStrings(MOCK_EXAM).join("\n");

    for (const pattern of RAW_MATH_PATTERNS) {
      expect(allText).not.toMatch(pattern);
    }
  });

  it("keeps the correction grid in data only, not in visible text", () => {
    const visibleText = collectStrings(MOCK_EXAM).join("\n");

    expect(MOCK_EXAM.qcm.questions.every((question) => question.correctAnswer)).toBe(true);
    expect(visibleText).not.toContain("Réponse correcte");
    expect(visibleText).not.toContain("correctAnswer");
  });

  it("defines print classes for starting part 2 on a new page", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
    const component = fs.readFileSync(path.join(process.cwd(), "components/EAMPrep/MockExam.tsx"), "utf8");

    expect(component).toContain("qcm-section");
    expect(component).toContain("print-page-break");
    expect(css).toContain(".eam-shell .qcm-section");
    expect(css).toContain("break-after: page");
    expect(css).toContain(".eam-shell .print-page-break");
    expect(css).toContain("break-before: page");
  });
});
