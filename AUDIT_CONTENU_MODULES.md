AUDIT DE CONTENU — MODULES DE STAGE PRÉ-RENTRÉE 2026
======================================================================

MISSION : audit en lecture seule. Extraction fidèle du contenu
pédagogique réel des modules de stage, pour revue direction.
Aucune modification effectuée. Aucune interprétation ni jugement
pédagogique : seule l'extraction fidèle du texte source figure
ci-dessous. La validation pédagogique relève de la direction.

Fichier de contenu séance par séance : content/pre-rentree-2026/modules.json
Fichier de conformité programmes officiels : content/pre-rentree-2026/official-programme-matrix.fr.json
Fichier des décisions direction (statuts DRAFT) : content/pre-rentree-2026/publication-decisions.owner.json

Méthode : chaque marqueur recherché ("nouveau programme"/"BO 2026", "épreuve anticipée",
"sinus/cosinus", etc.) est recherché champ par champ dans le texte source exact (titres, objectifs,
notions clés, méthodes, livrables, résumés de conformité). Chaque occurrence cite le chemin du
champ et reproduit le texte intégral de ce champ, sans troncature ni paraphrase.

=== MATHS ENTRÉE EN SECONDE ===
Fichier source (contenu séances) : content/pre-rentree-2026/modules.json → modules[].id == "seconde-mathematiques"
Fichier source (conformité programme officiel) : content/pre-rentree-2026/official-programme-matrix.fr.json → rows[].moduleId == "seconde-mathematiques"

Champ "id"             : seconde-mathematiques
Champ "level"          : SECONDE
Champ "subjectId"      : MATHEMATIQUES
Champ "subject"        : Mathématiques
Champ "title"          : Mathématiques — Entrée en Seconde
Champ "subtitle"       : PROPOSITION — priorités, prérequis et méthodes sélectionnés pour préparer la rentrée de Seconde
Champ "objective"      : Sélectionner des priorités, prérequis et méthodes pour préparer la rentrée de Seconde selon le programme de mathématiques applicable en 2026-2027, sans prétendre couvrir le programme annuel.
Champ "prerequisites"  : Les acquis de Troisième et du collège ; un diagnostic en début de module précise les priorités.
Champ "differentiation": Exercices à paliers et aides graduées selon la maîtrise du calcul et de la rédaction.
Champ "quickAssessment": Exercice court de calcul et de raisonnement corrigé à la fin de chaque séance.
Champ "publicationStatus" : PROPOSAL_PENDING_PEDAGOGICAL_VALIDATION

Contenu intégral des 5 séances (texte exact, source = modules.json) :

  Séance 1 — Nombres réels, valeur absolue et calcul littéral
    Objectif   : Consolider le calcul littéral et interpréter la valeur absolue comme une distance
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Développement et réduction d'expressions
      - Factorisation par facteur commun et identités remarquables
      - Fractions, proportions et proportionnalité comme prérequis de Troisième
      - Intervalles de réels et représentation sur une droite
      - Valeur absolue, distance et inéquations de la forme |x − a| ≤ r
    Méthode    : Exercices guidés progressifs avec correction commentée
    Livrable   : Fiche méthode calcul littéral avec exemples types résolus

  Séance 2 — Fonctions : représentations, variations et modélisation
    Objectif   : Lire, représenter et utiliser des fonctions pour modéliser des situations simples
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Image, antécédent, lecture graphique
      - Tableau de variations et sens de variation
      - Extremums et intervalles
      - Fonctions de référence : valeur absolue, carré, inverse et affine
    Méthode    : Alternance lecture graphique interactive et exercices d'application
    Livrable   : Carte mentale du vocabulaire des fonctions avec exemples graphiques

  Séance 3 — Équations, inéquations et résolution de problèmes
    Objectif   : Résoudre des équations et inéquations à partir d'une forme adaptée
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Équations du premier degré et mise en équation
      - Inéquations et représentation sur un axe
      - Signe d'un produit ou d'un quotient
      - Problèmes concrets modélisés par une équation ou une inéquation
    Méthode    : Méthode pas-à-pas avec problèmes contextualisés
    Livrable   : Fiche réflexe résolution d'équations et d'inéquations

  Séance 4 — Géométrie repérée et vecteurs
    Objectif   : Se repérer dans le plan, calculer distances et coordonnées de milieux
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Repère orthonormé et coordonnées
      - Distance entre deux points et milieu d'un segment
      - Introduction aux vecteurs et coordonnées de vecteurs
      - Colinéarité et alignement
    Méthode    : Exercices guidés avec représentations graphiques systématiques
    Livrable   : Formulaire géométrie repérée avec schémas annotés

  Séance 5 — Statistiques et probabilités
    Objectif   : Lire des données continues ou croisées et mobiliser une probabilité conditionnelle simple
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Série continue regroupée en classes : histogramme et fréquences cumulées
      - Deux variables qualitatives : tableau croisé et fréquences conditionnelles
      - Probabilité conditionnelle et arbre pondéré
      - Interprétation critique d'indicateurs et rédaction d'une conclusion
    Méthode    : Étude d'un jeu de données puis problèmes de probabilités avec arbre
    Livrable   : Fiche méthode statistiques continues, tableaux croisés et probabilités conditionnelles

Fiche de conformité programme officiel (official-programme-matrix.fr.json) :
  officialProgrammeId  : BO2026-LYCEE-MATHS-SECONDE
  Titre programme       : Programme de mathématiques de Seconde applicable à partir de 2026-2027
  URL                   : https://www.education.gouv.fr/sites/default/files/document/boenjs_14_ok.pdf-515480.pdf
  Éditeur               : Ministère de l'Éducation nationale
  Note d'application    : Application en Seconde à la rentrée 2026.
  applicationSchoolYear : 2026-2027
  alignmentSummary (texte exact) : PROPOSITION : priorités de calcul algébrique, fonctions, géométrie, statistiques continues et croisées, puis probabilités conditionnelles selon le programme 2026.
  publicOfferEligible   : False

Mention "nouveau programme" ou "BO 2026" :
  PRÉSENTE — 2 occurrence(s), texte exact du champ concerné :
    - [official-programme-matrix.fr.json → rows[moduleId=seconde-mathematiques].alignmentSummary]
      « PROPOSITION : priorités de calcul algébrique, fonctions, géométrie, statistiques continues et croisées, puis probabilités conditionnelles selon le programme 2026. »
    - [official-programme-matrix.fr.json → rows[moduleId=seconde-mathematiques].officialProgrammeId]
      « BO2026-LYCEE-MATHS-SECONDE »

Mention "épreuve anticipée" :
  ABSENTE

Mention "sinus/cosinus" :
  ABSENTE

----------------------------------------------------------------------

=== MATHS 1RE ===
Fichier source (contenu séances) : content/pre-rentree-2026/modules.json → modules[].id == "premiere-mathematiques"
Fichier source (conformité programme officiel) : content/pre-rentree-2026/official-programme-matrix.fr.json → rows[].moduleId == "premiere-mathematiques"

Champ "id"             : premiere-mathematiques
Champ "level"          : PREMIERE
Champ "subjectId"      : MATHEMATIQUES
Champ "subject"        : Mathématiques
Champ "title"          : Mathématiques — Entrée en Première
Champ "subtitle"       : PROPOSITION — priorités, prérequis et méthodes sélectionnés pour préparer la rentrée de Première
Champ "objective"      : Sélectionner des priorités, prérequis et méthodes pour préparer la rentrée et l'épreuve terminale anticipée de mathématiques passée en fin de Première, sans promesse de résultat ni couverture du programme annuel.
Champ "prerequisites"  : Les acquis de Seconde en fonctions, calcul littéral et probabilités.
Champ "differentiation": Activités et niveau d'exigence adaptés au profil Maths EDS ou hors EDS après validation pédagogique.
Champ "quickAssessment": Exercice type ciblé, corrigé avec une grille de méthode et de rédaction.
Champ "publicationStatus" : PROPOSAL_PENDING_PEDAGOGICAL_VALIDATION

