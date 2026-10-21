-- Forward-only additive production migration; run after database backup.
BEGIN;
CREATE TABLE IF NOT EXISTS collab_image (
 organization_id text NOT NULL, document_id text NOT NULL, id uuid NOT NULL,
 mime text NOT NULL CHECK(mime IN ('image/png','image/jpeg','image/webp')),
 bytes bytea NOT NULL CHECK(octet_length(bytes) BETWEEN 1 AND 5242880),
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(document_id,id),
 FOREIGN KEY(organization_id,document_id) REFERENCES collab_document(organization_id,id) ON DELETE CASCADE
);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='collab_image_mime_check') THEN
  ALTER TABLE collab_image ADD CONSTRAINT collab_image_mime_check CHECK(mime IN ('image/png','image/jpeg','image/webp'));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='collab_image_bytes_check') THEN
  ALTER TABLE collab_image ADD CONSTRAINT collab_image_bytes_check CHECK(octet_length(bytes) BETWEEN 1 AND 5242880);
 END IF;
END $$;

ALTER TABLE collab_image ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_image FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant ON collab_image;
CREATE POLICY tenant ON collab_image USING (organization_id = nullif(current_setting('app.current_org_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.current_org_id',true),''));
GRANT SELECT,INSERT,UPDATE,DELETE ON collab_image TO collabspace_app;
COMMIT;
