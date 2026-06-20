/**
 * Stage content data (UX/marketing text only — no prices).
 * All pricing lives in data/pricing.canonical.json.
 */

export interface FAQItem {
  question: string;
  answer: string;
}

export const FAQS: FAQItem[] = [
  {
    question: "Comment choisir entre un pack et une formule mono-matiere ?",
    answer: "Si l'eleve a deux matieres ou plus a preparer, le pack (duo ou trio) est plus coherent : un seul cadre de travail, une progression coordonnee et un tarif degressif. La formule mono-matiere convient quand une seule discipline concentre l'enjeu.",
  },
  {
    question: "Le Grand Oral est-il inclus dans les stages ?",
    answer: "Il est inclus dans les packs Trio. Il peut aussi etre choisi seul comme module complementaire. La combinaison d'un pack duo avec le Grand Oral est frequemment choisie par les eleves de Terminale.",
  },
  {
    question: "Que comprend exactement la preparation NSI ?",
    answer: "La partie pratique est au coeur du Pack NSI Complet : entrainement sur ordinateur dans le format officiel 2026, simulations chronometrees et correction par dialogue avec un examinateur. Le stage NSI Ecrit se concentre sur la partie ecrite (algorithmique, structures, SQL).",
  },
  {
    question: "Les stages conviennent-ils aux candidats libres ?",
    answer: "Oui, avec une precision : les candidats individuels sont dispenses de l'epreuve pratique NSI. Pour le Francais, les Maths et le Grand Oral, les stages conviennent pleinement aux candidats libres.",
  },
  {
    question: "Comment se deroule une journee type ?",
    answer: "Matin (9h-12h30) : cours structure + exercices avec correction immediate. Apres-midi (14h-17h30) : consolidation, simulations ou coaching oral selon le stage. Les groupes sont petits — 5 eleves maximum.",
  },
  {
    question: "Les groupes sont-ils vraiment limites a 5 eleves ?",
    answer: "Oui, sans exception. C'est un choix structurant : chaque eleve recoit de l'attention, du feedback et des corrections sur ses propres erreurs, pas des corrections generiques.",
  },
  {
    question: "Que se passe-t-il apres l'inscription ?",
    answer: "Vous recevez une confirmation avec le programme detaille, les horaires, l'adresse et les informations pratiques. Un point d'orientation est possible si l'eleve hesite entre deux formules.",
  },
  {
    question: "Le stage remplace-t-il les revisions personnelles ?",
    answer: "Il les structure. A l'issue de chaque stage, l'eleve repart avec un bilan individualise et un plan de revision clair pour les semaines suivantes.",
  },
  {
    question: "Les stages sont-ils adaptes a un eleve deja bon qui vise une mention ?",
    answer: "Oui. Le niveau d'exigence est adapte au profil de chaque groupe. Le cadre de travail profite autant a ceux qui veulent consolider qu'a ceux qui veulent progresser nettement.",
  },
];
