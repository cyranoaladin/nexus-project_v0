# PR C — Conversation ARIA native Core v2

## Date

2026-09-23

## Contexte

PR #318 est fusionnée sur `main` (`33844c0879fbd8297f5daa0fb935578c633cac35`).
PR C démarre depuis ce commit sur `feat/core-v2-aria-conversation`.

## Décisions

- Les conversations Core v2 utilisent des modèles Prisma dédiés et des clés
  étrangères vers les seuls `User`/`Student` Core v2.
- L’autorisation conversationnelle est construite par un adapter Core v2 :
  sujet = soi-même, inscription Core v2 courante, scopes et tier issus du
  contexte d’entitlement canonique partagé.
- La vérification de scope de cours est centralisée dans
  `lib/aria/kernel/entitlements.ts`; aucun second classement de tiers n’est
  introduit.
- La migration 0019 conserve les invariants V1 qui restent métier : FK
  conversation/sujet et turn/message composites, un seul turn actif, forme
  des snapshots/fingerprints, transitions terminales, audit d’annulation,
  sémantique des messages et provenance atomique des citations.
- `contextState=LEGACY_CONTEXT_UNRESOLVED` n’est pas porté : ce store est
  natif et aucune migration de conversations V1 n’est dans le périmètre PR C.
- Le statut mutable du message est retiré : l’état de génération est porté
  par le Turn, afin d’éviter une seconde source de vérité.
- Chaque message Core v2 est obligatoirement lié à un Turn et la seule
  dimension de rôle persistée est `role`; `UNIQUE(turnId, role)` garantit au
  plus un message USER et un message ASSISTANT par Turn.
- Le Turn impose au niveau PostgreSQL que `actorUserId` soit le propriétaire du
  `subjectStudentId`, et qu’un acteur d’annulation soit le même acteur que le
  Turn. Ces invariants ne dépendent ni d’un e-mail ni d’un contrôle applicatif.
- Le repository `CoreV2AriaConversationRepository` implémente les ports
  Conversation Foundation sans les modifier. Il couvre réservation
  idempotente, claim, checkpoint RAG, finalisation fenced, historique,
  annulation et heartbeat.
- La migration 0020 introduit `CoreV2JobOutbox`, limité à
  `RECOVER_ARIA_TURN`, avec payload versionné sans PII, leases, plafond de
  20 tentatives, backoff borné et états terminaux irréversibles.
- `reserve`, `claim`, `heartbeat`, `finalize`, `cancel` et recovery suivent
  l’ordre de verrouillage `TURN → JOB`. Le worker claim des jobs en
  transaction courte avec `FOR UPDATE SKIP LOCKED`, puis traite chaque job
  dans une transaction séparée.
- La recovery ne relance jamais un provider : elle reschedule un worker vivant
  ou terminalise de façon sûre un Turn stale/cancelled.
- Les routes et l’exécution Conversation Foundation seront branchées sur ces
  modèles dans les incréments suivants. Aucun appel réel provider ou
  déploiement n’est effectué à ce stade.

## Migration plan

1. `0019_core_v2_aria_conversation` : tables et contraintes natives Core v2,
   validées sans drift contre une base disposable.
2. `CoreV2AriaConversationRepository` : adapter repository implémentant les
   ports Conversation Foundation, avec concurrence PostgreSQL et fencing.
3. `0020_core_v2_job_outbox` + worker/watchdog Core v2.
4. Routes `/api/v2/aria/**` : chat, historique, annulation et feedback.
5. Wiring RAG/provider, puis client authority-aware.
6. Tests unitaires, Core v2 DB/E2E et qualification intégrée avant toute
   release ou migration de preview.

## Vérifications de cet incrément

- `prisma validate` sur le schéma Core v2.
- Test unitaire de l’adapter d’autorisation Core v2.
- Contre-épreuves PostgreSQL des FK composites, de la concurrence et du
  lifecycle de Turn.
- Tests PostgreSQL du repository : réservation/replay, concurrence, séquence,
  claim/finalize, historique, annulation et heartbeat.
- Tests PostgreSQL recovery : watchdog atomique, claim concurrent,
  reschedule, stale PENDING/RUNNING, annulation, FAILED_FINAL et invariants
  de configuration du worker.
- `SCHEMA↔MIGRATION DRIFT = NONE` et `PRISMA DIFF AFTER 0019 = EMPTY` après
  déploiement sur une base disposable.
- Génération locale du client Prisma Core v2 (artefact gitignored).

## Risques restants

- Les transports Core v2 ne sont pas encore branchés.
- Les appels provider/RAG réels et le client restent désactivés.
- Le chat Core v2 ne doit pas être exposé avant le wiring complet et les E2E.
- La migration doit être répétée sur une base Core v2 disposable avant toute
  qualification intégrée.
