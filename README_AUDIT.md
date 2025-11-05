# Nexus Réussite — README_AUDIT (Mis à jour)

> **Auteur principal : Alaeddine BEN RHOUMA**
> <https://github.com/cyranoaladin>  
> <contact@nexusreussite.academy>

## 1) Contexte & périmètre

Plateforme de soutien scolaire pour lycéens, familles et équipe Nexus. Le dashboard centralise la progression Bac, la gestion des cours, l’IA ARIA (diagnostic, plan, feedback), l’orientation Parcoursup et l’alignement sur les programmes officiels.

Modules audités :
- `StudentDashboard.tsx` (switching Première/Terminale/CandidatLibre)
- `NexusKnowledgeGraph` (visualisation 3D)
- `UpcomingCourses`, `MyProgressTab`, `AriaAssistant`, `ExamFocus`
- API : `/api/aria/chat`, `/api/sessions/book`, `/api/auth/*`

Environnements :
- Dev : `http://localhost:3000`
- Prod : `https://nexusreussite.academy`

## 2) Stack & versions
- **Frontend** : Next.js 14, React 18, TypeScript, Tailwind, Framer Motion, three.js
- **Backend** : Next.js API, Node.js 18+, Prisma, PostgreSQL
- **Orchestrateur ARIA** : API `/api/aria/chat`, RAG Qdrant, embeddings OpenAI
- **Tests** : Jest

**Environnements : dev / staging / prod (URLs) :**

*   **Dev :** `http://localhost:3000`
*   **Staging :** `https://staging.nexusreussite.academy` (TBD)
*   **Prod :** `https://nexusreussite.academy` (Confirmé in `DOCUMENTATION_TECHNIQUE_LIVRAISON.md`)

## 2) Stack & versions

*   **Frontend :** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Framer Motion (animations), three.js (visualisation), lucide-react (icônes).
*   **State :** React Hooks (useState, useContext).
*   **Tests (Frontend) :** Jest (Unitaire/Intégration), Playwright (E2E) (Confirmé in `RAPPORT_FINAL_CTO.md`).
*   **Backend :** Next.js 14 (API Routes), Node.js 18+.
*   **Auth :** NextAuth.js (Provider: Credentials, Stratégie: JWT).
*   **ORM :** Prisma.
*   **DB :** PostgreSQL (Prod), SQLite (Dev).
*   **Orchestrateur multi-agents :** L'API route `/api/aria/chat` sert d'orchestrateur simple, gérant la récupération de contexte (RAG) avant l'appel à l'LLM.
*   **RAG :**
    *   **DB Vecteurs :** Non spécifié (Fallback sur recherche textuelle PostgreSQL via Prisma - `ARCHITECTURE_TECHNIQUE.md`).
    *   **Embeddings :** Standard OpenAI (TBD).
*   **Observabilité :** Non spécifié (Prévu : Vercel Analytics / Sentry, instrumentation Next.js via `instrumentation.ts`).

## 3) Rôles & RBAC

**Rôles disponibles :** ADMIN, ASSISTANTE, COACH, PARENT, **ELEVE_PREMIERE, ELEVE_TERMINALE, ELEVE_CANDIDAT_LIBRE** (Confirmé in `DOCUMENTATION_TECHNIQUE_LIVRAISON.md`, *MAJ*).

**Claims JWT (iss, aud, sub, role, scopes) :**

*   `iss`: nexusreussite.academy
*   `aud`: nexusreussite.academy
*   `sub`: user.id (Prisma User ID)
*   `role`: `ELEVE_TERMINALE` (pour ce périmètre)
*   `scopes`: (TBD, ex: session:read, session:book, aria:chat)

**Ressources protégées critiques :**

