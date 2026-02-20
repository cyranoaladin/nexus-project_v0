-- Create user_documents table
CREATE TABLE IF NOT EXISTS "user_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "localPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "uploadedById" TEXT,

    CONSTRAINT "user_documents_pkey" PRIMARY KEY ("id")
);

-- Create indices
CREATE UNIQUE INDEX IF NOT EXISTS "user_documents_localPath_key" ON "user_documents"("localPath");
CREATE INDEX IF NOT EXISTS "user_documents_userId_idx" ON "user_documents"("userId");
CREATE INDEX IF NOT EXISTS "user_documents_uploadedById_idx" ON "user_documents"("uploadedById");

-- Add foreign keys with check
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_documents_userId_fkey') THEN
        ALTER TABLE "user_documents" ADD CONSTRAINT "user_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_documents_uploadedById_fkey') THEN
        ALTER TABLE "user_documents" ADD CONSTRAINT "user_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