Contenu intégral des 5 séances (texte exact, source = modules.json) :

  Séance 1 — Second degré et discriminant
    Objectif   : Choisir une forme adaptée d'un polynôme du second degré et résoudre une équation
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Formes développée, factorisée et canonique
      - Racines, somme et produit des racines
      - Discriminant, factorisation éventuelle et résolution
      - Signe et problème d'optimisation
    Méthode    : Choix de forme puis résolution de problèmes à difficulté croissante
    Livrable   : Fiche méthode second degré et discriminant

  Séance 2 — Suites et évolution exponentielle
    Objectif   : Distinguer modèles discrets et continus d'évolution
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Suites arithmétiques et géométriques
      - Définition explicite et par récurrence
      - Fonction exponentielle : propriétés, signe et variations
      - Modélisation d'une croissance ou décroissance
    Méthode    : Comparaison de modèles à partir de tableaux, graphes et formules
    Livrable   : Fiche repère suites et fonction exponentielle

  Séance 3 — Dérivation, tangente et variations
    Objectif   : Interpréter un nombre dérivé et exploiter le signe d'une dérivée
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Taux de variation, nombre dérivé et tangente
      - Opérations sur les dérivées (somme, produit, quotient)
      - Signe de la dérivée et variations
      - Tableau de variations complet
    Méthode    : Exercices guidés progressifs et pratique autonome
    Livrable   : Tableau récapitulatif des dérivées et méthode d'étude de fonction

  Séance 4 — Probabilités conditionnelles
    Objectif   : Calculer des probabilités conditionnelles et utiliser un arbre pondéré
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Probabilité conditionnelle : définition et notation
      - Arbres de probabilités pondérés
      - Formule des probabilités totales
      - Indépendance de deux événements
    Méthode    : Résolution de problèmes concrets avec modélisation par arbre
    Livrable   : Fiche méthode probabilités conditionnelles avec schémas types

  Séance 5 — Automatismes et méthode de l'épreuve anticipée
    Objectif   : Se familiariser avec la structure et les méthodes utiles à l'épreuve terminale anticipée de mathématiques de fin de Première
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Automatismes sans calculatrice
      - Lecture d'énoncé et choix d'une stratégie
      - Rédaction d'un raisonnement et contrôle des résultats
      - Exercices indépendants sur les priorités du module
    Méthode    : Entraînement méthodologique sur des formats officiels, sans promesse de résultat
    Livrable   : Grille de méthode pour l'épreuve anticipée

Fiche de conformité programme officiel (official-programme-matrix.fr.json) :
  officialProgrammeId  : BO2026-LYCEE-MATHS-PREMIERE
  Titre programme       : Programme de mathématiques de Première applicable à partir de 2026-2027
  URL                   : https://www.education.gouv.fr/sites/default/files/document/boenjs_14_ok.pdf-515480.pdf
  Éditeur               : Ministère de l'Éducation nationale
  Note d'application    : Application en Première à la rentrée 2026.
  applicationSchoolYear : 2026-2027
  alignmentSummary (texte exact) : PROPOSITION : second degré et discriminant, suites, exponentielle, dérivation, probabilités conditionnelles et méthodes de l'épreuve anticipée ; fonctions sinus/cosinus non annoncées.
  publicOfferEligible   : False

Mention "nouveau programme" ou "BO 2026" :
  PRÉSENTE — 1 occurrence(s), texte exact du champ concerné :
    - [official-programme-matrix.fr.json → rows[moduleId=premiere-mathematiques].officialProgrammeId]
      « BO2026-LYCEE-MATHS-PREMIERE »

Mention "épreuve anticipée" :
  PRÉSENTE — 3 occurrence(s), texte exact du champ concerné :
    - [modules.json → premiere-mathematiques.sessions[5].title]
      « Automatismes et méthode de l'épreuve anticipée »
    - [modules.json → premiere-mathematiques.sessions[5].deliverable]
      « Grille de méthode pour l'épreuve anticipée »
    - [official-programme-matrix.fr.json → rows[moduleId=premiere-mathematiques].alignmentSummary]
      « PROPOSITION : second degré et discriminant, suites, exponentielle, dérivation, probabilités conditionnelles et méthodes de l'épreuve anticipée ; fonctions sinus/cosinus non annoncées. »

Mention "sinus/cosinus" :
  PRÉSENTE — 1 occurrence(s), texte exact du champ concerné :
    - [official-programme-matrix.fr.json → rows[moduleId=premiere-mathematiques].alignmentSummary]
      « PROPOSITION : second degré et discriminant, suites, exponentielle, dérivation, probabilités conditionnelles et méthodes de l'épreuve anticipée ; fonctions sinus/cosinus non annoncées. »

[Contrôle spécifique Maths 1re] Fonctions sinus/cosinus, ⚠ déplacées en Terminale dans le nouveau
programme :
  ABSENTE du contenu des 5 séances (modules.json) — confirmé par le marqueur "sinus/cosinus" ci-dessus
  (aucune occurrence dans title/objective/topics/method/deliverable des 5 séances).
  Non-présence explicitement affirmée dans la fiche de conformité officielle
  (content/pre-rentree-2026/official-programme-matrix.fr.json → alignmentSummary) : « PROPOSITION : second degré et discriminant, suites, exponentielle, dérivation, probabilités conditionnelles et méthodes de l'épreuve anticipée ; fonctions sinus/cosinus non annoncées. »

----------------------------------------------------------------------

=== MATHS TLE ===
Fichier source (contenu séances) : content/pre-rentree-2026/modules.json → modules[].id == "terminale-mathematiques"
Fichier source (conformité programme officiel) : content/pre-rentree-2026/official-programme-matrix.fr.json → rows[].moduleId == "terminale-mathematiques"

Champ "id"             : terminale-mathematiques
Champ "level"          : TERMINALE
Champ "subjectId"      : MATHEMATIQUES
Champ "subject"        : Mathématiques
Champ "title"          : Mathématiques — Entrée en Terminale
Champ "subtitle"       : Entrée en Terminale — partir des acquis de Première et préparer les premières notions selon le parcours déclaré : EDS Mathématiques et options associées
Champ "prerequisites"  : Les acquis de Première en dérivation, suites, probabilités et géométrie.
Champ "differentiation": Exercices différenciés selon l’EDS Mathématiques déclaré ; Maths expertes et Maths complémentaires sont des options, jamais des EDS supplémentaires.
Champ "quickAssessment": Exercice de synthèse court analysé selon la démarche, le calcul et la rédaction.
Champ "publicationStatus" : (absent du fichier source — aucune valeur)

Contenu intégral des 5 séances (texte exact, source = modules.json) :

  Séance 1 — Limites et continuité
    Objectif   : Calculer des limites et comprendre la notion de continuité
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Limites en l'infini et limites finies
      - Formes indéterminées et levée d'indétermination
      - Asymptotes horizontales et verticales
      - Continuité et théorème des valeurs intermédiaires
    Méthode    : Cours structuré puis exercices d'application avec corrigés détaillés
    Livrable   : Fiche méthode limites avec tableau des formes indéterminées

  Séance 2 — Dérivation avancée et fonctions composées
    Objectif   : Dériver des fonctions composées et mener des études complètes
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Dérivée de fonctions composées
      - Fonction exponentielle et ses propriétés
      - Fonction logarithme népérien
      - Étude complète de fonction avec exponentielle ou logarithme
    Méthode    : Exercices guidés avec complexité progressive
    Livrable   : Tableau des dérivées avancées et étude de fonction complète rédigée

  Séance 3 — Suites récurrentes et convergence
    Objectif   : Étudier le comportement à l'infini des suites récurrentes
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Suites récurrentes du type u(n+1) = f(u(n))
      - Sens de variation d'une suite récurrente
      - Convergence et limite d'une suite
      - Raisonnement par récurrence
    Méthode    : Méthode graphique puis formalisation avec exercices types Bac
    Livrable   : Méthode complète d'étude d'une suite récurrente

  Séance 4 — Probabilités : loi binomiale et espérance
    Objectif   : Modéliser une situation par une loi binomiale et calculer ses paramètres
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Épreuve de Bernoulli et schéma de Bernoulli
      - Loi binomiale : paramètres et calculs
      - Espérance, variance, écart-type
      - Applications et modélisation
    Méthode    : Problèmes contextualisés avec utilisation de la calculatrice
    Livrable   : Fiche synthèse loi binomiale avec exercices types résolus

  Séance 5 — Géométrie dans l'espace
    Objectif   : Se repérer dans l'espace et résoudre des problèmes de géométrie vectorielle
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Repère orthonormé de l'espace
      - Vecteurs de l'espace et coordonnées
      - Équation cartésienne d'un plan
      - Droites et plans : positions relatives
    Méthode    : Visualisation 3D puis exercices de calcul avec schémas
    Livrable   : Formulaire géométrie dans l'espace avec méthodes de résolution

