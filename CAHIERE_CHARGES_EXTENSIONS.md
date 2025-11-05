# Cahier des charges — Extension Nexus Réussite

**Version**: v1.0 (conception) • **Portée**: Produit, technique, data, IA, sécurité, CI/CD • **Auteur**: Nexus Réussite

## 0) Objectifs & principes

1. **Passer d’ARIA (mono-agent) à une architecture multi-agents** inspirée d’*all-agentic architectures*, orchestrée par un **Superviseur** et un **Bus d’événements**.
2. **Freemium**: parcours d’acquisition clair (bilan gratuit → profil persistant → valeur immédiate → incitation vers plans payants).
3. **Profil élève persistant** (historique, difficultés, progression, préférences) **exploité par les agents** + **RAG local** (documents internes, corpus officiels, banques d’exos) pour des réponses sourcées.
4. **Tableaux de bord personnalisés** (1re/Tle, scolarisé vs. candidat libre, EDS, options, langues, épreuves anticipées, Grand Oral, Parcoursup).
5. **Dashboard “candidat libre”** adapté aux spécificités d’examen (absence de contrôle continu, épreuves pratiques non proposées lorsque c’est le cas).
6. **Écosystème de ressources** (cours, résumés, méthodos, agendas visio/présentiel, réservation, stages, groupes) + **analytics de progression**.
7. **Agents capables d’enseigner/guider/évaluer** (générer sujets & corrigés, OCR copies scannées, feedback critérié, plan de révision pondéré).
8. **Traçabilité & redevabilité**: journaux/rapports consultables par l’assistante, les coachs et l’admin ; **rapport parents** récurrent.
9. **Dashboard parent** synthétique (progression, sessions suivies, réservations, rapports coachs, alertes de risque).

**Opinion** : prioriser **deux tunnels** impeccables dès le MVP—(A) “Bilan gratuit → plan d’action personnalisé (1re/Tle & statut) → essai premium 7 jours”, (B) “Parcoursup & Grand Oral” (Tle) avec **jalons actionnables**. Ce sont les deux “produits de vérité” qui convertissent.

---

## 1) Périmètre fonctionnel (MVP → V2)

### 1.1. MVP (livraison incrémentale en 4 sprints)

* **Onboarding** (élève) : statut (scolarisé/individuel), niveau (1re/Tle), EDS/Options, LVA/LVB, cibles post-bac.
* **Bilan gratuit** (obligatoire) : tests très courts (diagnostics ciblés Maths/NSI + questionnaire “métacognitif” + contraintes/temps dispo).
* **Parcours & Épreuves** : calendrier personnalisé (épreuves anticipées, EDS, Grand Oral, Parcoursup), **coefficients**, jalons.
* **Révisions** : plan pondéré (coefficients × échéances × fragilités), recommandations RAG (fiches, exercices, vidéos).
* **Parcoursup** (Tle) : jalons, to-do intelligentes (fiche Avenir, lettres, attendus), vérif. d’alignement EDS ↔ vœux.
* **Grand Oral** (Tle) : coach d’oral (entrainements minuteurs, grille critériée, feedback audio/texte).
* **Dashboard “candidat libre”** : remplace CC par évaluations ponctuelles ; masque épreuves pratiques non proposées ; **simulateur de charge**.
* **Parent** : vue progression, assiduité, dernières évaluations, sessions programmées, alertes.
* **Rôles** : Élève, Parent (lecture), Coach (édition/feedback), Admin (gouvernance, tarification, contenus).
* **Paiement & plans** (essentiels, cf. §7).

### 1.2. V2 (après traction MVP)

* **Graphe de compétences** (visualisation 3D déjà amorcée dans votre squelette) connecté à des **compétences observables**.
* **Correction automatique** (OCR + notation critériée configurable + anti-plagiat simple) sur copies PDF/scan.
* **Planification adaptative** (reinforcement scheduling : spacing effect, difficulté variable).
* **Marché de sessions** (cours individuels/groupes, stages, demandes personnalisées, paiements intégrés).
* **Analytics avancés & A/B** (conversion Free→Paid, impact des recommandations, ablation des modules IA).

---

## 2) Profils & règles de parcours (rappel normalisé)

