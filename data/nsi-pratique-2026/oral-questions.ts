import type { OralQuestion, SelfAssessmentItem } from './types';

export const oralQuestions: OralQuestion[] = [
  {
    id: 'complexite',
    question: 'Quelle est la complexité de votre algorithme ?',
    answer:
      "On évalue le nombre d'opérations en fonction de la taille de l'entrée. Un parcours simple est O(n), un tri est O(n log n), deux boucles imbriquées sont O(n²).",
    category: 'complexité',
  },
  {
    id: 'test',
    question: 'Comment avez-vous testé votre fonction ?',
    answer:
      "J'ai utilisé les fonctions test_* fournies dans le fichier. J'ai aussi ajouté un test sur un cas limite (liste vide, valeur absente, taille 1).",
    category: 'test',
  },
  {
    id: 'liste-vs-tuple',
    question: 'Quelle est la différence entre liste et tuple ?',
    answer:
      "Une liste est mutable (on peut la modifier), un tuple est immuable (figé après création). On utilise un tuple quand on veut garantir que les données ne changent pas.",
    category: 'structures',
  },
  {
    id: 'modification-parcours',
    question: "Pourquoi ne pas modifier une liste pendant qu'on la parcourt ?",
    answer:
      "Le for de Python itère par index interne. Quand on supprime un élément, les suivants se décalent, ce qui fait sauter un élément sur deux. La solution est de filtrer dans une nouvelle liste.",
    category: 'structures',
  },
  {
    id: 'conversion-csv',
    question: 'Pourquoi convertir les données CSV ?',
    answer:
      'Parce que le module csv renvoie tout en chaînes de caractères. Sans conversion, "5.3" < 6.0 compare une chaîne à un nombre, ce qui est incorrect en Python 3.',
    category: 'CSV',
  },
  {
    id: 'return-false-mal-place',
    question: 'Pourquoi un return False mal placé est dangereux ?',
    answer:
      "Parce qu'il s'exécute dès la première itération qui ne satisfait pas la condition, sans examiner les suivantes. Le return False doit être après la boucle complète.",
    category: 'logique',
  },
  {
    id: 'none-vs-zero',
    question: 'Pourquoi utiliser None plutôt que 0 ?',
    answer:
      "Parce que 0 est une vraie valeur (une moyenne de 0 existe). None signifie l'information n'existe pas ou le calcul est impossible, ce qui est sémantiquement différent.",
    category: 'logique',
  },
  {
    id: 'division-par-zero',
    question: 'Pourquoi protéger une division par zéro ?',
    answer:
      "Parce qu'un dénominateur peut être nul quand il n'y a aucun élément dans la catégorie. Renvoyer None ou lever une exception explicite est plus clair qu'un crash ZeroDivisionError.",
    category: 'logique',
  },
  {
    id: 'knn-equite',
    question: "Pourquoi le sexe doit être retiré d'une distance KNN équitable ?",
    answer:
      "Si la distance inclut le sexe, les k voisins d'une femme seront presque toutes des femmes, historiquement moins payées. Le modèle reproduit l'inégalité au lieu de la corriger.",
    category: 'éthique',
  },
  {
    id: 'zeros-initiaux-binaire',
    question: 'Pourquoi les zéros initiaux sont importants dans les trames binaires ?',
    answer:
      "Parce que chaque caractère ASCII est codé sur exactement 8 bits. Si on omet les zéros initiaux, la longueur de la trame change et tous les caractères suivants sont décalés.",
    category: 'binaire',
  },
  {
    id: 'recursive-terminaison',
    question: "Comment garantir qu'une fonction récursive termine ?",
    answer:
      "Deux conditions. (1) Un cas de base qui termine sans appel récursif. (2) À chaque appel récursif, la taille du problème décroît strictement vers le cas de base.",
    category: 'récursivité',
  },
  {
    id: 'assert-utilite',
    question: 'À quoi sert assert ?',
    answer:
      "assert documente et vérifie une précondition. Un assert qui échoue signale un bug chez l'appelant. Ce n'est pas un substitut au contrôle d'entrées utilisateur.",
    category: 'logique',
  },
  {
    id: 'none-vs-exception',
    question: 'Pourquoi votre fonction renvoie-t-elle None et pas une exception ?',
    answer:
      "None signale un cas prévu et toléré (liste vide, donnée absente). Une exception signale un cas anormal qui ne doit pas se produire. Le choix dépend du contrat de la fonction.",
    category: 'logique',
  },
];

