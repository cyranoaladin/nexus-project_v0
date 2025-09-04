Voici la proposition d'une structure pour le Volet 2 du questionnaire, avec des questions spécifiques et des options de réponse.

---

## **Questionnaire Pédagogique (Profil Élève) du Volet 2**

**Objectif :** Obtenir un portrait détaillé de l'élève pour un bilan le plus précis, ciblé et efficace possible, permettant un accompagnement et des recommandations optimisés.

---

### **Section B — Organisation & Gestion du temps (Approfondie)**

*   **B1. Comment planifies-tu ton travail scolaire chaque semaine ?**
    *   `type: "single"`
    *   `options`: ["Planning détaillé (écrit, numérique)", "Organisation mentale (sans support)", "Au jour le jour (selon les urgences)", "Je ne planifie que les évaluations importantes", "J'ai du mal à planifier"]
    *   `required: true`
*   **B2a. Combien d'heures par semaine consacres-tu aux devoirs (hors révisions personnelles) ?**
    *   `type: "single"`
    *   `optionsRef`: "HOURS_WEEK" (ex: ["0 h", "<1 h", "1–3 h", "3–5 h", "5–8 h", ">8 h"])
    *   `required: true`
*   **B2b. Combien d'heures par semaine consacres-tu à tes révisions personnelles ?**
    *   `type: "single"`
    *   `optionsRef`: "HOURS_WEEK"
    *   `required: true`
*   **B2c. En dehors de l'école, combien d'heures consacres-tu à des activités extra-scolaires (sport, art, bénévolat, loisirs numériques) ?**
    *   `type: "single"`
    *   `optionsRef`: "HOURS_WEEK"
    *   `required: true`
*   **B3. À quels moments de la journée es-tu le plus efficace pour travailler ? (Choix multiples, max 2)**
    *   `type: "multi"`
    *   `optionsRef`: "TIME_SLOTS" (ex: ["Matin", "Après-midi", "Soir", "Nuit"])
    *   `max: 2`
*   **B4. Décris ton environnement de travail idéal.**
    *   `type: "text"`
    *   `label`: "Décris ton environnement de travail (calme, présence d'autres personnes, matériel disponible, distractions...) et ce qui t'aide le plus à te concentrer."
    *   `placeholder`: "Ex: Ma chambre, au calme, avec un ordinateur et sans téléphone. Ou: La bibliothèque, avec mes amis."
    *   `maxlength: 400`
*   **B5. Quels outils utilises-tu pour t'organiser et suivre tes tâches ? (Choix multiples, min 0, max 3)**
    *   `type: "multi"`
    *   `optionsRef`: "TOOLS" (ex: ["Agenda numérique (Google Calendar/Apple/Outlook)", "Notion/Trello", "Cahier/fiches papier", "Todoist/Asana", "Agenda scolaire", "Aucun"])
    *   `min: 0`, `max: 3`
*   **B6. Te sens-tu souvent débordé(e) par la quantité de travail ou par les échéances ?**
    *   `type: "likert"`
    *   `scaleRef`: "FREQ4" (ex: ["Jamais", "Rarement", "Souvent", "Très souvent"])
*   **B7. Sommeil moyen par nuit en semaine ?**
    *   `type: "single"`
    *   `options`: ["< 6h", "6h - 7h", "7h - 8h", "> 8h"]
*   **B8. Temps d'écran quotidien (hors travail scolaire) ?**
    *   `type: "single"`
    *   `options`: ["< 1h", "1h - 2h", "2h - 3h", "3h - 4h", "> 4h"]
*   **B9. Décris une journée type où tu te sens productif/ve et une autre où tu es moins efficace. Qu'est-ce qui change ?**
    *   `type: "text"`
    *   `maxlength: 500`

---

### **Section C — Méthodologie & Habitudes d'apprentissage (Approfondie)**

*   **C1. Comment prends-tu tes notes en cours ?**
    *   `type: "single"`
    *   `options`: ["Tout noter mot à mot", "Noter les idées principales et mots-clés", "Compléter mes notes après le cours", "Travailler directement sur le polycopié/manuel", "J'ai du mal à prendre des notes efficaces"]
