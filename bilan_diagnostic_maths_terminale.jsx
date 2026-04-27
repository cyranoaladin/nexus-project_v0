/*
====================================================================
  PLAN DE MIGRATION PRODUCTION (Cible Next.js)
====================================================================
  /data/seed.ts               -> DOMAINS, CHAPTERS, QUESTIONS_QCM, QUESTIONS_OPEN, DISCOVERY_CLUSTERS, ERROR_TYPES
  /lib/scoring.ts             -> clampScore, aggregateTeacherErrors, computeDiagnostics
  /lib/pathGenerator.ts       -> generateAdvancedPath, generatePostStagePlan
  /lib/recommendations.ts     -> generateRecommendations
  /lib/storage.ts             -> validateAndRepairImport
  /components/common/         -> Button, Badge, MathRenderer
  /components/diagnostic/     -> IntroStep, ProfileStep, ProgressStep, QcmStep, OpenStep, ResultsStep
  /components/teacher/        -> TeacherStep, TeacherQcmAnalysis, TeacherQuickSynthesis
====================================================================
*/

import React, { useState, useEffect, useRef } from 'react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';
import { 
  BookOpen, Brain, Target, ChevronRight, ChevronLeft, CheckCircle, 
  AlertTriangle, Clock, Download, User, Check, EyeOff, Save, ShieldAlert, Zap, Edit3, HelpCircle, FileQuestion, BarChart2, Trash2, Upload, MessageSquare
} from 'lucide-react';

// ============================================================================
// --- /data/seed.ts ---
// ============================================================================

const DOMAINS = [
  { id: 'D1', title: 'Analyse', order: 1 },
  { id: 'D2', title: 'Algèbre et géométrie', order: 2 },
  { id: 'D3', title: 'Probabilités', order: 3 },
  { id: 'D4', title: 'Algorithmique et programmation', order: 4 },
  { id: 'D5', title: 'Logique et raisonnement', order: 5 },
];

const CHAPTERS = [
  { id: 'C1', domainId: 'D1', title: 'Suites et limites de suites', bacPriority: 5, isCore: true },
  { id: 'C2', domainId: 'D1', title: 'Raisonnement par récurrence', bacPriority: 5, isCore: true },
  { id: 'C3', domainId: 'D1', title: 'Limites de fonctions', bacPriority: 5, isCore: true },
  { id: 'C4', domainId: 'D1', title: 'Compléments de dérivation', bacPriority: 5, isCore: true },
  { id: 'C5', domainId: 'D1', title: 'Fonctions composées', bacPriority: 4, isCore: true },
  { id: 'C6', domainId: 'D1', title: 'Convexité et dérivée seconde', bacPriority: 4, isCore: false },
  { id: 'C7', domainId: 'D1', title: 'Continuité et TVI', bacPriority: 5, isCore: true },
  { id: 'C8', domainId: 'D1', title: 'Fonction logarithme népérien', bacPriority: 5, isCore: true },
  { id: 'C9', domainId: 'D1', title: 'Fonctions sinus et cosinus', bacPriority: 3, isCore: false },
  { id: 'C10', domainId: 'D1', title: 'Primitives', bacPriority: 5, isCore: true },
  { id: 'C11', domainId: 'D1', title: 'Équations différentielles', bacPriority: 4, isCore: false },
  { id: 'C12', domainId: 'D1', title: 'Calcul intégral', bacPriority: 5, isCore: true },
  { id: 'C13', domainId: 'D1', title: 'Intégration par parties', bacPriority: 4, isCore: false },
  { id: 'C14', domainId: 'D1', title: 'Valeur moyenne d’une fonction', bacPriority: 4, isCore: false },
  { id: 'C15', domainId: 'D2', title: 'Combinatoire et dénombrement', bacPriority: 4, isCore: false },
  { id: 'C16', domainId: 'D2', title: 'Vecteurs de l’espace', bacPriority: 4, isCore: true },
  { id: 'C17', domainId: 'D2', title: 'Droites et plans de l’espace', bacPriority: 5, isCore: true },
  { id: 'C18', domainId: 'D2', title: 'Bases et repères de l’espace', bacPriority: 3, isCore: false },
  { id: 'C19', domainId: 'D2', title: 'Produit scalaire dans l’espace', bacPriority: 5, isCore: true },
  { id: 'C20', domainId: 'D2', title: 'Orthogonalité dans l’espace', bacPriority: 5, isCore: true },
  { id: 'C21', domainId: 'D2', title: 'Vecteur normal à un plan', bacPriority: 5, isCore: true },
  { id: 'C22', domainId: 'D2', title: 'Représentation paramétrique d’une droite', bacPriority: 5, isCore: true },
  { id: 'C23', domainId: 'D2', title: 'Équation cartésienne d’un plan', bacPriority: 5, isCore: true },
  { id: 'C24', domainId: 'D2', title: 'Projeté orthogonal', bacPriority: 4, isCore: false },
  { id: 'C25', domainId: 'D2', title: 'Distance d’un point', bacPriority: 3, isCore: false },
  { id: 'C26', domainId: 'D2', title: 'Positions relatives dans l’espace', bacPriority: 4, isCore: false },
  { id: 'C27', domainId: 'D3', title: 'Succession d’épreuves indépendantes', bacPriority: 4, isCore: false },
  { id: 'C28', domainId: 'D3', title: 'Épreuve et schéma de Bernoulli', bacPriority: 5, isCore: true },
  { id: 'C29', domainId: 'D3', title: 'Loi binomiale', bacPriority: 5, isCore: true },
  { id: 'C30', domainId: 'D3', title: 'Probabilités conditionnelles et arbres', bacPriority: 5, isCore: true },
  { id: 'C31', domainId: 'D3', title: 'Variables aléatoires', bacPriority: 4, isCore: true },
  { id: 'C32', domainId: 'D3', title: 'Espérance, variance, écart-type', bacPriority: 5, isCore: true },
  { id: 'C33', domainId: 'D3', title: 'Somme de variables aléatoires', bacPriority: 3, isCore: false },
  { id: 'C34', domainId: 'D3', title: 'Échantillon, moyenne d’échantillon', bacPriority: 2, isCore: false },
  { id: 'C35', domainId: 'D3', title: 'Inégalité de Bienaymé-Tchebychev', bacPriority: 3, isCore: false },
  { id: 'C36', domainId: 'D3', title: 'Loi des grands nombres', bacPriority: 2, isCore: false },
  { id: 'C37', domainId: 'D4', title: 'Variables et affectation', bacPriority: 3, isCore: false },
  { id: 'C38', domainId: 'D4', title: 'Boucles while et for', bacPriority: 4, isCore: true },
  { id: 'C39', domainId: 'D4', title: 'Fonctions Python', bacPriority: 4, isCore: true },
  { id: 'C40', domainId: 'D4', title: 'Listes et compréhension', bacPriority: 3, isCore: false },
  { id: 'C41', domainId: 'D4', title: 'Algorithmes de seuil', bacPriority: 5, isCore: true },
  { id: 'C42', domainId: 'D4', title: 'Dichotomie', bacPriority: 4, isCore: false },
  { id: 'C43', domainId: 'D4', title: 'Méthode d’Euler', bacPriority: 2, isCore: false },
  { id: 'C44', domainId: 'D4', title: 'Simulation probabiliste', bacPriority: 3, isCore: false },
  { id: 'C45', domainId: 'D5', title: 'Proposition mathématique', bacPriority: 2, isCore: false },
  { id: 'C46', domainId: 'D5', title: 'Implication, réciproque, contraposée', bacPriority: 3, isCore: false },
  { id: 'C47', domainId: 'D5', title: 'Quantificateurs', bacPriority: 3, isCore: false },
  { id: 'C48', domainId: 'D5', title: 'Négation', bacPriority: 3, isCore: false },
  { id: 'C49', domainId: 'D5', title: 'Contre-exemple', bacPriority: 4, isCore: true },
  { id: 'C50', domainId: 'D5', title: 'Raisonnement par disjonction de cas', bacPriority: 4, isCore: true },
  { id: 'C51', domainId: 'D5', title: 'Raisonnement par l’absurde', bacPriority: 4, isCore: true },
  { id: 'C52', domainId: 'D5', title: 'Rédaction mathématique', bacPriority: 5, isCore: true },
];

