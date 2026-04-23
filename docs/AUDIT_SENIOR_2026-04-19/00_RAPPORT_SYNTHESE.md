# Rapport de synthèse — Audit Senior Nexus Réussite

> Date : 2026-04-19. Repo : `cyranoaladin/nexus-project_v0`. Branch : `main` @ `00d54e9a`.
> **10 axes couverts (100%)** — Audit Senior complet.

---

## 64 findings critiques

| # | Finding | Sévérité | Impact | Effort | LOT |
|---|---------|---------|--------|--------|-----|
| F1 | `nginx/ssl/privkey.pem` — clé SSL privée dans l'historique git (8 commits GitHub + 3 commits serveur prod `/opt/nexus/`) | **P0** | Usurpation TLS `nexusreussite.academy` | S | LOT 0 |
| F2 | `parent.json` / `student.json` — tokens de session NextAuth (JWE) dans 28 et 6 commits git | **P0** | Replay de session utilisateurs test | S | LOT 0 |
| F3 | `.env.production` contient `SMTP_PASSWORD`, `NEXTAUTH_SECRET`, `RAG_API_TOKEN` en clair sur disque local (non commité mais exposé) | **P0** | Compromission email + session forge + RAG | S | LOT 0 |
| F4 | Serveur 88.99.254.59 identifié : prod tourne sur Docker depuis `/var/www/nexus-project_v0/`, 5 commits derrière `main` | **P0** | Déploiement de correctifs sécurité bloqué | S | LOT 0 |
| F5 | `/dashboard/eleve` et `/programme/maths-1ere` sont deux cockpits distincts sans contrat unifié | **P1** | Divergence produit, données incohérentes selon la porte d’entrée | M | LOT 2 |
| F6 | `/api/student/dashboard` calcule `nextSession`, `credits`, `badges` mais `app/dashboard/eleve/page.tsx` ne les rend pas | **P1** | Données serveurs perdues, cockpit élève incomplet | M | LOT 2 |
| F7 | Progression Première en double écriture : Zustand local + API Supabase + fallback direct navigateur → Supabase | **P1** | Risque de divergence d’état et de perte de progression | L | LOT 5 |
| F8 | `/dashboard/trajectoire` : middleware exception laisse COACH accéder → API retourne 403, UX cassée | **P1** | Coach voit une page d'erreur au lieu d'un redirect | S | LOT 1 |
| F9 | `STAGE_PRINTEMPS_2026` référence des chapitres inexistants (`suites-numeriques`, `derivation-variations`, `probabilites-conditionnelles`) | **P1** | CTA cockpit cassées dès activation de ces séances | S | LOT 2 |
| F10 | **IDOR lecture** : `GET /api/stages/{slug}/bilans` — tout COACH lit tous les bilans de n'importe quel stage | **P0** | Fuite de bilans individuels (scores, commentaires, progression) entre coachs | S | LOT 3 |
| F11 | **IDOR écriture** : `POST /api/stages/{slug}/bilans` — tout COACH crée/écrase un bilan sur un stage non assigné | **P0** | Corruption de données pédagogiques, écrasement de bilans d'un autre coach | S | LOT 3 |
| F12 | Le widget RAG cockpit ne montre pas la provenance et l'API mélange API externe + pgvector avec `source: 'chroma'` legacy | **P2** | Remédiation non vérifiable, dette RAG masquée côté UI | M | LOT 6 |
| F13 | **IDOR activate-student** : PARENT peut activer n'importe quel élève sans vérification de parentalité → écrasement email + prise de contrôle | **P0** | Escalade de privilèges, détournement compte élève | S | LOT 4 |
| F14 | **ADMIN exclu de 6 routes assistant** : `credit-requests`, `subscription-requests`, `subscriptions`, `dashboard`, `coaches`, `students/credits` vérifient `!== 'ASSISTANTE'` | **P1** | ADMIN moins privilégié que ASSISTANTE sur routes opérationnelles | S | LOT 4 |
| F15 | **IDOR predict SSN** : `/api/assessments/predict` accessible à tout authentifié, pas de check rôle ni ownership + écriture en base | **P1** | Fuite données SSN + écriture non autorisée projection_history | S | LOT 4 |
| F16 | **Double source vérité progression** : localStorage Zustand = source *de facto*, Supabase = backup async non garanti. Changement de navigateur = perte | **P0** | Perte de données progression élève | L | LOT 5 |
| F17 | **Collision Maths 1ère / Terminale** : même table Supabase `maths_lab_progress`, `user_id` unique → élève bi-inscrit = données écrasées | **P0** | Corruption silencieuse progression | M | LOT 5 |
| F18 | **8 usages raw SQL injustifiés** : SSN, UAI, DomainScore, SkillScore, ProgressionHistory, ProjectionHistory via `$executeRawUnsafe` alors que modèles Prisma existent | **P1** | Dette technique, maintenance lourde, typage contourné | M | LOT 5 |
| F19 | **ChromaDB et pgvector en doublon fonctionnel** : 2 systèmes vectoriels, modèles embedding différents, pas de sync | **P1** | Architecture confuse, résultats RAG incohérents | M | LOT 6 |
| F20 | **Badges Maths non persistés en Prisma** : badges gagnés dans cockpit sont dans localStorage/Supabase. Table `student_badges` = autre jeu | **P1** | Perte badges, incohérence dashboard | M | LOT 5 |
| F21 | **`db-raw.ts` non utilisé** : helper centralisé anti-injection existe mais aucun fichier prod ne l'utilise | **P2** | Standard sécurité contourné | S | LOT 5 |
| F22 | **Supabase mode `local-only` silencieux** : API renvoie `200 { ok: true, persisted: false }` sans erreur client visible | **P2** | Fausse assurance de sauvegarde | S | LOT 5 |
| F23 | **Colonne `embedding` legacy** : champ Json dans `pedagogical_contents` jamais lu, toujours dans le schéma | **P2** | Confusion schéma | S | LOT 5 |
| F24 | **Ingestion pgvector hors-repo** : aucun code dans le repo n'écrit `embedding_vector` | **P3** | Processus opérationnel invisible | S | LOT 6 |
| F25 | **Tables Supabase CdC non créées** : `themes`, `chapters`, `learning_nodes`, `user_node_progress` restent en commentaire SQL | **P3** | Confusion documentation | XS | LOT 5 |
| F26 | **ARIA streaming sans retrieval vectoriel** : `aria-streaming.ts` fait du keyword `contains` uniquement, régression vs `aria.ts` qui utilise pgvector | **P1** | Qualité ARIA dégradée en streaming | S | LOT 6 |
| F27 | **Embeddings incompatibles** : pgvector (`text-embedding-3-small`, 1536d) ≠ ChromaDB (`nomic-embed-text`, 768d). Fallback sémantiquement incohérent | **P1** | Résultats RAG incohérents entre moteurs | M | LOT 6 |
| F28 | **`ragUsed: false` hardcodé** : champ diagnostic toujours `false` même quand RAG réussit. Audit qualité RAG impossible | **P1** | Staff ne peut pas auditer la qualité des bilans | S | LOT 6 |
| F29 | **PII dans prompts Ollama** : nom, prénom, établissement, email injectés dans le prompt LLM local | **P1** | Risque si Ollama externalisé | M | LOT 6 |
| F30 | **Bilan sans RAG silencieux** : ChromaDB down → bilan généré sans contexte pédagogique, aucune alerte staff | **P2** | Qualité bilan dégradée invisible | S | LOT 6 |
| F31 | **RAG route sans RBAC rôle** : tout authentifié peut interroger le RAG Maths 1ère | **P2** | Non conforme au modèle RBAC | S | LOT 6 |
| F32 | **Incohérence modèle Ollama** : `.env.example` = `qwen2.5:32b`, docker-compose = `llama3.2:latest`, code = `llama3.2:latest` | **P2** | Confusion configuration | XS | LOT 6 |
| F33 | **Ingestion embedding hors-repo** : ni pgvector ni ChromaDB n'ont de script d'ingestion dans le repo | **P2** | Processus CI/CD invisible | M | LOT 6 |
| F34 | **`source: 'chroma'` label legacy** : masque l'architecture réelle (API externe) | **P3** | UI trompeuse | S | LOT 6 |
| F35 | **Maths Terminale sans RAG** : pas de route RAG dédiée, aucune surface UI RAG | **P3** | Fonctionnalité manquante | M | LOT 6 |
| F36 | `generateWithFallback()` code mort | **P3** | Dette technique | XS | LOT 6 |
| F37 | Seuls 4/16 chapitres ont des exercices procéduraux infinis | **P2** | Entraînement Bac insuffisant | M | LOT 7 |
| F38 | Diagnostic prérequis actif pour 1/16 chapitres seulement | **P1** | Parcours non personnalisé | M | LOT 7 |
| F39 | Champ `prerequis` jamais enforced en UI (6 chapitres) | **P2** | Élève accède sans prérequis | S | LOT 7 |
| F40 | Un seul sujet blanc — insuffisant pour préparation Bac | **P2** | Pas de reprise ni progression | M | LOT 7 |
| F41 | Score examen blanc non persisté (state local) | **P1** | Perte du résultat d'examen | S | LOT 7 |
| F42 | RAG remédiation générique (pas ciblée par erreur élève) | **P2** | Remédiation peu pertinente | M | LOT 7 |
| F43 | Champ `remediation` du diagnostic jamais exploité | **P2** | Diagnostic sans suite | S | LOT 7 |
| F44 | CTA stage hardcode `catKey='algebre'` → navigation cassée | **P1** | Séance inaccessible pour non-algèbre | S | LOT 7 |
| F45 | Badges non persistés en Prisma (rappel F20) | **P2** | Perte badges entre sessions | M | LOT 5 |
| F46 | Données groupe enseignant hardcodées (noms fictifs) | **P2** | Vue enseignant inutilisable en prod | M | LOT 7 |
| F47 | Onglet `programme` supprimé du nav mais rendu accessible | **P3** | Code mort accessible | XS | LOT 7 |
| F48 | Bilan sans export PDF ni partage | **P2** | Bilan non distribuable | M | LOT 7 |
| F49 | **6 systèmes de bilan parallèles** sans schéma canonique (Diagnostic, Assessment, StageBilan, BilanView local, Stage Legacy) | **P0** | Dette technique massive, incohérence UX | L | LOT 8 |
| F50 | **Duplication générateurs LLM** : `lib/bilan-generator.ts` vs `lib/assessments/generators/index.ts` vs `lib/diagnostics/bilan-renderer.ts` | **P1** | 3 implémentations du même concept | M | LOT 8 |
| F51 | **Tables storage divergentes** : `Diagnostic` (Pallier2), `Assessment` (QCM), `StageBilan` (manuel) sans relations FK | **P1** | Données désynchronisées, pas de traçabilité | M | LOT 8 |
| F52 | **Bilan Maths 1ère non persisté** : store Zustand local uniquement, perte sur changement device | **P1** | Perte données progression | S | LOT 8 |
| F53 | **Stage Bilan Legacy** (`fevrier-2026`) encore en production avec reservationId public | **P2** | Dette produit, sécurité legacy | M | LOT 8 |
| F54 | **Surfaces bilan publiques multiples** avec contrôles d'accès hétérogènes (shareId, token, session) | **P1** | Risque sécurité, maintenance complexe | M | LOT 8 |
| **T1** | **Tests RBAC trompeurs** : testent les guards `lib/guards.ts`, pas les routes réelles | **P1** | Faux sentiment de sécurité sur 6 routes groups | M | LOT 9 |
| **T2** | **IDOR stage bilans complètement non testé** : aucun test pour F10/F11 | **P0** | Risque IDOR non détectable par tests actuels | L | LOT 9 |
| **T3** | **Parentalité activate-student non testée** : `__tests__/api/assistant.activate-student.route.test.ts:99` permet PARENT sans vérifier lien | **P0** | F13 non protégé par tests | S | LOT 9 |
| **T4** | **Ownership predict SSN non testé** : `__tests__/api/assessments.predict.route.test.ts:65` accepte n'importe quel studentId | **P1** | F15 non protégé par tests | S | LOT 9 |
| **T5** | **Prisma entièrement mocké** : `jest.setup.js:46-78` — pas de tests DB réels dans CI | **P1** | Tests ne détectent pas les vraies failles SQL | M | LOT 9 |
| **T6** | **E2E couverture superficielle** : 3 seuls fichiers E2E, aucun test stage bilans coach | **P1** | Surfaces critiques sans tests E2E | M | LOT 9 |
| **T7** | **RAG/LLM uniquement sur mocks** : `__tests__/api/aria.chat.route.test.ts:19` mock complètement | **P2** | Qualité RAG non testée réellement | M | LOT 9 |
| **T8** | **Pas de test cohérence Zustand/Supabase** : F16/F17 non testés | **P1** | Perte de données non détectable | S | LOT 9 |
| **T9** | **Pas de test raw SQL** : F18 non testé | **P1** | Injection SQL potentielle non détectée | M | LOT 9 |
| **T10** | **Tests secrets/credentials absents** : F1-F3 non testés | **P0** | Secrets dans git non détectés par CI | S | LOT 9 |
|
---

