-- CreateTable
CREATE TABLE "public"."LegalPage" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentMd" TEXT NOT NULL,
    "contentHtml" TEXT,
    "placeholders" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "contentHash" TEXT NOT NULL,
    "gitCommit" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LegalVersion" (
    "id" SERIAL NOT NULL,
    "pageId" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentMd" TEXT NOT NULL,
    "contentHtml" TEXT,
    "version" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "gitCommit" TEXT,
    "editorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegalPage_slug_key" ON "public"."LegalPage"("slug");

-- CreateIndex
CREATE INDEX "LegalVersion_slug_idx" ON "public"."LegalVersion"("slug");

-- CreateIndex
CREATE INDEX "LegalVersion_pageId_version_idx" ON "public"."LegalVersion"("pageId", "version");

-- AddForeignKey
ALTER TABLE "public"."LegalVersion" ADD CONSTRAINT "LegalVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "public"."LegalPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
