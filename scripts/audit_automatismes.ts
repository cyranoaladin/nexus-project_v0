
import { PREMIERE_EDS_SIMULATIONS } from "../data/automatismes/premiere-eds/simulations";
import { AutomatismeDomain } from "../types/automatismes";

const THEMATIC_MATRIX: AutomatismeDomain[] = [
  "calcul_numerique", // Q1
  "proportions_pourcentages", // Q2 (or conversion)
  "evolutions", // Q3
  "calcul_algebrique", // Q4
  "calcul_algebrique", // Q5 (equation/inequation)
  "fonctions_representations", // Q6 (affine/droite)
  "lecture_graphique", // Q7
  "second_degre", // Q8
  "statistiques", // Q9
  "probabilites", // Q10
  "derivation", // Q11 (or other 1re themes)
  "calcul_numerique" // Q12 (mixed/trap - flexible)
];

// Note: The matrix is a bit flexible but should follow the general flow.
// Q11 can be suites, exponentielle, etc.
const THEME_1ERE_SPÉ: AutomatismeDomain[] = [
  "derivation", "suites", "exponentielle", "produit_scalaire", "trigonometrie", "geometrie_reperee"
];

const VALID_DOMAINS: AutomatismeDomain[] = [
  "calcul_numerique", "calcul_algebrique", "fractions_puissances", "proportions_pourcentages",
  "evolutions", "fonctions_representations", "lecture_graphique", "second_degre",
  "statistiques", "probabilites", "derivation", "suites", "exponentielle",
  "geometrie_reperee", "produit_scalaire", "trigonometrie"
];

function audit() {
  const errors: string[] = [];
  
  if (PREMIERE_EDS_SIMULATIONS.length !== 10) {
    errors.push(`Nombre de simulations incorrect : ${PREMIERE_EDS_SIMULATIONS.length} au lieu de 10.`);
  }

  PREMIERE_EDS_SIMULATIONS.forEach((sim, sIdx) => {
    const simId = sim.id || `Sim[${sIdx}]`;
    
    if (sim.questions.length !== 12) {
      errors.push(`${simId}: Contient ${sim.questions.length} questions au lieu de 12.`);
    }

    sim.questions.forEach((q, qIdx) => {
      const qLabel = `${simId} Q${qIdx + 1}`;
      
      // Check required fields
      const fields = [
        "id", "seriesId", "questionNumber", "domain", "skillTag", "difficulty",
        "sourceReference", "sourceComment", "statement", "choices", "correctChoiceId",
        "feedbackCorrect", "feedbackWrong", "method", "trap", "remediation"
      ];
      
      fields.forEach(f => {
        if (!(q as any)[f]) {
          errors.push(`${qLabel}: Champ manquant [${f}]`);
        }
      });

      // Check choices
      if (q.choices?.length !== 4) {
        errors.push(`${qLabel}: Nombre de choix incorrect (${q.choices?.length} au lieu de 4)`);
      } else {
        const ids = q.choices.map(c => c.id);
        if (!ids.includes("A") || !ids.includes("B") || !ids.includes("C") || !ids.includes("D")) {
          errors.push(`${qLabel}: Choix A, B, C, D manquants (${ids.join(",")})`);
        }
      }

      // Check correctChoiceId
      if (!["A", "B", "C", "D"].includes(q.correctChoiceId)) {
        errors.push(`${qLabel}: correctChoiceId invalide (${q.correctChoiceId})`);
      }

      // Check sourceReference
      const vagueRefs = ["ref", "source", "programme", "qcm", "comm"];
      if (vagueRefs.includes(q.sourceReference?.toLowerCase())) {
        errors.push(`${qLabel}: sourceReference trop vague (${q.sourceReference})`);
      }

      // Check Domain Validity
      if (!VALID_DOMAINS.includes(q.domain)) {
        errors.push(`${qLabel}: Domaine invalide (${q.domain})`);
      }

      // Check Thematic Matrix
      // Q1: calcul_numerique or fractions_puissances
      if (qIdx === 0 && !["calcul_numerique", "fractions_puissances"].includes(q.domain)) {
        errors.push(`${qLabel}: Q1 doit être calcul_numerique ou fractions_puissances (trouvé: ${q.domain})`);
      }
      // Q2: proportions_pourcentages or fractions_puissances (conversion)
      if (qIdx === 1 && !["proportions_pourcentages", "fractions_puissances", "calcul_numerique"].includes(q.domain)) {
        errors.push(`${qLabel}: Q2 doit être proportions/pourcentages/calcul (trouvé: ${q.domain})`);
      }
      // Q3: evolutions
      if (qIdx === 2 && q.domain !== "evolutions") {
        errors.push(`${qLabel}: Q3 doit être evolutions (trouvé: ${q.domain})`);
      }
      // Q4: calcul_algebrique
      if (qIdx === 3 && q.domain !== "calcul_algebrique") {
        errors.push(`${qLabel}: Q4 doit être calcul_algebrique (trouvé: ${q.domain})`);
      }
      // Q5: calcul_algebrique or second_degre (equation/inequation)
      if (qIdx === 4 && !["calcul_algebrique", "second_degre"].includes(q.domain)) {
        errors.push(`${qLabel}: Q5 doit être calcul_algebrique/second_degre (trouvé: ${q.domain})`);
      }
      // Q6: fonctions_representations or geometrie_reperee
      if (qIdx === 5 && !["fonctions_representations", "geometrie_reperee"].includes(q.domain)) {
        errors.push(`${qLabel}: Q6 doit être fonctions_representations/geometrie_reperee (trouvé: ${q.domain})`);
      }
      // Q7: lecture_graphique
      if (qIdx === 6 && q.domain !== "lecture_graphique") {
        errors.push(`${qLabel}: Q7 doit être lecture_graphique (trouvé: ${q.domain})`);
      }
      // Q8: second_degre
      if (qIdx === 7 && q.domain !== "second_degre") {
        errors.push(`${qLabel}: Q8 doit être second_degre (trouvé: ${q.domain})`);
      }
      // Q9: statistiques
      if (qIdx === 8 && q.domain !== "statistiques") {
        errors.push(`${qLabel}: Q9 doit être statistiques (trouvé: ${q.domain})`);
      }
      // Q10: probabilites
      if (qIdx === 9 && q.domain !== "probabilites") {
        errors.push(`${qLabel}: Q10 doit être probabilites (trouvé: ${q.domain})`);
      }
      // Q11: Theme 1ère Spé
      if (qIdx === 10 && !THEME_1ERE_SPÉ.includes(q.domain)) {
        errors.push(`${qLabel}: Q11 doit être un thème de 1ère Spé (${THEME_1ERE_SPÉ.join(",")}) (trouvé: ${q.domain})`);
      }
      // Q12: Mixed (any domain is fine, but check for trap/mixed)
    });
  });

  if (errors.length > 0) {
    console.log("AUDIT ERRORS FOUND:");
    errors.forEach(e => console.log(`- ${e}`));
    process.exit(1);
  } else {
    console.log("AUDIT SUCCESSFUL: All simulations follow the requirements.");
  }
}

audit();
