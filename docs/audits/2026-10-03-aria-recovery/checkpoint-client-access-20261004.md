# Point de contrôle — fermeture du lot d’accès client

Source auditable : cb3665fc68be6ae9652f386f64ba3c206a72e3ea. Base GitHub revalidée : 5ffd4dd8e1fb91b0eea42398670a260402660699. Statut NOT_READY. Aucun déploiement ni merge ; PR337 reste Draft.

## Comptages non ambigus

PR complète jusqu’à la source : 153 commits, 525 fichiers. Depuis le point local annoncé aad516f5c : 74 nouveaux commits ; ce delta n’est pas tout l’historique de récupération. Six commits locaux non publiés depuis 0036533e ; dernier lot comparé à ce distant : 24 fichiers. GitHub sur le distant 0036533e : 147 commits, 505 fichiers. Les commits de documentation qui suivent ce relevé augmentent ces nombres et doivent être comptés au prochain HEAD.

## Lot local

```text
50bcf0b81d65b82ad6720967767383cd70577322 fix(stages): authorize family listings by student identity and omit finance
ad3310ab51dbbc5e76de4b33d54d78789abcae56 test(aria): verify cancellation during setup and final native drainage
d3a7038d66e3d02db5f5cb43d4783233ad9ef1ee refactor(aria): remove unreachable cleanup-error branch
86453ce2c25a4a5c9de4243f763670ccf611a874 fix(security): restrict reservation existence lookup to throttled staff
87803c54ded1c8bf707abab62bbbb54ced0c4df2 fix(stages): preserve payment source state during academic confirmation
cb3665fc68be6ae9652f386f64ba3c206a72e3ea fix(stages): bind activation delivery to canonical student contact
```

## Résultats liés à leur périmètre

- SSE : trois suites, 52 tests ; parser 100 % statements/branches/functions/lines.
- Lookup réservation : quatre suites, 43 tests, accès staff et refus privés.
- Lectures de stages : quatre suites, 21 tests ; PostgreSQL quatre tests, deux familles et aucun fallback email.
- Confirmation sans altération de paiement : quatre suites, 31 tests ; PostgreSQL quatre états de paiement.
- Destinataire canonique : quatre suites, 38 tests ; PostgreSQL quatre tests, job chiffré et destinataire canonique.
- 131 migrations appliquées et relancées sur chaque base PostgreSQL éphémère de ces lots ; aucune nouvelle migration. Ces répétitions ne sont pas une restauration de sauvegarde de production.
- Typecheck, lint ciblé (avertissements any historiques dans deux anciennes fixtures), diff-check et scan de secrets du delta réussis.

La CI distante 0036533e est encore en cours : 44 succès, quatre échecs, un en cours, un en attente au relevé. E019 mobile : vingt réussites en 4,9 minutes. Échecs ouverts : CodeQL sur HMAC d’issuance ID (review autorisée requise), deux contrôles de dépendances sur policy stale/advisory braces non corrigé, couverture parser déjà corrigée localement mais à renouveler en CI.

## Gates et écarts techniques ouverts

Le POST public /api/reservation conserve un upsert par email avec prix client et doit être corrigé avant exposition. Cohérence des écrivains Core/V1, sites/salles et conflits globaux, ledger/provider sandbox, protection de tous les liens documentaires, capacités ARIA/citations et qualification exhaustive des 31 capacités demeurent incomplets. Aucun pilotage public n’est autorisé par cette preuve.

Les anciens worktrees et le dossier de preuves historiques n’ont pas été édités par ce lot. Aucun nouvel inventaire forensique exhaustif n’a été effectué ici ; ne pas présenter ce constat comme des hashes avant/après renouvelés. Aucun cache supprimé, build local lourd, paiement ni notification réelle. Les autorités TLS, rétention, sauvegarde/restauration et approbation head-pinned sont toujours attendues ; aucun secret demandé dans le chat.
