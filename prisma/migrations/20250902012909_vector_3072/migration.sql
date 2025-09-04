-- AlterTable
ALTER TABLE "public"."bilans" ADD COLUMN     "generatedAt" TIMESTAMP(3),
ADD COLUMN     "preAnalyzedData" JSONB,
ADD COLUMN     "reportText" TEXT,
ADD COLUMN     "summaryText" TEXT;

-- CreateTable
CREATE TABLE "public"."student_profile_data" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "pedagoRawAnswers" JSONB,
    "pedagoProfile" JSONB,
    "preAnalyzedData" JSONB,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_profile_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_profile_data_studentId_key" ON "public"."student_profile_data"("studentId");

-- AddForeignKey
ALTER TABLE "public"."student_profile_data" ADD CONSTRAINT "student_profile_data_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
