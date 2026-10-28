-- Apply only with an explicitly approved production change, a verified backup,
-- and psql --single-transaction -v ON_ERROR_STOP=1.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
-- The digital-human TTS adapter stores optional mouth-shape offsets with audio.
ALTER TABLE voice_job ADD COLUMN IF NOT EXISTS result_visemes jsonb;
\ir ../../packages/collab-store/persona.sql