## Matrice impact × effort

```
         EFFORT
         XS    S     M     L
        ┌─────┬─────┬─────┬─────┐
  P0    │     │F1   │F17  │F16  │
        │     │F2   │     │     │
        │     │F3   │     │     │
        │     │F4   │     │     │
        │     │F10  │     │     │
        │     │F11  │     │     │
        │     │F13  │     │     │
        ├─────┼─────┼─────┼─────┤
  P1    │     │F8   │F5   │F7   │
        │     │F9   │F6   │     │
        │     │F14  │F18  │     │
        │     │F15  │F19  │     │
        │     │F26  │F20  │     │
        │     │F28  │F27  │     │
        │     │     │F29  │     │
        ├─────┼─────┼─────┼─────┤
  P2    │F32  │F21  │F12  │     │
        │     │F22  │F33  │     │
        │     │F23  │     │     │
        │     │F30  │     │     │
        │     │F31  │     │     │
        ├─────┼─────┼─────┼─────┤
  P3    │F25  │F24  │F35  │     │
        │F36  │F34  │     │     │
        └─────┴─────┴─────┴─────┘
```

Les blocages immédiats : secrets (LOT 0), IDOR coach/bilans (LOT 3) et IDOR activate-student (LOT 4). Le principal risque fonctionnel reste la divergence entre dashboard élève canonique et cockpit Maths Première (LOT 2).

