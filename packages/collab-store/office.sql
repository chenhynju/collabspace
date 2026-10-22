-- Additive Office storage; Yjs remains the authority only for text/boards.
ALTER TABLE collab_document DROP CONSTRAINT IF EXISTS collab_document_kind_check;
ALTER TABLE collab_document ADD CONSTRAINT collab_document_kind_check CHECK(kind IN ('DOCUMENT','BOARD','MARKDOWN','OFFICE'));
CREATE TABLE IF NOT EXISTS collab_office (
 organization_id text NOT NULL, document_id text NOT NULL, file_id text NOT NULL,
 extension text NOT NULL CHECK(extension IN ('docx','xlsx','pptx')),
 generation uuid NOT NULL, phase text NOT NULL CHECK(phase IN ('CLOSED','OPEN','FROZEN')),
 revision integer NOT NULL DEFAULT 1, issued integer NOT NULL DEFAULT 0, saved integer NOT NULL DEFAULT 0,
 users jsonb NOT NULL DEFAULT '[]', error text, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(document_id), UNIQUE(organization_id,file_id),
 FOREIGN KEY(organization_id,document_id) REFERENCES collab_document(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS collab_office_version (
 organization_id text NOT NULL, document_id text NOT NULL, id uuid PRIMARY KEY,
 revision integer, generation uuid NOT NULL, receipt text NOT NULL, bytes bytea NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(document_id,receipt), UNIQUE(document_id,revision),
 FOREIGN KEY(organization_id,document_id) REFERENCES collab_document(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS collab_office_lease (
 organization_id text NOT NULL, document_id text NOT NULL, user_id text NOT NULL,
 generation uuid NOT NULL, role text NOT NULL, expires_at timestamptz NOT NULL,
 PRIMARY KEY(document_id,user_id),
 FOREIGN KEY(organization_id,document_id) REFERENCES collab_document(organization_id,id) ON DELETE CASCADE
);
-- Per-client engine identities prevent delayed close/save callbacks from an
-- earlier tab from being mistaken for a later session of the same account.
ALTER TABLE collab_office ADD COLUMN IF NOT EXISTS activity_epoch integer NOT NULL DEFAULT 0;
ALTER TABLE collab_office DROP CONSTRAINT IF EXISTS collab_office_phase_check;
ALTER TABLE collab_office ADD CONSTRAINT collab_office_phase_check CHECK(phase IN ('CLOSED','OPEN','CLOSING','FROZEN'));
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='collab_office_lease' AND column_name='id') THEN
  UPDATE collab_office SET phase='FROZEN',users='[]',error='SESSION_PROTOCOL_UPGRADE' WHERE phase IN ('OPEN','CLOSING');
 END IF;
END $$;
ALTER TABLE collab_office_lease ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE collab_office_lease ALTER COLUMN id SET NOT NULL;
ALTER TABLE collab_office_lease ADD COLUMN IF NOT EXISTS active_epoch integer NOT NULL DEFAULT 0;
ALTER TABLE collab_office_lease DROP CONSTRAINT IF EXISTS collab_office_lease_pkey;
ALTER TABLE collab_office_lease ADD PRIMARY KEY(document_id,id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['collab_office','collab_office_version','collab_office_lease'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('DROP POLICY IF EXISTS tenant ON %I',t);
  EXECUTE format('CREATE POLICY tenant ON %I USING (organization_id=nullif(current_setting(''app.current_org_id'',true),'''')) WITH CHECK(organization_id=nullif(current_setting(''app.current_org_id'',true),''''))',t);
 END LOOP;
END $$;
