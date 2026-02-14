# Prompt Audit — Pipeline Bilan Diagnostic Pré-Stage Maths

## Contexte

Tu vas auditer le pipeline complet du **Bilan Diagnostic Pré-Stage Mathématiques** de la plateforme **Nexus Réussite** (nexusreussite.academy). Ce pipeline permet à un élève de Première spécialité Maths (programme français, lycée en Tunisie) de remplir un formulaire diagnostic, d'obtenir un scoring automatique, puis un bilan personnalisé généré par IA (Ollama/llama3.2 local + RAG ChromaDB).

Le projet est un monorepo **Next.js 13+ App Router** en TypeScript strict, avec Prisma/PostgreSQL, Tailwind CSS, et un design system dark custom.

---

## Stack technique

- **Framework** : Next.js 14 (App Router, `src/app/`)
- **Langage** : TypeScript strict
- **ORM** : Prisma + PostgreSQL
- **Validation** : Zod
- **UI** : Tailwind CSS + design system custom (tokens dans `globals.css`) + shadcn/ui + Lucide icons
- **LLM** : Ollama (llama3.2:latest, CPU, local server)
- **RAG** : ChromaDB + FastAPI Ingestor (nomic-embed-text)
- **Infra** : Docker Compose, Nginx reverse proxy, serveur Hetzner dédié

---

## Arborescence des fichiers à auditer

### 1. PAGES FRONTEND — Formulaire, Résultat, Dashboard

```
app/bilan-pallier2-maths/
├── page.tsx                          # Formulaire diagnostic (7 étapes, ~538 lignes)
│                                     # Saisie : identité, contexte scolaire, performance,
│                                     # chapitres, compétences (5 domaines × N skills),
│                                     # épreuve anticipée (mini-test, auto-évaluations, signaux),
│                                     # méthodologie, ambition, questions ouvertes, texte libre
│
├── layout.tsx                        # Layout de la section bilan-pallier2-maths
│
├── confirmation/
│   └── page.tsx                      # Page de confirmation post-soumission
│                                     # Affiche le scoring résumé + lien vers le bilan complet
│
├── resultat/
│   └── [id]/
│       └── page.tsx                  # Page de consultation du bilan (~580 lignes)
│                                     # 3 onglets : Élève / Parents / Nexus
│                                     # Scoring cards, barres de progression par domaine,
│                                     # alertes, markdown→HTML pour élève/parents,
│                                     # onglet Nexus structuré (fiche identité, scores,
│                                     # tableau domaines, épreuve anticipée, profil cognitif,
│                                     # ambition, verbatims, alertes)
│
└── dashboard/
    └── page.tsx                      # Tableau de bord gestionnaire Nexus (~278 lignes)
                                      # Liste tous les diagnostics avec :
                                      # - 6 cartes stats (total, analysés, P2 confirmé, etc.)
                                      # - Recherche par nom/email
                                      # - Filtres par recommandation
                                      # - Tableau : élève, statut, readiness, risque, reco, date
                                      # - Lien vers chaque bilan individuel
```

### 2. API ROUTES

```
app/api/bilan-pallier2-maths/
└── route.ts                          # API principale (~177 lignes)
                                      # POST : validation Zod → scoring → save DB (SCORED)
                                      #        → RAG search → 3× Ollama LLM séquentiels
                                      #        → update DB (ANALYZED) + analysisResult JSON
                                      # GET ?id=xxx : retourne un diagnostic complet
                                      # GET (sans id) : liste tous les diagnostics avec scoring

app/api/bilan-gratuit/
└── route.ts                          # API bilan gratuit (inscription parent+élève, ~146 lignes)
                                      # Transaction Prisma : create User parent + Student + profiles
```

### 3. LOGIQUE MÉTIER (lib/)

