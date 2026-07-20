# Handoff de contexte — prêt pour une nouvelle session GPT-5.6

## Finalité

Faire converger les bilans Nexus dans `nexus-project_v0`, intégré aux dashboards et à l'accompagnement humain. Cette reconstruction est documentaire ; aucun code applicatif, Prisma, route, composant, RAG, LLM ou worker n'a été modifié.

## Baseline

- workspace : `/home/alaeddine/Projets/nexus-bilans-workspace` ;
- cible : `nexus-project_v0` ; branche `fix/bilans-p0-curriculum` ; HEAD de reconstruction `db04d23f3e645a2052e41e5a679a8b9443cf8dc9` ;
- cahier : 2278 lignes, SHA256 `121fe7ad9bb0bd453a2e46ef69ba9bf18f694c7f7c4a7a12c0c443d7eb82ea85` ;
- production lue le 11/07/2026 : `main@1b8219b1cfcfe63354d8cb4035645143e27e5a43`, Next PM2, Postgres/Chroma/Ollama/ingestor Docker.

Le worktree contenait avant cette reconstruction des modifications utilisateur : `.gitignore`, curriculum `lib/` + tests et tous les documents Bilans/audit-phase0 non suivis. Les préserver.

## Corpus lu et inspecté

Lecture intégrale : `Cahier_charges.md`; audit externe Markdown, DOCX converti en texte, inventaire CSV, templates assessment/RAG et backlog de `nexus_bilans_audit`; tous les documents de premier niveau `docs/bilans`, ADR-001 et l'ensemble de `docs/bilans/audit-phase0`, notamment executive summary, GO/NO-GO, findings, traçabilité, frontend/backend, données/workflows, RAG/LLM/agents, sécurité, curriculum, tests et dépendances. Les findings ont été recoupés avec le code.

Règles lues : `AGENTS.md`, toutes les `.clinerules`, workflows `.cline` et skills dépôt applicables. Configuration inspectée : `package.json`, TypeScript/Next/instrumentation/middleware, environnement exemple, Prisma, Dockerfiles/Compose, GitHub Actions, scripts/runbooks de déploiement, health et documentation d'exploitation.

Code inspecté : dashboards des cinq rôles, composants Assessment/Diagnostic/Bilan/questionnaires/PDF, toutes les routes inventoriées dans `ROUTE_INVENTORY.csv`, guards/RBAC, scorers, générateurs, rapports stage, RAG, clients LLM, NPC worker, curriculum et tests associés. Sources lues en lecture seule : `Interface_Maths_2025_2026`, `Interface_NSI_Bilan_Support_Suivi`, `Interface_Maths_2025_2026_Fixed`, `nexus-reussite-app` et `NSI_cours_accompagnement`, avec inspection ciblée de leurs schémas, routes, workers, RAG, correction, rapports et documentation métier.

## Acteurs et métier

Rôles actuels : admin, assistante, coach, parent, élève. Enseignant/responsable pédagogique sont requis par le métier mais non modélisés. Parent peut avoir plusieurs enfants ; chaque élève n'a qu'un `parentId`, insuffisant. Coach par assignment actif. Système/worker/RAG/LLM sont des principals/services bornés, pas des acteurs autorisés à publier.

Parcours : session → assignment selon année/classe/voie/spécialités/options/curricula → attempt autosave/reprise → submit idempotent → score/evidence déterministes immédiats → job enrichissement → revue → publications séparées élève/parent. Parent choisit un enfant lié et ne voit que `PARENT` publié. Nexus exploite evidence et plan de séances.

## Architecture actuelle

Chaînes séparées : Assessment public, Diagnostic Pallier2, Bilan générique, StageBilan, EAF/Maths stages, GeneratedPedagogicalReport et NPC. `Bilan` n'est pas réellement canonique. Assessment/Bilan utilisent fire-and-forget ; stage job n'a pas lease/retry ; NPC retry est non claimable. RAG réel client/prod = FastAPI/Chroma, malgré docs pgvector. Fournisseurs : Ollama, Mistral, Chutes, OpenAI/compatible ; Gemini seulement source prototype.

Frontend : portails publics autonomes, dashboards spécialisés, pas de catalogue/tentative générique. Navigation élève Bilan pointe vers page Diagnostic incohérente. Parent n'a pas de bibliothèque audience-safe. Coach a des écrans dupliqués.

## P0 confirmés

1. POST Bilan/generate sans assignment complet ;
2. fire-and-forget/jobs non durables ;
3. curriculum `2035-2036` accepté ;
4. audiences mélangées ;
5. solutions Assessment dans bundle client ;
6. `__NSP__` devient incorrect ;
7. scoring Zod invalide seulement loggé ;
8. identité/ownership email legacy.

