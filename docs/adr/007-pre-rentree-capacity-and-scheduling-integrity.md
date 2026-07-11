# ADR 007 — intégrité de capacité et de planning Pré-rentrée V2

## Statut

Proposé pour implémentation. Date : 11 juillet 2026.

## Contexte

Capacité 3–5 par cohorte, paiements asynchrones et packs multi-matières exigent une preuve anti-surréservation. Les collisions partielles ne sont pas empêchées par une contrainte unique. PostgreSQL 15 et `btree_gist` sont disponibles dans le dépôt.

## Décision capacité

Verrouiller pessimiste chaque ligne cohorte avec `FOR UPDATE`, ordre lexicographique pour un pack, puis compter affectations confirmées et holds actifs non expirés et insérer dans la même transaction. Holds, conversion, libération et promotion waitlist sont durables, idempotents et audités. `FULL` reste dérivé. Paiement tardif après expiration : réconciliation, jamais confirmation automatique.

## Décision planning

Validation métier serveur plus contraintes PostgreSQL d'exclusion `tstzrange [)` pour enseignant, salle et cohorte. Une projection `PreRentreeStudentScheduleClaim`, reconstruisible et écrite atomiquement, porte l'exclusion élève. Les instants utilisent `timestamptz`; la date locale est construite avec la zone de l'édition.

## Options rejetées

- `count/create` hors transaction : course évidente.
- compteur seul : dérive avec holds expirés et paiements.
- sièges 1..5 : complexité non justifiée.
- validation frontend/service seule : course concurrente.
- unique start/end : chevauchements partiels non détectés.

## Conséquences

SQL brut paramétré et migrations SQL complémentaires sont nécessaires ; M0 doit prouver extension/privilèges. La contention est limitée par le faible volume et répartie par cohorte. Les tests doivent utiliser PostgreSQL réel et plusieurs connexions.

## Preuve et rollback

Sous lock, la seconde transaction observe l'insertion de la première : jamais plus de cinq consommateurs. Les exclusions arbitrent les courses planning. Rollback : flags commandes off, drainage, holds libérés/expirés, contraintes retirées seulement par migration contrôlée après preuve ; données conservées.

Références : [capacité](../specs/pre-rentree-2026-capacity-concurrency.md), [planning](../specs/pre-rentree-2026-scheduling-constraints.md).
