-- Additive only: existing documents and grants remain unchanged.
BEGIN;
ALTER TABLE collab_document ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'DOCUMENT' CHECK(kind IN ('DOCUMENT','BOARD'));
COMMIT;