## Architecture cible validée par la demande

```text
DiagnosticDefinition → AssessmentAttempt → AssessmentResponse → SkillEvidence
→ ScoringRun → ScoreSnapshot → ReportJob → ReportVersion
→ HumanReview → ReportPublication
```

Quatre machines d'état : assignment, attempt/scoring, job, report/review/publication. Score immutable et disponible même si RAG/LLM/PDF échoue. Version unique par audience, fallback déterministe, guardian link N–N, outbox/idempotence, artefacts privés. Adapters pour toutes les chaînes historiques ; NPC reste producteur de preuves distinct.

## Choix validés / non validés

Validés : une app, pas de portail parallèle, score sans LLM, RAG cité, jobs durables, revue parent, publication audience, migration additive et dashboards existants.

Non validés : D01 détails modèle, capacités/rôles, guardian verification, queue DB/BullMQ, Chroma/pgvector, embeddings, fournisseur LLM, objet S3, rétention, horizon et pilote. Lire `18_DECISIONS_REQUIRED.md`.

## Fichiers clés

- vérité métier : `../Cahier_charges.md` depuis le workspace ;
- Prisma : `prisma/schema.prisma` ;
- Assessment : `app/api/assessments/submit/route.ts`, `components/assessment/AssessmentRunner.tsx`, `lib/assessments/` ;
- Diagnostic : `lib/diagnostics/score-diagnostic.ts`, `app/api/diagnostics/` ;
- Bilan : `app/api/bilans/`, `lib/bilan/`, `lib/rbac/bilan-access.ts` ;
- stage reports : `lib/reports/stage/`, `app/api/coach/students/` ;
- NPC : `services/npc-worker/index.ts`, `app/api/npc/` ;
- RAG : `lib/rag-client.ts` ; curriculum : `lib/curriculum/` ;
- dashboards : `app/dashboard/{eleve,parent,coach,admin,assistante}` ;
- audit : `docs/bilans/audit-phase0/` et ce dossier.

## Preuves exécutées

```text
10 suites Jest / 63 tests : PASS (mocks/unitaires ciblés)
npm run typecheck : PASS
npx prisma validate avec URL factice : PASS
resolveCurriculumContext(2035-2036) : retourne une version, défaut reproduit
```

Ne pas transformer ces résultats en preuve DB/RAG/LLM/E2E. Tests DB réels requièrent PostgreSQL ; RAG tests mockent fetch ; routes mockent Prisma/auth ; Playwright requiert environnement complet.

## Ordre d'implémentation

A décisions → B sécurité existante → C curriculum → D base additive → E scoring/evidence → F worker → G RAG/LLM → H publication/PDF → I dashboards → J banques. Commencer par B après validation A, pas par Prisma.

## Interdictions

Ne pas modifier les cinq dépôts sources, ne pas déployer/commit/push, ne pas toucher production en écriture, ne pas importer PII JSON, ne pas démarrer services réels sans autorisation, ne pas étendre `Bilan` en chaîne parallèle, ne pas calculer le score par LLM, ne pas exposer plusieurs audiences.

## Commandes de reprise

```bash
git branch --show-current
git rev-parse HEAD
git status --short --untracked-files=all
find docs/bilans/context-reconstruction -maxdepth 1 -type f | sort
npm test -- --runInBand __tests__/api/assessments-submit.test.ts __tests__/api/bilans.idor.test.ts __tests__/api/bilans/generate.test.ts
npm run typecheck
```

Avant Lot B, écrire les tests PostgreSQL réels et ne pas lancer la DB sans approbation.

## Prochaine instruction prête à transmettre

> Reprends `nexus-project_v0` à partir de `docs/bilans/context-reconstruction/19_CONTEXT_HANDOFF.md`, puis lis `16_RISKS_AND_BLOCKERS.md`, `17_IMPLEMENTATION_SEQUENCE.md`, `18_DECISIONS_REQUIRED.md`, `ROUTE_INVENTORY.csv` et les règles `AGENTS.md`/`.clinerules`. Exécute uniquement le Lot A final + Lot B sécurité existante : formalise l'ADR de convergence et la matrice d'audience, écris d'abord des tests rouges (dont PostgreSQL réel après autorisation) pour l'ownership coach/parent/élève, la projection mono-audience, l'absence de solutions dans le bundle, `DONT_KNOW` non pénalisé et le scoring fail-closed ; puis applique les corrections minimales aux chaînes existantes. Ne crée encore aucun modèle/migration canonique, ne branche ni curriculum, RAG, LLM, worker ou nouveau frontend, ne modifie aucun dépôt source, et fournis preuves, diff et rollback.
