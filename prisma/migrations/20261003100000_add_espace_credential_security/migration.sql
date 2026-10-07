-- Espace pédagogique : changement autonome du code/mot de passe et réinitialisation par l'enseignant.
-- Strictement additif : une colonne avec valeur par défaut, une table. Aucune ligne existante n'est modifiée.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "pinMustChange" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "espace_security_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "espace_security_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "espace_security_events_userId_createdAt_idx" ON "espace_security_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "espace_security_events_type_createdAt_idx" ON "espace_security_events"("type", "createdAt");
