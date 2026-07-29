# Conflits du corpus pédagogique Pré-rentrée 2026

## Date

29 juillet 2026.

## Conflits de sélection

Aucun conflit de sélection requis ne reste ouvert après comparaison :

- `CONFLICT_REVIEW_REQUIRED` : 0 ;
- `UNCLASSIFIED` : 0 ;
- `PENDING_DEDUPLICATION` dans l'inventaire final : 0.

Les neuf groupes de CPS dont le contenu historique diverge du candidat v3
(quatre français et cinq mathématiques) ne sont pas des conflits silencieusement
écartés. La sélection v3 est justifiée par une validation structurelle PASS, le
rapport QA du paquet v3 et un diff structuré. Les variantes antérieures restent
`HISTORICAL_VERSION` ou `DUPLICATE_IDENTICAL` lorsqu'elles sont byte-identiques
entre elles.

## Validation pédagogique non déléguable

L'absence de conflit technique ne vaut pas validation pédagogique. Les 17 CPS,
les 85 séances et toute sortie qui en dérive restent
`HUMAN_VALIDATION_REQUIRED`. Une relecture pédagogique nominative est requise
avant tout statut `CLASSROOM_READY`, toute utilisation en classe ou toute
publication. Aucune approbation n'est inférée du rapport QA historique.

## Blocage volontaire : Physique-Chimie Seconde

Le module `seconde-physique-chimie` est absent du catalogue canonique des 17
modules et du corpus historique. Son statut est `INTENTIONALLY_BLOCKED`.

Ce manque n'est pas transformé en conflit de fichiers et aucun module n'est
créé implicitement. Une décision produit et pédagogique explicite, suivie d'une
source et d'une validation humaines, serait nécessaire pour étendre le
périmètre.

## Portée

Ce document recense uniquement les conflits réels de sélection. Les besoins de
validation humaine et le module absent sont des garde-fous de gouvernance, pas
des prétextes pour classer artificiellement des fichiers comme conflictuels.