*   **C2. Quelles sont tes préférences d'apprentissage ? (Choix multiples, max 2)**
    *   `type: "multi"`
    *   `optionsRef`: "VARK" (ex: ["Visuel (schémas, cartes mentales)", "Auditif (écouter, discuter)", "Lire/Écrire (fiches, résumés)", "Kinesthésique (pratiquer, expérimenter)"])
    *   `max: 2`
*   **C3. Quel cycle d'apprentissage te correspond le mieux ? (Choix multiples, max 2)**
    *   `type: "multi"`
    *   `optionsRef`: "KOLB" (ex: ["Expérience concrète (apprendre en faisant)", "Observation réfléchie (apprendre en regardant)", "Conceptualisation abstraite (apprendre en théorisant)", "Expérimentation active (apprendre en testant)"])
    *   `max: 2`
*   **C4. Quelles sont tes stratégies de mémorisation les plus utilisées ? (Choix multiples, max 3)**
    *   `type: "multi"`
    *   `options`: ["Relire/surligner", "Faire des fiches de synthèse/mind maps", "Utiliser des quiz/cartes mémoire (spaced repetition)", "Reformuler/expliquer à quelqu'un", "Faire beaucoup d'exercices d'application", "Faire des associations d'idées/acronymes", "Aucune stratégie particulière"]
    *   `max: 3`
*   **C5. Face à une difficulté ou un blocage dans un exercice, ta première réaction est de…**
    *   `type: "single"`
    *   `options`: ["Persévérer seul(e) longtemps (jusqu'à trouver la solution ou abandonner)", "Changer de méthode ou d'approche", "Demander de l'aide rapidement (prof, ami, famille)", "Passer à autre chose et y revenir plus tard", "Chercher la solution sur internet directement"]
*   **C6. Explique avec tes mots la différence entre "apprendre par cœur" et "comprendre".**
    *   `type: "text"`
    *   `maxlength: 400`
*   **C7. Pour aborder un nouveau chapitre ou une matière complexe, quelles étapes suis-tu généralement ?**
    *   `type: "text"`
    *   `placeholder`: "Ex: lire le cours → résumer les points clés → faire les exercices → me tester → révision finale..."
    *   `maxlength: 400`
*   **C8. Je suis capable de m'auto-évaluer (me tester, relire mes erreurs, ajuster mes méthodes de travail).**
    *   `type: "likert"`
    *   `scaleRef`: "AGREE5" (ex: ["Pas du tout d'accord", "Plutôt pas d'accord", "Neutre", "Plutôt d'accord", "Tout à fait d'accord"])
*   **C9. Je me sens capable de prendre du recul sur ma copie d'évaluation pour comprendre mes erreurs.**
    *   `type: "likert"`
    *   `scaleRef`: "AGREE5"
*   **C10. Je crois que mes capacités intellectuelles peuvent se développer avec le travail et l'effort (état d'esprit de croissance).**
    *   `type: "likert"`
    *   `scaleRef`: "AGREE5"

---

### **Section D — Motivation & Projection (Approfondie)**

