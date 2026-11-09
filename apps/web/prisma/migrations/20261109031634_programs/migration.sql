-- AlterTable
ALTER TABLE "ShowSettings" ADD COLUMN "liveEgressId" TEXT;
ALTER TABLE "ShowSettings" ADD COLUMN "liveProgramSlug" TEXT;

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#E30613',
    "accentColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "logoUrl" TEXT,
    "backgroundUrl" TEXT,
    "sceneJson" TEXT NOT NULL DEFAULT '{}',
    "draftSceneJson" TEXT NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Asset_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GcPreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GcPreset_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Program_slug_key" ON "Program"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_fileName_key" ON "Asset"("fileName");

-- Seed the initial programs (placeholder colors until the visual identity arrives).
INSERT INTO "Program" ("id", "slug", "name", "primaryColor", "accentColor", "sortOrder", "updatedAt") VALUES
  ('prog_debate',  'debate-bacana',  'Debate Bacana',  '#E30613', '#FFFFFF', 1, CURRENT_TIMESTAMP),
  ('prog_futebol', 'futebol-bacana', 'Futebol Bacana', '#0B8A3E', '#FFFFFF', 2, CURRENT_TIMESTAMP),
  ('prog_sabado',  'sabado-bacana',  'Sábado Bacana',  '#F5A100', '#1A1A1A', 3, CURRENT_TIMESTAMP);
