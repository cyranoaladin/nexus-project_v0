import { calculateAutomatismeScore } from "./scoring";
import { AutomatismeSeries } from "@/types/automatismes";

describe("calculateAutomatismeScore", () => {
  const createMockSeries = (numQuestions: number): AutomatismeSeries => ({
    id: "test-sim",
    title: "Test Simulation",
    subtitle: "Subtitle",
    description: "Description",
    grade: "PREMIERE",
    subject: "MATHEMATIQUES_EDS",
    examType: "EPREUVE_ANTICIPEE",
    format: "QCM_12_QUESTIONS",
    recommendedDurationMinutes: 10,
    calculatorAllowed: false,
    questions: Array.from({ length: numQuestions }, (_, i) => ({
      id: `q${i + 1}`,
      seriesId: "test-sim",
      questionNumber: i + 1,
      domain: i < 6 ? "calcul_numerique" : "probabilites",
      skillTag: "tag",
      difficulty: 1,
      sourceReference: `ref-${i + 1}`,
      sourceComment: "comm",
      statement: `Q${i + 1}?`,
      choices: [
        { id: "A", text: "A" },
        { id: "B", text: "B" },
        { id: "C", text: "C" },
        { id: "D", text: "D" }
      ],
      correctChoiceId: "A",
      feedbackCorrect: "OK",
      feedbackWrong: "KO",
      method: "meth",
      trap: "trap",
      remediation: "rem"
    }))
  });

  it("should give 12/12, 6/6, 100% for perfect score", () => {
    const series = createMockSeries(12);
    const answers = Object.fromEntries(series.questions.map(q => [q.id, "A"]));
    const result = calculateAutomatismeScore(answers, series, 600);
    
    expect(result.score).toBe(12);
    expect(result.scoreSur6).toBe(6);
    expect(result.percentage).toBe(100);
    expect(result.sourceReferences).toHaveLength(0);
  });

  it("should give 6/12, 3/6, 50% for half score", () => {
    const series = createMockSeries(12);
    const answers = Object.fromEntries(series.questions.map((q, i) => [q.id, i < 6 ? "A" : "B"]));
    const result = calculateAutomatismeScore(answers, series, 600);
    
    expect(result.score).toBe(6);
    expect(result.scoreSur6).toBe(3);
    expect(result.percentage).toBe(50);
    expect(result.sourceReferences).toHaveLength(6);
    expect(result.sourceReferences).toContain("ref-7");
  });

  it("should give 0/12, 0/6, 0% for zero score", () => {
    const series = createMockSeries(12);
    const answers = Object.fromEntries(series.questions.map(q => [q.id, "B"]));
    const result = calculateAutomatismeScore(answers, series, 600);
    
    expect(result.score).toBe(0);
    expect(result.scoreSur6).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.sourceReferences).toHaveLength(12);
  });

  it("should calculate domain performance correctly", () => {
    const series = createMockSeries(12);
    // 6 questions in calcul_numerique, 6 in probabilites
    // Get 3 correct in calcul (50%) and 6 correct in probabilites (100%)
    const answers = {
      ...Object.fromEntries(series.questions.slice(0, 3).map(q => [q.id, "A"])),
      ...Object.fromEntries(series.questions.slice(3, 6).map(q => [q.id, "B"])),
      ...Object.fromEntries(series.questions.slice(6, 12).map(q => [q.id, "A"]))
    };
    
    const result = calculateAutomatismeScore(answers, series, 600);
    
    expect(result.domainPerformance["calcul_numerique"].percentage).toBe(50);
    expect(result.domainPerformance["probabilites"].percentage).toBe(100);
    expect(result.strengths).toContain("Probabilités");
    expect(result.weaknesses).not.toContain("Probabilités");
  });

  it("should throw error if series has no questions (prevents division by zero)", () => {
    const series = createMockSeries(0);
    expect(() => calculateAutomatismeScore({}, series, 600)).toThrow();
  });

  it("should handle duration and average time", () => {
    const series = createMockSeries(10);
    const result = calculateAutomatismeScore({}, series, 600); // 600s / 10 = 60s
    expect(result.averageTimePerQuestion).toBe(60);
  });

  it("should return detailed corrections for every question", () => {
    const series = createMockSeries(12);
    const answers = Object.fromEntries(series.questions.map((q, i) => [q.id, i < 6 ? "A" : "B"]));
    const result = calculateAutomatismeScore(answers, series, 600);

    expect(result.corrections).toHaveLength(12);
    result.corrections.forEach((c, i) => {
      expect(c.questionId).toBe(`q${i + 1}`);
      expect(c.questionNumber).toBe(i + 1);
      expect(c.correctChoiceId).toBe("A");
      expect(c.isCorrect).toBe(i < 6);
      expect(c.feedback).toBe(i < 6 ? "OK" : "KO");
      expect(c.method).toBe("meth");
      expect(c.trap).toBe("trap");
      expect(c.remediation).toBe("rem");
      expect(c.sourceReference).toBe(`ref-${i + 1}`);
      expect(c.sourceComment).toBe("comm");
    });
  });

  it("should treat missing answers as wrong", () => {
    const series = createMockSeries(12);
    // Only answer first 4 questions
    const answers = Object.fromEntries(series.questions.slice(0, 4).map(q => [q.id, "A"]));
    const result = calculateAutomatismeScore(answers, series, 600);

    expect(result.score).toBe(4);
    expect(result.totalQuestions).toBe(12);
    expect(result.percentage).toBe(33);
    result.corrections.forEach((c, i) => {
      if (i >= 4) {
        expect(c.userAnswer).toBeNull();
        expect(c.isCorrect).toBe(false);
      }
    });
  });

  it("recommendation for score >= 11 should indicate excellent level", () => {
    const series = createMockSeries(12);
    const answers = Object.fromEntries(series.questions.map(q => [q.id, "A"]));
    const result = calculateAutomatismeScore(answers, series, 600);
    expect(result.score).toBe(12);
    expect(result.recommendation).toContain("Très bon niveau");
  });

  it("recommendation for score 9-10 should indicate good level", () => {
    const series = createMockSeries(12);
    const answers = Object.fromEntries(series.questions.map((q, i) => [q.id, i < 9 ? "A" : "B"]));
    const result = calculateAutomatismeScore(answers, series, 600);
    expect(result.score).toBe(9);
    expect(result.recommendation).toContain("Bon niveau général");
  });

  it("recommendation for score 6-8 should indicate encouraging but insufficient", () => {
    const series = createMockSeries(12);
    const answers = Object.fromEntries(series.questions.map((q, i) => [q.id, i < 7 ? "A" : "B"]));
    const result = calculateAutomatismeScore(answers, series, 600);
    expect(result.score).toBe(7);
    expect(result.recommendation).toContain("fiabilité reste insuffisante");
  });

  it("recommendation for score < 6 should indicate fragile fundamentals", () => {
    const series = createMockSeries(12);
    const answers = Object.fromEntries(series.questions.map((q, i) => [q.id, i < 3 ? "A" : "B"]));
    const result = calculateAutomatismeScore(answers, series, 600);
    expect(result.score).toBe(3);
    expect(result.recommendation).toContain("restent fragiles");
  });

  it("should never expose correct answers in sourceReferences when all correct", () => {
    const series = createMockSeries(12);
    const answers = Object.fromEntries(series.questions.map(q => [q.id, "A"]));
    const result = calculateAutomatismeScore(answers, series, 600);
    expect(result.sourceReferences).toHaveLength(0);
  });
});