const QUESTIONS_QCM = [
  // BLOC 1 - Suites, récurrence, limites
  { id: 'Q1', chapterId: 'C1', skillType: 'méthode', difficulty: 1, bacPriority: 5, skillTag: 'limite_poly', statement: "Soit $u_n = 3n^2 - 5n + 1$. Lorsque $n$ tend vers $+\\infty$, la suite $(u_n)$ :", choices: ["tend vers $-\\infty$", "tend vers $0$", "tend vers $+\\infty$", "converge vers $1$"], correct: 2, explanation: "Le terme dominant est $3n^2$, positif, donc la limite est $+\\infty$." },
  { id: 'Q2', chapterId: 'C1', skillType: 'automatisme', difficulty: 1, bacPriority: 5, skillTag: 'limite_geom', statement: "La suite géométrique $u_n = 5(1/2)^n$ :", choices: ["tend vers $+\\infty$", "tend vers $5$", "tend vers $0$", "n'a pas de limite"], correct: 2, explanation: "La raison est comprise entre -1 et 1, donc la limite est 0." },
  { id: 'Q3', chapterId: 'C2', skillType: 'méthode', difficulty: 2, bacPriority: 5, skillTag: 'recurrence_structure', statement: "Pour démontrer par récurrence une propriété $P(n)$, il faut :", choices: ["vérifier $P(0)$", "montrer $P(n) \\implies P(n+1)$", "vérifier initialisation et hérédité", "calculer les 10 premiers termes"], correct: 2, explanation: "Une récurrence nécessite l'initialisation, l'hérédité et une conclusion." },
  { id: 'Q4', chapterId: 'C1', skillType: 'raisonnement', difficulty: 2, bacPriority: 5, skillTag: 'convergence_monotone', statement: "Si une suite est croissante et majorée, alors :", choices: ["elle diverge vers $+\\infty$", "elle converge", "elle est constante", "elle tend vers $0$"], correct: 1, explanation: "Théorème de convergence monotone." },
  { id: 'Q5', chapterId: 'C1', skillType: 'méthode', difficulty: 2, bacPriority: 5, skillTag: 'theoreme_gendarmes', statement: "Le théorème des gendarmes s'applique pour :", choices: ["trouver la dérivée", "démontrer qu'une suite converge en l'encadrant", "calculer une intégrale", "trouver une primitive"], correct: 1, explanation: "Il permet de trouver la limite d'une suite encadrée par deux suites de même limite." },
  { id: 'Q6', chapterId: 'C2', skillType: 'rédaction', difficulty: 2, bacPriority: 5, skillTag: 'recurrence_heredite', statement: "L'hérédité d'une récurrence consiste à supposer $P(k)$ vraie et montrer que :", choices: ["$P(0)$ est vraie", "$P(k+1)$ est vraie", "$P(k-1)$ est vraie", "la suite est majorée"], correct: 1, explanation: "C'est la définition de l'étape d'hérédité." },
  // BLOC 2 - Limites, dérivation, convexité
  { id: 'Q7', chapterId: 'C3', skillType: 'méthode', difficulty: 2, bacPriority: 5, skillTag: 'limite_rationnelle', statement: "Limite quand $x$ tend vers $+\\infty$ de $\\frac{3x^2 - 1}{x^2 + 5}$ :", choices: ["$0$", "$1$", "$3$", "$+\\infty$"], correct: 2, explanation: "On factorise par le terme de plus haut degré ou on utilise la règle des termes dominants." },
  { id: 'Q8', chapterId: 'C3', skillType: 'automatisme', difficulty: 2, bacPriority: 5, skillTag: 'croissance_comparee', statement: "Limite quand $x$ tend vers $+\\infty$ de $\\frac{e^x}{x^3}$ :", choices: ["$0$", "$1$", "$+\\infty$", "$3$"], correct: 2, explanation: "Croissances comparées : l'exponentielle l'emporte." },
  { id: 'Q9', chapterId: 'C5', skillType: 'automatisme', difficulty: 2, bacPriority: 4, skillTag: 'derivee_composee', statement: "Si $f(x)=e^{2x+1}$, alors $f'(x)$ vaut :", choices: ["$e^{2x+1}$", "$2e^{2x+1}$", "$(2x+1)e^{2x+1}$", "$e^2$"], correct: 1, explanation: "La dérivée de $e^{u}$ est $u'e^{u}$." },
  { id: 'Q10', chapterId: 'C6', skillType: 'méthode', difficulty: 2, bacPriority: 4, skillTag: 'convexite_derivee_seconde', statement: "Une fonction deux fois dérivable est convexe sur un intervalle si :", choices: ["$f'(x) \\le 0$", "$f''(x) \\ge 0$", "$f(x) \\ge 0$", "$f''(x)=0$"], correct: 1, explanation: "La positivité de la dérivée seconde est la condition de convexité." },
  { id: 'Q11', chapterId: 'C4', skillType: 'automatisme', difficulty: 1, bacPriority: 5, skillTag: 'derivee_quotient', statement: "La dérivée de $\\frac{u}{v}$ est :", choices: ["$\\frac{u'}{v'}$", "$\\frac{u'v - uv'}{v^2}$", "$\\frac{u'v + uv'}{v^2}$", "$u'v'$"], correct: 1, explanation: "Formule classique de dérivation d'un quotient." },
  { id: 'Q12', chapterId: 'C6', skillType: 'raisonnement', difficulty: 2, bacPriority: 4, skillTag: 'point_inflexion', statement: "Un point d'inflexion est atteint lorsque :", choices: ["$f(x)$ s'annule", "$f'(x)$ change de signe", "$f''(x)$ s'annule en changeant de signe", "$f(x)$ atteint un maximum"], correct: 2, explanation: "Un changement de convexité équivaut à un changement de signe de la dérivée seconde." },
  // BLOC 3 - Logarithme, trigonométrie, continuité, TVI
  { id: 'Q13', chapterId: 'C8', skillType: 'automatisme', difficulty: 1, bacPriority: 5, skillTag: 'derivee_ln', statement: "Si $f(x)=\\ln(x)$, alors $f'(x)$ vaut :", choices: ["$x$", "$\\ln(x)$", "$\\frac{1}{x}$", "$e^x$"], correct: 2, explanation: "Dérivée usuelle du logarithme." },
  { id: 'Q14', chapterId: 'C8', skillType: 'automatisme', difficulty: 1, bacPriority: 5, skillTag: 'prop_ln', statement: "Pour $a>0$ et $b>0$, $\\ln(ab) =$ ", choices: ["$\\ln(a)+\\ln(b)$", "$\\ln(a)\\ln(b)$", "$\\ln(a-b)$", "$a \\ln(b)$"], correct: 0, explanation: "Propriété algébrique fondamentale du ln." },
  { id: 'Q15', chapterId: 'C8', skillType: 'méthode', difficulty: 2, bacPriority: 5, skillTag: 'croissance_comparee_ln', statement: "Limite quand $x$ tend vers $+\\infty$ de $\\frac{\\ln(x)}{x}$ :", choices: ["$+\\infty$", "$1$", "$0$", "$-\\infty$"], correct: 2, explanation: "Croissances comparées : $x$ l'emporte sur $\\ln(x)$." },
  { id: 'Q16', chapterId: 'C7', skillType: 'raisonnement', difficulty: 3, bacPriority: 5, skillTag: 'tvi_unicite', statement: "Le Corollaire du TVI (TVI monotonie stricte) garantit :", choices: ["une infinité de solutions", "exactement une solution à $f(x)=k$", "que $f$ est dérivable", "que $f$ est convexe"], correct: 1, explanation: "L'ajout de la monotonie stricte assure l'unicité de la solution." },
  { id: 'Q17', chapterId: 'C9', skillType: 'automatisme', difficulty: 1, bacPriority: 3, skillTag: 'derivee_cos', statement: "La dérivée de $\\cos(x)$ est :", choices: ["$\\sin(x)$", "$-\\sin(x)$", "$\\cos(x)$", "$-\\cos(x)$"], correct: 1, explanation: "Rappel des dérivées trigonométriques." },
  { id: 'Q18', chapterId: 'C7', skillType: 'méthode', difficulty: 2, bacPriority: 5, skillTag: 'tvi_conditions', statement: "Pour appliquer le TVI, la fonction $f$ doit absolument être :", choices: ["dérivable", "convexe", "continue", "positive"], correct: 2, explanation: "La continuité est la condition sine qua non du TVI." },
  // BLOC 4 - Primitives, équations différentielles, intégrales
  { id: 'Q19', chapterId: 'C10', skillType: 'automatisme', difficulty: 1, bacPriority: 5, skillTag: 'primitive_poly', statement: "Une primitive de $x^2$ est :", choices: ["$2x$", "$\\frac{x^3}{3}$", "$x^3$", "$\\ln(x)$"], correct: 1, explanation: "En dérivant $x^3/3$, on retombe sur $x^2$." },
  { id: 'Q20', chapterId: 'C12', skillType: 'méthode', difficulty: 2, bacPriority: 5, skillTag: 'calcul_integrale', statement: "L'intégrale $\\int_0^1 2x \\, dx$ vaut :", choices: ["$0$", "$1$", "$2$", "$1/2$"], correct: 1, explanation: "Une primitive est $x^2$, et $1^2 - 0^2 = 1$." },
  { id: 'Q21', chapterId: 'C10', skillType: 'méthode', difficulty: 2, bacPriority: 5, skillTag: 'primitive_composee', statement: "Une primitive de $u'e^u$ est :", choices: ["$e^u$", "$u e^u$", "$e^{u'}$", "$u' e^u$"], correct: 0, explanation: "La dérivée de $e^u$ est $u'e^u$." },
  { id: 'Q22', chapterId: 'C11', skillType: 'automatisme', difficulty: 2, bacPriority: 4, skillTag: 'equa_diff', statement: "Les solutions de l'équation différentielle $y' = ay$ sont de la forme :", choices: ["$ax + b$", "$C e^{ax}$", "$\\ln(ax)$", "$C a^x$"], correct: 1, explanation: "Cours sur les EDO linéaires d'ordre 1." },
  { id: 'Q23', chapterId: 'C14', skillType: 'automatisme', difficulty: 2, bacPriority: 4, skillTag: 'valeur_moyenne', statement: "La valeur moyenne de $f$ sur $[a;b]$ se calcule par :", choices: ["$f(b)-f(a)$", "$\\frac{1}{b-a} \\int_a^b f(x)dx$", "$\\int_a^b f(x)dx$", "$f(\\frac{a+b}{2})$"], correct: 1, explanation: "Formule de la valeur moyenne." },
  { id: 'Q24', chapterId: 'C13', skillType: 'raisonnement', difficulty: 3, bacPriority: 4, skillTag: 'ipp_origine', statement: "L'intégration par parties provient de la formule de dérivation de :", choices: ["$u+v$", "$u/v$", "$u \\times v$", "$u(v)$"], correct: 2, explanation: "C'est l'intégration de la formule $(uv)' = u'v + uv'$." },
  // BLOC 5 - Combinatoire et probabilités
  { id: 'Q25', chapterId: 'C29', skillType: 'modélisation', difficulty: 2, bacPriority: 5, skillTag: 'loi_binomiale_def', statement: "Dans un schéma de Bernoulli, la variable comptant le nombre de succès suit :", choices: ["une loi uniforme", "une loi binomiale", "une loi exponentielle", "une loi normale"], correct: 1, explanation: "Définition même de la loi binomiale." },
  { id: 'Q26', chapterId: 'C32', skillType: 'automatisme', difficulty: 1, bacPriority: 5, skillTag: 'esperance_binomiale', statement: "Si $X$ suit une loi $B(n,p)$, alors l'espérance $E(X) =$ :", choices: ["$p$", "$n+p$", "$np$", "$np(1-p)$"], correct: 2, explanation: "Formule du cours." },
  { id: 'Q27', chapterId: 'C15', skillType: 'automatisme', difficulty: 2, bacPriority: 4, skillTag: 'combinaisons', statement: "Le nombre de combinaisons de 3 éléments parmi 10 se note :", choices: ["$10^3$", "$3^{10}$", "$\\binom{10}{3}$", "$10!$"], correct: 2, explanation: "C'est le coefficient binomial." },
  { id: 'Q28', chapterId: 'C30', skillType: 'méthode', difficulty: 2, bacPriority: 5, skillTag: 'proba_totales', statement: "La formule des probabilités totales s'utilise souvent avec :", choices: ["une dérivée", "un arbre pondéré", "une droite", "une intégrale"], correct: 1, explanation: "L'arbre permet de visualiser les partitions de l'univers." },
  { id: 'Q29', chapterId: 'C32', skillType: 'automatisme', difficulty: 2, bacPriority: 5, skillTag: 'variance_binomiale', statement: "La variance d'une loi binomiale $B(n,p)$ est :", choices: ["$np$", "$np(1-p)$", "$n(1-p)$", "$p(1-p)$"], correct: 1, explanation: "Formule du cours pour la variance." },
  { id: 'Q30', chapterId: 'C35', skillType: 'raisonnement', difficulty: 3, bacPriority: 3, skillTag: 'bienayme_tchebychev', statement: "L'inégalité de Bienaymé-Tchebychev permet de :", choices: ["calculer une proba exacte", "majorer la proba d'un écart à l'espérance", "trouver l'espérance", "calculer la variance"], correct: 1, explanation: "Elle fournit une borne supérieure sans connaître la loi exacte." },
  // BLOC 6 - Géométrie espace (Vecteurs)
  { id: 'Q31', chapterId: 'C17', skillType: 'méthode', difficulty: 1, bacPriority: 5, skillTag: 'def_plan', statement: "Dans l'espace, un plan peut être défini par :", choices: ["1 point et 1 vecteur", "1 point et 2 vecteurs non colinéaires", "1 seul vecteur", "2 points"], correct: 1, explanation: "Il faut une origine et deux directions d'espace." },
  { id: 'Q32', chapterId: 'C19', skillType: 'automatisme', difficulty: 1, bacPriority: 5, skillTag: 'produit_scalaire_coord', statement: "Si $\\vec{u}(x,y,z)$ et $\\vec{v}(x',y',z')$ en repère orthonormé, $\\vec{u} \\cdot \\vec{v} =$ :", choices: ["$x+x'+y+y'+z+z'$", "$xx'+yy'+zz'$", "$xy+yz$", "$0$"], correct: 1, explanation: "Expression analytique du produit scalaire." },
  { id: 'Q33', chapterId: 'C20', skillType: 'méthode', difficulty: 1, bacPriority: 5, skillTag: 'vecteurs_orthogonaux', statement: "Deux vecteurs $\\vec{u}$ et $\\vec{v}$ sont orthogonaux si et seulement si :", choices: ["$\\vec{u} \\cdot \\vec{v} = 1$", "$\\vec{u} \\cdot \\vec{v} = 0$", "ils sont colinéaires", "leurs normes sont égales"], correct: 1, explanation: "Caractérisation fondamentale de l'orthogonalité." },
  { id: 'Q34', chapterId: 'C21', skillType: 'raisonnement', difficulty: 2, bacPriority: 5, skillTag: 'vecteur_normal', statement: "Un vecteur normal à un plan est :", choices: ["parallèle au plan", "orthogonal à tous les vecteurs du plan", "nul", "inclus dans le plan"], correct: 1, explanation: "Définition du vecteur normal." },
  { id: 'Q35', chapterId: 'C16', skillType: 'automatisme', difficulty: 1, bacPriority: 4, skillTag: 'coord_vecteur', statement: "Si $A(1,2,3)$ et $B(4,5,6)$, le vecteur $\\vec{AB}$ a pour coordonnées :", choices: ["$(3,3,3)$", "$(-3,-3,-3)$", "$(5,7,9)$", "$(4,10,18)$"], correct: 0, explanation: "Coordonnées de B moins coordonnées de A." },
  { id: 'Q36', chapterId: 'C16', skillType: 'raisonnement', difficulty: 2, bacPriority: 4, skillTag: 'vecteurs_coplanaires', statement: "Trois vecteurs sont coplanaires si :", choices: ["ils sont orthogonaux deux à deux", "l'un s'exprime comme combinaison linéaire des deux autres", "ils ont la même norme", "leur somme est nulle"], correct: 1, explanation: "Traduction de l'appartenance à un même plan vectoriel." },
  // BLOC 7 - Géométrie espace (Droites/Plans)
  { id: 'Q37', chapterId: 'C23', skillType: 'méthode', difficulty: 2, bacPriority: 5, skillTag: 'equation_plan', statement: "Le plan d'équation $2x - y + 3z - 5 = 0$ a pour vecteur normal :", choices: ["$(2,-1,3)$", "$(-1,3,-5)$", "$(x,y,z)$", "$(2,1,-3)$"], correct: 0, explanation: "Les coefficients $a,b,c$ donnent le vecteur normal." },
  { id: 'Q38', chapterId: 'C22', skillType: 'méthode', difficulty: 2, bacPriority: 5, skillTag: 'droite_parametrique', statement: "Une représentation paramétrique de droite nécessite :", choices: ["2 vecteurs directeurs", "1 point et 1 vecteur directeur", "1 vecteur normal", "3 points"], correct: 1, explanation: "Une origine et une direction suffisent." },
  { id: 'Q39', chapterId: 'C22', skillType: 'méthode', difficulty: 3, bacPriority: 5, skillTag: 'appartenance_droite', statement: "Pour vérifier si un point appartient à une droite paramétrée, il faut :", choices: ["trouver un même paramètre $t$ pour les 3 coordonnées", "calculer la norme", "vérifier que $x+y+z=0$", "dériver l'équation"], correct: 0, explanation: "Il faut une cohérence du paramètre de temps $t$." },
  { id: 'Q40', chapterId: 'C24', skillType: 'raisonnement', difficulty: 2, bacPriority: 4, skillTag: 'projete_orthogonal', statement: "Le projeté orthogonal de $M$ sur un plan $P$ est :", choices: ["le point de $P$ le plus éloigné de $M$", "le point de $P$ le plus proche de $M$", "toujours l'origine", "le milieu de la droite"], correct: 1, explanation: "Il minimise la distance entre le point et le plan." },
  { id: 'Q41', chapterId: 'C26', skillType: 'raisonnement', difficulty: 3, bacPriority: 4, skillTag: 'positions_relatives', statement: "Deux droites de l'espace peuvent être :", choices: ["uniquement sécantes ou parallèles", "sécantes, parallèles ou non coplanaires", "toujours perpendiculaires", "toujours confondues"], correct: 1, explanation: "La particularité de la 3D est d'autoriser des droites ni sécantes ni parallèles." },
  { id: 'Q42', chapterId: 'C25', skillType: 'méthode', difficulty: 3, bacPriority: 3, skillTag: 'distance_point_plan', statement: "La distance d'un point à un plan se calcule via :", choices: ["le produit scalaire avec le vecteur normal", "l'aire du triangle", "le volume d'un cube", "une dérivée"], correct: 0, explanation: "Ou via la formule directe $\\frac{|ax+by+cz+d|}{\\sqrt{a^2+b^2+c^2}}$." },
  // BLOC 8 - Algorithmique et logique
  { id: 'Q43', chapterId: 'C38', skillType: 'méthode', difficulty: 2, bacPriority: 4, skillTag: 'boucle_while', statement: "Une boucle `while` est adaptée lorsqu'on :", choices: ["connaît le nombre d'itérations", "répète tant qu'une condition est vraie", "calcule une dérivée", "fait un produit scalaire"], correct: 1, explanation: "C'est une boucle conditionnelle, non bornée." },
  { id: 'Q44', chapterId: 'C41', skillType: 'méthode', difficulty: 3, bacPriority: 5, skillTag: 'algo_seuil', statement: "Un algorithme de seuil consiste à :", choices: ["chercher le premier rang vérifiant une condition", "calculer $u_0$", "résoudre une équation", "tracer un cercle"], correct: 0, explanation: "On utilise généralement un `while(u < seuil)`." },
  { id: 'Q45', chapterId: 'C49', skillType: 'raisonnement', difficulty: 2, bacPriority: 4, skillTag: 'contre_exemple', statement: "Pour montrer qu'une proposition universelle est fausse, on utilise :", choices: ["un exemple favorable", "un contre-exemple", "la récurrence", "le TVI"], correct: 1, explanation: "Un seul cas contraire suffit à infirmer le 'Pour tout'." },
  { id: 'Q46', chapterId: 'C46', skillType: 'raisonnement', difficulty: 3, bacPriority: 3, skillTag: 'contraposee', statement: "La contraposée de ($A \\implies B$) est :", choices: ["$B \\implies A$", "non $A \\implies$ non $B$", "non $B \\implies$ non $A$", "$A$ et non $B$"], correct: 2, explanation: "C'est l'équivalence logique fondamentale." },
  { id: 'Q47', chapterId: 'C48', skillType: 'raisonnement', difficulty: 3, bacPriority: 3, skillTag: 'negation_quantificateurs', statement: "La négation de 'Pour tout $x, f(x)>0$' est :", choices: ["Pour tout $x, f(x)\\le 0$", "Il existe $x$ tel que $f(x)\\le 0$", "Il existe $x$ tel que $f(x)<0$", "Aucun $x$ ne vérifie $f(x)>0$"], correct: 1, explanation: "Le 'Pour tout' devient 'Il existe' et l'inégalité s'inverse." },
  { id: 'Q48', chapterId: 'C42', skillType: 'méthode', difficulty: 4, bacPriority: 4, skillTag: 'dichotomie', statement: "La méthode de dichotomie utilise le fait que la fonction change de signe et est :", choices: ["dérivable", "constante", "continue", "périodique"], correct: 2, explanation: "Elle s'appuie sur le théorème des valeurs intermédiaires." }
];