Fiche de conformité programme officiel (official-programme-matrix.fr.json) :
  officialProgrammeId  : BO2019-LYCEE-MATHS-TERMINALE
  Titre programme       : Programme de mathématiques de Terminale applicable en 2026-2027
  URL                   : https://www.education.gouv.fr/au-bo-special-du-22-janvier-2019-programmes-d-enseignement-du-lycee-general-et-technologique-455475
  Éditeur               : Ministère de l'Éducation nationale
  Note d'application    : Le programme publié en 2026 ne s'applique en Terminale qu'à partir de 2027-2028.
  applicationSchoolYear : 2026-2027
  alignmentSummary (texte exact) : Réactiver dérivation, suites, probabilités, géométrie et raisonnement nécessaires au programme de Terminale encore applicable.
  publicOfferEligible   : True

Mention "nouveau programme" ou "BO 2026" :
  ABSENTE

Mention "épreuve anticipée" :
  ABSENTE

Mention "sinus/cosinus" :
  ABSENTE

----------------------------------------------------------------------

=== MATHS EXPERTES TLE ===
Fichier source (contenu séances) : content/pre-rentree-2026/modules.json → modules[].id == "terminale-maths-expertes"
Fichier source (conformité programme officiel) : content/pre-rentree-2026/official-programme-matrix.fr.json → rows[].moduleId == "terminale-maths-expertes"

Champ "id"             : terminale-maths-expertes
Champ "level"          : TERMINALE
Champ "subjectId"      : MATHS_EXPERTES
Champ "subject"        : Mathématiques expertes
Champ "title"          : Mathématiques expertes — Entrée en Terminale
Champ "subtitle"       : PROPOSITION — priorités, prérequis et méthodes sélectionnés pour préparer la rentrée en spécialité Maths expertes
Champ "prerequisites"  : Les acquis de Première en spécialité Mathématiques : suites, fonctions, probabilités et raisonnement.
Champ "differentiation": Exercices différenciés selon l'aisance calculatoire et l'aisance avec le raisonnement abstrait.
Champ "quickAssessment": Exercice de synthèse court analysé selon la démarche, le calcul et la rédaction.
Champ "publicationStatus" : PROPOSAL_PENDING_PEDAGOGICAL_VALIDATION

Contenu intégral des 5 séances (texte exact, source = modules.json) :

  Séance 1 — Arithmétique : divisibilité et nombres premiers
    Objectif   : Manipuler divisibilité, division euclidienne et nombres premiers
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Divisibilité dans l'ensemble des entiers relatifs
      - Division euclidienne et algorithme d'Euclide
      - Nombres premiers et décomposition en facteurs premiers
      - PGCD et théorème de Bézout
    Méthode    : Cours structuré puis exercices d'application avec corrigés détaillés
    Livrable   : Fiche méthode arithmétique avec exemples résolus

  Séance 2 — Congruences et applications
    Objectif   : Utiliser les congruences pour résoudre des problèmes arithmétiques
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Définition et propriétés des congruences
      - Équations de congruence
      - Petit théorème de Fermat
      - Applications aux critères de divisibilité
    Méthode    : Exercices guidés avec complexité progressive
    Livrable   : Tableau récapitulatif des propriétés des congruences

  Séance 3 — Nombres complexes approfondis
    Objectif   : Utiliser la forme trigonométrique et les applications géométriques des complexes
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Forme trigonométrique et exponentielle
      - Racines n-ièmes d'un nombre complexe
      - Applications à la géométrie plane
      - Transformations du plan complexe
    Méthode    : Démonstrations guidées puis exercices types Bac
    Livrable   : Formulaire complexes approfondis avec méthodes de résolution

  Séance 4 — Matrices et systèmes linéaires
    Objectif   : Manipuler les matrices et résoudre des systèmes par le calcul matriciel
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Opérations sur les matrices
      - Matrice inverse et déterminant
      - Résolution de systèmes linéaires
      - Suites définies par une relation matricielle
    Méthode    : Exercices progressifs avec vérification par le calcul
    Livrable   : Fiche méthode calcul matriciel avec exemples résolus

  Séance 5 — Graphes : notions et parcours
    Objectif   : Modéliser une situation par un graphe et déterminer un plus court chemin
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Vocabulaire des graphes et matrice d'adjacence
      - Chaînes, cycles et connexité
      - Algorithme du plus court chemin
      - Synthèse et bilan de la spécialité
    Méthode    : Modélisation guidée puis problèmes contextualisés
    Livrable   : Méthode complète de modélisation par un graphe

Fiche de conformité programme officiel (official-programme-matrix.fr.json) :
  officialProgrammeId  : BO2019-LYCEE-MATHEXP-TERMINALE
  Titre programme       : Programme de mathématiques expertes de Terminale générale
  URL                   : https://eduscol.education.fr/document/22201/download
  Éditeur               : Ministère de l'Éducation nationale
  Note d'application    : Programme en vigueur pour l'année scolaire 2026-2027.
  applicationSchoolYear : 2026-2027
  alignmentSummary (texte exact) : PROPOSITION : arithmétique, congruences, nombres complexes approfondis, matrices et graphes, selon le programme de la spécialité Maths expertes.
  publicOfferEligible   : False

Mention "nouveau programme" ou "BO 2026" :
  ABSENTE

Mention "épreuve anticipée" :
  ABSENTE

Mention "sinus/cosinus" :
  ABSENTE

----------------------------------------------------------------------

=== MATHS 3E ===
Fichier source (contenu séances) : content/pre-rentree-2026/modules.json → modules[].id == "troisieme-mathematiques"
Fichier source (conformité programme officiel) : content/pre-rentree-2026/official-programme-matrix.fr.json → rows[].moduleId == "troisieme-mathematiques"

Champ "id"             : troisieme-mathematiques
Champ "level"          : TROISIEME
Champ "subjectId"      : MATHEMATIQUES
Champ "subject"        : Mathématiques
Champ "title"          : Mathématiques — Entrée en 3e
Champ "subtitle"       : Nexus Fondations — consolider les acquis de 4e et préparer progressivement les attendus du DNB
Champ "prerequisites"  : Les acquis de 4e en calcul, géométrie, fonctions et traitement de données ; le test flash précise les priorités.
Champ "differentiation": Exercices organisés en trois paliers, aides graduées et défis de consolidation selon le test flash.
Champ "quickAssessment": Une activité de cinq à dix minutes vérifie le domaine travaillé à la fin de chaque séance.
Champ "publicationStatus" : (absent du fichier source — aucune valeur)

