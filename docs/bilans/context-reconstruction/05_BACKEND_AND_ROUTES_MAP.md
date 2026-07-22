# Backend et routes

L'inventaire ligne à ligne est dans `ROUTE_INVENTORY.csv`. Cette synthèse décrit les frontières et risques.

## Assessment

| Route | Guard / ownership | Transaction / idempotence | Risque |
|---|---|---|---|
| `POST /api/assessments/submit` | public + rate limit ; identité client | trois écritures DB non transactionnelles ; aucune clé | fraude identité, doublons, résultat partiel, NSP incorrect |
| `GET /api/assessments/[id]/status` | helper Assessment | lecture | compatibilité par email |
| `GET /api/assessments/[id]/result` | helper Assessment | lecture | renvoie élève + parent ensemble |
| `GET /api/assessments/[id]/export` | helper Assessment | PDF synchrone | PDF non versionné |
| `POST /api/assessments/[id]/predict` | rôles/ownership dédiés | appel prédiction | tests DB réels non exécutés |

Le POST calcule le score avant persistance, puis lance SSN et génération en arrière-plan dans le processus HTTP. Une validation Zod du résultat de scoring peut échouer sans bloquer la persistance : le code journalise puis continue.

## Diagnostic Pallier 2

| Route | Guard | Mode | Risque |
|---|---|---|---|
| `POST /api/diagnostics/bilan-pallier2-maths` | public + validation/rate limit | génération attendue dans la requête | PII brute, latence, chaîne dédiée |
| `GET /api/diagnostics/bilan-pallier2-maths?share=` | token signé | lecture | payload et audiences mélangés |
| `POST /api/diagnostics/bilan-pallier2-maths/retry` | staff | synchrone | réécriture de la même ressource |
| `GET /api/diagnostics/definitions` | public/serveur selon route | lecture catalogue codé | définitions partielles |

## Bilan générique

| Route | Guard | Ownership | Risque |
|---|---|---|---|
| `GET /api/bilans` | staff/coach | coach filtré sur ses bilans | listes hétérogènes |
| `POST /api/bilans` | staff/coach | coachId forcé mais élève non affecté | **P0 IDOR d'écriture** |
| `GET/PUT/DELETE /api/bilans/[id]` | helper lecture/écriture | assignment sur la plupart des cas | PUT permet états/publication ; DELETE destructif admin |
| `POST /api/bilans/generate` | rôle seulement | aucun contrôle sur le bilan | **P0 IDOR + fire-and-forget + course** |
| `GET /api/bilans/generate?bilanId=` | rôle seulement | aucun contrôle | état/erreurs d'un autre bilan |
| `GET /api/student/bilans/[publicShareId]` | élève | ownership | route correcte peu utilisée par navigation |
| `GET /api/parent/bilans/[id]/pdf` | parent + enfant direct + publié | correct pour modèle mono-parent | PDF à la demande, non versionné |

`PUT /api/bilans/[id]` accepte score, trois Markdown, statut et publication sans machine d'état, version optimiste, revue ou publication par audience.

## Stages, EAF et rapports générés

- Questionnaires élève EAF/Maths : session élève dérivée correctement ; brouillons et mise à jour spécifiques.
- Rapports coach : rôle + affectation via helper récent ; contrats propres à chaque stage.
- `GET/POST /api/stages/[stageSlug]/bilans` et variantes ID : publication StageBilan globale, chaîne séparée.
- `GET /api/coach/students/[studentId]/generated-reports` : affectation vérifiée, liste projetée.
- `POST .../[reportId]/regenerate` : affectation vérifiée, traitement encore synchrone/process-local selon chemin.
- `GET .../[reportId]/download` : affectation et correspondance student/report vérifiées, fichier local privé.

## NPC

Les routes coach de soumission, upload, génération, documents et rapports contrôlent généralement le rôle et l'affectation ; un chemin de soumission ne filtre pas toujours explicitement la fenêtre active. Le job est une table DB et le worker externe claim par transaction conditionnelle. Le retry est cassé : `RETRYING` n'est pas inclus dans les états claimables. Aucun lease effectif ne récupère un job abandonné.

## RAG / LLM / santé

`lib/rag-client.ts` appelle un ingestor FastAPI/Chroma, mais les routes et clients historiques parlent également pgvector. Les erreurs HTTP, réseau, JSON ou timeout deviennent `[]`, donc l'appelant ne distingue pas panne et absence de résultat. Les routes de génération ne fixent pas toutes la collection côté serveur et ne conservent pas la provenance.

`/api/health` ne constitue pas une preuve de santé RAG/worker. `/api/internal/health` est plus riche mais son état réel et son exposition doivent être vérifiés à chaque déploiement.

## Contrat backend cible

Chaque route doit déclarer : schéma Zod, principal de session, capacité, scope d'ownership dans la requête, audience de sortie, transaction, clé d'idempotence, limite de débit, événement d'audit et classe d'erreur. Les commandes asynchrones font seulement une transaction `état + outbox/job`, puis répondent `202` avec une ressource de suivi autorisée.