*   **D1. Ce qui te motive le plus dans tes études (choisir jusqu'à 2)**
    *   `type: "multi"`
    *   `options`: ["Obtenir de bonnes notes / la mention au Bac", "Faire plaisir à mes parents / professeurs", "Le plaisir d'apprendre et de comprendre", "Un projet précis (études supérieures, métier)", "Dépasser mes propres limites / me challenger", "Autre"]
    *   `max: 2`
*   **D1b. Si "Autre", précise ce qui te motive.**
    *   `type: "text"`
    *   `visibleIf`: {"D1": "Autre"}
    *   `maxlength: 250`
*   **D2. Mon niveau de motivation actuel pour mes études.**
    *   `type: "likert"`
    *   `scaleRef`: "MOTIV5" (ex: ["Très faible", "Faible", "Moyenne", "Bonne", "Très élevée"])
*   **D3. Mon projet après le Bac (idées de filières, d'études supérieures, de métiers, concours envisagés).**
    *   `type: "text"`
    *   `placeholder`: "Ex: Intégrer une école d'ingénieurs, faire une licence de droit, passer un concours d'entrée à une école de commerce, devenir médecin..."
    *   `maxlength: 500`
*   **D4. Y a-t-il une matière ou une activité scolaire que tu apprécies particulièrement ? Si oui, pourquoi ?**
    *   `type: "text"`
    *   `maxlength: 300`
*   **D5. Comment imagines-tu tes études supérieures et ta vie professionnelle idéale ?**
    *   `type: "text"`
    *   `maxlength: 400`

---

### **Section E — Ressenti Personnel & Confiance (Approfondie)**

*   **E1. Après une mauvaise note ou un échec, ta première réaction est de…**
    *   `type: "single"`
    *   `options`: ["Analyser mes erreurs pour comprendre ce qui n'a pas fonctionné", "Mettre en cause l'épreuve, la notation ou le professeur", "Éviter d'y penser et passer à autre chose", "Perdre confiance dans la matière ou mes capacités", "Demander de l'aide et un accompagnement immédiat"]
*   **E2. Quelle est ta facilité à demander de l'aide quand tu es en difficulté ?**
    *   `type: "single"`
    *   `options`: ["Oui, facilement à tous (profs, amis, famille, soutien externe)", "Seulement à certaines personnes de confiance", "Rarement, j'essaie de me débrouiller seul(e)", "Jamais, j'ai du mal à demander de l'aide"]
*   **E3. Mon niveau de confiance scolaire général (dans mes capacités à réussir).**
    *   `type: "likert"`
    *   `scaleRef`: "CONF4" (ex: ["Faible", "Moyenne", "Bonne", "Très bonne"])
*   **E4. Le stress ressenti avant et pendant les évaluations.**
    *   `type: "likert"`
    *   `scaleRef`: "STRESS5" (ex: ["Très faible", "Faible", "Modéré", "Élevé", "Très élevé"])
*   **E5. Quelles sont les ressources d'aide que tu utilises déjà pour tes études ? (Choix multiples, max 4)**
    *   `type: "multi"`
    *   `optionsRef`: "HELP_CHANNELS" (ex: ["Mes professeurs", "Ma famille", "Mes amis/pairs", "L'IA ARIA de Nexus", "Soutien scolaire extérieur (cours particuliers/stages)", "Manuels/sites internet", "Aucune ressource formelle"])
    *   `max: 4`
*   **E6. Quel rôle jouent tes parents dans ton accompagnement scolaire ?**
    *   `type: "single"`
    *   `options`: ["Très impliqués (suivi quotidien, aide aux devoirs)", "Soutien général (encouragements, vérification des notes)", "Autonomie totale (je gère seul(e))", "Peu impliqués ou indisponibles"]
*   **E7. As-tu déjà utilisé l'IA ARIA de Nexus Réussite ?**
    *   `type: "single"`
    *   `optionsRef`: "YES_NO"
*   **E7b. Si oui, dirais-tu que notre plateforme t'aide à progresser efficacement ?**
    *   `type: "likert"`
    *   `scaleRef`: "AGREE5"
    *   `visibleIf`: {"E7": "Oui"}

---

### **Section F — Contexte Environnemental & Spécificités (Approfondie)**

*   **F1. À la maison, je dispose de… (Choix multiples, max 4)**
    *   `type: "multi"`
    *   `options`: ["Un espace calme et dédié au travail", "Un ordinateur adapté et performant", "Une connexion internet stable et rapide", "Un soutien familial disponible si besoin", "Un accès facile à des ressources (bibliothèque, manuels)", "Aucun de ces éléments"]
    *   `max: 4`
*   **F2. Y a-t-il des contraintes particulières qui impactent ton organisation scolaire ?**
    *   `type: "multi"`
    *   `optionsRef`: "CONSTRAINTS" (ex: ["Sport-études", "Activité artistique intensive", "Engagement associatif important", "Situation familiale particulière (garde alternée, aide aux frères/sœurs)", "Problèmes de santé réguliers", "Travail rémunéré", "Aucune contrainte majeure"])
    *   `min: 0`
*   **F2b. Si oui, merci de préciser la nature de cette/ces contrainte(s) (horaires, déplacements, compétitions, responsabilités, etc.).**
    *   `type: "text"`
    *   `visibleIf`: {"F2": ["Sport-études", "Activité artistique intensive", "Engagement associatif important", "Situation familiale particulière", "Problèmes de santé réguliers", "Travail rémunéré"]}
    *   `maxlength: 400`
*   **F3. Es-tu scolarisé(e) dans un lycée français (en France ou à l'étranger AEFE) ou es-tu candidat libre/CNED ?**
    *   `type: "single"`
    *   `optionsRef`: "ESTABLISHMENT" (ex: ["Lycée français (France)", "Lycée AEFE (étranger)", "Candidat libre / CNED", "Autre type d'établissement"])
    *   `required: true`
*   **F4. Ton établissement scolaire t'offre-t-il un accompagnement spécifique ou une flexibilité pour tes contraintes (ex: aménagements, cours à distance, soutien) ?**
    *   `type: "single"`
    *   `optionsRef`: "YES_NO"
*   **F5. As-tu déjà bénéficié de soutien scolaire extérieur (cours particuliers, stages, aide aux devoirs) ? Si oui, qu'en as-tu retiré ?**
    *   `type: "text"`
    *   `maxlength: 300`

---

### **Section G — Dépistage (Auto-évaluation, non médical - Approfondie)**

*   **G1. Je dois relire plusieurs fois une phrase ou un paragraphe pour bien le comprendre.**
    *   `type: "likert"`
    *   `scaleRef`: "FREQ4" (ex: ["Jamais", "Rarement", "Souvent", "Très souvent"])
*   **G2. Je confonds régulièrement des lettres proches (ex: b/d, p/q) ou des chiffres, ou j'inverse des syllabes lors de la lecture ou l'écriture.**
    *   `type: "likert"`
    *   `scaleRef`: "FREQ4"
*   **G3. Mon écriture manuscrite est souvent difficilement lisible, même pour moi-même.**
    *   `type: "likert"`
    *   `scaleRef`: "FREQ4"
*   **G4. J'ai du mal à rester concentré(e) sur une tâche scolaire pendant plus de 15-20 minutes d'affilée sans être distrait(e).**
    *   `type: "likert"`
    *   `scaleRef`: "FREQ4"
*   **G5. J'oublie fréquemment des consignes données oralement, même si elles sont simples.**
    *   `type: "likert"`
    *   `scaleRef`: "FREQ4"
*   **G6. J'ai de grandes difficultés à structurer mes idées lorsque je dois rédiger un texte (dissertation, commentaire, rapport, code).**
    *   `type: "likert"`
    *   `scaleRef`: "FREQ4"
*   **G7. Je me sens agité(e) ou incapable de rester en place pendant les cours ou les périodes de travail.**
    *   `type: "likert"`
    *   `scaleRef`: "FREQ4"
*   **G8. J'ai du mal à passer d'une tâche à l'autre ou à organiser mes affaires.**
    *   `type: "likert"`
    *   `scaleRef`: "FREQ4"

---

### **Section H — Synthèse Automatique (Calcul d'Indices - Enrichie)**

Les indices existants sont très pertinents. Nous allons les compléter avec de nouveaux indices pour affiner le profil.

*   **IDX_AUTONOMIE :** "Autonomie d'apprentissage" (Basé sur C8, C9, H1, H2, D2, E2).
    *   **Formula :** `mean(mapLikert(AGREE5, [C8, C9, H1, H2]), mapLikert(AGREE5, [D2]), mapLikert(YES_NO, [E2]) / 5 * 4)` (ajuster la pondération de E2)
    *   **Interpretation :** Affiner les tranches.
*   **IDX_ORGANISATION :** "Organisation & gestion du temps" (Basé sur B1, B2a, B2b, B2c, B5, B6, B7, B8, B9, B3).
    *   **Formula :** `scorePlanning(B1) + scoreHours([B2a, B2b, B2c]) + scoreTools(B5) + scoreSleep(B7) - scoreScreen(B8) + scoreProductiveTime(B3)` (nécessite des fonctions d'évaluation `scoreX`).
    *   **Interpretation :** Affiner les tranches.
*   **IDX_MOTIVATION :** "Motivation et Engagement" (Basé sur D1, D2, D3, D4, D5).
    *   **Formula :** `mean(mapLikert(MOTIV5, [D3]), scoreMotivationFactor(D1), mapLikert(AGREE5, [C10]))`
    *   **Interpretation :** Affiner les tranches.
*   **IDX_STRESS :** "Gestion du Stress aux Évaluations" (Basé sur E1, E4).
    *   **Formula :** `mean(mapLikert(STRESS5, [E4]), scoreReactionToFailure(E1))`
    *   **Interpretation :** Affiner les tranches.
*   **IDX_CONCENTRATION :** "Capacités d'Attention et Concentration" (Nouveau ! Basé sur G4, G5, B4, B9).
    *   **Formula :** `mean(mapLikert(FREQ4, [G4, G5]), scoreEnvironment(B4), scoreProductivity(B9))`
    *   **Interpretation :** [0,1.5] Très bonne ; ]1.5,2.5] À surveiller ; ]2.5,4] Nécessite un entraînement spécifique.
