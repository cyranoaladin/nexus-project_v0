# Stratégie de migration sans régression — Pré-rentrée 2026

## Statut

**APPROVED comme stratégie cible par OWNER-018 et OWNER-019.** Aucune migration Prisma n'est créée ou exécutée dans cette phase. Le schéma physique reste la sortie de la phase suivante.

Baseline synchronisée : `origin/main` à `db04d23f3e645a2052e41e5a679a8b9443cf8dc9`. L'[audit de dérive](../audits/2026-07-pre-rentree-main-drift-audit.md) montre que certains helpers de sécurité de la base `11ac38c` n'existent pas sur ce SHA ; aucune migration ou API ne doit les présumer disponibles.

## Objectifs

- introduire le domaine V2 de manière additive ;
- préserver exactement les stages et formats historiques ;
- activer la Pré-rentrée derrière un feature flag ;
- garantir rollback code et données ;
- éviter deux sources pour la même édition ;
- rendre chaque backfill/upsert idempotent et auditable.

## Principe de coexistence

Pendant la transition :

- `Stage` et ses relations restent l'autorité des éditions historiques V1 ;
- les agrégats V2 sont l'autorité exclusive de l'édition interne `PRE_RENTREE_2026`, exposée par le slug centralisé `pre-rentree-2026` ;
- un registre d'unicité interdit le même `editionCode` dans V1 et V2 ;
- le query service renvoie un discriminant `LEGACY_STAGE` ou `EDITION_V2` ;
- aucune écriture miroir n'est autorisée ;
- la double lecture est limitée aux surfaces qui doivent afficher l'historique et la nouvelle édition ensemble.

Cette coexistence est un adaptateur de compatibilité, pas une double vérité par entité.

## Données à laisser historiques

- tous les `Stage` antérieurs et leurs `StageSession` ;
- `StageReservation` existantes, y compris statuts legacy/rich ;
- `StageCoach`, `StageDocument`, `StageBilan` ;
- prix/capacité snapshots historiques ;
- formats 9, 12, 15, 18, 20 et 30 h ;
- factures, paiements, entitlements et communications déjà émis ;
- pages/cockpits pédagogiques dédiés aux stages Printemps/NSI/EAF existants.

Aucun backfill automatique ne transforme leur sens.

## Données à créer uniquement pour 2026 V2

- édition `PRE_RENTREE_2026` et mapping vers le slug public `pre-rentree-2026` ;
- version/checksum du template ;
- 12 modules et variantes ;
- cohortes socles logistiques, distinctes de leur ouverture commerciale ;
- deux salles et requirements ;
- affectations enseignantes lorsqu'elles sont validées ;
- 60 séances ;
- demandes multi-matières, choix, devis et inscriptions ;
- présences, audit et communications V2.

## Données potentiellement à requalifier

Seulement les familles réellement liées à la Pré-rentrée :

- leads identifiés dans CRM/ContactLead ;
- `StageReservation` portant une ancienne édition Pré-rentrée si elle existe en base ;
- paiements/acompte/factures reliés ;
- messages envoyés.

La requalification n'est jamais automatique si niveau, matières, parent ou parcours manque. Elle crée une demande V2 avec `MIGRATION_A_VERIFIER`/arbitrage et conserve le lien vers la source.

## Phases

### Phase 0 — Décisions et inventaire

- vérifier le registre owner approuvé et l'ADR acceptée ;
- exporter en lecture seule compteurs V1, réservations/paiements concernés et checksums ;
- confirmer coûts, salles, enseignants, CGV et communication ;
- définir métriques de succès et propriétaire du rollback.

Gate : conception physique autorisée ; implémentation toujours soumise à une mission distincte et aux gates concernées.

### Phase 1 — Migration additive

- ajouter uniquement nouvelles tables/enums/relations nullable nécessaires ;
- aucune suppression/rename de colonne ;
- conserver tous les defaults V1 ;
- ajouter contraintes/index après contrôle des doublons ;
- déployer avec feature flag désactivé.

Gate : migration testée sur base de test et copie anonymisée.

La branche de cette future phase doit repartir d'un `origin/main` fraîchement fetché. `GATE-SEC-BASE-001` doit interdire toute dépendance implicite aux guards, helpers de date, stockage document ou webhook présents uniquement dans l'ancienne base auditée.

