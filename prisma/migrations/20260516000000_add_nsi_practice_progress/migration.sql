-- CreateTable
CREATE TABLE "nsi_practice_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nsi_practice_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nsi_practice_progress_userId_key" ON "nsi_practice_progress"("userId");

-- CreateIndex
CREATE INDEX "nsi_practice_progress_userId_idx" ON "nsi_practice_progress"("userId");

-- AddForeignKey
ALTER TABLE "nsi_practice_progress" ADD CONSTRAINT "nsi_practice_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
