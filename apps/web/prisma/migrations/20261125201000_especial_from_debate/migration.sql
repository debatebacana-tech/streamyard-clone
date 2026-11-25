-- The Especial Brasileirão starts from Debate Bacana's look and sounds (not Futebol Bacana's).
UPDATE "Program"
SET "primaryColor" = (SELECT "primaryColor" FROM "Program" WHERE "slug" = 'debate-bacana'),
    "accentColor" = (SELECT "accentColor" FROM "Program" WHERE "slug" = 'debate-bacana'),
    "logoUrl" = (SELECT "logoUrl" FROM "Program" WHERE "slug" = 'debate-bacana'),
    "backgroundUrl" = (SELECT "backgroundUrl" FROM "Program" WHERE "slug" = 'debate-bacana'),
    "configJson" = (SELECT "configJson" FROM "Program" WHERE "slug" = 'debate-bacana'),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'especial-brasileirao' AND EXISTS (SELECT 1 FROM "Program" WHERE "slug" = 'debate-bacana');
