# Risques et blocages

## P0 — à fermer avant tout nouveau diagnostic

| ID | Risque | Preuve | Blocage / acceptation |
|---|---|---|---|
| P0-01 | IDOR création/génération Bilan | POST create/generate sans assignment sur élève/bilan | tests PostgreSQL coach A/B et filtre DB |
| P0-02 | perte/doublon de génération | fire-and-forget ; job stage sans claim/lease ; retry NPC cassé | worker durable + tests crash/concurrence |
| P0-03 | curriculum futur inventé | commande `2035-2036` retourne des versions | horizon explicite + test de refus |
| P0-04 | fuite inter-audience | résultats Assessment/Diagnostic multi-audiences | projection unique + tests négatifs |
| P0-05 | solutions exposées | banque importée par composant client | DTO serveur sans solution + analyse bundle |
| P0-06 | NSP scoré faux | sentinelle `__NSP__` classée incorrecte | statut typé + regression test |
| P0-07 | scoring invalide persistable | safeParse échoue puis continue | fail closed/transaction + test |
| P0-08 | identité/ownership legacy email | Assessment public et fallback email | session/link ou token borné ; plan de migration |

## P1 — avant publication parent et généralisation

- guardian link N–N vérifié et permissions ;
- score/evidence/version immutables ;
- audience/version/revue/publication/révocation ;
- RAG contract, corpus, dimension et citations confirmés ;
- minimisation PII/DPA/rétention LLM ;
- stockage objet privé durable et restore ;
- runbook PM2/Docker consolidé et raison des restarts ;
- registre complet par matières/voies et banque revue ;
- observabilité jobs/queue/DLQ ;
- test E2E authentifié accessible et tests DB réels.

## Risques techniques

Course de statut, écritures partielles, contexte « latest », double écriture non transactionnelle, path/storage local, variantes de helpers coach ID, suppression destructive, configurations RAG incompatibles, erreur RAG masquée comme vide, hallucination sans Evidence IDs et prompts avec données personnelles.

## Risques pédagogiques

Confondre performance, notes historiques, stress et maîtrise ; pénaliser le non étudié ; interpréter une faible couverture ; sur-promettre une validité psychométrique ; banques non revues ; biais des questions IA ; recommandations hors programme ; rapport parental stigmatisant.

## Risques juridiques/opérationnels

Données de mineurs envoyées à plusieurs fournisseurs, durée de rétention inconnue, liens parent non vérifiés, accès PDF durable non prouvé, logs/prompts PII, backups et restauration non prouvés. Toutes les affirmations non confirmées en production restent `UNKNOWN_PRODUCTION_FACT`.

## Blocages de décision

Les items D01–D12 de `18_DECISIONS_REQUIRED.md` doivent être tranchés avant Lot D/G/H. Lot B sécurité et correction NSP/contrat scoring peut commencer sans décider le backend RAG ni la queue finale.

## Risque dépendances

L'audit antérieur rapporte 24 vulnérabilités npm dont 12 high, sans nouvelle exécution `npm audit` dans cette session. Statut `DOCUMENTED_ONLY` à revalider dans un lot séparé ; ne pas mélanger une montée majeure de dépendance avec la convergence Bilans.
