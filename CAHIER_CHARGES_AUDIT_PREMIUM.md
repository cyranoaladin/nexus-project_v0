## **CAHIER DES CHARGES D'AUDIT PREMIUM++ — NEXUS RÉUSSITE (Version Finale)**

**À l'attention de l'Agent IA Warp (Audit et Recommandations),**

**Objet : Audit Exhaustif, Scientifique et Opérationnel du Projet Nexus Réussite (Post-Implémentation)**

**Contexte de la Mission :**
Le projet Nexus Réussite, incluant l'écosystème ARIA, a atteint un état de "prod-ready" en développement, suite à une phase d'intégration et d'optimisation approfondie. Avant le déploiement final et l'ouverture complète aux utilisateurs, il est impératif de réaliser un audit externe et indépendant pour garantir l'absence de failles, de bugs majeurs, d'incohérences et d'optimiser tous les aspects du système.

Ce document constitue le cahier des charges détaillé de cet audit. Warp, ta mission est de conduire une **analyse exhaustive, scientifique et opérationnelle** du projet, en fournissant des **preuves exécutables, des mesures chiffrées, et un plan d'assainissement priorisé** pour chaque axe. L'audit doit valider que le projet est conforme aux standards les plus élevés de qualité, de performance et de sécurité, reflétant l'excellence premium de Nexus Réussite.

---

### **0. Résumé Exécutif de l'Audit (à compléter par Warp en fin de mission)**

