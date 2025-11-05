-- Add dashboardStudentId column shared with the FastAPI backend
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "dashboardStudentId" UUID;

-- Ensure each backend student mapping remains unique
CREATE UNIQUE INDEX IF NOT EXISTS "students_dashboardStudentId_key" ON "students" ("dashboardStudentId");
