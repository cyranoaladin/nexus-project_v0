# Pré-rentrée 2026 — plan de migration additive

## Règles de programme

- V1 reste lisible/inscriptible selon son comportement actuel ; aucun modèle/colonne n'est renommé, supprimé ou réinterprété.
- Aucun backfill Stage→V2 par défaut, aucune écriture duale, aucun recalcul de prix ou réservation historique.
- Chaque lot est testé sur base éphémère puis copie anonymisée ; sauvegarde et restauration prouvée avant production.
- Flags `PRE_RENTREE_V2_API`, `PRE_RENTREE_V2_PUBLIC`, `PRE_RENTREE_V2_DASHBOARDS`, désactivés par défaut ; les clés sont référencées par édition, leurs valeurs restent opérationnelles dans l'allowlist BusinessConfig.
- Rollback applicatif avant rollback DB. Les tables additives restent en place tant qu'une donnée opérationnelle existe.

## M0 — préconditions

| Élément | Contrat |
|---|---|
| Dépendances | baseline sécurité définie, main revalidé, décision migration explicite |
| Fichiers futurs | manifestes/lock Prisma, scripts de vérification, runbook sauvegarde |
| Migration/données | aucune |
| Risques | plages Prisma du manifeste asymétriques malgré l'installation alignée, extension/privilèges, restauration non prouvée |
| Tests/validation | Prisma CLI=Client installés `6.19.2`, plages du manifeste alignées/documentées, PostgreSQL 15, `vector`/`btree_gist`, backup+restore, rôles DB |
| Rollback | aucun changement |
| GO/NO-GO | GO seulement si sécurité implémentable sur SHA choisi et restauration/extension prouvées |

## M1 — tables et enums additifs, sans données

| Élément | Contrat |
|---|---|
| Dépendances | M0 GO, schéma/ADR revus |
| Fichiers futurs | `prisma/schema.prisma`, une migration Prisma additive |
| Migration | enums et tables V2 ; FK de base `Restrict/SetNull`; aucun drop/rename |
| Données | zéro ligne |
| Risques | nom collision, enum irréversible à court terme, cascade accidentelle |
| Tests | `prisma validate`, migrate fresh DB, introspection, V1 tests |
| Rollback | en test : down SQL généré ; en prod : laisser tables inertes, flags off |
| GO/NO-GO | zéro DDL destructif et V1 inchangé |

## M2 — checks, index, exclusions et relations

| Élément | Contrat |
|---|---|
| Dépendances | M1, `btree_gist` vérifiée |
| Fichiers futurs | migration SQL manuelle contrôlée, catalogue erreurs contraintes |
| Migration | checks argent/dates/cardinalités, index partiels, exclusions planning, FKs complémentaires |
| Données | zéro ou tables vides |
| Risques | Prisma ne représente pas exclusions/partiels ; drift si migration modifiée après apply |
| Tests | toutes violations, concurrence, `prisma migrate diff`, explain requêtes critiques |
| Rollback | drop constraints/index par noms, flags off, tables conservées |
| GO/NO-GO | DB interdit collisions et incohérences ciblées |

## M3 — relation multi-responsables

| Élément | Contrat |
|---|---|
| Dépendances | M2, politiques ABAC/guards implémentés |
| Fichiers futurs | service relation, policies, tests ; migration table déjà M1 ou isolée si retenu |
| Données | aucune relation auto-créée depuis email ; backfill éventuel séparé en `PROPOSED` seulement après plan owner |
| Risques | faux rattachement, perte accès, confusion `Student.parentId` |
| Tests | plusieurs enfants/responsables, droits, expiration, IDOR, V1 continue via parentId |
| Rollback | flag relation V2 off ; lignes conservées/révoquées, aucune écriture V1 compensatoire |
| GO/NO-GO | aucune lecture parent V2 sans relation VERIFIED active |

## M4 — template et matérialisation DRAFT

| Élément | Contrat |
|---|---|
| Dépendances | M2/M3, catalogue produits présent mais public flag off |
| Fichiers futurs | template, Zod, validate/plan/apply/verify/rollback logique |
| Données | PRE_RENTREE_2026, 12 modules, cohortes socle DRAFT, 60 séances ; ressources réelles non inventées |
| Risques | checksum, double apply, date/zone, mismatch catalogue |
| Tests | 12/60/120 h, second apply no-op, checksum conflict, rollback logique |
| Rollback | archive logique si inutilisé ; sinon flags off et transitions explicites |
| GO/NO-GO | verify exact et DB toujours non publique |