Contenu intégral des 5 séances (texte exact, source = modules.json) :

  Séance 1 — Nombres, fractions, puissances et calcul
    Objectif   : Sécuriser les priorités opératoires et les calculs avec fractions, nombres relatifs et puissances
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Priorités opératoires
      - Fractions et nombres relatifs
      - Puissances de 10
      - Calcul mental et estimation
    Méthode    : Test flash puis exercices à paliers avec verbalisation des stratégies
    Livrable   : Fiche réflexe de calcul avec série corrigée

  Séance 2 — Calcul littéral, équations et problèmes
    Objectif   : Transformer une expression et résoudre une équation simple dans un problème
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Réduction et développement
      - Distributivité
      - Équations du premier degré
      - Mise en équation
    Méthode    : Exemples guidés, entraînement progressif puis problème contextualisé
    Livrable   : Carte méthode calcul littéral et problème entièrement corrigé

  Séance 3 — Géométrie et théorèmes
    Objectif   : Choisir et appliquer Pythagore, Thalès et leurs réciproques dans une rédaction rigoureuse
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Pythagore
      - Thalès
      - Réciproques
      - Rédaction d'une démonstration
    Méthode    : Tri de situations, schémas codés et démonstrations à compléter puis autonomes
    Livrable   : Fiche de choix des théorèmes avec deux démonstrations corrigées

  Séance 4 — Fonctions, statistiques et probabilités
    Objectif   : Lire et interpréter des données, une courbe et une situation aléatoire simple
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Image et antécédent
      - Lecture graphique
      - Moyenne et médiane
      - Probabilité d'un événement
    Méthode    : Lecture de représentations puis exercices courts de modélisation
    Livrable   : Fiche de lecture de données et exercice de synthèse corrigé

  Séance 5 — Méthodologie DNB et sujet d'entraînement
    Objectif   : Organiser son temps, justifier ses réponses et traiter un sujet transversal
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Lecture du sujet
      - Gestion du temps
      - Rédaction et unités
      - Vérification des résultats
    Méthode    : Sujet d'entraînement chronométré puis correction critériée
    Livrable   : Sujet DNB corrigé et grille personnelle de vigilance

Fiche de conformité programme officiel (official-programme-matrix.fr.json) :
  officialProgrammeId  : BO2020-CYCLE4-MATHS
  Titre programme       : Programme de mathématiques du cycle 4 applicable à la 3e en 2026-2027
  URL                   : https://www.education.gouv.fr/bo/20/Hebdo31/MENE2018714A.htm
  Éditeur               : Ministère de l'Éducation nationale
  Note d'application    : Le programme publié le 5 mars 2026 entre progressivement en vigueur et ne s'applique en 3e qu'en 2028-2029.
  applicationSchoolYear : 2026-2027
  alignmentSummary (texte exact) : Consolider nombres, calcul littéral, fonctions, géométrie et résolution de problèmes attendus au cycle 4 avant l'entrée en 3e.
  publicOfferEligible   : True

Mention "nouveau programme" ou "BO 2026" :
  ABSENTE

Mention "épreuve anticipée" :
  ABSENTE

Mention "sinus/cosinus" :
  ABSENTE

[Contrôle spécifique 3e] Mention "programme 2026" ou "nouveau programme" (⚠ la 3e reste sur l'ancien
programme cycle 4 — toute occurrence ici serait à signaler) :
  ABSENTE — cohérent avec le fait que la 3e reste déclarée sur l'ancien programme cycle 4
  (officialProgrammeId = BO2020-CYCLE4-MATHS, applicationNote exacte = « Le programme publié le 5 mars 2026 entre progressivement en vigueur et ne s'applique en 3e qu'en 2028-2029. »).

----------------------------------------------------------------------

=== FRANÇAIS 3E ===
Fichier source (contenu séances) : content/pre-rentree-2026/modules.json → modules[].id == "troisieme-francais"
Fichier source (conformité programme officiel) : content/pre-rentree-2026/official-programme-matrix.fr.json → rows[].moduleId == "troisieme-francais"

Champ "id"             : troisieme-francais
Champ "level"          : TROISIEME
Champ "subjectId"      : FRANCAIS
Champ "subject"        : Français
Champ "title"          : Français — Entrée en 3e
Champ "subtitle"       : Nexus Fondations — consolider la langue, la lecture et l'écriture pour préparer la classe de 3e et le DNB
Champ "prerequisites"  : Les acquis de 4e en compréhension, grammaire, orthographe et rédaction ; le test flash précise les besoins.
Champ "differentiation": Textes, aides de rédaction et exercices de langue proposés en trois paliers de difficulté.
Champ "quickAssessment": Une consigne courte de lecture, langue ou écriture vérifie l'objectif de chaque séance.
Champ "publicationStatus" : (absent du fichier source — aucune valeur)

Contenu intégral des 5 séances (texte exact, source = modules.json) :

  Séance 1 — Compréhension et interprétation
    Objectif   : Prélever des indices, formuler une interprétation et la justifier par le texte
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Repérage des informations
      - Implicite
      - Citation et justification
      - Réponse rédigée
    Méthode    : Lecture active, questions graduées et mise en commun des preuves textuelles
    Livrable   : Grille de lecture active et réponses corrigées

  Séance 2 — Grammaire, accords et réécriture
    Objectif   : Analyser la phrase et appliquer les accords dans une transformation de texte
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Classes et fonctions
      - Accords dans le groupe nominal
      - Accord sujet-verbe
      - Réécriture
    Méthode    : Manipulations de phrases puis réécriture commentée
    Livrable   : Fiche d'accords et exercice de réécriture corrigé

  Séance 3 — Dictée et maîtrise de la langue
    Objectif   : Mobiliser une méthode de relecture pour corriger les erreurs fréquentes
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Homophones grammaticaux
      - Terminaisons verbales
      - Accords
      - Ponctuation
    Méthode    : Dictée négociée, classement des erreurs et seconde version corrigée
    Livrable   : Grille personnelle de relecture et dictée corrigée

  Séance 4 — Rédaction et organisation des idées
    Objectif   : Construire un texte cohérent avec un plan, des paragraphes et des exemples précis
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Analyse du sujet
      - Recherche d'idées
      - Plan et paragraphes
      - Enrichissement de l'expression
    Méthode    : Plan guidé, rédaction par étapes puis révision avec grille
    Livrable   : Production rédigée annotée et grille de relecture

  Séance 5 — Méthodologie DNB et sujet d'entraînement
    Objectif   : Coordonner compréhension, langue et rédaction dans un entraînement complet
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Gestion du temps
      - Barème
      - Justification
      - Relecture finale
    Méthode    : Sujet d'entraînement chronométré puis correction méthodique
    Livrable   : Sujet DNB corrigé et trois priorités de rentrée

Fiche de conformité programme officiel (official-programme-matrix.fr.json) :
  officialProgrammeId  : BO2020-CYCLE4-FRANCAIS
  Titre programme       : Programme de français du cycle 4 applicable à la 3e en 2026-2027
  URL                   : https://www.education.gouv.fr/bo/20/Hebdo31/MENE2018714A.htm
  Éditeur               : Ministère de l'Éducation nationale
  Note d'application    : Le programme publié le 5 mars 2026 entre progressivement en vigueur et ne s'applique en 3e qu'en 2028-2029.
  applicationSchoolYear : 2026-2027
  alignmentSummary (texte exact) : Renforcer compréhension, interprétation, grammaire, orthographe et écriture argumentée attendues au cycle 4.
  publicOfferEligible   : True

Mention "nouveau programme" ou "BO 2026" :
  ABSENTE

Mention "épreuve anticipée" :
  ABSENTE

Mention "sinus/cosinus" :
  ABSENTE

[Contrôle spécifique 3e] Mention "programme 2026" ou "nouveau programme" (⚠ la 3e reste sur l'ancien
programme cycle 4 — toute occurrence ici serait à signaler) :
  ABSENTE — cohérent avec le fait que la 3e reste déclarée sur l'ancien programme cycle 4
  (officialProgrammeId = BO2020-CYCLE4-FRANCAIS, applicationNote exacte = « Le programme publié le 5 mars 2026 entre progressivement en vigueur et ne s'applique en 3e qu'en 2028-2029. »).

