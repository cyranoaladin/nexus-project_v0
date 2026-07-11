# Pré-rentrée 2026 — capacité et concurrence

## Décision

La stratégie principale est un **verrou pessimiste de la ligne cohorte** dans une transaction PostgreSQL courte, combiné à des lignes durables `PreRentreeSeatHold` et `PreRentreeCohortAssignment`. Prisma appelle un `SELECT ... FOR UPDATE` paramétré via SQL sûr. Le trafic attendu est faible, la capacité est 5 et la sérialisation par cohorte est souhaitable.

Le `count puis create` hors transaction est interdit. Une transaction `SERIALIZABLE` constitue une défense supplémentaire possible pour les orchestrations multi-cohortes ; elle ne remplace pas l'ordre de verrouillage documenté.

## Comparaison des options

| Stratégie | Atout | Limite | Verdict |
|---|---|---|---|
| `SERIALIZABLE` + comptage/insertion/retry | portable dans Prisma et preuve par conflits de sérialisation | retries plus fréquents, orchestration de 1–4 cohortes délicate | repli/complément |
| verrou `FOR UPDATE` cohorte | déterministe, lisible, adapté au faible volume | SQL brut contrôlé, ordre de locks obligatoire | **retenu** |
| sièges matérialisés 1..5 | unicité très forte | complexité transfert/hold, données artificielles | non retenu |
| compteur atomique/version optimiste | rapide | dérive/réparation, expiration asynchrone difficile | non retenu |
| procédure SQL complète | intégrité centralisée | logique métier plus difficile à tester/versionner | non retenu |

## Définition d'une place occupée

Sous un instant de transaction `nowDb` :

```text
occupied = count(assignments status=CONFIRMED)
         + count(holds status=ACTIVE and expiresAt > nowDb)
available = cohort.maxCapacity - occupied
```

Les affectations `PROPOSED`, `TRANSFERRED`, `CANCELLED`, `COMPLETED` et les holds expirés/terminaux ne consomment pas de place. `FULL` est `available = 0`, calculé et jamais persisté.

## Allocation d'un hold unique

Entrées : `cohortId`, `enrollmentId`, `idempotencyKey`, `payloadHash`, durée issue d'une politique versionnée. Le navigateur ne choisit ni durée, ni capacité.

1. Démarrer `prisma.$transaction`, timeout court et explicite.
2. Charger/verrouiller toutes les cohortes demandées dans l'ordre lexicographique de leur `id` avec `SELECT id FROM pre_rentree_cohorts WHERE id IN (...) ORDER BY id FOR UPDATE`.
3. Vérifier édition/cohorte publiables, variante, inscription, autorisation et absence d'affectation active.
4. Relire une ligne d'idempotence existante : même hash retourne son résultat ; hash différent lève `IDEMPOTENCY_CONFLICT`.
5. Marquer `EXPIRED` les holds actifs de ces cohortes dont `expiresAt <= transaction_timestamp()` ; écrire audit/outbox de libération si nécessaire.
6. Compter affectations confirmées et holds actifs non expirés sous les locks.
7. Si une cohorte n'a pas de place, n'écrire aucun hold du pack ; retourner `COHORT_FULL` et proposer la liste d'attente.
8. Vérifier les collisions élève sur toutes les séances cibles.
9. Insérer tous les holds du pack, audit et outbox dans la transaction.
10. Commit. Une erreur de contrainte ou deadlock annule tout ; retry borné uniquement pour codes PostgreSQL identifiés.

Durée de hold : `OWNER_INPUT_REQUIRED` avant implémentation commerciale. Elle appartient à une politique serveur versionnée, jamais à un composant. L'absence de valeur fait échouer la création de hold, sans fallback.

## Conversion hold vers affectation

1. Verrouiller les cohortes puis les holds, dans un ordre stable.
2. Vérifier `ACTIVE` et `expiresAt > nowDb`.
3. Revalider cohorte, variante, inscription, séance et collision.
4. Créer ou passer l'affectation à `CONFIRMED`.
5. Créer les `PreRentreeStudentScheduleClaim` de toutes les séances non annulées.
6. Passer le hold à `CONVERTED`, relier `convertedAssignmentId`.
7. Écrire audit et outbox, puis commit.

