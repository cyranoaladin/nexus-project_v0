-- Closes the key set of the RECOVER_ARIA_TURN branch of the job-outbox payload
-- check. The two other branches already enforced a closed key set
-- (`?&` plus `payload - ARRAY[...] = '{}'`); this one only checked
-- `schemaVersion` and the type of `turnId`, so an arbitrary extra key — a
-- token, a password, an e-mail address — could be stored alongside them.
--
-- Measured before tightening: the sole producer
-- (lib/core-v2/aria/conversation-repository.ts:208) writes exactly
-- `{ schemaVersion: 1, turnId }`, so no legitimate row carries anything else.
-- A hostile payload `{schemaVersion:1, turnId:'t', token:'leak'}` was accepted
-- before this migration and is refused after it.
--
-- Forward-only. The DROP/ADD pair is a single atomic ALTER TABLE: the
-- constraint is never absent, and no table, column, row or other constraint
-- semantic is removed. Every other branch is reproduced byte-for-byte from
-- pg_get_constraintdef, so this migration RESTRICTS exactly one branch and
-- changes nothing else.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Explicit pre-check. Adding a stricter CHECK validates existing rows, so a
-- single legacy row carrying an extra key would otherwise abort the deploy with
-- a bare constraint violation and leave a failed-migration record (P3009).
-- Refusing is the correct outcome for a security tightening — the alternative,
-- NOT VALID, would leave the offending payload in place — but the operator must
-- be told exactly what to look at. Outbox rows are pending work and are never
-- deleted here.
DO $$
DECLARE offending bigint;
BEGIN
  SELECT count(*) INTO offending
  FROM "core_v2_job_outbox"
  WHERE "jobType"::text = 'RECOVER_ARIA_TURN'
    AND ("payload" - ARRAY['schemaVersion', 'turnId']) <> '{}'::jsonb;

  IF offending > 0 THEN
    RAISE EXCEPTION
      'ARIA_OUTBOX_PAYLOAD_HAS_UNEXPECTED_KEYS: % row(s) carry a key outside {schemaVersion,turnId}. Inspect them before retrying: SELECT id, "payload" - ARRAY[''schemaVersion'',''turnId''] AS extra FROM "core_v2_job_outbox" WHERE "jobType"::text = ''RECOVER_ARIA_TURN'' AND ("payload" - ARRAY[''schemaVersion'',''turnId'']) <> ''{}''::jsonb;',
      offending;
  END IF;
END $$;

ALTER TABLE "core_v2_job_outbox"
  DROP CONSTRAINT "core_v2_job_outbox_payload_check",
  ADD CONSTRAINT "core_v2_job_outbox_payload_check" CHECK (COALESCE(
    jsonb_typeof("payload") = 'object' AND CASE
      WHEN "jobType"::text = 'RECOVER_ARIA_TURN' THEN
        "payload" ?& ARRAY['schemaVersion', 'turnId']
        AND "payload" - ARRAY['schemaVersion', 'turnId'] = '{}'::jsonb
        AND "payload"->>'schemaVersion' = '1'
        AND jsonb_typeof("payload"->'turnId') = 'string'
      WHEN "jobType"::text = 'ACCOUNT_EMAIL_HANDOFF' THEN
        "aggregateType" = 'ACCOUNT_EMAIL_HANDOFF'
        AND char_length("aggregateId") BETWEEN 1 AND 128
        AND "payload" ?& ARRAY['schemaVersion', 'keyVersion', 'iv', 'tag', 'ciphertext']
        AND "payload" - ARRAY['schemaVersion', 'keyVersion', 'iv', 'tag', 'ciphertext'] = '{}'::jsonb
        AND "payload"->>'schemaVersion' = 'account-email-handoff/v1'
        AND jsonb_typeof("payload"->'keyVersion') = 'string'
        AND "payload"->>'keyVersion' ~ '^[A-Za-z0-9_.-]{1,32}$'
        AND jsonb_typeof("payload"->'iv') = 'string'
        AND "payload"->>'iv' ~ '^[A-Za-z0-9_-]{16}$'
        AND jsonb_typeof("payload"->'tag') = 'string'
        AND "payload"->>'tag' ~ '^[A-Za-z0-9_-]{22}$'
        AND jsonb_typeof("payload"->'ciphertext') = 'string'
        AND char_length("payload"->>'ciphertext') BETWEEN 1 AND 16384
        AND "payload"->>'ciphertext' ~ '^[A-Za-z0-9_-]+$'
      WHEN "jobType"::text = 'ACCOUNT_V1_PROVISIONING' THEN
        "aggregateType" = 'ACCOUNT_V1_PROVISIONING'
        AND char_length("aggregateId") BETWEEN 1 AND 128
        AND "payload" ?& ARRAY['schemaVersion', 'userId', 'generation', 'kind']
        AND "payload" - ARRAY['schemaVersion', 'userId', 'generation', 'kind'] = '{}'::jsonb
        AND "payload"->>'schemaVersion' = 'account-v1-provisioning/v1'
        AND jsonb_typeof("payload"->'userId') = 'string'
        AND "payload"->>'userId' = "aggregateId"
        AND jsonb_typeof("payload"->'generation') = 'number'
        AND "payload"->>'generation' ~ '^[1-9][0-9]{0,8}$'
        AND "payload"->>'kind' IN ('ADVANCE', 'REVOKE')
      ELSE false
    END, false)) NOT VALID;

-- Deux temps, comme 0025 et 0026, et pour une raison mesurable : valider EN
-- LIGNE fait courir le balayage des lignes existantes a l'interieur du ALTER,
-- donc sous ACCESS EXCLUSIVE. Sur un outbox volumineux ce balayage peut
-- depasser le statement_timeout pose plus haut et faire echouer le deploiement.
--
-- La rigueur n'est pas relachee : ce n'est pas NOT VALID qui decide du sort des
-- lignes fautives, c'est le controle prealable ci-dessus, qui refuse par un nom
-- d'erreur explicite AVANT toute ecriture. A ce stade il est donc etabli
-- qu'aucune ligne ne viole la contrainte, et VALIDATE ne fait que l'enregistrer,
-- sous un verrou plus faible (SHARE UPDATE EXCLUSIVE) qui ne bloque ni les
-- lectures ni les ecritures ordinaires.
ALTER TABLE "core_v2_job_outbox" VALIDATE CONSTRAINT "core_v2_job_outbox_payload_check";

COMMIT;
