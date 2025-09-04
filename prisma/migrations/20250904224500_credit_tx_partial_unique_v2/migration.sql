-- Deduplicate existing credit_tx when externalId is present (keep latest by `at`)
WITH ranked AS (
  SELECT id, provider, "externalId", at,
         ROW_NUMBER() OVER (PARTITION BY provider, "externalId" ORDER BY at DESC, id DESC) rn
  FROM public.credit_tx
  WHERE "externalId" IS NOT NULL
)
DELETE FROM public.credit_tx t
USING ranked r
WHERE t.id = r.id AND r.rn > 1;

-- Partial unique index to prevent duplicate credit_tx when externalId is present
CREATE UNIQUE INDEX IF NOT EXISTS credit_tx_provider_externalId_key
ON public.credit_tx(provider, "externalId")
WHERE "externalId" IS NOT NULL;