const QUESTIONS_OPEN = [
  { id: 'O1', chapterIds: ['C1','C2'], title: 'Ex. 1 - Suites & Récurrence', maxPoints: 7, 
    statement: "Soit $u_0 = 1$ et $u_{n+1} = \\frac{1}{2} u_n + 3$. \n1. Calculer $u_1, u_2$. \n2. Montrer par récurrence que $u_n < 6$.\n3. Montrer que $(u_n)$ est croissante.\n4. En déduire sa limite.",
    rubrics: [ {label: "Calculs u1/u2", points: 1}, {label: "Init récurrence", points: 1}, {label: "Hérédité récurrence", points: 2}, {label: "Monotonie", points: 1.5}, {label: "Conclusion Limite", points: 1.5} ] },
  { id: 'O2', chapterIds: ['C4','C5'], title: 'Ex. 2 - Étude de fonction', maxPoints: 8,
    statement: "Soit $f(x) = x^2 e^{-x}$.\n1. Calculer $f'(x)$.\n2. Dresser le tableau de variations.\n3. Déterminer la limite en $+\\infty$.",
    rubrics: [ {label: "Formule (uv)'", points: 2}, {label: "Calcul f'(x)", points: 2}, {label: "Signe et Variations", points: 2}, {label: "Limite (croissances comp.)", points: 2} ] },
  { id: 'O3', chapterIds: ['C29','C32'], title: 'Ex. 3 - Loi binomiale', maxPoints: 6,
    statement: "On prélève 100 composants. Proba défectueux = 0.03. $X$ = nb défectueux.\n1. Justifier la loi binomiale.\n2. Calculer $P(X=0)$.\n3. Calculer espérance et variance.",
    rubrics: [ {label: "Justification (indép/succès)", points: 2}, {label: "Calcul P(X=0)", points: 2}, {label: "Espérance", points: 1}, {label: "Variance", points: 1} ] },
  { id: 'O4', chapterIds: ['C16','C23'], title: 'Ex. 4 - Géométrie Espace', maxPoints: 8,
    statement: "On donne $A(1,0,2)$, $B(3,1,4)$, $C(0,2,1)$.\n1. Coordonnées de $\\vec{AB}$ et $\\vec{AC}$.\n2. Calculer $\\vec{AB} \\cdot \\vec{AC}$.\n3. Équation du plan passant par $A$ de vecteur normal $\\vec{n}(1,-2,3)$.",
    rubrics: [ {label: "Coordonnées vecteurs", points: 2}, {label: "Produit scalaire", points: 2}, {label: "Structure équation plan", points: 2}, {label: "Résolution constante d", points: 2} ] },
  { id: 'O5', chapterIds: ['C8','C7'], title: 'Ex. 5 - Logarithme & TVI', maxPoints: 7,
    statement: "Soit $g(x) = \\ln(x) - \\frac{x}{2}$ sur $]0,+\\infty[$.\n1. Calculer $g'(x)$ et variations.\n2. Montrer que $g(x)=0$ a 2 solutions.\n3. Donner un encadrement.",
    rubrics: [ {label: "Calcul g'(x)", points: 1.5}, {label: "Variations", points: 1.5}, {label: "Conditions TVI", points: 2}, {label: "Application stricte TVI", points: 1}, {label: "Encadrement calculatrice", points: 1} ] },
  { id: 'O6', chapterIds: ['C6'], title: 'Ex. 6 - Convexité', maxPoints: 6,
    statement: "Soit $h(x) = x^3 - 3x^2 + 2$.\n1. Calculer $h''(x)$.\n2. Déterminer les intervalles de convexité.\n3. Préciser le(s) point(s) d'inflexion.",
    rubrics: [ {label: "Dérivée première", points: 1}, {label: "Dérivée seconde", points: 2}, {label: "Signe et convexité", points: 2}, {label: "Point d'inflexion", points: 1} ] },
  { id: 'O7', chapterIds: ['C10','C12'], title: 'Ex. 7 - Intégrales', maxPoints: 6,
    statement: "1. Calculer $\\int_0^1 (3x^2+2x+1) dx$.\n2. Primitive de $\\frac{\\ln(x)}{x}$ ?\n3. Calculer $\\int_1^e \\frac{\\ln(x)}{x} dx$.",
    rubrics: [ {label: "Primitive polynomiale", points: 1}, {label: "Calcul intégrale 1", points: 1}, {label: "Forme u'u", points: 2}, {label: "Calcul intégrale 2", points: 2} ] },
  { id: 'O8', chapterIds: ['C41'], title: 'Ex. 8 - Algorithmique (Seuil)', maxPoints: 4,
    statement: "Soit $u_0 = 2$ et $u_{n+1} = 1.2u_n + 5$.\nObjectif : premier $n$ tel que $u_n > 100$.\nÉcrire la boucle `while` en Python complétant :\n`u = 2`\n`n = 0`\n`while ... :`\n   `u = ...`\n   `n = ...`",
    rubrics: [ {label: "Condition while", points: 1.5}, {label: "Affectation u", points: 1.5}, {label: "Incrémentation n", points: 1} ] }
];

const ERROR_TYPES = [
  "Erreur de calcul", "Erreur de méthode", "Erreur de rédaction", 
  "Absence de justification", "Confusion de notion", "Blocage au démarrage", 
  "Théorème mal utilisé", "Interprétation graphique", "Mauvaise utilisation calculatrice", "Raisonnement incomplet"
];

const DISCOVERY_CLUSTERS = [
  { id: 'suites', title: 'Suites & Récurrence', ids: ['C1','C2'] },
  { id: 'ln_tvi', title: 'Logarithme & TVI', ids: ['C8','C7'] },
  { id: 'prim_int', title: 'Primitives & Intégrales', ids: ['C10','C12','C13','C14'] },
  { id: 'geo', title: 'Géométrie dans l\'Espace', ids: ['C16','C17','C19','C20','C21','C22','C23','C24'] },
  { id: 'proba', title: 'Probabilités', ids: ['C28','C29','C30','C31','C32'] },
  { id: 'algo', title: 'Algorithmique', ids: ['C38','C41','C42'] },
];

// ============================================================================
// --- /lib/scoring.ts ---
// ============================================================================

function clampScore(value, min, max) {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, n));
}

const aggregateTeacherErrors = (teacherGrades) => {
  const counts = {};
  Object.values(teacherGrades || {}).forEach(g => {
    (g.errors || []).forEach(err => {
      counts[err] = (counts[err] || 0) + 1;
    });
  });
  return Object.entries(counts).sort((a,b) => b[1] - a[1]);
};

const computeDiagnostics = (profile, progress, qcmAnswers, teacherGrades, isTeacherGraded) => {
  let qcmRawScore = 0;
  let openRawScore = 0;
  let qcmDontKnowCount = 0;
  let qcmUnansweredCount = 0;
  const qcmMaxScore = 48;
  const openMaxScore = 52;
  const globalMaxScore = 100;
  
  const chapStats = {};
  CHAPTERS.forEach(c => {
    chapStats[c.id] = { id: c.id, domainId: c.domainId, title: c.title, bacPriority: c.bacPriority, score: 0, max: 0, evaluated: false };
  });

  QUESTIONS_QCM.forEach(q => {
    chapStats[q.chapterId].max += 1;
    chapStats[q.chapterId].evaluated = true;
    
    const ans = qcmAnswers[q.id];
    if (ans === q.correct) {
      chapStats[q.chapterId].score += 1;
      qcmRawScore += 1;
    } else if (ans === -1) {
      qcmDontKnowCount += 1;
    } else if (ans === undefined || ans === null) {
      qcmUnansweredCount += 1;
    }
  });

  qcmRawScore = clampScore(qcmRawScore, 0, qcmMaxScore);

  if (isTeacherGraded) {
    QUESTIONS_OPEN.forEach(q => {
      const gradeData = teacherGrades[q.id];
      const points = clampScore(gradeData?.score, 0, q.maxPoints);
      openRawScore += points;
      
      const pointsPerChap = points / q.chapterIds.length;
      const maxPerChap = q.maxPoints / q.chapterIds.length;
      
      q.chapterIds.forEach(cId => {
        if(chapStats[cId]) {
          chapStats[cId].max += maxPerChap;
          chapStats[cId].score += pointsPerChap;
          chapStats[cId].evaluated = true;
        }
      });
    });
  }
  
  openRawScore = clampScore(openRawScore, 0, openMaxScore);

  const qcmPercentage = Math.round((qcmRawScore / qcmMaxScore) * 100);
  const openPercentage = isTeacherGraded ? Math.round((openRawScore / openMaxScore) * 100) : null;
  const globalRawScore = clampScore(qcmRawScore + openRawScore, 0, globalMaxScore);
  const globalPercentage = isTeacherGraded 
    ? Math.round((globalRawScore / globalMaxScore) * 100)
    : qcmPercentage;

  const chapterResults = CHAPTERS.map(c => {
    const stats = chapStats[c.id];
    const prog = progress[c.id];
    const isDeclared = prog !== undefined && prog.declared !== null && prog.declared !== undefined;
    const declaredVal = isDeclared ? prog.declared : null;
    const confVal = isDeclared ? prog.confidence : null;
    
    let percentage = null;
    if (stats.evaluated && stats.max > 0) percentage = (stats.score / stats.max) * 100;

    let pedagogicalStatus = 'Non renseigné';
    let declaredNotSeenButSucceeded = false;

    if (!isDeclared) {
       pedagogicalStatus = 'Non renseigné';
    } else if (declaredVal === 0) {
       if (stats.evaluated && percentage >= 65) {
           pedagogicalStatus = 'Non vu déclaré, réussite observée';
           declaredNotSeenButSucceeded = true;
       } else {
           pedagogicalStatus = c.bacPriority >= 5 ? 'Découverte prioritaire' : 'Non encore vu';
       }
    } else if (!stats.evaluated) {
       pedagogicalStatus = 'Déclaré vu mais non évalué';
    } else {
      if (percentage < 25) pedagogicalStatus = 'Lacune critique';
      else if (percentage < 45) pedagogicalStatus = 'Très fragile';
      else if (percentage < 65) pedagogicalStatus = 'Fragile';
      else if (percentage < 80) pedagogicalStatus = 'À consolider';
      else if (percentage < 90) pedagogicalStatus = 'Maîtrisé';
      else pedagogicalStatus = 'Point fort';
    }

    const weaknessF = { 
      'Non renseigné': 0, 'Non encore vu': 3, 'Découverte prioritaire': 4.5, 
      'Déclaré vu mais non évalué': 2.5, 'Lacune critique': 5, 'Très fragile': 4, 
      'Fragile': 3, 'À consolider': 2, 'Maîtrisé': 1, 'Point fort': 0.5,
      'Non vu déclaré, réussite observée': 1 
    }[pedagogicalStatus] || 1;
    
    let programF = 1;
    if (declaredVal === 0 && !declaredNotSeenButSucceeded) programF = 1.2;
    if (!stats.evaluated && declaredVal > 0) programF = 1.1;
    if (stats.evaluated && confVal >= 4 && percentage < 50) programF = 1.5; 
    if (declaredVal === 5) programF = 0.8;
    
    const priorityScore = pedagogicalStatus === 'Non renseigné' ? 0 : (c.bacPriority * weaknessF * programF);
    const isIllusion = stats.evaluated && confVal >= 4 && percentage < 50;
    const lacksConfidence = stats.evaluated && confVal <= 2 && percentage >= 70;

    return {
      chapterId: c.id,
      domainId: c.domainId,
      title: c.title,
      domainTitle: DOMAINS.find(d => d.id === c.domainId).title,
      declared: declaredVal,
      confidence: confVal,
      percentage,
      isEvaluated: stats.evaluated,
      pedagogicalStatus,
      priorityScore,
      isIllusion,
      lacksConfidence,
      declaredNotSeenButSucceeded
    };
  });

  const domainStatsObj = {};
  DOMAINS.forEach(d => {
    domainStatsObj[d.id] = { raw: 0, max: 0 };
  });
  
  CHAPTERS.forEach(c => {
     const stats = chapStats[c.id];
     if (stats.evaluated) {
        domainStatsObj[c.domainId].raw += stats.score;
        domainStatsObj[c.domainId].max += stats.max;
     }
  });

  const domainScores = {};
  DOMAINS.forEach(d => {
    domainScores[d.id] = domainStatsObj[d.id].max > 0 
      ? Math.round((domainStatsObj[d.id].raw / domainStatsObj[d.id].max) * 100) 
      : 0;
  });

  const criticalCount = chapterResults.filter(c => c.pedagogicalStatus === 'Lacune critique').length;
  let calculatedProfile = { label: 'Élève en cours d’évaluation', desc: 'Profil provisoire basé uniquement sur le QCM.' };
  
  if (isTeacherGraded) {
    if (globalPercentage < 35 || criticalCount >= 5) calculatedProfile = { label: 'Base très fragile', desc: 'Objectif : sécuriser les automatismes essentiels et méthodes de base.' };
    else if (globalPercentage < 50) calculatedProfile = { label: 'Élève fragile', desc: 'Niveau irrégulier. Les méthodes ne sont pas stabilisées et doivent être structurées.' };
    else if (globalPercentage < 65) calculatedProfile = { label: 'Élève moyen', desc: 'Bases existantes. Nécessité de renforcer la rédaction et d\'éviter les erreurs d\'étourderie.' };
    else if (globalPercentage >= 80) calculatedProfile = { label: 'Élève solide', desc: 'Objectif performance : sujets bac complets, questions difficiles et rédaction experte.' };
    else calculatedProfile = { label: 'Élève correct', desc: 'Bases saines. Doit consolider pour gagner en fluidité sur les problèmes ouverts.' };
  }

  return {
    profile, chapterResults, domainScores, 
    qcmRawScore, qcmMaxScore, qcmPercentage, qcmDontKnowCount, qcmUnansweredCount,
    openRawScore, openMaxScore, openPercentage,
    globalRawScore, globalMaxScore, globalPercentage, 
    isProvisional: !isTeacherGraded, calculatedProfile
  };
};

