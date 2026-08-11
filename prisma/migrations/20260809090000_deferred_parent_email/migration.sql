-- A household account can exist before any e-mail address is known.
-- PostgreSQL's existing UNIQUE index keeps every non-null address unique
-- while allowing several NULL values; do not replace or drop it.
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

-- Preserve the number shown to staff in `phone`; comparisons use the local,
-- prefix-free canonical form below.
ALTER TABLE "users" ADD COLUMN "phoneNormalized" TEXT;

-- Conservative backfill: only unambiguous Tunisian eight-digit numbers are
-- canonicalized. Other historical display values stay untouched for review.
UPDATE "users"
SET "phoneNormalized" = CASE
  WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^[1-9][0-9]{7}$'
    THEN regexp_replace("phone", '[^0-9]', '', 'g')
  WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^216[1-9][0-9]{7}$'
    THEN substring(regexp_replace("phone", '[^0-9]', '', 'g') FROM 4)
  WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^00216[1-9][0-9]{7}$'
    THEN substring(regexp_replace("phone", '[^0-9]', '', 'g') FROM 6)
  ELSE NULL
END
WHERE "phone" IS NOT NULL;

CREATE INDEX "users_phoneNormalized_idx" ON "users"("phoneNormalized");
