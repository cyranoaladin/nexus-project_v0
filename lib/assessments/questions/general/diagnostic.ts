/**
 * General Diagnostic Questions
 * 
 * Cross-curricular diagnostic assessment for subjects without
 * dedicated question banks (Français, Physique, SVT, etc.).
 * 
 * Evaluates: methodology, comprehension, analysis, organization.
 * 15 questions across 4 categories.
 */

import { Subject } from '../../core/types';
import type { QuestionModule } from '../types';

const questionModule: QuestionModule = {
  id: 'diagnostic-general',
  title: 'Diagnostic Général — Compétences Transversales',
  subject: Subject.GENERAL,
  grade: 'TERMINALE',
  category: 'Diagnostic',
  questions: [
    // ─── Méthodologie (4 questions) ──────────────────────────────────────
    {
      id: 'GEN-METH-01',
      subject: Subject.GENERAL,
      category: 'Methodologie',
      weight: 1,
      competencies: ['Organisation'],
      questionText: 'Quand tu prépares un contrôle, quelle est la méthode la plus efficace ?',
      options: [
        { id: 'a', text: 'Relire le cours plusieurs fois la veille', isCorrect: false },
        { id: 'b', text: 'Faire des fiches de révision et s\'entraîner sur des exercices', isCorrect: true },
        { id: 'c', text: 'Recopier le cours à la main', isCorrect: false },
        { id: 'd', text: 'Regarder des vidéos résumées sur YouTube', isCorrect: false },
      ],
      explanation: 'La méthode la plus efficace combine la synthèse active (fiches) et la pratique (exercices). La relecture passive est peu efficace pour la mémorisation à long terme.',
    },
    {
      id: 'GEN-METH-02',
      subject: Subject.GENERAL,
      category: 'Methodologie',
      weight: 2,
      competencies: ['Planification'],
      questionText: 'Tu as un devoir maison à rendre dans 2 semaines. Quelle approche adoptes-tu ?',
      options: [
        { id: 'a', text: 'Je commence le week-end avant la date limite', isCorrect: false },
        { id: 'b', text: 'Je le fais le soir même où il est donné', isCorrect: false },
        { id: 'c', text: 'Je planifie des étapes sur la semaine : recherche, brouillon, rédaction, relecture', isCorrect: true },
        { id: 'd', text: 'J\'attends de voir si un camarade peut m\'aider', isCorrect: false },
      ],
      explanation: 'La planification en étapes permet un travail de qualité sans stress. Commencer trop tôt sans plan ou trop tard sont des erreurs courantes.',
    },
    {
      id: 'GEN-METH-03',
      subject: Subject.GENERAL,
      category: 'Methodologie',
      weight: 2,
      competencies: ['Auto-évaluation'],
      questionText: 'Après un contrôle, tu obtiens 8/20. Quelle est la meilleure réaction ?',
      options: [
        { id: 'a', text: 'Analyser les erreurs pour comprendre ce qui n\'a pas été compris', isCorrect: true },
        { id: 'b', text: 'Se dire que la matière est trop difficile', isCorrect: false },
        { id: 'c', text: 'Travailler deux fois plus le prochain chapitre', isCorrect: false },
        { id: 'd', text: 'Demander au professeur de revoir la note', isCorrect: false },
      ],
      explanation: 'L\'analyse des erreurs est la clé de la progression. Comprendre pourquoi on s\'est trompé permet d\'éviter de reproduire les mêmes erreurs.',
    },
    {
      id: 'GEN-METH-04',
      subject: Subject.GENERAL,
      category: 'Methodologie',
      weight: 1,
      competencies: ['Organisation'],
      questionText: 'Quel outil est le plus utile pour organiser ses révisions du Bac ?',
      options: [
        { id: 'a', text: 'Un planning de révisions avec des objectifs par jour', isCorrect: true },
        { id: 'b', text: 'Une liste de tous les chapitres à réviser', isCorrect: false },
        { id: 'c', text: 'Les annales des 5 dernières années', isCorrect: false },
        { id: 'd', text: 'Un groupe WhatsApp avec les camarades', isCorrect: false },
      ],
      explanation: 'Un planning structuré avec des objectifs quotidiens permet de couvrir tout le programme sans stress. Les annales sont utiles mais insuffisantes sans organisation.',
    },

    // ─── Connaissances (4 questions) ─────────────────────────────────────
    {
      id: 'GEN-CONN-01',
      subject: Subject.GENERAL,
      category: 'Connaissances',
      weight: 1,
      competencies: ['Culture générale'],
      questionText: 'Au Baccalauréat, quelle épreuve a le plus gros coefficient en voie générale ?',
      options: [
        { id: 'a', text: 'Le Grand Oral', isCorrect: false },
        { id: 'b', text: 'Les deux épreuves de spécialité', isCorrect: true },
        { id: 'c', text: 'La philosophie', isCorrect: false },
        { id: 'd', text: 'Le français (écrit + oral)', isCorrect: false },
      ],
      explanation: 'Les deux épreuves de spécialité comptent chacune pour coefficient 16, soit 32 au total. Le Grand Oral a un coefficient 10, la philosophie 8, et le français 10.',
    },
    {
      id: 'GEN-CONN-02',
      subject: Subject.GENERAL,
      category: 'Connaissances',
      weight: 2,
      competencies: ['Compréhension'],
      questionText: 'Qu\'est-ce que le contrôle continu représente dans la note finale du Bac ?',
      options: [
        { id: 'a', text: '40% de la note finale', isCorrect: true },
        { id: 'b', text: '20% de la note finale', isCorrect: false },
        { id: 'c', text: '50% de la note finale', isCorrect: false },
        { id: 'd', text: '60% de la note finale', isCorrect: false },
      ],
      explanation: 'Le contrôle continu compte pour 40% de la note finale du Bac (bulletins de Première et Terminale). Les épreuves terminales comptent pour 60%.',
    },
    {
      id: 'GEN-CONN-03',
      subject: Subject.GENERAL,
      category: 'Connaissances',
      weight: 1,
      competencies: ['Culture générale'],
      questionText: 'Parcoursup examine principalement :',
      options: [
        { id: 'a', text: 'Uniquement les notes du Bac', isCorrect: false },
        { id: 'b', text: 'Les notes, les appréciations, la lettre de motivation et les activités', isCorrect: true },
        { id: 'c', text: 'Uniquement la lettre de motivation', isCorrect: false },
        { id: 'd', text: 'Le classement dans la classe', isCorrect: false },
      ],
      explanation: 'Parcoursup utilise un dossier complet : notes et moyennes, appréciations des professeurs, projet de formation motivé, activités et centres d\'intérêt, et la fiche Avenir.',
    },
    {
      id: 'GEN-CONN-04',
      subject: Subject.GENERAL,
      category: 'Connaissances',
      weight: 2,
      competencies: ['Compréhension'],
      questionText: 'Quelle est la durée du Grand Oral du Baccalauréat ?',
      options: [
        { id: 'a', text: '20 minutes au total', isCorrect: true },
        { id: 'b', text: '30 minutes au total', isCorrect: false },
        { id: 'c', text: '15 minutes au total', isCorrect: false },
        { id: 'd', text: '10 minutes de présentation + 10 minutes de questions', isCorrect: false },
      ],
      explanation: 'Le Grand Oral dure 20 minutes : 20 minutes de préparation, puis 5 minutes de présentation, 10 minutes d\'échange avec le jury, et 5 minutes sur le projet d\'orientation.',
    },

    // ─── Raisonnement (4 questions) ──────────────────────────────────────
    {
      id: 'GEN-RAIS-01',
      subject: Subject.GENERAL,
      category: 'Raisonnement',
      weight: 2,
      competencies: ['Analyse'],
      questionText: 'Un graphique montre que les résultats d\'un élève baissent en novembre puis remontent en janvier. Quelle conclusion est la plus pertinente ?',
      options: [
        { id: 'a', text: 'L\'élève a eu une période difficile mais a su rebondir', isCorrect: true },
        { id: 'b', text: 'L\'élève n\'est pas fait pour cette matière', isCorrect: false },
        { id: 'c', text: 'Le professeur a été plus indulgent en janvier', isCorrect: false },
        { id: 'd', text: 'Les contrôles de novembre étaient plus difficiles', isCorrect: false },
      ],
      explanation: 'Une baisse temporaire suivie d\'une remontée indique une capacité de résilience. Les autres réponses sont des conclusions hâtives sans données supplémentaires.',
    },
    {
      id: 'GEN-RAIS-02',
      subject: Subject.GENERAL,
      category: 'Raisonnement',
      weight: 3,
      competencies: ['Argumentation'],
      questionText: 'Dans une dissertation, quel est le rôle de l\'antithèse ?',
      options: [
        { id: 'a', text: 'Contredire totalement la thèse pour montrer qu\'elle est fausse', isCorrect: false },
        { id: 'b', text: 'Nuancer la thèse en présentant un point de vue opposé ou complémentaire', isCorrect: true },
        { id: 'c', text: 'Résumer la thèse avec d\'autres mots', isCorrect: false },
        { id: 'd', text: 'Donner des exemples qui confirment la thèse', isCorrect: false },
      ],
      explanation: 'L\'antithèse ne contredit pas totalement la thèse : elle la nuance en montrant ses limites ou en présentant un angle différent, ce qui enrichit la réflexion.',
    },
    {
      id: 'GEN-RAIS-03',
      subject: Subject.GENERAL,
      category: 'Raisonnement',
      weight: 2,
      competencies: ['Logique'],
      questionText: '"Tous les élèves qui révisent régulièrement réussissent." Marie a réussi. Peut-on en conclure qu\'elle a révisé régulièrement ?',
      options: [
        { id: 'a', text: 'Oui, c\'est logique', isCorrect: false },
        { id: 'b', text: 'Non, elle a pu réussir pour d\'autres raisons', isCorrect: true },
        { id: 'c', text: 'Oui, si elle a eu une bonne note', isCorrect: false },
        { id: 'd', text: 'On ne peut rien dire sans connaître sa note exacte', isCorrect: false },
      ],
      explanation: 'C\'est l\'erreur d\'affirmation du conséquent. "Si A alors B" ne signifie pas "Si B alors A". Marie a pu réussir grâce à d\'autres facteurs (facilité naturelle, cours particuliers, etc.).',
    },
    {
      id: 'GEN-RAIS-04',
      subject: Subject.GENERAL,
      category: 'Raisonnement',
      weight: 3,
      competencies: ['Synthèse'],
      questionText: 'Pour préparer une synthèse de documents, la première étape est :',
      options: [
        { id: 'a', text: 'Commencer à rédiger l\'introduction', isCorrect: false },
        { id: 'b', text: 'Lire tous les documents et identifier les thèmes communs', isCorrect: true },
        { id: 'c', text: 'Résumer chaque document séparément', isCorrect: false },
        { id: 'd', text: 'Choisir le document le plus intéressant', isCorrect: false },
      ],
      explanation: 'La synthèse exige d\'abord une lecture globale pour dégager les axes communs. Résumer chaque document séparément (c) est un piège fréquent qui mène à une juxtaposition, pas une synthèse.',
    },

    // ─── Organisation (3 questions) ──────────────────────────────────────
    {
      id: 'GEN-ORG-01',
      subject: Subject.GENERAL,
      category: 'Organisation',
      weight: 1,
      competencies: ['Gestion du temps'],
      questionText: 'Tu as 4 heures pour une épreuve de 3 exercices. Comment répartis-tu ton temps ?',
      options: [
        { id: 'a', text: 'Je lis tous les exercices d\'abord, puis je commence par celui que je maîtrise le mieux', isCorrect: true },
        { id: 'b', text: 'Je fais les exercices dans l\'ordre', isCorrect: false },
        { id: 'c', text: 'Je commence par le plus difficile pour m\'en débarrasser', isCorrect: false },
        { id: 'd', text: 'Je passe 2h sur le premier exercice pour le faire parfaitement', isCorrect: false },
      ],
      explanation: 'Lire tous les sujets d\'abord permet d\'évaluer la difficulté et de commencer par ses points forts, ce qui sécurise des points et donne confiance pour la suite.',
    },
    {
      id: 'GEN-ORG-02',
      subject: Subject.GENERAL,
      category: 'Organisation',
      weight: 2,
      competencies: ['Priorisation'],
      questionText: 'Tu as un contrôle de maths demain et un exposé d\'histoire dans 3 jours. Ce soir, tu :',
      options: [
        { id: 'a', text: 'Révises uniquement les maths', isCorrect: true },
        { id: 'b', text: 'Fais moitié-moitié entre les deux', isCorrect: false },
        { id: 'c', text: 'Commences l\'exposé car c\'est plus long à préparer', isCorrect: false },
        { id: 'd', text: 'Ne fais rien car tu es stressé(e)', isCorrect: false },
      ],
      explanation: 'La matrice d\'Eisenhower : urgent + important (maths demain) passe avant important mais non urgent (exposé dans 3 jours). Tu pourras préparer l\'exposé demain soir.',
    },
    {
      id: 'GEN-ORG-03',
      subject: Subject.GENERAL,
      category: 'Organisation',
      weight: 1,
      competencies: ['Concentration'],
      questionText: 'Quelle durée de travail concentré est recommandée avant de faire une pause ?',
      options: [
        { id: 'a', text: '25-30 minutes (technique Pomodoro)', isCorrect: true },
        { id: 'b', text: '2 heures sans interruption', isCorrect: false },
        { id: 'c', text: '10 minutes', isCorrect: false },
        { id: 'd', text: 'Jusqu\'à ce qu\'on soit fatigué', isCorrect: false },
      ],
      explanation: 'La technique Pomodoro (25-30 min de travail + 5 min de pause) est scientifiquement validée pour maintenir la concentration. Au-delà de 45 min, l\'attention diminue significativement.',
    },
  ],
};

export default questionModule;