```
lib/
├── validations.ts                    # Schéma Zod `bilanDiagnosticMathsSchema` (lignes ~172-260)
│                                     # Définit la structure complète des données du formulaire :
│                                     # identity, schoolContext, performance, chapters,
│                                     # competencies (5 domaines × array de competencyItemSchema),
│                                     # openQuestions, examPrep (miniTest, selfRatings, signals),
│                                     # methodology, ambition, freeText
│                                     # + type TypeScript BilanDiagnosticMathsData
│
├── bilan-scoring.ts                  # Moteur de scoring (~267 lignes)
│                                     # computeScoring() → ScoringResult :
│                                     #   - ReadinessScore (moyenne pondérée des domaines)
│                                     #   - RiskIndex (100 - performance épreuve anticipée)
│                                     #   - Recommendation (Pallier2_confirmed/conditional/Pallier1)
│                                     #   - DomainScores[] (score, gaps, errors, priority par domaine)
│                                     #   - Alerts[] (HIGH_STRESS, WEAK_AUTOMATISMS, PANIC_SIGNAL, etc.)
│                                     #   - DataQuality (activeDomains, evaluatedCompetencies, lowConfidence)
│
├── bilan-generator.ts                # Pipeline de génération LLM (~372 lignes)
│                                     # generateBilans() :
│                                     #   1. prepareLLMContext() → résumé textuel des données
│                                     #   2. buildRAGQueries() → requêtes sémantiques (domaines faibles, erreurs)
│                                     #   3. ragSearch() → contexte pédagogique ChromaDB
│                                     #   4. 3× generateSingleBilan() séquentiels (élève, parents, nexus)
│                                     #   5. Fallback templates si LLM échoue
│                                     # Prompts système par audience (AUDIENCE_PROMPTS)
│                                     # BILAN_SYSTEM_PROMPT (prompt monolithique, non utilisé actuellement)
│
├── ollama-client.ts                  # Client HTTP Ollama (~176 lignes)
│                                     # ollamaChat() : POST /api/chat avec model, messages, temperature
│                                     # ollamaGenerate() : POST /api/generate
│                                     # ollamaHealthCheck() : GET /api/tags
│                                     # Gestion timeout, retry, parsing streaming response
│
└── rag-client.ts                     # Client RAG Ingestor (~120 lignes)
                                      # ragSearch() : POST /search vers FastAPI Ingestor
                                      # ragHealthCheck() : GET /health
                                      # buildRAGContext() : formate les hits en contexte pour le LLM
                                      # Collection : ressources_pedagogiques_terminale
```

### 4. BASE DE DONNÉES

```
prisma/
└── schema.prisma                     # Modèle Diagnostic (lignes ~775-812)
                                      # Champs : id, type, studentFirstName, studentLastName,
                                      # studentEmail, studentPhone, establishment, teacherName,
                                      # mathAverage, specialtyAverage, bacBlancResult, classRanking,
                                      # data (Json), status, analysisResult, actionPlan,
                                      # createdAt, updatedAt
                                      # Index sur [type, status] et [studentEmail]
                                      # Table SQL : "diagnostics"
```

### 5. INFRASTRUCTURE

```
docker-compose.yml                    # Services : nexus-next-app + nexus-postgres-db
                                      # Réseau externe infra_rag_net pour accès Ollama/RAG
                                      # Env vars : OLLAMA_URL, RAG_INGESTOR_URL, OLLAMA_MODEL

Dockerfile                            # Build multi-stage Next.js standalone
                                      # ENV HOSTNAME=0.0.0.0 (binding réseau)
```

### 6. TESTS

```
__tests__/
├── api/bilan-gratuit.test.ts                 # Tests unitaires API bilan gratuit
├── lib/bilan-gratuit-form.test.tsx           # Tests formulaire bilan gratuit
├── lib/validations.test.ts                   # Tests schéma Zod
├── lib/validations.extra.test.ts             # Tests supplémentaires validations
├── lib/diagnostic-form.test.tsx              # Tests logique formulaire diagnostic
└── components/diagnostic-form.test.tsx       # Tests composant formulaire diagnostic

tests/pages/
└── bilan-gratuit.page.test.tsx               # Tests page bilan gratuit

e2e/
└── bilan-gratuit-flow.spec.ts                # Test E2E Playwright flux bilan gratuit
```

### 7. COMPOSANTS UI PARTAGÉS

```
components/ui/
└── diagnostic-form.tsx               # Composant réutilisable du formulaire diagnostic
```

### 8. DESIGN SYSTEM