Un webhook de paiement ne réalise pas cette transaction lui-même : il réconcilie le paiement puis émet une commande interne idempotente. Si le hold a expiré, le paiement devient `RECONCILIATION_REQUIRED` ; aucune place n'est recréée silencieusement. La résolution autorisée est nouvelle allocation, liste d'attente, report écrit ou remboursement.

## Libération et expiration

- Une commande explicite verrouille la cohorte et transforme `ACTIVE→RELEASED|CANCELLED`.
- Un worker d'expiration parcourt un index `(status, expiresAt)`, par lots, avec `FOR UPDATE SKIP LOCKED`, puis verrouille la cohorte avant transition.
- Le calcul d'occupation ignore déjà un hold expiré même si le worker n'a pas encore écrit `EXPIRED`.
- Toute libération peut créer un événement `waitlist.promotion.requested` dans la même transaction.

## Promotion liste d'attente

Sous verrou cohorte, sélectionner la première entrée `ACTIVE` selon : priorité explicitement autorisée, puis `sequence`. La priorité manuelle exige permission et audit. Créer un hold de promotion, passer l'entrée à `PROMOTED`, écrire communication/outbox atomiquement. Si l'offre expire/refusée, traiter la suivante dans une nouvelle transaction.

## Paiements et webhooks concurrents

- `providerEventId` unique par paiement et `(provider, providerReference)` unique empêchent la double comptabilisation.
- Signature vérifiée avant transaction ; le payload complet sensible n'est pas stocké, seulement un hash et les champs nécessaires.
- Un doublon exact retourne le résultat enregistré et HTTP 200 au fournisseur.
- Même identifiant avec hash différent déclenche `409/RECONCILIATION_REQUIRED` et alerte.
- Un timeout client après commit est résolu par réappel avec la même clé d'idempotence.

## Preuve de capacité 5

Supposons deux transactions T1/T2 visant la dernière place. Une seule acquiert d'abord le lock de la cohorte. T1 compte 4, insère un hold et commit. T2 acquiert ensuite le lock et observe 5, donc n'insère rien. Si T1 rollback, T2 observe 4 et peut insérer. Toute insertion consommatrice est précédée du même lock ; il est donc impossible d'obtenir six consommateurs actifs par les services autorisés.

Défense complémentaire : les rôles DB applicatifs ne reçoivent aucun chemin d'insertion alternatif ; tests d'architecture interdisent l'écriture Prisma directe. Une assertion transactionnelle de capacité est exécutée avant commit et auditée en cas de violation interne.

## Packs multi-matières

L'allocation d'un pack de 1 à 4 matières est tout-ou-rien. Tous les locks cohortes sont pris dans l'ordre stable avant comptage, évitant une place acquise dans une seule matière. Si le produit autorise ultérieurement une confirmation partielle, ce sera une nouvelle décision owner et une nouvelle version de contrat.

## Retries et erreurs

| Cas | Réponse métier | Retry |
|---|---|---|
| deadlock `40P01` | interne transitoire | jitter, maximum 3 |
| sérialisation `40001` | interne transitoire | jitter, maximum 3 |
| lock timeout | `CAPACITY_BUSY` 409/503 selon contexte | client peut répéter même clé |
| plus de place | `COHORT_FULL` 409 | pas automatique ; waitlist explicite |
| hold expiré | `SEAT_HOLD_EXPIRED` 409 | nouvelle commande/nouvelle clé |
| idempotence divergente | `IDEMPOTENCY_CONFLICT` 409 | jamais |

Après trois échecs techniques, aucune mutation partielle ne subsiste et une alerte corrélée est créée sans PII.

## Tests bloquants

- capacités 3, 4, 5 et refus du sixième consommateur ;
- 20 transactions simultanées sur la dernière place ;
- pack de quatre cohortes avec conflit sur la quatrième : zéro hold créé ;
- expiration au même instant qu'une conversion ;
- paiement tardif après expiration ;
- timeout après commit et réappel ;
- webhook dupliqué/divergent ;
- promotion concurrente : une seule entrée promue ;
- deadlock simulé et retry borné ;
- réparation après worker interrompu.

## Rollback

Désactiver les flags de commande V2, laisser expirer/libérer les holds actifs, arrêter les workers après drainage de l'outbox et conserver toutes les lignes. Aucune table n'est supprimée. Un rollback applicatif ne réactive jamais le chemin V1 pour écrire les inscriptions V2.