## M5 — services V2 et transactions

| Élément | Contrat |
|---|---|
| Dépendances | M4, baseline sécurité implémentée |
| Fichiers futurs | `lib/stages/v2/services`, policies, transaction helpers |
| Données | tests seulement puis opérations DRAFT |
| Risques | écriture directe, deadlock, idempotence, paiement tardif |
| Tests | architecture, machines, capacity race, schedule exclusions, outbox/audit |
| Rollback | API flag off, worker drain/stop, données conservées |
| GO/NO-GO | invariants concurrents prouvés |

## M6 — query services et DTO

| Élément | Contrat |
|---|---|
| Dépendances | M5 |
| Fichiers futurs | queries, DTO/types/Zod response, adapters V1/V2 |
| Migration/données | aucune |
| Risques | fuite PII/finance, N+1, DTO ambigu |
| Tests | snapshots JSON, IDOR, discriminant, pagination, anciens stages |
| Rollback | dashboard/API flags off, V1 adapters inchangés |
| GO/NO-GO | aucun modèle Prisma exposé et finance absente coach/élève |

## M7 — dashboards derrière flags

| Élément | Contrat |
|---|---|
| Dépendances | M6, tests auth |
| Fichiers futurs | navigation/écrans admin, pédagogie, coach, parent, élève |
| Migration | aucune |
| Risques | divergence rôles, anciennes réservations, cache privé |
| Tests | quatre dashboards + pédagogie, V1/V2, responsive/a11y |
| Rollback | flag dashboards V2 off |
| GO/NO-GO | preview interne validée, aucune finance interdite |

## M8 — landing derrière flag

| Élément | Contrat |
|---|---|
| Dépendances | M6, contenu/pricing/gates public |
| Fichiers futurs | route canonique, redirect, navigation/CTA/SEO |
| Migration | aucune |
| Risques | dates/prix hardcodés, publication avant ressources/marge |
| Tests | 320/390 px, a11y, SEO, liens, flag, no browser timezone |
| Rollback | public flag off/redirect vers `/stages` validé |
| GO/NO-GO | OWNER-022 et gates financières/logistiques/juridiques satisfaites |

## M9 — paiements et notifications

| Élément | Contrat |
|---|---|
| Dépendances | M5/M6, CGV, secrets/provider validés |
| Fichiers futurs | adapters fournisseur, webhook, workers outbox, templates |
| Migration | index provider/outbox déjà prévus ; aucune conversion Payment V1 |
| Risques | signature, double webhook, unité Float/millimes, communication contradictoire |
| Tests | provider sandbox, replay, divergence, refund, dead-letter, preuve |
| Rollback | initiation off, webhooks continuent à réconcilier les transactions déjà initiées, drain outbox |
| GO/NO-GO | finance approuve réconciliation et runbook |

## M10 — activation progressive

| Élément | Contrat |
|---|---|
| Dépendances | toutes gates OWNER-022, campagne corrective prête |
| Étapes | staff DRAFT → dashboards restreints → API lecture → petit groupe interne → public preview → public |
| Risques | capacité, ressource manquante, anciennes dates, support |
| Tests | smoke, charge/concurrence, auth, backup, observabilité, campagne |
| Rollback | public off puis commandes off ; garder accès contractuel ; communication coordonnée |
| GO/NO-GO | décision owner explicite avec preuves datées |

## Données à laisser historiques

`Stage`, `StageSession`, `StageReservation`, `StageCoach`, `StageDocument`, `StageBilan`, `Payment` V1 et tous formats 9/12/15/18/20/30 h ou `intensif-renfort`. Aucun code V2 n'écrit ces tables. Les factures existantes restent inchangées ; une facture nouvelle peut être liée 1–1 à une inscription V2 sans réinterpréter les anciennes.

## Données exclusivement 2026 V2

Édition, modules/variantes/règles, cohortes/séances/ressources, demandes/sélections, propositions/snapshots, inscriptions/affectations/holds/waitlist, relations responsables utilisées par V2, paiements/remboursements V2, présences/bilans, communications/outbox/audit/materialisation.

## Rollback global

Ordre : couper public → couper commandes API → conserver lectures contractuelles → stopper nouveaux paiements → continuer webhooks des paiements déjà initiés → drainer/canceller outbox selon finalité → libérer holds → exporter état/audit → rollback applicatif. Aucun drop en production ordinaire. Une correction de données est une commande idempotente auditée, jamais un SQL manuel non consigné.
