-- AlterEnum
-- Additive only: existing values (NEW, CONTACTED, QUALIFIED, ENROLLED, LOST) are untouched,
-- still used by the general /api/contact lead flow (lib/crm/contact-leads.ts).
ALTER TYPE "ContactLeadStatus" ADD VALUE 'NOUVEAU';
ALTER TYPE "ContactLeadStatus" ADD VALUE 'QUALIFIE';
ALTER TYPE "ContactLeadStatus" ADD VALUE 'RDV_FIXE';
ALTER TYPE "ContactLeadStatus" ADD VALUE 'BILAN_FAIT';
ALTER TYPE "ContactLeadStatus" ADD VALUE 'CONVERTI';
ALTER TYPE "ContactLeadStatus" ADD VALUE 'PERDU';

-- AlterTable
ALTER TABLE "contact_leads" ADD COLUMN "studentFirstName" TEXT;
ALTER TABLE "contact_leads" ADD COLUMN "gradeLevel" TEXT;
ALTER TABLE "contact_leads" ADD COLUMN "establishment" TEXT;
ALTER TABLE "contact_leads" ADD COLUMN "subjects" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "contact_leads" ADD COLUMN "mainNeed" TEXT;
ALTER TABLE "contact_leads" ADD COLUMN "message" TEXT;
ALTER TABLE "contact_leads" ADD COLUMN "offerCode" TEXT;
ALTER TABLE "contact_leads" ADD COLUMN "campaignContext" JSONB;
ALTER TABLE "contact_leads" ADD COLUMN "consentAt" TIMESTAMP(3);
