-- Add unique constraints to make skipDuplicates meaningful on post-commit side-effects

-- SessionNotification: one notification per (session, user, type, method)
CREATE UNIQUE INDEX "SessionNotification_sessionId_userId_type_method_key"
ON "SessionNotification"("sessionId", "userId", "type", "method");

-- SessionReminder: one reminder per (session, reminderType)
CREATE UNIQUE INDEX "SessionReminder_sessionId_reminderType_key"
ON "SessionReminder"("sessionId", "reminderType");
