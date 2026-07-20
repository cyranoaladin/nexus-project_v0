# Audit red team indépendant — synthèse exécutive

Date de constat : 2026-07-11 (Africa/Tunis)<br>
Dépôt : `nexus-project_v0`<br>
HEAD local : `db04d23f3e645a2052e41e5a679a8b9443cf8dc9`<br>
Branche constatée : `main` — branche attendue : `audit/bilans-phase0-independent`

## Verdict

**NO-GO pour commencer la phase suivante.** La phase 0 documentaire est exploitable comme travail préparatoire, mais elle ne constitue pas une preuve d'implémentation. Le registre curriculum est un module orphelin ; le cas `2035-2036` sélectionne silencieusement les programmes ouverts au lieu de produire `NO_MATCH`. Les sources ne sont ni archivées ni obligatoirement checksumées. Les chaînes Assessment/Diagnostic/Bilan/EAF/NPC/GeneratedPedagogicalReport restent parallèles. Les traitements critiques utilisent encore du `fire-and-forget` ou un job DB sans claim atomique, retry/backoff/DLQ. Les tests PostgreSQL réels sont `BLOCKED_NOT_VALIDATED` faute d'autorisation de démarrer la base éphémère.

La décision est fondée sur : inspection exhaustive du changeset local, lecture du cahier des charges et des annexes, analyse statique des routes/modèles/workflows, tests reproduits, vérification officielle des textes curriculum et observation production strictement en lecture seule. Voir `TEST_EVIDENCE.md` et `FINDINGS.csv`.

## Findings bloquants

- **P0-001 — programme de cohorte potentiellement incorrect** : `resolve-curriculum-context.ts:65-88` accepte toute année postérieure pour une entrée sans fin d'effet. Reproduction `npx tsx -e ...` : `2035-2036` retourne Première/Terminale 2026 au lieu de `NO_MATCH`.
- **P0-002 — traitement critique non durable** : `app/api/assessments/submit/route.ts:168-182` lance SSN et bilan hors attente ; `processGeneratedReportJob.ts:26-43` ne fait aucun claim atomique ; aucun worker BullMQ n'est déployé pour cette chaîne. Un redémarrage ou deux workers peuvent perdre ou dupliquer le travail.
- **P0-003 — autorisation de génération insuffisante** : `app/api/bilans/generate/route.ts:45-55,100-110,135-188` charge un bilan par identifiant sans filtre de propriété/assignation ; `app/api/bilans/route.ts:140-180` permet à un coach de créer un bilan pour un élève arbitraire. Impact : traitement inter-élèves et envoi potentiel de PII au LLM.

Les P1 couvrent notamment : branche non conforme, registre non branché, provenance curriculum incomplète, absence de convergence des modèles, fuite inter-audiences dans le résultat Assessment, ingestion publique fondée sur l'identité client, RAG sans provenance exploitable ni filtres de version, exposition LLM aux verbatims/chunks non fiables, stockage PDF non configuré, 12 vulnérabilités npm `high`, et intégration DB non validée.

## Preuves positives reproduites

- Curriculum : 3 suites, 15/15 tests passés.
- Lots ciblés : assessments 37/37 ; diagnostics 308/308 ; auth/RBAC 212/212 ; RAG/rapports 90/90.
- TypeScript, ESLint ciblé, ESLint global, Prisma validate, Prisma generate : succès.
- Build Next.js : succès, 143 pages statiques générées.
- Test unitaire global : 510 suites passées, 6 échecs initiaux dus à `EPERM`; les 6 suites sont repassées hors sandbox, 46/46 tests passés.
- Les cinq dépôts sources étaient propres au début ; leur contrôle final est consigné dans `TEST_EVIDENCE.md`.

## Action recommandée

Faire valider humainement ce rapport, créer/reprendre la branche attendue sans perdre le changeset, puis traiter les P0 dans un lot séparé après décision d'architecture. Avant toute phase suivante : ADR de convergence, spécification d'un registre serveur persistant et borné, matrice RBAC/audiences, worker durable, stockage objet privé, et campagne d'intégration sur PostgreSQL/Redis éphémères.