----------------------------------------------------------------------

=== FRANÇAIS 2DE ===
Fichier source (contenu séances) : content/pre-rentree-2026/modules.json → modules[].id == "seconde-francais"
Fichier source (conformité programme officiel) : content/pre-rentree-2026/official-programme-matrix.fr.json → rows[].moduleId == "seconde-francais"

Champ "id"             : seconde-francais
Champ "level"          : SECONDE
Champ "subjectId"      : FRANCAIS
Champ "subject"        : Français
Champ "title"          : Français — Entrée en Seconde
Champ "subtitle"       : Entrée en Seconde — consolider compréhension, expression, grammaire et argumentation pour aborder les méthodes du lycée
Champ "prerequisites"  : Les compétences de lecture et d'écriture attendues en fin de Troisième et de collège.
Champ "differentiation": Textes, consignes et attendus de rédaction ajustés au niveau de maîtrise observé.
Champ "quickAssessment": Production brève ou question d'analyse relue avec une grille de critères.
Champ "publicationStatus" : (absent du fichier source — aucune valeur)

Contenu intégral des 5 séances (texte exact, source = modules.json) :

  Séance 1 — Expression écrite structurée : le paragraphe argumenté
    Objectif   : Rédiger un paragraphe argumenté clair avec exemples pertinents
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Structure argument-exemple-analyse
      - Connecteurs logiques et transitions
      - Registres de langue et précision du vocabulaire
      - Exercices de rédaction chronométrés
    Méthode    : Modélisation puis pratique guidée avec feedback immédiat
    Livrable   : Fiche méthode du paragraphe argumenté avec modèles

  Séance 2 — Compréhension et analyse de texte littéraire
    Objectif   : Identifier les procédés d'écriture et formuler une interprétation
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Repérage des champs lexicaux et figures de style
      - Identification du registre et du ton
      - Analyse de la structure narrative ou argumentative
      - Formulation d'hypothèses interprétatives
    Méthode    : Lecture active guidée sur extraits variés (roman, poésie, théâtre)
    Livrable   : Boîte à outils des procédés littéraires avec exemples

  Séance 3 — Argumentation : convaincre et persuader
    Objectif   : Distinguer les stratégies argumentatives et les mobiliser à l'écrit
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Thèse, arguments, exemples
      - Concession et réfutation
      - Argumentation directe vs indirecte
      - Rédaction d'un développement argumenté
    Méthode    : Analyse de textes argumentatifs puis production écrite encadrée
    Livrable   : Plan-type d'un développement argumenté réutilisable

  Séance 4 — Grammaire au service de l'expression
    Objectif   : Maîtriser les outils grammaticaux essentiels pour le lycée
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Proposition subordonnée et types de phrases complexes
      - Valeurs des temps verbaux
      - Accords complexes (participe passé, relatif)
      - Ponctuation expressive et stylistique
    Méthode    : Exercices ciblés puis réinvestissement en production écrite
    Livrable   : Mémo grammaire lycée avec erreurs fréquentes à éviter

  Séance 5 — Initiation au commentaire de texte
    Objectif   : Comprendre la méthode du commentaire composé et en rédiger une partie
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Différence entre paraphrase et analyse
      - Construction d'un axe de lecture
      - Rédaction d'un sous-partie de commentaire
      - Introduction et conclusion : principes
    Méthode    : Travail progressif sur un extrait : du brouillon à la rédaction
    Livrable   : Modèle de brouillon commentaire avec étapes clés

Fiche de conformité programme officiel (official-programme-matrix.fr.json) :
  officialProgrammeId  : BO2019-LYCEE-FRANCAIS-SECONDE
  Titre programme       : Programme de français de Seconde
  URL                   : https://eduscol.education.gouv.fr/5793/programmes-et-ressources-en-francais-voie-gt?menu_id=2117
  Éditeur               : Ministère de l'Éducation nationale
  Note d'application    : Programme en vigueur pour l'année scolaire 2026-2027.
  applicationSchoolYear : 2026-2027
  alignmentSummary (texte exact) : Préparer lecture analytique, culture littéraire, expression écrite et maîtrise de la langue au lycée.
  publicOfferEligible   : True

Mention "nouveau programme" ou "BO 2026" :
  ABSENTE

Mention "épreuve anticipée" :
  ABSENTE

Mention "sinus/cosinus" :
  ABSENTE

----------------------------------------------------------------------

=== FRANÇAIS 1RE ===
Fichier source (contenu séances) : content/pre-rentree-2026/modules.json → modules[].id == "premiere-francais-eaf"
Fichier source (conformité programme officiel) : content/pre-rentree-2026/official-programme-matrix.fr.json → rows[].moduleId == "premiere-francais-eaf"

Champ "id"             : premiere-francais-eaf
Champ "level"          : PREMIERE
Champ "subjectId"      : FRANCAIS
Champ "subject"        : Français (EAF)
Champ "title"          : Français — Préparation aux EAF
Champ "subtitle"       : Entrée en Première — découvrir les attendus des futures Épreuves Anticipées de Français, à l’écrit et à l’oral
Champ "prerequisites"  : Une lecture régulière et les bases de l'analyse de texte acquises en Seconde.
Champ "differentiation": Exercice correspondant à la voie générale ou technologique, confirmé après validation pédagogique du groupe.
Champ "quickAssessment": Paragraphe rédigé ou passage oral bref évalué selon les attendus EAF.
Champ "publicationStatus" : (absent du fichier source — aucune valeur)

Contenu intégral des 5 séances (texte exact, source = modules.json) :

  Séance 1 — Le commentaire composé : méthode complète
    Objectif   : Maîtriser la méthode du commentaire de la lecture à la rédaction
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Lecture analytique et repérage des procédés
      - Construction d'un plan en deux ou trois axes
      - Rédaction de l'introduction et de la conclusion
      - Intégration des citations et analyse stylistique
    Méthode    : Travail méthodique sur un texte complet avec brouillon guidé
    Livrable   : Commentaire composé rédigé intégralement avec auto-évaluation

  Séance 2 — Dissertation ou contraction de texte, selon la voie
    Objectif   : Comprendre les attendus de l'exercice écrit correspondant à la voie déclarée
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Analyse du sujet et problématisation
      - Plan dialectique et plan thématique
      - Contraction de texte : méthode et ratio
      - Essai littéraire : argumentation et références
    Méthode    : Exercices ciblés sur la dissertation en voie générale ou la contraction et l'essai en voie technologique
    Livrable   : Plan détaillé de dissertation ou contraction rédigée, selon la voie

  Séance 3 — Explication linéaire : technique et pratique
    Objectif   : Réaliser une explication linéaire structurée en vue de l'oral
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Structure de l'explication linéaire (mouvements du texte)
      - Analyse des procédés au fil du texte
      - Formulation des micro-interprétations
      - Transition entre les mouvements
    Méthode    : Pratique sur extraits des œuvres au programme avec feedback
    Livrable   : Explication linéaire complète rédigée et chronométrée

  Séance 4 — Grammaire stylistique et question de grammaire
    Objectif   : Maîtriser la question de grammaire de l'oral des EAF
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Interrogation et négation
      - Subordonnées circonstancielles et relatives
      - Analyse de phrase complexe
      - Valeurs des modes et des temps
    Méthode    : Exercices d'analyse grammaticale sur extraits littéraires
    Livrable   : Fiche synthèse des points de grammaire au programme de l'oral

  Séance 5 — Oral des EAF : explication et entretien
    Objectif   : Se préparer à l'épreuve orale complète (explication + entretien)
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Présentation orale de l'explication linéaire (12 min)
      - Gestion du temps et de la voix
      - Entretien : défendre son parcours et son œuvre choisie
      - Simulation d'oral avec questions du jury
    Méthode    : Simulation d'oral en conditions réelles avec feedback détaillé
    Livrable   : Grille de progression orale personnalisée et conseils ciblés