*   `/dashboard/*` (Middleware, **doit rediriger en fonction du rôle ELEVE_***).
*   `/api/admin/*`
*   `/api/sessions/*`
*   `/api/payments/*`
*   `/api/aria/chat` (Vérification de l'abonnement/formule **Première/Terminale**)

## 4) API & endpoints clés

*   **Base URL staging :** `https://staging.nexusreussite.academy/api`
*   **Export OpenAPI (lien ou fichier) :** Non disponible. À générer depuis les API routes.
*   **Webhooks / jobs / rate-limit :**
    *   **Webhooks :** `/api/webhooks/konnect` (Paiements).
    *   **Jobs :** Cron job pour l'expiration des crédits (Confirmé in `DOCUMENTATION_TECHNIQUE_LIVRAISON.md`).
    *   **Rate-limit :** Non implémenté. Recommandé sur `/api/auth/*` et `/api/aria/chat`.

## 5) Données & RAG

**Collections (SQL) + index :**

*   `User` (index: email unique)
*   `Student` (index: userId, parentId. **AJOUTER: `niveau` (enum: 'premiere', 'terminale'), `statut` (enum: 'scolarise', 'candidat_libre')**)
*   `Subscription` (index: studentId)
*   `CreditTransaction` (index: studentId)
*   `Session` (index: studentId, coachId)
*   `AriaConversation` / `AriaMessage` (index: studentId)
*   `PedagogicalContent` (Contenu RAG)

**Sources du corpus RAG (Corpus mis à jour) :**

*   **`Programmes_Officiels_Cycle_Terminal_Voie_Generale.md`** (Document maître 23 pages: Tronc Commun, 13 Spécialités, Options).
*   **`Synthese_Enseignements_Specialite_Premiere.md`** (Document 6 pages: Focus Première).
*   `Epreuves_terminale_bac_general.md` (Détail des coefficients et épreuves).
*   Contenus pédagogiques exclusifs (à charger dans `PedagogicalContent`).

**Pipeline d’ingestion (schedule, owner) :** Manuel (actuellement). Upload de PDF/MD via un back-office admin (à construire) -> Parsing, chunking (par matière, par niveau), embedding -> Stockage dans `PedagogicalContent`.

## 6) Parcours élève

Le parcours "Diagnostic → Plan → Séance → Évaluation → Bilan" doit être différencié.

---
**Parcours 1 : Élève de Première (Scolarisé)**

*   **Diagnostic :** L'élève a choisi 3 spécialités.
*   **Plan :** Le dashboard est activé. `ExamFocus` met en avant les **Épreuves Anticipées de Français** (Écrit Coeff 5, Oral Coeff 5). `MyProgressTab` suit les 3 spécialités et le tronc commun.
*   **Séance :** L'élève utilise ARIA pour réviser le Français et préparer le choix de la spécialité à abandonner.
*   **Évaluation :** Réception des notes du Contrôle Continu.
*   **Bilan :** Le dashboard montre la progression du CC (40%) et la préparation aux épreuves anticipées.

---
**Parcours 2 : Élève de Terminale (Scolarisé)**

*   **Diagnostic :** L'élève a conservé 2 spécialités.
*   **Plan :** Le dashboard `ExamFocus` met en avant les **Épreuves Terminales** : 2 Spécialités (Coeff 16 x2), Philosophie (Coeff 8), et **Grand Oral** (Coeff 10). Un module **Orientation (Parcoursup)** est visible.
*   **Séance :** L'élève utilise ARIA pour la Philo, le Grand Oral et ses spécialités.
*   **Évaluation :** Réception des notes du Contrôle Continu.
*   **Bilan :** Le dashboard montre la répartition 40% (Contrôle Continu) vs 60% (Épreuves Terminales).

---
**Parcours 3 : Élève de Terminale (Candidat Libre)**

*   **Diagnostic :** L'élève doit passer toutes les épreuves en une fois.
*   **Plan :** Le dashboard est en mode "100% Épreuves". Le module `MyProgressTab` est un tracker d'auto-évaluation (pas de notes de CC).
*   **Séance :** L'élève utilise ARIA pour un plan de révision intensif sur *toutes* les matières (y compris Français, Philo, Spécialités, Grand Oral).
*   **Évaluation :** Pas de notes intermédiaires.
*   **Bilan :** Le dashboard est un outil de "préparation en autonomie" sans la composante 40/60.

---
**Écrans (liens maquettes / captures) :**

*   Maquette fonctionnelle principale : `app/components/StudentDashboard.tsx` (**Nécessite une refactorisation pour gérer les 3 états**).
*   Pages publiques : `app/page.tsx`, `app/equipe/page.tsx`, `app/offres/page.tsx`.

**États d’erreur / hors-ligne :** Non définis. À implémenter (ex: état vide pour "Ma Progression", message d'erreur si l'API ARIA échoue, mode hors-ligne TBD).

## 7) Évaluation/Notation

**Barèmes utilisés (liens/réfs) :** Barèmes officiels du Baccalauréat Général (Réf: `Epreuves_terminale_bac_general.md`).

*   **Épreuves Terminales (Scolarisé & Candidat Libre) :**
    *   Spécialités (x2) : Coeff 16 (Total 32)
    *   Grand Oral : Coeff 10
    *   Philosophie : Coeff 8
*   **Épreuves Anticipées (Première & Candidat Libre) :**
    *   Français (Écrit) : Coeff 5
    *   Français (Oral) : Coeff 5
*   **Contrôle Continu (Scolarisé) :** 40% (incluant Tronc Commun + Spécialité de 1ère abandonnée).

**Gabarits de feedback :**

*   `SESSION_BOOKING_LOGIC.md` spécifie les champs `rating`, `feedback`, `coachNotes`, `studentNotes` pour les retours post-session.
*   L'assistant ARIA doit inclure un mécanisme de feedback (pouce haut/bas) pour l'amélioration continue.

**Métriques de qualité (ex. exact match, BLEU, gpt-judge…) :**

*   **Dashboard :** Taux d'engagement, fréquence de connexion, utilisation des crédits (différencié par niveau).
*   **ARIA (RAG) :** Métriques de pertinence (Faithfulness, Answer Relevancy), TBD.

## 8) Sécurité & conformité

**Données sensibles (PII/élèves) :**

*   `User` : Email, Nom, Prénom, password (hashé bcrypt).
*   `Student` : Classe, **niveau, statut,** notes, progression, `AriaConversation` (potentiellement sensible).
*   `Payment` : Historique des transactions (pas de N° de CB stocké).

**Consentements / durée conservation :** À définir par une revue légale (ex: RGPD / Loi Organique tunisienne sur la protection des données personnelles).

**Stockage secrets / clés :** Fichier `.env` chargé en variables d'environnement (Confirmé in `DOCUMENTATION_TECHNIQUE_LIVRAISON.md`).

## 9) Dette & risques connus

*   **(H) Risque de Périmètre :** Le `StudentDashboard.tsx` actuel est monolithique et conçu *uniquement* pour l'élève de Terminale Scolarisé. Les parcours pour **'Première'** et **'Candidat Libre'** ne sont pas implémentés et nécessiteront des vues/composants distincts.
*   **(H)** États d'erreur et de chargement : Non implémentés sur le dashboard.
*   **(M)** Paiement Wise : Processus manuel nécessitant une validation par une assistante (Réf: `DOCUMENTATION_TECHNIQUE_LIVRAISON.md`).
*   **(M)** Pipeline RAG : Ingestion manuelle et fallback sur recherche textuelle (Réf: `ARCHITECTURE_TECHNIQUE.md`).
*   **(L)** Graphe 3D : Le `NexusKnowledgeGraph` est actuellement décoratif et non connecté aux données de progression réelles de l'élève.
*   **(L)** Badges & Récompenses : Module `BadgesRewards` statique, logique de gamification non implémentée.

## 10) Priorités produit (6–8 semaines)

*   **Must (T0–T+2sem) :**
    *   **Refactorer `StudentDashboard.tsx`** pour gérer les 3 rôles : `ELEVE_TERMINALE` (existant), `ELEVE_PREMIERE` (à créer), `ELEVE_CANDIDAT_LIBRE` (à créer).
    *   Mettre à jour la base de données (`Student`) pour inclure `niveau` et `statut`.
    *   Implémenter le workflow de réservation de session (backend de `SESSION_BOOKING_LOGIC.md`).
    *   Finaliser la connexion/déconnexion via NextAuth avec les rôles différenciés.
*   **Should (T+1 mois) :**
    *   **Mettre à jour le corpus RAG** d'AriaAssistant avec les `Programmes_Officiels_Cycle_Terminal_Voie_Generale.md`.
    *   Connecter le module `MyProgressTab` aux données réelles (notes CC et anticipées).
    *   Implémenter la vue `ExamFocus` pour le dashboard `ELEVE_PREMIERE` (focus Français).
*   **Could (T+2 mois) :**
    *   Implémenter un module **'Orientation/Parcoursup'** dans le dashboard Terminale.
    *   Implémenter la logique de gamification (BadgesRewards).
    *   Commencer à connecter le `NexusKnowledgeGraph` aux données.

## 11) Accès & comptes démo

**Comptes (masqués/sanitisés) :**

*   `eleve.terminale@nexus.tn` / `ElevePass123` (Accès Dashboard Terminale Scolarisé)
*   `eleve.premiere@nexus.tn` / `ElevePass123` (Accès Dashboard Première Scolarisé)
*   `eleve.candidatlibre@nexus.tn` / `ElevePass123` (Accès Dashboard Candidat Libre)
*   `parent@nexus.tn` / `ParentPass123` (Accès au dashboard Parent pour gestion crédits/abonnements)
*   `coach@nexus.tn` / `CoachPass123` (Accès au dashboard Coach pour gestion disponibilités/feedback)

**Consignes de connexion :** Se connecter via `https://[URL_STAGING]/auth/signin`.