### Phase 2 — Domaine et template

- ajouter schéma Zod du template ;
- dry-run ;
- transaction d'upsert idempotente ;
- stocker version/checksum ;
- valider 12/60/collisions ;
- exécuter seulement en environnement de test.

Gate : deuxième exécution = zéro création et zéro mutation inattendue.

### Phase 3 — Query/command services V2

- services domaine ;
- DTO audience ;
- guards et audit ;
- finance catalogue-first ;
- outbox ;
- aucune exposition publique.

Gate : tests domaine/API/RBAC/concurrence.

### Phase 4 — Dashboards internes

- activer pour admin/assistante de test ;
- dry-run ressources et conflits ;
- requalification manuelle de fixtures ;
- coach/parent/élève avec comptes QA.

Gate : aucune donnée V1 modifiée ; droits vérifiés.

### Phase 5 — Requalification des familles

- générer candidats avec source et score de confiance ;
- validation humaine ;
- lier identités vérifiées ;
- créer devis V2 ;
- envoyer correction coordonnée ;
- conserver décisions de maintien/modification/remboursement.

Gate : réconciliation source→cible et finance à 100 %.

### Phase 6 — Frontend public sous flag

- landing V2 désactivée par défaut ;
- preview staff/URL non indexée ;
- tests SEO/a11y/mobile ;
- bouton d'inscription fermé tant que produit/cohortes non validés.

Gate : validation owner visuelle et contractuelle.

### Phase 7 — Activation progressive

- activer lecture publique ;
- surveiller erreurs/devis/doublons ;
- activer demandes ;
- activer paiement après preuve bout-en-bout ;
- ne jamais activer une cohorte sans ressources.

### Phase 8 — Stabilisation

- rapprocher inscriptions, paiements, factures, présences ;
- documenter incidents ;
- fixer une date de fin de l'adaptateur dual-read ;
- toute migration des anciens stages devient une mission séparée.

## Contraintes uniques probables

À valider techniquement avant Prisma :

- édition : `editionCode` unique ;
- template : `(templateId, templateVersion)` unique ;
- module : `(editionId, moduleCode)` unique ;
- variante : `(moduleId, variantCode)` unique ;
- cohorte : `(moduleId, cohortCode)` unique ;
- séance : `(cohortId, sessionCode)` et `(cohortId, startAt)` uniques ;
- demande : clé d'idempotence unique par canal ;
- choix : `(applicationId, moduleId)` unique ;
- enrollment : `(studentId, cohortId)` unique actif ;
- présence : `(studentId, sessionId)` unique ;
- devis : numéro/version unique et un devis accepté actif par demande ;
- communication : clé d'idempotence `(event, entityId, recipientRef, templateVersion, channel)` ;
- source legacy : `legacyReservationId` unique nullable.

Les collisions temporelles requièrent probablement contraintes d'exclusion PostgreSQL ou verrous transactionnels, car Prisma ne les exprime pas entièrement.

## Index probables

- édition par visibilité/statut/date ;
- module par édition/niveau/matière ;
- cohorte par module/statut ;
- séance par startAt, enseignant+startAt et salle+startAt ;
- demande par contact hashé/statut/date ;
- enrollment par studentId et cohortId/status ;
- paiement/devis par applicationId/status ;
- attendance par sessionId/studentId ;
- audit par aggregateType/aggregateId/createdAt ;
- outbox par status/nextAttemptAt.

L'indexation ne doit pas inclure inutilement de PII en clair.

## Transactions requises

| Opération | Isolation/garantie |
|---|---|
| Soumission demande | Idempotence + transaction demande/choix/devis/audit/outbox |
| Dernière place | Verrou cohorte ou Serializable + contrainte unique |
| Ouverture cohorte | Cohorte + 5 séances + ressources + audit atomiques |
| Affectation enrollment | Revalidation capacité/parcours dans la transaction |
| Validation paiement | Payment + facture + lien demande + audit atomiques |
| Remboursement | Transition financière et inscription cohérentes |
| Fusion identité | Relations déplacées + alias/audit atomiques |
| Upsert template | Lock édition + checksum + transaction complète |