// ============================================================================
// --- /lib/pathGenerator.ts ---
// ============================================================================

const generatePostStagePlan = (evaluatedData, teacherGrades) => {
  if (!evaluatedData) return [];
  const { calculatedProfile, chapterResults, domainScores } = evaluatedData;
  const isFragile = ['Base très fragile', 'Élève fragile'].includes(calculatedProfile.label);
  
  const topErrors = aggregateTeacherErrors(teacherGrades || {}).slice(0, 2);
  const urgencies = chapterResults.filter(c => c.pedagogicalStatus === 'Lacune critique' || c.pedagogicalStatus === 'Très fragile').sort((a,b)=> b.priorityScore - a.priorityScore).slice(0,3);
  
  let weakestDomainId = DOMAINS[0].id;
  let minScore = 100;
  DOMAINS.forEach(d => {
    if (domainScores[d.id] !== undefined && domainScores[d.id] < minScore) {
      minScore = domainScores[d.id];
      weakestDomainId = d.id;
    }
  });
  const weakestDomainTitle = DOMAINS.find(d => d.id === weakestDomainId)?.title || 'Analyse';

  return [
    { 
      week: "Semaine 1", 
      title: "Consolidation des Urgences Personnalisées", 
      desc: urgencies.length > 0 
        ? `Reprendre impérativement : ${urgencies.map(u=>u.title).join(', ')}.` 
        : "Retravailler les exercices ouverts les moins bien réussis en se concentrant sur la méthode.",
      deliverable: "Fiche méthode + correction propre"
    },
    { 
      week: "Semaine 2", 
      title: `Focus Domaine Faible : ${weakestDomainTitle}`, 
      desc: `Faire 2 annales de Bac thématisées spécifiquement sur : ${weakestDomainTitle}. ${topErrors.length > 0 ? `Attention particulièrement à : ${topErrors.map(e=>e[0]).join(', ')}.` : ''}`,
      deliverable: "Copies corrigées et annotées"
    },
    { 
      week: "Semaine 3", 
      title: "Entraînement Conditions Réelles", 
      desc: "Faire 1 sujet de Bac complet en temps limité strict (4h). Ne regarder la correction qu'à la fin.",
      deliverable: "Bilan des erreurs d'étourderie"
    },
    { 
      week: "Dernière semaine", 
      title: "Révisions Légères & Sécurisation", 
      desc: "Relire le carnet d'erreurs constitué. Revoir par cœur les formules essentielles et automatismes.",
      deliverable: "Dernière liste de questions au prof"
    }
  ];
};

const generateAdvancedPath = (chapterResults) => {
  const priorities = [...chapterResults].filter(c => !['Point fort', 'Maîtrisé', 'Non encore vu', 'Découverte prioritaire', 'Non renseigné', 'Non vu déclaré, réussite observée'].includes(c.pedagogicalStatus));
  const decouvertes = [...chapterResults].filter(c => c.pedagogicalStatus === 'Découverte prioritaire');
  const nonRenseignes = [...chapterResults].filter(c => c.pedagogicalStatus === 'Non renseigné');
  const reussitesInattendues = [...chapterResults].filter(c => c.declaredNotSeenButSucceeded);
  
  let clarificationTime = nonRenseignes.length > 0 ? 10 : 0;
  let unexpectedTime = reussitesInattendues.length > 0 ? 10 : 0;
  let remainingTime = 120 - 5 - 20 - clarificationTime - unexpectedTime; // Total 120m
  let qcmTime = Math.floor(remainingTime * 0.45);
  let redacTime = remainingTime - qcmTime;

  let sessions = [{
    num: 1, duration: '2h', type: 'Méthodologie', title: 'Diagnostic & Erreurs critiques',
    objectives: ['Restitution du bilan', 'Création du carnet d’erreurs', 'Correction des questions bloquantes'],
    skills: ['Analyse de l\'énoncé', 'Autocorrection'],
    activities: [
      '5 min : Accueil et lecture du bilan', 
      ...(clarificationTime > 0 ? ['10 min : Clarification de l’avancement sur les chapitres non renseignés'] : []),
      ...(unexpectedTime > 0 ? ['10 min : Vérification à l\'oral des réussites inattendues'] : []),
      `${qcmTime} min : Reprise à chaud des QCM échoués`, 
      `${redacTime} min : Méthodologie de rédaction (Exercice type)`, 
      '20 min : Planification et stratégie'
    ],
    homework: 'Refaire un exercice type bac échoué en diagnostic',
    criteria: 'L\'élève comprend son profil et ses objectifs de progression.',
    writtenTrace: 'Création du carnet d\'erreur et méthode d\'autocorrection.',
    oralCheck: 'L\'élève verbalise son objectif principal pour le stage.',
    chapters: [], teacherNotes: "Le temps est ajusté mathématiquement pour durer exactement 120 minutes."
  }];

  let usedIds = new Set();
  let sNum = 2;

  DISCOVERY_CLUSTERS.forEach(cluster => {
    const clusterChaps = decouvertes.filter(c => cluster.ids.includes(c.chapterId) && !usedIds.has(c.chapterId));
    if (clusterChaps.length > 0 && sNum <= 7) {
       sessions.push({
         num: sNum++, duration: '2h', type: 'Découverte structurée', title: cluster.title,
         objectives: ['Acquisition des notions clés du cluster', 'Modélisation et approche conceptuelle'],
         skills: ['Modélisation', 'Raisonnement'],
         activities: ['30 min : Cours interactif', '45 min : Exercices d\'application directe', '45 min : Problème guidé'],
         homework: `Créer une fiche de synthèse sur : ${cluster.title}`,
         criteria: 'Compréhension du concept fondamental et réussite des applications directes.',
         writtenTrace: 'Formules clés à retenir par coeur.',
         oralCheck: 'L\'élève explique pourquoi la formule s\'applique sur un exemple simple.',
         chapters: clusterChaps.map(c => c.title), teacherNotes: "Garder un rythme fluide, première approche de ces notions."
       });
       clusterChaps.forEach(c => usedIds.add(c.chapterId));
    }
  });

  DISCOVERY_CLUSTERS.forEach(cluster => {
    const clusterChaps = priorities.filter(c => cluster.ids.includes(c.chapterId) && !usedIds.has(c.chapterId));
    const hasCritical = clusterChaps.some(c => ['Lacune critique', 'Très fragile'].includes(c.pedagogicalStatus));
    
    if (hasCritical && sNum <= 7) {
      sessions.push({
        num: sNum++, duration: '2h', type: 'Consolidation intensive', title: cluster.title,
        objectives: ['Sécuriser les méthodes essentielles', 'Débloquer les automatismes transversaux'],
        skills: ['Calcul', 'Méthode'],
        activities: ['15 min : Flash automatismes', '30 min : Reprise de méthode', '45 min : Exercice guidé pas-à-pas', '30 min : Exercice type Bac'],
        homework: `Exercice d'application type Bac sur ${cluster.title}`,
        criteria: 'Fluidité retrouvée sur les calculs et enclenchement sans blocage.',
        writtenTrace: 'Méthode pas-à-pas rédigée dans le cahier.',
        oralCheck: 'L\'élève reformule la méthode de résolution en 2 minutes.',
        chapters: clusterChaps.map(c => c.title), teacherNotes: ""
      });
      clusterChaps.forEach(c => usedIds.add(c.chapterId));
    }
  });

  while(sNum <= 7) {
    const remaining = priorities.filter(c => !usedIds.has(c.chapterId)).sort((a,b) => b.priorityScore - a.priorityScore);
    if(remaining.length > 0) {
      sessions.push({ 
        num: sNum++, duration: '2h', type: 'Renforcement', title: remaining[0].domainTitle, 
        objectives: ['Exercices de synthèse type Bac'], 
        skills: ['Rédaction', 'Raisonnement'],
        activities: ['20 min : Questions flash', '60 min : Problème ouvert multi-chapitres', '40 min : Rédaction experte'],
        homework: 'Revoir les erreurs de rédaction de la séance', 
        criteria: 'Autonomie sur problème ouvert.',
        writtenTrace: 'Exemples de rédaction parfaite recopiés.',
        oralCheck: 'L\'élève verbalise le plan de résolution avant de l\'écrire.',
        chapters: [remaining[0].title], teacherNotes: "Insister sur la rigueur de la copie."
      });
      usedIds.add(remaining[0].chapterId);
    } else {
      sessions.push({ num: sNum++, duration: '2h', type: 'Entraînement', title: `Exercices transversaux`, objectives: ['Mélange de domaines'], skills: ['Adaptabilité'], activities: ['120 min : Traitement de sujets'], homework: '', criteria: 'Autonomie générale', writtenTrace: 'Correction des sujets', oralCheck: 'Analyse d\'erreur à l\'oral', chapters: [], teacherNotes: "" });
    }
  }

  sessions.push({
    num: 8, duration: '2h', type: 'Entraînement Bac', title: 'Bac Blanc Ciblé & Stratégie',
    objectives: ['Mini-sujet transversal', 'Gestion du temps', 'Plan de révision post-stage'],
    skills: ['Gestion du stress', 'Organisation'],
    activities: ['10 min : Consignes et stratégie', '90 min : Épreuve blanche chronométrée', '20 min : Correction flash & Stratégie Juin'],
    homework: 'Suivre plan de révision Post-Stage', 
    criteria: 'Gestion du temps maîtrisée et copie propre.',
    writtenTrace: 'Plan de révision des 4 semaines noté.',
    oralCheck: 'L\'élève exprime son ressenti sur sa progression.',
    chapters: ['Toutes notions'], teacherNotes: "Simuler les conditions d'examen réelles."
  });

  return sessions;
};

// ============================================================================
// --- /lib/recommendations.ts ---
// ============================================================================

const generateRecommendations = (chapterResults, domainScores, teacherGrades) => {
  let recs = [];
  const topErrors = aggregateTeacherErrors(teacherGrades).slice(0,3);

  if (topErrors.length > 0) {
     if (topErrors[0][0] === "Absence de justification" && topErrors[0][1] >= 3) {
       recs.push({ type: 'alerte', title: 'Problème de Rédaction', text: `L'élève peine à justifier (${topErrors[0][1]} occ.). Prévoir un travail spécifique sur la rédaction : citer le théorème, vérifier les hypothèses, conclure clairement.` });
     } else if (topErrors[0][0] === "Blocage au démarrage" && topErrors[0][1] >= 2) {
       recs.push({ type: 'alerte', title: 'Manque d\'Autonomie', text: `L'élève bloque face à la feuille blanche (${topErrors[0][1]} occ.). Installer une méthode de brouillon exploratoire : identifier le type d’exercice, lister les données, écrire les formules possibles.` });
     } else {
       recs.push({ type: 'info', title: 'Erreurs fréquentes', text: `Erreurs dominantes : ${topErrors.map(e=>e[0]).join(', ')}.` });
     }
  }

  const illusions = chapterResults.filter(c => c.isIllusion);
  if (illusions.length > 0) {
    recs.push({ type: 'alerte', title: 'Illusion de maîtrise', text: `Surestime fortement son niveau sur : ${illusions.map(c=>c.title).join(', ')}. À confronter rapidement avec la réalité.` });
  }

  const manquesConfiance = chapterResults.filter(c => c.lacksConfidence);
  if (manquesConfiance.length > 0) {
    recs.push({ type: 'succes', title: 'Potentiel sous-exploité', text: `L'élève réussit mieux qu'il ne le croit sur : ${manquesConfiance.map(c=>c.title).join(', ')}. Le rassurer.` });
  }

  const nonRenseignes = chapterResults.filter(c => c.pedagogicalStatus === 'Non renseigné');
  if (nonRenseignes.length > 0) {
    recs.push({ type: 'info', title: 'Alerte Déclaratif', text: `${nonRenseignes.length} chapitres n'ont pas de statut renseigné. Clarifier absolument en séance 1.` });
  }

  const reussitesInattendues = chapterResults.filter(c => c.declaredNotSeenButSucceeded);
  if (reussitesInattendues.length > 0) {
    recs.push({ type: 'info', title: 'Acquisition hors-cadre', text: `L'élève déclare ne pas avoir vu : ${reussitesInattendues.map(c=>c.title).join(', ')} mais réussit les items associés. Vérifier rapidement s'il s'agit d'une vraie acquisition ou d'une réussite ponctuelle.` });
  }

  return recs;
};

// ============================================================================
// --- /lib/storage.ts ---
// ============================================================================