Fiche de conformité programme officiel (official-programme-matrix.fr.json) :
  officialProgrammeId  : BO2019-LYCEE-FRANCAIS-PREMIERE
  Titre programme       : Programme de français de Première et œuvres 2026-2027
  URL                   : https://www.education.gouv.fr/bo/2025/Hebdo30/MENE2518792N
  Éditeur               : Ministère de l'Éducation nationale
  Note d'application    : Le cadrage des œuvres 2026-2027 complète le programme de Première.
  applicationSchoolYear : 2026-2027
  alignmentSummary (texte exact) : Structurer analyse, dissertation, commentaire, oral et appropriation des œuvres inscrites au programme 2026-2027.
  publicOfferEligible   : True

Mention "nouveau programme" ou "BO 2026" :
  PRÉSENTE — 1 occurrence(s), texte exact du champ concerné :
    - [official-programme-matrix.fr.json → rows[moduleId=premiere-francais-eaf].alignmentSummary]
      « Structurer analyse, dissertation, commentaire, oral et appropriation des œuvres inscrites au programme 2026-2027. »

Mention "épreuve anticipée" :
  PRÉSENTE — 5 occurrence(s), texte exact du champ concerné :
    - [modules.json → premiere-francais-eaf.title]
      « Français — Préparation aux EAF »
    - [modules.json → premiere-francais-eaf.subtitle]
      « Entrée en Première — découvrir les attendus des futures Épreuves Anticipées de Français, à l’écrit et à l’oral »
    - [modules.json → premiere-francais-eaf.quickAssessment]
      « Paragraphe rédigé ou passage oral bref évalué selon les attendus EAF. »
    - [modules.json → premiere-francais-eaf.sessions[4].objective]
      « Maîtriser la question de grammaire de l'oral des EAF »
    - [modules.json → premiere-francais-eaf.sessions[5].title]
      « Oral des EAF : explication et entretien »

Mention "sinus/cosinus" :
  ABSENTE

