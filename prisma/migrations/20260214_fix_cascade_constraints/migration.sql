-- Migration: Fix CASCADE constraints for integration tests
-- Date: 2026-02-14
-- Purpose: Allow proper cleanup in tests by adding CASCADE to foreign keys

-- Fix Payment.userId - Change from Restrict to Cascade for tests
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_userId_fkey";
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fix StudentBadge.badgeId - Change from Restrict to Cascade for tests
ALTER TABLE "student_badges" DROP CONSTRAINT IF EXISTS "student_badges_badgeId_fkey";
ALTER TABLE "student_badges" ADD CONSTRAINT "student_badges_badgeId_fkey" 
  FOREIGN KEY ("badgeId") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
