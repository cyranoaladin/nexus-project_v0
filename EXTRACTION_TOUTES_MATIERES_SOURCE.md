EXTRACTION SOURCE — TOUS LES MODULES (HORS MATHÉMATIQUES) — STAGES PRÉ-RENTRÉE 2026
==========================================================================================

MISSION : extraction en lecture seule, texte exact, aucune modification du dépôt.
Aucune interprétation, aucun jugement de conformité, aucune correction : copie
caractère pour caractère des champs JSON source, pour audit pédagogique ligne à
ligne de la direction.

SHA du HEAD au moment de l'extraction : 33fe0165e457ee7f877bb98bcd263f90bf360617
Branche : feat/pre-rentree-planning-scheduler
Fichier source (contenu séances)         : content/pre-rentree-2026/modules.json
Fichier source (conformité programme BO) : content/pre-rentree-2026/official-programme-matrix.fr.json

Modules extraits (9), par matière :
  FRANÇAIS :
    - troisieme-francais
    - seconde-francais
    - premiere-francais-eaf
  PHYSIQUE-CHIMIE :
    - premiere-physique-chimie
    - terminale-physique-chimie
  NSI :
    - premiere-nsi
    - terminale-nsi
  SVT :
    - premiere-svt
    - terminale-svt

Note de méthode sur les incohérences titre/contenu signalées : une première passe par
recoupement automatique de mots-clés a été tentée puis écartée (trop de faux positifs sur
Français/Physique-Chimie/NSI, où le vocabulaire diffère du titre sans que le fond soit
incohérent — ex. "Réactions chimiques et stœchiométrie" -> deliverable "tableau
d'avancement", qui EST la méthode de stœchiométrie, pas une incohérence). Les signaux
ci-dessous sont issus d'une relecture directe titre vs. method/deliverable, et reproduisent
exactement le constat déjà documenté dans DEBTS.md (audit qualité du 2026-07-25, module SVT).

##########################################################################################
# MATIÈRE : FRANÇAIS
##########################################################################################

=== TROISIEME-FRANCAIS ===
Fichier + chemin exact : content/pre-rentree-2026/modules.json → modules[] où id == "troisieme-francais"
Titre (champ `title`)  : Français — Entrée en 3e
Sous-titre (champ `subtitle`) : Nexus Fondations — consolider la langue, la lecture et l'écriture pour préparer la classe de 3e et le DNB
Niveau (champ `level`) : TROISIEME
Matière (champ `subjectId`) : FRANCAIS
Matière (champ `subject`)   : Français
publicationStatus (exact)   : PROPOSAL_PENDING_PEDAGOGICAL_VALIDATION

Champs bruts du module (copie exacte, tous les champs présents ou absents dans le JSON) :
  objective       : (champ absent)
  prerequisites   : Les acquis de 4e en compréhension, grammaire, orthographe et rédaction ; le test flash précise les besoins.
  differentiation : Textes, aides de rédaction et exercices de langue proposés en trois paliers de difficulté.
  quickAssessment : Une consigne courte de lecture, langue ou écriture vérifie l'objectif de chaque séance.
  equipment       : (champ absent)

Nombre de séances trouvées : 5 (conforme : 5 séances)

Contenu intégral des séances (copie exacte, champ par champ, source = modules.json) :

  Séance 1 — titre exact : Compréhension et interprétation
    objectif (texte exact)             : Prélever des indices, formuler une interprétation et la justifier par le texte
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Repérage des informations
      - Implicite
      - Citation et justification
      - Réponse rédigée
    méthode / method (texte exact)     : Lecture active, questions graduées et mise en commun des preuves textuelles
    livrable / deliverable (texte exact): Grille de lecture active et réponses corrigées
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 2 — titre exact : Grammaire, accords et réécriture
    objectif (texte exact)             : Analyser la phrase et appliquer les accords dans une transformation de texte
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Classes et fonctions
      - Accords dans le groupe nominal
      - Accord sujet-verbe
      - Réécriture
    méthode / method (texte exact)     : Manipulations de phrases puis réécriture commentée
    livrable / deliverable (texte exact): Fiche d'accords et exercice de réécriture corrigé
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 3 — titre exact : Dictée et maîtrise de la langue
    objectif (texte exact)             : Mobiliser une méthode de relecture pour corriger les erreurs fréquentes
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Homophones grammaticaux
      - Terminaisons verbales
      - Accords
      - Ponctuation
    méthode / method (texte exact)     : Dictée négociée, classement des erreurs et seconde version corrigée
    livrable / deliverable (texte exact): Grille personnelle de relecture et dictée corrigée
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 4 — titre exact : Rédaction et organisation des idées
    objectif (texte exact)             : Construire un texte cohérent avec un plan, des paragraphes et des exemples précis
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Analyse du sujet
      - Recherche d'idées
      - Plan et paragraphes
      - Enrichissement de l'expression
    méthode / method (texte exact)     : Plan guidé, rédaction par étapes puis révision avec grille
    livrable / deliverable (texte exact): Production rédigée annotée et grille de relecture
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 5 — titre exact : Méthodologie DNB et sujet d'entraînement
    objectif (texte exact)             : Coordonner compréhension, langue et rédaction dans un entraînement complet
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Gestion du temps
      - Barème
      - Justification
      - Relecture finale
    méthode / method (texte exact)     : Sujet d'entraînement chronométré puis correction méthodique
    livrable / deliverable (texte exact): Sujet DNB corrigé et trois priorités de rentrée
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

Ligne de conformité programme officiel (content/pre-rentree-2026/official-programme-matrix.fr.json → rows[] où moduleId == "troisieme-francais") :
  moduleId              : troisieme-francais
  officialProgrammeId   : BO2020-CYCLE4-FRANCAIS
  applicationSchoolYear : 2026-2027
  alignmentSummary (texte exact) : Renforcer compréhension, interprétation, grammaire, orthographe et écriture argumentée attendues au cycle 4.
  publicOfferEligible   : True

  Source officielle référencée (officialSources["BO2020-CYCLE4-FRANCAIS"]) :
    title (texte exact) : Programme de français du cycle 4 applicable à la 3e en 2026-2027
    url (texte exact)   : https://www.education.gouv.fr/bo/20/Hebdo31/MENE2018714A.htm
    publisher           : Ministère de l'Éducation nationale
    applicationNote (texte exact) : Le programme publié le 5 mars 2026 entre progressivement en vigueur et ne s'applique en 3e qu'en 2028-2029.

------------------------------------------------------------------------------------------

=== SECONDE-FRANCAIS ===
Fichier + chemin exact : content/pre-rentree-2026/modules.json → modules[] où id == "seconde-francais"
Titre (champ `title`)  : Français — Entrée en Seconde
Sous-titre (champ `subtitle`) : Entrée en Seconde — consolider compréhension, expression, grammaire et argumentation pour aborder les méthodes du lycée
Niveau (champ `level`) : SECONDE
Matière (champ `subjectId`) : FRANCAIS
Matière (champ `subject`)   : Français
publicationStatus (exact)   : PROPOSAL_PENDING_PEDAGOGICAL_VALIDATION

Champs bruts du module (copie exacte, tous les champs présents ou absents dans le JSON) :
  objective       : (champ absent)
  prerequisites   : Les compétences de lecture et d'écriture attendues en fin de Troisième et de collège.
  differentiation : Textes, consignes et attendus de rédaction ajustés au niveau de maîtrise observé.
  quickAssessment : Production brève ou question d'analyse relue avec une grille de critères.
  equipment       : (champ absent)

Nombre de séances trouvées : 5 (conforme : 5 séances)

Contenu intégral des séances (copie exacte, champ par champ, source = modules.json) :

  Séance 1 — titre exact : Expression écrite structurée : le paragraphe argumenté
    objectif (texte exact)             : Rédiger un paragraphe argumenté clair avec exemples pertinents
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Structure argument-exemple-analyse
      - Connecteurs logiques et transitions
      - Registres de langue et précision du vocabulaire
      - Exercices de rédaction chronométrés
    méthode / method (texte exact)     : Modélisation puis pratique guidée avec feedback immédiat
    livrable / deliverable (texte exact): Fiche méthode du paragraphe argumenté avec modèles
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 2 — titre exact : Compréhension et analyse de texte littéraire
    objectif (texte exact)             : Identifier les procédés d'écriture et formuler une interprétation
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Repérage des champs lexicaux et figures de style
      - Identification du registre et du ton
      - Analyse de la structure narrative ou argumentative
      - Formulation d'hypothèses interprétatives
    méthode / method (texte exact)     : Lecture active guidée sur extraits variés (roman, poésie, théâtre)
    livrable / deliverable (texte exact): Boîte à outils des procédés littéraires avec exemples
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 3 — titre exact : Argumentation : convaincre et persuader
    objectif (texte exact)             : Distinguer les stratégies argumentatives et les mobiliser à l'écrit
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Thèse, arguments, exemples
      - Concession et réfutation
      - Argumentation directe vs indirecte
      - Rédaction d'un développement argumenté
    méthode / method (texte exact)     : Analyse de textes argumentatifs puis production écrite encadrée
    livrable / deliverable (texte exact): Plan-type d'un développement argumenté réutilisable
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 4 — titre exact : Grammaire au service de l'expression
    objectif (texte exact)             : Maîtriser les outils grammaticaux essentiels pour le lycée
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Proposition subordonnée et types de phrases complexes
      - Valeurs des temps verbaux
      - Accords complexes (participe passé, relatif)
      - Ponctuation expressive et stylistique
    méthode / method (texte exact)     : Exercices ciblés puis réinvestissement en production écrite
    livrable / deliverable (texte exact): Mémo grammaire lycée avec erreurs fréquentes à éviter
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 5 — titre exact : Initiation au commentaire de texte
    objectif (texte exact)             : Comprendre la méthode du commentaire composé et en rédiger une partie
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Différence entre paraphrase et analyse
      - Construction d'un axe de lecture
      - Rédaction d'un sous-partie de commentaire
      - Introduction et conclusion : principes
    méthode / method (texte exact)     : Travail progressif sur un extrait : du brouillon à la rédaction
    livrable / deliverable (texte exact): Modèle de brouillon commentaire avec étapes clés
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

Ligne de conformité programme officiel (content/pre-rentree-2026/official-programme-matrix.fr.json → rows[] où moduleId == "seconde-francais") :
  moduleId              : seconde-francais
  officialProgrammeId   : BO2019-LYCEE-FRANCAIS-SECONDE
  applicationSchoolYear : 2026-2027
  alignmentSummary (texte exact) : Préparer lecture analytique, culture littéraire, expression écrite et maîtrise de la langue au lycée.
  publicOfferEligible   : True

  Source officielle référencée (officialSources["BO2019-LYCEE-FRANCAIS-SECONDE"]) :
    title (texte exact) : Programme de français de Seconde
    url (texte exact)   : https://eduscol.education.gouv.fr/5793/programmes-et-ressources-en-francais-voie-gt?menu_id=2117
    publisher           : Ministère de l'Éducation nationale
    applicationNote (texte exact) : Programme en vigueur pour l'année scolaire 2026-2027.

------------------------------------------------------------------------------------------

=== PREMIERE-FRANCAIS-EAF ===
Fichier + chemin exact : content/pre-rentree-2026/modules.json → modules[] où id == "premiere-francais-eaf"
Titre (champ `title`)  : Français — Préparation aux EAF
Sous-titre (champ `subtitle`) : Entrée en Première — découvrir les attendus des futures Épreuves Anticipées de Français, à l’écrit et à l’oral
Niveau (champ `level`) : PREMIERE
Matière (champ `subjectId`) : FRANCAIS
Matière (champ `subject`)   : Français (EAF)
publicationStatus (exact)   : PROPOSAL_PENDING_PEDAGOGICAL_VALIDATION

Champs bruts du module (copie exacte, tous les champs présents ou absents dans le JSON) :
  objective       : (champ absent)
  prerequisites   : Une lecture régulière et les bases de l'analyse de texte acquises en Seconde.
  differentiation : Exercice correspondant à la voie générale ou technologique, confirmé après validation pédagogique du groupe.
  quickAssessment : Paragraphe rédigé ou passage oral bref évalué selon les attendus EAF.
  equipment       : (champ absent)

Nombre de séances trouvées : 5 (conforme : 5 séances)

Contenu intégral des séances (copie exacte, champ par champ, source = modules.json) :

  Séance 1 — titre exact : Le commentaire composé : méthode complète
    objectif (texte exact)             : Maîtriser la méthode du commentaire de la lecture à la rédaction
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Lecture analytique et repérage des procédés
      - Construction d'un plan en deux ou trois axes
      - Rédaction de l'introduction et de la conclusion
      - Intégration des citations et analyse stylistique
    méthode / method (texte exact)     : Travail méthodique sur un texte complet avec brouillon guidé
    livrable / deliverable (texte exact): Commentaire composé rédigé intégralement avec auto-évaluation
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 2 — titre exact : Dissertation ou contraction de texte, selon la voie
    objectif (texte exact)             : Comprendre les attendus de l'exercice écrit correspondant à la voie déclarée
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Analyse du sujet et problématisation
      - Plan dialectique et plan thématique
      - Contraction de texte : méthode et ratio
      - Essai littéraire : argumentation et références
    méthode / method (texte exact)     : Exercices ciblés sur la dissertation en voie générale ou la contraction et l'essai en voie technologique
    livrable / deliverable (texte exact): Plan détaillé de dissertation ou contraction rédigée, selon la voie
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 3 — titre exact : Explication linéaire : technique et pratique
    objectif (texte exact)             : Réaliser une explication linéaire structurée en vue de l'oral
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Structure de l'explication linéaire (mouvements du texte)
      - Analyse des procédés au fil du texte
      - Formulation des micro-interprétations
      - Transition entre les mouvements
    méthode / method (texte exact)     : Pratique sur extraits des œuvres au programme avec feedback
    livrable / deliverable (texte exact): Explication linéaire complète rédigée et chronométrée
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 4 — titre exact : Grammaire stylistique et question de grammaire
    objectif (texte exact)             : Maîtriser la question de grammaire de l'oral des EAF
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Interrogation et négation
      - Subordonnées circonstancielles et relatives
      - Analyse de phrase complexe
      - Valeurs des modes et des temps
    méthode / method (texte exact)     : Exercices d'analyse grammaticale sur extraits littéraires
    livrable / deliverable (texte exact): Fiche synthèse des points de grammaire au programme de l'oral
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 5 — titre exact : Oral des EAF : explication et entretien
    objectif (texte exact)             : Se préparer à l'épreuve orale complète (explication + entretien)
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Présentation orale de l'explication linéaire (12 min)
      - Gestion du temps et de la voix
      - Entretien : défendre son parcours et son œuvre choisie
      - Simulation d'oral avec questions du jury
    méthode / method (texte exact)     : Simulation d'oral en conditions réelles avec feedback détaillé
    livrable / deliverable (texte exact): Grille de progression orale personnalisée et conseils ciblés
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

Ligne de conformité programme officiel (content/pre-rentree-2026/official-programme-matrix.fr.json → rows[] où moduleId == "premiere-francais-eaf") :
  moduleId              : premiere-francais-eaf
  officialProgrammeId   : BO2019-LYCEE-FRANCAIS-PREMIERE
  applicationSchoolYear : 2026-2027
  alignmentSummary (texte exact) : Structurer analyse, dissertation, commentaire, oral et appropriation des œuvres inscrites au programme 2026-2027.
  publicOfferEligible   : True

  Source officielle référencée (officialSources["BO2019-LYCEE-FRANCAIS-PREMIERE"]) :
    title (texte exact) : Programme de français de Première et œuvres 2026-2027
    url (texte exact)   : https://www.education.gouv.fr/bo/2025/Hebdo30/MENE2518792N
    publisher           : Ministère de l'Éducation nationale
    applicationNote (texte exact) : Le cadrage des œuvres 2026-2027 complète le programme de Première.

------------------------------------------------------------------------------------------

##########################################################################################
# MATIÈRE : PHYSIQUE-CHIMIE
##########################################################################################

=== PREMIERE-PHYSIQUE-CHIMIE ===
Fichier + chemin exact : content/pre-rentree-2026/modules.json → modules[] où id == "premiere-physique-chimie"
Titre (champ `title`)  : Physique-Chimie — Entrée en Première
Sous-titre (champ `subtitle`) : Entrée en Première — partir des acquis de Seconde pour préparer les premières notions de l’EDS Physique-Chimie
Niveau (champ `level`) : PREMIERE
Matière (champ `subjectId`) : PHYSIQUE_CHIMIE
Matière (champ `subject`)   : Physique-Chimie
publicationStatus (exact)   : PROPOSAL_PENDING_PEDAGOGICAL_VALIDATION

Champs bruts du module (copie exacte, tous les champs présents ou absents dans le JSON) :
  objective       : (champ absent)
  prerequisites   : Les grandeurs, unités et méthodes expérimentales travaillées en Seconde.
  differentiation : Guidage calculatoire, schémas et problèmes d'approfondissement selon le profil déclaré.
  quickAssessment : Question de modélisation ou calcul scientifique commenté en fin de séance.
  equipment       : (champ absent)

Nombre de séances trouvées : 5 (conforme : 5 séances)

Contenu intégral des séances (copie exacte, champ par champ, source = modules.json) :

  Séance 1 — titre exact : Quantité de matière et concentration
    objectif (texte exact)             : Maîtriser la mole, les calculs de quantité et les concentrations
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Mole et nombre d'Avogadro
      - Masse molaire et volume molaire
      - Concentration molaire et massique
      - Dilution et préparation de solutions
    méthode / method (texte exact)     : Exercices de calcul systématiques avec progression de difficulté
    livrable / deliverable (texte exact): Fiche formulaire quantité de matière avec méthode de résolution
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 2 — titre exact : Réactions chimiques et stœchiométrie
    objectif (texte exact)             : Équilibrer une réaction et réaliser un bilan de matière
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Équation de réaction et équilibrage
      - Tableau d'avancement
      - Réactif limitant et avancement maximal
      - Rendement d'une réaction
    méthode / method (texte exact)     : Méthode pas-à-pas du tableau d'avancement sur exemples variés
    livrable / deliverable (texte exact): Méthode complète du tableau d'avancement avec exercices résolus
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 3 — titre exact : Champs et forces : gravitation et électrostatique
    objectif (texte exact)             : Caractériser les champs de gravitation et électrostatique
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Notion de champ (scalaire et vectoriel)
      - Champ de gravitation et pesanteur
      - Force et champ électrostatique
      - Lignes de champ et cartographie
    méthode / method (texte exact)     : Schématisation systématique et exercices d'application
    livrable / deliverable (texte exact): Tableau comparatif gravitation/électrostatique avec schémas
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 4 — titre exact : Énergie mécanique et conservation
    objectif (texte exact)             : Appliquer le principe de conservation de l'énergie mécanique
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Énergie cinétique et théorème de l'énergie cinétique
      - Énergie potentielle de pesanteur
      - Énergie mécanique et conservation
      - Transferts d'énergie et frottements
    méthode / method (texte exact)     : Résolution de problèmes avec bilan énergétique schématisé
    livrable / deliverable (texte exact): Méthode de résolution par bilan énergétique avec exemples
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 5 — titre exact : Exploitation de documents scientifiques
    objectif (texte exact)             : Extraire des informations et résoudre un problème à partir de documents
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Lecture critique de graphiques et tableaux
      - Extraction d'informations pertinentes
      - Mise en relation de données multi-documents
      - Rédaction structurée d'une résolution de problème
    méthode / method (texte exact)     : Entraînement sur exercices type Bac avec correction détaillée
    livrable / deliverable (texte exact): Copie type corrigée avec grille de notation explicitée
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

Ligne de conformité programme officiel (content/pre-rentree-2026/official-programme-matrix.fr.json → rows[] où moduleId == "premiere-physique-chimie") :
  moduleId              : premiere-physique-chimie
  officialProgrammeId   : BO2019-LYCEE-PC-PREMIERE
  applicationSchoolYear : 2026-2027
  alignmentSummary (texte exact) : Consolider quantités de matière, transformations, mouvement, interactions, énergie, ondes et démarche expérimentale.
  publicOfferEligible   : True

  Source officielle référencée (officialSources["BO2019-LYCEE-PC-PREMIERE"]) :
    title (texte exact) : Programme de physique-chimie de Première générale
    url (texte exact)   : https://www.education.gouv.fr/au-bo-special-du-22-janvier-2019-programmes-d-enseignement-du-lycee-general-et-technologique-455475
    publisher           : Ministère de l'Éducation nationale
    applicationNote (texte exact) : Programme en vigueur pour l'année scolaire 2026-2027.

------------------------------------------------------------------------------------------

=== TERMINALE-PHYSIQUE-CHIMIE ===
Fichier + chemin exact : content/pre-rentree-2026/modules.json → modules[] où id == "terminale-physique-chimie"
Titre (champ `title`)  : Physique-Chimie — Entrée en Terminale
Sous-titre (champ `subtitle`) : Entrée en Terminale — pour les élèves conservant l’EDS Physique-Chimie, préparer les premières notions à partir des acquis de Première
Niveau (champ `level`) : TERMINALE
Matière (champ `subjectId`) : PHYSIQUE_CHIMIE
Matière (champ `subject`)   : Physique-Chimie
publicationStatus (exact)   : PROPOSAL_PENDING_PEDAGOGICAL_VALIDATION

Champs bruts du module (copie exacte, tous les champs présents ou absents dans le JSON) :
  objective       : (champ absent)
  prerequisites   : Les acquis de Première en mécanique, chimie quantitative et exploitation de données.
  differentiation : Spécialité Physique-Chimie conservée et compatibilité du groupe soumises à validation pédagogique ; aides graduées selon le profil.
  quickAssessment : Mini-problème scientifique corrigé sur la modélisation, les unités et la conclusion.
  equipment       : (champ absent)

Nombre de séances trouvées : 5 (conforme : 5 séances)

Contenu intégral des séances (copie exacte, champ par champ, source = modules.json) :

  Séance 1 — titre exact : Acides-bases et pH
    objectif (texte exact)             : Comprendre les réactions acido-basiques et calculer le pH de solutions
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Couples acide-base et réaction acido-basique
      - pH et concentration en ions H3O+
      - Acides forts, acides faibles et constante Ka
      - Solutions tampon (introduction)
    méthode / method (texte exact)     : Exercices de calcul progressifs avec interprétation des résultats
    livrable / deliverable (texte exact): Fiche méthode acides-bases avec exercices types résolus
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 2 — titre exact : Cinétique chimique : vitesse et facteurs
    objectif (texte exact)             : Décrire l'évolution temporelle d'une réaction et ses facteurs cinétiques
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Vitesse de réaction et suivi temporel
      - Facteurs cinétiques (température, concentration, catalyseur)
      - Temps de demi-réaction
      - Exploitation de courbes cinétiques
    méthode / method (texte exact)     : Analyse de données expérimentales et exercices d'exploitation
    livrable / deliverable (texte exact): Méthode d'exploitation d'une courbe cinétique avec exemples
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 3 — titre exact : Mécanique newtonienne
    objectif (texte exact)             : Appliquer les lois de Newton pour étudier des mouvements
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Deuxième loi de Newton (somme des forces = ma)
      - Mouvement dans un champ de pesanteur uniforme
      - Mouvement d'un projectile
      - Mouvement circulaire uniforme (introduction)
    méthode / method (texte exact)     : Résolution méthodique de problèmes avec schématisation systématique
    livrable / deliverable (texte exact): Méthode de résolution mécanique newtonienne avec problèmes résolus
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 4 — titre exact : Ondes et optique
    objectif (texte exact)             : Caractériser une onde et comprendre les phénomènes optiques fondamentaux
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Ondes mécaniques : célérité, période, longueur d'onde
      - Phénomène de diffraction
      - Interférences (conditions constructives/destructives)
      - Lois de Snell-Descartes et dispersion
    méthode / method (texte exact)     : Schématisation et calculs sur situations expérimentales concrètes
    livrable / deliverable (texte exact): Formulaire ondes-optique avec schémas explicatifs
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 5 — titre exact : Résolution de problèmes scientifiques
    objectif (texte exact)             : Maîtriser la méthodologie de résolution de problème type Bac
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Analyse d'un énoncé et extraction de données
      - Choix du modèle et mise en équation
      - Résolution et vérification de cohérence
      - Rédaction structurée de la solution
    méthode / method (texte exact)     : Entraînement sur problèmes type Bac avec correction critériée
    livrable / deliverable (texte exact): Problème résolu intégralement avec grille de notation explicitée
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

Ligne de conformité programme officiel (content/pre-rentree-2026/official-programme-matrix.fr.json → rows[] où moduleId == "terminale-physique-chimie") :
  moduleId              : terminale-physique-chimie
  officialProgrammeId   : BO2019-LYCEE-PC-TERMINALE
  applicationSchoolYear : 2026-2027
  alignmentSummary (texte exact) : Réactiver transformations, mécanique, énergie, ondes, signaux et méthodes quantitatives nécessaires au programme de Terminale.
  publicOfferEligible   : True

  Source officielle référencée (officialSources["BO2019-LYCEE-PC-TERMINALE"]) :
    title (texte exact) : Programme de physique-chimie de Terminale générale
    url (texte exact)   : https://www.education.gouv.fr/au-bo-special-du-22-janvier-2019-programmes-d-enseignement-du-lycee-general-et-technologique-455475
    publisher           : Ministère de l'Éducation nationale
    applicationNote (texte exact) : Programme en vigueur pour l'année scolaire 2026-2027.

------------------------------------------------------------------------------------------

##########################################################################################
# MATIÈRE : NSI
##########################################################################################

=== PREMIERE-NSI ===
Fichier + chemin exact : content/pre-rentree-2026/modules.json → modules[] où id == "premiere-nsi"
Titre (champ `title`)  : NSI — Entrée en Première
Sous-titre (champ `subtitle`) : Entrée en Première — commencer l’EDS NSI par l’algorithmique, Python et les concepts fondamentaux
Niveau (champ `level`) : PREMIERE
Matière (champ `subjectId`) : NSI
Matière (champ `subject`)   : NSI
publicationStatus (exact)   : PROPOSAL_PENDING_PEDAGOGICAL_VALIDATION

Champs bruts du module (copie exacte, tous les champs présents ou absents dans le JSON) :
  objective       : (champ absent)
  prerequisites   : Aucun prérequis NSI ou Python obligatoire ; les repères numériques éventuellement acquis au collège ou en Seconde sont repris depuis les fondamentaux.
  differentiation : Exercices à difficulté progressive et défis d'approfondissement pour les profils avancés.
  quickAssessment : Fonction Python ou raisonnement algorithmique court testé en fin de séance.
  equipment       : (champ absent)

Nombre de séances trouvées : 5 (conforme : 5 séances)

Contenu intégral des séances (copie exacte, champ par champ, source = modules.json) :

  Séance 1 — titre exact : Algorithmique et premiers programmes Python
    objectif (texte exact)             : Découvrir comment décomposer un problème et écrire un premier programme Python
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Algorithme, instruction et ordre d’exécution
      - Variables, types simples et affectation
      - Entrées, sorties et expressions
      - Lecture et test d’un programme court
    méthode / method (texte exact)     : Démonstration guidée puis écriture progressive de programmes très courts
    livrable / deliverable (texte exact): Premier programme Python commenté et fiche de vocabulaire algorithmique
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 2 — titre exact : Conditions et boucles
    objectif (texte exact)             : Écrire des programmes qui prennent une décision et répètent un traitement
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Expressions booléennes
      - Structures conditionnelles if, elif, else
      - Boucles for et while
      - Traces d’exécution et terminaison
    méthode / method (texte exact)     : Prédiction de traces puis exercices Python à paliers
    livrable / deliverable (texte exact): Programme interactif utilisant conditions et boucles
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 3 — titre exact : Fonctions et décomposition d’un problème
    objectif (texte exact)             : Comprendre l’intérêt des fonctions et structurer une solution en sous-problèmes
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Définition et appel d’une fonction
      - Paramètres et valeur de retour
      - Portée élémentaire des variables
      - Tests simples et cas limites
    méthode / method (texte exact)     : Refactorisation guidée d’un programme puis exercices de décomposition
    livrable / deliverable (texte exact): Bibliothèque de fonctions courtes accompagnées de tests
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 4 — titre exact : Listes, parcours et recherche
    objectif (texte exact)             : Manipuler une collection simple et construire un premier algorithme de recherche
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Création et accès aux éléments d’une liste
      - Parcours par indices et par valeurs
      - Accumulation et recherche séquentielle
      - Introduction à l’efficacité d’un algorithme
    méthode / method (texte exact)     : Manipulations guidées puis résolution d’un problème de recherche
    livrable / deliverable (texte exact): Algorithme de recherche commenté et jeu de tests
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 5 — titre exact : Mini-projet intégrateur NSI
    objectif (texte exact)             : Mobiliser les fondamentaux découverts dans un projet accessible aux débutants
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Définition du cahier des charges
      - Structuration du code en fonctions
      - Tests et validation
      - Documentation et présentation
    méthode / method (texte exact)     : Pédagogie par projet avec accompagnement personnalisé
    livrable / deliverable (texte exact): Mini-projet Python documenté, testé et présenté au groupe
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

Ligne de conformité programme officiel (content/pre-rentree-2026/official-programme-matrix.fr.json → rows[] où moduleId == "premiere-nsi") :
  moduleId              : premiere-nsi
  officialProgrammeId   : BO2019-LYCEE-NSI-PREMIERE
  applicationSchoolYear : 2026-2027
  alignmentSummary (texte exact) : Introduire représentation des données, algorithmique, programmation, architectures et interaction homme-machine.
  publicOfferEligible   : True

  Source officielle référencée (officialSources["BO2019-LYCEE-NSI-PREMIERE"]) :
    title (texte exact) : Programme de numérique et sciences informatiques de Première
    url (texte exact)   : https://eduscol.education.fr/cid59678/presentation-isn.html
    publisher           : Ministère de l'Éducation nationale
    applicationNote (texte exact) : Programme en vigueur pour l'année scolaire 2026-2027.

------------------------------------------------------------------------------------------

=== TERMINALE-NSI ===
Fichier + chemin exact : content/pre-rentree-2026/modules.json → modules[] où id == "terminale-nsi"
Titre (champ `title`)  : NSI — Entrée en Terminale
Sous-titre (champ `subtitle`) : Entrée en Terminale — pour les élèves conservant l’EDS NSI, aborder les structures de données et la future épreuve pratique
Niveau (champ `level`) : TERMINALE
Matière (champ `subjectId`) : NSI
Matière (champ `subject`)   : NSI
publicationStatus (exact)   : PROPOSAL_PENDING_PEDAGOGICAL_VALIDATION

Champs bruts du module (copie exacte, tous les champs présents ou absents dans le JSON) :
  objective       : (champ absent)
  prerequisites   : Les bases de Python, des fonctions, des listes et de l'algorithmique de Première NSI.
  differentiation : Profil Première NSI déclaré et compatibilité du groupe soumis à validation pédagogique ; implémentations guidées puis variantes selon l'autonomie.
  quickAssessment : Code court à compléter, tester et expliquer à l'issue de chaque séance.
  equipment       : (champ absent)

Nombre de séances trouvées : 5 (conforme : 5 séances)

Contenu intégral des séances (copie exacte, champ par champ, source = modules.json) :

  Séance 1 — titre exact : Structures de données : piles, files et arbres
    objectif (texte exact)             : Implémenter et utiliser les structures de données linéaires et arborescentes
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Piles : principe LIFO et implémentation
      - Files : principe FIFO et implémentation
      - Arbres binaires : vocabulaire et parcours
      - Arbres binaires de recherche (ABR)
    méthode / method (texte exact)     : Implémentation guidée puis exercices d'utilisation
    livrable / deliverable (texte exact): Implémentations Python des structures avec tests unitaires
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 2 — titre exact : Récursivité : principes et applications
    objectif (texte exact)             : Concevoir et analyser des algorithmes récursifs
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Principe de récursivité et cas de base
      - Pile d'appels et déroulement d'exécution
      - Exemples classiques (factorielle, Fibonacci, puissance)
      - Récursivité sur les arbres (parcours, hauteur)
    méthode / method (texte exact)     : Visualisation de la pile d'appels puis exercices progressifs
    livrable / deliverable (texte exact): Catalogue d'algorithmes récursifs commentés et testés
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 3 — titre exact : Bases de données et SQL
    objectif (texte exact)             : Modéliser des données et écrire des requêtes SQL courantes
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Modèle relationnel et schéma de base
      - Requêtes SELECT, WHERE, ORDER BY
      - Jointures entre tables
      - INSERT, UPDATE, DELETE et contraintes d'intégrité
    méthode / method (texte exact)     : Exercices sur base de données concrète avec requêtes progressives
    livrable / deliverable (texte exact): Série de requêtes SQL résolues sur une base exemple
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 4 — titre exact : Protocoles réseaux et sécurité
    objectif (texte exact)             : Comprendre les protocoles réseau et les enjeux de sécurité
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Modèle TCP/IP et encapsulation
      - Adressage IP et routage simplifié
      - Protocoles applicatifs (HTTP, DNS)
      - Chiffrement symétrique et asymétrique (principes)
    méthode / method (texte exact)     : Analyse de trames et exercices de routage sur schéma réseau
    livrable / deliverable (texte exact): Schéma récapitulatif des protocoles avec exercices résolus
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 5 — titre exact : Méthodologie de l'épreuve pratique NSI
    objectif (texte exact)             : Se préparer efficacement à l'épreuve pratique du Bac NSI
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Format de l'épreuve et attendus
      - Stratégie de résolution (lecture, pseudo-code, implémentation)
      - Gestion du temps sur les deux exercices
      - Entraînement sur sujets types avec correction
    méthode / method (texte exact)     : Simulation d'épreuve en conditions réelles puis correction détaillée
    livrable / deliverable (texte exact): Deux exercices d'épreuve pratique résolus avec méthode
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

Ligne de conformité programme officiel (content/pre-rentree-2026/official-programme-matrix.fr.json → rows[] où moduleId == "terminale-nsi") :
  moduleId              : terminale-nsi
  officialProgrammeId   : BO2019-LYCEE-NSI-TERMINALE
  applicationSchoolYear : 2026-2027
  alignmentSummary (texte exact) : Réactiver structures de données, bases de données, architectures, réseaux et conception d'algorithmes avant la Terminale.
  publicOfferEligible   : True

  Source officielle référencée (officialSources["BO2019-LYCEE-NSI-TERMINALE"]) :
    title (texte exact) : Programme de numérique et sciences informatiques de Terminale
    url (texte exact)   : https://eduscol.education.fr/cid59678/presentation-isn.html
    publisher           : Ministère de l'Éducation nationale
    applicationNote (texte exact) : Programme en vigueur pour l'année scolaire 2026-2027.

------------------------------------------------------------------------------------------

##########################################################################################
# MATIÈRE : SVT
##########################################################################################

=== PREMIERE-SVT ===
Fichier + chemin exact : content/pre-rentree-2026/modules.json → modules[] où id == "premiere-svt"
Titre (champ `title`)  : SVT — Entrée en Première
Sous-titre (champ `subtitle`) : Nexus Premium — consolider les fondamentaux de SVT et préparer les attendus de la spécialité
Niveau (champ `level`) : PREMIERE
Matière (champ `subjectId`) : SVT
Matière (champ `subject`)   : SVT
publicationStatus (exact)   : DRAFT_PENDING_QUALIFIED_TEACHER_VALIDATION

Champs bruts du module (copie exacte, tous les champs présents ou absents dans le JSON) :
  objective       : Sélectionner des priorités et méthodes dans les trois thèmes officiels du programme de spécialité SVT de Première ; validation d'un enseignant SVT qualifié requise avant publication.
  prerequisites   : Les acquis de Seconde en SVT : organisation du vivant, énergie, génétique et écosystèmes ; le test flash précise les priorités.
  differentiation : Exercices organisés en trois paliers pour réactiver les méthodes de lecture de documents, de schémas et de raisonnement scientifique.
  quickAssessment : Une activité de cinq à dix minutes vérifie la compétence travaillée à la fin de chaque séance.
  equipment       : Calculatrice scientifique simple recommandée, non obligatoire sauf consigne de l'enseignant.

Nombre de séances trouvées : 5 (conforme : 5 séances)

Contenu intégral des séances (copie exacte, champ par champ, source = modules.json) :

  Séance 1 — titre exact : Transmission, expression et variation du patrimoine génétique
    objectif (texte exact)             : Réactiver les liens entre ADN, division cellulaire, expression et variation génétique
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Mitose, réplication et stabilité du génome
      - Expression du patrimoine génétique
      - Mutations et diversité génétique
      - Lecture de documents et schémas
    méthode / method (texte exact)     : Test flash puis lecture de documents et schémas à compléter
    livrable / deliverable (texte exact): Fiche réflexe cellule et organisation du vivant
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 2 — titre exact : Dynamique interne de la Terre
    objectif (texte exact)             : Relier observations géologiques et modèle de la dynamique terrestre
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Structure du globe
      - Mobilité des plaques
      - Zones de divergence et de convergence
      - Construction d'un modèle à partir de données
    méthode / method (texte exact)     : Exemples guidés et exercices de lecture de cycles et de schémas
    livrable / deliverable (texte exact): Carte méthode énergie et métabolisme
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)
    ⚠ SIGNAL FACTUEL (relecture manuelle, non corrigé) : Titre "Dynamique interne de la Terre" (topics : structure du globe, plaques) mais deliverable "Carte méthode énergie et métabolisme" — thème énergie/métabolisme sans rapport apparent avec la géologie du titre.

  Séance 3 — titre exact : Écosystèmes et services environnementaux
    objectif (texte exact)             : Analyser le fonctionnement d'un écosystème et les effets d'une action humaine
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Interactions et flux dans un écosystème
      - Dynamique et résilience
      - Services écosystémiques
      - Gestion et impacts des activités humaines
    méthode / method (texte exact)     : Schémas commentés et petits problèmes d’hérédité
    livrable / deliverable (texte exact): Fiche de synthèse génétique avec exercices corrigés
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)
    ⚠ SIGNAL FACTUEL (relecture manuelle, non corrigé) : Titre "Écosystèmes et services environnementaux" (topics : écosystème, résilience, services écosystémiques) mais method "petits problèmes d'hérédité" et deliverable "Fiche de synthèse génétique" — thème génétique sans rapport apparent avec l'écologie du titre.

  Séance 4 — titre exact : Variation génétique, santé et immunité
    objectif (texte exact)             : Relier variation génétique et fonctionnement du système immunitaire à des enjeux de santé
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Variation génétique et santé
      - Immunité innée et adaptative
      - Mémoire immunitaire
      - Argumentation à partir de données
    méthode / method (texte exact)     : Lecture de documents puis construction de réseaux et de cycles
    livrable / deliverable (texte exact): Fiche écologie et interactions corrigée
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)
    ⚠ SIGNAL FACTUEL (relecture manuelle, non corrigé) : Titre "Variation génétique, santé et immunité" (topics cohérents : génétique/immunité) mais deliverable "Fiche écologie et interactions" — thème écologie sans rapport apparent avec génétique/immunité.

  Séance 5 — titre exact : Méthodes transversales sur les trois thèmes officiels
    objectif (texte exact)             : Lire des documents et rédiger une réponse argumentée mobilisant les trois thèmes
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Lecture de documents SVT
      - Gestion du temps
      - Rédaction scientifique
      - Vérification des résultats
    méthode / method (texte exact)     : Sujet d’entraînement chronométré puis correction critériée
    livrable / deliverable (texte exact): Sujet SVT corrigé et grille personnelle de vigilance
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