[Contrôle spécifique Français 1re] Œuvre littéraire nommée (auteur ou titre d'œuvre), ⚠ ne doit en
nommer aucune :
  Relecture exhaustive de tous les champs texte du module (aucun outil de reconnaissance de noms
  propres n'est fiable pour ce type de contrôle — chaque champ est donc listé intégralement ici) :
    - [modules.json → premiere-francais-eaf.title] « Français — Préparation aux EAF »
    - [modules.json → premiere-francais-eaf.subtitle] « Entrée en Première — découvrir les attendus des futures Épreuves Anticipées de Français, à l’écrit et à l’oral »
    - [modules.json → premiere-francais-eaf.prerequisites] « Une lecture régulière et les bases de l'analyse de texte acquises en Seconde. »
    - [modules.json → premiere-francais-eaf.differentiation] « Exercice correspondant à la voie générale ou technologique, confirmé après validation pédagogique du groupe. »
    - [modules.json → premiere-francais-eaf.quickAssessment] « Paragraphe rédigé ou passage oral bref évalué selon les attendus EAF. »
    - [modules.json → premiere-francais-eaf.sessions[1].title] « Le commentaire composé : méthode complète »
    - [modules.json → premiere-francais-eaf.sessions[1].objective] « Maîtriser la méthode du commentaire de la lecture à la rédaction »
    - [modules.json → premiere-francais-eaf.sessions[1].topics[]] « Lecture analytique et repérage des procédés »
    - [modules.json → premiere-francais-eaf.sessions[1].topics[]] « Construction d'un plan en deux ou trois axes »
    - [modules.json → premiere-francais-eaf.sessions[1].topics[]] « Rédaction de l'introduction et de la conclusion »
    - [modules.json → premiere-francais-eaf.sessions[1].topics[]] « Intégration des citations et analyse stylistique »
    - [modules.json → premiere-francais-eaf.sessions[1].method] « Travail méthodique sur un texte complet avec brouillon guidé »
    - [modules.json → premiere-francais-eaf.sessions[1].deliverable] « Commentaire composé rédigé intégralement avec auto-évaluation »
    - [modules.json → premiere-francais-eaf.sessions[2].title] « Dissertation ou contraction de texte, selon la voie »
    - [modules.json → premiere-francais-eaf.sessions[2].objective] « Comprendre les attendus de l'exercice écrit correspondant à la voie déclarée »
    - [modules.json → premiere-francais-eaf.sessions[2].topics[]] « Analyse du sujet et problématisation »
    - [modules.json → premiere-francais-eaf.sessions[2].topics[]] « Plan dialectique et plan thématique »
    - [modules.json → premiere-francais-eaf.sessions[2].topics[]] « Contraction de texte : méthode et ratio »
    - [modules.json → premiere-francais-eaf.sessions[2].topics[]] « Essai littéraire : argumentation et références »
    - [modules.json → premiere-francais-eaf.sessions[2].method] « Exercices ciblés sur la dissertation en voie générale ou la contraction et l'essai en voie technologique »
    - [modules.json → premiere-francais-eaf.sessions[2].deliverable] « Plan détaillé de dissertation ou contraction rédigée, selon la voie »
    - [modules.json → premiere-francais-eaf.sessions[3].title] « Explication linéaire : technique et pratique »
    - [modules.json → premiere-francais-eaf.sessions[3].objective] « Réaliser une explication linéaire structurée en vue de l'oral »
    - [modules.json → premiere-francais-eaf.sessions[3].topics[]] « Structure de l'explication linéaire (mouvements du texte) »
    - [modules.json → premiere-francais-eaf.sessions[3].topics[]] « Analyse des procédés au fil du texte »
    - [modules.json → premiere-francais-eaf.sessions[3].topics[]] « Formulation des micro-interprétations »
    - [modules.json → premiere-francais-eaf.sessions[3].topics[]] « Transition entre les mouvements »
    - [modules.json → premiere-francais-eaf.sessions[3].method] « Pratique sur extraits des œuvres au programme avec feedback »
    - [modules.json → premiere-francais-eaf.sessions[3].deliverable] « Explication linéaire complète rédigée et chronométrée »
    - [modules.json → premiere-francais-eaf.sessions[4].title] « Grammaire stylistique et question de grammaire »
    - [modules.json → premiere-francais-eaf.sessions[4].objective] « Maîtriser la question de grammaire de l'oral des EAF »
    - [modules.json → premiere-francais-eaf.sessions[4].topics[]] « Interrogation et négation »
    - [modules.json → premiere-francais-eaf.sessions[4].topics[]] « Subordonnées circonstancielles et relatives »
    - [modules.json → premiere-francais-eaf.sessions[4].topics[]] « Analyse de phrase complexe »
    - [modules.json → premiere-francais-eaf.sessions[4].topics[]] « Valeurs des modes et des temps »
    - [modules.json → premiere-francais-eaf.sessions[4].method] « Exercices d'analyse grammaticale sur extraits littéraires »
    - [modules.json → premiere-francais-eaf.sessions[4].deliverable] « Fiche synthèse des points de grammaire au programme de l'oral »
    - [modules.json → premiere-francais-eaf.sessions[5].title] « Oral des EAF : explication et entretien »
    - [modules.json → premiere-francais-eaf.sessions[5].objective] « Se préparer à l'épreuve orale complète (explication + entretien) »
    - [modules.json → premiere-francais-eaf.sessions[5].topics[]] « Présentation orale de l'explication linéaire (12 min) »
    - [modules.json → premiere-francais-eaf.sessions[5].topics[]] « Gestion du temps et de la voix »
    - [modules.json → premiere-francais-eaf.sessions[5].topics[]] « Entretien : défendre son parcours et son œuvre choisie »
    - [modules.json → premiere-francais-eaf.sessions[5].topics[]] « Simulation d'oral avec questions du jury »
    - [modules.json → premiere-francais-eaf.sessions[5].method] « Simulation d'oral en conditions réelles avec feedback détaillé »
    - [modules.json → premiere-francais-eaf.sessions[5].deliverable] « Grille de progression orale personnalisée et conseils ciblés »
    - [official-programme-matrix.fr.json → rows[moduleId=premiere-francais-eaf].alignmentSummary] « Structurer analyse, dissertation, commentaire, oral et appropriation des œuvres inscrites au programme 2026-2027. »
    - [official-programme-matrix.fr.json → rows[moduleId=premiere-francais-eaf].officialProgrammeId] « BO2019-LYCEE-FRANCAIS-PREMIERE »
    - [official-programme-matrix.fr.json → officialSources[BO2019-LYCEE-FRANCAIS-PREMIERE].title] « Programme de français de Première et œuvres 2026-2027 »
    - [official-programme-matrix.fr.json → officialSources[BO2019-LYCEE-FRANCAIS-PREMIERE].applicationNote] « Le cadrage des œuvres 2026-2027 complète le programme de Première. »
  CONSTAT : aucun nom d'auteur ni titre d'œuvre identifié dans les champs ci-dessus. Le module
  référence uniquement, de façon générique, « œuvre choisie », « œuvres au programme » et
  « voie déclarée / voie générale ou technologique », sans jamais nommer une œuvre ou un auteur précis.

----------------------------------------------------------------------

=== SVT 1RE ===
Fichier source (contenu séances) : content/pre-rentree-2026/modules.json → modules[].id == "premiere-svt"
Fichier source (conformité programme officiel) : content/pre-rentree-2026/official-programme-matrix.fr.json → rows[].moduleId == "premiere-svt"

Champ "id"             : premiere-svt
Champ "level"          : PREMIERE
Champ "subjectId"      : SVT
Champ "subject"        : SVT
Champ "title"          : SVT — Entrée en Première
Champ "subtitle"       : Nexus Premium — consolider les fondamentaux de SVT et préparer les attendus de la spécialité
Champ "objective"      : Sélectionner des priorités et méthodes dans les trois thèmes officiels du programme de spécialité SVT de Première ; validation d'un enseignant SVT qualifié requise avant publication.
Champ "prerequisites"  : Les acquis de Seconde en SVT : organisation du vivant, énergie, génétique et écosystèmes ; le test flash précise les priorités.
Champ "differentiation": Exercices organisés en trois paliers pour réactiver les méthodes de lecture de documents, de schémas et de raisonnement scientifique.
Champ "quickAssessment": Une activité de cinq à dix minutes vérifie la compétence travaillée à la fin de chaque séance.
Champ "equipment"      : Calculatrice scientifique simple recommandée, non obligatoire sauf consigne de l'enseignant.
Champ "publicationStatus" : DRAFT_PENDING_QUALIFIED_TEACHER_VALIDATION

Contenu intégral des 5 séances (texte exact, source = modules.json) :

  Séance 1 — Transmission, expression et variation du patrimoine génétique
    Objectif   : Réactiver les liens entre ADN, division cellulaire, expression et variation génétique
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Mitose, réplication et stabilité du génome
      - Expression du patrimoine génétique
      - Mutations et diversité génétique
      - Lecture de documents et schémas
    Méthode    : Test flash puis lecture de documents et schémas à compléter
    Livrable   : Fiche réflexe cellule et organisation du vivant

  Séance 2 — Dynamique interne de la Terre
    Objectif   : Relier observations géologiques et modèle de la dynamique terrestre
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Structure du globe
      - Mobilité des plaques
      - Zones de divergence et de convergence
      - Construction d'un modèle à partir de données
    Méthode    : Exemples guidés et exercices de lecture de cycles et de schémas
    Livrable   : Carte méthode énergie et métabolisme

  Séance 3 — Écosystèmes et services environnementaux
    Objectif   : Analyser le fonctionnement d'un écosystème et les effets d'une action humaine
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Interactions et flux dans un écosystème
      - Dynamique et résilience
      - Services écosystémiques
      - Gestion et impacts des activités humaines
    Méthode    : Schémas commentés et petits problèmes d’hérédité
    Livrable   : Fiche de synthèse génétique avec exercices corrigés

  Séance 4 — Variation génétique, santé et immunité
    Objectif   : Relier variation génétique et fonctionnement du système immunitaire à des enjeux de santé
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Variation génétique et santé
      - Immunité innée et adaptative
      - Mémoire immunitaire
      - Argumentation à partir de données
    Méthode    : Lecture de documents puis construction de réseaux et de cycles
    Livrable   : Fiche écologie et interactions corrigée

  Séance 5 — Méthodes transversales sur les trois thèmes officiels
    Objectif   : Lire des documents et rédiger une réponse argumentée mobilisant les trois thèmes
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Lecture de documents SVT
      - Gestion du temps
      - Rédaction scientifique
      - Vérification des résultats
    Méthode    : Sujet d’entraînement chronométré puis correction critériée
    Livrable   : Sujet SVT corrigé et grille personnelle de vigilance

Fiche de conformité programme officiel (official-programme-matrix.fr.json) :
  officialProgrammeId  : BO2019-LYCEE-SVT-PREMIERE
  ⚠ CONSTAT FACTUEL : officialProgrammeId "BO2019-LYCEE-SVT-PREMIERE" référencé dans rows[]
    mais ABSENT du tableau officialSources[] du même fichier (aucune définition trouvée pour cet identifiant).
  applicationSchoolYear : 2026-2027
  alignmentSummary (texte exact) : DRAFT : priorités réparties sur les trois thèmes officiels du BO 2019 ; validation d'un enseignant SVT qualifié requise.
  publicOfferEligible   : False

Mention "nouveau programme" ou "BO 2026" :
  ABSENTE

Mention "épreuve anticipée" :
  ABSENTE

Mention "sinus/cosinus" :
  ABSENTE

----------------------------------------------------------------------

=== SVT TLE ===
Fichier source (contenu séances) : content/pre-rentree-2026/modules.json → modules[].id == "terminale-svt"
Fichier source (conformité programme officiel) : content/pre-rentree-2026/official-programme-matrix.fr.json → rows[].moduleId == "terminale-svt"

Champ "id"             : terminale-svt
Champ "level"          : TERMINALE
Champ "subjectId"      : SVT
Champ "subject"        : SVT
Champ "title"          : SVT — Entrée en Terminale
Champ "subtitle"       : Nexus Premium — cibler les attendus de Terminale et consolider les méthodes de la spécialité
Champ "objective"      : Sélectionner des priorités et méthodes dans les trois thèmes officiels du programme de spécialité SVT de Terminale ; validation d'un enseignant SVT qualifié requise avant publication.
Champ "prerequisites"  : Les acquis de Première en SVT : organisation du vivant, génétique, énergie et écologie ; le test flash précise les domaines à renforcer.
Champ "differentiation": Exercices organisés par domaine et par palier pour réactiver les raisonnements attendus en Terminale.
Champ "quickAssessment": Une consigne courte de lecture, schéma ou raisonnement vérifie l’objectif de chaque séance.
Champ "equipment"      : Calculatrice scientifique simple recommandée, non obligatoire sauf consigne de l'enseignant.
Champ "publicationStatus" : DRAFT_PENDING_QUALIFIED_TEACHER_VALIDATION

Contenu intégral des 5 séances (texte exact, source = modules.json) :

  Séance 1 — Génétique et évolution
    Objectif   : Réactiver les mécanismes moléculaires, la variabilité et les grandeurs évolutives
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Expression du génome
      - Régulation génique
      - Mutations et variation
      - Dynamique des populations
    Méthode    : Schémas et petits problèmes numériques guidés
    Livrable   : Fiche génétique-évolution corrigée

  Séance 2 — À la recherche du passé géologique
    Objectif   : Mobiliser chronologie et indices géologiques pour reconstituer une histoire
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Chronologie relative
      - Datation absolue
      - Traces du passé tectonique
      - Lecture de cartes et documents géologiques
    Méthode    : Lecture de schémas et exercices de raisonnement
    Livrable   : Fiche métabolisme et énergie corrigée

  Séance 3 — Plantes, climat et enjeux contemporains
    Objectif   : Relier fonctionnement des plantes, domestication et compréhension des climats
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Organisation fonctionnelle des plantes
      - Reproduction et domestication
      - Reconstitution et évolution des climats
      - Argumentation sur les actions possibles
    Méthode    : Lecture de documents et construction d’arguments
    Livrable   : Fiche écologie et durabilité corrigée

  Séance 4 — Mouvement, énergie et stress
    Objectif   : Relier système nerveux, muscle, apport d'énergie et réponse au stress
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Commande du mouvement
      - Contraction musculaire
      - ATP et apport d'énergie
      - Réponse au stress et régulation
    Méthode    : Comparaison de schémas et problèmes de transmission
    Livrable   : Fiche patrimoine génétique corrigée

  Séance 5 — Méthodes transversales sur les trois thèmes officiels
    Objectif   : Organiser ses connaissances et traiter un exercice mobilisant plusieurs thèmes
    Notions clés (topics, dans l'ordre exact du fichier) :
      - Lecture de documents complexes
      - Raisonnement à plusieurs niveaux
      - Rédaction scientifique
      - Gestion du temps
    Méthode    : Sujet d’entraînement chronométré puis correction critériée
    Livrable   : Sujet SVT corrigé et plan d’action rentrée

Fiche de conformité programme officiel (official-programme-matrix.fr.json) :
  officialProgrammeId  : BO2019-LYCEE-SVT-TERMINALE
  ⚠ CONSTAT FACTUEL : officialProgrammeId "BO2019-LYCEE-SVT-TERMINALE" référencé dans rows[]
    mais ABSENT du tableau officialSources[] du même fichier (aucune définition trouvée pour cet identifiant).
  applicationSchoolYear : 2026-2027
  alignmentSummary (texte exact) : DRAFT : priorités réparties sur les trois thèmes officiels du BO 2019, dont une séance dédiée au corps humain et à la santé ; validation d'un enseignant SVT qualifié requise.
  publicOfferEligible   : False

Mention "nouveau programme" ou "BO 2026" :
  ABSENTE

Mention "épreuve anticipée" :
  ABSENTE

Mention "sinus/cosinus" :
  ABSENTE

----------------------------------------------------------------------

======================================================================
STATUT DRAFT / FILIGRANE — SYNTHÈSE PAR MODULE (14 modules du fichier)
======================================================================

Champ source : content/pre-rentree-2026/modules.json → modules[].publicationStatus

  troisieme-mathematiques          | level=TROISIEME  | subjectId=MATHEMATIQUES    | publicationStatus = (absent)
  troisieme-francais               | level=TROISIEME  | subjectId=FRANCAIS         | publicationStatus = (absent)
  seconde-mathematiques            | level=SECONDE    | subjectId=MATHEMATIQUES    | publicationStatus = PROPOSAL_PENDING_PEDAGOGICAL_VALIDATION
  seconde-francais                 | level=SECONDE    | subjectId=FRANCAIS         | publicationStatus = (absent)
  premiere-mathematiques           | level=PREMIERE   | subjectId=MATHEMATIQUES    | publicationStatus = PROPOSAL_PENDING_PEDAGOGICAL_VALIDATION
  premiere-francais-eaf            | level=PREMIERE   | subjectId=FRANCAIS         | publicationStatus = (absent)
  premiere-nsi                     | level=PREMIERE   | subjectId=NSI              | publicationStatus = (absent)
  premiere-physique-chimie         | level=PREMIERE   | subjectId=PHYSIQUE_CHIMIE  | publicationStatus = (absent)
  terminale-mathematiques          | level=TERMINALE  | subjectId=MATHEMATIQUES    | publicationStatus = (absent)
  terminale-maths-expertes         | level=TERMINALE  | subjectId=MATHS_EXPERTES   | publicationStatus = PROPOSAL_PENDING_PEDAGOGICAL_VALIDATION
  terminale-nsi                    | level=TERMINALE  | subjectId=NSI              | publicationStatus = (absent)
  terminale-physique-chimie        | level=TERMINALE  | subjectId=PHYSIQUE_CHIMIE  | publicationStatus = (absent)
  premiere-svt                     | level=PREMIERE   | subjectId=SVT              | publicationStatus = DRAFT_PENDING_QUALIFIED_TEACHER_VALIDATION
  terminale-svt                    | level=TERMINALE  | subjectId=SVT              | publicationStatus = DRAFT_PENDING_QUALIFIED_TEACHER_VALIDATION

Valeurs distinctes rencontrées, et effet exact dans le pipeline PDF (tools/pdf-generator/generate_all_pdfs.py) :

  1) PROPOSAL_PENDING_PEDAGOGICAL_VALIDATION
     Modules concernés : seconde-mathematiques, premiere-mathematiques, terminale-maths-expertes
     Effet PDF (fonction make_programme_body, condition exacte du code) :
       if subject["publicationStatus"] == "PROPOSAL_PENDING_PEDAGOGICAL_VALIDATION":
     → un bandeau rouge est inséré avant le programme :
       « PROPOSITION — MODULE À VALIDER PAR LA DIRECTION PÉDAGOGIQUE »

  2) DRAFT_PENDING_QUALIFIED_TEACHER_VALIDATION
     Modules concernés : premiere-svt, terminale-svt
     Effet PDF (fonction make_svt_programme_body) : filigrane pivoté plein cadre « DOCUMENT DE TRAVAIL »
     plus un texte rouge « DOCUMENT DE TRAVAIL — programme SVT en attente de validation pédagogique
     (décision D2). » — piloté par la variable SVT_DRAFT, elle-même dérivée de
     content/pre-rentree-2026/publication-decisions.owner.json → decisions.svtProgramValidation.status
     (condition exacte du code : SVT_DRAFT = status == "draft_until_owner_validation").
     Valeur actuelle de decisions.svtProgramValidation.status : "draft_until_owner_validation"
     → SVT_DRAFT est actuellement ACTIF : le filigrane est affiché sur les 2 PDF SVT.

  3) Champ absent (aucune valeur publicationStatus)
     Modules concernés : troisieme-mathematiques, troisieme-francais, seconde-francais,
     premiere-francais-eaf, premiere-nsi, premiere-physique-chimie, terminale-mathematiques,
     terminale-nsi, terminale-physique-chimie
     → aucun bandeau ni filigrane appliqué par le pipeline PDF pour ces modules sur ce critère.