const validateAndRepairImport = (json) => {
  const requiredKeys = ['version', 'timestamp', 'profile', 'progress', 'qcmAnswers', 'openAnswers', 'teacherGrades', 'isTeacherGraded'];
  const missingKeys = requiredKeys.filter(k => !(k in json));
  
  if (missingKeys.length > 0) {
     return { isValid: false, error: `Champs manquants : ${missingKeys.join(', ')}` };
  }

  const repairReport = [];
  const repairedQcm = {};
  let qcmIgnored = 0;

  if (json.qcmAnswers && typeof json.qcmAnswers === 'object') {
     Object.keys(json.qcmAnswers).forEach(k => {
        const qDef = QUESTIONS_QCM.find(q=>q.id===k);
        if(qDef) {
           const val = parseInt(json.qcmAnswers[k], 10);
           if ([-1, 0, 1, 2, 3].includes(val)) {
               repairedQcm[k] = val;
           } else {
               qcmIgnored++;
           }
        } else {
           qcmIgnored++;
        }
     });
  }
  if (qcmIgnored > 0) repairReport.push(`${qcmIgnored} réponses QCM invalides ignorées.`);

  let progressIgnored = 0;
  let progressClamped = 0;
  const repairedProgress = {};
  if (json.progress && typeof json.progress === 'object') {
     Object.keys(json.progress).forEach(k => {
        const chap = CHAPTERS.find(c => c.id === k);
        if (chap) {
           const p = json.progress[k];
           let declared = p.declared;
           let confidence = p.confidence;
           let changed = false;

           if (declared !== null && declared !== undefined) {
              const parsedD = parseInt(declared, 10);
              if (isNaN(parsedD) || parsedD < 0 || parsedD > 5) {
                 declared = null; changed = true;
              } else { declared = parsedD; }
           }

           if (confidence !== null && confidence !== undefined) {
              const parsedC = parseInt(confidence, 10);
              if (isNaN(parsedC) || parsedC < 1 || parsedC > 5) {
                 confidence = null; changed = true;
              } else { confidence = parsedC; }
           }

           if (changed) progressClamped++;
           repairedProgress[k] = { declared, confidence, comment: typeof p.comment === 'string' ? p.comment : '' };
        } else {
           progressIgnored++;
        }
     });
  }
  if (progressIgnored > 0) repairReport.push(`${progressIgnored} entrées d'avancement ignorées (chapitres inconnus).`);
  if (progressClamped > 0) repairReport.push(`${progressClamped} statuts d'avancement corrigés (valeurs hors limites).`);

  const repairedGrades = {};
  let gradesIgnored = 0;
  let gradesClamped = 0;

  if (json.teacherGrades && typeof json.teacherGrades === 'object') {
     Object.keys(json.teacherGrades).forEach(k => {
       const questionDef = QUESTIONS_OPEN.find(q=>q.id===k);
       if (questionDef) {
         const oldGrade = json.teacherGrades[k];
         const rawScore = oldGrade.score;
         let safeScore = '';
         if (rawScore !== '' && rawScore !== undefined && rawScore !== null) {
            safeScore = clampScore(rawScore, 0, questionDef.maxPoints);
            if (Number(rawScore) !== safeScore) gradesClamped++;
         }

         const safeCriteria = {};
         if (oldGrade.criteria && typeof oldGrade.criteria === 'object') {
            Object.keys(oldGrade.criteria).forEach(cIdx => {
                const maxCrit = questionDef.rubrics[cIdx]?.points || 0;
                let critVal = oldGrade.criteria[cIdx];
                if (critVal !== '' && critVal !== null && critVal !== undefined) {
                  safeCriteria[cIdx] = clampScore(critVal, 0, maxCrit);
                } else {
                  safeCriteria[cIdx] = '';
                }
            });
         }

         repairedGrades[k] = {
            ...oldGrade,
            score: safeScore,
            mode: oldGrade.mode === 'detailed' ? 'detailed' : 'global',
            errors: Array.isArray(oldGrade.errors) ? oldGrade.errors : [],
            comment: typeof oldGrade.comment === 'string' ? oldGrade.comment : '',
            criteria: safeCriteria
         };
       } else {
         gradesIgnored++;
       }
     });
  }
  if (gradesIgnored > 0) repairReport.push(`${gradesIgnored} entrée teacherGrades inconnue supprimée.`);
  if (gradesClamped > 0) repairReport.push(`${gradesClamped} scores ouverts ramenés au maximum autorisé.`);

  return {
     isValid: true,
     repairReport,
     data: {
       ...json,
       progress: repairedProgress,
       qcmAnswers: repairedQcm,
       teacherGrades: repairedGrades
     }
  };
};

// ============================================================================
// --- /components/common/ ---
// ============================================================================

// TODO PRODUCTION:
// - installer react-katex ou better-react-mathjax ;
// - importer le CSS 'katex/dist/katex.min.css'
// - remplacer les blocs $...$ par InlineMath et $$...$$ par BlockMath.
const MathRenderer = ({ content }) => {
  if (!content) return null;
  const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
  return <span className="text-slate-800 leading-relaxed font-sans">{parts.map((part, i) => {
      if (part.startsWith('$$')) {
        return <div key={i} className="font-serif italic text-center my-3 text-lg bg-slate-50 py-3 rounded-lg border border-slate-100 shadow-sm overflow-x-auto">{part.slice(2, -2)}</div>;
      }
      if (part.startsWith('$')) {
        return <span key={i} className="font-serif italic bg-slate-100 px-1.5 py-0.5 rounded mx-0.5 whitespace-nowrap">{part.slice(1, -1)}</span>;
      }
      return <span key={i}>{part}</span>;
  })}</span>;
};

