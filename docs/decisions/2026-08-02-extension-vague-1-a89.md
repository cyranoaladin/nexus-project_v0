# Extension de la vague 1 à 17 packs — A89

## Date

2026-08-02

## Contexte

Les banques `entree-terminale-nsi-v1` et `entree-terminale-maths-expertes-v1`
complètent la vague initiale de quinze banques. Elles portent chacune dix-huit items et
neuf références de prérequis CPS.

## Décisions prises

- Le manifeste de vague 1 reste la source unique du lot actif et passe à dix-sept banques,
  soit 306 items aux identifiants globalement uniques.
- Une entrée de manifeste peut résoudre plusieurs catalogues CPS. La résolution conserve
  uniquement les nœuds réellement utilisés par la banque et refuse deux définitions
  divergentes d'un même identifiant.
- `1re.maths.suites.arithmetiques-geometriques` est réutilisé intentionnellement par les
  packs Maths et Maths expertes de Terminale. Sa définition canonique reste dans
  `1re-maths-vers-terminale.v1.yaml` : elle n'est ni dupliquée ni renommée.
- Le lot porte donc 153 références de nœuds, mais 152 identifiants CPS uniques. Cette
  différence est un partage sémantique explicite, pas une collision.
- `COLLEGE` est accepté comme niveau source CPS pour les prérequis arithmétiques dont la
  banque ne revendique volontairement pas un niveau de collège plus précis.
- Les deux packs restent `DRAFT`, non signés, avec RAG désactivé et feature flags inactifs.

## Tests attendus

- conversion atomique des dix-sept banques ;
- 306 identifiants d'items uniques ;
- V1 à V14 et recette mock V1 à V7 pour chaque banque ;
- checksums sources et sorties stables ;
- aucune divulgation de correction dans le DTO élève des deux nouveaux packs.

## Risques restants

Les packs ne sont ni validés pédagogiquement, ni activables en production. La migration
additive des enums Canonical est produite et éprouvée en dev/test, mais reste non appliquée
en production.