* **1re** : tronc commun, 3 EDS (4 h). Épreuves anticipées (Français écrit+oral ; Maths anticipées selon millésime).
* **Tle** : tronc commun (Philo), 2 EDS (6 h). **Grand Oral**, **Parcoursup** (jalons).
* **Scolarisé** : 40 % contrôle continu + 60 % épreuves terminales.
* **Candidat libre** : pas de CC ; épreuves ponctuelles ; épreuves pratiques non proposées dans certaines spécialités.
  → Ces règles **paramètrent** l’affichage (épreuves, jalons), les **pondérations** du plan de révision et les **écrans** disponibles.

---

## 3) Architecture cible (mono-repo + multi-agents + RAG)

### 3.1. Mono-repo & dossiers (proposition)

```
nexus/
  apps/
    web/                # Next.js (App Router, TypeScript, shadcn/ui)
    api/                # FastAPI (Python 3.11), REST/GraphQL, OpenAPI
    workers/            # Celery/RQ ou Temporal (jobs OCR, indexation, scoring)
  packages/
    ui/                 # design system (Tailwind, shadcn)
    agents/             # agents, prompts, tools, policies, evaluation harness
    rag/                # pipelines d’ingestion, chunking, indexation, retrieval
    core/               # types partagés, schémas zod, SDK, clients
  infra/
    docker/             # Dockerfiles, docker-compose, devcontainers
    k8s/                # manifests Helm/ArgoCD (en V2)
    gha/                # GitHub Actions (lint, test, e2e, build, deploy)
  db/
    migrations/         # Alembic/SQL (ou Prisma si Node côté API)
```

### 3.2. Données & schémas clés (extrait)

* **User**(id, role: Élève|Parent|Coach|Admin, PII chiffrées au repos).
* **EleveProfil**(user_id FK, statut, niveau, établissement?, triplet 1re, doublet Tle, options, lva, lvb, cibles_postbac).
* **Epreuve**(type, date, coef, nature: écrit|écrit+pratique, statut “visible/masqué selon profil”).
* **Historique**(eleve_id, événement, payload JSONB, horodatage).
* **Competence**(référentiel, domaine, niveau 0-3, preuves[]).
* **Ressource**(type: cours/résumé/exo/vidéo, métadonnées, URL interne ou blob).
* **PlanRevision**(eleve_id, items[] {priorité, item, source, deadline}).
* **Session**(type visio/présentiel, coach_id, calendrier, réservation, paiement).
* **ParentLink**(parent_id, eleve_id, permissions).
* **Rapport**(périodicité, JSON/HTML/PDF, destinataires).
* **IndexRAG**(doc_id, chunks, embeddings, source, versioning).
* **Consentement**(RGPD, finalités, dépôt de preuves).

**Stockage** : PostgreSQL (JSONB intensif) + **pgvector** *ou* Qdrant/Milvus pour RAG ; S3-compatible (minio) pour blobs.

### 3.3. RAG local (packages/rag)

* **Ingestion** : PDF/Docs/Markdown (programmes, fiches maison, exos Eduscol, sujets bac), **chunking sémantique** (taille 400–800 tokens), versions & provenance.
* **Indexation** : embeddings (mxbai-embed-large, bge-m3, ou all-MiniLM en fallback), stockage vectoriel.
* **Retrieval** : hybrid (BM25 + vector) + reranking (FlashRank/E5-mistral) + **filtrage par profil** (niveau/statut/spécialités).
* **Génération** : agents consomment le retriever (citations + passages surlignés).
* **Évaluation** : jeu de requêtes “golden” (Exact Match, Faithfulness, Answer Correctness), coûts/latences tracés.

### 3.4. Multi-agents (packages/agents)

**Patron All-agentic** :

* **Supervisor** : reçoit objectif → planifie → assigne tâches aux **Specialist Agents** → agrège → valide politiques/risques.
* **Blackboard/Memory** : état partagé (profil, calendrier, compétences, historiques).
* **Event Bus** (Redis/NATS) : diffusion d’événements (bilan complété, jalon Parcoursup, note reçue, échéance proche).

**Agents** (MVP) :

