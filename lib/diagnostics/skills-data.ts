export interface SkillDefinition {
    id: string;
    label: string;
}

export interface CompetencyItem {
    skillId: string;
    skillLabel: string;
    status: "studied" | "in_progress" | "not_studied" | "unknown";
    mastery: number | null;
    confidence: number | null;
    friction: number | null;
    errorTypes: string[];
    evidence: string;
}

export const ERROR_ENUM = ["cours", "methode", "calcul", "signe", "raisonnement", "redaction", "temps", "stress", "lecture", "attention"];

export const createCompetency = (skillId: string, skillLabel: string): CompetencyItem => ({
    skillId,
    skillLabel,
    status: "studied",
    mastery: 2,
    confidence: 2,
    friction: 1,
    errorTypes: [],
    evidence: ""
});

export const ALGEBRA_SKILLS = [
    { id: "ALG_SUITE_ARITH", label: "Suites arithmétiques (u_n, somme)" },
    { id: "ALG_SUITE_GEO", label: "Suites géométriques (u_n, somme)" },
    { id: "ALG_SUITE_VARIATION", label: "Variation d'une suite" },
    { id: "ALG_SUITE_CONV", label: "Convergence/divergence" },
    { id: "ALG_MODEL_EXP", label: "Modélisation exponentielle" },
    { id: "ALG_QUADRATIC_EQ", label: "Second degré (équations)" },
    { id: "ALG_QUADRATIC_CANON", label: "Forme canonique" },
    { id: "ALG_FACTORIZATION", label: "Factorisations stratégiques" }
];

export const ANALYSIS_SKILLS = [
    { id: "ANA_DERIV_DEF", label: "Nombre dérivé (sens + calcul)" },
    { id: "ANA_DERIV_RULES", label: "Règles de dérivation" },
    { id: "ANA_DERIV_CHAIN", label: "Dérivation composées" },
    { id: "ANA_VARIATIONS", label: "Tableau de variations" },
    { id: "ANA_OPTIMIZATION", label: "Extremum/optimisation" },
    { id: "ANA_EXP", label: "Exponentielle" },
    { id: "ANA_TRIG", label: "Trigonométrie" }
];

export const GEOMETRY_SKILLS = [
    { id: "GEO_DOT_PRODUCT", label: "Produit scalaire" },
    { id: "GEO_AL_KASHI", label: "Al-Kashi" },
    { id: "GEO_MEDIAN_FORMULA", label: "Formule de la médiane" },
    { id: "GEO_ORTHOGONALITY", label: "Orthogonalité" },
    { id: "GEO_LINE_EQUATION", label: "Équation de droite" },
    { id: "GEO_CIRCLE_EQUATION", label: "Équation de cercle" },
    { id: "GEO_PROJECTION", label: "Projeté orthogonal" },
    { id: "GEO_DISTANCE_POINT_LINE", label: "Distance point-droite" }
];

export const PROBABILITY_SKILLS = [
    { id: "PROB_CONDITIONAL", label: "Conditionnelles P_A(B)" },
    { id: "PROB_INDEPENDENCE", label: "Indépendance" },
    { id: "PROB_TREE", label: "Arbre pondéré" },
    { id: "PROB_TOTAL", label: "Probabilités totales" },
    { id: "PROB_RANDOM_VAR", label: "Variable aléatoire/espérance" }
];

export const PYTHON_SKILLS = [
    { id: "PY_FUNC", label: "Fonctions Python" },
    { id: "PY_LOOPS", label: "Boucles for/while" },
    { id: "PY_LISTS", label: "Listes" },
    { id: "PY_SEQ_SIM", label: "Suites algorithmique" },
    { id: "PY_MONTE_CARLO", label: "Simulation Monte-Carlo" }
];

export const TERMINAL_SKILLS = [
    { id: "TLE_LIMITS", label: "Limites & continuité" },
    { id: "TLE_LOG", label: "Logarithme ln" },
    { id: "TLE_DERIV_ADV", label: "Dérivation avancée" },
    { id: "TLE_SPACE_GEO", label: "Géométrie 3D" },
    { id: "TLE_RECURRENCE", label: "Récurrence" },
    { id: "TLE_SUMS", label: "Sommes/séries" },
    { id: "TLE_INTEGRATION", label: "Primitives/intégrales" },
    { id: "TLE_BINOMIAL", label: "Loi binomiale approfondie" }
];

// NSI Placeholder Skills
export const NSI_DATA_SKILLS = [
    { id: "NSI_TYPES", label: "Types de base & construits" },
    { id: "NSI_TRUTH_TABLE", label: "Tables de vérité / Booléens" },
    { id: "NSI_BINARY", label: "Représentation binaire/héxa" },
    { id: "NSI_CSV", label: "Traitement de données (CSV)" }
];

export const NSI_ALGO_SKILLS = [
    { id: "NSI_COMPLEXITY", label: "Complexité algorithmique" },
    { id: "NSI_SORT", label: "Algorithmes de tri" },
    { id: "NSI_KNN", label: "k-plus proches voisins" },
    { id: "NSI_GREEDY", label: "Algorithmes gloutons" }
];

export const NSI_ARCHI_SKILLS = [
    { id: "NSI_VON_NEUMANN", label: "Architecture Von Neumann" },
    { id: "NSI_PROCESSES", label: "Processus & OS" },
    { id: "NSI_NETWORK_PROTO", label: "Protocoles réseau (TCP/IP)" },
    { id: "NSI_ROUTING", label: "Routage & IHM Web" }
];