*   **IDX_MEMORISATION :** "Efficacité de la Mémorisation" (Nouveau ! Basé sur C4, C1).
    *   **Formula :** `mean(scoreMemorizationStrategies(C4), scoreNoteTaking(C1))`
    *   **Interpretation :** [0,1.5] À développer ; ]1.5,2.5] Stratégies existantes ; ]2.5,4] Stratégies efficaces.
*   **IDX_ANALYSE_SYNTHESE :** "Capacités d'Analyse et de Synthèse" (Nouveau ! Basé sur C6, C7, G6).
    *   **Formula :** `mean(scoreComprehension(C6), scoreChapterApproach(C7), mapLikert(FREQ4, [G6]))`
    *   **Interpretation :** [0,1.5] À renforcer ; ]1.5,2.5] Correcte ; ]2.5,4] Très bonne.
*   **IDX_SUSPECT_DYS :** "Signaux d'Alerte DYS/TDAH (Auto-perçus)" (Basé sur G1 à G8).
    *   **Formula :** `mean(mapLikert(FREQ4, [G1,G2,G3,G4,G5,G6,G7,G8]) )`
    *   **Interpretation :** Affiner les tranches.

---

### **6. Matrice de Décision - Recommandation d'Offres Nexus Réussite (Enrichie)**

