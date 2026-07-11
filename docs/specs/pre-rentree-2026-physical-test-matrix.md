# Pré-rentrée 2026 — matrice de tests physiques et transactionnels

## Niveaux de preuve

- `U` unitaire domaine/policy/calcul ; `I` intégration PostgreSQL réel ; `C` concurrence multi-connexion ; `E2E` API/UI derrière flags ; `NR` non-régression V1.
- Tous les tests DB utilisent PostgreSQL 15 avec migrations réelles ; SQLite/mocks ne prouvent ni exclusions, ni locks.
- Chaque lot M0–M10 a un test de rollback et conserve un rapport.

## Schéma, template et domaine

| ID | Scénario | Niveau | Résultat attendu |
|---|---|---|---|
| PHY-DOM-001 | création édition PRE2026 | I | dates civiles/fuseau/checksum exacts |
| PHY-DOM-002 | deuxième matérialisation identique | I/C | zéro création/mutation inattendue |
| PHY-DOM-003 | deux apply concurrents | C | un apply, un résultat idempotent |
| PHY-DOM-004 | checksum différent avant usage | I | plan explicite/acceptation requise |
| PHY-DOM-005 | checksum différent après proposition émise | I | `TEMPLATE_IMMUTABLE_AFTER_USE` |
| PHY-DOM-006 | doublon code édition/slug/module/séance | I | contrainte nommée traduite |
| PHY-DOM-007 | arithmétique socle | U/I | 12 modules, 60 séances, 10 jours, 120 h-cours |
| PHY-DOM-008 | module/pack élève | U | 5×2 h=10 h, 1–4 matières, max 40 h |
| PHY-DOM-009 | terminologie/parcours | U | pas NSI EDS Seconde, pas EAF Terminale, pas 3 EDS |
| PHY-DOM-010 | rollback logique template | I | permis DRAFT inutilisé, refusé après engagement |

## Argent et snapshots

| ID | Scénario | Niveau | Résultat attendu |
|---|---|---|---|
| PHY-MON-001 | packs 1..4 | U/I | 480000/900000/1350000/1800000 millimes |
| PHY-MON-002 | acompte/solde/arrondi canonique | U | 140000/270000/410000/540000 ; soldes exacts ; règle snapshot |
| PHY-MON-003 | client altère montant | E2E | ignoré, serveur recalcule |
| PHY-MON-004 | Float/Decimal V1 adaptateur | U | conversion explicite exacte ou erreur |
| PHY-MON-005 | montant négatif/devise/overflow | I | check/validation refuse |
| PHY-MON-006 | catalogue change après acceptation | I | snapshot/contrat/facture inchangés |
| PHY-MON-007 | checksum snapshot altéré | I | erreur intégrité |
| PHY-MON-008 | remboursement partiel | U/I | selon version de politique, défaut refus |

## Capacité et concurrence

| ID | Scénario | Niveau | Résultat attendu |
|---|---|---|---|
| PHY-CAP-001 | capacités 3,4,5 | I | comptage exact, full dérivé |
| PHY-CAP-002 | deux requêtes dernière place | C | une seule réussit, jamais sixième |
| PHY-CAP-003 | 20 concurrents capacité 5 | C | ≤5 consommateurs actifs |
| PHY-CAP-004 | pack 4, conflit sur dernier | C | aucun hold partiel |
| PHY-CAP-005 | même idempotency/hash | I | même résultat |
| PHY-CAP-006 | même clé/payload différent | I | 409, aucune mutation |
| PHY-CAP-007 | expiration contre conversion | C | un seul état terminal cohérent |
| PHY-CAP-008 | paiement après hold expiré | I | réconciliation requise, aucune place |
| PHY-CAP-009 | transfert de cohorte | C | cible confirmée et source libérée atomiquement |
| PHY-CAP-010 | waitlist doublon/promotion | I/C | une entrée active, une seule promue |
| PHY-CAP-011 | timeout après commit | I | retry retrouve résultat |

## Planning et ressources

| ID | Scénario | Niveau | Résultat attendu |
|---|---|---|---|
| PHY-SCH-001 | chevauchement enseignant partiel/englobant | I/C | exclusion refuse |
| PHY-SCH-002 | chevauchement salle | I/C | exclusion refuse |
| PHY-SCH-003 | chevauchement cohorte | I/C | exclusion refuse |
| PHY-SCH-004 | chevauchement élève via claims | I/C | exclusion refuse |
| PHY-SCH-005 | bornes adjacentes +15 min | I | autorisées si règle métier satisfaite |
| PHY-SCH-006 | séance annulée/remplacée | I | ancienne conservée, nouvelle validée |
| PHY-SCH-007 | weekend 22/23 | U/I | aucune séance |
| PHY-SCH-008 | fuseau/date civile | U/I | instants UTC et libellé Tunis exacts |
| PHY-SCH-009 | DST synthétique ambigu/inexistant | U | refus sans offset explicite |
| PHY-SCH-010 | charge enseignant/élève | U/I | ≤6 h et ≤4 h/jour, pause/venue |
| PHY-SCH-011 | deux salles simultanées | U/I | troisième refusée par service |
| PHY-SCH-012 | NSI/PC ressources | I | confirmation bloquée sans équipement/décision |
| PHY-SCH-013 | rebuild claims | I | projection égale source, idempotente |

