CREATE TYPE "ContactLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'ENROLLED', 'LOST');

CREATE TABLE "contact_leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "profile" TEXT,
    "interest" TEXT,
    "urgency" TEXT,
    "source" TEXT,
    "status" "ContactLeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_leads_email_idx" ON "contact_leads"("email");
CREATE INDEX "contact_leads_status_idx" ON "contact_leads"("status");
CREATE INDEX "contact_leads_source_idx" ON "contact_leads"("source");
CREATE INDEX "contact_leads_createdAt_idx" ON "contact_leads"("createdAt");