Ligne de conformité programme officiel (content/pre-rentree-2026/official-programme-matrix.fr.json → rows[] où moduleId == "premiere-svt") :
  moduleId              : premiere-svt
  officialProgrammeId   : BO2019-LYCEE-SVT-PREMIERE
  applicationSchoolYear : 2026-2027
  alignmentSummary (texte exact) : DRAFT : priorités réparties sur les trois thèmes officiels du BO 2019 ; validation d'un enseignant SVT qualifié requise.
  publicOfferEligible   : False

  Source officielle référencée (officialSources["BO2019-LYCEE-SVT-PREMIERE"]) :
    title (texte exact) : Programme de sciences de la vie et de la Terre (spécialité) de Première générale
    url (texte exact)   : https://www.education.gouv.fr/au-bo-special-du-22-janvier-2019-programmes-d-enseignement-du-lycee-general-et-technologique-455475
    publisher           : Ministère de l'Éducation nationale
    applicationNote (texte exact) : Programme en vigueur pour l'année scolaire 2026-2027. Publié au BO spécial n°1 du 22 janvier 2019 (programmes de Première), et non au BO spécial n°8 du 25 juillet 2019 qui ne couvre que la Terminale.

------------------------------------------------------------------------------------------

=== TERMINALE-SVT ===
Fichier + chemin exact : content/pre-rentree-2026/modules.json → modules[] où id == "terminale-svt"
Titre (champ `title`)  : SVT — Entrée en Terminale
Sous-titre (champ `subtitle`) : Nexus Premium — cibler les attendus de Terminale et consolider les méthodes de la spécialité
Niveau (champ `level`) : TERMINALE
Matière (champ `subjectId`) : SVT
Matière (champ `subject`)   : SVT
publicationStatus (exact)   : DRAFT_PENDING_QUALIFIED_TEACHER_VALIDATION

