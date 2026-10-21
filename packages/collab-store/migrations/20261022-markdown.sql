-- Additive kind expansion; existing documents/boards are unchanged.
BEGIN;
ALTER TABLE collab_document DROP CONSTRAINT IF EXISTS collab_document_kind_check;
ALTER TABLE collab_document ADD CONSTRAINT collab_document_kind_check CHECK(kind IN ('DOCUMENT','BOARD','MARKDOWN'));
COMMIT;
