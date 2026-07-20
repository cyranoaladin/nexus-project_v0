# Décision formelle GO / NO-GO

Verdict global : **NO-GO pour commencer la phase suivante**.

| Axe | Décision | Preuves | Conditions / blocages | Propriétaire recommandé | Prochaine action |
|---|---|---|---|---|---|
| 1. Phase 0 documentaire | GO SOUS CONDITIONS | documents/ADR lus; inventaire et plan existent; changeset complet dans `CHANGESET_INVENTORY.md` | branche incorrecte; plusieurs affirmations documentaires ne correspondent pas au code/production | Tech lead + product owner | valider/corriger les documents sans les confondre avec une implémentation |
| 2. Registre curriculum | NO-GO | 15/15 tests mais reproduction 2035 incorrecte; module sans usage; sources non archivées | P0-001, P1-002, P1-003, P2-001 | référent programmes + backend | politique de bornes, provenance officielle, tests négatifs puis branchement |
| 3. Compatibilité architecture | NO-GO | `rg` sans import runtime; modèles/workflows parallèles | aucune ADR convergence; server-only/persistence/snapshot absents | architecte + backend lead | adopter l'architecture Attempt/Evidence/ScoreSnapshot/ReportVersion/Publication |
| 4. Préparation frontend | NO-GO | dashboards inspectés; aucun parcours diagnostic générique | pas catalog/autosave/reprise/polling; rôles enseignant/RP absents | frontend lead + UX/accessibilité | concevoir dans les dashboards existants après contrat backend |
| 5. Préparation backend | NO-GO | submit/generate/result inspectés | IDOR assignation, identité client, audiences, transaction/idempotence | backend + security | fermer P0-002/P0-003 et P1-004/P1-005 |
| 6. Préparation base de données | NO-GO | Prisma validate/generate passent; schéma cartographié | intégration DB `BLOCKED_NOT_VALIDATED`; convergence/migration absentes | data/backend | ADR, migrations additives, DB éphémère, backfill dry-run |
| 7. Préparation RAG | NO-GO | Chroma production healthy; client/tests unitaires inspectés | dimensions/collections divergentes, filtres/citations/injection absents | RAG owner + curriculum owner | contrat metadata/version/citations, test corpus et dimension |
| 8. Préparation LLM | NO-GO | fournisseurs et contrats inventoriés; Mistral structuré partiel | PII, outputs Ollama libres, grounding/fallback/prompt injection incomplets | AI safety + privacy | minimisation, schémas, citations, fallback, model/prompt trace |
| 9. Préparation worker | NO-GO | fire-and-forget et job DB examinés | pas claim/lease/retry/backoff/DLQ; pas worker futur observé | platform/backend | choisir queue durable, implémenter statuts et tests de chaos |
| 10. Préparation sécurité | NO-GO | guards/ownership/PDF/menaces audités | P0-003; audience et identité; tests IDOR DB bloqués; PII | security/privacy/DPO | threat model validé, DTO audience, tests DB, DPIA/rétention |
| 11. Préparation production | NO-GO | production PM2/Chroma/Ollama/Postgres observée read-only | commit différent; stockage PDF absent; worker/Redis/backups/secrets/rollback futurs inconnus | SRE/DevOps | runbook unique confronté à la topologie réelle |
| 12. Autorisation phase suivante | NO-GO | trois P0, quatorze P1, quatre suites DB bloquées, 12 npm high | tous les P0 + conditions critiques P1 doivent être fermés et retestés | sponsor humain + tech/security leads | revue contradictoire et décision formelle avant tout code |

## Conditions cumulatives de reconsidération

1. Valider le changeset sur la branche attendue et geler le dossier de preuves.
2. Fermer P0-001 avec tests sur toutes les transitions, inconnues, ambiguïtés, voies, variantes et sessions.
3. Fermer P0-002/P0-003 avec transaction, idempotence, queue durable, ownership et tests DB/concurrence.
4. Approuver une ADR de convergence et un plan de migration réversible sans nouvelle chaîne parallèle.
5. Rendre sources curriculum et citations RAG immuables/auditables.
6. Démontrer projection par audience, publication/révocation et stockage PDF privé durable.
7. Exécuter PostgreSQL et Redis éphémères, E2E des parcours élève/parent/coach et tests de restart/double submit/deux workers.
8. Trier/remédier les vulnérabilités `high`, puis reproduire typecheck/lint/unit/integration/build.

Le GO documentaire n'autorise aucune modification Prisma, route, composant, worker ou RAG. Il autorise uniquement la revue humaine et la préparation d'un lot de remédiation séparé.
