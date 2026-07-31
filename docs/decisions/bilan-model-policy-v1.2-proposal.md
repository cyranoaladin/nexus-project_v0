# Proposition de politique modèle v1.2

## Date

31 juillet 2026.

## Statut

`PROPOSED=false`

`APPROVED=false`

`BLOCKED_BY_PROVIDER_CONCENTRATION`

## Motif

La politique candidate ne peut pas être proposée honnêtement avant :

- un benchmark complet de 36 sorties valides ;
- des métriques automatiques comparables par modèle ;
- un paquet de revue humaine complet ;
- une revue aveugle terminée ;
- une décision explicite sur la concentration Azure.

Le run du 31 juillet 2026 a été interrompu par
`OPENROUTER_PROVIDER_UNAVAILABLE`. Les versions antérieures du runner n'avaient
pas encore de checkpoint append-only et ne permettent pas de reconstruire les
résultats manquants.

## Candidat à évaluer ultérieurement

Le candidat suivant reste une hypothèse de benchmark, pas une décision produit :

- parent standard : Luna ;
- élève standard : Luna ;
- Nexus interne : Terra ;
- fallback technique : Terra ;
- escalade manuelle : Sonnet 5.

Aucun de ces rôles n'est approuvé. La politique produit v1.1 reste inchangée.

## Critère de réouverture

Une nouvelle version de ce document pourra passer à `PROPOSED=true` uniquement
si :

- `BENCHMARK_CALL_COUNT=36` ;
- `SCHEMA_VALIDITY_RATE=100%` ;
- aucun score, preuve, PII ou audience ne diverge ;
- `HUMAN_REJECTION_COUNT=0` ;
- `MEAN_HUMAN_SCORE>=4.3` ;
- la résilience fournisseur est décidée ;
- l'owner approuve ensuite séparément la politique.