1. **Onboarding-Agent** : collecte statut/niveau/EDS/options/contraintes → initialise profil/épreuves.
2. **Curriculum-Planner** : génère **PlanRevision** pondéré (coef × échéances × fragilités) ; propose ressources RAG.
3. **Assessment-Maker** : crée évaluations (QCM/no-calc, problèmes, sujets type bac), imprime **barèmes/méthodo**.
4. **OCR-Grader** : lit copies (Tesseract + layout) → notations critériées, feedback & axes de remédiation.
5. **Parcoursup-Advisor** : jalons, to-do, cohérence EDS↔vœux, génération d’ébauches (lettres/arguments).
6. **Oral-Coach** : scénarios Grand Oral, entraînement chronométré, **grille critériée** et pistes d’amélioration.
7. **Scheduler** : assemble calendrier (épreuves, révisions, sessions coach) + rappels.
8. **Parent-Reporter** : consolide KPI élève et envoie **rapport périodique**.

**V2** : Risk-Watcher (absentéisme/risque d’échec), Motivation-Nudger (micro-habitudes), Group-Matcher (groupe de pairs).

### 3.5. Sécurité & conformité

* **Chiffrement au repos** (PGP pour certains champs, KMS), **au transit** (TLS).
* **Cloisonnement** Parents/Coachs/Élèves (policy-as-code OPA/Cedar).
* **Pistes d’audit** (toutes les actions agents/humains).
* **RGPD** : base légale (contrat/intérêt légitime), minimisation, DSR (export/suppression), journal des consentements.
* **IA Safety** : filtrage injonctions, anti-hallucination (RAG + citations), *role-separation* entre agents.

---

## 4) Parcours & UX (écrans essentiels)

### 4.1. Élève (1re/Tle)

* **Accueil** : “ce qui compte cette semaine” (échéances + 3 actions suggérées).
* **Parcours & Épreuves** : calendrier + coefficients + checklist “prêt le jour J ?”.
* **Révisions** : plan dynamique (priorités, liens RAG), progression par compétence.
* **Évaluations** : examens blancs, QCM, sujets type bac ; correction & feedback.
* **Grand Oral** (Tle) : entrainements, grille, historique des prestations.
* **Parcoursup** (Tle) : jalons, vœux, lettres, attendus, contrôles de cohérence.
* **Ressources** : cours/résumés/méthodos, tags (spé, notion, difficulté).
* **Agenda** : visio/présentiel, réservation, communication coach.

### 4.2. **Candidat libre** (vue dédiée)

* Remplacement du CC par **évaluations ponctuelles**, **masquage** des pratiques si non organisées, **simulateur** de charge 6–8 semaines, modèle de **convocations**.

### 4.3. Parent

* **Vue 360°** : progression, derniers travaux, assiduité, prochaines échéances, réservations, alertes de risque ; téléchargement **Rapport Mensuel**.

### 4.4. Coach & Admin

* **Coach** : affectation élèves, préparation séances, dépôts de rapports, annotation de copies.
* **Admin** : contenus catalogues, mapping EDS↔ressources, gestion tarification, codes promo, gouvernance des agents.

---

## 5) Freemium & plans (proposition)

* **Gratuit**

  * Bilan initial (tests courts + profil), calendrier épreuves, 1 plan de révision **limité** (7 jours), quelques ressources RAG, 1 oral blanc **démo** (5 min), rapport parent **de bienvenue**.
* **Essentiel** (€/mois)

  * Plans illimités, ressources RAG étendues, 2 évaluations corrigées / mois (OCR-Grader), 1 session groupe/mois, tableau Parcoursup **complet**.
* **Premium** (€/mois)

  * * Oral-Coach illimité, 1 à 2 corrections copies **par matière** / mois, rendez-vous coach prioritaire, parents : **rapport mensuel** détaillé.
* **Pro** (forfaits “Terminale intensive” 3–4 mois)

  * Sprints hebdo, examens blancs, simulation Grand Oral, accompagnement Parcoursup **main-dans-la-main**.

**Opinion** : l’**accès gratuit** doit **vraiment aider** (sinon faible conversion). Offrir 1 plan sérieux + 1 oral blanc court crée la **preuve de valeur**.

---

## 6) APIs & contrats (extraits)

### 6.1. REST/GraphQL (FastAPI)

* `POST /onboarding/bilan`  → crée/maj profil + résultats diagnostics.
* `GET /parcours/epreuves`  → liste épreuves (filtrage par statut/niveau).
* `POST /plan/generate`     → génère plan de révision (profil + horizon).
* `POST /eval/generate`     → génère sujet (params: matière, durée, type).
* `POST /eval/grade`        → upload PDF → OCR-Grader → barème + feedback.
* `GET /rag/search`         → retrieval (q, filtres), retours cités.
* `GET /parent/report`      → rapport agrégé (PDF/HTML).
* `POST /sessions/book`     → réserver visio/présentiel (coach, créneau).

