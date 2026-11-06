-- CreateTable
CREATE TABLE "ShowSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "youtubeStreamKeyCipher" TEXT,
    "lowerThirdText" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT,
    "updatedAt" DATETIME NOT NULL
);
