# Séquence d'implémentation

Ce plan est additif, réversible et découpé en PR petites. Chaque lot commence par tests d'acceptation et se termine par revue, preuves et mise à jour ADR. Aucun lot ne supprime une chaîne historique.

## Lot A — Contexte et décisions

Valider ce dossier ; ADR convergence et machines d'état ; glossaire ; threat model ; matrice d'audience ; décisions D01–D12 ; modèle logique sans migration. **Sortie** : GO signé pour le Lot B et choix différés explicites.

## Lot B — Sécurité existante

Tests rouges PostgreSQL IDOR pour création/génération Bilan, ownership coach/parent/élève et projections. Dériver identité de session, vérifier assignment actif, corriger les deux conventions coach ID, séparer audiences, retirer solutions du client, corriger NSP, rendre la validation scoring fail-closed, sécuriser suppression/publication. **Rollback** : flags de route/compatibilité, aucune donnée transformée. **Gate** : tests DB réels + unitaires + bundle.

## Lot C — Curriculum

Horizon borné, sources archivées/checksums, variantes/matières, snapshots et workflow de revue. Ne brancher qu'après revue pédagogique. **Gate** : refus années inconnues, absence/ambiguïté explicites, dates d'effet et tests de cohorte.

## Lot D — Base canonique

Modèles additifs seulement : definitions/assignments/attempts/responses, legacy links, jobs, reports/reviews/publications, guardian links/outbox/audit. Migrations expand-only, contraintes et feature flags. Backfill à sec, checksums et shadow read. **Gate** : migrate fresh + upgrade + rollback applicatif + volumétrie.

## Lot E — Scoring et preuves

Taxonomie, `SkillEvidence`, moteur/règles versionnés, `ScoringRun`, snapshot immutable, catalogue de fallback. Adapters Assessment/Diagnostic. **Gate** : unit/property/golden, transactions et reproduction stable.

## Lot F — Worker durable

Outbox/queue décidée, claim CAS, lease/heartbeat, retries/backoff/jitter, DLQ, idempotence, métriques et admin opérationnel minimal. **Gate** : deux workers, crash, lease expiré, duplicate delivery, DLQ/requeue.

## Lot G — RAG et LLM

Audit runtime/config/corpus, ADR backend, contrat RAG typé, manifest/citations, injection defenses, PII minimisée, structured output, Evidence IDs, prompt/model checksums, timeouts/retries et fallback. **Gate** : contract tests, corpus golden, fournisseur simulé puis staging autorisé.

## Lot H — Publication

`ReportVersion`, revue, approbation/rejet, publication par audience, révocation, artefact privé et PDF durable. **Gate** : aucun cross-audience, URL expirée, version immuable, parent exige revue, restore artefact.

## Lot I — Frontend intégré

Catalogue et tentative sous dashboard élève, autosave/reprise, résultat déterministe, progression du rapport ; enfant/rapports parent ; dossier/revue coach ; admin catalogue/DLQ. Accessibilité et erreurs typées. **Gate** : Playwright desktop/mobile/axe et reprise réseau.

## Lot J — Diagnostics et banques

Par cohorte : Seconde, Première, Terminale ; par matière : Maths, PC, NSI/SNT, Français ; variantes. Revue pédagogique, pilote, analyse des items et amélioration versionnée. Ne jamais publier toutes les banques simultanément sans preuve.

## Ordre de déploiement

Sécurité B peut précéder schéma D. Curriculum C se construit avant définitions mais se branche après ses gates. D → E → F est séquentiel. G peut progresser en contrat après décision, sans bloquer fallback. H précède toute publication parent. I s'active par cohorte après D–H. J livre une définition pilote Maths Seconde, puis élargit.

## Commandes de validation types

```bash
npm run typecheck
DATABASE_URL='postgresql://…test…' npx prisma validate
npm test -- --runInBand <suites-unitaires-ciblées>
npm run test:integration
npm run test:e2e
npm run build
```

Les trois dernières nécessitent l'environnement autorisé. Avant production : backup/restore drill, migration status, smoke RBAC, health queue/RAG/storage, canary et rollback documenté.