const Badge = ({ children, status }) => {
  const colors = {
    'Non renseigné': 'bg-slate-200 text-slate-500 border-slate-300 border-dashed',
    'Non encore vu': 'bg-slate-100 text-slate-600 border-slate-200',
    'Découverte prioritaire': 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
    'Déclaré vu mais non évalué': 'bg-purple-100 text-purple-700 border-purple-200',
    'Non vu déclaré, réussite observée': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'Lacune critique': 'bg-red-100 text-red-700 border-red-200',
    'Très fragile': 'bg-orange-100 text-orange-700 border-orange-200',
    'Fragile': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'À consolider': 'bg-blue-100 text-blue-700 border-blue-200',
    'Maîtrisé': 'bg-green-100 text-green-700 border-green-200',
    'Point fort': 'bg-teal-100 text-teal-700 border-teal-200',
  };
  const color = colors[status] || 'bg-slate-100 text-slate-800';
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${color} whitespace-nowrap`}>{children}</span>;
};

const Button = ({ children, onClick, variant = 'primary', className = '', disabled=false }) => {
  const base = "inline-flex items-center justify-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "border-transparent text-white bg-slate-900 hover:bg-slate-800",
    secondary: "border-slate-300 text-slate-700 bg-white hover:bg-slate-50",
    danger: "border-transparent text-white bg-red-600 hover:bg-red-700",
    warning: "border-transparent text-white bg-orange-500 hover:bg-orange-600",
  };
  return <button disabled={disabled} onClick={onClick} className={`${base} ${variants[variant]} ${className}`}>{children}</button>;
};

// ============================================================================
// --- /components/diagnostic/ ---
// ============================================================================

const IntroStep = ({ onNext }) => (
  <div className="max-w-3xl mx-auto text-center space-y-8 mt-12">
    <div className="mx-auto w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shadow-inner"><Target size={40} /></div>
    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Diagnostic Bac Maths</h1>
    <p className="text-xl text-slate-600">Plateforme d'évaluation Terminale Spécialité Mathématiques</p>
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 text-left space-y-4">
      <h3 className="font-semibold text-slate-800 flex items-center"><CheckCircle className="w-5 h-5 mr-2 text-green-500"/> Objectif du diagnostic</h3>
      <p className="text-slate-600 text-sm">Ce diagnostic est un outil d'aide à la décision pédagogique, pas une machine à noter. Il identifie précisément ce que tu maîtrises, ce qui est fragile et ce qui n’a pas encore été vu pour générer un parcours intensif de 16h adapté à ton profil.</p>
    </div>
    <Button onClick={onNext} className="text-lg px-8 py-4">Démarrer le diagnostic <ChevronRight className="ml-2 w-5 h-5"/></Button>
  </div>
);

const ProfileStep = ({ profile, setProfile, onNext }) => (
  <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-slate-200 mt-12">
    <h2 className="text-2xl font-bold text-slate-900 mb-6">Profil de l'élève</h2>
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium mb-1">Prénom</label><input type="text" className="w-full p-2 border rounded" value={profile.firstName||''} onChange={e => setProfile({ ...profile, firstName: e.target.value})} /></div>
        <div><label className="block text-sm font-medium mb-1">Nom</label><input type="text" className="w-full p-2 border rounded" value={profile.lastName||''} onChange={e => setProfile({ ...profile, lastName: e.target.value})} /></div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Objectif visé au Bac</label>
        <select className="w-full p-2 border rounded" value={profile.targetGrade||''} onChange={e => setProfile({ ...profile, targetGrade: e.target.value})}>
          <option value="">Sélectionner...</option><option value="10">La moyenne</option><option value="12">Viser 12 (AB)</option><option value="14">Viser 14 (B)</option><option value="16">Viser 16+ (TB)</option>
        </select>
      </div>
      <div className="flex justify-end pt-4"><Button onClick={onNext}>Avancement par chapitre <ChevronRight className="ml-2"/></Button></div>
    </div>
  </div>
);

const ProgressStep = ({ progress, setProgress, onNext }) => {
  const [currentDomainIdx, setCurrentDomainIdx] = useState(0);
  const [showAlert, setShowAlert] = useState(false);
  
  const domain = DOMAINS[currentDomainIdx];
  const domainChapters = CHAPTERS.filter(c => c.domainId === domain.id);

  const updateProg = (cId, field, val) => {
    setProgress(prev => ({ 
      ...prev, 
      [cId]: { ...(prev[cId] || { declared: null, confidence: 3 }), [field]: val } 
    }));
    setShowAlert(false);
  };

  const handleNextDomain = () => {
    const allFilled = domainChapters.every(c => progress[c.id] && progress[c.id].declared !== null && progress[c.id].declared !== undefined);
    if (!allFilled && !showAlert) {
      setShowAlert(true);
      return;
    }
    if (currentDomainIdx < DOMAINS.length - 1) {
      setCurrentDomainIdx(currentDomainIdx + 1);
      setShowAlert(false);
    } else {
      onNext();
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Étape 1 : Avancement</h2>
        <span className="bg-blue-100 text-blue-800 text-sm font-bold px-3 py-1 rounded-full">Domaine {currentDomainIdx + 1}/{DOMAINS.length}</span>
      </div>

      {showAlert && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 flex gap-3">
          <AlertTriangle className="text-yellow-500 shrink-0"/>
          <div>
            <h3 className="font-bold text-yellow-800">Chapitres non renseignés</h3>
            <p className="text-sm text-yellow-700">Certains chapitres n'ont pas de statut renseigné. Ils seront exclus des révisions prioritaires jusqu'à clarification. Clique sur "Je complèterai plus tard" pour continuer.</p>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-xl font-bold text-blue-900 mb-6 border-b pb-3">{domain.title}</h3>
        <div className="space-y-6">
          {domainChapters.map(chap => {
            const p = progress[chap.id] || {};
            const isMissing = p.declared === null || p.declared === undefined;
            return (
              <div key={chap.id} className={`p-4 bg-slate-50 border rounded-lg transition-colors ${isMissing && showAlert ? 'border-red-300 bg-red-50' : 'border-slate-100'}`}>
                <div className="flex justify-between items-center mb-3">
                   <div className="font-semibold text-slate-800">{chap.title}</div>
                   {isMissing ? <Badge status="Non renseigné">Non renseigné</Badge> : <CheckCircle className="w-4 h-4 text-green-500"/>}
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Statut en classe</label>
                    <select className="w-full text-sm p-2 border rounded bg-white" value={isMissing ? "" : p.declared} onChange={e => updateProg(chap.id, 'declared', parseInt(e.target.value, 10))}>
                      <option value="" disabled>Choisis un statut...</option>
                      <option value="0">Pas encore vu</option><option value="1">Vu rapidement</option><option value="2">Vu mais peu exercé</option><option value="3">Vu et exercé</option><option value="4">Vu, exercé, évalué</option><option value="5">Je pense maîtriser</option>
                    </select>
                  </div>
                  {!isMissing && p.declared > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Confiance (1=Perdu, 5=À l'aise)</label>
                      <input type="range" min="1" max="5" step="1" className="w-full mt-2" value={p.confidence || 3} onChange={e => updateProg(chap.id, 'confidence', parseInt(e.target.value, 10))} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex justify-between mt-6 pb-12">
        <Button variant="secondary" disabled={currentDomainIdx===0} onClick={() => {setCurrentDomainIdx(currentDomainIdx-1); setShowAlert(false);}}><ChevronLeft className="mr-2"/> Précédent</Button>
        <Button onClick={handleNextDomain} variant={showAlert ? 'warning' : 'primary'}>
          {showAlert ? 'Je complèterai plus tard' : (currentDomainIdx < DOMAINS.length - 1 ? 'Domaine Suivant' : 'Passer aux QCM')} <ChevronRight className="ml-2"/>
        </Button>
      </div>
    </div>
  );
};

const QcmStep = ({ qcmAnswers, setQcmAnswers, onNext }) => {
  const [currentBlock, setCurrentBlock] = useState(0);
  const [showValidation, setShowValidation] = useState(false);
  const questionsPerBlock = 6;
  const totalBlocks = Math.ceil(QUESTIONS_QCM.length / questionsPerBlock);
  const blockQuestions = QUESTIONS_QCM.slice(currentBlock * questionsPerBlock, (currentBlock + 1) * questionsPerBlock);
  
  const handleNext = () => {
    if (currentBlock < totalBlocks - 1) {
      setCurrentBlock(currentBlock + 1);
    } else {
      setShowValidation(true);
    }
  };

  if (showValidation) {
    const answered = QUESTIONS_QCM.filter(q => qcmAnswers[q.id] >= 0).length;
    const dontKnow = QUESTIONS_QCM.filter(q => qcmAnswers[q.id] === -1).length;
    const unanswered = QUESTIONS_QCM.length - answered - dontKnow;

    return (
      <div className="max-w-2xl mx-auto mt-12 bg-white p-8 rounded-xl shadow border text-center">
        <HelpCircle className="w-16 h-16 text-blue-500 mx-auto mb-4"/>
        <h2 className="text-2xl font-bold mb-6">Bilan du QCM</h2>
        <div className="grid grid-cols-3 gap-4 mb-8 text-slate-700">
           <div className="bg-slate-50 p-4 rounded border"><div className="text-3xl font-bold text-slate-900">{answered}</div><div className="text-sm">Répondues</div></div>
           <div className="bg-slate-50 p-4 rounded border"><div className="text-3xl font-bold text-slate-900">{dontKnow}</div><div className="text-sm">Je ne sais pas</div></div>
           <div className={`p-4 rounded border ${unanswered > 0 ? 'bg-orange-50 border-orange-200' : 'bg-slate-50'}`}><div className={`text-3xl font-bold ${unanswered > 0 ? 'text-orange-600' : 'text-slate-900'}`}>{unanswered}</div><div className="text-sm">Non répondues</div></div>
        </div>
        {unanswered > 0 && <p className="text-sm text-slate-500 mb-6">Tu as laissé {unanswered} question(s) sans réponse. Veux-tu y retourner ou as-tu terminé cette partie ?</p>}
        <div className="flex justify-center gap-4">
           <Button variant="secondary" onClick={() => setShowValidation(false)}>Revenir aux QCM</Button>
           <Button onClick={onNext}>Passer aux Questions Ouvertes <ChevronRight className="ml-2"/></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto mt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Étape 2 : QCM Interactifs</h2>
        <span className="bg-blue-100 text-blue-800 text-sm font-bold px-3 py-1 rounded-full">Bloc {currentBlock + 1}/{totalBlocks}</span>
      </div>
      <div className="space-y-6">
        {blockQuestions.map(q => {
          const cAns = qcmAnswers[q.id];
          return (
            <div key={q.id} className={`bg-white p-6 rounded-xl shadow-sm border transition-colors ${cAns === undefined ? 'border-slate-200' : (cAns===-1 ? 'border-slate-300 bg-slate-50' : 'border-blue-200 bg-blue-50/30')}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-600">{CHAPTERS.find(c=>c.id === q.chapterId)?.title}</span>
                <span className="text-xs font-bold text-blue-500 uppercase border border-blue-200 px-2 py-1 rounded-full">{q.skillType}</span>
                <span className="text-xs font-bold text-slate-400 border px-2 py-1 rounded-full">Niv {q.difficulty}</span>
              </div>
              <div className="font-medium text-lg mb-4"><MathRenderer content={q.statement}/></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {q.choices.map((choice, idx) => (
                  <button key={idx} onClick={() => setQcmAnswers(prev => ({ ...prev, [q.id]: idx }))}
                    className={`p-3 text-left border rounded-lg transition-colors ${cAns === idx ? 'border-blue-500 bg-blue-50 text-blue-800 font-medium' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <MathRenderer content={choice}/>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex justify-end">
                 <button onClick={() => setQcmAnswers(prev => ({ ...prev, [q.id]: -1 }))} className={`text-sm px-4 py-2 rounded border transition-colors ${cAns === -1 ? 'bg-slate-200 border-slate-300 text-slate-700 font-bold' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>Je ne sais pas</button>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-8 pb-12">
        <Button variant="secondary" disabled={currentBlock===0} onClick={() => setCurrentBlock(currentBlock-1)}><ChevronLeft className="mr-2"/> Précédent</Button>
        <Button onClick={handleNext}>{currentBlock < totalBlocks - 1 ? 'Bloc Suivant' : 'Terminer QCM'} <ChevronRight className="ml-2"/></Button>
      </div>
    </div>
  );
};

const OpenStep = ({ openAnswers, setOpenAnswers, onFinish }) => {
  const [currentEx, setCurrentEx] = useState(0);
  const [showValidation, setShowValidation] = useState(false);
  const q = QUESTIONS_OPEN[currentEx];
  const ans = openAnswers[q?.id] || { text: '', status: '' };

  const updateAns = (field, val) => {
    setOpenAnswers(prev => ({
      ...prev,
      [q.id]: { ...(prev[q.id] || { text: '', status: '' }), [field]: val }
    }));
  };

  const handleNext = () => {
    if (currentEx < QUESTIONS_OPEN.length - 1) setCurrentEx(currentEx + 1);
    else setShowValidation(true);
  };

  if (showValidation) {
    const withDraft = Object.values(openAnswers).filter(a => a.text && a.text.trim().length > 5).length;
    const withStatus = Object.values(openAnswers).filter(a => a.status).length;
    const isMissing = withDraft === 0 && withStatus === 0;

    return (
      <div className="max-w-2xl mx-auto mt-12 bg-white p-8 rounded-xl shadow border text-center">
        <FileQuestion className="w-16 h-16 text-blue-500 mx-auto mb-4"/>
        <h2 className="text-2xl font-bold mb-6">Validation Finale</h2>
        <div className="grid grid-cols-2 gap-4 mb-8 text-slate-700">
           <div className="bg-slate-50 p-4 rounded border"><div className="text-3xl font-bold text-slate-900">{withDraft} / {QUESTIONS_OPEN.length}</div><div className="text-sm">Brouillons saisis</div></div>
           <div className="bg-slate-50 p-4 rounded border"><div className="text-3xl font-bold text-slate-900">{withStatus} / {QUESTIONS_OPEN.length}</div><div className="text-sm">Ressentis indiqués</div></div>
        </div>
        {isMissing && <p className="text-sm text-slate-500 mb-6 bg-slate-50 p-3 rounded">Certains exercices ne contiennent aucune information exploitable. Ton enseignant aura du mal à t'évaluer sur ces points.</p>}
        <div className="flex justify-center gap-4">
           <Button variant="secondary" onClick={() => setShowValidation(false)}>Revenir aux Exercices</Button>
           <Button onClick={onFinish}>Générer mon Bilan Diagnostic <Check className="ml-2"/></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto mt-8 pb-12">
       <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Étape 3 : Exercices de rédaction</h2>
        <span className="bg-blue-100 text-blue-800 text-sm font-bold px-3 py-1 rounded-full">Exercice {currentEx + 1}/{QUESTIONS_OPEN.length}</span>
      </div>
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-8">
        <div className="flex-1 space-y-4">
          <h3 className="font-bold text-lg text-slate-800 border-b pb-2">{q.title}</h3>
          <div className="bg-slate-50 p-5 rounded-lg border border-slate-100 text-slate-700 whitespace-pre-wrap"><MathRenderer content={q.statement}/></div>
        </div>
        <div className="flex-1 flex flex-col space-y-5">
          <div>
            <label className="block text-sm font-bold mb-2 text-slate-800">Ton ressenti avant de commencer :</label>
            <div className="flex flex-col gap-2">
              {["Je sais faire", "Je sais commencer mais je bloque", "Je ne sais pas démarrer"].map(status => (
                <button key={status} onClick={() => updateAns('status', status)} className={`px-4 py-2 text-sm rounded-lg border font-medium text-left transition-colors ${ans.status === status ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-600'}`}>{status}</button>
              ))}
            </div>
          </div>
          <div className="flex-grow flex flex-col">
            <label className="block text-sm font-bold mb-2 text-slate-800">Brouillon / Grandes étapes :</label>
            <textarea className="w-full flex-grow p-4 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Saisis ici tes premières idées, formules ou étapes clés. Ton enseignant lira cette case pour t'aider..." value={ans.text} onChange={e => updateAns('text', e.target.value)}></textarea>
          </div>
        </div>
      </div>
      <div className="flex justify-between mt-8">
        <Button variant="secondary" disabled={currentEx===0} onClick={() => setCurrentEx(currentEx-1)}><ChevronLeft className="mr-2"/> Précédent</Button>
        <Button onClick={handleNext}>{currentEx < QUESTIONS_OPEN.length - 1 ? 'Exercice Suivant' : 'Terminer'} <ChevronRight className="ml-2"/></Button>
      </div>
    </div>
  );
};

const PostStagePlan = ({ evaluatedData, teacherGrades }) => {
  const plan = generatePostStagePlan(evaluatedData, teacherGrades);
  return (
    <div className="mt-8 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <h3 className="font-bold text-2xl mb-6 text-slate-800">Plan Post-Stage (Jusqu'au Bac)</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {plan.map((week, idx) => (
           <div key={idx} className="bg-slate-50 p-4 rounded-lg border flex flex-col h-full">
             <div className="text-xs font-bold text-blue-600 uppercase mb-1">{week.week}</div>
             <div className="font-bold text-slate-800 mb-2 leading-tight flex-grow">{week.title}</div>
             <div className="text-sm text-slate-600 mb-3">{week.desc}</div>
             {week.deliverable && <div className="text-[10px] font-bold uppercase text-slate-400 border-t pt-2 mt-auto">Livrable : <span className="text-slate-700">{week.deliverable}</span></div>}
           </div>
        ))}
      </div>
    </div>
  )
};

const ResultsStep = ({ evaluatedData, onSwitchRole, teacherGrades }) => {
  const { globalRawScore, globalMaxScore, globalPercentage, qcmRawScore, qcmMaxScore, qcmPercentage, qcmDontKnowCount, qcmUnansweredCount, openRawScore, openMaxScore, isProvisional, calculatedProfile, chapterResults } = evaluatedData;
  const path = generateAdvancedPath(chapterResults);

  const priorites = chapterResults.filter(c => c.pedagogicalStatus === 'Lacune critique' || c.pedagogicalStatus === 'Très fragile');
  const illusions = chapterResults.filter(c => c.isIllusion);
  const nonEvalues = chapterResults.filter(c => c.pedagogicalStatus === 'Déclaré vu mais non évalué');
  const nonRenseignes = chapterResults.filter(c => c.pedagogicalStatus === 'Non renseigné');
  const nonVus = chapterResults.filter(c => c.pedagogicalStatus === 'Non encore vu' || c.pedagogicalStatus === 'Découverte prioritaire');
  const reussitesInattendues = chapterResults.filter(c => c.declaredNotSeenButSucceeded);

  return (
    <div className="max-w-5xl mx-auto mt-8 space-y-8 print:p-0 pb-12">
      <div className="flex justify-between items-center print:hidden">
        <h1 className="text-3xl font-bold">Ton Bilan Diagnostic</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.print()}><Download className="w-4 h-4 mr-2"/> PDF</Button>
          <Button onClick={onSwitchRole}><User className="w-4 h-4 mr-2"/> Espace Enseignant</Button>
        </div>
      </div>

      {isProvisional && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex gap-3 shadow-sm">
          <AlertTriangle className="text-yellow-500 shrink-0 mt-0.5"/>
          <div>
            <h3 className="font-bold text-yellow-800">Bilan Provisoire</h3>
            <p className="text-yellow-700 text-sm">Profil provisoire basé uniquement sur le QCM. Le score final sera recalculé après correction des questions ouvertes par ton enseignant.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col justify-center items-center shadow-sm">
           <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Score {isProvisional ? 'QCM' : 'Global'}</div>
           <div className="text-6xl font-black text-slate-900">{isProvisional ? qcmRawScore : globalRawScore}<span className="text-2xl text-slate-400">/{isProvisional ? qcmMaxScore : globalMaxScore}</span></div>
           <div className="mt-3 text-sm text-slate-500 border-t pt-2 w-full text-center">
             {isProvisional 
               ? <span>Pourcentage QCM : {qcmPercentage}% <br/>Je ne sais pas : {qcmDontKnowCount} | Vides : {qcmUnansweredCount}</span> 
               : <span>QCM : {qcmRawScore}/48 | Ouvert : {openRawScore}/52 <br/> Pourcentage Global : {globalPercentage}%</span>}
           </div>
         </div>
         <div className="col-span-2 bg-slate-900 text-white p-6 rounded-xl shadow-sm flex flex-col justify-center">
           <h3 className="font-bold text-xl mb-3 flex items-center"><Brain className="mr-2 text-blue-400 w-6 h-6"/> Profil : {calculatedProfile.label}</h3>
           <p className="text-slate-300 text-lg leading-relaxed">{calculatedProfile.desc}</p>
         </div>
      </div>

      {illusions.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 p-5 rounded-xl shadow-sm">
          <h3 className="font-bold text-orange-800 mb-2 flex items-center"><ShieldAlert className="mr-2"/> Attention - Illusion de maîtrise</h3>
          <p className="text-sm text-orange-700 mb-3">Tu as déclaré être très confiant sur ces chapitres, mais le QCM révèle des fragilités importantes :</p>
          <div className="flex flex-wrap gap-2">{illusions.map(c => <Badge key={c.chapterId} status="Très fragile">{c.title}</Badge>)}</div>
        </div>
      )}

      {reussitesInattendues.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 p-5 rounded-xl shadow-sm">
          <h3 className="font-bold text-indigo-800 mb-2 flex items-center"><CheckCircle className="mr-2"/> Réussites Inattendues</h3>
          <p className="text-sm text-indigo-700 mb-3">Tu as réussi les questions sur ces chapitres alors que tu pensais ne pas les avoir vus :</p>
          <div className="flex flex-wrap gap-2">{reussitesInattendues.map(c => <Badge key={c.chapterId} status="Non vu déclaré, réussite observée">{c.title}</Badge>)}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         <div>
           <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center"><Target className="mr-2 text-red-500"/> Urgences de révision</h3>
           <div className="bg-white rounded-xl border divide-y">
             {priorites.length === 0 && <div className="p-4 text-sm text-slate-500">Aucune urgence détectée.</div>}
             {priorites.slice(0,6).map(c => <div key={c.chapterId} className="p-3 flex justify-between"><span className="text-sm font-medium">{c.title}</span><Badge status={c.pedagogicalStatus}>{c.pedagogicalStatus}</Badge></div>)}
           </div>
         </div>
         <div className="space-y-6">
           <div>
             <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center"><EyeOff className="mr-2 text-slate-400"/> Chapitres à vérifier</h3>
             <div className="bg-white rounded-xl border divide-y">
               {nonEvalues.length === 0 && nonRenseignes.length === 0 && <div className="p-3 text-sm text-slate-500">Tous tes chapitres vus ont été évalués.</div>}
               {nonEvalues.slice(0,4).map(c => <div key={c.chapterId} className="p-3 flex justify-between"><span className="text-sm text-slate-600">{c.title}</span><Badge status={c.pedagogicalStatus}>Non évalué</Badge></div>)}
               {nonRenseignes.slice(0,2).map(c => <div key={c.chapterId} className="p-3 flex justify-between"><span className="text-sm text-slate-600">{c.title}</span><Badge status={c.pedagogicalStatus}>Non renseigné</Badge></div>)}
             </div>
           </div>
           {nonVus.length > 0 && (
             <div>
               <h3 className="font-bold text-lg mb-3 text-slate-800">Notions non vues en classe</h3>
               <div className="flex flex-wrap gap-2">{nonVus.map(c => <Badge key={c.chapterId} status={c.pedagogicalStatus}>{c.title}</Badge>)}</div>
             </div>
           )}
         </div>
      </div>

      <div>
         <h3 className="font-bold text-2xl mb-6 flex items-center"><Clock className="mr-2 text-blue-600"/> Ton Parcours Intensif (16h)</h3>
         <div className="space-y-4">
           {path.map(session => (
             <div key={session.num} className="bg-white p-5 rounded-xl border shadow-sm flex flex-col md:flex-row gap-6">
               <div className="w-16 h-16 bg-blue-50 text-blue-700 rounded-lg flex flex-col items-center justify-center font-bold shrink-0">
                 <span className="text-xs uppercase">S{session.num}</span>
               </div>
               <div className="flex-grow">
                 <div className="flex justify-between items-start mb-2">
                   <div>
                     <div className="text-xs text-blue-500 font-bold uppercase tracking-wider mb-1">{session.type}</div>
                     <h4 className="font-bold text-lg text-slate-800">{session.title}</h4>
                   </div>
                   <div className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">{session.duration}</div>
                 </div>
                 <p className="text-sm text-slate-600 font-medium mb-3">Objectifs : {session.objectives.join(' • ')}</p>
                 {session.skills && session.skills.length > 0 && <div className="text-xs text-slate-500 mb-3">Compétences : {session.skills.join(', ')}</div>}
                 
                 <div className="bg-slate-50 p-3 rounded border border-slate-100 text-sm">
                    <strong className="text-slate-700 block mb-1">Activités prévues :</strong>
                    <ul className="list-disc pl-4 text-slate-600 space-y-0.5">
                      {session.activities.map((a,i) => <li key={i}>{a}</li>)}
                    </ul>
                 </div>
                 
                 <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
                    <div>
                      <strong className="text-slate-800 block mb-1">Trace Écrite :</strong> 
                      <span className="bg-yellow-50 px-2 py-1 rounded border border-yellow-100 block">{session.writtenTrace}</span>
                    </div>
                    <div>
                      <strong className="text-slate-800 block mb-1">Vérification Orale :</strong> 
                      <span className="bg-green-50 px-2 py-1 rounded border border-green-100 block">{session.oralCheck}</span>
                    </div>
                 </div>

                 <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600 border-t pt-3">
                    <div><strong className="text-slate-800 block">Critère de réussite :</strong> {session.criteria}</div>
                    <div><strong className="text-slate-800 block">Devoir court :</strong> {session.homework}</div>
                 </div>
               </div>
             </div>
           ))}
         </div>
      </div>

      <PostStagePlan evaluatedData={evaluatedData} teacherGrades={teacherGrades} />

    </div>
  );
};

// ============================================================================
// --- /components/teacher/ ---
// ============================================================================

const TeacherQuickSynthesis = ({ evaluatedData, teacherGrades }) => {
  const { isProvisional, calculatedProfile, chapterResults } = evaluatedData;
  const urgencies = chapterResults.filter(c => c.pedagogicalStatus === 'Lacune critique' || c.pedagogicalStatus === 'Très fragile')
                                  .sort((a,b)=> b.priorityScore - a.priorityScore).slice(0,3);
  const topErrors = aggregateTeacherErrors(teacherGrades).slice(0,2);
  const toClarify = chapterResults.filter(c => c.pedagogicalStatus === 'Non renseigné');
  const unlookedButSucceeded = chapterResults.filter(c => c.declaredNotSeenButSucceeded);

  return (
    <div className="bg-blue-900 text-white p-6 rounded-xl shadow-lg mb-8">
      <h2 className="text-xl font-bold mb-4 flex items-center"><Zap className="mr-2 text-yellow-400"/> À lire avant la première séance (5 min)</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
           <div className="text-blue-200 text-xs font-bold uppercase mb-1">1. Profil Général</div>
           <div className="font-bold text-lg">{calculatedProfile.label} {isProvisional && <span className="text-xs bg-yellow-500 text-yellow-900 px-1 rounded ml-1">Provisoire</span>}</div>
           <div className="text-sm text-blue-100 mt-1">{calculatedProfile.desc}</div>
        </div>
        <div>
           <div className="text-blue-200 text-xs font-bold uppercase mb-1">2. Top 3 Urgences</div>
           <ul className="text-sm list-disc pl-4 text-blue-50">
             {urgencies.length > 0 ? urgencies.map(u => <li key={u.chapterId}>{u.title}</li>) : <li>Aucune urgence majeure</li>}
           </ul>
        </div>
        <div>
           <div className="text-blue-200 text-xs font-bold uppercase mb-1">3. Points d'attention</div>
           <ul className="text-sm list-disc pl-4 text-blue-50 mb-2">
             {topErrors.length > 0 ? topErrors.map(e => <li key={e[0]}>{e[0]}</li>) : <li>Aucune erreur type corrigée</li>}
           </ul>
           {toClarify.length > 0 && <div className="text-xs bg-blue-800 p-2 rounded border border-blue-700 mb-1">⚠️ {toClarify.length} chapitre(s) non renseigné(s).</div>}
           {unlookedButSucceeded.length > 0 && <div className="text-xs bg-indigo-800 p-2 rounded border border-indigo-700">⚠️ {unlookedButSucceeded.length} chapitre(s) non vu(s) déclaré(s) mais réussi(s).</div>}
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-blue-800">
         <div className="text-blue-200 text-xs font-bold uppercase mb-1">Action Recommandée Séance 1</div>
         <div className="text-sm font-medium">
           {toClarify.length > 0 ? "Commencer par clarifier le déclaratif des chapitres non renseignés, puis attaquer d'urgence " : "Commencer par une correction guidée des QCM échoués, puis attaquer d'urgence "} 
           {urgencies[0]?.title || 'des exercices transversaux'}.
         </div>
      </div>
    </div>
  );
};

const TeacherQcmAnalysis = ({ qcmAnswers }) => {
  const [filter, setFilter] = useState('all'); 
  const [filterDomain, setFilterDomain] = useState('all');
  const [filterChapter, setFilterChapter] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [filterSkill, setFilterSkill] = useState('all');

  const getStatus = (ans, correct) => {
    if (ans === undefined || ans === null) return 'vide';
    if (ans === -1) return 'je_ne_sais_pas';
    if (ans === correct) return 'juste';
    return 'faux';
  };

  const filteredQcm = QUESTIONS_QCM.filter(q => {
    const status = getStatus(qcmAnswers[q.id], q.correct);
    const chap = CHAPTERS.find(c=>c.id === q.chapterId);
    const domainPass = filterDomain === 'all' ? true : chap?.domainId === filterDomain;
    const chapterPass = filterChapter === 'all' ? true : q.chapterId === filterChapter;
    const statusPass = filter === 'all' ? true : status === filter;
    const diffPass = filterDifficulty === 'all' ? true : q.difficulty === parseInt(filterDifficulty, 10);
    const skillPass = filterSkill === 'all' ? true : q.skillType === filterSkill;
    return domainPass && chapterPass && statusPass && diffPass && skillPass;
  });

  const uniqueSkills = [...new Set(QUESTIONS_QCM.map(q => q.skillType))];
  const uniqueDiffs = [...new Set(QUESTIONS_QCM.map(q => q.difficulty))].sort();

  return (
    <div className="bg-white p-6 rounded-xl border shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <h3 className="font-bold text-lg text-slate-800">Analyse détaillée du QCM</h3>
        <div className="flex flex-wrap gap-2">
          <select className="p-2 border rounded text-xs bg-slate-50" value={filterDomain} onChange={e=> { setFilterDomain(e.target.value); setFilterChapter('all'); }}>
            <option value="all">Tous les domaines</option>
            {DOMAINS.map(d=><option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
          <select className="p-2 border rounded text-xs bg-slate-50" value={filterChapter} onChange={e=>setFilterChapter(e.target.value)}>
            <option value="all">Tous les chapitres</option>
            {CHAPTERS.filter(c => filterDomain === 'all' || c.domainId === filterDomain).map(c=><option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <select className="p-2 border rounded text-xs bg-slate-50" value={filterDifficulty} onChange={e=>setFilterDifficulty(e.target.value)}>
            <option value="all">Toutes difficultés</option>
            {uniqueDiffs.map(d=><option key={d} value={d}>Niveau {d}</option>)}
          </select>
          <select className="p-2 border rounded text-xs bg-slate-50" value={filterSkill} onChange={e=>setFilterSkill(e.target.value)}>
            <option value="all">Toutes compétences</option>
            {uniqueSkills.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <select className="p-2 border rounded text-xs bg-slate-50" value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="all">Tous les statuts</option>
            <option value="faux">Erreurs uniquement</option>
            <option value="je_ne_sais_pas">"Je ne sais pas" uniquement</option>
            <option value="vide">Non répondues</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto text-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Domaine / Chapitre</th>
              <th className="p-3">Détails (Diff & Compétence)</th>
              <th className="p-3">Énoncé</th>
              <th className="p-3 text-center">Rép Élève</th>
              <th className="p-3 text-center">Correcte</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Explication</th>
            </tr>
          </thead>
          <tbody className="divide-y text-xs">
            {filteredQcm.map(q => {
              const status = getStatus(qcmAnswers[q.id], q.correct);
              const badgeColors = { juste: 'bg-green-100 text-green-700', faux: 'bg-red-100 text-red-700', je_ne_sais_pas: 'bg-slate-200 text-slate-700', vide: 'bg-orange-100 text-orange-700' };
              const chap = CHAPTERS.find(c=>c.id === q.chapterId);
              const dom = DOMAINS.find(d=>d.id === chap?.domainId);
              
              const studentAnswerStr = status === 'je_ne_sais_pas' ? '?' : (status === 'vide' ? '-' : String.fromCharCode(65 + qcmAnswers[q.id]));
              const correctAnswerStr = String.fromCharCode(65 + q.correct);

              return (
                <tr key={q.id}>
                  <td className="p-3 font-mono text-slate-400">{q.id}</td>
                  <td className="p-3">
                     <span className="block text-[10px] text-slate-400 uppercase tracking-wide">{dom?.title}</span>
                     <span className="font-medium text-slate-700">{chap?.title}</span>
                  </td>
                  <td className="p-3">
                    <span className="inline-block border border-slate-200 px-1.5 py-0.5 rounded uppercase text-[10px] bg-slate-50 mb-1 mr-1">{q.skillType}</span>
                    <span className="inline-block border border-slate-200 px-1.5 py-0.5 rounded text-[10px] bg-slate-50 mb-1">Niv {q.difficulty}</span>
                    <span className="block text-[10px] text-slate-400">{q.skillTag}</span>
                  </td>
                  <td className="p-3 max-w-xs"><MathRenderer content={q.statement}/></td>
                  <td className="p-3 text-center font-bold text-slate-700 bg-slate-50">{studentAnswerStr}</td>
                  <td className="p-3 text-center font-bold text-green-600">{correctAnswerStr}</td>
                  <td className="p-3"><span className={`px-2 py-1 rounded font-bold whitespace-nowrap ${badgeColors[status]}`}>{status}</span></td>
                  <td className="p-3 text-slate-500 italic min-w-[200px]"><MathRenderer content={q.explanation}/></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const TeacherStep = ({ evaluatedData, qcmAnswers, openAnswers, teacherGrades, setTeacherGrades, onSubmitGrades, onBack }) => {
  const { chapterResults, domainScores, isProvisional, qcmRawScore, qcmMaxScore, qcmDontKnowCount, qcmUnansweredCount, openRawScore, openMaxScore, globalRawScore, globalMaxScore } = evaluatedData;
  const recs = generateRecommendations(chapterResults, domainScores, teacherGrades);

  const gradedCount = QUESTIONS_OPEN.filter(q => {
    const s = teacherGrades[q.id]?.score;
    return s !== undefined && s !== '' && Number.isFinite(Number(s));
  }).length;

  const ungradedQuestions = QUESTIONS_OPEN.filter(q => {
    const s = teacherGrades[q.id]?.score;
    return s === undefined || s === '' || !Number.isFinite(Number(s));
  });

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleValidationClick = () => {
    if (gradedCount < QUESTIONS_OPEN.length) {
      setShowConfirmModal(true);
    } else {
      onSubmitGrades();
    }
  };

  const confirmIncompleteGrades = () => {
    setShowConfirmModal(false);
    onSubmitGrades();
  };

  const handleModeChange = (qId, newMode) => {
    setTeacherGrades(prev => ({
      ...prev,
      [qId]: {
        ...(prev[qId] || { score: '', comment: '', errors: [], criteria: {} }),
        mode: newMode
      }
    }));
  };

  const handleGlobalGrade = (qId, val) => {
    const q = QUESTIONS_OPEN.find(q=>q.id===qId);
    let num = parseFloat(val);
    if (!Number.isFinite(num)) num = '';
    else num = clampScore(num, 0, q.maxPoints);

    setTeacherGrades(prev => ({
      ...prev, 
      [qId]: { 
        ...(prev[qId] || { comment: '', errors: [], mode: 'global', criteria: {} }), 
        score: num 
      }
    }));
  };

  const handleDetailedGrade = (qId, rubricIdx, val) => {
    const q = QUESTIONS_OPEN.find(q=>q.id===qId);
    let num = parseFloat(val);
    const max = q.rubrics[rubricIdx].points;
    if (!Number.isFinite(num)) num = '';
    else num = clampScore(num, 0, max);
    
    setTeacherGrades(prev => {
      const current = prev[qId] || { comment: '', errors: [], mode: 'detailed', criteria: {}, score: '' };
      const newCriteria = { ...(current.criteria || {}), [rubricIdx]: num };
      
      const sum = Object.values(newCriteria).reduce((a,b) => a + (Number(b)||0), 0);
      const newScore = clampScore(sum, 0, q.maxPoints);
      
      return { 
        ...prev, 
        [qId]: { 
          ...current, 
          criteria: newCriteria, 
          score: newScore, 
          mode: 'detailed' 
        } 
      };
    });
  };

  const handleErrorToggle = (qId, err) => {
    setTeacherGrades(prev => {
      const current = prev[qId] || { score: '', comment: '', mode: 'global', errors: [], criteria: {} };
      const currentErrors = current.errors || [];
      const newErrors = currentErrors.includes(err) ? currentErrors.filter(e => e !== err) : [...currentErrors, err];
      return {
        ...prev,
        [qId]: {
          ...current,
          errors: newErrors
        }
      };
    });
  };

  return (
    <div className="max-w-7xl mx-auto mt-8 space-y-8 pb-12 relative">
      
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-lg w-full">
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center"><AlertTriangle className="mr-2 text-red-500"/> Correction Incomplète</h3>
            <p className="text-slate-600 mb-4">Toutes les questions ouvertes ne sont pas corrigées. Les exercices non corrigés seront comptés 0 point dans le score final. Voulez-vous vraiment recalculer ?</p>
            <div className="bg-slate-50 p-3 rounded border mb-6 text-sm max-h-48 overflow-y-auto">
              <strong className="block mb-2">Questions non corrigées :</strong>
              <ul className="list-disc pl-4 text-slate-500">
                {ungradedQuestions.map(q => <li key={q.id}>{q.id} — {q.title}</li>)}
              </ul>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>Annuler</Button>
              <Button variant="danger" onClick={confirmIncompleteGrades}>Recalculer quand même</Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-black text-slate-900">Dashboard Enseignant</h1>
        <div className="flex gap-2">
          {isProvisional && <Button variant="warning" onClick={handleValidationClick}>Forcer Recalcul <Zap className="w-4 h-4 ml-1"/></Button>}
          <Button variant="secondary" onClick={onBack}><ChevronLeft className="mr-2"/> Vue Élève</Button>
        </div>
      </div>

      <TeacherQuickSynthesis evaluatedData={evaluatedData} teacherGrades={teacherGrades} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div className="bg-white p-5 rounded-xl border shadow-sm flex flex-col justify-center">
           <div className="text-sm font-bold text-slate-500 uppercase">Score Global</div>
           <div className="text-3xl font-black text-slate-900 mt-1">{isProvisional ? '-' : globalRawScore}<span className="text-lg text-slate-400">/{globalMaxScore}</span></div>
         </div>
         <div className="bg-white p-5 rounded-xl border shadow-sm">
           <div className="text-sm font-bold text-slate-500 uppercase flex items-center justify-between">Score QCM <BarChart2 className="w-4 h-4 text-blue-500"/></div>
           <div className="text-3xl font-black text-slate-900 mt-1">{qcmRawScore}<span className="text-lg text-slate-400">/{qcmMaxScore}</span></div>
           <div className="text-xs text-slate-500 mt-2 flex justify-between"><span>Je ne sais pas: {qcmDontKnowCount}</span><span>Vides: {qcmUnansweredCount}</span></div>
         </div>
         <div className="bg-white p-5 rounded-xl border shadow-sm">
           <div className="text-sm font-bold text-slate-500 uppercase flex items-center justify-between">Score Ouvert <Edit3 className="w-4 h-4 text-purple-500"/></div>
           <div className="text-3xl font-black text-slate-900 mt-1">{isProvisional ? '?' : openRawScore}<span className="text-lg text-slate-400">/{openMaxScore}</span></div>
           <div className="text-xs text-slate-500 mt-2 font-medium">{gradedCount} / 8 questions corrigées</div>
         </div>
         <div className="bg-white p-5 rounded-xl border shadow-sm flex flex-col justify-center">
           <div className="text-sm font-bold text-slate-500 uppercase">Non renseignés</div>
           <div className="text-3xl font-black text-orange-500 mt-1">{chapterResults.filter(c=>c.pedagogicalStatus==='Non renseigné').length}</div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-xl border shadow-sm col-span-2">
           <h3 className="font-bold mb-4">Analyse Radiale par Domaine (Score pondéré)</h3>
           <div className="h-64"><ResponsiveContainer width="100%" height="100%"><RadarChart cx="50%" cy="50%" outerRadius="70%" data={DOMAINS.map(d=>({subject: d.title.substring(0,10), A: domainScores[d.id]||0}))}><PolarGrid/><PolarAngleAxis dataKey="subject"/><PolarRadiusAxis angle={30} domain={[0, 100]}/><Radar dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5}/><RechartsTooltip/></RadarChart></ResponsiveContainer></div>
         </div>
         <div className="bg-white p-6 rounded-xl border shadow-sm">
           <h3 className="font-bold mb-4 text-slate-800">Décision Pédagogique Assistée</h3>
           <ul className="space-y-4 text-sm">
             {recs.map((r, i) => (
               <li key={i} className="flex items-start">
                 {r.type === 'alerte' && <ShieldAlert className="w-4 h-4 text-orange-500 mr-2 shrink-0 mt-0.5"/>}
                 {r.type === 'urgence' && <AlertTriangle className="w-4 h-4 text-red-500 mr-2 shrink-0 mt-0.5"/>}
                 {r.type === 'info' && <EyeOff className="w-4 h-4 text-blue-500 mr-2 shrink-0 mt-0.5"/>}
                 {r.type === 'succes' && <CheckCircle className="w-4 h-4 text-green-500 mr-2 shrink-0 mt-0.5"/>}
                 <span><strong className="block">{r.title}</strong><span className="text-slate-600">{r.text}</span></span>
               </li>
             ))}
           </ul>
         </div>
      </div>

      <TeacherQcmAnalysis qcmAnswers={qcmAnswers} />

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <div className="flex justify-between items-center border-b pb-4 mb-6">
          <h3 className="font-bold text-xl flex items-center"><Edit3 className="mr-2 text-blue-500"/> Correction des Questions Ouvertes ({gradedCount}/8)</h3>
          <Button onClick={handleValidationClick} variant={gradedCount < 8 ? 'warning' : 'primary'}>{gradedCount < 8 ? 'Forcer Recalcul (Note incomplète)' : 'Recalculer le Parcours'} <Check className="ml-2"/></Button>
        </div>
        <div className="space-y-8">
          {QUESTIONS_OPEN.map(q => {
            const ans = openAnswers[q.id] || {};
            const grade = teacherGrades[q.id] || { score: '', comment: '', errors: [], criteria: {}, mode: 'global' };
            const mode = grade.mode || 'global';
            
            return (
              <div key={q.id} className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 border rounded-xl bg-slate-50">
                <div>
                  <h4 className="font-bold text-sm text-slate-800 flex justify-between border-b pb-2 mb-3">
                     {q.id} — {q.title} 
                     <span className="text-xs font-normal bg-slate-200 px-2 py-0.5 rounded text-slate-700">Max: {q.maxPoints} pts</span>
                  </h4>
                  <div className="text-xs font-semibold px-2 py-1 bg-white border inline-block rounded text-slate-600 mb-3">Ressenti élève : {ans.status || 'Non renseigné'}</div>
                  <div className="p-4 bg-white border rounded text-sm text-slate-700 min-h-[120px] whitespace-pre-wrap font-mono shadow-inner">{ans.text || <span className="italic text-slate-400">Aucun brouillon saisi...</span>}</div>
                </div>
                <div className="space-y-4 bg-white p-5 border rounded-xl shadow-sm">
                  <div className="flex justify-between items-center pb-2 border-b">
                    <label className="text-sm font-bold">Mode de correction :</label>
                    <select className="text-xs border rounded p-1" value={mode} onChange={e=>handleModeChange(q.id, e.target.value)}>
                      <option value="global">Note Globale</option>
                      <option value="detailed">Barème Détaillé</option>
                    </select>
                  </div>

                  {mode === 'global' ? (
                     <div className="flex items-center gap-4 bg-slate-50 p-3 rounded border">
                       <label className="text-sm font-bold">Note accordée :</label>
                       <input type="number" min="0" max={q.maxPoints} step="0.5" className="w-20 p-2 border rounded font-bold text-center text-lg focus:ring-2 focus:ring-blue-500" placeholder="/0" value={grade.score} onChange={e => handleGlobalGrade(q.id, e.target.value)} />
                       <span className="text-sm text-slate-500">/ {q.maxPoints}</span>
                     </div>
                  ) : (
                    <div className="bg-blue-50/50 p-3 rounded border">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Barème détaillé :</label>
                        <span className="text-xs font-bold text-blue-700 bg-white px-2 py-1 rounded border">Total calculé: {grade.score || 0} / {q.maxPoints}</span>
                      </div>
                      <ul className="text-xs text-slate-600 space-y-2">
                        {q.rubrics.map((r,i) => (
                           <li key={i} className="flex justify-between items-center bg-white p-1.5 rounded border">
                             <span>{r.label} (/{r.points})</span>
                             <input type="number" min="0" max={r.points} step="0.5" className="w-16 p-1 border rounded text-center focus:ring-2 focus:ring-blue-500" placeholder="0" value={grade.criteria?.[i] ?? ''} onChange={e => handleDetailedGrade(q.id, i, e.target.value)} />
                           </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Erreurs diagnostiquées :</label>
                    <div className="flex flex-wrap gap-1.5">
                      {ERROR_TYPES.map(err => {
                        const isChecked = (grade.errors || []).includes(err);
                        return (
                          <label key={err} className={`text-[10px] uppercase font-bold flex items-center px-2 py-1 rounded cursor-pointer border transition-colors ${isChecked ? 'bg-red-100 text-red-700 border-red-300' : 'bg-slate-100 text-slate-500 border-transparent hover:bg-slate-200'}`}>
                            <input type="checkbox" className="hidden" checked={isChecked} onChange={() => handleErrorToggle(q.id, err)}/> {err}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  <textarea className="w-full text-sm p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500" placeholder="Commentaire professeur optionnel..." rows="2" value={grade.comment || ''} 
                    onChange={e => setTeacherGrades(prev=>({ 
                      ...prev, 
                      [q.id]:{ 
                        ...(prev[q.id] || { mode: 'global', score: '', errors: [], criteria: {}, comment: '' }), 
                        comment: e.target.value 
                      }
                    }))}></textarea>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
    </div>
  );
};

// ============================================================================
// 5. MAIN ORCHESTRATOR COMPONENT (With LocalStorage)
// ============================================================================

const DataManagement = ({ onReset, onImport, onExport, importReport, setImportReport }) => {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        const res = validateAndRepairImport(json);

        if (!res.isValid) {
           alert(`Fichier JSON invalide. ${res.error}`);
           return;
        }

        if (json.version !== "1.0.0") {
           if(!window.confirm(`La version du fichier (${json.version}) ne correspond pas. Voulez-vous importer quand même ?`)) return;
        }

        onImport(res.data);
        if(res.repairReport && res.repairReport.length > 0) {
           setImportReport(res.repairReport);
        } else {
           alert("Données importées avec succès !");
        }
      } catch(err) {
        alert("Erreur lors de la lecture du fichier JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = null; // reset
  };

  return (
    <div className="absolute top-4 right-4 flex flex-col items-end gap-2 print:hidden z-10">
       <div className="bg-white/80 backdrop-blur p-1 rounded-md border shadow-sm flex gap-2">
         <button onClick={onExport} className="text-xs text-slate-600 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 flex items-center transition"><Save className="w-3 h-3 mr-1"/> Exporter JSON</button>
         <button onClick={()=>fileInputRef.current.click()} className="text-xs text-slate-600 hover:text-green-600 px-2 py-1 rounded hover:bg-green-50 flex items-center transition"><Upload className="w-3 h-3 mr-1"/> Importer</button>
         <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
         <button onClick={onReset} className="text-xs text-slate-600 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 flex items-center transition"><Trash2 className="w-3 h-3 mr-1"/> Réinitialiser</button>
       </div>
       {importReport && importReport.length > 0 && (
         <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md shadow-sm max-w-sm text-xs text-yellow-800">
            <strong>Rapport d'importation (Correction automatique appliquée) :</strong>
            <ul className="list-disc pl-4 mt-1">
               {importReport.map((msg, i) => <li key={i}>{msg}</li>)}
            </ul>
            <button onClick={()=>setImportReport(null)} className="mt-2 text-blue-600 hover:underline">Fermer</button>
         </div>
       )}
    </div>
  );
};

export default function DiagnosticPlatform() {
  const [step, setStep] = useState('intro');
  const [profile, setProfile] = useState({});
  const [progress, setProgress] = useState({});
  const [qcmAnswers, setQcmAnswers] = useState({});
  const [openAnswers, setOpenAnswers] = useState({});
  const [teacherGrades, setTeacherGrades] = useState({});
  const [isTeacherGraded, setIsTeacherGraded] = useState(false);
  const [evaluatedData, setEvaluatedData] = useState(null);
  const [importReport, setImportReport] = useState(null);

  // Persistence Hook
  useEffect(() => {
    const saved = localStorage.getItem('diag_maths_state_v11');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if(data.step) setStep(data.step);
        if(data.profile) setProfile(data.profile);
        if(data.progress) setProgress(data.progress);
        if(data.qcmAnswers) setQcmAnswers(data.qcmAnswers);
        if(data.openAnswers) setOpenAnswers(data.openAnswers);
        if(data.teacherGrades) setTeacherGrades(data.teacherGrades);
        if(data.isTeacherGraded !== undefined) setIsTeacherGraded(data.isTeacherGraded);
        if(data.evaluatedData) setEvaluatedData(data.evaluatedData);
      } catch(e) { console.error('Failed to parse localStorage', e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('diag_maths_state_v11', JSON.stringify({
      version: "1.0.0", timestamp: Date.now(),
      step, profile, progress, qcmAnswers, openAnswers, teacherGrades, isTeacherGraded, evaluatedData
    }));
  }, [step, profile, progress, qcmAnswers, openAnswers, teacherGrades, isTeacherGraded, evaluatedData]);

  const handleReset = () => {
    if(window.confirm("Voulez-vous vraiment effacer toutes les données et revenir à zéro ?")) {
      localStorage.removeItem('diag_maths_state_v11');
      setStep('intro'); setProfile({}); setProgress({}); setQcmAnswers({}); setOpenAnswers({}); setTeacherGrades({}); setIsTeacherGraded(false); setEvaluatedData(null); setImportReport(null);
      window.scrollTo(0,0);
    }
  };

  const handleExport = () => {
    const exportData = {
      version: "1.0.0", timestamp: Date.now(),
      step, profile, progress, qcmAnswers, openAnswers, teacherGrades, isTeacherGraded, evaluatedData
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    
    const namePart = [profile.firstName, profile.lastName].filter(Boolean).join('_') || 'eleve';
    const datePart = new Date().toISOString().slice(0, 10);
    downloadAnchorNode.setAttribute("download", `diagnostic_maths_${namePart}_${datePart}.json`);
    
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (data) => {
    setStep(data.step || 'intro');
    setProfile(data.profile || {});
    setProgress(data.progress || {});
    setQcmAnswers(data.qcmAnswers || {});
    setOpenAnswers(data.openAnswers || {});
    setTeacherGrades(data.teacherGrades || {});
    setIsTeacherGraded(data.isTeacherGraded || false);
    setEvaluatedData(data.evaluatedData || null);
  };

  const finishStudentPhase = () => {
    const data = computeDiagnostics(profile, progress, qcmAnswers, teacherGrades, false);
    setEvaluatedData(data);
    setStep('results');
    window.scrollTo(0, 0);
  };

  const finishTeacherGrading = () => {
    setIsTeacherGraded(true);
    const data = computeDiagnostics(profile, progress, qcmAnswers, teacherGrades, true);
    setEvaluatedData(data);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 relative">
      <DataManagement onReset={handleReset} onExport={handleExport} onImport={handleImport} importReport={importReport} setImportReport={setImportReport} />

      {step === 'intro' && <IntroStep onNext={() => {setStep('profile'); window.scrollTo(0,0);}} />}
      {step === 'profile' && <ProfileStep profile={profile} setProfile={setProfile} onNext={() => {setStep('progress'); window.scrollTo(0,0);}} />}
      {step === 'progress' && <ProgressStep progress={progress} setProgress={setProgress} onNext={() => {setStep('qcm'); window.scrollTo(0,0);}} />}
      {step === 'qcm' && <QcmStep qcmAnswers={qcmAnswers} setQcmAnswers={setQcmAnswers} onNext={() => {setStep('open'); window.scrollTo(0,0);}} />}
      {step === 'open' && <OpenStep openAnswers={openAnswers} setOpenAnswers={setOpenAnswers} onFinish={finishStudentPhase} />}
      {step === 'results' && evaluatedData && <ResultsStep evaluatedData={evaluatedData} onSwitchRole={() => {setStep('teacher'); window.scrollTo(0,0);}} />}
      {step === 'teacher' && evaluatedData && <TeacherStep evaluatedData={evaluatedData} qcmAnswers={qcmAnswers} openAnswers={openAnswers} teacherGrades={teacherGrades} setTeacherGrades={setTeacherGrades} onSubmitGrades={finishTeacherGrading} onBack={() => {setStep('results'); window.scrollTo(0,0);}} />}
    </div>
  );
}
