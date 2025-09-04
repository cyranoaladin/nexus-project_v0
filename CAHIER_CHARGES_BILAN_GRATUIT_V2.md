## **CAHIER DES CHARGES DÉTAILLÉ – GÉNERATION DU BILAN STRATÉGIQUE NEXUS RÉUSSITE**

**À l'attention de l'Agent IA Cursor (Développement),**

**Objet : Implémentation complète du workflow de génération du Bilan Stratégique PDF (avec OpenAI), incluant la gestion dynamique des questionnaires et des versions de rapports.**

**Contexte du Projet :**
Le Bilan Stratégique est un pilier de l'accompagnement Nexus Réussite, conçu pour offrir un diagnostic précis et des recommandations personnalisées. Ce document formalise le workflow complet de sa génération, depuis l'interface utilisateur jusqu'à la production de rapports PDF de haute qualité, en s'appuyant sur l'expertise de notre agent intelligent (OpenAI) et la logique métier de Nexus Réussite.

Ce cahier des charges intègre les spécifications fonctionnelles, techniques et éditoriales issues de l'ensemble des documents existants, avec un accent particulier sur la gestion dynamique des questionnaires et la qualité des livrables.

---

### **1. Philosophie et Objectifs du Bilan Stratégique Nexus Réussite**

Le Bilan Stratégique de Nexus Réussite est une évaluation experte et un **levier d'accompagnement** fondamental. Il vise à fournir une compréhension approfondie des acquis, des compétences et du profil d'apprentissage de chaque élève, afin de construire un plan de progression clair et des recommandations d'accompagnement sur-mesure.

**Notre ADN Nexus Réussite :**

* **L'Excellence de nos Experts :** Une équipe de professeurs agrégés, certifiés et spécialistes de l'Éducation Nationale française, reconnus pour leur pédagogie active et bienveillante.
* **L'Innovation au Service de l'Apprentissage :** Une plateforme analytique de pointe et un agent intelligent pour un diagnostic précis et un suivi individualisé.
* **La Garantie de Résultats :** Des engagements clairs, incluant la "Garantie Bac obtenu ou remboursé" (sous conditions), pour sécuriser l'investissement et rassurer les familles.

Le rapport final doit être **premium, crédible, rassurant, professionnel et hautement personnalisé**, reflétant l'image d'excellence de Nexus Réussite et stimulant l'engagement de l'élève et de ses parents.

---

### **2. Sources et Structuration des Données pour le Bilan**

Les données brutes pour l'analyse proviendront de trois sources principales, structurées pour le prompt OpenAI :

1. **Données d'Identification et de Contexte Élève/Parent :**
    * `eleve.firstName`, `eleve.lastName`, `eleve.niveau` (Première, Terminale), `eleve.matiere` (Maths, NSI), `eleve.statut` (Scolarisé, Candidat Libre), `eleve.etablissement`, `eleve.plan_accompagnement`, `eleve.suivi_specialiste`.
    * `parent.email` (si disponible et différent de `eleve.email`).
    * Ces données seront initialisées à l'inscription/connexion et complétées par le Volet 1 du questionnaire.

2. **Réponses au Questionnaire (Deux Volets Dynamiques) :**
    * **Volet 1 (Connaissances & Compétences) :** Questions à choix multiples (QCM) spécifiques à la matière et au niveau de l'élève.
        * **Sources des questions :** Documents JSON dédiés (`data/qcm_terminale_nsi.json`, `data/qcm_premiere_nsi.json`, `data/qcm_terminale_maths.json`, `data/qcm_premiere_maths.json`).
        * **Structure des réponses :** Objet `{ "Q1": index_choisi, "Q2": index_choisi, ... }`.
    * **Volet 2 (Profil Pédagogique & Personnel) :** Questionnaire structuré (questions à choix multiples, likert, texte libre) commun à tous les élèves.
        * **Source des questions :** Document `CAHIER_CHARGES_BILAN_VOLET2.md` (qui sera converti en JSON `data/pedago_survey_commun.json`).
        * **Structure des réponses :** Objet `{ "B1": index_choisi, "B4": "texte libre", ... }`.

