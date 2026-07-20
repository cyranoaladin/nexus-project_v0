# Inventaire des dépôts et composants bilans

## Méthode

L'inventaire combine : fichiers suivis par Git, recherches `rg`, lecture des routes/services/schémas/tests, audit fourni et vérification des chemins effectifs. Les README n'ont pas été utilisés comme seule preuve. Les dépendances vendoriées, environnements virtuels et binaires sans lien avec le périmètre ne sont pas assimilés à des composants applicatifs.

## Dépôt canonique : `nexus-project_v0`

Échelle observée : 2 256 fichiers suivis, 176 routes API, 540 fichiers de tests unitaires/spécifications, 45 répertoires de migrations Prisma.

### Moteur Assessment universel

- `app/api/assessments/submit/route.ts` : validation Zod, chargement versionné des questions, scoring déterministe, persistance Assessment/DomainScore, puis deux traitements `fire-and-forget`.
- `lib/assessments/core/*` : types et schémas runtime, mais les réponses ne distinguent que `correct | incorrect | nsp`; le statut `NOT_STUDIED` n'est pas canonique ici.
- `lib/assessments/questions/*` : 17 fichiers TypeScript de banque/loader pour Maths, NSI et diagnostic général.
- `lib/assessments/scoring/*` : fabrique et stratégies Maths/NSI/générique.
- `lib/assessments/generators/index.ts` : trois audiences et fallback de disponibilité, mais exécution liée à la requête.

### Moteur Diagnostic pré-stage

- `lib/diagnostics/types.ts` : `DiagnosticDefinition`, indices Mastery/Coverage/ExamReadiness, priorités, incohérences et politiques RAG.
- `lib/diagnostics/definitions/*` : huit définitions concrètes, plus alias legacy ; Maths/NSI Première-Terminale et STMG.
- `programmes/mapping/*.yml` : mappings de compétences et chapitres, non datés par cohorte.
- `lib/diagnostics/score-diagnostic.ts` : exclusion de `not_studied` et `unknown` de la maîtrise, couverture séparée, règles d'incohérence.
- `lib/diagnostics/bilan-renderer.ts` : fallback Markdown déterministe multi-audiences.
- `app/api/bilan-pallier2-maths/*` : flux spécialisé legacy et retry staff.

### Rapports et PDF

- `Bilan` est annoncé comme modèle canonique, mais `Diagnostic`, `Assessment`, `StageBilan`, `PedagogicalReport` et `GeneratedPedagogicalReport` coexistent.
- `lib/reports/stage/*` : checksum, complétude, contexte, sortie Mistral structurée, Zod, rendu LaTeX, compilation durcie et stockage configurable.
- `components/dashboard/coach/GeneratedReportsPanel.tsx` : suivi des états pour coach.
- Les tests couvrent checksum, complétude, déduplication, LaTeX, stockage et routes coach.

### RAG

- `lib/rag-client.ts` est le client canonique ChromaDB/FastAPI.
- `docs/RAG_ARCHITECTURE.md` désactive pgvector applicatif mais un champ historique reste dans la base.
- L'ingestion ChromaDB est hors dépôt ; aucun manifeste de gouvernance complet n'est encore intégré.

### Famille/RBAC

- `ParentProfile` et `Student` existent, avec tests d'ownership parent/enfant et IDOR.
- La relation actuelle est un parent direct par élève ; elle ne couvre pas le modèle plusieurs responsables légaux avec statut, vérification, révocation et permissions par lien.

### Programmes

- Des PDF et mappings existent sous `programmes/`.
- `lib/programme/official-pdfs.ts` est un registre d'exposition, encore vide.
- Aucun resolver `(année scolaire, niveau cible, voie, variante) -> programme préalable + programme cible` n'existe.

## Source : `Interface_NSI_Bilan_Support_Suivi`

- `apps/worker/src/index.js` (1 585 lignes) : BullMQ, cinq tentatives, backoff exponentiel, DLQ, métriques Prometheus, RAG pgvector, LLM multi-provider, React-PDF et S3. Le fichier loggue toutefois identité élève, scores et extraits de payload, et concentre trop de responsabilités.
- `apps/web/src/lib/questionnaire.ts` : chargement synchrone par chemins physiques (`process.cwd()` ou `/app`), non portable vers le catalogue canonique.
- `scripts/ingest_rag.ts` : scan de dossiers, chunking fixe de 1 200 caractères, pgvector et padding possible avec zéros ; incompatible avec la gouvernance ChromaDB cible.
- `scripts/check_rag_sources.ts` : intentions de validation de sources réutilisables sous forme de manifeste.
- `data/questionnaire_nsi_terminale.final.json` et Première : contenu à convertir puis revoir pédagogiquement, jamais à publier directement.
- `prisma/schema.prisma` : Student/Attempt/Score/Report/Bilan/Evaluation/Notion/Exercise/Quiz, redondants avec le dépôt canonique.

## Source : `Interface_Maths_2025_2026`

- Portail statique dupliqué sous `var-www/maths` et un chemin imbriqué `var-www/maths.labomaths.tn/...`; composants à archiver.
- `opt/math-correction/backend/app/services/grading_service.py` : notation guidée par rubric, JSON LLM et indicateurs de confiance ; le score reste toutefois issu du LLM et exige un contrat de preuve/human review avant portage.
- `audit_service.py` : agrège confiance, incohérences, questions manquantes et besoin de revue humaine ; bon modèle d'inspiration pour `EvidenceQuality`.
- `report_service.py` et le routeur corrections : rapports structurés, workflow de correction et validation humaine à adapter.
- Les JSON historiques contiennent potentiellement des identités ; ils sont exclus du RAG tant qu'anonymisation, licence et base légale ne sont pas validées.

## Source : `Interface_Maths_2025_2026_Fixed`

- `site/assets/js/student.js` charge des JSON et cherche successivement l'élève par email, nom complet normalisé puis inclusion textuelle globale. Ce matching présente un risque d'exposition croisée et doit être remplacé par ownership serveur.
- `site/assets/js/dashboard.js` fournit une référence d'affichage enseignant mais n'apporte pas de moteur sécurisé.
- Les JSON `bilans_eval1second_degre*` et le gabarit Markdown peuvent servir de fixtures anonymisées et de contrat de rendu après revue.

## Source : `nexus-reussite-app`

- Les fichiers `feuille_route/*` définissent rôles, parcours et direction UI.
- Aucun pipeline complet questionnaire → scoring → preuve → rapport n'a été identifié.
- Le code Next.js/Prisma ne doit pas être fusionné ; usage comme spécification et inspiration UX/RBAC.

## Source : `NSI_cours_accompagnement`

- `QuizSystem.jsx` contient des questions hardcodées, un score local et aucun stockage/versionnement canonique.
- `openai_integration.py` concentre prompts tutorat/évaluation/quiz et propose un mode simulation ; il ne doit pas être repris comme correcteur officiel.
- Les routes OpenAI et générateur documentaire sont legacy.
- Les cours et documents sont candidats au RAG seulement après déduplication, vérification de licence, version, exactitude et absence de PII.

## Annexes d'audit

Les sept fichiers attendus sont présents. Les six fichiers contenus dans le ZIP ont les mêmes SHA-256 que leurs versions extraites. Le DOCX rendu fait 25 pages ; sa structure et ses tableaux sont cohérents avec le Markdown. Aucun `MISSING_INPUTS.md` n'est nécessaire.
