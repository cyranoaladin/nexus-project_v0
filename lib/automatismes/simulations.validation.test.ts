import { PREMIERE_EDS_SIMULATIONS } from "@/data/automatismes/premiere-eds/simulations";
import { AutomatismeDomain } from "@/types/automatismes";

describe("PREMIERE_EDS_SIMULATIONS bank validation", () => {
  it("should contain exactly 10 simulations", () => {
    expect(PREMIERE_EDS_SIMULATIONS).toHaveLength(10);
  });

  PREMIERE_EDS_SIMULATIONS.forEach((sim) => {
    describe(`Simulation ${sim.id}`, () => {
      it("should have exactly 12 questions", () => {
        expect(sim.questions).toHaveLength(12);
      });

      it("should have questionNumbers from 1 to 12", () => {
        const numbers = sim.questions.map((q) => q.questionNumber).sort((a, b) => a - b);
        expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      });

      it("should have 4 choices per question with IDs A/B/C/D", () => {
        sim.questions.forEach((q) => {
          expect(q.choices).toHaveLength(4);
          const ids = q.choices.map((c) => c.id).sort();
          expect(ids).toEqual(["A", "B", "C", "D"]);
        });
      });

      it("should have correctChoiceId belonging to choices", () => {
        sim.questions.forEach((q) => {
          const ids = q.choices.map((c) => c.id);
          expect(ids).toContain(q.correctChoiceId);
        });
      });

      it("should have non-empty statement, feedback, method, trap, remediation, sourceReference, sourceComment", () => {
        sim.questions.forEach((q) => {
          expect(q.statement.trim().length).toBeGreaterThan(0);
          expect(q.feedbackCorrect.trim().length).toBeGreaterThan(0);
          expect(q.feedbackWrong.trim().length).toBeGreaterThan(0);
          expect(q.method.trim().length).toBeGreaterThan(0);
          expect(q.trap.trim().length).toBeGreaterThan(0);
          expect(q.remediation.trim().length).toBeGreaterThan(0);
          expect(q.sourceReference.trim().length).toBeGreaterThan(0);
          expect(q.sourceComment.trim().length).toBeGreaterThan(0);
        });
      });

      it("should not have vague sourceReferences", () => {
        const forbidden = ["ref", "source", "qcm", "programme", "comm", "document", ""];
        sim.questions.forEach((q) => {
          const lower = q.sourceReference.toLowerCase();
          forbidden.forEach((f) => {
            expect(lower).not.toEqual(f);
          });
        });
      });

      it("should cover at least 8 different domains", () => {
        const domains = new Set(sim.questions.map((q) => q.domain));
        expect(domains.size).toBeGreaterThanOrEqual(8);
      });

      it("should contain at least 1 question in calcul numerique or algebrique", () => {
        const hasCalc = sim.questions.some(
          (q) => q.domain === "calcul_numerique" || q.domain === "calcul_algebrique"
        );
        expect(hasCalc).toBe(true);
      });

      it("should contain at least 1 question in proportions/pourcentages or evolutions", () => {
        const hasProp = sim.questions.some(
          (q) =>
            q.domain === "proportions_pourcentages" || q.domain === "evolutions"
        );
        expect(hasProp).toBe(true);
      });

      it("should contain at least 1 question in fonctions or lecture graphique", () => {
        const hasFunc = sim.questions.some(
          (q) =>
            q.domain === "fonctions_representations" || q.domain === "lecture_graphique"
        );
        expect(hasFunc).toBe(true);
      });

      it("should contain at least 1 question in statistiques", () => {
        const hasStat = sim.questions.some((q) => q.domain === "statistiques");
        expect(hasStat).toBe(true);
      });

      it("should contain at least 1 question in probabilites", () => {
        const hasProb = sim.questions.some((q) => q.domain === "probabilites");
        expect(hasProb).toBe(true);
      });

      it("should contain at least 1 Première-specific topic (derivation, suites, exponentielle, produit_scalaire, trigonometrie, geometrie_reperee, second_degre)", () => {
        const premiereTopics: AutomatismeDomain[] = [
          "derivation",
          "suites",
          "exponentielle",
          "produit_scalaire",
          "trigonometrie",
          "geometrie_reperee",
          "second_degre",
        ];
        const hasPremiere = sim.questions.some((q) => premiereTopics.includes(q.domain));
        expect(hasPremiere).toBe(true);
      });
    });
  });
});
