-- CreateTable
CREATE TABLE "public"."session_reports" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "topicsCovered" TEXT NOT NULL,
    "performanceRating" INTEGER NOT NULL,
    "progressNotes" TEXT NOT NULL,
    "recommendations" TEXT NOT NULL,
    "attendance" BOOLEAN NOT NULL,
    "engagementLevel" "public"."EngagementLevel",
    "homeworkAssigned" TEXT,
    "nextSessionFocus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "session_reports_sessionId_key" ON "public"."session_reports"("sessionId");

-- CreateIndex
CREATE INDEX "session_reports_studentId_createdAt_idx" ON "public"."session_reports"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "session_reports_coachId_createdAt_idx" ON "public"."session_reports"("coachId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."session_reports" ADD CONSTRAINT "session_reports_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."SessionBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."session_reports" ADD CONSTRAINT "session_reports_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."session_reports" ADD CONSTRAINT "session_reports_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "public"."coach_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
