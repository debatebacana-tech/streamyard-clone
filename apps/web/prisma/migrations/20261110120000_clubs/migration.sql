-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "short" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#1E3A8A',
    "crestUrl" TEXT,
    "vinhetaUrl" TEXT,
    "anthemUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