---

## État de l'infrastructure de production

**Repo authoritative :** `cyranoaladin/nexus-project_v0`

**Déploiement prod :**
- Serveur : 88.99.254.59
- Container : `nexus-app-prod` (Docker Compose depuis `/var/www/nexus-project_v0/`)
- HEAD prod : `ba756884` (5 commits derrière `main`)
- DB : PostgreSQL 16 avec pgvector (`nexus-postgres-prod`)
- RAG stack : ChromaDB + Ollama (sur le même serveur)

**Deuxième codebase sur le serveur :** `/opt/eaf/` (`nexus-reussite-eaf` v1.0.2, Mistral AI, MCP server) — non déployé, hors scope.

---

## Routing — synthèse AXE 2

**86 pages** / **92 routes API** sur `main` (vs 73/80 dans l'artefact ROUTE_DIFF.md du 2026-02-22).

Middleware `middleware.ts` : protection robuste sur `/dashboard/*` et `/admin/*`. Une seule exception documentée (`/dashboard/trajectoire`) crée un gap UX pour COACH.

Architecture routing à corriger :
- `app/(dashboard)/` → supprimer (vide)
- `/admin/directeur` → déplacer sous `/dashboard/admin/directeur`
- `/dashboard/eleve/sessions` → renommer en `/dashboard/eleve/reserver`
- `/stages/fevrier-2026/*` → vérifier si identique au pattern dynamique → supprimer si oui

6 routes API sur 92 n'utilisent pas la garde centralisée `lib/guards.ts` — fonctionnellement correctes mais hors standard.

---

## Dashboard élève — synthèse AXE 3

Constat principal. Le produit sert deux dashboards élèves différents. Le dashboard canonique `/dashboard/eleve` est un assemblage client de plusieurs APIs. Le cockpit `/programme/maths-1ere` est une application pédagogique autonome adossée à Zustand + Supabase.

Effets concrets observés :
- `nextSession`, `credits` et `badges` sont calculés par `/api/student/dashboard` mais non affichés.
- Le chargement de `/dashboard/eleve` déclenche un fan-out HTTP confirmé vers `/api/student/dashboard`, `/api/student/trajectory`, `/api/me/next-step` et `/api/student/nexus-index`.
- La progression Première n’est pas Prisma-native et repose sur une double écriture locale + Supabase.
- Le planning de stage Première contient déjà des ids de chapitres non alignés avec `programmeData`.

Référence détaillée : `03_DASHBOARD_ELEVE.md`.

## Dashboard coach — synthèse AXE 4

Constat principal. Deux failles IDOR confirmées sur `/api/stages/[stageSlug]/bilans` : lecture (tout coach lit tous les bilans de n'importe quel stage) et écriture (tout coach crée/écrase un bilan sans être affecté au stage). Le flux session report est correctement protégé. La disponibilité coach est persistée en DB mais exposée en lecture à tout utilisateur authentifié.

Effets concrets :
- Coach A peut accéder aux bilans individuels (scores, commentaires, progression) d'élèves du stage de Coach B.
- Coach A peut écraser un bilan rédigé par Coach B via l'upsert sur `stageId_studentId`.
- Aucun test IDOR ne couvre les routes stage/bilan — 0 filet de non-régression.
- `docs/21_GUIDE_DASHBOARDS.md` ne documente ni `/dashboard/coach/stages` ni les APIs de bilan.

Référence détaillée : `04_DASHBOARD_COACH_IDOR.md`.

## Dashboards assistante/admin — synthèse AXE 5

Constat principal. L'architecture admin/assistante est globalement saine avec 18/18 routes admin et 8/9 routes assistant testées. Cependant, une faille IDOR P0 permet à un PARENT d'activer n'importe quel élève (pas de vérification parentalité). 6 routes assistant excluent ADMIN de façon incohérente. `/api/assessments/predict` est un IDOR en lecture + écriture sans RBAC.

Effets concrets :
- PARENT A peut activer l'élève de PARENT B en fournissant son userId → écrasement de l'email → prise de contrôle du compte.
- ADMIN ne peut pas superviser les opérations assistante (crédits, subscriptions, dashboard).
- Tout utilisateur authentifié peut prédire et persister le SSN de n'importe quel élève.
- La matrice RBAC documentée (`31_RBAC_MATRICE.md`) est obsolète sur 5 points.
- `payments/validate` est exemplaire : RBAC + Zod + transaction sérialisable + audit trail.

Référence détaillée : `05_DASHBOARD_ASSISTANTE_ADMIN.md`.

## Architecture données — synthèse AXE 6

Constat principal. Le produit utilise 5 systèmes de stockage en parallèle : PostgreSQL/Prisma (source de vérité principale), PostgreSQL raw SQL (SSN/UAI/DomainScore — dette NEX-42/43 non résorbée), Supabase externe (`maths_lab_progress` — progression Maths), pgvector (embeddings pédagogiques — fallback RAG), ChromaDB (RAG primaire via FastAPI ingestor).

La progression Maths a **3 couches sans reconciliation** : localStorage Zustand (source *de facto*), API server → Supabase, fallback client → Supabase. De plus, Maths 1ère et Terminale partagent la même table Supabase avec `user_id` unique — un élève bi-inscrit subit une corruption silencieuse.

8 usages raw SQL sont injustifiés : les modèles Prisma (`ProgressionHistory`, `ProjectionHistory`, `DomainScore`, `SkillScore`) et les colonnes (`ssn`, `uai`, `assessmentVersion`, `engineVersion`) existent dans le schéma depuis la migration `20260217_learning_graph_v2`. Les tickets NEX-42/43 n'ont jamais été traités.

ChromaDB et pgvector sont en doublon fonctionnel pour la recherche sémantique, avec des modèles d'embedding différents et aucune synchronisation.

Référence détaillée : `06_PRISMA_PGVECTOR_SUPABASE.md`.

## RAG/LLM — synthèse AXE 7

Constat principal. Le produit exploite **4 moteurs d'IA** (OpenAI, Ollama, ChromaDB, pgvector) sans contrat unifié. Il s'agit d'une **migration inachevée** : ChromaDB est le retrieval primaire pour le cockpit Maths et les bilans, pgvector est un fallback sémantiquement incohérent (embedding incompatible 1536d vs 768d), OpenAI génère les réponses ARIA, Ollama génère les bilans.

L'ARIA streaming a **régressé** : il n'utilise que la recherche keyword (pas de vectoriel). Les bilans hardcodent `ragUsed: false` même quand le RAG fonctionne. Les données PII (nom, email, établissement) sont injectées dans les prompts Ollama. Les processus d'ingestion ChromaDB et pgvector sont tous deux hors-repo.

Décision architecture cible : ChromaDB = retrieval canonique, Ollama = génération bilans (local/PII), OpenAI = génération ARIA chat. Supprimer le fallback pgvector du RAG.

Référence détaillée : `07_RAG_LLM_ARCHITECTURE.md`.

## Couverture pédagogique Maths 1ère — synthèse AXE 8

Constat principal. Le module Maths Première est le composant le plus complet du produit : 5 domaines, 16 chapitres, 33 exercices statiques, 57 quiz, 1 sujet blanc officiel, 10 labs interactifs, SRS, gamification (22 badges), cockpit contextuel, vue enseignant 5 onglets, bilan tri-destinataire, RAG flash + remédiation. C'est un module **riche mais inégalement approfondi**.

Les diagnostics de prérequis ne sont actifs que pour 1/16 chapitres. Les exercices procéduraux infinis ne couvrent que 4/16 chapitres. Le score d'examen blanc n'est pas persisté. 3 clés de séances stage pointent vers des chapitres inexistants (F9). Le CTA "Lancer la séance" hardcode `catKey='algebre'` cassant la navigation hors algèbre (F44). Les données groupe enseignant sont hardcodées avec des noms fictifs. La RAG remédiation est générique (pas ciblée par l'erreur spécifique).

Verdict : module **prêt pour une démo, pas pour un stage réel**. LOT 7 (~23h) nécessaire pour atteindre la production pédagogique.

Référence détaillée : `08_COUVERTURE_PEDAGOGIQUE_MATHS_1ERE.md`.

## Bilans dupliqués — synthèse AXE 9

Constat principal. Le produit possède **6 systèmes de bilan parallèles** sans schéma canonique commun :
1. **Bilan Gratuit** (lead gen) → `Assessment` table
2. **Bilan Pallier 2 Maths** → `Diagnostic` table
3. **Stage Bilan Coach** → `StageBilan` table (manuel)
4. **Maths 1ère BilanView** → Store Zustand local (non persisté)
5. **Assessment Universal** → `Assessment` table (QCM)
6. **Stage Bilan Legacy** → `StageReservation.scoringResult` (JSON)

**Il n'existe pas de contrat de données canonique.** Les trois audiences (élève/parent/Nexus) sont implémentées 4 fois différemment. Les stockages sont incompatibles (pas de FK entre Diagnostic et StageBilan). Les générateurs LLM sont dupliqués (`lib/bilan-generator.ts` vs `lib/assessments/generators/index.ts` vs `lib/diagnostics/bilan-renderer.ts`).

Verdict : **dettes produit et technique critiques**. Consolidation requise via LOT 8 (~35h) pour créer un modèle canonique unique `Bilan` et déprécier progressivement les 5 autres implémentations.

Référence détaillée : `09_BILANS_DUPLIQUES.md`.

## Tests : vraie couverture — synthèse AXE 10

Constat principal. Le projet dispose de **4541 tests Jest** et **3 suites E2E Playwright**, donnant l'impression d'une couverture forte. En réalité :

- **Seulement 21% des findings P0/P1 sont testés**
- **Les tests RBAC testent les guards, pas les routes réelles** (`__tests__/rbac/complete-matrix.test.ts` valide `requireRole`, pas `/api/admin/dashboard`)
- **IDOR complètement non testé** : aucun test ne vérifie qu'un coach ne peut pas accéder aux bilans d'un autre stage
- **Mocks excessifs** : Prisma, auth, et services sont entièrement mockés, masquant les vraies failles
- **Parentalité/Ownership non testés** : `activate-student` et `predict SSN` ne vérifient pas la relation réelle

**Cas d'étude T3:** `__tests__/api/assistant.activate-student.route.test.ts:99` teste que PARENT peut activer un élève, mais **ne vérifie pas que c'est bien son enfant**.

**Cas d'étude T4:** `__tests__/api/assessments.predict.route.test.ts:65` teste que n'importe quel utilisateur authentifié peut prédire le SSN de **n'importe quel studentId**.

Verdict : **couverture de tests trompeuse** donnant un faux sentiment de sécurité. Avant de remédier aux findings F1-F54, le projet DOIT d'abord implémenter des tests IDOR réels (LOT 9, ~40h).

Référence détaillée : `10_TESTS_VRAIE_COUVERTURE.md`.

## Axes restants (à auditer)

✅ **Tous les axes sont couverts.**

---

## Livrables produits

| Fichier | Contenu |
|---------|---------|
| `00b_REPO_CONSOLIDATION.md` | Identification repo authoritative, infrastructure prod, EAF |
| `01_FINDINGS_P0.md` | Secrets, clé SSL, credentials — preuves git log |
| `02_ROUTING_ET_DOUBLONS.md` | Inventaire 86 pages, doublons, décisions architecture |
| `02b_MATRICE_ROLE_ROUTE_REELLE.md` | Matrice rôle × route avec preuves code |
| `03_DASHBOARD_ELEVE.md` | Contrat réel du dashboard élève, fan-out, progression, RAG, tests manuels |
| `04_DASHBOARD_COACH_IDOR.md` | IDOR stage/bilans, matrice accès coach, scénarios IDOR, couverture tests |
| `04_REVIEW_ACCEPTANCE_AXE4.md` | Revue critique d'acceptation AXE 4 : verdicts, requalifications, prompt LOT 3 corrigé |
| `05_DASHBOARD_ASSISTANTE_ADMIN.md` | Audit AXE 5 : RBAC assistante/admin, findings P0-P3, matrice route→rôle, prompt LOT 4 |
| `05_FEUILLE_ROUTE_LOTS.md` | LOT 0, LOT 1, LOT 2, LOT 3, LOT 4, LOT 5, LOT 6, LOT 7 complets avec prompts Windsurf |
| `06_PRISMA_PGVECTOR_SUPABASE.md` | Audit AXE 6 : carte stockages, concepts dupliqués, Prisma vs raw SQL, Supabase, pgvector/ChromaDB, décision architecture |
| `07_RAG_LLM_ARCHITECTURE.md` | Audit AXE 7 : carte RAG/LLM, ChromaDB vs pgvector, Ollama, traçabilité source, embeddings, sécurité, décision architecture |
| `08_COUVERTURE_PEDAGOGIQUE_MATHS_1ERE.md` | Audit AXE 8 : couverture programme, chapitres, exercices, diagnostics, labs, examen, RAG, enseignant, bilan, cohérence stage, LOT 7 |
| `09_BILANS_DUPLIQUES.md` | Audit AXE 9 : 6 systèmes de bilan, duplication vs complémentarité, schéma canonique, sécurité, consolidation LOT 8 |
| `10_TESTS_VRAIE_COUVERTURE.md` | Audit AXE 10 : 4541 tests mais couverture trompeuse, faux positifs, trous IDOR, mocks excessifs, LOT 9 |
| `scripts/cleanup-repo.sh` | Script dry-run/apply nettoyage historique git |
| `scripts/pre-commit-hook.sh` | Hook bloquant commits secrets |