Les règles sont affinées pour prendre en compte les nouveaux indices et les spécificités.

**6.1. Variables Analysées (Issues des Indices et Données Brutes) :**
*   `Niveau_Maitrise_Global` (Score académique global %)
*   `Nb_Domaines_Faibles` (Nombre de domaines < 50%)
*   `Autonomie` (IDX_AUTONOMIE)
*   `Motivation` (IDX_MOTIVATION)
*   `Organisation` (IDX_ORGANISATION)
*   `Stress_Eval` (IDX_STRESS)
*   `Concentration` (IDX_CONCENTRATION)
*   `Memorisation` (IDX_MEMORISATION)
*   `Analyse_Synthese` (IDX_ANALYSE_SYNTHESE)
*   `Signaux_DYS` (IDX_SUSPECT_DYS)
*   `Objectif_Affiche` (mention, rattrapage, Parcoursup, Bac candidat libre)
*   `Statut_Eleve` (Scolarisé, Candidat Libre)
*   `Contrainte_Temps` (forte si Sport-études, etc. dans F2)
*   `Ancien_Eleve_ARIA` (si E7 est Oui)

**6.2. Règles de Décision par Offre (Logique Obligatoire) :**

*   **Si `Statut_Eleve` = "Candidat Libre" :**
    → Recommander en priorité : **"Programme Odyssée Candidat Libre"**.