### 6.2. Webhooks/Events

* `student.bilan.completed`, `plan.updated`, `exam.graded`, `parcoursup.deadline.near`, `oral.session.recorded`.

---

## 7) Évaluation des agents & qualité

* **Hallucination** : tests “ground-truth + RAG only” ; taux de citations valides ≥ 95 %.
* **Usefulness** : sondages in-app (1-5) sur recommandations.
* **Learning** : delta score entre évaluations espacées (effet de révision).
* **Parcoursup** : taux d’achèvement des jalons.
* **Oral** : progression “grille critériée” (structure, clarté, argumentation).

---

## 8) CI/CD, E2E & Observabilité

### 8.1. Pipelines GitHub Actions (proposition)

* **`ci.yml`** : lint (ESLint/ruff), test unit (vitest/pytest), build.
* **`e2e.yml`** :

  * Build app (`apps/web`, `apps/api`) ;
  * Lancement serveur en arrière-plan ;
  * **E2E Playwright** (ou Cypress) headless sur Chrome for Testing ;
  * Artefacts : traces vidéo/screenshots, coverage.
* **`deploy.yml`** : images Docker (GHCR), tag/rollout (K8s/ArgoCD ou Docker Swarm au début).

### 8.2. Données de test & “goldens” RAG

* Jeux de Q/A pédagogiques (Maths/NSI) + réponses validées ; corpus Eduscol ; sujets bac.

### 8.3. Observabilité

* **OpenTelemetry** (traces agents, latences RAG), logs structurés, **Grafana** dashboards, alertes (SLI/SLO).

---

## 9) Sécurité, légalité, RGPD

* **PII**: chiffrement champ-à-champ (fernet/pgcrypto), rotation clés.
* **Consentements**: granularité (profilage pédagogique, stockage copies, partage parent).
* **Droits élèves**: export JSON/PDF du profil et historique ; purge.
* **Conformité**: registre de traitements, minimisation, DPA pour services tiers.

---

## 10) Lotissement & planning (indicatif)

| Sprint | Livrables majeurs                                                                   |
| ------ | ----------------------------------------------------------------------------------- |
| S1     | Onboarding + Bilan gratuit (API/UI), modèles data, premières règles scolarisé/libre |
| S2     | Parcours & Épreuves + Plan de révision (Curriculum-Planner) + RAG minimal           |
| S3     | Parcoursup (jalons/to-do) + Grand Oral (coach V1) + Parent dashboard                |
| S4     | OCR-Grader V1 + Sessions & réservations + Freemium & paiements + rapports parents   |

V2 (S5–S8) : Graphe de compétences connecté, correction enrichie, marketplace de sessions, analytics avancés.

---

## 11) Livrables & critères d’acceptation

* **Conformité parcours** 1re/Tle & scolarisé/libre (affichages, épreuves, jalons).
* **Bilan gratuit** opérationnel, enregistrant un **profil ré-utilisé** par les agents.
* **Plan de révision pondéré** reproductible (même profil → même plan).
* **RAG** avec citations + filtres profil (matière, spécialité, niveau).
* **Rapport parent** mensuel généré (PDF/HTML).
* **E2E verts** (scénarios critiques : onboarding, bilan, plan, réservation, rapport).
* **Sécurité** : export/suppression comptes (DSR), opt-in/opt-out parents.

---

## 12) Risques & parades

* **Données hétérogènes** (docs pédagogiques) → pipeline ingestion canonique + versioning.
* **Hallucinations** → RAG strict + refus gracieux si absence de source.
* **Complexité multi-agents** → commencer simple (4 agents MVP) + instrumentation + *playbooks*.
* **Charge support** → FAQs génératives + macros coachs + *rate limits*.
* **RGPD** → DPIA, minimisation, contrats de sous-traitance.

---

## 13) Ouvertures & questions

