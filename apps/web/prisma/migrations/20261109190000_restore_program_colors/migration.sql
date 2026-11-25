-- Back to each program's own colors (the brand-manual graphite + lime look
-- was reverted). Only programs still on that lime default are touched.
UPDATE "Program" SET "primaryColor" = '#E30613', "accentColor" = '#FFFFFF' WHERE "slug" = 'debate-bacana' AND "primaryColor" = '#DFFF00';
UPDATE "Program" SET "primaryColor" = '#0B8A3E', "accentColor" = '#FFFFFF' WHERE "slug" = 'futebol-bacana' AND "primaryColor" = '#DFFF00';
UPDATE "Program" SET "primaryColor" = '#F5A100', "accentColor" = '#1A1A1A' WHERE "slug" = 'sabado-bacana' AND "primaryColor" = '#DFFF00';