3. **Calculs Pré-Analysés & Indices :**
    * **Scores QCM :** Calculés par domaine de compétences (ex: "Algorithmique", "Analyse") et pourcentage de maîtrise global, avec identification des acquis solides (> 70%) et des axes de progression (< 50%).
    * **Lacunes Critiques :** Identification des connaissances fondamentales (ex: de Seconde) absolument nécessaires pour réussir le niveau supérieur.
    * **Indices Synthétiques :** Calcul des indices `IDX_AUTONOMIE`, `IDX_ORGANISATION`, `IDX_MOTIVATION`, `IDX_STRESS`, `IDX_CONCENTRATION`, `IDX_MEMORISATION`, `IDX_ANALYSE_SYNTHESE`, `IDX_SUSPECT_DYS` à partir des réponses du Volet 2.
    * Ces calculs seront effectués côté backend et serviront de `pre_analyzed_data` pour le prompt OpenAI.

---

### **3. Gestion Dynamique des Questionnaires (Volet 1 & 2)**

La page `/bilan-gratuit` doit offrir une expérience fluide et adaptée, en distinguant les élèves qui passent leur premier bilan de ceux qui souhaitent un bilan dans une nouvelle matière.

**3.1. Workflow Initial (`/bilan-gratuit` et `/bilan/initier`) :**

* **Nouvel utilisateur ou premier bilan :**
    1. Redirection vers `/bilan/initier` après inscription/connexion.
    2. Sur `/bilan/initier`, l'utilisateur (Parent) sélectionne l'élève (ou en crée un nouveau) et choisit la **matière** et le **niveau** pour le bilan.
    3. L'application démarre un nouveau `Bilan` en DB (`status: PENDING`).
    4. Redirection vers `/bilan/[bilanId]/questionnaire`.
* **Utilisateur existant (déjà un bilan complété) et veut un nouveau bilan dans une autre matière :**
    1. Sur `/bilan/initier`, l'utilisateur sélectionne l'élève et la **nouvelle matière** et le **niveau**.
    2. L'application démarre un nouveau `Bilan` en DB (`status: PENDING`).
    3. **Les réponses du Volet 2 du premier bilan complété par cet élève doivent être récupérées et associées à ce nouveau `Bilan`.**
    4. Redirection vers `/bilan/[bilanId]/questionnaire`.

**3.2. Affichage du Questionnaire (`/bilan/[bilanId]/questionnaire`) :**
Le composant de questionnaire doit adapter son contenu.

* **Si c'est le premier bilan de l'élève (ou si les données du Volet 2 ne sont pas encore présentes) :**
  * Afficher d'abord le **Volet 1 (QCM)** spécifique à la matière/niveau choisie.
  * Puis, afficher le **Volet 2 (Profil Pédagogique Commun)**, en utilisant les questions définies dans `CAHIER_CHARGES_BILAN_VOLET2.md`.
  * Messages clairs pour le parent/élève sur qui doit remplir quoi (voir `CAHIER_CHARGES_BILAN_GRATUIT.md` - Phase 3).
* **Si l'élève a déjà un bilan complété (donc Volet 2 déjà répondu) :**
  * Afficher **UNIQUEMENT le Volet 1 (QCM)** spécifique à la nouvelle matière/niveau.
  * Le système utilisera les réponses du Volet 2 précédemment enregistrées.
* **Navigation & Sauvegarde :**
  * Possibilité de sauvegarder la progression à chaque étape et de reprendre plus tard.
  * Validation des champs `required`.

**3.3. Stockage des Questions et Réponses :**

* **Questions QCM (Volet 1) :** Les fichiers JSON des QCM (`data/qcm_*.json`) seront chargés dynamiquement en fonction de la matière et du niveau.
* **Questions Volet 2 :** Le fichier JSON `data/pedago_survey_commun.json` (issu de `CAHIER_CHARGES_BILAN_VOLET2.md`) sera chargé.
* **Réponses en DB :** Les réponses brutes de chaque volet seront stockées dans le modèle `Bilan` (ex: `bilan.qcmRawAnswers` et `bilan.pedagoRawAnswers`).

---

### **4. Le Prompt Détaillé pour l'Agent Intelligent (OpenAI) – Texte du Rapport**

Cet agent sera appelé via `POST /api/bilan/generate-report-text` pour générer le texte complet du rapport.