1. Confirmer la **référence officielle** des règles d’examen adoptées (année de session EAF Maths, modalités pratiques par spé pour candidats libres).
2. Valider la **priorisation freemium** (quels paywalls exacts ?) et la **politique d’essai**.
3. Choix **Playwright vs. Cypress** pour E2E (Playwright recommandé pour tests full-stack, vidéos & traces natives).
4. **Vector DB** : pgvector (simplicité) vs. Qdrant (perfs & filtres avancés).
5. **GPU** local/serveur pour OCR & modèles ? (ou externalisation).
6. **Calendrier Parcoursup** : source d’actualisation automatique (scraper officiel ou saisie admin ?).

---

## 14) Annexes — artefacts concrets

### 14.1. TypeScript — profil élève (extrait)

```ts
type Statut = "scolarise" | "individuel";
type Niveau = "Premiere" | "Terminale";
type Specialite = "Mathematiques"|"NSI"|"PC"|"SVT"|"SI"|"HGGSP"|"SES"|"HLP"|"LLCER"|"Arts"|"Autre";

interface ProfilEleve {
  id: string;
  statut: Statut;
  niveau: Niveau;
  anneeScolaire: "2025-2026";
  troncCommun: { francais?: boolean; philosophie?: boolean; hg: boolean; lva: string; lvb: string; es: boolean; eps: boolean; emc: boolean; };
  specialites: { premiere: Specialite[]; terminale?: Specialite[] };
  options: string[];
  orientation: { parcoursup: { statut: "non_ouvert"|"ouvert"|"voeux_en_cours"|"phase_principale"|"complementaire"; jalons: {code:string;date:string}[] } };
}
```

### 14.2. GitHub Actions — E2E (exemple Playwright)

```yaml
name: e2e
on: [push, pull_request]
jobs:
  e2e:
    runs-on: ubuntu-24.04
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: pass, POSTGRES_DB: nexus }
        ports: ["5432:5432"]
        options: >-
          --health-cmd="pg_isready -U postgres" --health-interval=10s
          --health-timeout=5s --health-retries=5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - name: Install web deps
        working-directory: apps/web
        run: npm ci
      - name: Install api deps
        working-directory: apps/api
        run: pip install -r requirements.txt
      - name: Start API
        working-directory: apps/api
        run: uvicorn app.main:app --host 0.0.0.0 --port 8000 &
      - name: Start Web
        working-directory: apps/web
        run: npm run build && npm start &
      - name: Install Playwright
        run: npx playwright install --with-deps
      - name: Run E2E
        working-directory: apps/web
        run: npx playwright test
      - name: Upload artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: apps/web/playwright-report
```

### 14.3. Ingestion RAG (pseudo-pipeline)

```python
# packages/rag/pipeline.py
def ingest(doc_path: str, meta: dict):
    text = extract_text(doc_path)        # pdfium/pymupdf
    chunks = semantic_chunk(text)        # 400–800 tokens, overlap=20%
    embs = embed(chunks)                 # mxbai/bge-m3
    index.upsert(chunks, embs, meta)     # version, provenance, matière, niveau
```

un dépôt Git prêt à pousser, avec l’historique initial (commit de départ) et deux artefacts pratiques :

ZIP du dépôt complet (incluant .git/)
👉 Télécharger le dépôt Git prêt à pousser

Bundle Git autonome (permet git clone sans dépendre du ZIP)
👉 Télécharger le bundle Git

Utilisation recommandée
Option A — à partir du ZIP (vous gardez la structure telle quelle)
# 1) Dézippez
unzip nexus_repo_git.zip
cd nexus_repo

# 2) Vérifiez le commit initial
git log --oneline

# 3) Poussez vers votre remote
git remote add origin git@github.com:<votre-org>/<votre-repo>.git
git branch -M main
git push -u origin main

Option B — à partir du bundle (workflow “offline → remote”)
# 1) Cloner depuis le bundle
git clone nexus_repo.bundle nexus_repo
cd nexus_repo

# 2) (Optionnel) vérifier le contenu
git log --oneline

# 3) Connecter un remote et pousser
git remote add origin git@github.com:<votre-org>/<votre-repo>.git
git branch -M main
git push -u origin main

Détails du commit initial

Auteur/Committer : Nexus Bootstrap <bot@nexus.local>

Message : chore: scaffold nexus (initial)

Contenu : scaffold FastAPI + SQLAlchemy/Alembic, OpenAPI, Docker compose, tickets Linear/Jira (CSV), arborescence complète prête au run (uvicorn) et à la migration (alembic upgrade head).



