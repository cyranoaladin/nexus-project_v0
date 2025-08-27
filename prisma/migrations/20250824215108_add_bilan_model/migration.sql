-- CreateTable
CREATE TABLE "public"."bilans" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "qcmRaw" JSONB NOT NULL,
    "qcmScores" JSONB NOT NULL,
    "pedagoRaw" JSONB NOT NULL,
    "pedagoProfile" JSONB NOT NULL,
    "synthesis" JSONB NOT NULL,
    "offers" JSONB NOT NULL,
    "pdfUrl" TEXT,
    "pdfBlob" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bilans_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."bilans" ADD CONSTRAINT "bilans_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
