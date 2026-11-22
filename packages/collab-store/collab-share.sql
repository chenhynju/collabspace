-- Board mentions and public read-only document shares.
CREATE TABLE IF NOT EXISTS collab_board_notification (
 id uuid PRIMARY KEY,
 organization_id text NOT NULL,
 recipient_id text NOT NULL REFERENCES sys_user(id) ON DELETE CASCADE,
 actor_id text NOT NULL,
 document_id text NOT NULL,
 thread_id uuid,
 shape_id text,
 kind text NOT NULL CHECK(kind IN ('MENTION')),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 500),
 link text NOT NULL CHECK(length(link) <= 500),
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz,
 FOREIGN KEY(organization_id,document_id) REFERENCES collab_document(organization_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS collab_board_notification_recipient
 ON collab_board_notification(recipient_id,created_at DESC);
ALTER TABLE collab_board_notification ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_board_notification FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS board_notification_select ON collab_board_notification;
-- Personal inbox: the recipient can read their own rows across organizations.
CREATE POLICY board_notification_select ON collab_board_notification FOR SELECT
 USING (recipient_id=NULLIF(current_setting('app.current_user_id',true),''));
DROP POLICY IF EXISTS board_notification_insert ON collab_board_notification;
CREATE POLICY board_notification_insert ON collab_board_notification FOR INSERT
 WITH CHECK (organization_id=NULLIF(current_setting('app.current_org_id',true),''));
DROP POLICY IF EXISTS board_notification_update ON collab_board_notification;
CREATE POLICY board_notification_update ON collab_board_notification FOR UPDATE
 USING (recipient_id=NULLIF(current_setting('app.current_user_id',true),''))
 WITH CHECK (recipient_id=NULLIF(current_setting('app.current_user_id',true),''));

CREATE TABLE IF NOT EXISTS collab_share (
 token text PRIMARY KEY,
 organization_id text NOT NULL,
 document_id text NOT NULL,
 created_by text NOT NULL,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 kind text NOT NULL CHECK(kind IN ('BOARD','MARKDOWN','DOCUMENT')),
 snapshot jsonb NOT NULL,
 expires_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,document_id,token),
 FOREIGN KEY(organization_id,document_id) REFERENCES collab_document(organization_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS collab_share_document
 ON collab_share(organization_id,document_id,created_at DESC);
ALTER TABLE collab_share ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_share FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS collab_share_select ON collab_share;
CREATE POLICY collab_share_select ON collab_share FOR SELECT
 USING (organization_id=NULLIF(current_setting('app.current_org_id',true),'')
   OR current_setting('app.share_public',true)='on');
DROP POLICY IF EXISTS collab_share_insert ON collab_share;
CREATE POLICY collab_share_insert ON collab_share FOR INSERT
 WITH CHECK (organization_id=NULLIF(current_setting('app.current_org_id',true),''));
DROP POLICY IF EXISTS collab_share_update ON collab_share;
CREATE POLICY collab_share_update ON collab_share FOR UPDATE
 USING (organization_id=NULLIF(current_setting('app.current_org_id',true),''))
 WITH CHECK (organization_id=NULLIF(current_setting('app.current_org_id',true),''));

-- Runtime grants for the collaboration application role (owner keeps migration rights).
DO $$ DECLARE app_role text; BEGIN
 FOREACH app_role IN ARRAY ARRAY['teamspace_app','collabspace_app'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=app_role) THEN
   EXECUTE format('GRANT SELECT,INSERT,UPDATE ON collab_board_notification TO %I',app_role);
   EXECUTE format('GRANT SELECT,INSERT,UPDATE ON collab_share TO %I',app_role);
  END IF;
 END LOOP;
END $$;