/** Formules orales prêtes à mémoriser — Annexe C du guide */
export const oralFormulas: string[] = [
  "Cette fonction parcourt la liste et accumule uniquement les éléments qui vérifient la condition demandée.",
  "J'ai traité le cas où aucune donnée ne correspond ; dans ce cas l'énoncé demande de renvoyer None.",
  "Le bug venait du fait que la fonction retournait trop tôt dans la boucle. J'ai déplacé le return False après le parcours complet.",
  "Je ne modifie pas la liste pendant le parcours ; je construis une nouvelle liste filtrée.",
  "Pour le k-NN, je calcule toutes les distances, je trie, je garde les k plus proches, puis j'applique la règle de décision.",
  "Pour les fichiers CSV, les données lues sont des chaînes ; je convertis explicitement en int ou float avant les calculs.",
  "Pour le binaire, j'utilise format(n, '08b') parce que bin(n) perd les zéros initiaux.",
  "Pour la récursion sur dictionnaire, le cas de base est quand la valeur n'est plus un dictionnaire mais un nombre.",
];

/** Sept réflexes du jour J — Annexe D du guide */
export const examDayReflexes: string[] = [
  "Lire l'énoncé en entier avant d'écrire une seule ligne.",
  "Repérer la signature : paramètres, type de retour, effets de bord.",
  "Écrire 3 assertions de test avant de coder.",
  "Verbaliser l'algorithme à voix basse, étape par étape.",
  "Coder en suivant l'algorithme verbal, ligne par ligne.",
  "Lancer les tests fournis + le(s) test(s) limite(s).",
  "Relire le code une dernière fois avant de passer au sujet suivant.",
];

export const selfAssessmentItems: SelfAssessmentItem[] = [
  {
    id: 'read-signature',
    label: 'Lire une signature',
    description:
      "Je sais identifier le nom, les paramètres, le type de retour et les cas particuliers d'une fonction à compléter.",
  },
  {
    id: 'write-assertions',
    label: 'Écrire trois assertions',
    description:
      "Je sais écrire au moins 3 tests pertinents (cas normal, cas limite, cas d'erreur) pour une fonction donnée.",
  },
  {
    id: 'explain-correction',
    label: 'Expliquer une correction',
    description:
      "Je sais expliquer à voix haute pourquoi un bug existait et comment ma correction le résout.",
  },
  {
    id: 'handle-data',
    label: 'Traiter les données',
    description:
      'Je sais lire un CSV, un JSON, une base SQLite et convertir les types (int, float, str).',
  },
  {
    id: 'fix-classic-bugs',
    label: 'Corriger les bugs classiques',
    description:
      "Je reconnais les bugs classiques : return False dans une boucle, modification pendant un parcours, division par zéro, comparaison de chaînes.",
  },
  {
    id: 'ask-for-help',
    label: "Demander de l'aide intelligemment",
    description:
      "Je sais formuler une question précise quand je bloque, sans perdre de temps.",
  },
  {
    id: 'test-before-finish',
    label: 'Tester avant de finir',
    description:
      "Je lance systématiquement les tests fournis et j'ajoute un test sur un cas limite avant de déclarer une fonction terminée.",
  },
  {
    id: 'manage-time',
    label: 'Gérer son temps',
    description:
      'Je respecte le découpage du jour J : 5 min lecture, 35 min codage, 10 min tests, 5 min relecture.',
  },
];
