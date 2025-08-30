import { BilanVolet2, Volet2FormData } from "../types/bilan";

/**
 * Mappe les réponses numériques du formulaire à des indices de 1 à 5.
 * Gère les cas où la valeur est absente ou invalide.
 */
const mapToIndex = (value: string | undefined): number => {
  const num = parseInt(value || '0', 10);
  if (isNaN(num) || num < 1 || num > 5) {
    return 1; // Valeur par défaut si invalide
  }
  return num;
};

/**
 * Adapte les données brutes du formulaire Volet 2 vers la structure BilanVolet2
 * utilisée par le backend et pour la génération du rapport.
 *
 * @param formData - Les données telles que reçues du formulaire React Hook Form.
 * @returns Un objet BilanVolet2 structuré.
 */
export const adaptVolet2FormData = (formData: Volet2FormData): BilanVolet2 => {
  // Calcul des indices basés sur les réponses
  const indices = {
    AUTONOMIE: Math.round((mapToIndex(formData.autonomie1) + mapToIndex(formData.autonomie2)) / 2),
    ORGANISATION: Math.round((mapToIndex(formData.organisation1) + mapToIndex(formData.organisation2)) / 2),
    MOTIVATION: Math.round((mapToIndex(formData.motivation1) + mapToIndex(formData.motivation2)) / 2),
    STRESS: Math.round((mapToIndex(formData.stress1) + mapToIndex(formData.stress2)) / 2),
    SUSPECT_DYS: formData.hasTrouble === 'oui' ? 5 : 1,
  };

  // Construction du portrait textuel
  const portraitText = `
Style d'apprentissage : ${formData.learningStyle || 'Non précisé'}.
Matières préférées : ${formData.favoriteSubjects || 'Non précisé'}.
Matières difficiles : ${formData.difficultSubjects || 'Non précisé'}.
Points forts : ${formData.strengths || 'Non précisé'}.
Axes d'amélioration : ${formData.weaknesses || 'Non précisé'}.
Objectifs : ${formData.goals || 'Non précisé'}.
Commentaires libres : ${formData.comments || 'Aucun'}.
  `.trim().replace(/\n\s+/g, '\n');

  // Logique pour déterminer les badges (simplifiée)
  const badges: string[] = [];
  if (indices.ORGANISATION > 3) badges.push("Méthodique");
  if (indices.MOTIVATION > 3) badges.push("Persévérant");
  if (indices.AUTONOMIE > 3) badges.push("Autonome");
  
  const normalizedStrengths = (formData.strengths || '')
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
    
  if (normalizedStrengths.includes('creatif')) badges.push("Créatif");

  return {
    indices,
    portraitText,
    badges,
    // Le chemin du radar sera généré côté serveur, on peut le laisser vide ici.
    radarPath: "", 
  };
};