Champs bruts du module (copie exacte, tous les champs présents ou absents dans le JSON) :
  objective       : Sélectionner des priorités et méthodes dans les trois thèmes officiels du programme de spécialité SVT de Terminale ; validation d'un enseignant SVT qualifié requise avant publication.
  prerequisites   : Les acquis de Première en SVT : organisation du vivant, génétique, énergie et écologie ; le test flash précise les domaines à renforcer.
  differentiation : Exercices organisés par domaine et par palier pour réactiver les raisonnements attendus en Terminale.
  quickAssessment : Une consigne courte de lecture, schéma ou raisonnement vérifie l’objectif de chaque séance.
  equipment       : Calculatrice scientifique simple recommandée, non obligatoire sauf consigne de l'enseignant.

Nombre de séances trouvées : 5 (conforme : 5 séances)

Contenu intégral des séances (copie exacte, champ par champ, source = modules.json) :

  Séance 1 — titre exact : Génétique et évolution
    objectif (texte exact)             : Réactiver les mécanismes moléculaires, la variabilité et les grandeurs évolutives
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Expression du génome
      - Régulation génique
      - Mutations et variation
      - Dynamique des populations
    méthode / method (texte exact)     : Schémas et petits problèmes numériques guidés
    livrable / deliverable (texte exact): Fiche génétique-évolution corrigée
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 2 — titre exact : À la recherche du passé géologique
    objectif (texte exact)             : Mobiliser chronologie et indices géologiques pour reconstituer une histoire
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Chronologie relative
      - Datation absolue
      - Traces du passé tectonique
      - Lecture de cartes et documents géologiques
    méthode / method (texte exact)     : Lecture de schémas et exercices de raisonnement
    livrable / deliverable (texte exact): Fiche métabolisme et énergie corrigée
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)
    ⚠ SIGNAL FACTUEL (relecture manuelle, non corrigé) : Titre "À la recherche du passé géologique" (topics : chronologie, datation, tectonique) mais deliverable "Fiche métabolisme et énergie" — thème métabolisme/énergie sans rapport apparent avec la géologie du titre.

  Séance 3 — titre exact : Plantes, climat et enjeux contemporains
    objectif (texte exact)             : Relier fonctionnement des plantes, domestication et compréhension des climats
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Organisation fonctionnelle des plantes
      - Reproduction et domestication
      - Reconstitution et évolution des climats
      - Argumentation sur les actions possibles
    méthode / method (texte exact)     : Lecture de documents et construction d’arguments
    livrable / deliverable (texte exact): Fiche écologie et durabilité corrigée
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

  Séance 4 — titre exact : Mouvement, énergie et stress
    objectif (texte exact)             : Relier système nerveux, muscle, apport d'énergie et réponse au stress
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Commande du mouvement
      - Contraction musculaire
      - ATP et apport d'énergie
      - Réponse au stress et régulation
    méthode / method (texte exact)     : Comparaison de schémas et problèmes de transmission
    livrable / deliverable (texte exact): Fiche patrimoine génétique corrigée
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)
    ⚠ SIGNAL FACTUEL (relecture manuelle, non corrigé) : Titre "Mouvement, énergie et stress" (topics cohérents : mouvement/ATP/stress) mais deliverable "Fiche patrimoine génétique" — thème génétique sans rapport apparent avec mouvement/énergie/stress.

  Séance 5 — titre exact : Méthodes transversales sur les trois thèmes officiels
    objectif (texte exact)             : Organiser ses connaissances et traiter un exercice mobilisant plusieurs thèmes
    notions / notionsClés (texte exact, liste complète, 4 élément(s)) :
      - Lecture de documents complexes
      - Raisonnement à plusieurs niveaux
      - Rédaction scientifique
      - Gestion du temps
    méthode / method (texte exact)     : Sujet d’entraînement chronométré puis correction critériée
    livrable / deliverable (texte exact): Sujet SVT corrigé et plan d’action rentrée
    Autres champs (durée, etc.) : (champ absent — aucun autre champ que number/title/objective/topics/method/deliverable n'existe sur cette séance)

Ligne de conformité programme officiel (content/pre-rentree-2026/official-programme-matrix.fr.json → rows[] où moduleId == "terminale-svt") :
  moduleId              : terminale-svt
  officialProgrammeId   : BO2019-LYCEE-SVT-TERMINALE
  applicationSchoolYear : 2026-2027
  alignmentSummary (texte exact) : DRAFT : priorités réparties sur les trois thèmes officiels du BO 2019, dont une séance dédiée au corps humain et à la santé ; validation d'un enseignant SVT qualifié requise.
  publicOfferEligible   : False

  Source officielle référencée (officialSources["BO2019-LYCEE-SVT-TERMINALE"]) :
    title (texte exact) : Programme de sciences de la vie et de la Terre (spécialité) de Terminale générale
    url (texte exact)   : https://www.education.gouv.fr/bo/19/Special8/MENE1921252A.htm
    publisher           : Ministère de l'Éducation nationale
    applicationNote (texte exact) : Programme en vigueur pour l'année scolaire 2026-2027. Publié au BO spécial n°8 du 25 juillet 2019 (programmes de Terminale).

------------------------------------------------------------------------------------------

==========================================================================================
SYNTHÈSE DES SIGNAUX FACTUELS (à vérifier par la direction — rien n'a été corrigé)
==========================================================================================

Structure (nombre de séances, champs) : conforme sur les 9 modules — 5 séances chacun,
aucun champ manquant hors equipment/objective (attendus absents sur Français/PC/NSI, ce
ne sont pas des champs requis à ce niveau — cf. audit maths/SVT précédent).

Français, Physique-Chimie, NSI : aucune incohérence apparente titre/contenu relevée à la
relecture directe (le vocabulaire des livrables diffère parfois du titre sans rupture
thématique — ex. "stœchiométrie" -> "tableau d'avancement", qui en est la méthode).

SVT (Première et Terminale) : 5 signaux relevés, reproduisant le constat déjà documenté
dans DEBTS.md — le contenu SVT reste DRAFT (publicationStatus = 
DRAFT_PENDING_QUALIFIED_TEACHER_VALIDATION sur les 2 modules), non corrigé ici par décision
explicite (la réécriture relève d'un enseignant SVT qualifié) :
  - premiere-svt séance 2 : Titre "Dynamique interne de la Terre" (topics : structure du globe, plaques) mais deliverable "Carte méthode énergie et métabolisme" — thème énergie/métabolisme sans rapport apparent avec la géologie du titre.
  - premiere-svt séance 3 : Titre "Écosystèmes et services environnementaux" (topics : écosystème, résilience, services écosystémiques) mais method "petits problèmes d'hérédité" et deliverable "Fiche de synthèse génétique" — thème génétique sans rapport apparent avec l'écologie du titre.
  - premiere-svt séance 4 : Titre "Variation génétique, santé et immunité" (topics cohérents : génétique/immunité) mais deliverable "Fiche écologie et interactions" — thème écologie sans rapport apparent avec génétique/immunité.
  - terminale-svt séance 2 : Titre "À la recherche du passé géologique" (topics : chronologie, datation, tectonique) mais deliverable "Fiche métabolisme et énergie" — thème métabolisme/énergie sans rapport apparent avec la géologie du titre.
  - terminale-svt séance 4 : Titre "Mouvement, énergie et stress" (topics cohérents : mouvement/ATP/stress) mais deliverable "Fiche patrimoine génétique" — thème génétique sans rapport apparent avec mouvement/énergie/stress.

Fin de l'extraction. Aucun fichier, donnée ou test du dépôt n'a été modifié pendant
cette mission — seul EXTRACTION_TOUTES_MATIERES_SOURCE.md a été créé.
