import type { NsiSubject } from './types';

export const nsiSubjects: NsiSubject[] = [
  // ── Subject 1 — RLE ──────────────────────────────────────────────────
  {
    id: 1,
    slug: 'rle-compression',
    title: 'Compression d\'images en niveaux de gris',
    shortTitle: 'RLE',
    family: 'Encodage de listes / images / borne 255',
    difficulty: 'moyen',
    estimatedTimeMinutes: 30,
    examTimeMinutes: 55,
    files: {
      main: 'rle.py',
      pdf: 'sujet.pdf',
      python: ['rle.py'],
      images: ['bac_nsi_32.png', 'bac_nsi_256.png'],
    },
    concepts: ['compression', 'encodage RLE', 'listes', 'boucles', 'borne 255'],
    patterns: [1, 2],
    mnemonic:
      'RLE = couples (compte, valeur). Encoder coupe les runs > 255.',
    verbalAlgorithm: [
      'Q1 — Compression toujours plus courte ? Non. Une liste sans répétitions devient deux fois plus longue après RLE.',
      'Q2 — Décodage : lire la liste deux par deux (couples), répéter valeur autant de fois que compte.',
      'Q3 — Test sur 256 : le compte sur 8 bits déborde si > 255 → le test échoue sur bac_nsi_256.png.',
      'Q4 — Correction : découper tout run > 255 en blocs (255, v), ..., (reste, v).',
    ],
    commonTraps: [
      'Oublier le dernier run — la boucle ne ferme jamais le run en cours, il faut un append après.',
      'Liste vide — pixels[0] plante. Tester if not pixels: return [].',
      'Confondre l\'ordre — la convention est [compte, valeur, compte, valeur, ...]. Ne pas inverser.',
    ],
    examinerQuestions: [
      {
        question:
          'Pourquoi RLE compresse-t-il bien les aplats et mal le bruit ?',
        expectedAnswer:
          'Le RLE est efficace quand on a de longues séquences de pixels identiques (aplats). Sur une image bruitée, on stocke un couple par pixel, donc la sortie fait le double de l\'entrée.',
      },
      {
        question: 'Pourquoi la borne 255 ?',
        expectedAnswer:
          'Parce qu\'un compte stocké sur un octet ne peut pas dépasser 2^8 − 1 = 255.',
      },
      {
        question:
          'Le décodage doit-il changer après la correction de Q4 ?',
        expectedAnswer:
          'Non. Si on a découpé un run de 400 en (255, v) puis (145, v), le décodeur lit deux couples consécutifs avec la même valeur et reconstitue 400 pixels v.',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt: 'Écrire encoder_rle_robuste sans regarder le corrigé',
        expectedElements: ['while count > 255', 'append après la boucle'],
      },
      {
        type: 'oral',
        prompt: 'Explique encoder_rle en 4 phrases',
        expectedElements: ['contrat', 'stratégie', 'cas limite', 'test'],
      },
      {
        type: 'debug',
        prompt:
          'Identifier le bug si on oublie l\'append final après la boucle',
        expectedElements: ['dernier run perdu'],
      },
    ],
    revisionProtocol:
      'Écris à la main encoder_rle_robuste sur une feuille. Compare. Puis explique-la oralement en suivant la formule en 4 phrases.',
  },

  // ── Subject 2 — Salaires ─────────────────────────────────────────────
  {
    id: 2,
    slug: 'salaires-knn',
    title: 'Salaires — moyennes conditionnelles et k-NN avec biais de variable',
    shortTitle: 'Salaires',
    family: 'Dictionnaires, moyenne, KNN, biais',
    difficulty: 'difficile',
    estimatedTimeMinutes: 35,
    examTimeMinutes: 55,
    files: {
      main: 'analyse.py',
      pdf: 'sujet.pdf',
      python: ['analyse.py', 'donnees.py', 'donnees_completes.py'],
    },
    concepts: [
      'moyenne conditionnelle',
      'KNN',
      'biais algorithmique',
      'distance euclidienne',
      'dictionnaires',
    ],
    patterns: [1, 5],
    mnemonic:
      'Pour proposer un salaire équitable, on retire le sexe de la distance.',
    verbalAlgorithm: [
      'salaire_moyen_condition : filtrer les employés où emp[champ] == valeur, sommer leurs salaires, diviser par l\'effectif filtré. None si effectif nul.',
      'effectif_par_sexe : initialiser {\'F\': 0, \'M\': 0}, incrémenter selon emp[\'sexe\'].',
      'calcul_ecart_sexe : moyennes F et M, écart relatif (mH − mF)/mH × 100. None si une moyenne manque ou si mH = 0.',
      'salaire_par_proximite : KNN classique. Pour une proposition équitable, on retire le sexe de la fonction distance.',
    ],
    commonTraps: [
      'Division par zéro si une catégorie est vide. Toujours None sur effectif nul.',
      'Comparaison du tuple : distances.sort() sans key plante si distances égales (compare les dicts). Toujours key=lambda t: t[0].',
      'Garder le sexe dans distance reproduit le biais : c\'est le point que le jury teste.',
    ],
    examinerQuestions: [
      {
        question:
          'Pourquoi renvoyer None et pas 0 quand la catégorie est vide ?',
        expectedAnswer:
          '0 serait une fausse moyenne. None signifie l\'information n\'existe pas, ce qui est correct.',
      },
      {
        question:
          'Pourquoi un KNN avec le sexe propose des salaires biaisés ?',
        expectedAnswer:
          'Si la distance prend en compte le sexe, les k voisins d\'une femme seront presque tous des femmes — historiquement moins payées. Le modèle reproduit l\'inégalité.',
      },
      {
        question: 'Comment justifier le choix de k ?',
        expectedAnswer:
          'Trop petit (k=1), on copie un seul cas. Trop grand, on dilue dans la moyenne globale. On choisit typiquement k = √n.',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt: 'Écrire distance_equitable sans regarder le corrigé',
        expectedElements: ['critères sans sexe', 'sqrt', 'sum'],
      },
      {
        type: 'quiz',
        prompt: 'Pourquoi retirer le sexe de la distance ?',
        expectedElements: ['biais', 'reproduction inégalité'],
      },
      {
        type: 'oral',
        prompt: 'Explique salaire_moyen_condition en 4 phrases',
        expectedElements: ['contrat', 'filtre', 'division par zéro', 'test'],
      },
    ],
    revisionProtocol:
      'Réécrire distance_equitable et salaire_par_proximite. Expliquer oralement pourquoi le sexe est exclu.',
  },

  // ── Subject 3 — Dates ────────────────────────────────────────────────
  {
    id: 3,
    slug: 'dates-icalendar',
    title: 'Dates — année bissextile, phases, format iCalendar',
    shortTitle: 'Dates',
    family: 'Dates, assertions, format iCalendar',
    difficulty: 'moyen',
    estimatedTimeMinutes: 30,
    examTimeMinutes: 55,
    files: {
      main: 'cycle_menstruel.py',
      pdf: 'sujet.pdf',
      python: ['cycle_menstruel.py'],
    },
    concepts: [
      'année bissextile',
      'assertions',
      'format iCalendar',
      'tuples',
      'passage de mois',
    ],
    patterns: [8],
    mnemonic:
      '400 d\'abord, puis 4 sauf 100. Et un iCalendar c\'est BEGIN/END à chaque niveau.',
    verbalAlgorithm: [
      'est_bissextile : règle complète — divisible par 400, OU (divisible par 4 ET non divisible par 100).',
      'determiner_phase : assert 1 <= jour <= 28, puis 1-5 → 1, 6-13 → 2, 14 → 3, 15-28 → 4.',
      'ajouter_jours : penser au passage de mois et au février bissextile.',
      'calendrier_cycles : produire un texte respectant la grammaire iCalendar — BEGIN:VCALENDAR en tête, END:VCALENDAR en queue.',
    ],
    commonTraps: [
      'Ordre des tests de bissextilité : si on teste annee % 4 == 0 avant annee % 100, on classe 2100 comme bissextile.',
      'Espaces parasites dans iCalendar : le format est strict.',
      'Mois codé sur 1 chiffre : utiliser f"{m:02d}".',
      'assert oublié : determiner_phase reçoit potentiellement jour=0 ou jour=29.',
    ],
    examinerQuestions: [
      {
        question:
          'Quelle est la règle complète des années bissextiles ?',
        expectedAnswer:
          'Divisible par 4, sauf les multiples de 100, sauf les multiples de 400. Donc 2000 oui, 2100 non, 2400 oui.',
      },
      {
        question: 'À quoi sert le mot-clé assert ?',
        expectedAnswer:
          'assert vérifie une précondition. Si elle est fausse, le programme s\'arrête avec une AssertionError.',
      },
      {
        question:
          'Pourquoi un fichier iCalendar peut-il être invalide ?',
        expectedAnswer:
          'Soit la grammaire n\'est pas respectée (BEGIN:VEVENT sans END:VEVENT), soit le format de date est faux.',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt: 'Écrire est_bissextile et ajouter_jours',
        expectedElements: ['400 d\'abord', 'passage de mois'],
      },
      {
        type: 'oral',
        prompt: 'Réciter la règle complète des années bissextiles',
        expectedElements: ['400', '100', '4'],
      },
      {
        type: 'quiz',
        prompt: '2100 est-elle bissextile ?',
        expectedElements: ['Non — divisible par 100 mais pas par 400'],
      },
    ],
    revisionProtocol:
      'Réécrire est_bissextile et format_ical de mémoire. Vérifier le format de date iCalendar.',
  },

  // ── Subject 4 — Culture de plantes ───────────────────────────────────
  {
    id: 4,
    slug: 'culture-plantes',
    title: 'Culture de plantes — objets, regroupement, purge',
    shortTitle: 'Plantes',
    family: 'Objets + dictionnaires de listes + filtrage',
    difficulty: 'moyen',
    estimatedTimeMinutes: 30,
    examTimeMinutes: 55,
    files: {
      main: 'culture.py',
      pdf: 'sujet.pdf',
      python: ['culture.py', 'plantes.py', 'mesures.py'],
    },
    concepts: [
      'POO',
      'dictionnaire de listes',
      'filtrage',
      'ne pas modifier pendant un parcours',
    ],
    patterns: [2, 3],
    mnemonic:
      'On ne supprime jamais pendant qu\'on parcourt — on filtre.',
    verbalAlgorithm: [
      'croissance_moyenne : si liste vide → None ; sinon somme des p.duree_croissance divisée par le nombre de plantes.',
      'dictionnaire_mesure : initialiser un dict avec une clé par nom de plante, valeur = liste vide. Parcourir les mesures et les ranger dans la bonne liste.',
      'purger_mesures_extremes : le piège classique est de faire liste.remove(m) pendant un for in liste. On construit une nouvelle liste filtrée.',
    ],
    commonTraps: [
      'Modifier la liste pendant le parcours : for m in mesures: if ...: mesures.remove(m) saute des éléments.',
      'Clé absente dans dictionnaire_mesure : si une mesure mentionne une plante inconnue, groupes[nom] provoque KeyError. D\'où le test if nom in groupes.',
      'Attribut d\'objet vs clé de dict : p.nom (objet Plante) mais m[\'plante\'] (mesure, qui est un dictionnaire).',
    ],
    examinerQuestions: [
      {
        question:
          'Pourquoi ne faut-il pas modifier une liste pendant qu\'on la parcourt ?',
        expectedAnswer:
          'Le for de Python itère par index interne. Quand on supprime un élément, les suivants se décalent et un élément sur deux est sauté.',
      },
      {
        question:
          'Quelle différence entre un attribut d\'objet et une clé de dictionnaire ?',
        expectedAnswer:
          'Un attribut est lié à une classe — l\'accès est objet.attribut. Une clé est associative — l\'accès est dict[\'cle\'].',
      },
      {
        question:
          'Pourquoi initialiser le dictionnaire avec toutes les clés vides au départ ?',
        expectedAnswer:
          'Pour garantir que chaque plante apparaît, même celles qui n\'ont aucune mesure.',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt:
          'Écrire purger_mesures_extremes avec compréhension de liste',
        expectedElements: ['nouvelle liste', 'condition sur temperature'],
      },
      {
        type: 'debug',
        prompt:
          'Quel est le bug si on fait mesures.remove(m) dans la boucle ?',
        expectedElements: ['éléments sautés', 'index décalé'],
      },
      {
        type: 'oral',
        prompt: 'Expliquer dictionnaire_mesure en 4 phrases',
        expectedElements: ['initialisation', 'parcours', 'test clé', 'groupes'],
      },
    ],
    revisionProtocol:
      'Réécrire purger_mesures_extremes et dictionnaire_mesure de mémoire.',
  },

  // ── Subject 5 — Empreinte carbone ────────────────────────────────────
  {
    id: 5,
    slug: 'empreinte-carbone',
    title: 'Empreinte carbone — JSON imbriqué, récursivité, alerte',
    shortTitle: 'Empreinte carbone',
    family: 'JSON imbriqué + récursivité',
    difficulty: 'difficile',
    estimatedTimeMinutes: 35,
    examTimeMinutes: 55,
    files: {
      main: 'empreinte.py',
      pdf: 'sujet.pdf',
      python: ['empreinte.py'],
      data: ['empreinte_ada.json', 'empreinte_ada_agr.json'],
    },
    concepts: [
      'JSON',
      'récursivité',
      'isinstance',
      'dictionnaire imbriqué',
      'alerte',
    ],
    patterns: [4],
    mnemonic:
      'Si c\'est un dict, je descends. Si c\'est un nombre, je traite. False seulement à la fin.',
    verbalAlgorithm: [
      'total_simple : la somme directe des valeurs, à un seul niveau, c\'est sum(empreinte.values()).',
      'total_rec : pour chaque valeur — si c\'est un dict, appel récursif ; sinon, on l\'ajoute.',
      'alerte_valeur_aberrante : piège récurrent — un return False placé dans la boucle arrête tout au premier sous-dictionnaire. Le return False doit être placé après la boucle complète.',
    ],
    commonTraps: [
      'return False dans la boucle : si on écrit else: return False à l\'intérieur, on stoppe dès la première sous-branche sans valeur aberrante.',
      'Oublier de retourner le résultat de l\'appel récursif : alerte_valeur_aberrante(valeur, seuil) sans return ni if n\'a aucun effet.',
      'Comparer un dict à un nombre : sans isinstance, le code plante avec TypeError.',
    ],
    examinerQuestions: [
      {
        question:
          'Quel est le cas de base de votre récursion ?',
        expectedAnswer:
          'La rencontre d\'une feuille (isinstance(valeur, dict) est faux). On traite directement la valeur.',
      },
      {
        question:
          'Pourquoi un return False placé dans une boucle peut-il arrêter trop tôt ?',
        expectedAnswer:
          'Parce qu\'il s\'exécute dès la première itération qui n\'a pas trouvé de valeur aberrante, sans examiner les suivantes.',
      },
      {
        question: 'Cette récursion termine-t-elle toujours ?',
        expectedAnswer:
          'Oui, car à chaque appel récursif on descend d\'un niveau dans un arbre fini (un JSON ne peut pas être infiniment profond).',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt: 'Écrire total_rec et alerte_valeur_aberrante',
        expectedElements: [
          'isinstance',
          'récursion',
          'return False après la boucle',
        ],
      },
      {
        type: 'debug',
        prompt:
          'Placer le return False à l\'intérieur de la boucle et observer le bug',
        expectedElements: ['arrêt prématuré'],
      },
      {
        type: 'oral',
        prompt: 'Expliquer le cas de base et le cas récursif',
        expectedElements: ['feuille numérique', 'sous-dictionnaire'],
      },
    ],
    revisionProtocol:
      'Réécrire alerte_valeur_aberrante sans regarder. Vérifier que return False est APRÈS la boucle.',
  },

  // ── Subject 6 — Smoothies ────────────────────────────────────────────
  {
    id: 6,
    slug: 'smoothies',
    title: 'Smoothies — listes, méthodes, score de proximité',
    shortTitle: 'Smoothies',
    family: 'Méthodes, listes, score maximal',
    difficulty: 'facile',
    estimatedTimeMinutes: 25,
    examTimeMinutes: 55,
    files: {
      main: 'smoothie.py',
      pdf: 'sujet.pdf',
      python: ['smoothie.py'],
    },
    concepts: [
      'listes',
      'filtrage',
      'score de proximité',
      'recherche du maximum',
    ],
    patterns: [1, 2],
    mnemonic:
      'Possible = tous les ingrédients dispos. Alternative = possible + score commun maximal.',
    verbalAlgorithm: [
      'smoothie_possible : pour chaque fruit de la recette, vérifier qu\'il est dans les fruits disponibles. Au premier fruit manquant, renvoyer False.',
      'liste_smoothies_possibles : filtrer parmi toutes les recettes celles qui sont possibles.',
      'score_proximite : compter les fruits communs entre deux recettes.',
      'plus_proche_possible : restreindre aux smoothies possibles, calculer le score avec la recette cible, mémoriser le maximum et le nom associé.',
    ],
    commonTraps: [
      'Initialiser le maximum à 0 : si tous les scores sont 0, on rate le meilleur. Initialiser à -1.',
      'Comparer un smoothie à lui-même dans la boucle si la recette cible est dans la liste.',
      'Ne pas mettre à jour le nom en même temps que le score.',
    ],
    examinerQuestions: [
      {
        question:
          'Quelle est la différence entre smoothie possible et alternative ?',
        expectedAnswer:
          'Un smoothie est possible si on a tous ses ingrédients (condition binaire). Une alternative est un smoothie possible qui ressemble le plus à celui qu\'on voulait (condition graduée).',
      },
      {
        question:
          'Pourquoi initialise-t-on le meilleur score à -1 et pas à 0 ?',
        expectedAnswer:
          'Parce que 0 est une vraie valeur possible (aucun fruit commun). Avec -1, un smoothie avec score 0 sera retenu.',
      },
      {
        question:
          'Comment se comporte la fonction si la recette cible est dans la liste ?',
        expectedAnswer:
          'Elle est très proche d\'elle-même (score maximal), donc sera renvoyée. Selon le sens de la question, il faut l\'exclure.',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt: 'Écrire plus_proche_possible',
        expectedElements: [
          'meilleur_score = -1',
          'filtrer possibles',
          'score_proximite',
        ],
      },
      {
        type: 'quiz',
        prompt: 'Pourquoi -1 et pas 0 pour le score initial ?',
        expectedElements: ['0 est un score valide'],
      },
      {
        type: 'oral',
        prompt: 'Expliquer smoothie_possible en 4 phrases',
        expectedElements: [
          'contrat',
          'parcours ingrédients',
          'return False',
          'return True',
        ],
      },
    ],
    revisionProtocol:
      'Réécrire plus_proche_possible de mémoire.',
  },

  // ── Subject 7 — Coccinelles ──────────────────────────────────────────
  {
    id: 7,
    slug: 'coccinelles',
    title: 'Coccinelles — simulation orientée objet avec random',
    shortTitle: 'Coccinelles',
    family: 'Simulation POO + random',
    difficulty: 'difficile',
    estimatedTimeMinutes: 40,
    examTimeMinutes: 55,
    files: {
      main: 'coccinelles.py',
      pdf: 'sujet.pdf',
      python: ['coccinelles.py'],
    },
    concepts: [
      'POO',
      'simulation',
      'random',
      'attribut d\'instance',
      'boucle d\'évolution',
    ],
    patterns: [2],
    mnemonic:
      'Une simulation = un état + une transition. Le random vit dans la transition.',
    verbalAlgorithm: [
      'Initialisation : créer 3 Coccinelle(age=10, sexe=s), niv_nutrition=2, nb_proies=200.',
      'simulation_simple : boucle bornée à 30 jours, arrêt anticipé si plus de coccinelles ou plus de proies.',
      'chasser : consomme des proies, augmente niv_nutrition ; dépend de nb_proies.',
      'reproduction : seulement si age >= 20.',
      'a_survecu : meurt si age > esperance_de_vie. Si niv_nutrition == 0, probabilité de mort 1/3 via random.random() < 1/3.',
    ],
    commonTraps: [
      'Confondre attribut d\'instance et variable locale : niv_nutrition = 4 crée une variable locale ; il faut self.niv_nutrition = 4.',
      'Modifier la liste pendant le parcours pour la mort : construire population_suivante séparément.',
      'random.random() vs random.randint() : le premier renvoie un float dans [0,1[, le second un entier.',
    ],
    examinerQuestions: [
      {
        question:
          'Pourquoi la simulation peut-elle s\'arrêter avant 30 jours ?',
        expectedAnswer:
          'Deux conditions d\'arrêt anticipé : la population est éteinte ou les proies sont épuisées.',
      },
      {
        question:
          'Comment modélise-t-on une probabilité 1/3 en Python ?',
        expectedAnswer:
          'Avec random.random() < 1/3. random.random() suit une loi uniforme sur [0,1[.',
      },
      {
        question: 'Pourquoi utiliser self dans une méthode ?',
        expectedAnswer:
          'Parce que la méthode doit modifier l\'instance qui l\'a appelée. Sans self, on créerait une variable locale.',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt: 'Écrire la méthode a_survecu et reproduction',
        expectedElements: [
          'self.age',
          'random.random()',
          'return Coccinelle(...)',
        ],
      },
      {
        type: 'debug',
        prompt:
          'Que se passe-t-il si on écrit niv_nutrition = 4 au lieu de self.niv_nutrition = 4 ?',
        expectedElements: ['variable locale', 'attribut non modifié'],
      },
      {
        type: 'oral',
        prompt: 'Décrire le cycle d\'une journée de simulation',
        expectedElements: ['chasser', 'vieillir', 'reproduction', 'survie'],
      },
    ],
    revisionProtocol:
      'Réécrire la classe Coccinelle et la fonction evolution de mémoire.',
  },

  // ── Subject 8 — BCD ──────────────────────────────────────────────────
  {
    id: 8,
    slug: 'bcd-addition',
    title: 'BCD — flottants, conversion, addition décimale codée binaire',
    shortTitle: 'BCD',
    family: 'Flottants, BCD, retenue',
    difficulty: 'expert',
    estimatedTimeMinutes: 45,
    examTimeMinutes: 55,
    files: {
      main: 'addition_BCD.py',
      pdf: 'sujet.pdf',
      python: ['addition_BCD.py'],
    },
    concepts: [
      'BCD',
      'flottants',
      'retenue',
      'quartets binaires',
      'correction +6',
    ],
    patterns: [8],
    mnemonic:
      'Argent = pas de float. BCD = un chiffre décimal par quartet (4 bits).',
    verbalAlgorithm: [
      'calcul_recettes : montre l\'instabilité numérique des flottants.',
      'convertir_BCD_vers_decimal : chaque quartet → un chiffre décimal via int(quartet, 2) ; concaténer, diviser par 100.',
      'additionner_nombres_BCD : addition quartet par quartet, avec retenue ; si la somme d\'un quartet >= 10, appliquer la correction BCD (ajouter 6).',
      'aligner_quartets : compléter par \'0000\' la liste la plus courte, à gauche.',
    ],
    commonTraps: [
      'Float pour de l\'argent : 0.1 + 0.2 = 0.30000000000...04 en flottant.',
      'Ne pas appliquer la correction +6 : si la somme d\'un quartet est 12, on doit obtenir le quartet 2 et retenue 1.',
      'Aligner à droite au lieu de gauche : on perd les chiffres de poids fort.',
    ],
    examinerQuestions: [
      {
        question:
          'Pourquoi 0,1 est-il mal représenté en binaire ?',
        expectedAnswer:
          '0,1 en base 10 a un développement binaire infini périodique. La machine stocke un nombre fini de bits, ce qui introduit une erreur.',
      },
      {
        question:
          'Pourquoi ajoute-t-on 6 dans l\'addition BCD ?',
        expectedAnswer:
          'Parce qu\'un quartet code 0-9 mais peut représenter 0-15. Quand la somme tombe entre 10 et 15, on saute les 6 valeurs interdites.',
      },
      {
        question:
          'Pourquoi aligner les quartets à gauche avec des \'0000\' ?',
        expectedAnswer:
          'L\'addition se fait de la droite vers la gauche (poids faibles en premier). On aligne les poids forts en complétant par des zéros.',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt: 'Écrire corriger_BCD et additionner_nombres_BCD',
        expectedElements: ['correction +6', 'retenue', 'aligner'],
      },
      {
        type: 'quiz',
        prompt: 'Quel est le résultat de 0.1 + 0.2 en Python ?',
        expectedElements: ['0.30000000000000004'],
      },
      {
        type: 'oral',
        prompt:
          'Expliquer pourquoi BCD est mieux que float pour l\'argent',
        expectedElements: ['précision exacte', 'pas d\'erreur d\'arrondi'],
      },
    ],
    revisionProtocol:
      'Réécrire additionner_nombres_BCD et corriger_BCD de mémoire.',
  },

  // ── Subject 9 — Objet 3D ─────────────────────────────────────────────
  {
    id: 9,
    slug: 'objet-3d',
    title: 'Objet 3D — classes, distance, transformation',
    shortTitle: 'Objet 3D',
    family: 'POO 3D, distance, transformation',
    difficulty: 'difficile',
    estimatedTimeMinutes: 35,
    examTimeMinutes: 55,
    files: {
      main: 'Objet3D.py',
      pdf: 'sujet.pdf',
      python: ['Objet3D.py', 'Face.py', 'Sommet.py', 'Imprimante3D.py'],
    },
    concepts: [
      'POO',
      'distance euclidienne 3D',
      'sommets adjacents',
      'volume englobant',
      'transformation in-place',
    ],
    patterns: [1],
    mnemonic:
      'Une transformation modifie les sommets — elle ne se contente pas de calculer.',
    verbalAlgorithm: [
      'Sommet.distance : formule euclidienne 3D.',
      'sommets_adjacents : deux sommets sont adjacents si une face contient les deux comme indices consécutifs — ou comme couple dernier/premier (la face est cyclique). Le modulo gère la fermeture.',
      'estimation_impression : volume = volume du cube englobant × taux de remplissage ; temps = volume / vitesse d\'extrusion.',
      'transformer : le piège. Le code de base calcule les nouvelles coordonnées mais ne les réaffecte pas. Il faut modifier les attributs (s.x = s.x + dx).',
    ],
    commonTraps: [
      'Modulo oublié sur le dernier sommet : sans (k+1) % n, on rate l\'arête qui ferme la face.',
      'Calculer sans modifier : s.x + dx produit une valeur qu\'on jette si on n\'écrit pas s.x = s.x + dx.',
      'Confondre indices et objets Sommet : face.sommets contient des indices entiers, pas des objets.',
    ],
    examinerQuestions: [
      {
        question: 'Comment repérer une arête dans une face ?',
        expectedAnswer:
          'Deux sommets consécutifs (ou le couple dernier-premier) forment une arête. Le modulo (k+1) % n gère la fermeture.',
      },
      {
        question:
          'Pourquoi le dernier et le premier sommet d\'une face sont-ils adjacents ?',
        expectedAnswer:
          'Parce qu\'une face polygonale est fermée. Le quatrième côté relie le dernier sommet au premier.',
      },
      {
        question:
          'Quelle différence entre calculer et appliquer les coordonnées transformées ?',
        expectedAnswer:
          's.x + dx produit une nouvelle valeur mais n\'est stockée nulle part. Il faut l\'affectation s.x = s.x + dx.',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt: 'Écrire sommets_adjacents et transformer',
        expectedElements: ['(k+1) % n', 's.x = s.x + dx'],
      },
      {
        type: 'debug',
        prompt:
          'Que se passe-t-il si transformer calcule mais n\'affecte pas ?',
        expectedElements: ['objet non modifié'],
      },
      {
        type: 'oral',
        prompt: 'Expliquer la notion de face cyclique',
        expectedElements: ['dernier-premier', 'modulo'],
      },
    ],
    revisionProtocol:
      'Réécrire sommets_adjacents et transformer de mémoire.',
  },

  // ── Subject 10 — Compteurs d'eau ─────────────────────────────────────
  {
    id: 10,
    slug: 'compteurs-eau',
    title: 'Compteurs d\'eau — filtrage, détection de fuite, lissage',
    shortTitle: 'Compteurs d\'eau',
    family: 'Données horaires, fuite, lissage',
    difficulty: 'moyen',
    estimatedTimeMinutes: 30,
    examTimeMinutes: 55,
    files: {
      main: 'analyse_eau.py',
      pdf: 'sujet.pdf',
      python: ['analyse_eau.py'],
    },
    concepts: [
      'filtrage',
      'détection de séquence',
      'moyenne mobile',
      'cas limites bords',
    ],
    patterns: [1, 2, 7],
    mnemonic:
      'Fuite = 3 conso non nulles consécutives la nuit. Lissage = voisins, plus traitement des bords.',
    verbalAlgorithm: [
      'total_conso : filtrer les mesures du jour ciblé, sommer chaude + froide. None si liste vide.',
      'fuite_possible : parcourir les mesures entre 00h et 05h, maintenir un compteur de consommations non nulles consécutives. Si le compteur atteint 3 : True. À chaque consommation nulle, le compteur retombe à 0.',
      'lissage_conso : moyenne mobile de fenêtre 3. Cas des bords : i=0 → moyenne de [L[0], L[1]] ; i=n-1 → moyenne de [L[n-2], L[n-1]].',
    ],
    commonTraps: [
      'Consécutif mal interprété : trois fois plus de 0 dans la fenêtre ≠ trois fois de suite. La remise à 0 est obligatoire.',
      'Liste non triée : trier par heure d\'abord.',
      'Taille 1 ou 2 pour le lissage : cas spéciaux pour les bords.',
      'Renvoyer une liste plus courte : le lissage doit produire exactement le même nombre d\'éléments.',
    ],
    examinerQuestions: [
      {
        question:
          'Que signifie consécutif dans la détection de fuite ?',
        expectedAnswer:
          'Trois mesures d\'affilée, sans interruption, ayant toutes une consommation non nulle.',
      },
      {
        question:
          'Pourquoi le lissage doit-il préserver la taille de la liste ?',
        expectedAnswer:
          'Parce que chaque indice correspond à un instant temporel précis. Si on supprimait les deux bords, on perdrait l\'alignement.',
      },
      {
        question: 'Quels cas limites avez-vous testés ?',
        expectedAnswer:
          'Liste vide, liste à un élément, liste à deux éléments, et une liste normale de 10 éléments.',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt: 'Écrire fuite_possible et lissage_conso',
        expectedElements: [
          'compteur consécutifs',
          'reset à 0',
          'cas bords',
        ],
      },
      {
        type: 'quiz',
        prompt:
          'La séquence 0.5 - 0 - 0.3 - 0.4 - 0.2 est-elle une fuite ?',
        expectedElements: [
          'Non — la consommation nulle reset le compteur',
        ],
      },
      {
        type: 'oral',
        prompt:
          'Expliquer le traitement des bords dans le lissage',
        expectedElements: [
          'i=0 moyenne 2 éléments',
          'i=n-1 moyenne 2 éléments',
        ],
      },
    ],
    revisionProtocol:
      'Réécrire fuite_possible et lissage_conso de mémoire.',
  },

  // ── Subject 11 — Habitat du renard ───────────────────────────────────
  {
    id: 11,
    slug: 'habitat-renard',
    title: 'Habitat du renard — k plus proches voisins',
    shortTitle: 'Habitat renard',
    family: 'KNN, tuples, vote majoritaire',
    difficulty: 'moyen',
    estimatedTimeMinutes: 30,
    examTimeMinutes: 55,
    files: {
      main: 'prediction_habitat.py',
      pdf: 'sujet.pdf',
      python: ['prediction_habitat.py', 'donnees_habitats.py'],
    },
    concepts: [
      'KNN',
      'distance euclidienne',
      'tuples',
      'vote majoritaire',
      'accès tuple[1][\'champ\']',
    ],
    patterns: [5],
    mnemonic:
      'KNN = Distances → Tri → k premiers → Vote. Et l\'objet vit dans le tuple[1].',
    verbalAlgorithm: [
      'distance : distance euclidienne sur les 4 critères : vegetation, proximite_eau, densite_urbaine, disponibilite_proies.',
      'distance_d_un_habitat : pour chaque autre habitat, construire le tuple (distance, habitat).',
      'prevoir_presence : trier par distance, prendre les k premiers, voter à la majorité. Le piège : chaque voisin est un tuple, donc l\'accès au champ se fait par voisin[1][\'presence_renard\'].',
    ],
    commonTraps: [
      'Accès au tuple : voisin[\'presence_renard\'] échoue car un tuple n\'est pas indexable par chaîne. C\'est voisin[1][\'presence_renard\'].',
      'Tri sans key : si deux distances sont égales, Python tente de comparer les habitats (dictionnaires), ce qui lève TypeError.',
      'Majorité large vs stricte : >= k/2 inclut l\'égalité. La majorité stricte est > k/2.',
    ],
    examinerQuestions: [
      {
        question: 'Pourquoi trier avant de voter ?',
        expectedAnswer:
          'Pour ne garder que les k plus proches. Sans tri, on prendrait k habitats au hasard.',
      },
      {
        question:
          'Comment accède-t-on à un dictionnaire placé dans un tuple ?',
        expectedAnswer:
          'Par double indexation : tuple[index][cle]. Le tuple est indexé par entier, puis l\'habitat est indexé par chaîne.',
      },
      {
        question:
          'Pourquoi strictement plus de la moitié et pas au moins la moitié ?',
        expectedAnswer:
          'Parce qu\'à k=4, deux votes oui et deux non ne tranchent pas. La majorité stricte garantit un vainqueur clair.',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt: 'Écrire k_plus_proches et prevoir_presence',
        expectedElements: [
          'sort key=lambda',
          'distances[:k]',
          'votes > k/2',
        ],
      },
      {
        type: 'debug',
        prompt:
          'Que se passe-t-il si on accède à voisin[\'presence_renard\'] au lieu de voisin[1][\'presence_renard\'] ?',
        expectedElements: ['TypeError'],
      },
      {
        type: 'oral',
        prompt: 'Expliquer l\'algorithme KNN en 4 phrases',
        expectedElements: ['distances', 'tri', 'k premiers', 'vote'],
      },
    ],
    revisionProtocol:
      'Réécrire prevoir_presence de mémoire. Bien vérifier l\'accès tuple[1][\'champ\'].',
  },

  // ── Subject 12 — Refuge de renards ───────────────────────────────────
  {
    id: 12,
    slug: 'refuge-renards',
    title: 'Refuge de renards — CSV, classes, conversions de types',
    shortTitle: 'Refuge renards',
    family: 'Classe, CSV, conversions de types',
    difficulty: 'moyen',
    estimatedTimeMinutes: 30,
    examTimeMinutes: 55,
    files: {
      main: 'gestion_refuge.py',
      pdf: 'sujet.pdf',
      python: ['gestion_refuge.py'],
      data: ['donnees_renards.csv'],
    },
    concepts: [
      'CSV',
      'classes',
      'int()',
      'float()',
      '__str__',
      'filtrage',
      'pourcentage',
    ],
    patterns: [2, 6],
    mnemonic:
      'CSV → tout est str → je convertis explicitement ce qui se calcule.',
    verbalAlgorithm: [
      'Renard.__init__ : affecter id, nom, poids, date_arrivee en attributs d\'instance.',
      '__str__ : produire une chaîne lisible.',
      'importer_donnees : ouvrir le CSV avec csv.DictReader, créer un Renard par ligne, en convertissant int(ligne[\'id\']) et float(ligne[\'poids\']).',
      'lister_peu_corpulents : filtrer les renards de poids < 6.0 kg.',
      'pourcentage_peu_corpulents : proportion sur le total. None ou 0 si refuge vide.',
    ],
    commonTraps: [
      'Oublier les conversions : sans int() et float(), r.poids < 6.0 compare "5.3" < 6.0 ce qui lève TypeError.',
      'Délimiteur : la convention française utilise ; l\'anglo-saxonne , . À ajuster.',
      'Refuge vide : la division len(peu)/0 plante. Toujours tester.',
      'Variable d\'instance vs nom de paramètre : si on écrit def __init__(self, id, ...), le mot id masque la fonction id() de Python. Préférer id_renard.',
    ],
    examinerQuestions: [
      {
        question: 'Pourquoi CSV lit-il tout en chaînes ?',
        expectedAnswer:
          'Parce que CSV est un format texte : il ne connaît pas le type des données. C\'est au programmeur de convertir explicitement.',
      },
      {
        question: 'Pourquoi définir une méthode __str__ ?',
        expectedAnswer:
          'Pour que print(renard) affiche une chaîne lisible plutôt que l\'adresse mémoire par défaut.',
      },
      {
        question:
          'Pourquoi un attribut self.id et pas une variable globale ?',
        expectedAnswer:
          'Parce que chaque renard a son identifiant. self.id appartient à l\'instance.',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt: 'Écrire importer_donnees avec csv.DictReader',
        expectedElements: ['int()', 'float()', 'delimiter=\';\''],
      },
      {
        type: 'quiz',
        prompt: 'Que compare "5.3" < 6.0 sans conversion ?',
        expectedElements: ['TypeError en Python 3'],
      },
      {
        type: 'oral',
        prompt: 'Expliquer pourquoi on convertit les types CSV',
        expectedElements: ['tout est str', 'comparaison numérique'],
      },
    ],
    revisionProtocol:
      'Réécrire importer_donnees et la classe Renard de mémoire.',
  },

  // ── Subject 13 — Ballon-sonde ────────────────────────────────────────
  {
    id: 13,
    slug: 'ballon-sonde',
    title: 'Ballon-sonde — CSV météo, recherche de minimum, KML',
    shortTitle: 'Ballon-sonde',
    family: 'CSV météo, min, KML',
    difficulty: 'difficile',
    estimatedTimeMinutes: 35,
    examTimeMinutes: 55,
    files: {
      main: 'etude_climatique.py',
      pdf: 'sujet.pdf',
      python: ['etude_climatique.py'],
      data: ['releves_ballon_sonde.csv'],
    },
    concepts: [
      'CSV',
      'conversion Kelvin→Celsius',
      'recherche de minimum avec égalités',
      'format KML',
    ],
    patterns: [6, 7],
    mnemonic:
      'Kelvin → Celsius par −273,15. Min trouvé d\'abord, altitudes filtrées ensuite.',
    verbalAlgorithm: [
      'Conversion : T_C = T_K − 273.15.',
      'lire_donnees : DictReader, convertir altitude et température (en kelvins puis en degrés Celsius).',
      'altitudes_temperature_min : utiliser le patron 7 — calculer la température minimale, puis collecter toutes les altitudes qui l\'atteignent.',
      'generer_kml : produire un texte XML strict. Attention : l\'ordre KML est longitude avant latitude, contre-intuitif.',
    ],
    commonTraps: [
      'Oublier la conversion en Celsius : le minimum sur des kelvins est mathématiquement correct, mais l\'énoncé attend des Celsius.',
      'Renvoyer la première altitude au lieu de toutes : si deux relevés ont la même température minimale, on rate la moitié de la réponse.',
      'Ordre KML : la convention géographique est latitude, longitude. KML inverse : longitude, latitude.',
      'Comparaison de flottants : r[\'temperature\'] == t_min est fiable parce que t_min vient lui-même de la liste.',
    ],
    examinerQuestions: [
      {
        question:
          'Pourquoi convertir les types lus depuis CSV ?',
        expectedAnswer:
          'Parce que le module csv renvoie tout en chaînes de caractères. Sans conversion, on ne peut ni comparer numériquement ni passer à une fonction mathématique.',
      },
      {
        question:
          'Pourquoi garder toutes les altitudes correspondant au minimum ?',
        expectedAnswer:
          'Parce que le ballon peut traverser une même couche thermique plusieurs fois. L\'énoncé demande toutes les altitudes concernées.',
      },
      {
        question:
          'Qu\'est-ce qu\'un format texte structuré comme KML ?',
        expectedAnswer:
          'Un format où la grammaire est définie par des balises imbriquées (XML). Il faut respecter strictement la grammaire.',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt: 'Écrire altitudes_temperature_min et generer_kml',
        expectedElements: ['min()', 'filtrer ==', 'longitude,latitude'],
      },
      {
        type: 'quiz',
        prompt: 'Dans quel ordre sont les coordonnées KML ?',
        expectedElements: ['longitude, latitude, altitude'],
      },
      {
        type: 'oral',
        prompt:
          'Expliquer le patron recherche du minimum avec égalités',
        expectedElements: [
          'trouver le min',
          'filtrer tous ceux qui l\'atteignent',
        ],
      },
    ],
    revisionProtocol:
      'Réécrire altitudes_temperature_min et generer_kml de mémoire.',
  },

  // ── Subject 14 — Évacuation ──────────────────────────────────────────
  {
    id: 14,
    slug: 'evacuation',
    title: 'Évacuation — simulation d\'une pièce à plusieurs sorties',
    shortTitle: 'Évacuation',
    family: 'Simulation grille, sorties, IHM',
    difficulty: 'difficile',
    estimatedTimeMinutes: 40,
    examTimeMinutes: 55,
    files: {
      main: 'simulation_evacuation.py',
      pdf: 'sujet.pdf',
      python: ['simulation_evacuation.py', 'IHM_evacuation.py'],
    },
    concepts: [
      'simulation',
      'grille 2D',
      'distance Manhattan',
      'recherche du minimum',
      'boucle jusqu\'à vide',
    ],
    patterns: [7],
    mnemonic:
      'Boucle jusqu\'à vide. Chaque personne va vers la sortie de distance minimale.',
    verbalAlgorithm: [
      'nb_occupants_restants : parcourir la grille, compter les cases OCCUPE.',
      'evacuation : tant qu\'il reste des occupants et que la dernière itération a déplacé quelqu\'un, incrémenter le compteur de tours.',
      'ajouter_sortie : selon la direction N/S/O/E, placer la sortie sur le bon bord.',
      'choix_sortie : pour une personne donnée, calculer la distance à chacune des sorties, conserver la plus proche. Bug à corriger : le code initial renvoie toujours la première sortie sans comparer.',
    ],
    commonTraps: [
      'Boucle infinie : sans le test if deplacees == 0: break, une personne bloquée fait tourner la simulation à l\'infini.',
      'self.sorties[0] comme meilleure sans mise à jour : c\'est le bug classique. Toujours initialiser un minimum à la première valeur effectivement testée.',
      'Confondre (x,y) et grille[y][x] : la grille est indexée ligne d\'abord.',
    ],
    examinerQuestions: [
      {
        question:
          'Quelle est la condition d\'arrêt d\'une simulation comme celle-ci ?',
        expectedAnswer:
          'Idéalement, la pièce est vide. Mais il faut aussi prévoir le cas où plus personne ne peut bouger, sinon on boucle à l\'infini.',
      },
      {
        question: 'Comment choisir le minimum d\'une liste ?',
        expectedAnswer:
          'On initialise le minimum courant à la première valeur, puis on parcourt le reste en comparant.',
      },
      {
        question:
          'Comment gérer quatre directions proprement ?',
        expectedAnswer:
          'Avec une structure if/elif sur la direction, et un dictionnaire des décalages (dx, dy) associés.',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt: 'Écrire choix_sortie corrigé et evacuation',
        expectedElements: [
          'initialiser meilleure distance',
          'comparer chaque sortie',
          'break si aucun déplacement',
        ],
      },
      {
        type: 'debug',
        prompt:
          'Identifier le bug si choix_sortie renvoie toujours la première sortie',
        expectedElements: [
          'pas de comparaison',
          'minimum non mis à jour',
        ],
      },
      {
        type: 'oral',
        prompt:
          'Expliquer la condition d\'arrêt de la simulation',
        expectedElements: [
          'pièce vide',
          'aucun déplacement possible',
        ],
      },
    ],
    revisionProtocol:
      'Réécrire choix_sortie et evacuation de mémoire.',
  },

  // ── Subject 15 — Cabinet vétérinaire ─────────────────────────────────
  {
    id: 15,
    slug: 'cabinet-veterinaire',
    title: 'Cabinet vétérinaire — téléphone, SQL, dernière vaccination',
    shortTitle: 'Cabinet véto',
    family: 'SQLite, requêtes, tuples, dates',
    difficulty: 'difficile',
    estimatedTimeMinutes: 35,
    examTimeMinutes: 55,
    files: {
      main: 'veto.py',
      pdf: 'sujet.pdf',
      python: ['veto.py'],
      database: ['cabinet.sqlite'],
    },
    concepts: [
      'SQL JOIN',
      'SQLite',
      'normalisation téléphone',
      'comparaison de dates ISO',
      'dictionnaire accumulateur',
    ],
    patterns: [1],
    mnemonic:
      'Date AAAAMMJJ se compare comme une chaîne. SQL filtre, Python garde le max par id.',
    verbalAlgorithm: [
      'normalisation_tel : ne garder que les chiffres avec \'\'.join(c for c in tel if c.isdigit()).',
      'validation_tel : vérifier longueur (10 en France) et préfixe (06 ou 07 pour un portable).',
      'consultation_vaccination_chat(date) : requête SQL joignant animaux, proprietaires, consultations, filtrant sur espece=\'chat\', motif=\'vaccination\', date_consultation > ?.',
      'derniere_vaccination : parcourir les résultats SQL, maintenir un dictionnaire {id_chat: consultation_la_plus_recente}. Remplacer si on trouve une date plus récente.',
    ],
    commonTraps: [
      'Comparer des dates au format non-ISO : « 12/03/2024 » se compare mal en lexicographique. Le format ISO « 2024-03-12 » fonctionne correctement.',
      'Injection SQL : ne jamais concaténer les paramètres dans la requête. Utiliser les placeholders ? et passer un tuple à execute.',
      'Tuple SQL vs dictionnaire : par défaut, fetchall() renvoie des tuples. Pour accéder par nom de colonne, utiliser sqlite3.Row.',
      'Mise à jour conditionnelle : si on remplace systématiquement, on garde la dernière vue, pas la plus récente.',
    ],
    examinerQuestions: [
      {
        question:
          'Pourquoi le format AAAA-MM-JJ se compare-t-il bien comme une chaîne ?',
        expectedAnswer:
          'Parce que la comparaison lexicographique procède caractère par caractère, et ce format met les chiffres les plus significatifs à gauche.',
      },
      {
        question:
          'Comment garder la consultation la plus récente par animal ?',
        expectedAnswer:
          'Avec un dictionnaire id_animal → consultation. À chaque nouvelle consultation, on vérifie si l\'animal est déjà dans le dictionnaire ; si oui, on garde la plus récente.',
      },
      {
        question:
          'Pourquoi utiliser ? dans la requête SQL plutôt que concaténer ?',
        expectedAnswer:
          'Sécurité (injection SQL) et propreté. Le paramètre est échappé proprement par le pilote SQLite.',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt:
          'Écrire la requête SQL avec JOIN et le filtrage par date',
        expectedElements: [
          'JOIN animaux',
          'JOIN proprietaires',
          'WHERE espece=\'chat\'',
          '?',
        ],
      },
      {
        type: 'quiz',
        prompt:
          'Pourquoi ne pas concaténer les paramètres SQL ?',
        expectedElements: ['injection SQL', 'sécurité'],
      },
      {
        type: 'oral',
        prompt:
          'Expliquer comment garder le max par id dans un dictionnaire',
        expectedElements: [
          'vérifier si présent',
          'comparer dates',
          'remplacer si plus récent',
        ],
      },
    ],
    revisionProtocol:
      'Réécrire la requête SQL et derniere_vaccination de mémoire.',
  },

  // ── Subject 16 — Température mondiale ────────────────────────────────
  {
    id: 16,
    slug: 'temperature-mondiale',
    title: 'Température mondiale — CSV climatique et warming stripes',
    shortTitle: 'Warming stripes',
    family: 'CSV + image warming stripes',
    difficulty: 'moyen',
    estimatedTimeMinutes: 30,
    examTimeMinutes: 55,
    files: {
      main: 'warming_stripes.py',
      pdf: 'sujet.pdf',
      python: ['warming_stripes.py'],
      data: ['datas.csv'],
      images: ['warming_stripes.png'],
    },
    concepts: [
      'CSV',
      'virgule décimale',
      'warming stripes',
      'normalisation couleur',
    ],
    patterns: [1, 6],
    mnemonic:
      'On moyenne les écarts, pas les années. Et chaque bande a la même hauteur.',
    verbalAlgorithm: [
      'ecart_temperature(annee) : parcourir, renvoyer l\'écart pour cette année ou None si absente.',
      'derniere_annee_ecart_negatif : parmi les années avec écart < 0, retourner la plus grande.',
      'moyenne_ecarts(debut, fin) : bug récurrent — moyenner les années au lieu des écarts. Bien sommer ligne[\'ecart\'] et diviser par le nombre de lignes filtrées.',
      'graphique : pour les warming stripes, abscisse = années, ordonnée constante, couleur = bleu pour négatif, rouge pour positif.',
    ],
    commonTraps: [
      'Moyenner les années au lieu des écarts : aberration totale, le résultat est l\'année moyenne.',
      'Virgule décimale : les CSV en convention française utilisent \',\' comme séparateur décimal. Faire .replace(\',\', \'.\') avant float().',
      'Conversion oubliée : int(ligne[\'annee\']) obligatoire pour comparer numériquement à debut et fin.',
      'Hauteurs variables : warming stripes = bandes uniformes, seule la couleur change.',
    ],
    examinerQuestions: [
      {
        question:
          'Pourquoi une prévision climatique devient absurde si on moyenne les mauvaises données ?',
        expectedAnswer:
          'Moyenner les années donne une année moyenne (par exemple 1937), qui n\'est pas une température.',
      },
      {
        question: 'Que représentent les warming stripes ?',
        expectedAnswer:
          'Chaque bande verticale est une année. La couleur indique l\'écart à la moyenne climatologique — rouge = plus chaud, bleu = plus froid.',
      },
      {
        question:
          'Quelle est la différence entre absolue et écart à une référence ?',
        expectedAnswer:
          'La température absolue varie fortement selon la saison. L\'écart à une moyenne de référence permet de comparer entre années.',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt:
          'Écrire moyenne_ecarts sans confondre années et écarts',
        expectedElements: ['sum d[\'ecart\']', 'len(filtree)'],
      },
      {
        type: 'quiz',
        prompt: 'Quel est le piège principal de moyenne_ecarts ?',
        expectedElements: [
          'moyenner les années au lieu des écarts',
        ],
      },
      {
        type: 'oral',
        prompt: 'Expliquer ce que sont les warming stripes',
        expectedElements: [
          'bande par année',
          'couleur = écart',
          'rouge/bleu',
        ],
      },
    ],
    revisionProtocol:
      'Réécrire lire_csv et moyenne_ecarts de mémoire. Vérifier le replace virgule→point.',
  },

  // ── Subject 17 — Budget handball ─────────────────────────────────────
  {
    id: 17,
    slug: 'budget-handball',
    title: 'Budget handball — CSV, solde annuel, agrégation par poste',
    shortTitle: 'Budget handball',
    family: 'Budget, CSV, agrégation',
    difficulty: 'moyen',
    estimatedTimeMinutes: 30,
    examTimeMinutes: 55,
    files: {
      main: 'analyse_budget.py',
      pdf: 'sujet.pdf',
      python: ['analyse_budget.py'],
      data: ['budget_complet.csv'],
    },
    concepts: [
      'CSV',
      'recettes vs dépenses',
      'dictionnaire accumulateur',
      'tri décroissant',
    ],
    patterns: [1, 3, 6],
    mnemonic:
      'Recettes moins dépenses, et un dictionnaire-accumulateur pour les catégories.',
    verbalAlgorithm: [
      'total_par_type(mouvements, type_mvt) : sommer les montant dont le type correspond.',
      'solde_annuel(mouvements) : total des recettes − total des dépenses. Bug fréquent : faire la somme algébrique sans distinguer les signes.',
      'total_par_categorie(mouvements) : initialiser un dictionnaire vide, puis pour chaque mouvement, ajouter le montant à la clé categorie.',
      'categorie_la_plus_couteuse(mouvements) : agréger par catégorie pour les dépenses seulement, puis renvoyer la clé du maximum.',
    ],
    commonTraps: [
      'Conversions CSV : ligne[\'montant\'] est une chaîne. Sans float(...), la somme concatène les chaînes.',
      'Double comptage : si on calcule le solde via sum(m[\'montant\']) sans distinguer recettes/dépenses, on additionne tout.',
      'Clé absente dans le dictionnaire : initialiser totaux[cle] = 0 avant d\'incrémenter.',
      'Signe des dépenses : les dépenses peuvent être stockées positives ou négatives selon le CSV. Vérifier en lisant 2-3 lignes.',
    ],
    examinerQuestions: [
      {
        question:
          'Quelle différence entre une recette et une dépense dans ce CSV ?',
        expectedAnswer:
          'Distinction par la colonne type. Le montant est lui-même positif dans les deux cas ; c\'est le rôle de solde_annuel de faire la soustraction.',
      },
      {
        question:
          'Pourquoi agréger dans un dictionnaire plutôt que dans une liste ?',
        expectedAnswer:
          'Les catégories sont des chaînes de caractères. Le dictionnaire donne un accès en O(1) à l\'accumulateur de chaque catégorie.',
      },
      {
        question:
          'Comment trier les postes par montant décroissant ?',
        expectedAnswer:
          'sorted(depenses.items(), key=lambda t: t[1], reverse=True).',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt:
          'Écrire total_par_categorie et categorie_la_plus_couteuse',
        expectedElements: ['dict accumulateur', 'max sur les clés'],
      },
      {
        type: 'quiz',
        prompt: 'Quel est le piège du solde annuel ?',
        expectedElements: [
          'ne pas distinguer recettes et dépenses',
        ],
      },
      {
        type: 'oral',
        prompt: 'Expliquer le pattern dictionnaire-accumulateur',
        expectedElements: ['initialiser', 'parcourir', 'incrémenter'],
      },
    ],
    revisionProtocol:
      'Réécrire total_par_categorie et solde_annuel de mémoire.',
  },

  // ── Subject 18 — Températures Polynésie ──────────────────────────────
  {
    id: 18,
    slug: 'temperatures-polynesie',
    title: 'Températures Polynésie — moyenne par zone et détection d\'anomalies',
    shortTitle: 'Températures Polynésie',
    family: 'Températures par zone, anomalies',
    difficulty: 'moyen',
    estimatedTimeMinutes: 30,
    examTimeMinutes: 55,
    files: {
      main: 'analyse_temperatures_polynesie.py',
      pdf: 'sujet.pdf',
      python: ['analyse_temperatures_polynesie.py'],
    },
    concepts: [
      'moyenne conditionnelle',
      'anomalie',
      'valeur absolue',
      'zones distinctes',
    ],
    patterns: [1, 2],
    mnemonic:
      'Anomalie = écart absolu à la moyenne supérieur au seuil.',
    verbalAlgorithm: [
      'temperature_moyenne(zone, donnees) : filtrer les relevés dont zone correspond, sommer les températures, diviser par l\'effectif. Renvoyer None si aucun relevé pour cette zone.',
      'detecter_anomalies(zone, seuil, donnees) : calculer la moyenne de la zone, puis renvoyer les relevés dont abs(temp - moyenne) > seuil.',
      'zones_uniques(donnees) : ensemble des zones distinctes — utile pour itérer.',
    ],
    commonTraps: [
      'Oubli du cas None : si temperature_moyenne renvoie None, faire abs(r[\'temperature\'] - None) lève TypeError.',
      'Comparer une température à elle-même : c\'est l\'erreur classique du bug fourni.',
      'Seuil inclus ou exclu : l\'énoncé dit strictement supérieur, donc > seuil, pas >=.',
      'Valeur absolue oubliée : sans abs, on ne détecte que les anomalies positives.',
    ],
    examinerQuestions: [
      {
        question:
          'Qu\'est-ce qu\'une anomalie par rapport à une moyenne ?',
        expectedAnswer:
          'Une mesure dont l\'écart absolu à la moyenne dépasse un seuil fixé. Le terme inclut les anomalies chaudes et froides.',
      },
      {
        question: 'Pourquoi utiliser abs ?',
        expectedAnswer:
          'Parce que le seuil borne l\'amplitude de l\'écart, pas son signe. Une température 5°C sous la moyenne est aussi anormale que 5°C au-dessus.',
      },
      {
        question:
          'Que faire si la zone n\'existe pas dans les données ?',
        expectedAnswer:
          'Renvoyer None pour la moyenne et [] pour les anomalies. Ne pas propager silencieusement une erreur.',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt: 'Écrire detecter_anomalies',
        expectedElements: [
          'abs()',
          '> seuil',
          'tester moyenne is None',
        ],
      },
      {
        type: 'quiz',
        prompt:
          'Pourquoi abs est indispensable dans la détection d\'anomalies ?',
        expectedElements: ['anomalies chaudes ET froides'],
      },
      {
        type: 'oral',
        prompt: 'Expliquer temperature_moyenne en 4 phrases',
        expectedElements: ['filtrer', 'sommer', 'diviser', 'None si vide'],
      },
    ],
    revisionProtocol:
      'Réécrire detecter_anomalies et synthese_par_zone de mémoire.',
  },

  // ── Subject 19 — Réservoirs d'eau ────────────────────────────────────
  {
    id: 19,
    slug: 'reservoirs-eau',
    title: 'Réservoirs d\'eau — pénurie, moyennes globales, districts vulnérables',
    shortTitle: 'Réservoirs',
    family: 'Réservoirs, moyennes, districts',
    difficulty: 'moyen',
    estimatedTimeMinutes: 30,
    examTimeMinutes: 55,
    files: {
      main: 'gestion_eau.py',
      pdf: 'sujet.pdf',
      python: ['gestion_eau.py', 'donnees.py'],
    },
    concepts: [
      'taux de remplissage',
      'dictionnaire accumulateur',
      'moyenne globale vs locale',
      'seuil',
    ],
    patterns: [1, 3],
    mnemonic:
      'Pénurie <20% du volume. Vulnérable <80% de la moyenne globale.',
    verbalAlgorithm: [
      'est_en_penurie(reservoir) : calculer le taux volume/capacite * 100 ; renvoyer True si < 20.',
      'volume_par_district(reservoirs) : dictionnaire-accumulateur classique. Clé = district, valeur = somme des volumes.',
      'volume_moyen(reservoirs) : assert liste non vide, puis moyenne des volumes disponibles (pas des capacités !).',
      'districts_vulnerables(reservoirs) : calculer la moyenne globale, puis pour chaque district, sa moyenne locale ; retenir ceux dont la moyenne locale < 0.8 × moyenne globale.',
    ],
    commonTraps: [
      'Volume vs capacité : la capacité est la taille du réservoir, le volume est ce qu\'il contient. Confondre les deux fausse tout.',
      'assert oublié : si la liste est vide, sum(...) / 0 lève ZeroDivisionError.',
      'Pourcentage vs taux : 20% s\'écrit 0.20 ou bien <20 après multiplication par 100. Choisir une convention et s\'y tenir.',
    ],
    examinerQuestions: [
      {
        question:
          'Pourquoi distinguer volume et capacité ?',
        expectedAnswer:
          'Le taux de remplissage est le rapport des deux. Un réservoir de 1000 m³ rempli à 500 m³ est à 50%.',
      },
      {
        question:
          'Pourquoi un assert sur la liste non vide ?',
        expectedAnswer:
          'assert documente une condition que la fonction exige de son appelant. C\'est un contrat de programmation.',
      },
      {
        question:
          'Comment comparer une moyenne locale à une moyenne globale ?',
        expectedAnswer:
          'Calculer une seule fois la moyenne globale, puis pour chaque district, calculer sa moyenne locale et comparer. Le seuil 80% est un ratio.',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt: 'Écrire districts_vulnerables',
        expectedElements: [
          'volume_moyen',
          'moyenne_par_district',
          '< 0.8 * globale',
        ],
      },
      {
        type: 'quiz',
        prompt:
          'Quelle est la différence entre volume et capacité ?',
        expectedElements: [
          'volume = contenu',
          'capacité = taille totale',
        ],
      },
      {
        type: 'oral',
        prompt: 'Expliquer le seuil de vulnérabilité',
        expectedElements: [
          'moyenne locale',
          '< 80% de la globale',
        ],
      },
    ],
    revisionProtocol:
      'Réécrire districts_vulnerables de mémoire.',
  },

  // ── Subject 20 — Empreinte numérique ─────────────────────────────────
  {
    id: 20,
    slug: 'empreinte-numerique',
    title: 'Empreinte numérique — classification par seuils et comparaison protégée',
    shortTitle: 'Empreinte numérique',
    family: 'Empreinte numérique, seuils, pourcentages',
    difficulty: 'moyen',
    estimatedTimeMinutes: 30,
    examTimeMinutes: 55,
    files: {
      main: 'code_empreinte.py',
      pdf: 'sujet.pdf',
      python: ['code_empreinte.py'],
    },
    concepts: [
      'seuils de classification',
      'pourcentage de variation',
      'division par zéro',
      'dictionnaire de listes',
    ],
    patterns: [1, 3],
    mnemonic:
      'Seuils 1000 / 200 pour fort/moyen/faible. Et protéger le dénominateur dans comparer_v2.',
    verbalAlgorithm: [
      'calculer_empreinte(activites) : sommer quantite × facteur sur toutes les activités.',
      'classer_par_impact(activites) : pour chaque activité, calculer son émission ; placer dans fort si >= 1000, moyen si >= 200, faible sinon.',
      'comparer(activites1, activites2) : compare deux jeux d\'activités, renvoie un dictionnaire des différences.',
      'comparer_v2(emission1, emission2) : pourcentage de variation = (emission2 − emission1)/emission1 × 100. Bug fourni : division par zéro si emission1 == 0. Protéger.',
    ],
    commonTraps: [
      'Division par zéro dans comparer_v2 : c\'est le bug fourni par l\'énoncé.',
      'Seuils inclus ou exclus : l\'énoncé précise >=. Avec >, une émission exactement à 1000 tombe en moyen.',
      'Ordre des tests if/elif : tester >= SEUIL_MOYEN avant >= SEUIL_FORT placerait les fortes émissions en moyen.',
    ],
    examinerQuestions: [
      {
        question:
          'Pourquoi une division par zéro peut-elle arriver ici ?',
        expectedAnswer:
          'Parce que l\'émission de référence peut être nulle si l\'utilisateur n\'avait aucune activité. Renvoyer None signale ce cas.',
      },
      {
        question:
          'Comment classer avec des seuils inclus ou exclus ?',
        expectedAnswer:
          'Convention : seuil inclus dans la catégorie supérieure (>= 1000 → fort). On teste toujours dans l\'ordre décroissant des seuils.',
      },
      {
        question:
          'Pourquoi une variation relative et pas une variation absolue ?',
        expectedAnswer:
          'Parce que « j\'ai réduit mon empreinte de 500 » n\'a pas le même sens si l\'empreinte initiale était 1000 ou 100000. Le pourcentage normalise la mesure.',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt: 'Écrire classer_par_impact et comparer_v2',
        expectedElements: [
          'if/elif ordre décroissant',
          'if emission1 == 0: return None',
        ],
      },
      {
        type: 'debug',
        prompt:
          'Que se passe-t-il si on teste >= SEUIL_MOYEN avant >= SEUIL_FORT ?',
        expectedElements: ['fortes émissions classées en moyen'],
      },
      {
        type: 'oral',
        prompt:
          'Expliquer pourquoi on protège la division par zéro',
        expectedElements: ['émission nulle possible', 'None explicite'],
      },
    ],
    revisionProtocol:
      'Réécrire classer_par_impact et comparer_v2 de mémoire.',
  },

  // ── Subject 21 — Flashcards Leitner ──────────────────────────────────
  {
    id: 21,
    slug: 'flashcards-leitner',
    title: 'Flashcards Leitner — POO, répétition espacée, niveau minimal',
    shortTitle: 'Flashcards Leitner',
    family: 'POO Leitner, dates, niveau minimal',
    difficulty: 'difficile',
    estimatedTimeMinutes: 35,
    examTimeMinutes: 55,
    files: {
      main: 'cartes.py',
      pdf: 'sujet.pdf',
      python: ['cartes.py'],
    },
    concepts: [
      'POO',
      'Leitner',
      'dates',
      'timedelta',
      'recherche du minimum',
      'répétition espacée',
    ],
    patterns: [7],
    mnemonic:
      'Succès → min(4, niveau+1). Échec → 0. Date prochaine = aujourd\'hui + délai du nouveau niveau.',
    verbalAlgorithm: [
      'Carte.traiter_reponse(succes, date_jour) : si succès, monter d\'un niveau plafonné à 4 ; sinon, retomber à 0. Recalculer date_prochaine en ajoutant DELAIS[niveau] jours à la date courante.',
      'extraire_cartes_du_jour(paquet, date_jour) : retourner les cartes dont date_prochaine <= date_jour.',
      'extraire_cartes_a_renforcer(paquet) : trouver le niveau minimal dans le paquet, puis ne retourner que les cartes à ce niveau exact.',
    ],
    commonTraps: [
      'min(4, niveau+1) et pas niveau+1 : sans plafond, on accède à DELAIS[5] et c\'est IndexError.',
      'Retour à 0 sur échec et pas -1 : Leitner est asymétrique. Une erreur efface tout le progrès.',
      'Date calculée avec le nouveau niveau : l\'erreur classique est d\'utiliser DELAIS[ancien_niveau].',
      'Niveau minimal vs seuil : extraire_cartes_a_renforcer renvoie exactement le niveau le plus bas, pas tout ce qui est en dessous d\'un seuil.',
    ],
    examinerQuestions: [
      {
        question: 'Pourquoi utiliser min(4, niveau+1) ?',
        expectedAnswer:
          'Pour borner le niveau dans l\'intervalle valide [0,4]. Sans cette borne, on accéderait à DELAIS[5] et on aurait une exception.',
      },
      {
        question:
          'Comment trouver toutes les cartes du niveau minimal ?',
        expectedAnswer:
          'Deux passes. Première passe : min_niveau = min(c.niveau for c in paquet). Deuxième passe : filtrer c.niveau == min_niveau.',
      },
      {
        question:
          'Pourquoi le principe Leitner fonctionne pédagogiquement ?',
        expectedAnswer:
          'Parce qu\'il calque le rythme des révisions sur la courbe de l\'oubli d\'Ebbinghaus. Plus une carte est mal sue, plus elle revient souvent.',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt:
          'Écrire traiter_reponse et extraire_cartes_a_renforcer',
        expectedElements: [
          'min(4, niveau+1)',
          'niveau = 0',
          'min(c.niveau)',
        ],
      },
      {
        type: 'quiz',
        prompt:
          'Que se passe-t-il après 10 succès consécutifs ?',
        expectedElements: ['Le niveau reste plafonné à 4.'],
      },
      {
        type: 'oral',
        prompt: 'Expliquer le système Leitner en 4 phrases',
        expectedElements: [
          'niveaux 0-4',
          'succès = +1',
          'échec = 0',
          'délai croissant',
        ],
      },
    ],
    revisionProtocol:
      'Réécrire traiter_reponse et extraire_cartes_a_renforcer de mémoire.',
  },

  // ── Subject 22 — QR code simplifié ───────────────────────────────────
  {
    id: 22,
    slug: 'qrcode-simplifie',
    title: 'QR code simplifié — binaire ↔ décimal ↔ ASCII, sans perdre les zéros',
    shortTitle: 'QR code',
    family: 'Binaire, ASCII, zéros initiaux',
    difficulty: 'difficile',
    estimatedTimeMinutes: 35,
    examTimeMinutes: 55,
    files: {
      main: 'qrcode.py',
      pdf: 'sujet.pdf',
      python: ['qrcode.py', 'ascii.py'],
    },
    concepts: [
      'binaire',
      'décimal',
      'ASCII',
      'Horner',
      'format(n, \'08b\')',
      'tuple vs liste',
    ],
    patterns: [8],
    mnemonic:
      'valeur = valeur*2 + bit pour décoder. format(n, \'08b\') pour encoder sans perdre les zéros initiaux.',
    verbalAlgorithm: [
      'bin2dec(bits) : algorithme de Horner. Partir de valeur = 0 ; pour chaque bit de gauche à droite, faire valeur = valeur*2 + bit.',
      'qrcode2dec(qrcode) : appliquer bin2dec à chaque ligne (tuple de bits).',
      'dec2str(codes) : pour chaque entier, accéder à dict_ascii ; si la clé n\'existe pas, ajouter un caractère de remplacement.',
      'str2qrcode(chaine) : pour chaque caractère, prendre son code ASCII via ord, le convertir en binaire sur 8 bits via format(code, \'08b\'). Bug fréquent : utiliser bin(code) qui supprime les zéros initiaux et renvoie un préfixe \'0b\'.',
    ],
    commonTraps: [
      'bin(n) renvoie une chaîne avec préfixe \'0b\' : et sans zéros initiaux. bin(4) == \'0b100\' (longueur 5, pas 8). Utiliser format(n, \'08b\').',
      'Sens de lecture des bits : dans bin2dec, on parcourt de gauche à droite, du bit de poids fort au bit de poids faible.',
      'Caractère inconnu dans dict_ascii : sans protection, KeyError. Avec un caractère de remplacement, la fonction reste robuste.',
      'Tuple vs liste : l\'énoncé impose souvent un tuple de tuples pour le qrcode (immuable).',
    ],
    examinerQuestions: [
      {
        question:
          'Pourquoi faut-il conserver les zéros initiaux ?',
        expectedAnswer:
          'Parce que chaque caractère ASCII est codé sur exactement 8 bits. Si on écrit le code de A (65) comme 1000001 au lieu de 01000001, la ligne du QR code est trop courte d\'un bit.',
      },
      {
        question:
          'Comment passe-t-on du binaire au décimal ?',
        expectedAnswer:
          'Algorithme de Horner. On parcourt les bits de gauche à droite en faisant valeur = valeur * 2 + bit.',
      },
      {
        question:
          'Pourquoi pas int(chaine_de_bits, 2) ?',
        expectedAnswer:
          'Ça fonctionnerait pour la version chaîne. Mais ici les bits arrivent comme un tuple d\'entiers, donc il faut appliquer Horner directement.',
      },
      {
        question:
          'Que se passe-t-il si le caractère n\'est pas dans dict_ascii ?',
        expectedAnswer:
          'Sans protection, on obtient une KeyError. Il faut utiliser dict_ascii.get(code, \'?\') pour remplacer les caractères inconnus par un caractère de remplacement.',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt: 'Écrire bin2dec et str2qrcode',
        expectedElements: [
          'valeur*2 + bit',
          'format(code, \'08b\')',
          'tuple(int(b) for b in binaire)',
        ],
      },
      {
        type: 'debug',
        prompt:
          'Que renvoie bin(65) vs format(65, \'08b\') ?',
        expectedElements: ['0b1000001 vs 01000001'],
      },
      {
        type: 'oral',
        prompt: 'Expliquer l\'algorithme de Horner',
        expectedElements: [
          'gauche à droite',
          'valeur * 2 + bit',
          'pas besoin de puissances',
        ],
      },
    ],
    revisionProtocol:
      'Réécrire bin2dec et str2qrcode de mémoire. Vérifier que format(n, \'08b\') est bien utilisé.',
  },

  // ── Subject 23 — Transmission DEMETER ────────────────────────────────
  {
    id: 23,
    slug: 'transmission-demeter',
    title: 'Transmission DEMETER — trames binaires, parité, validation',
    shortTitle: 'DEMETER',
    family: 'Trames binaires, parité, robustesse',
    difficulty: 'difficile',
    estimatedTimeMinutes: 35,
    examTimeMinutes: 55,
    files: {
      main: 'transmission.py',
      pdf: 'sujet.pdf',
      python: ['transmission.py', 'analyse.py'],
      data: ['data.txt'],
    },
    concepts: [
      'trames binaires',
      'validation',
      'parité',
      'décodage',
      'robustesse',
    ],
    patterns: [8],
    mnemonic:
      'Toujours valider avant de décoder. Une trame abîmée ne doit pas bloquer le fichier entier.',
    verbalAlgorithm: [
      'decoder_temperature(trame) : extraire la tranche de bits prévue par le format, convertir en entier base 2 via int(bits, 2), appliquer l\'échelle.',
      'decoder_humidite(trame) : même principe, autre tranche.',
      'est_valide(trame) : trois contrôles successifs : (1) longueur attendue, (2) alphabet ⊆ {0,1}, (3) parité de chaque bloc cohérente avec les bits de contrôle.',
      'analyser_fichier(chemin) : parcourir chaque trame, valider, ignorer les invalides en les comptant pour le bilan.',
    ],
    commonTraps: [
      'Décoder avant de valider : int(trame[0:12], 2) sur une trame contenant un caractère non binaire lève ValueError.',
      'Longueur fixe oubliée : une trame trop courte donne des tranches vides, donc int(\'\', 2) = ValueError.',
      'Parité paire vs impaire : l\'énoncé précise la convention. Avec la convention paire, la somme des bits du bloc et du bit de contrôle doit être paire.',
      'Format de trame exact : les valeurs 32 bits, 12 bits température, 8 bits humidité, 4 blocs de parité sont des exemples. Toujours ajuster les constantes.',
    ],
    examinerQuestions: [
      {
        question: 'Pourquoi valider avant de décoder ?',
        expectedAnswer:
          'Parce qu\'une seule trame corrompue peut faire planter le programme entier (int(\'a01\', 2) → ValueError). En validant d\'abord, on isole les trames invalides.',
      },
      {
        question: 'Qu\'est-ce qu\'un bit de parité ?',
        expectedAnswer:
          'Un bit ajouté à un bloc de données pour détecter une erreur de transmission. En parité paire, le bit est choisi pour que le nombre total de 1 soit pair.',
      },
      {
        question:
          'Pourquoi la parité ne détecte que les erreurs en nombre impair ?',
        expectedAnswer:
          'Parce que si deux bits sont inversés, le nombre de 1 change de +2, 0 ou -2 : la parité est préservée.',
      },
      {
        question:
          'Comment rendre une classe de transmission robuste face aux erreurs ?',
        expectedAnswer:
          'Valider systématiquement chaque trame avant de la décoder. Ignorer les trames invalides en les comptant, sans interrompre le traitement du fichier. Séparer la logique de validation et de décodage.',
      },
    ],
    trainingTasks: [
      {
        type: 'code',
        prompt: 'Écrire est_valide et analyser_fichier',
        expectedElements: [
          'len == LONGUEUR_TRAME',
          'all(c in \'01\')',
          'parité',
          'compter invalides',
        ],
      },
      {
        type: 'quiz',
        prompt:
          'Que se passe-t-il si on décode avant de valider ?',
        expectedElements: ['ValueError sur trame corrompue'],
      },
      {
        type: 'oral',
        prompt:
          'Expliquer le principe de robustesse en transmission de données',
        expectedElements: [
          'valider',
          'isoler invalides',
          'continuer le traitement',
        ],
      },
    ],
    revisionProtocol:
      'Réécrire est_valide et analyser_fichier de mémoire.',
  },
];