Les emails, WhatsApp et PDF sont post-commit via outbox ; leur échec ne doit pas annuler une transaction métier validée.

## Risques de concurrence

- deux dernières places ;
- deux demandes identiques simultanées ;
- deux opérateurs qualifiant la même demande ;
- changement de salle/enseignant concurrent ;
- paiement webhook et validation manuelle simultanés ;
- remboursement et confirmation simultanés ;
- double exécution du seed ;
- refresh de `BusinessConfig` pendant un devis.

Réponse : version optimiste, contraintes DB, advisory locks ciblés et idempotency keys.

## Risques de fuseau

- parsing de `YYYY-MM-DD` comme UTC ;
- `datetime-local` converti dans le fuseau navigateur ;
- affichage différent pour utilisateur hors Tunisie ;
- calcul du week-end en UTC ;
- changement futur des règles IANA.

Réponse : date civile + timezone d'édition, construction serveur des instants, stockage UTC et formatage explicite `Africa/Tunis`.

## Feature flags

Flags conceptuels approuvés comme usage autorisé de `BusinessConfig` par OWNER-016 :

- `preRentree2026.readEnabled` ;
- `preRentree2026.publicLandingEnabled` ;
- `preRentree2026.applicationsEnabled` ;
- `preRentree2026.paymentsEnabled` ;
- `preRentree2026.dashboardEnabled`.

Le flag de landing doit pouvoir désactiver uniquement la nouvelle édition sans casser `/stages` historique. Aucun flag ne change les prix.

Les flags public, API/paiement et dashboards restent indépendants. Leur état initial est désactivé ; un conflit avec le catalogue, le template ou la DB échoue au lieu de réécrire une valeur contractuelle.

## Validation avant bascule

- snapshot des compteurs V1 ;
- 12 modules/60 séances/checksum ;
- zéro collision ;
- ressources confirmées ;
- produits et devis validés ;
- fixtures identité multi-enfants/multi-responsables ;
- tests anciens stages ;
- dry-run requalification ;
- sauvegarde et procédure de restauration testées ;
- approbation owner signée.

## Rollback applicatif

1. couper `applicationsEnabled` puis `publicLandingEnabled` ;
2. conserver la lecture admin V2 pour traitement des demandes reçues ;
3. restaurer le rendu `/stages` précédent sans restaurer la mauvaise date de Pré-rentrée ;
4. ne pas supprimer les enregistrements V2 ;
5. désactiver les workers/outbox avec reprise idempotente ;
6. réconcilier paiements avant tout nouveau déploiement.

## Rollback de données

- migrations additives non annulées en urgence ; laisser tables inutilisées ;
- marquer édition inactive/fermée ;
- utiliser les mappings et événements pour annuler les seules écritures métier ;
- jamais `DROP`, `TRUNCATE` ou suppression en cascade sur incident ;
- restaurer depuis sauvegarde seulement avec validation explicite si corruption ;
- aucun rollback ne remet la date de début au 24 août.

## Archivage logique

- les éditions/cohortes/demandes utilisent des transitions et, si nécessaire, `archivedAt` ;
- aucune suppression physique ordinaire d'une édition avec inscription, paiement, présence, communication ou document ;
- paiements, factures, preuves et transitions restent immuables selon la politique de rétention ;
- une archive n'est plus publiable mais reste consultable par les rôles autorisés ;
- la future conception doit empêcher les hard deletes en cascade contraires à OWNER-019.

## Critères de sortie de coexistence

- aucun write V1 pour la Pré-rentrée ;
- 100 % des demandes ciblées réconciliées ;
- aucun paiement orphelin ;
- dashboards stables ;
- politique d'archivage historique validée ;
- mission séparée approuvée pour éventuel backfill V1.

## Références

- [ADR 005](../adr/005-pre-rentree-source-of-truth-and-application-integration.md)
- [Matrice de tests](pre-rentree-2026-test-matrix.md)
- [Propriété des fichiers](pre-rentree-2026-file-ownership-map.md)
- [Décisions owner](../decisions/pre-rentree-2026-owner-approval.md)
- [Gates d'activation](pre-rentree-2026-activation-gates.md)
- [Audit de dérive de main](../audits/2026-07-pre-rentree-main-drift-audit.md)
