-- CreateEnum
CREATE TYPE "AriaWorkshopSessionStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AriaWorkshopAttendeeStatus" AS ENUM ('REGISTERED', 'ATTENDED', 'ABSENT', 'CANCELLED');

-- CreateTable
CREATE TABLE "aria_workshop_sessions" (
    "id" TEXT NOT NULL,
    "courseKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "coachProfileId" TEXT,
    "scheduledDate" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "modality" "SessionModality" NOT NULL DEFAULT 'ONLINE',
    "location" TEXT,
    "capacity" INTEGER,
    "status" "AriaWorkshopSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aria_workshop_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aria_workshop_attendees" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AriaWorkshopAttendeeStatus" NOT NULL DEFAULT 'REGISTERED',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attendanceMarkedAt" TIMESTAMP(3),
    "attendanceMarkedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aria_workshop_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aria_workshop_sessions_courseKey_scheduledDate_idx" ON "aria_workshop_sessions"("courseKey", "scheduledDate");

-- CreateIndex
CREATE INDEX "aria_workshop_attendees_studentId_idx" ON "aria_workshop_attendees"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "aria_workshop_attendees_sessionId_studentId_key" ON "aria_workshop_attendees"("sessionId", "studentId");

-- AddForeignKey
ALTER TABLE "aria_workshop_sessions" ADD CONSTRAINT "aria_workshop_sessions_coachProfileId_fkey" FOREIGN KEY ("coachProfileId") REFERENCES "coach_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aria_workshop_sessions" ADD CONSTRAINT "aria_workshop_sessions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aria_workshop_attendees" ADD CONSTRAINT "aria_workshop_attendees_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "aria_workshop_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aria_workshop_attendees" ADD CONSTRAINT "aria_workshop_attendees_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aria_workshop_attendees" ADD CONSTRAINT "aria_workshop_attendees_attendanceMarkedById_fkey" FOREIGN KEY ("attendanceMarkedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