======================================================================
MATHÉMATIQUES EXPERTES — VÉRIFICATION DE PÉRIMÈTRE (TERMINALE UNIQUEMENT)
======================================================================

Recherche de subjectId == "MATHS_EXPERTES" dans content/pre-rentree-2026/modules.json : 1 occurrence(s).
  - id=terminale-maths-expertes, level=TERMINALE, subject=Mathématiques expertes

CONFIRMÉ : Mathématiques expertes n'apparaît que dans un seul module, et uniquement au niveau TERMINALE.

======================================================================
MODULES DU FICHIER NON DEMANDÉS DANS LA LISTE DE L'AUDIT (mentionnés pour exhaustivité, non extraits en détail)
======================================================================

4 module(s) présent(s) dans content/pre-rentree-2026/modules.json mais absents de la liste fournie pour cet audit :
  - premiere-nsi (level=PREMIERE, subjectId=NSI, subject=NSI)
  - premiere-physique-chimie (level=PREMIERE, subjectId=PHYSIQUE_CHIMIE, subject=Physique-Chimie)
  - terminale-nsi (level=TERMINALE, subjectId=NSI, subject=NSI)
  - terminale-physique-chimie (level=TERMINALE, subjectId=PHYSIQUE_CHIMIE, subject=Physique-Chimie)

Fin de l'audit. Aucune donnée, fichier ou test du dépôt n'a été modifié pendant cette mission —
seul ce fichier AUDIT_CONTENU_MODULES.md a été créé.
