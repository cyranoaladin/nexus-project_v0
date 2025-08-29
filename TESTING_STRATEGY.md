# Stratégie de Tests Automatisés - Projet Nexus Réussite

Ce document sert de source de vérité pour la conception et la maintenance de notre suite de tests automatisés. Il est utilisé comme contexte de base pour toutes les interactions avec les assistants IA (Cursor, Gemini).

---

### 1) Vue d’ensemble du projet et stack technique

- **Missions et parcours critiques**
  - **Objectifs métier principaux :**
    1. **Accompagnement Personnalisé :** Fournir un suivi sur-mesure aux élèves via des coachs et des outils IA.
    2. **Certification :** Valider les compétences acquises via des parcours et des évaluations claires.
    3. **Employabilité :** Aider les élèves à valoriser leurs acquis sur le marché du travail.
  - **Parcours utilisateur le plus critique :**
    1. **Inscription :** L'utilisateur crée un compte (rôle `ELEVE`) via email/mot de passe.
    2. **Onboarding :** Il remplit son profil et définit ses objectifs d'apprentissage.
    3. **Souscription :** Il choisit une formule d'abonnement (le paiement est géré par Konnect, mais sera mocké/désactivé pour les tests initiaux).
    4. **Accès au contenu :** Il accède à son tableau de bord et à la liste de ses cours.
    5. **Interaction :** Il rejoint une session de visioconférence avec un `COACH`.
    6. **Succès :** Il termine un module, et sa progression est mise à jour. Il télécharge une attestation (PDF).
  - **Flows "must-not-fail" :** Inscription/Connexion, Accès à une session de visio planifiée, Génération de PDF d'attestation.

- **Stack et outillage**
  - **Frameworks de test :** Jest & React Testing Library (Unitaires/Intégration UI), Playwright (E2E).
  - **Versions cibles :** Node v20, Next.js v14, Playwright v1.40, Prisma v5, Postgres v15.
  - **Navigateurs supportés :** Chromium (prioritaire en CI), Firefox/WebKit (supportés en local).
  - **CI :** Les tests (lint, typecheck, unit, e2e) sont obligatoires et bloquants sur GitHub Actions.

- **Structure du repo**
  - **Type :** Monorepo géré avec Turborepo (ou Single-repo, à préciser).
  - **Répertoires clés :** `/app` (frontend/backend), `/__tests__` (tests unitaires), `/e2e` (tests Playwright), `/prisma` (schéma DB), `/scripts` (scripts de seeding).

---

### 2) Base de données et modèle de données

- **Modélisation :**
  - Le schéma de référence est le fichier `/prisma/schema.prisma`.
  - **Tables clés :** `User`, `Role`, `Course`, `Enrollment` (inscription à un cours), `Session` (visioconf), `SessionParticipant`, `Resource`.
  - **Contraintes importantes :** La suppression d'un `User` est en cascade sur `Enrollment` mais pas sur `Course` (soft-delete à préciser).
- **Données de test :**
  - **Stratégie :** Un script de seeding (`npm run db:seed:e2e`) est utilisé avant chaque run E2E.
  - **Isolation :** La base de données de test est entièrement réinitialisée avant chaque exécution de la suite E2E.
  - **Jeux de données E2E :**
    - `admin@nexus.local` (rôle ADMIN)
    - `coach@nexus.local` (rôle COACH)
    - `eleve@nexus.local` (rôle ELEVE)

---

### 3) Authentification, rôles et permissions (NextAuth)

- **Rôles et permissions :**

  | Rôle      | Créer Cours | Voir tous les élèves | Rejoindre n'importe quelle session | Supprimer un utilisateur |
  | :-------- | :---------: | :------------------: | :--------------------------------: | :----------------------: |
  | **ADMIN**     |      ✅      |          ✅           |                 ✅                  |            ✅             |
  | **COACH**     |      ✅      |    ✅ (ses élèves)     |        ✅ (ses sessions)           |            ❌             |
  | **ELEVE**     |      ❌      |          ❌           |        ✅ (ses sessions)           |            ❌             |
  | **PARENT**    |      ❌      |  ✅ (son/ses enfants)  |                 ❌                  |            ❌             |

- **NextAuth :**
  - **Providers :** Email/Password uniquement pour l'instant.
  - **Stratégie de session :** JWT. Le token contient `userId`, `role`, `email`.

---

### 4) Logique métier spécifique et complexe

- **Algorithmes complexes :**
  - **Calcul de progression :** `progression = (modules_terminés / modules_totaux) * 100`. Un module est terminé si toutes ses ressources ont été marquées comme vues.
- **Machines d’état :**
  - **Session de Visioconférence :** `PLANNED` -> `LIVE` (quand le coach clique sur "Démarrer") -> `COMPLETED` (après l'heure de fin) -> `ARCHIVED` (après 30 jours).

---

### 5) Agent IA “ARIA” et connexion à OpenAI

- **Architecture ARIA :**
  - `LLM_SERVICE`: Gère la logique de conversation avec l'API OpenAI (chat, questions/réponses).
  - `RAG_SERVICE`: Gère l'indexation et la recherche de documents (ressources de cours) pour fournir un contexte au LLM.
  - `PDF_GENERATOR_SERVICE`: N'utilise pas l'IA directement, il génère des PDF à partir de données structurées (ex: rapports de progression).
- **Usage OpenAI :**
  - **Fonctionnalité principale :** Chat d'aide aux élèves.
  - **Prompt système :** "Tu es ARIA, un tuteur IA bienveillant et encourageant pour la plateforme Nexus Réussite. Ta mission est d'aider les élèves à comprendre leurs cours. N'écris jamais le code à leur place, mais guide-les vers la solution. Utilise les documents fournis par le RAG pour baser tes réponses."
- **Tests IA :**
  - Les appels à `LLM_SERVICE` et `RAG_SERVICE` sont systématiquement mockés dans les tests E2E pour garantir la déterminisme et éviter les coûts. On teste que notre application envoie les bonnes données, pas qu'OpenAI fonctionne.

---

### 6) Fonctionnalités d’interaction et d’export

- **Visioconférence :**
  - **Intégration :** Iframe Jitsi (`https://visio.nexusreussite.academy`).
  - **Interactions à tester :** Un utilisateur avec le bon rôle et inscrit à la session peut voir l'iframe et le bouton "Rejoindre". Un utilisateur non autorisé est redirigé avec une erreur.
- **Génération PDF :**
  - **Types de documents :** Attestation de fin de module, Rapport de progression mensuel.
  - **Champs obligatoires (Attestation) :** Nom de l'élève, Nom du cours, Date de complétion.
  - **Tests :** Les tests E2E interceptent le téléchargement, vérifient le nom du fichier, et valident la présence des champs obligatoires dans le contenu textuel du PDF.

---

### 7) Environnement et configuration

- **Variables d’environnement E2E (.env.e2e) :** Toutes les variables du `.env.local` sont requises. `NEXTAUTH_URL` pointe vers le `webServer` de Playwright. Les clés API (OpenAI, etc.) sont de fausses valeurs prévues pour être interceptées par les mocks.
- **Exécution E2E :** Les tests tournent en CI via `playwright:test` contre une instance de l'application démarrée localement et une base de données fraîchement "seedée" via Docker.
- **Isolation E2E :** Chaque fichier de test (`.spec.ts`) est indépendant. Il est interdit de faire dépendre un test des résultats d'un test précédent.
