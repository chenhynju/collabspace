-- Additive migration; existing TeamSpace tables are unchanged except a composite key.
CREATE UNIQUE INDEX IF NOT EXISTS prj_project_org_id_key ON prj_project(organization_id,id);
CREATE TABLE IF NOT EXISTS collab_document (
 id text PRIMARY KEY, organization_id text NOT NULL, project_id text NOT NULL,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','ARCHIVED')),
 revision integer NOT NULL DEFAULT 1, acl_epoch integer NOT NULL DEFAULT 1,
 seq bigint NOT NULL DEFAULT 0, state bytea NOT NULL, created_by text NOT NULL REFERENCES sys_user(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id), FOREIGN KEY(organization_id,project_id) REFERENCES prj_project(organization_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS collab_document_project ON collab_document(organization_id,project_id,updated_at DESC);
ALTER TABLE collab_document ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'DOCUMENT' CHECK(kind IN ('DOCUMENT','BOARD'));
ALTER TABLE collab_document DROP CONSTRAINT IF EXISTS collab_document_kind_check;
ALTER TABLE collab_document ADD CONSTRAINT collab_document_kind_check CHECK(kind IN ('DOCUMENT','BOARD','MARKDOWN'));
CREATE TABLE IF NOT EXISTS collab_grant (
 organization_id text NOT NULL, document_id text NOT NULL, user_id text NOT NULL REFERENCES sys_user(id),
 role text NOT NULL CHECK(role IN ('OWNER','EDITOR','COMMENTER','VIEWER')),
 PRIMARY KEY(document_id,user_id),
 FOREIGN KEY(organization_id,document_id) REFERENCES collab_document(organization_id,id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,user_id) REFERENCES org_membership(organization_id,user_id)
);
CREATE TABLE IF NOT EXISTS collab_update (
 organization_id text NOT NULL, document_id text NOT NULL, update_id uuid NOT NULL,
 seq bigint NOT NULL, actor_id text NOT NULL, checksum text NOT NULL, bytes bytea NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(document_id,update_id), UNIQUE(document_id,seq),
 FOREIGN KEY(organization_id,document_id) REFERENCES collab_document(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS collab_ticket (
 hash text PRIMARY KEY, organization_id text NOT NULL, document_id text NOT NULL, user_id text NOT NULL,
 expires_at timestamptz NOT NULL, consumed_at timestamptz,
 FOREIGN KEY(organization_id,document_id) REFERENCES collab_document(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS collab_thread (
 id uuid PRIMARY KEY, organization_id text NOT NULL, document_id text NOT NULL,
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 5000), quote text NOT NULL DEFAULT '',
 anchor jsonb, resolved boolean NOT NULL DEFAULT false, revision integer NOT NULL DEFAULT 1,
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,document_id,id),
 FOREIGN KEY(organization_id,document_id) REFERENCES collab_document(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS collab_reply (
 id uuid PRIMARY KEY, organization_id text NOT NULL, document_id text NOT NULL, thread_id uuid NOT NULL,
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 5000), created_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,document_id,thread_id) REFERENCES collab_thread(organization_id,document_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS collab_version (
 id uuid PRIMARY KEY, organization_id text NOT NULL, document_id text NOT NULL,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160), seq bigint NOT NULL, state bytea NOT NULL,
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,document_id) REFERENCES collab_document(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS collab_restore (
 id uuid PRIMARY KEY, organization_id text NOT NULL, document_id text NOT NULL,
 version_id uuid NOT NULL, actor_id text NOT NULL, result_id text NOT NULL,
 FOREIGN KEY(organization_id,document_id) REFERENCES collab_document(organization_id,id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,result_id) REFERENCES collab_document(organization_id,id) ON DELETE CASCADE
);
-- db push may have created these tables before this additive migration. Install
-- constraints explicitly in that case too; never rely only on CREATE IF NOT EXISTS.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='collab_grant_member_fk') THEN
  ALTER TABLE collab_grant ADD CONSTRAINT collab_grant_member_fk FOREIGN KEY(organization_id,user_id) REFERENCES org_membership(organization_id,user_id);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='collab_document_title_check') THEN
  ALTER TABLE collab_document ADD CONSTRAINT collab_document_title_check CHECK(length(title) BETWEEN 1 AND 160);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='collab_grant_role_check') THEN
  ALTER TABLE collab_grant ADD CONSTRAINT collab_grant_role_check CHECK(role IN ('OWNER','EDITOR','COMMENTER','VIEWER'));
 END IF;
END $$;
-- Database RLS is the tenant defense; document ACL and parent state are checked
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
-- by Store transactions for every operation, including every WS read/write.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['collab_document','collab_grant','collab_update','collab_ticket','collab_thread','collab_reply','collab_version','collab_restore','collab_image'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('DROP POLICY IF EXISTS tenant ON %I',t);
  EXECUTE format('CREATE POLICY tenant ON %I USING (organization_id = nullif(current_setting(''app.current_org_id'',true),'''')) WITH CHECK (organization_id = nullif(current_setting(''app.current_org_id'',true),''''))',t);
 END LOOP;
END $$;