*   **Cas "Élève Autonome et Performant" :**
    *   **Conditions :** `Niveau_Maitrise_Global` ≥ 70% ET `Nb_Domaines_Faibles` ≤ 1 ET `Autonomie` ≥ 3.8/5 ET `Motivation` ≥ 3.8/5.
    *   **Offre principale :** **"Nexus Cortex"**.
    *   **Alternatives :** "Académies Nexus" (pour perfectionnement sur des points précis ou préparation à un concours), "Studio Flex" (pour 1-2 séances d'expertise).

*   **Cas "Besoins Ciblés et Motivation Correcte" :**
    *   **Conditions :** `Niveau_Maitrise_Global` entre 55% et 70% ET `Nb_Domaines_Faibles` ≤ 2 ET `Motivation` ≥ 2.8/5 ET `Organisation` ≥ 5/10.
    *   **Offre principale :** **"Studio Flex"**.
    *   **Alternatives :** "Nexus Cortex" (pour un support quotidien), "Académies Nexus" (pour une révision intensive ponctuelle sur un domaine spécifique).

*   **Cas "Lacunes Multiples ou Préparation Intensive" :**
    *   **Conditions :** `Niveau_Maitrise_Global` entre 40% et 65% ET `Nb_Domaines_Faibles` ≥ 2 (avec certains < 50%) OU `Contrainte_Temps` est forte ET `Objectif_Affiche` inclut "Bac blanc", "EAF", "Grand Oral".
    *   **Offre principale :** **"Académies Nexus"**.
    *   **Alternatives :** "Programme Odyssée" (si le projet est plus global, mention visée ou Parcoursup stratégique), "Studio Flex" (pour des renforts très ciblés avant/après stage).

*   **Cas "Besoin d'Encadrement Complet et Sécurisé" :**
    *   **Conditions :** `Niveau_Maitrise_Global` < 55% OU `Autonomie` < 2.5/5 OU `Motivation` < 2.5/5 OU `Organisation` < 4/10 OU `Stress_Eval` ≥ 4/5 OU `Signaux_DYS` ≥ 2.5/4.
    *   **Offre principale :** **"Programme Odyssée"**.
    *   **Alternatives :** "Studio Flex" (pour des renforts ponctuels en début de parcours si l'élève est réticent à un engagement annuel direct), "Nexus Cortex" (pour un support quotidien en complément).

**Logique de Priorité si plusieurs règles s'appliquent :**
*   "Candidat Libre" > "Besoin d'Encadrement Complet" > "Lacunes Multiples" > "Besoins Ciblés" > "Élève Autonome".

---

### **7. Workflow Intégral : de l'Inscription au Rapport PDF (Rôles & Processus)**

Ce workflow détaille les interactions entre l'utilisateur, l'application et les services ARIA.

1.  **Inscription/Connexion Utilisateur :**
    *   Utilisateur (Parent ou Élève) arrive sur `/bilan-gratuit`.
    *   S'il est nouveau : Création de compte (`User`, `Student`).
    *   S'il est existant : Connexion via NextAuth. Redirection vers `/bilan/initier`.
    *   **Rôles :** `ELEVE`, `PARENT`.

2.  **Initiation du Bilan (`/bilan/initier`) :**
    *   Parent choisit un `Student` existant ou ajoute un nouveau `Student`.
    *   Un nouvel objet `Bilan` est créé dans la DB (`status: PENDING`).
    *   Redirection vers `/bilan/[bilanId]/questionnaire`.

3.  **Remplissage du Questionnaire :**
    *   **Volet 1 (Contexte, `Section A`) :** Rempli par le parent ou l'élève.
    *   **Volet 2 (Profil Pédagogique, `Sections B-G`) :** Rempli par l'élève.
    *   **Soumission :** Les réponses sont enregistrées dans `bilan.pedagoProfile` (JSON) et `bilan.qcmScores` (JSON).

4.  **Calcul des Indices Pré-analysés :**
    *   Après la soumission finale du questionnaire, un endpoint backend calcule les `IDX_` à partir des réponses brutes.
    *   Ces indices sont stockés dans `bilan.synthesis` (JSON) ou une colonne dédiée `bilan.preAnalyzedData`.

5.  **Génération du Texte du Rapport Complet (`reportText`) :**
    *   **Déclencheur :** Automatique après le calcul des indices, ou via un bouton sur le dashboard.
    *   **API :** `POST /api/bilan/generate-report-text` (Corps : `{ bilanId }`).
    *   **Logique :** Récupère toutes les données brutes du bilan, construit le prompt détaillé, appelle OpenAI (`gpt-4o`), et stocke le `reportText` dans `bilan.reportText` (DB). `bilan.status` passe à `GENERATED`.
    *   **Validation :** Si `reportText` est vide ou erroné, `bilan.status` passe à `ERROR`.
    *   **Rôles :** `ELEVE`, `PARENT` (pour déclencher) ou `ADMIN`, `ASSISTANTE` (pour supervision).

6.  **Génération du Texte de la Synthèse (1 page `summaryText`) :**
    *   **Déclencheur :** Simultanément à l'étape 5, ou après.
    *   **API :** `POST /api/bilan/generate-summary-text` (Corps : `{ bilanId }`).
    *   **Logique :** Utilise un prompt spécifique pour la synthèse, appelle OpenAI (`gpt-4o-mini`), et stocke `summaryText` dans `bilan.summaryText` (DB).

7.  **Visualisation et Actions sur le Dashboard (`/dashboard/eleve/bilan/[bilanId]`) :**
    *   La page charge l'objet `bilan` complet (avec `reportText` et `summaryText`).
    *   **Affichage de la Synthèse :** Le composant `BilanSynthese.tsx` utilise `bilan.summaryText`.
    *   **Visualisation du Rapport Complet :** Le composant `app/dashboard/eleve/bilan/[bilanId]/page.tsx` affiche `bilan.reportText`.
    *   **Actions :**
        *   **Téléchargement PDF :** Bouton qui appelle `GET /api/bilan/pdf/[bilanId]?variant=standard|parent|eleve`.
        *   **Envoi par E-mail :** Composant `SendPdfByEmail.tsx` qui appelle `POST /api/bilan/email/[bilanId]`.

8.  **Flux d'Ingestion RAG par le Staff (`/admin/rag`) :**
    *   **Rôles :** `ADMIN`, `ASSISTANTE`, `COACH`.
    *   **UI :** Page `RAG Admin` (Uploader, JobsTable, DocsTable).
    *   **Processus :** Upload de document → `POST /api/rag/upload` → Création `UserDocument` + `IngestJob` → Enqueue job dans BullMQ.
    *   **Worker :** Le `aria_worker_prod` (processus séparé ou inline en dev) exécute `runIngestion` (OCR → Chunk → Embed → Index).
    *   **Statut :** `UserDocument.status` et `IngestJob.status` sont mis à jour en temps réel.

9.  **Chat ARIA (`/eleve/chat`) :**
    *   **Rôles :** `ELEVE`.
    *   **UI :** Interface de chat.
    *   **Processus :** Message de l'élève → `GET /api/context/build` (pour construire le contexte) → `POST /api/aria/chat` (avec message + contexte) → ARIA répond.
    *   **Mémoire :** Les interactions clés sont résumées et stockées comme `Memory` (EPISODIC, SEMANTIC, PLAN).

10. **Génération de Documents Pédagogiques (`/api/aria/generate-document`) :**
    *   **Rôles :** `ELEVE` (pour ses propres documents), `COACH`/`ADMIN` (pour générer des supports).
    *   **UI :** Formulaire de demande de document.
    *   **Processus :** Demande de document (`type`, `subject`, `level`, `goal`) → `POST /api/aria/generate-document` → Pipeline de génération (plan, draft, review, LaTeX, compilation auto-fix) → Stockage PDF (`GeneratedDocument`) → Notification à l'élève.

---

**Fin du Cahier des Charges Complet**

Ce document est votre feuille de route intégrale. Vous devez prendre le meilleur des documents précédents, l'organiser, l'adapter aux besoins d'un projet premium et l'implémenter de A à Z. Assurez-vous de la cohérence de l'ensemble, de la robustesse des solutions techniques, et de la qualité de l'expérience utilisateur.
