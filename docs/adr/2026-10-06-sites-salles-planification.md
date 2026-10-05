# ADR — Sites, salles et planification logistique (capacité n° 13)

## Date
2026-10-06 (bootstrap). Branche : `feat/sites-rooms-scheduling-go-live`, basée sur le candidat #337 (`4eac50d0a`).

## Contexte
Aucun modèle site/salle n'existe : `stage_sessions.location` est un texte libre, sans capacité ni
détection de conflit de salle. Décision de pilotage : pilote limité avec module explicitement absent,
puis implémentation complète obligatoire avant tout `FULL_GO_LIVE_READY` (`TRANSITION=LIMITED_PILOT`,
`DESTINATION=FULL_IMPLEMENTATION`).

## Décisions

### Modèle (migrations additives uniquement)
- `Site` : id, name (unique), addressLine, city, `timezone` (IANA, défaut `Africa/Tunis` — explicite,
  jamais déduit), status ACTIVE/INACTIVE, archivedAt (archivage logique ; aucune suppression :
  FK en `onDelete: Restrict` partout).
- `Room` : id, siteId (Restrict), name (unique par site), `capacity` (int > 0, CHECK), status
  ACTIVE/INACTIVE, archivedAt, equipmentNotes.
- `RoomOccupancy` : réservation d'une salle par une séance — id, roomId, sourceType
  (`STAGE_SESSION` | `SESSION_BOOKING` | `PLANNING_OCCURRENCE` | `EVENT`), sourceId, `startAt`/`endAt`
  TIMESTAMPTZ, CHECK endAt > startAt, créée/annulée avec audit append-only (même patron que
  `stage_reservation_decision_audits`).

### Conflits — prévention transactionnelle, pas applicative seulement
Patron déjà qualifié par `20261005014000_stage_session_coach_conflicts` (btree_gist) :
- conflit de **salle** : `EXCLUDE USING gist (roomId WITH =, tstzrange(startAt,endAt,'[)') WITH &&)
  WHERE (cancelledAt IS NULL)` sur `RoomOccupancy` ;
- conflit de **coach** : contrainte d'exclusion existante sur `stage_sessions` conservée ; étendue au
  niveau `RoomOccupancy` par (sourceType, coachId) matérialisé si la séance porte un coach ;
- conflit de **groupe** : exclusion sur (groupId, plage) pour les occupations portant un groupe ;
- sur-capacité : trigger BEFORE INSERT/UPDATE comptant les participants vs `Room.capacity`
  (même patron que `aria_workshop_guard_admission`, verrou `FOR NO KEY UPDATE` sur la salle).

### Compatibilité avec l'existant
`stage_sessions.location` (texte) reste lisible mais cesse d'être la source de vérité dès qu'une
`RoomOccupancy` existe pour la séance : affichage = salle liée sinon texte hérité. Backfill : aucun
automatique (les textes libres sont ambigus) ; un écran d'adossement assistante propose le mappage,
chaque adossement est audité. Migration additive, aucune colonne supprimée.

### RBAC / visibilité
- ADMIN : CRUD sites/salles, archivage, résolution de conflits.
- ASSISTANTE : lecture + affectation de salles aux séances (pas d'archivage).
- COACH : lecture des salles de SES séances uniquement.
- PARENT/ELEVE : lecture du site/salle des séances auxquelles ils participent, rien d'autre.
Routes staff sous les guards centralisés existants ; tests négatifs par rôle obligatoires.

### Tests exigés avant fusion
PostgreSQL réel (lane db) : exclusions salle/coach/groupe sous concurrence (2 transactions),
sur-capacité, archivage avec références historiques (Restrict), fuseau ; unit : services et RBAC ;
E2E : parcours admin création site→salle→affectation→conflit affiché→résolution, responsive, audit.

## Hors périmètre de cette branche
Tarification par salle, maintenance/équipements avancés, multi-établissements fédérés.

## Statut
ADR seul (bootstrap). Implémentation à dérouler sur cette branche ; PR indépendante de #337.
Point d'attention hérité : la lignée espace (release `release/espace-recursivite-2026-10-04`) devra
être convergée AVANT la base finale de cette branche si elle est intégrée à main/#337 entre-temps.
