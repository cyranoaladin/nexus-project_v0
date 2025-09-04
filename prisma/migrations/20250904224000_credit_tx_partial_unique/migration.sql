-- Partial unique index to prevent duplicate credit_tx when externalId is present
CREATE UNIQUE INDEX IF NOT EXISTS credit_tx_provider_externalId_key
ON public.credit_tx(provider, "externalId")
WHERE "externalId" IS NOT NULL;