*   **0.1. Constats Généraux :** Synthèse des forces et faiblesses globales du projet, incluant une évaluation de la robustesse architecturale, de la qualité du code et de la préparation à la production.
*   **0.2. Forces Confirmées :** Lister les aspects du projet qui démontrent une excellence avérée, avec preuves à l'appui (ex: implémentation SSE robuste, pipeline RAG performant, qualité PDF, cohérence des crédits/paiements cash, efficacité du CI/CD).
*   **0.3. Risques et Dettes Techniques Prioritaires :** Identification des zones à risque élevé ou des dettes techniques nécessitant une attention immédiate (ex: hygiène du nettoyage SSE, robustesse du stockage RAG, UI ingestion multi-formats, finesse des prompts de bilans premium, gestion des cas limites d'authentification).
*   **0.4. Plan d'Actions Priorisé (Impact × Effort) :** Proposer une feuille de route claire pour les améliorations, classée par niveau de priorité :
    *   **Critique (R - Rouge) :** Corrections bloquantes (sécurité, cohérence des données, stabilité des flux vitaux), lacunes RGPD légales.
    *   **Majeur (Y - Jaune) :** Optimisations (performance, observabilité, coûts OpenAI), tests E2E manquants.
    *   **Mineur (G - Vert) :** Améliorations de l'UX/UI, enrichissement de la documentation.

---

### **1. Périmètre et Sources de Vérité de l'Audit**

**1.1. Portée de l'Audit :**
L'audit couvrira **l'intégralité du dépôt de code** (applications, bibliothèques, services), l'ensemble des **documents Markdown** (racine, `/docs`, `/scripts`), et les **dossiers clés** suivants pour une analyse approfondie :
*   **Front/UI :** `app/(dashboard)/**`, `components/**`.
*   **Backend/API :** `app/api/**` (incluant `app/api/auth/[...nextauth]`, `app/api/bilans/*`, `app/api/rag/*`, `app/api/context/*`, `app/api/aria/*`, `app/api/payments/*`, `app/api/admin/*`, `app/api/consistency`, `app/api/health`).
*   **Logique Métier :** `lib/` (incluant `lib/auth.ts`, `lib/prisma.ts`, `lib/storage.ts`, `lib/queue.ts`, `lib/logger.ts`, `lib/env.ts`, `lib/rate-limit.ts`, `lib/jitsi.ts`, `lib/payments/*`, `lib/credits/*`, `lib/aria/*`, `lib/bilan/*`, `lib/pdf/*`, `lib/scoring/*`, `lib/hooks/*`).
*   **Services Serveur :** `server/` (incluant `server/rag/*`, `server/context/*`, `server/generation/*`, `server/openai/*`, `server/bilan/*`, `server/vector/*`).
*   **Base de Données :** `prisma/schema.prisma`.
*   **Tests :** `e2e/`, `__tests__/`.
*   **Déploiement :** `Dockerfile`, `docker-compose.yml`, `docker-compose.dev.yml`, `nginx.conf.example`, scripts dans `scripts/`.
*   **Performances & Sécurité :** Dossier `performance/k6/`, `audit-db/`.

**1.2. Sources de Vérité Documentaires :**
*   Le présent Cahier des Charges d'Audit.
*   Le document `README.md` du projet (livré par Cursor) qui décrit l'architecture et les fonctionnalités.
*   Les fichiers `ARIA_MODE_DEV.md`, `ARIA_CAHIER_CHARGES.md`, `BILAN_GRATUIT.md`, `CAHIER_CHARGES_BILAN_GRATUIT.md`, `CAHIER_CHARGES_BILAN_VOLET2.md`, `BILAN_PREMIERE_MATHS.md`, `BILAN_TERMINALE_MATHS.md`, `BILAN_PREMIERE_NSI.md`, `BILAN_TERMINALE_NSI.md`, `BILAN_PREMIERE_PC.md`, `BILAN_TERMINALE_PC.md`.

---

### **2. Conditions d'Exécution de l'Audit et Parité Environnementale**

**2.1. Environnement d'Audit :**
L'audit sera réalisé dans un environnement de développement local ou de staging qui est une **réplique exacte de l'environnement de production** (`dev "prod-ready"`).
*   **Clés API :** Utilisation de **vraies clés OpenAI** (non mockées : `DIRECT_OPENAI_DEV=1` ou équivalent sur les services IA) pour les appels aux LLM et aux embeddings.
*   **Services Externes :** Connexion aux services externes réels (OpenAI, GCP Vision pour l'OCR).
*   **Base de Données :** Utilisation de PostgreSQL local (via Docker) avec un `seed` de données réalistes couvrant tous les scénarios (utilisateurs, bilans, documents RAG).
*   **SMTP :** Utilisation d'un service SMTP de développement (ex: Mailhog) pour tester les envois d'e-mails.
*   **Fuseau Horaire :** Le système devra être configuré avec le fuseau horaire `Africa/Tunis` pour les tests liés aux dates/heures.
*   **Accès :** `E2E=1` si des flags sont nécessaires pour les tests end-to-end.

**2.2. Parité Dev ↔ Prod à Valider :**
*   **Modèles IA :** Validation que les modèles LLM et d'embedding utilisés en dev (`gpt-3.5-turbo`, `text-embedding-3-small`) sont facilement interchangeables avec les modèles de production (`gpt-4o`, `text-embedding-3-large`) sans rupture fonctionnelle.
*   **Répertoire RAG :** Vérifier que le mécanisme de stockage des documents RAG est commun et sauvegardable entre dev/prod.
*   **Authentification :** S'assurer que le fonctionnement de NextAuth (sessions JWT) est robuste et sécurisé, compatible avec des environnements HTTPS/HSTS en production.

---

### **3. Exigences Générales de l'Audit (Preuves Requises)**

*   **Zéro Mock sur les Flux Vitaux :** L'audit doit s'assurer que les flux critiques (ARIA↔OpenAI, RAG (ingestion/indexation/recherche), génération PDF, gestion des Crédits, gestion des Paiements cash) fonctionnent **sans aucun mock** dans les conditions d'audit (dev "prod-ready").
*   **Rapport Final Structuré :** Le livrable principal sera un `AUDIT_WARP_PREMIUM.md` structuré, horodaté, contenant des constats précis, des résultats **réels** des exécutions, et des annexes JSON.
*   **Critères de Réussite :** Toutes les constatations doivent être vérifiables, le périmètre intégralement couvert, et le plan d'actions proposé clairement priorisé et actionnable.

---

### **4. Axes d'Audit Détaillés (Vérifiables et Exécutables)**

Pour chaque axe, Warp devra fournir :
*   Les **commandes exécutées** pour la vérification.
*   La **sortie du terminal / logs / captures d'écran** prouvant le constat.
*   Le **constat** (succès, anomalie, échec).
*   Une **recommandation** (correction, amélioration, piste d'investigation).

#### **4.1. Configuration & Secrets**
*   **Inventaire Complet des `.env*` :**
    *   **Action :** Lister tous les fichiers `.env` (ex: `.env.local`, `.env.test`, `env.example`) et leurs priorités de chargement (`lib/env.ts`). Vérifier que `lib/env.ts` utilise bien Zod pour valider toutes les variables d'environnement critiques.
    *   **Constat :** Confidentialité des secrets (vérifier l'absence de secrets réels dans les fichiers versionnés).
    *   **Recommandation :** Politique de rotation des secrets (OpenAI, SMTP, Konnect, NextAuth), gestion des clés GCP.

*   **Sécurité des En-têtes HTTP :**
    *   **Action :** Examiner la configuration Nginx (`nginx.conf`) et les en-têtes Next.js pour `CORS`, `CSP`, `X-Frame-Options`, `Strict-Transport-Security` (HSTS), `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Cache-Control` des assets statiques.
    *   **Constat :** Conformité aux bonnes pratiques de sécurité web.

*   **Sécurité des Cookies :**
    *   **Action :** Examiner la configuration des cookies NextAuth (Session `jwt`) pour les attributs `Secure`, `SameSite`, `HttpOnly`.
    *   **Constat :** Protection contre les attaques de type CSRF/XSS.

#### **4.2. Authentification & RBAC (NextAuth)**
*   **Configuration `authOptions` :**
    *   **Action :** Vérifier le fichier `lib/auth.ts` (NextAuth options), les providers (Credentials), et l'adaptateur Prisma.
    *   **Constat :** Robustesse de l'authentification.
*   **Persistance des Rôles :**
    *   **Action :** Confirmer que le `role` de l'utilisateur est correctement injecté et persistant dans le JWT et la session NextAuth.
    *   **Constat :** Accès aux rôles pour l'autorisation.
*   **Guards sur les Routes Sensibles :**
    *   **Action :** Tester le `middleware.ts` pour `admin/*`, `api/rag/*`, `api/context/*`, `api/aria/*`, `api/bilan/generate-report-text`. Simuler des accès non autorisés pour vérifier les redirections (`401/403`).
    *   **Constat :** Efficacité du contrôle d'accès basé sur les rôles.
*   **Portails Utilisateur :**
    *   **Action :** Valider l'accès aux dashboards Parent, Coach, Admin, Assistante, Élève, Candidat-libre.
    *   **Constat :** Redirections et affichages spécifiques à chaque rôle sont corrects.

#### **4.3. ARIA (Agent Intelligent) & SSE (Server-Sent Events)**
*   **Sélection du Modèle LLM :**
    *   **Action :** Vérifier `server/openai/client.ts` et `lib/env.ts` pour la sélection du modèle (`OPENAI_MODEL`). Assurer que `selectModel()` ou la configuration environnementale fonctionne.
    *   **Constat :** Utilisation correcte des modèles (dev/prod).
*   **Qualité des Prompts :**
    *   **Action :** Auditer `apps/web/server/openai/promptBuilders.ts` et les prompts dans `CAHIER_CHARGES_BILAN_GRATUIT.md`. Vérifier l'intégration du profil élève et des sources RAG.
    *   **Constat :** Qualité, pertinence et conformité à la ligne éditoriale (pas de mention d'IA).
*   **Flux SSE (Chat ARIA) :**
    *   **Action :** Tester `POST /api/aria/chat?stream=true`. Vérifier les en-têtes SSE (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`), la réception de `event: token` et `event: done`. Simuler des interruptions réseau côté client (timeout, abort) pour vérifier les `retry/fallback` (s'ils sont implémentés dans `lib/aria/services.ts`).
    *   **Constat :** Robustesse et performance du streaming.
*   **Contrôle Freemium/Premium :**
    *   **Action :** Vérifier la logique de `freemiumUsage` pour ARIA (limite de 5 requêtes/jour pour freemium).
    *   **Constat :** Respect des règles de monétisation.
*   **Sécurité des Logs :**
    *   **Action :** Vérifier que les requêtes et réponses OpenAI (prompts, contenus générés) sont **sanitizés** dans les logs (`lib/logger.ts`) pour éviter toute fuite de PII ou de secrets.
    *   **Constat :** Conformité RGPD et sécurité des secrets.
*   **Anti Prompt Injection/XSS :**
    *   **Action :** Tester les inputs utilisateur pour détecter les vulnérabilités de prompt injection ou XSS.
    *   **Constat :** Robustesse aux attaques courantes.

#### **4.4. RAG Avancé (Ingestion → Index → Recherche)**
*   **Ingestion Multi-Formats :**
    *   **Action :** Tester l'upload via `POST /api/rag/upload` de divers documents (`.md`, `.pdf` (textuel et scanné), `.docx`, `.png`, `.jpg`).
    *   **Constat :** Prise en charge des formats, qualité de l'extraction (OCR via GCP Vision/Tesseract).
*   **Pipeline d'Ingestion :**
    *   **Action :** Vérifier `server/rag/ingest.ts` (OCR, nettoyage, chunking, embedding, indexation). Suivre les `IngestJob` via `GET /api/rag/jobs` pour observer la progression et les statuts (`UPLOADED` → `OCR_DONE` → `CHUNKED` → `EMBEDDED` → `INDEXED` → `PUBLISHED`).
    *   **Constat :** Fiabilité, granularité des statuts.
*   **Stockage et Redondance :**
    *   **Action :** Vérifier l'emplacement (`/app/storage` dans Docker) et la persistance des documents bruts. Examiner la gestion des volumes Docker.
    *   **Constat :** Conformité avec la stratégie de stockage (local en dev, extensible S3/MinIO).
*   **Chunking Sémantique :**
    *   **Action :** Auditer `server/rag/chunker.ts`. Vérifier la taille des chunks (800-1200 tokens), l'overlap (100-200 tokens), et la préservation des blocs spéciaux (LaTeX, code).
    *   **Constat :** Efficacité du chunking pour la pertinence du RAG.
*   **Indexation et Versioning :**
    *   **Action :** Vérifier `prisma/schema.prisma` pour `KnowledgeAsset` et sa colonne `embedding vector(3072)`. Tester l'indexation et la réindexation (`deleteMany` puis `createMany`).
    *   **Constat :** Intégrité et mise à jour de l'index vectoriel.
*   **Recherche par Contexte :**
    *   **Action :** Tester `server/vector/search.ts` (`semanticSearch`) avec des requêtes spécifiques, en filtrant par `subject`, `level`, `studentId`. Vérifier la qualité des résultats (top-k=6).
    *   **Constat :** Pertinence et rapidité de la recherche RAG.
*   **Sécurité de l'Upload :**
    *   **Action :** Tester les limites de taille d'upload. (Antivirus optionnel, SSRF).
    *   **Constat :** Robustesse aux uploads malveillants ou excessifs.

#### **4.5. Bilans & Documents (LaTeX / React-PDF)**
*   **Gestion Dynamique des Questionnaires :**
    *   **Action :** Tester `GET /api/bilan/questionnaire-structure` pour différentes combinaisons élève/matière/niveau, incluant les cas de premier bilan (Volet 1 + 2) et bilans subséquents (Volet 1 seul).
    *   **Constat :** Correction de la logique de `requiresVolet2` et `previousPedagoAnswers`.
    *   **Action :** Vérifier les fichiers JSON des QCM (`data/qcm_*.json`) et le JSON `data/pedago_survey_commun.json`.
    *   **Constat :** Structure valide et cohérente.
*   **Scoring et Calcul des Indices :**
    *   **Action :** Tester `POST /api/bilan/[bilanId]/submit-answers` avec des réponses QCM et pédagogiques variées. Vérifier la justesse des `qcmScores`, `pedagoProfile`, `preAnalyzedData` et `offers` calculés (en comparant avec des calculs manuels ou des scénarios de test).
    *   **Constat :** Précision du diagnostic numérique.
*   **Génération du Texte du Rapport :**
    *   **Action :** Déclencher `POST /api/bilan/generate-report-text` et `POST /api/bilan/generate-summary-text`. Vérifier que `bilan.reportText` et `bilan.summaryText` sont générés et stockés.
    *   **Constat :** Complétude et persistance des textes.
*   **Qualité du Texte Généré (Prompt OpenAI) :**
    *   **Action :** Auditer des rapports générés (via `reportText`) pour vérifier :
        *   Conformité à la **structure en 6 sections** et à la **matrice de décision**.
        *   Respect de la **ligne éditoriale** (ton premium, pas d'IA, "axes de progression").
        *   **Personnalisation** et pertinence des recommandations d'offres Nexus.
        *   **Précision** des références aux scores/profils de l'élève.
    *   **Constat :** Qualité éditoriale et alignement métier.
*   **Rendu PDF (`@react-pdf/renderer`) :**
    *   **Action :** Tester `GET /api/bilan/pdf/[bilanId]?variant=standard|parent|eleve|nexus` pour chaque variante.
    *   **Constat :** Fidélité du rendu PDF par rapport au texte généré, présence du logo/watermark, correct affichage des badges/ROI/détails internes.
*   **Envoi d'E-mails :**
    *   **Action :** Tester `POST /api/bilan/email/[bilanId]` pour toutes les variantes et destinataires. Vérifier la réception des e-mails (avec Mailhog en dev), la présence du PDF en PJ, et l'enregistrement dans `MailLog`.
    *   **Constat :** Fiabilité de la communication.

#### **4.6. Tarifs Dynamiques / Offres**
*   **Modèles de Pricing :**
    *   **Action :** Vérifier `prisma/schema.prisma` pour les modèles `Pricing`, `OfferBinding`, `BillingPolicy`, `PaymentSettings`.
    *   **Constat :** Clarté de la structure.
*   **Revalidation du Cache :**
    *   **Action :** Tester la mise à jour des tarifs via le dashboard admin (si implémenté) et vérifier la revalidation du cache des pages publiques (`/offres*`).
    *   **Constat :** Dynamisme et cohérence des prix affichés.

#### **4.7. Crédits & Wallet**
*   **Modèles Financiers :**
    *   **Action :** Auditer `prisma/schema.prisma` pour `CreditWallet`, `CreditTransaction`, `CreditPack`, `CreditUsage`.
    *   **Constat :** Conformité aux invariants financiers.
*   **Atomicté des Transactions :**
    *   **Action :** Tester la fonction `spendCredits()` (si disponible). Vérifier l'atomicité des débits (ex: réservation de session) via `prisma.$transaction`.
    *   **Constat :** Prévention des incohérences de solde.
*   **Gestion de l'Insuffisance de Crédits :**
    *   **Action :** Simuler un achat/réservation avec des crédits insuffisants. Vérifier la réponse `402 Insufficient Credits`.
    *   **Constat :** Gestion appropriée des fonds.

#### **4.8. Paiements (Politique TND actuelle)**
*   **Interface Paiements :**
    *   **Action :** Vérifier l'affichage de Konnect/Virement en "bientôt dispo" sur les interfaces utilisateur.
    *   **Constat :** Alignement avec la roadmap.
*   **Paiements Cash :**
    *   **Action :** Tester `POST /api/payments/cash/reserve`, `POST /api/payments/cash/confirm`, `POST /api/payments/cash/cancel`. Vérifier les statuts (`PENDING`, `PAID`, `CANCELLED`) et l'envoi d'e-mails de confirmation (via SMTP dev/Mailhog).
    *   **Constat :** Fluidité du workflow de paiement cash.
*   **Listing Admin :**
    *   **Action :** Accéder à `/api/admin/payments/records` (ou dashboard admin) et vérifier le listing des paiements avec filtres et actions.
    *   **Constat :** Outils d'administration fonctionnels.

#### **4.9. Qualité Logicielle & Observabilité**
*   **Stratégie de Tests :**
    *   **Action :** Vérifier `package.json` et les dossiers `__tests__/`, `e2e/`. Lancer `npm run test:coverage`, `npm run test:e2e`.
    *   **Constat :** Couverture des tests unitaires/intégration (cible ≥ 90%), E2E (cible ≥ 95%).
    *   **Accessibilité (A11y) :** Vérifier si `axe-core` est intégré aux tests E2E et s'il y a 0 violation bloquante.
    *   **CI/CD :** Auditer les workflows GitHub Actions (`.github/workflows/ci.yml`) : jobs séparés (lint/type/unit/int/E2E/contract/load), artefacts (coverage, traces).
*   **Observabilité :**
    *   **Action :** Examiner l'intégration d'outils de monitoring (Sentry pour erreurs, Prometheus/Grafana pour métriques, Loki/ELK pour logs).
    *   **Constat :** Collecte et visualisation des métriques/logs clés (latence p50/p95, erreurs, utilisation OpenAI, Redis hit-rate, Postgres TPS, temps d'ingestion RAG, temps génération PDF).

---

### **5. Méthodologie d'Audit (Pas-à-Pas Exécutables par Warp)**

1.  **Phase Initiale (3 jours) : Documentation & Setup**
    *   **[ ]** Lire et indexer l'ensemble des documents Markdown (racine, `/docs`). Fournir une synthèse indexée.
    *   **[ ]** Mettre en place l'environnement d'audit (dev "prod-ready") local, en respectant les spécifications : `docker-compose.dev.yml` up, `.env.local` configuré avec de vraies clés OpenAI et les identifiants de test (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, etc.), `npm install`, `db:reset`, `db:seed`.
    *   **[ ]** **Livrable :** Confirmation de l'environnement prêt, synthèse des MD indexés.

2.  **Phase d'Exploration et de Mapping (5 jours) : Structure & Flux**
    *   **[ ]** Générer la table exhaustive de tous les endpoints API (`app/api/*`) avec leurs méthodes, chemins, exigences d'authentification et de rôle (RBAC).
    *   **[ ]** Générer un ERD (Entity-Relationship Diagram) des modèles Prisma clés.
    *   **[ ]** Établir un diagramme de flux de données (`data-flow`) des workflows critiques : ARIA Chat, Ingestion RAG, Génération de Bilans PDF.
    *   **[ ]** **Livrable :** Table des endpoints (JSON), ERD (diagramme ou PlantUML), diagrammes de flux de données (texte ou PlantUML).

3.  **Phase de Vérification Exécutoire (10 jours) : Preuves & Mesures**
    *   **[ ]** Exécuter **tous les tests** unitaires, d'intégration, et E2E. Joindre les rapports de couverture de code et les rapports Playwright (avec traces vidéo si échec).
    *   **[ ]** Tester le flux complet **ARIA Chat (SSE)** : démarrer une conversation, poser des questions contextuelles, vérifier la réactivité, les logs du serveur (sanitisation PII), l'injection du contexte (mémoire, RAG).
    *   **[ ]** Tester le flux complet **RAG Ingestion** : uploader 2-3 documents réels (PDF textuel, scanné, image), suivre le job via `/api/rag/jobs`, vérifier que les documents sont `INDEXED` via `/api/rag/docs`, et tester la recherche sémantique via `GET /api/context/build` avec des requêtes pertinentes.
    *   **[ ]** Tester le flux complet **Génération de Bilan PDF** : déclencher la génération d'un bilan (via `/api/bilan/[bilanId]/submit-answers` ou un bouton admin) pour un élève test, pour chaque variante (standard, parent, élève, nexus). Télécharger les PDFs via `/api/bilan/pdf/[bilanId]`.
        *   **Preuve :** Joindre des captures d'écran des PDFs générés et des résultats des tests `pdfinfo` pour valider les métadonnées.
    *   **[ ]** Tester le flux complet **Crédits & Paiements Cash** : simuler une réservation de session (débit crédits), un paiement cash (réserve → confirm → emails), vérifier la cohérence des soldes de portefeuilles de crédits.
    *   **[ ]** Tester la **revalidation du cache** des tarifs : modifier un prix dans le seed ou via une API admin (si disponible) et vérifier que la page `/offres` est mise à jour après revalidation.
    *   **[ ]** Exécuter les scripts d'**audit de base de données** (`audit-db/sql_checks.sql`). Joindre les rapports.
    *   **[ ]** Exécuter les scripts de **tests de performance** K6 (`performance/k6/*`) sur les endpoints ARIA Chat, RAG upload, Bilan PDF. Mesurer les latences P50/P95 et les taux d'erreur.
    *   **[ ]** Exécuter des tests de **sécurité** (prompt-injection, XSS, RBAC, rate-limit).
    *   **[ ]** **Livrable :** Rapports de tests (coverage, Playwright), captures/fichiers de preuves (PDFs générés, logs SMTP, rapports DB), résultats des tests de performance.

4.  **Phase de Rapports et Recommandations (3 jours) : Synthèse & Plan**
    *   **[ ]** Consolider toutes les observations, mesures et résultats.
    *   **[ ]** Rédiger le "Résumé Exécutif" et les "Forces/Risques/Dettes".
    *   **[ ]** Élaborer le "Plan d'Actions Priorisé" (Critique/Majeur/Mineur) avec des recommandations concrètes, assignables (pistes pour issues/PRs), chiffrées (impact/effort estimé).
    *   **[ ]** **Livrable Final :** Le document `AUDIT_WARP_PREMIUM.md` complété, avec toutes les annexes techniques (JSON) intégrées (inventaire `.env*`, endpoints, matrices tests, patches/diffs proposés).

---

### **6. Matrices de Tests & Seeds Réalistes (Pour la Vérification)**

*   **Standards de Qualité :**
    *   Couverture minimale : tests unitaires ≥ 90%, tests d'intégration ≥ 90%, tests E2E ≥ 95%.
    *   Tests idempotents et parallélisables.
    *   Masquage des PII/secrets dans les logs et rapports.
    *   Tests d'accessibilité (`axe-core`) avec 0 violation bloquante.
    *   Tests de sécurité (prompt-injection, XSS, rate-limit, RBAC, CSP).
    *   Jobs CI/CD séparés (lint/type/unit/int/E2E/contract/load/smoke) et "merge-gates" stricts.
*   **Seeds :** Le script `prisma/seed.ts` doit être exécuté pour peupler la DB avec un jeu de données réaliste et varié, incluant :
    *   Un `ADMIN`, une `ASSISTANTE`, 2-3 `COACHS`.
    *   Un `PARENT` avec 2 `ÉLÈVES` :
        *   **Marie (Premium) :** Abonnée, avec des crédits, un historique de sessions, des quiz, et un bilan complet (QCM et pédagogique) dans une matière (ex: Maths Terminale).
        *   **Lucas (Freemium) :** Sans abonnement, avec un `freemiumUsage` ARIA à 4/5 requêtes, et un bilan pédagogique (Volet 2) déjà complété, mais pas de QCM dans une matière.
    *   Un `Candidat Libre`.
    *   Des cas d'anomalie de paiements (`PENDING`, `FAILED`).
    *   Des données pour le RAG (plusieurs `UserDocument` ingérés et `PUBLISHED`).
    *   Des `ChatMessage` et `Memory` pour les élèves tests.
*   **Taxonomie & Arborescence des Tests :** Respecter l'organisation des dossiers `__tests__`, `e2e`, `performance/k6`.
*   **Périmètres E2E prioritaires à tester :** ARIA (SSE), RAG (ingestion/requête), PDF/LaTeX, Tarifs dynamiques, Crédits, Paiements cash, RBAC, Accessibilité, Performance, Résilience.
*   **Critères d'Acceptation CI :** Tous les tests verts, couverture OK, `axe-core` 0 violation bloquante, tests de contrat (Pact) OK (si implémenté), P95 des requêtes conforme aux budgets, lint/type OK, zéro secret/PII en clair dans les artefacts, tous les artefacts publiés (coverage, traces Playwright).

---

### **7. Observabilité & Performance (Preuves Requises)**

*   **Traces :** Fournir des exemples de traces (OpenTelemetry, si implémenté) montrant un flux **corrélé** de requêtes critiques (ex: `/api/aria/chat` → RAG → PDF → DB), incluant l'identifiant `X-Request-Id` dans les logs et les spans.
*   **Métriques :** Présenter des relevés de métriques clés (collectées par Prometheus ou similaires) :
    *   Latences P50/P95 pour les requêtes API (générales, ARIA JSON/SSE, RAG, PDF).
    *   Taux d'erreur 4xx/5xx.
    *   Temps d'ingestion RAG (pour des documents de 5-20MB).
    *   Temps de génération PDF.
    *   Utilisation et coût estimé des tokens OpenAI.
    *   Taille de la file BullMQ et délais de traitement des jobs.
*   **Dashboards & Alertes :** Fournir des JSON de dashboards Grafana et des règles Prometheus (exemples déjà fournis dans le projet) pour visualiser ces métriques et détecter les anomalies.

---

### **8. Sécurité & RGPD (Opérationnel)**

*   **Contrôles OWASP :** Vérifier la mise en place de protections contre le Brute Force (rate-limit, Captcha), le CSRF (protégé par NextAuth), le SSRF (gestion des domaines internes), les XSS (sanitisation des inputs), la prompt injection.
*   **Sécurité des Uploads :** Validation stricte des fichiers uploadés (taille, type MIME, détection de malwares optionnelle).
*   **Gestion des Secrets :** Stratégie de stockage (`.env` sur VPS, secrets GitHub Actions), politique de rotation (trimestrielle), et procédure de révocation rapide en cas de compromission.
*   **Chiffrement des Données :** TLS pour le trafic, chiffrement au repos pour les données sensibles (volumes DB).
*   **Conformité RGPD :**
    *   **Registre des traitements PII :** Existera un document interne décrivant la cartographie des données personnelles par table/colonne, la base légale et la durée de rétention.
    *   **Rétention :** Les politiques de rétention des logs (90 jours) et des documents (1 an) sont configurées.
    *   **Droit d'Accès/Effacement :** Tester les endpoints d'administration internes ou les scripts (`scripts/rgpd/*`) pour la purge sélective et l'export de données utilisateur.
    *   **Journalisation Sécurité (`audit_logs`) :** Vérifier que les actions sensibles (purges, exports, uploads RAG) sont journalisées avec l'acteur, l'action, et le contexte.
    *   **Notifications :** Configurer et tester les notifications (Slack/Email) pour les actions RGPD critiques.

---

### **9. Base de Données & Qualité des Données**

*   **Schéma Prisma Intégral :** Auditer le `prisma/schema.prisma` final pour s'assurer de la pertinence des modèles, des FKs, des contraintes (unique, NOT NULL), et des indexes.
*   **`pgvector` :** Vérifier le type d'index (IVFFLAT/HNSW), la métrique (cosine/L2) et les paramètres (`lists`/`m`/`ef`) pour les embeddings `Memory` et `KnowledgeAsset`.
*   **Audit de Cohérence Automatisé :**
    *   **Action :** Exécuter les scripts SQL de vérification de cohérence (`audit-db/sql_checks.sql`) (ex: soldes `credit_wallets` vs `credit_tx`, FK orphelines, unicité).
    *   **Constat :** Base de données cohérente, absence de drift entre Prisma et la DB.

---

### **10. CI/CD, Migrations & Plan de Reprise d'Activité (PRA)**

*   **CI/CD Étendu (GitHub Actions) :** Auditer les workflows (`.github/workflows/ci.yml`) pour s'assurer de l'intégration des tests (lint/type/unit/int/E2E/contract/load/smoke), du `buildx` Docker, et des "merge-gates" stricts.
*   **Migrations & Seeds :**
    *   Vérifier que les migrations Prisma sont idempotentes et versionnées.
    *   **Rollback :** Démonter une procédure de rollback (`prisma migrate resolve --rolled-back ...`, scripts SQL correctifs) en cas d'échec de migration.
*   **PRA :**
    *   **Plan de Sauvegarde :** Auditer les scripts de sauvegarde (`scripts/backup.sh`) pour PostgreSQL (`pg_dump`) et MinIO (si utilisé). Vérifier la fréquence, la rétention, le chiffrement et la destination (S3/MinIO).
    *   **Plan de Restauration :** Audit du runbook PRA. Vérifier que les procédures de restauration vers un environnement staging sont testées régulièrement, incluant la DB et les objets MinIO, suivies de tests smoke.
    *   **Objectifs RPO/RTO :** RPO (Recovery Point Objective) : 1h pour la DB, 4h pour les documents ; RTO (Recovery Time Objective) : 2h.

---

### **11. Plan d'Audit — Exécution et Livrables**

**11.1. Tâches à Exécuter par Warp (Chronologie) :**

1.  **Phase 1 : Compréhension et Setup (3 jours)**
    *   Indexer et résumer tous les documents Markdown (racine, `/docs`).
    *   Mettre en place l'environnement d'audit local (dev "prod-ready") avec toutes les configurations requises (`.env.local`, Docker Compose, seeds).
2.  **Phase 2 : Cartographie et Vérification Statique (5 jours)**
    *   Générer la table des endpoints API avec leurs RBAC.
    *   Générer l'ERD Prisma et les diagrammes de flux des workflows critiques.
    *   Revue de code statique sur les points sensibles (sécurité, performance, logs).
3.  **Phase 3 : Tests et Preuves Dynamiques (10 jours)**
    *   Exécuter l'intégralité de la suite de tests (unitaires, intégration, E2E).
    *   Procéder aux tests fonctionnels des flux critiques (ARIA Chat, Ingestion RAG, Génération Bilan PDF, Crédits, Paiements Cash) en conditions réelles.
    *   Mener les tests de performance K6.
    *   Exécuter les scripts d'audit de base de données.
    *   Réaliser les tests de sécurité spécifiques (prompt injection, XSS).
4.  **Phase 4 : Analyse, Rapports et Recommandations (3 jours)**
    *   Analyser et consolider tous les résultats, mesures et constatations.
    *   Rédiger le "Résumé Exécutif", les "Forces", "Risques/Dettes" et le "Plan d'Actions Priorisé".
    *   Élaborer les "Check-lists pré-déploiement" et "Plan de la Feuille de Route".

**11.2. Livrables Attendus par Warp :**

*   **Rapport d'Audit Complet (Fichier `AUDIT_WARP_PREMIUM.md`) :**
    *   **Résumé Exécutif :** Synthèse concise pour la direction.
    *   **Forces Confirmées :** Liste des points d'excellence avec preuves.
    *   **Risques et Dettes Techniques :** Identification précise et détaillée des problèmes, avec leur impact et leur criticité.
    *   **Plan d'Actions Priorisé :** Feuille de route concrète et assignable, classée Rouge/Jaune/Vert (Critique/Majeur/Mineur), avec des estimations d'impact et d'effort pour chaque tâche.
    *   **Tableau exhaustif des Endpoints API :** Méthode, chemin, niveau d'authentification requis, rôles autorisés (RBAC), tags, effets secondaires.
    *   **Diagramme ERD (Entity-Relationship Diagram) :** Schéma complet de la base de données Prisma.
    *   **Diagrammes de Flux de Données :** Représentations des workflows clés (ARIA Chat, Ingestion RAG, Bilans).
    *   **Matrices de Tests :** Gaps identifiés et spécifications pour de nouveaux tests.
    *   **Runbooks :** Recommandations pour l'amélioration des runbooks existants (incidents, déploiement, rollback).
    *   **Chiffrages :** Estimations des coûts OpenAI, des ressources VPS nécessaires à la montée en charge.
    *   **Check-list pré-déploiement :** Liste des vérifications finales avant le Go-Live.
    *   **Format :** Markdown unique, sections horodatées, extraits/résultats réels, listes d'actions triées, annexes JSON intégrées.

*   **Annexes Techniques (JSON ou fichiers de rapport) :**
    *   Inventaire des variables d'environnement (`.env*`).
    *   Rapports de couverture de tests.
    *   Rapports Playwright (traces des E2E).
    *   Rapports d'audit de base de données.
    *   Exemples de traces de monitoring.
    *   Propositions de patches/diffs pour les corrections immédiates.

---

### **12. Check-list Pré-Déploiement (Gate avant Go-Live)**

Cette liste représente les critères absolus à valider avant tout déploiement en production.

1.  **Qualité du Code :** Lint/type-check OK ; couverture de tests (Unit/Intégration) ≥ 90% ; E2E ≥ 95% ; `axe-core` 0 violation bloquante.
2.  **Base de Données :** Audit de cohérence (FKs, unicité, cardinalités) OK ; `Prisma migrate diff` → 0 drift entre schéma Prisma et DB.
3.  **Performance :** P95 latence ARIA Chat (SSE) < 200ms (premier token), P95 API JSON < 400ms ; ingestion RAG (5-20MB) < 5 min ; génération PDF Bilan < 30s ; tous les budgets de performance respectés.
4.  **Sécurité :** Passe les audits OWASP (CSRF, SSRF, XSS, DoS, sécurité uploads, secrets) ; RGPD (purge/export validés, notifications fonctionnelles) ; secrets hors repo et protégés ; TLS opérationnel.
5.  **Stabilité :** Runbooks de rollback Prisma et de restauration DB/MinIO (si applicable) **testés** et fonctionnels.

---

**Fin du Cahier des Charges d'Audit Premium++.**

Warp, ce document est votre mission. Je compte sur votre expertise pour un audit d'une rigueur scientifique et d'une clarté opérationnelle exemplaires, afin de garantir l'excellence de Nexus Réussite.
