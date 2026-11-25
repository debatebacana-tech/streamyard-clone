-- "Especial Brasileirão": a program of its own for the last-round live, with
-- Futebol Bacana's look, sounds and tools as a starting point (its scenes start empty).
INSERT OR IGNORE INTO "Program" ("id", "slug", "name", "primaryColor", "accentColor", "logoUrl", "backgroundUrl", "sceneJson", "draftSceneJson", "format", "configJson", "sortOrder", "createdAt", "updatedAt")
SELECT 'prog_especial_br', 'especial-brasileirao', 'Especial Brasileirão', "primaryColor", "accentColor", "logoUrl", "backgroundUrl", '{}', '{}', 'futebol', "configJson", 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Program" WHERE "slug" = 'futebol-bacana';
