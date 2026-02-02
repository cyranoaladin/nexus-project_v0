-- AlterTable: Add exclusion constraint for session overlap prevention
-- This prevents double-booking coaches with overlapping time slots
--
-- CRITICAL: Prevents overlapping session bookings (INV-SES-2)
-- Context: Two concurrent booking requests can both pass availability check
-- Risk without constraint: Coach can be double-booked → operational chaos

-- Step 1: Enable btree_gist extension for GiST exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Step 2: Create immutable function to convert date + time string to timestamp
-- This is needed because index expressions must be immutable
CREATE OR REPLACE FUNCTION session_time_to_timestamp(date_val DATE, time_str TEXT)
RETURNS TIMESTAMP AS $$
BEGIN
  RETURN (date_val::TEXT || ' ' || time_str)::TIMESTAMP;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 3: Add exclusion constraint for overlapping time ranges
-- The constraint ensures no two active sessions for the same coach on the same date
-- can have overlapping time ranges (startTime, endTime)
--
-- Note: This uses tsrange to create a time range from startTime to endTime
-- The && operator checks for range overlap
-- The constraint only applies to active sessions (SCHEDULED, CONFIRMED, IN_PROGRESS)
ALTER TABLE "SessionBooking"
ADD CONSTRAINT "SessionBooking_no_overlap_excl"
EXCLUDE USING gist (
  "coachId" WITH =,
  "scheduledDate" WITH =,
  tsrange(
    session_time_to_timestamp("scheduledDate"::DATE, "startTime"),
    session_time_to_timestamp("scheduledDate"::DATE, "endTime")
  ) WITH &&
)
WHERE (status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'));