```
app/globals.css                       # Tokens CSS custom (~1047 lignes)
                                      # Variables : --color-surface-*, --color-neutral-*,
                                      # --color-brand-*, --color-semantic-*
                                      # Documentation WCAG 2.1 AA/AAA intégrée (lignes 136-214)
                                      # Classes utilitaires : .card-dark, .btn-primary, etc.
```

### 9. DOCUMENTATION

```
docs/
├── BILAN_DIAGNOSTIC_MATHS_V1.3.md   # Spécification V1.3 (version courante)
├── BILAN_PALLIER2_MATHS_V1.1.md     # Spécification V1.1
├── BILAN_PALLIER2_MATHS_V1.2.md     # Spécification V1.2
└── BILAN_PALLIER2_MATHS_COMPLET.md  # Documentation complète du pipeline
```

---

## Flux de données (Workflow complet)

```
[1] Élève remplit le formulaire
    → app/bilan-pallier2-maths/page.tsx

[2] Soumission POST /api/bilan-pallier2-maths
    → app/api/bilan-pallier2-maths/route.ts

[3] Validation Zod
    → lib/validations.ts (bilanDiagnosticMathsSchema)

[4] Calcul du scoring
    → lib/bilan-scoring.ts (computeScoring)
    → ReadinessScore, RiskIndex, Recommendation, DomainScores, Alerts

[5] Sauvegarde initiale en DB (status: SCORED)
    → prisma/schema.prisma (model Diagnostic)

[6] Recherche RAG (contexte pédagogique)
    → lib/rag-client.ts → ChromaDB via Ingestor FastAPI

[7] Génération LLM (3 bilans séquentiels)
    → lib/bilan-generator.ts → lib/ollama-client.ts → Ollama/llama3.2
    → Audiences : élève (tutoiement), parents (vouvoiement), nexus (technique)
    → Fallback templates si LLM échoue

[8] Mise à jour DB (status: ANALYZED, analysisResult: JSON)

[9] Redirect vers confirmation
    → app/bilan-pallier2-maths/confirmation/page.tsx

[10] Consultation du bilan
     → app/bilan-pallier2-maths/resultat/[id]/page.tsx
     → GET /api/bilan-pallier2-maths?id=xxx

[11] Dashboard gestionnaire
     → app/bilan-pallier2-maths/dashboard/page.tsx
     → GET /api/bilan-pallier2-maths (liste complète avec scoring)
```

---

## Points d'attention pour l'audit

1. **Sécurité** : L'API GET liste tous les diagnostics sans authentification. Le dashboard n'est pas protégé par RBAC.
2. **Performance** : La génération LLM bloque la réponse HTTP (~2-3 min). Pas de queue/worker.
3. **Validation** : Vérifier la couverture du schéma Zod vs les données réellement envoyées par le formulaire.
4. **Scoring** : Vérifier les pondérations (DOMAIN_WEIGHTS) et les seuils de décision (ReadinessScore ≥ 60, RiskIndex ≤ 55).
5. **LLM** : Les prompts sont en dur dans `bilan-generator.ts`. Pas de versioning des prompts.
6. **RAG** : La collection ChromaDB est vide (pas encore ingérée). Le pipeline fonctionne sans RAG (fallback gracieux).
7. **UI/UX** : Le design system utilise des tokens custom (`surface-*`, `neutral-*`, `brand-*`, `semantic-*`). Vérifier la cohérence WCAG.
8. **Tests** : Pas de tests unitaires pour `bilan-scoring.ts` ni `bilan-generator.ts`. Pas de test E2E pour le flux pallier2.
9. **Types** : Le champ `data` en `Json` dans Prisma perd le typage TypeScript côté DB.
10. **Error handling** : Vérifier les cas limites (Ollama down, timeout, données partielles).

---

## URLs de test (production)

- **Formulaire** : https://nexusreussite.academy/bilan-pallier2-maths
- **Dashboard** : https://nexusreussite.academy/bilan-pallier2-maths/dashboard
- **Exemple bilan** : https://nexusreussite.academy/bilan-pallier2-maths/resultat/cmlm7fr700001o901e9ck68el