**Agent ID (Interne) :** ARIA
**Modèle OpenAI :** `gpt-4o` (pour une qualité optimale en production, `gpt-4o-mini` pour le développement).

```txt
Tu es un expert pédagogique, psychopédagogue et stratège éducatif de Nexus Réussite.
Ta mission est d'analyser les résultats d'un élève (bilan de compétences scolaires + questionnaire de profil d'apprentissage et personnel) et de rédiger un rapport de bilan stratégique complet, professionnel et structuré, destiné à l'élève et à ses parents.

**Ton rôle incarne l'expertise de Nexus Réussite :**
- La bienveillance et la pédagogie active de nos professeurs agrégés et certifiés.
- La précision analytique de notre plateforme pour un diagnostic juste.
- La capacité à proposer des stratégies de progression concrètes et adaptées.

---

## Données brutes de l’élève à analyser :

```json
{
  "eleve": {
    "prenom": "Anna",
    "nom": "Durand",
    "niveau": "Terminale",
    "matiere": "Mathématiques Spécialité",
    "statut": "Scolarisé",
    "etablissement": "Lycée Henri IV (France)",
    "plan_accompagnement": "Aucun",
    "suivi_specialiste": "Non",
    "objectifs_eleve_parent": "Obtenir la mention Bien au Bac, intégrer une école d'ingénieurs post-Bac via Parcoursup."
  },
  "qcmScores": {
    "global_mastery_percent": 62,
    "by_domain": {
      "Algorithmique": {"percent": 75, "points": 15, "max": 20, "feedback": "Acquis solides, notamment sur les boucles et conditions."},
      "Analyse": {"percent": 45, "points": 9, "max": 20, "feedback": "Notions de limites et de dérivées à consolider."},
      "Géométrie": {"percent": 80, "points": 16, "max": 20, "feedback": "Maîtrise excellente des vecteurs et géométrie dans l'espace."},
      "Probabilités": {"percent": 50, "points": 10, "max": 20, "feedback": "Axes de progression sur les probabilités conditionnelles."}
    },
    "critical_lacunes": ["Fonctions affines et du second degré (Seconde)", "Calcul littéral et équations (Seconde)"]
  },
  "pedagoProfile": {
    "style_apprentissage": "Visuel/Kinesthésique",
    "organisation_travail": "Organisation mentale (sans planning précis), parfois débordé",
    "rythme_travail_efficace": "Soir",
    "motivation_actuelle": "Moyenne",
    "rapport_erreur": "Analyse les erreurs",
    "confiance_scolaire": "Bonne",
    "stress_evaluations": "Modéré",
    "difficultes_declarees": "Manque de concentration ponctuel, difficulté à structurer les rédactions",
    "signaux_dys_tdah_auto_evalue": "Faible (pas de signal fort)",
    "support_familial": "Soutien général",
    "outils_organisation": ["Agenda numérique", "Cahier/fiches papier"],
    "preferences_activites": "J'apprécie les matières où je peux développer ma logique et résoudre des problèmes."
  },
  "pre_analyzed_data": {
    "IDX_AUTONOMIE": 3.2, // sur 5
    "IDX_ORGANISATION": 5.5, // sur 10
    "IDX_MOTIVATION": 3, // sur 5
    "IDX_STRESS": 3, // sur 5
    "IDX_CONCENTRATION": 2.8, // sur 4
    "IDX_MEMORISATION": 2.5, // sur 4
    "IDX_ANALYSE_SYNTHESE": 2.9, // sur 4
    "IDX_SUSPECT_DYS": 1.2 // sur 4
  }
}
```

---

## Matrice de décision (Logique obligatoire pour les recommandations d’offres Nexus)

**Les offres à recommander et leur justification doivent impérativement suivre ces règles :**

* **Si `eleve.statut` = "Candidat Libre" :**
    → Recommander en priorité : **"Programme Odyssée Candidat Libre"**.

* **Cas "Élève Autonome et Performant" :**
  * **Conditions :** `qcmScores.global_mastery_percent` ≥ 70% ET `qcmScores.Nb_Domaines_Faibles` ≤ 1 ET `pre_analyzed_data.IDX_AUTONOMIE` ≥ 3.8/5 ET `pre_analyzed_data.IDX_MOTIVATION` ≥ 3.8/5.
  * **Offre principale :** **"Nexus Cortex"**.
  * **Alternatives :** "Académies Nexus" (pour perfectionnement sur des points précis ou préparation à un concours), "Studio Flex" (pour 1-2 séances d'expertise ciblée).

* **Cas "Besoins Ciblés et Motivation Adéquate" :**
  * **Conditions :** `qcmScores.global_mastery_percent` entre 55% et 70% ET `qcmScores.Nb_Domaines_Faibles` ≤ 2 ET `pre_analyzed_data.IDX_MOTIVATION` ≥ 2.8/5 ET `pre_analyzed_data.IDX_ORGANISATION` ≥ 5/10.
  * **Offre principale :** **"Studio Flex"**.
  * **Alternatives :** "Nexus Cortex" (pour un support quotidien autonome), "Académies Nexus" (pour une révision intensive ponctuelle sur un domaine spécifique).

* **Cas "Axes de Progression Multiples ou Préparation Intensive" :**
  * **Conditions :** `qcmScores.global_mastery_percent` entre 40% et 65% ET `qcmScores.Nb_Domaines_Faibles` ≥ 2 (avec certains < 50%) OU `eleve.Contrainte_Temps` est forte (si présente) ET `eleve.objectifs_eleve_parent` inclut "Bac blanc", "EAF", "Grand Oral".
  * **Offre principale :** **"Académies Nexus"**.
  * **Alternatives :** "Programme Odyssée" (si le projet est plus global, mention visée ou Parcoursup stratégique), "Studio Flex" (pour des renforts très ciblés avant/après stage).

* **Cas "Besoin d'Encadrement Complet et Sécurisé" :**
  * **Conditions :** `qcmScores.global_mastery_percent` < 55% OU `pre_analyzed_data.IDX_AUTONOMIE` < 2.5/5 OU `pre_analyzed_data.IDX_MOTIVATION` < 2.5/5 OU `pre_analyzed_data.IDX_ORGANISATION` < 4/10 OU `pre_analyzed_data.IDX_STRESS` ≥ 4/5 OU `pre_analyzed_data.IDX_SUSPECT_DYS` ≥ 2.5/4.
  * **Offre principale :** **"Programme Odyssée"**.
  * **Alternatives :** "Studio Flex" (pour des renforts ponctuels en début de parcours si l'élève est réticent à un engagement annuel direct), "Nexus Cortex" (pour un support quotidien autonome en complément).

**Logique de Priorité si plusieurs règles s'appliquent :**

* "Candidat Libre" > "Besoin d'Encadrement Complet" > "Axes de Progression Multiples" > "Besoins Ciblés" > "Élève Autonome et Performant".

---

## Structure attendue du rapport (6 sections)

Le rapport doit être rédigé de manière fluide et professionnelle, **sans mentionner l'intervention d'une intelligence artificielle**. Il s'agit du diagnostic et des recommandations de l'équipe Nexus Réussite.

1. **Introduction Personnalisée :**
    * Présenter l'élève avec bienveillance (Nom, Prénom, niveau scolaire, spécialité, établissement, statut).
    * Rassurer et valoriser ses efforts et sa démarche proactive.
    * Mettre en contexte l'objectif du bilan : comprendre, guider, optimiser ses capacités.

2. **Analyse des Compétences Scolaires (Diagnostic Objectif) :**
    * Diagnostic précis des acquis : identifier les domaines où l'élève possède des **compétences solides** et des **savoir-faire bien maîtrisés** pour la matière et le niveau ciblés.
    * Définir les **axes de progression prioritaires** : détailler les notions précises où un renforcement des connaissances et des capacités est nécessaire.
    * **Indispensable :** Mettre en lumière les **connaissances fondamentales de Seconde (ou Première)** dont la maîtrise est un **levier essentiel** pour la réussite et l'épanouissement en Première/Terminale (ou pour les étapes supérieures). Citer des exemples concrets de lacunes critiques si possible.

3. **Profil d'Apprentissage et Stratégies Personnelles :**
    * Identification du style d'apprentissage dominant de l'élève (visuel, auditif, kinesthésique, cycle de Kolb). Expliquer brièvement ce que cela implique pour sa méthode de travail.
    * Évaluation de l'organisation et du rythme de travail : décrire si ces aspects sont efficaces, nécessitent une amélioration, ou un cadre plus structuré.
    * Analyse des leviers de motivation (intrinsèque, extrinsèque) et du niveau de confiance en soi face aux défis scolaires.
    * Détection des difficultés spécifiques éventuelles : gestion du stress, signaux d'appel potentiels (DYS/TDAH - sans diagnostic ni étiquetage médical), anxiété, ou contraintes spécifiques (emploi du temps chargé, situation familiale).
    * **Synthèse du profil pédagogique :** Résumer comment l'élève apprend le plus efficacement et quels aspects de sa méthodologie sont des **leviers d'amélioration** pour maximiser son potentiel.

4. **Feuille de Route Personnalisée pour la Progression :**
    * **Horizon :** Proposer un plan de progression clair et réaliste sur les 3 à 6 prochains mois.
    * **Planning hebdomadaire :** Recommander un volume horaire hebdomadaire équilibré, en suggérant une répartition entre travail autonome et encadré.
    * **Étapes de progression :** Découper la feuille de route en phases distinctes (ex: consolidation des acquis fondamentaux, approfondissement des compétences clés, entraînements intensifs type Bac/Parcoursup).
    * **Ressources et activités :** Recommandations concrètes de types d'activités et de ressources à privilégier (ex: exercices ciblés sur notre plateforme, séances de coaching personnalisé, vidéos explicatives, participation à des stages intensifs, utilisation d'outils d'organisation).

5. **Recommandations des Offres Nexus Réussite (Solutions Concrètes) :**
    * Proposer **une offre principale** de Nexus Réussite, la plus adaptée au profil, aux résultats et aux objectifs de l'élève (en suivant strictement la matrice de décision ci-dessus).
    * Présenter 1 ou 2 **alternatives ou compléments possibles**, justifiés par des besoins spécifiques ou une évolution future du parcours.
    * **Justification :** Chaque recommandation doit être solidement justifiée par le diagnostic. Mettre en avant les bénéfices concrets pour l'élève (gain de confiance, efficacité, temps) et pour les parents (sécurité, progression assurée, garantie de résultats, accompagnement expert). Valoriser l'alliance de l'expertise de nos professeurs agrégés et de notre plateforme analytique.

6. **Conclusion Motivante :**
    * Message encourageant et mobilisateur pour l'élève, insistant sur sa capacité à progresser et à atteindre ses objectifs avec le bon accompagnement.
    * Message rassurant pour les parents, soulignant la sécurité, le suivi premium et l'investissement pertinent dans un avenir réussi.
    * Invitation claire à planifier une discussion avec un conseiller Nexus Réussite pour détailler le parcours proposé et démarrer l'accompagnement.

---

## Ligne éditoriale du Rapport

* **Ton :** Professionnel, bienveillant, valorisant et résolument premium. Le rapport doit impressionner par sa clarté et rassurer par son expertise.
* **Style :** Clair, fluide, très structuré avec des titres et sous-titres distincts, sans jargon excessif. Adapté à la compréhension des parents et des élèves.
* **Diagnostic :** Rigoureux et objectif, mais formulé avec positivité. Les "faiblesses" sont systématiquement présentées comme des **"axes de progression"** ou des **"leviers d'amélioration"**.
* **Marketing intégré :** Valoriser l'unicité de Nexus (excellence de nos experts, plateforme innovante, garanties) de manière naturelle et non agressive. Montrer la pertinence directe et la valeur ajoutée de chaque offre recommandée pour le profil spécifique de l'élève.
* **Absence d'IA :** Ne jamais mentionner l'intervention d'une intelligence artificielle (ARIA ou autre) dans le texte du rapport final. Le prompt est une instruction interne.
* **Précision des Recommandations :** Les propositions doivent être spécifiques et actionnables (ex: "consolidation des notions de Seconde sur les fonctions pour sécuriser la Première" ; "2h d'exercices hebdomadaires sur les chapitres X et Y, complétées par 1h de coaching en visio sur les démonstrations complexes").

---

### **5. Version Synthétique du Rapport (1 page) – (`bilan.summaryText`)**

Ce prompt est conçu pour générer un aperçu concis, immédiatement compréhensible et percutant, idéal pour un dashboard ou un e-mail de prévisualisation.

```txt
Tu es un expert pédagogique de Nexus Réussite.
Ta mission est de rédiger une **synthèse courte et claire (1 page maximum / environ 350 mots)** du bilan d'un élève, destinée à l'élève et à ses parents. L'objectif est de fournir une vue d'ensemble rapide et motivante.