export const NSI_PYTHON_SKILLS = [
    { id: "NSI_PY_FUNCTIONS", label: "Fonctions & Spécifications" },
    { id: "NSI_PY_TESTS", label: "Tests & Assertions" },
    { id: "NSI_PY_MODULES", label: "Modules & Bibliothèques" },
    { id: "NSI_PY_RECURSION", label: "Récursivité (Intro)" }
];

// Mapping structure
export const SKILLS_BY_TRACK: Record<string, {
    algebra: SkillDefinition[];
    analysis: SkillDefinition[];
    geometry: SkillDefinition[];
    probabilities: SkillDefinition[];
    python: SkillDefinition[];
    terminalAnticipation: SkillDefinition[];
}> = {
    'eds_maths_1ere': {
        algebra: ALGEBRA_SKILLS,
        analysis: ANALYSIS_SKILLS,
        geometry: GEOMETRY_SKILLS,
        probabilities: PROBABILITY_SKILLS,
        python: PYTHON_SKILLS,
        terminalAnticipation: TERMINAL_SKILLS
    },
    'eds_maths_tle': {
        algebra: [...ALGEBRA_SKILLS, { id: "TLE_COMPLEX", label: "Nombres complexes" }],
        analysis: [...ANALYSIS_SKILLS, { id: "TLE_DIFF_EQ", label: "Équations différentielles" }],
        geometry: [...GEOMETRY_SKILLS, { id: "TLE_SPACE", label: "Géométrie dans l'espace" }],
        probabilities: [...PROBABILITY_SKILLS, { id: "TLE_BINOMIAL", label: "Loi Binomiale" }],
        python: PYTHON_SKILLS,
        terminalAnticipation: [] // No anticipation for Terminale
    },
    'eds_nsi_1ere': {
        algebra: NSI_DATA_SKILLS,    // Reusing "algebra" slot for Data
        analysis: NSI_ALGO_SKILLS,   // Reusing "analysis" slot for Algo
        geometry: NSI_ARCHI_SKILLS,  // Reusing "geometry" slot for Archi/OS
        probabilities: [],           // Empty
        python: NSI_PYTHON_SKILLS,   // Python
        terminalAnticipation: []
    },
    'eds_nsi_tle': {
        algebra: NSI_DATA_SKILLS,
        analysis: NSI_ALGO_SKILLS,
        geometry: NSI_ARCHI_SKILLS,
        probabilities: [{ id: "NSI_SQL", label: "Bases de données SQL" }],
        python: [...NSI_PYTHON_SKILLS, { id: "NSI_POO", label: "Programmation Orientée Objet" }],
        terminalAnticipation: []
    }
};

export const DOMAIN_LABELS: Record<string, Record<string, string>> = {
    'eds_maths_1ere': { algebra: "Algèbre & Suites", analysis: "Analyse & Dérivation", geometry: "Géométrie", probabilities: "Probabilités", python: "Python" },
    'eds_maths_tle': { algebra: "Algèbre & Complexes", analysis: "Analyse & Éq. Diff", geometry: "Géométrie Espace", probabilities: "Probabilités", python: "Python" },
    'eds_nsi_1ere': { algebra: "Données & Types", analysis: "Algorithmique", geometry: "Architecture & OS", probabilities: "Autres", python: "Langage Python" },
    'eds_nsi_tle': { algebra: "Structures de Données", analysis: "Algo Avancée", geometry: "Archi & Réseaux", probabilities: "Bases de Données", python: "POO & Projets" }
};

export const LEARNING_STYLES = [
    { value: "theoretical", label: "Théorie/démo" },
    { value: "practice", label: "Pratique" },
    { value: "visual", label: "Visualisation" },
    { value: "concrete", label: "Exemples" },
    { value: "exploratory", label: "Recherche" },
    { value: "oral", label: "Oral" }
];

export const PROBLEM_REFLUX = [
    { value: "persevere", label: "Je persévère" },
    { value: "course", label: "Je reviens au cours" },
    { value: "similarExample", label: "Je cherche un exemple" },
    { value: "askHelp", label: "Je demande aide" },
    { value: "giveUp", label: "J'abandonne" },
    { value: "reread", label: "Je relis" }
];

export const TARGET_MENTIONS = [
    { value: "bien", label: "Bien" },
    { value: "tres_bien", label: "Très Bien" },
    { value: "felicitations", label: "Félicitations" },
    { value: "unknown", label: "Non défini" }
];

export const POSTBAC = [
    { value: "mpsi", label: "MPSI" },
    { value: "mp2i", label: "MP2I" },
    { value: "pcsi", label: "PCSI" },
    { value: "university", label: "Université" },
    { value: "engineering", label: "École ingé" },
    { value: "other", label: "Autre" },
    { value: "unknown", label: "?" }
];

export const FEELINGS = [
    { value: "confident", label: "Confiant" },
    { value: "neutral", label: "Neutre" },
    { value: "difficulty", label: "Difficulté" },
    { value: "panic", label: "Panique" }
];

export const ERROR_LABELS = [
    { value: "cours", label: "Cours" },
    { value: "methode", label: "Méthode" },
    { value: "calcul", label: "Calcul" },
    { value: "signe", label: "Signe" },
    { value: "raisonnement", label: "Raisonnement" },
    { value: "redaction", label: "Rédaction" },
    { value: "temps", label: "Temps" },
    { value: "stress", label: "Stress" },
    { value: "lecture", label: "Lecture" },
    { value: "attention", label: "Attention" }
];
