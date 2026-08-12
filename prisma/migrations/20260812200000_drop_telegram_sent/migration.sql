-- Telegram notifications have been removed entirely from the application.
-- Drop the now-unused tracking column.

ALTER TABLE "stage_reservations" DROP COLUMN "telegramSent";