## Identités et autorisations

| ID | Scénario | Niveau | Résultat attendu |
|---|---|---|---|
| PHY-AUTH-001 | demande sans compte | E2E | créée, aucun User définitif |
| PHY-AUTH-002 | rapprochement même email/téléphone | I | proposition seulement, aucune fusion |
| PHY-AUTH-003 | parent plusieurs enfants | I/E2E | chaque relation/droit respecté |
| PHY-AUTH-004 | enfant plusieurs responsables | I/E2E | droits différenciés |
| PHY-AUTH-005 | relation non vérifiée/expirée/révoquée | I/E2E | 404, aucune donnée |
| PHY-AUTH-006 | IDOR parent | E2E | 404 et pas de fuite count/cache |
| PHY-AUTH-007 | IDOR coach | E2E | cohorte/élève/document hors affectation 404 |
| PHY-AUTH-008 | finance coach/élève | U/E2E | champs absents du type et JSON |
| PHY-AUTH-009 | pédagogie modifie paiement | I | 403 |
| PHY-AUTH-010 | finance modifie variante | I | 403 |
| PHY-AUTH-011 | export sans permission | I | 403/audit pertinent |
| PHY-AUTH-012 | document path traversal/symlink | I | refus, aucun chemin exposé |

## Paiement, remboursement, outbox et audit

| ID | Scénario | Niveau | Résultat attendu |
|---|---|---|---|
| PHY-PAY-001 | webhook valide | I | événement/paiement/audit/outbox cohérents |
| PHY-PAY-002 | webhook dupliqué exact | I/C | une comptabilisation, réponse idempotente |
| PHY-PAY-003 | même event/payload différent | I | réconciliation requise/alerte |
| PHY-PAY-004 | signature/secret absent | I | refus, zéro mutation |
| PHY-PAY-005 | montant/devise divergents | I | aucune confirmation, réconciliation |
| PHY-PAY-006 | remboursement total groupe non ouvert | I | workflow et communication tracés |
| PHY-PAY-007 | outbox workers concurrents | C | un claim/livraison logique |
| PHY-PAY-008 | outbox retry/dead-letter | I | backoff borné, pas de double effet |
| PHY-PAY-009 | transaction interrompue avant commit | I | ni mutation métier ni outbox/audit partiels |
| PHY-PAY-010 | audit PII/secrets | U/I | payload redacted, corrélation présente |

## Dashboards, DTO et V1/V2

| ID | Scénario | Niveau | Résultat attendu |
|---|---|---|---|
| PHY-DTO-001 | landing/configurateur | U/E2E | source DB/DTO, jamais template direct |
| PHY-DTO-002 | admin/pédagogie/coach/parent/élève | U/E2E | champs/audiences conformes |
| PHY-DTO-003 | planning navigateur autre fuseau | E2E | affiche Africa/Tunis |
| PHY-DTO-004 | desktop/tablette/390/320/clavier/lecteur écran | E2E | aucun overflow, statuts accessibles |
| PHY-NR-001 | ancien Stage formats 9..30 h/intensif | NR | sens/prix/réservations inchangés |
| PHY-NR-002 | listes mixtes | NR | discriminants exacts, aucune dual-write |
| PHY-NR-003 | flags public/API/dashboards | NR | indépendants, off par défaut |
| PHY-NR-004 | routes publiques historiques/auth/dashboards/pricing annuel | NR | comportement préexistant conservé |

## Rollback par lot

| Lot | Test de rollback |
|---|---|
| M0 | restauration de sauvegarde et comparaison contrôlée |
| M1 | migration fresh/down en test ; prod tables inertes flags off |
| M2 | retrait contraintes nommé après validation, aucune donnée perdue |
| M3 | flag relation V2 off, V1 `parentId` continue |
| M4 | rollback logique DRAFT, refus si utilisée |
| M5 | API off, holds libérés/expirés, workers drainés |
| M6 | query V2 off, adapters V1 continuent |
| M7 | dashboard flag off |
| M8 | public flag off/redirect validé |
| M9 | initiation off mais webhooks déjà engagés traités, outbox drainée |
| M10 | dépublication sans perte d'accès contractuel |

## Gates d'acceptation

Zéro test P0 flaky ; concurrence répétée sur PostgreSQL réel ; schéma fresh et upgrade ; historique V1 intact ; diff DB attendu ; aucune PII interdite ; preuves archivées avec SHA, versions Prisma/PostgreSQL et seed. Les coûts/marge, ressources, CGV/rétention et durée de hold restent des inputs owner/legal bloquant la publication lorsqu'indiqués.
