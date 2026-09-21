/*
  Warnings:

  - Added the required column `subjectSha256Snapshot` to the `diagnostic_assignments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subjectSha256` to the `diagnostic_instrument_refs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "diagnostic_assignments" ADD COLUMN     "baremeReferenceSnapshot" TEXT,
ADD COLUMN     "subjectSha256Snapshot" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "diagnostic_instrument_refs" ADD COLUMN     "baremeReference" TEXT,
ADD COLUMN     "subjectSha256" TEXT NOT NULL;