---

## Structure attendue de la synthèse

1.  **Résumé global (3-4 phrases) :**
    *   Synthèse du niveau général de l'élève (forces clés et principaux axes de progression).
    *   Ton rassurant et encourageant.

2.  **Forces et Acquis :**
    *   Liste courte (2-3 domaines de compétences ou qualités d'apprentissage majeurs).

3.  **Axes de Progression Prioritaires :**
    *   Liste courte (2-3 points cruciaux à travailler, issus des résultats QCM ou du profil d'apprentissage).

4.  **Recommandation Nexus :**
    *   Proposition de l'offre principale (selon la matrice de décision Nexus).
    *   Mention d'une ou deux alternatives possibles (max).
    *   Justification en une phrase concise et percutante.

5.  **Mini-Feuille de Route (3 puces max) :**
    *   Volume horaire hebdomadaire conseillé.
    *   Types d'activités recommandées (ex: exercices sur plateforme, séances de coaching, participation à des stages).
    *   Un objectif clair et mesurable sur les 3 prochains mois.

---

## Ligne éditoriale de la synthèse :

*   **Style :** Clair, synthétique, percutant et rassurant.
*   **Ton :** Premium mais accessible, s'adressant aux parents (aspect sécurité/efficacité) et aux adolescents (motivation/progrès).
*   **Longueur :** Maximum 1 page A4 ou l'équivalent de 350 mots.
*   **Clarté :** Aller droit à l'essentiel, éviter les détails superflus.
*   **Marketing :** Mettre en avant la proposition de valeur Nexus de manière concise et engageante. Ne pas mentionner l'IA.

---

## Données à analyser (pour la synthèse) :

-   `eleve` (prenom, nom, niveau, matiere, statut, objectifs_eleve_parent)
-   `qcmScores` (global_mastery_percent, by_domain, critical_lacunes)
-   `pedagoProfile` (style_apprentissage, motivation_actuelle, organisation_travail, difficultés_declarees, etc.)
-   `pre_analyzed_data` (IDX_AUTONOMIE, IDX_MOTIVATION, etc.)
-   Matrice de décision Nexus (pour l'offre recommandée).

---

📌 À produire :
Un **document synthétique d'une page**, en français clair, structuré en 5 sections, qui offre une vision rapide et motivante de la situation de l'élève et des recommandations Nexus, avec un encouragement final.
```

---

### **6. Implémentation Technique (Directives pour Cursor)**

Cursor, vous allez implémenter le workflow de génération du bilan en vous basant sur les instructions suivantes.

**6.1. Mise à jour de Prisma Schema (`prisma/schema.prisma`) :**
Ajouter les colonnes nécessaires au modèle `Bilan` et potentiellement `User`/`Student`.

```prisma
// Fichier : prisma/schema.prisma

// ... (autres modèles existants)

model Bilan {
  id                      String    @id @default(cuid())
  userId                  String
  user                    User      @relation(fields: [userId], references: [id])
  studentId               String?   // Si le bilan est pour un élève spécifique lié à un parent
  student                 Student?  @relation(fields: [studentId], references: [id])
  matiere                 String?   // Matière choisie pour ce bilan (ex: "Maths", "NSI")
  niveau                  String?   // Niveau choisi pour ce bilan (ex: "Première", "Terminale")

  qcmRawAnswers           Json?     // Réponses brutes du QCM (Volet 1)
  pedagoRawAnswers        Json?     // Réponses brutes du questionnaire pédagogique (Volet 2)

  qcmScores               Json?     // Résultats calculés du QCM (global, par domaine, lacunes critiques)
  pedagoProfile           Json?     // Profil pédagogique dérivé du Volet 2 (style, organisation, etc.)
  preAnalyzedData         Json?     // Indices calculés (IDX_AUTONOMIE, IDX_ORGANISATION, etc.)
  offers                  Json?     // Offres Nexus recommandées (primaire, alternatives, justification)

  reportText              String?   @db.Text // Texte complet du rapport généré par OpenAI
  summaryText             String?   @db.Text // Texte de la synthèse d'une page générée par OpenAI

  generatedAt             DateTime? // Date de génération du rapport complet
  status                  String    @default("PENDING") // PENDING, GENERATED, ERROR, PROCESSING_QCM, PROCESSING_PEDAGO, PROCESSING_AI_REPORT

  variant                 String?   // Variante du bilan (ex: "standard", "parent", "eleve")
  mailLogs                MailLog[] // Historique des envois email de ce bilan

  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
}

// Ajout pour stocker les réponses au Volet 2 du premier bilan, réutilisables.
// Ceci sera lié à l'élève, et non au bilan spécifique.
model StudentProfileData {
  id                      String    @id @default(cuid())
  studentId               String    @unique
  student                 Student   @relation(fields: [studentId], references: [id])
  pedagoRawAnswers        Json?     // Réponses brutes du Volet 2 initial
  pedagoProfile           Json?     // Profil pédagogique dérivé
  preAnalyzedData         Json?     // Indices dérivés du Volet 2 initial
  lastUpdatedAt           DateTime  @default(now())
}

// Assurez-vous que le modèle Student a la relation vers StudentProfileData
model Student {
  // ... autres champs
  profileData             StudentProfileData?
  // ... autres champs
}

// ... (autres modèles MailLog, GeneratedDocument, etc. comme précédemment)
```

* **Action requise :** Exécuter la migration Prisma après modification du schéma : `npx prisma migrate dev --name "update_bilan_schema_for_dynamic_questionnaires_and_profiles"`

**6.2. Nouveaux Endpoints API :**

* **`GET /api/bilan/questionnaire-structure` :**
  * **But :** Fournit la structure du questionnaire (Volet 1 + Volet 2) pour un élève donné.
  * **Requête :** `GET /api/bilan/questionnaire-structure?studentId=[id]&matiere=[matiere]&niveau=[niveau]`
  * **Logique :**
        1. Vérifie si l'élève a déjà un `StudentProfileData` complété (signifie que le Volet 2 a déjà été répondu).
        2. Charge le JSON du Volet 1 (`data/qcm_[niveau]_[matiere].json`) en fonction des paramètres.
        3. Si pas de `StudentProfileData`, charge le JSON du Volet 2 (`data/pedago_survey_commun.json`).
        4. Retourne la structure complète (`volet1: [...questions], volet2: [...questions]`).
  * **Output :** `{ volet1: [...], volet2: [...], requiresVolet2: true/false, previousPedagoAnswers: {...} }`

* **`POST /api/bilan/[bilanId]/submit-answers` :**
  * **But :** Sauvegarde les réponses du questionnaire (QCM et Pédagogique).
  * **Requête :** `POST /api/bilan/[bilanId]/submit-answers` (Corps : `{ qcmAnswers: {...}, pedagoAnswers: {...} }`)
  * **Logique :**
        1. Mettre à jour `bilan.qcmRawAnswers` et `bilan.pedagoRawAnswers`.
        2. Calculer et stocker `bilan.qcmScores` (utilisant les scripts Python `score_radar_*.py` ou leur équivalent TS porté).
        3. Si `pedagoAnswers` est fourni (premier bilan) :
            * Calculer `bilan.pedagoProfile` et `bilan.preAnalyzedData` (indices) à partir de `pedagoRawAnswers` (utilisant `lib/scoring/adapter_nsi_pedago.ts` ou similaire).
            * Créer/Mettre à jour `StudentProfileData` pour cet élève.
        4. Si `pedagoAnswers` n'est PAS fourni (bilan subséquent) :
            * Récupérer `pedagoProfile` et `preAnalyzedData` depuis `StudentProfileData` de l'élève.
            * Associer ces données au `Bilan` actuel.
        5. Déclencher la génération du `reportText` et `summaryText` (appels asynchrones aux endpoints OpenAI).
        6. Mettre à jour le statut du `Bilan` (`PROCESSING_AI_REPORT` → `GENERATED`).
  * **Output :** `{ ok: true, bilanId: ... }`

**6.3. Adaptation des Endpoints Existants :**

* **`POST /api/bilan/generate-report-text` et `POST /api/bilan/generate-summary-text` :**
  * Ces endpoints doivent maintenant charger les `qcmScores`, `pedagoProfile`, `preAnalyzedData` directement depuis l'objet `Bilan` (qui sera rempli par `submit-answers`) pour construire le prompt OpenAI.
* **`GET /api/bilan/pdf/[bilanId]/route.ts` et `POST /api/bilan/email/[bilanId]/route.ts` :**
  * Ces endpoints récupéreront `bilan.reportText` (et `bilan.summaryText` pour certaines variantes) et les autres données nécessaires directement de l'objet `Bilan`.
  * Ils devront aussi recevoir et gérer un nouveau `variant` "nexus" ou "admin" pour le rapport interne.

**6.4. Adaptation des Composants PDF (`lib/pdf/BilanPdf.tsx`, `lib/pdf/BilanPdfParent.tsx`, `lib/pdf/BilanPdfEleve.tsx`) :**

* Mettre à jour l'interface `PdfData` pour accepter le `reportText: string;`.
* Ajouter une logique de parsing du `reportText` en 6 sections (Introduction, Diagnostic, etc.) au sein de ces composants pour un affichage structuré.
* **Nouveau : `lib/pdf/BilanPdfNexusInternal.tsx` :**
  * Cette version du PDF affichera des informations plus techniques : tous les indices (`IDX_`), les `qcmRawAnswers`, `pedagoRawAnswers` (si pertinent), les logs d'erreurs éventuels, et les détails complets des `offers`. Destiné à l'équipe Nexus.

**6.5. Adaptation des Composants UI (`PdfVariantSelector.tsx`, `SendPdfByEmail.tsx`) :**

* Le `PdfVariantSelector` doit inclure l'option "Nexus (Interne)" pour télécharger le `BilanPdfNexusInternal.tsx`.
* Le `SendPdfByEmail` doit également permettre l'envoi de la version "Nexus (Interne)" à des destinataires spécifiques (ex: `admin@nexusreussite.academy`).

**6.6. `scripts/score_radar_*.py` et `lib/scoring/adapter_*.ts` :**

* Ces scripts Python et adaptateurs TypeScript sont essentiels pour le calcul des scores QCM et la dérivation des profils. Ils seront appelés par le backend Next.js.
* Il faudra un script Python pour le calcul des indices `IDX_` à partir des réponses du Volet 2, ou porter cette logique en TypeScript.

---

### **7. Améliorations Suggérées pour les Autres Documents**

* **`data/qcm_*.json` (tous les QCM) :**
  * **Ajouter des champs pour le `feedback` détaillé par question :** Pour chaque question, inclure un champ `feedback_correct` et `feedback_incorrect` qui peut être utilisé par un agent de soutien intelligent ou pour améliorer l'explication dans le rapport.
  * **Standardiser les noms de domaines :** S'assurer que tous les JSON QCM utilisent une liste standardisée et cohérente de noms de domaines pour les Mathématiques (ex: "AlgebreFonctions", "Analyse", "Suites", "Geometrie", "ProbaStats", "AlgoLogique") et NSI (ex: "TypesBase", "AlgoComplexite", "Python", "Structures", "SQL", "WebIHM", "Reseaux", "ArchOS", "HistoireEthique").
* **`CAHIER_CHARGES_BILAN_VOLET2.md` :**
  * **Convertir en JSON structuré :** Créer un fichier `data/pedago_survey_commun.json` qui contient toutes les questions du Volet 2, incluant les `options`, `scaleRef`, `visibleIf` et les nouveaux types d'indices qui en découleront. Ceci rendra le questionnaire dynamique et exploitable par le code.
  * **Clarifier les `scoreX()` :** Pour chaque nouvel indice `IDX_`, définir explicitement comment les réponses aux questions (Likert, single, text) seront converties en un score numérique (`scorePlanning(B1)` etc.). Ces fonctions devront être implémentées côté backend.
* **`README_BILANS.md` :** Ce document est obsolète avec ce nouveau cahier des charges. Il sera archivé ou supprimé.

---

**Fin du Cahier des Charges Complet ARIA - Bilans.**

Cursor, ce document est votre guide exhaustif. La complexité réside dans l'orchestration des données entre les questionnaires, les calculs, les appels OpenAI, et le rendu des rapports PDF multiples. Concentrez-vous sur la modularité, la robustesse, et l'intégration sécurisée de chaque composant.
