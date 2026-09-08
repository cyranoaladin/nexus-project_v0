# Core — derniers gardes des assignations

## Date et contexte

8 septembre 2026. Base : `e47abc7a6c621e0a10d2c2ad39a0a70332113216`.
La promotion précédente s'est arrêtée avant toute mutation métier ou migration
production. Cette PR corrige uniquement le contrat HTTP et le cycle des
assignations. Elle ne constitue pas une certification de mise en production.

## Contrat et plan d'exécution

La spécification et l'exécution sont autorisées par le Release Owner. Les
revues parallèles sont en lecture seule ; le coordinateur est l'unique écrivain.

- [x] Reproduire le GET sans `status`, puis normaliser `null` vers `undefined`.
  Vérifier le défaut ACTIVE, ACTIVE/ENDED explicites et le rejet d'INVALID.
- [x] Reproduire le PATCH avec `courseKeys: []`, puis imposer un cours au moins.
  Vérifier les cours connus/suivis/enseignables et la préservation du scope absent.
- [x] Inventorier les clients POST/PATCH avant de fermer les objets HTTP avec
  `.strict()` ; refuser les champs d'autorité non prévus par le contrat.
- [x] Reproduire les défauts du cycle ACTIVE/SUSPENDED/ENDED et de ses dates.
  Préserver l'historique terminal et l'unicité lors des mutations concurrentes,
  en réutilisant les transactions et contraintes existantes sans nouveau schéma.
- [ ] Exécuter les tests ciblés et de concurrence sur PostgreSQL jetable,
  puis TypeScript, lint, sécurité, intégrité des dépendances, Jest pertinent,
  E2E authentifiés, Golden Family et build production.
- [ ] Faire relire le diff, ouvrir la PR et vérifier toutes ses CI/revues.
  La revue humaine distincte requise par le dépôt précède le merge.

Chaque changement de comportement suit RED → correction minimale → GREEN.
Les détails des deux décisions métier restent exclusivement dans le dossier
privé owner-only. Aucun choix académique ambigu n'est résolu par cette PR.

## Décisions et résultats

Les clients versionnés du dashboard assistante, de Golden Family et des tests
respectent les champs documentés. `subjects`, `academicCourseKeys`,
`courseScopeState` et `assignedById` ne sont pas des entrées HTTP. Le PATCH
n'accepte pas de changer coach/élève/type/début. Les objets stricts refusent
ces entrées au lieu de les supprimer silencieusement. L'ancien client de
création antérieur à Core omet déjà `courseKeys` et était donc incompatible
avec le contrat de #215 ; `.strict()` ne crée pas cette incompatibilité.

Règles du cycle :

- ENDED conserve son statut, sa fin et son périmètre. Notes et clôture répétée
  restent possibles, même avec un ancien scope non résolu.
- Une assignation expirée conserve son autorité historique. Elle peut être
  clôturée en conservant sa date de fin ; sa réutilisation nécessite une
  nouvelle assignation, pas une réécriture.
- SUSPENDED non expirée permet un scope validé et une réactivation explicite.
  La réactivation revalide le scope effectif, la carte académique, les capacités
  du coach et la fenêtre effective, y compris les anciennes dates inversées.
- Sans `courseKeys`, les clés, matières et état du scope restent inchangés.
  Un BACKFILL_AUTO valide ne devient pas une décision STAFF_VERIFIED implicite.
- Une nouvelle fin explicite doit être future et postérieure au début.
  La clôture immédiate sans fin explicite permet d'annuler une assignation
  future. Clôture et réécriture du scope dans la même requête sont refusées.
- Un couple coach/élève ne peut avoir deux lignes ACTIVE, même de types
  différents ou hors de la fenêtre courante. Une ligne ACTIVE obsolète doit
  être clôturée explicitement avant son remplacement.

POST et PATCH valident et écrivent dans une transaction Serializable. Les
lectures académiques utilisent le même client transactionnel. P2002/P2034
retournent 409 sans retry silencieux. L'index partiel existant reste en place ;
aucune migration n'est ajoutée. La suite de concurrence est désormais incluse
dans le job CI PostgreSQL réel.

Preuves RED : deux défauts HTTP reproduits, puis 15 rejets de champs inconnus ;
25 échecs de cycle ; trois échecs PostgreSQL de réactivation/concurrence ; un
échec supplémentaire de réactivation d'une fenêtre historique inversée.

Preuves GREEN disponibles avant build : 14 suites PostgreSQL, 52 tests,
incluant une clôture concurrente avec édition sous verrou réel ; TypeScript,
lint, sécurité du dépôt, intégrité npm et audits des dépendances passent.
La revue statique indépendante ne relève plus de finding P0/P1/P2/P3.
Les résultats Jest complet, build et E2E sont consignés après leur exécution.

## Périmètre de validation

Les tests et builds de cette PR sont des preuves de correction du code. La
restauration fraîche, les décisions staff, la recette production des cinq rôles
et tous les autres gates de promotion restent nécessaires après le merge.

## Rollback

Aucune nouvelle migration prévue. Aucun déploiement n'est effectué par cette
PR. Un rollback applicatif éventuel conserve le schéma expand de Core.
