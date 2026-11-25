-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Asset_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Asset" ("createdAt", "fileName", "id", "kind", "mimeType", "name", "programId", "size") SELECT "createdAt", "fileName", "id", "kind", "mimeType", "name", "programId", "size" FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE UNIQUE INDEX "Asset_fileName_key" ON "Asset"("fileName");
CREATE TABLE "new_Program" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#E30613',
    "accentColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "logoUrl" TEXT,
    "backgroundUrl" TEXT,
    "sceneJson" TEXT NOT NULL DEFAULT '{}',
    "draftSceneJson" TEXT NOT NULL DEFAULT '{}',
    "format" TEXT NOT NULL DEFAULT 'debate',
    "configJson" TEXT NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Program" ("accentColor", "backgroundUrl", "createdAt", "draftSceneJson", "id", "logoUrl", "name", "primaryColor", "sceneJson", "slug", "sortOrder", "updatedAt") SELECT "accentColor", "backgroundUrl", "createdAt", "draftSceneJson", "id", "logoUrl", "name", "primaryColor", "sceneJson", "slug", "sortOrder", "updatedAt" FROM "Program";
DROP TABLE "Program";
ALTER TABLE "new_Program" RENAME TO "Program";
CREATE UNIQUE INDEX "Program_slug_key" ON "Program"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Brand manual: every program shares the graphite + lime identity.
UPDATE "Program" SET "primaryColor" = '#DFFF00', "accentColor" = '#0B0D0F';
UPDATE "Program" SET "format" = 'futebol' WHERE "slug" = 'futebol-bacana';
UPDATE "Program" SET "format" = 'especial' WHERE "slug" = 'sabado-bacana';
-- Legacy uploads: audio was only used as sound pads.
UPDATE "Asset" SET "role" = 'efeito' WHERE "kind" IN ('audio', 'video');
