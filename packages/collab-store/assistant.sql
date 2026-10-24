-- Additive assistant mail intent ledger. No plaintext recipient/subject/body retained.
CREATE TABLE IF NOT EXISTS assistant_mail_attempt (
 id uuid PRIMARY KEY, organization_id text NOT NULL REFERENCES org_organization(id),
 actor_id text NOT NULL REFERENCES sys_user(id), project_id text NOT NULL,
 payload_hash text NOT NULL, status text NOT NULL DEFAULT 'SENDING' CHECK(status IN ('SENDING','ACCEPTED','UNKNOWN')),
 provider_id text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(project_id,organization_id) REFERENCES prj_project(id,organization_id)
);
CREATE INDEX IF NOT EXISTS assistant_mail_actor ON assistant_mail_attempt(organization_id,actor_id,created_at DESC);
ALTER TABLE assistant_mail_attempt ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_mail_attempt FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant ON assistant_mail_attempt;
CREATE POLICY tenant ON assistant_mail_attempt USING(organization_id=nullif(current_setting('app.current_org_id',true),'')) WITH CHECK(organization_id=nullif(current_setting('app.current_org_id',true),''));
DO $$ DECLARE app_role text; BEGIN
 FOREACH app_role IN ARRAY ARRAY['teamspace_app','collabspace_app'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=app_role) THEN
   EXECUTE format('GRANT SELECT,INSERT,UPDATE ON assistant_mail_attempt TO %I',app_role);
  END IF;
 END LOOP;
END $$;
