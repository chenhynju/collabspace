-- Private employee source drafts. Provider submission is a separate operation.
CREATE TABLE IF NOT EXISTS persona_source_draft (
 id uuid PRIMARY KEY, organization_id text NOT NULL REFERENCES org_organization(id),
 actor_id text NOT NULL REFERENCES sys_user(id), kind text NOT NULL CHECK(kind IN ('PHOTO','VIDEO')),
 mime text NOT NULL CHECK(mime IN ('image/png','image/jpeg','image/webp','video/mp4','video/webm')),
 source bytea, source_hash text NOT NULL, consent_version text NOT NULL,
 consent_at timestamptz NOT NULL DEFAULT now(), locale text NOT NULL CHECK(locale IN ('zh-CN','en-US')),
 state text NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','REVOKED')),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 CHECK(octet_length(source)<=20971520),
 CHECK((state='DRAFT' AND source IS NOT NULL) OR (state='REVOKED' AND source IS NULL))
);
CREATE INDEX IF NOT EXISTS persona_draft_scope ON persona_source_draft(organization_id,actor_id,created_at);
ALTER TABLE persona_source_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_source_draft FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_actor ON persona_source_draft;
CREATE POLICY tenant_actor ON persona_source_draft USING(
 organization_id=nullif(current_setting('app.current_org_id',true),'') AND actor_id=nullif(current_setting('app.current_user_id',true),'')
) WITH CHECK(
 organization_id=nullif(current_setting('app.current_org_id',true),'') AND actor_id=nullif(current_setting('app.current_user_id',true),'')
);
DO $$ DECLARE app_role text; BEGIN
 FOREACH app_role IN ARRAY ARRAY['teamspace_app','collabspace_app'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=app_role) THEN
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON persona_source_draft TO %I',app_role);
  END IF;
 END LOOP;
END $$;
CREATE TABLE IF NOT EXISTS persona_agent_config (
 organization_id text NOT NULL REFERENCES org_organization(id), agent_key text NOT NULL CHECK(agent_key='assistant'),
 preset_id text NOT NULL CHECK(preset_id='lan-v1'), revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 updated_by text NOT NULL REFERENCES sys_user(id), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,agent_key)
);
ALTER TABLE persona_agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_agent_config FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant ON persona_agent_config;
CREATE POLICY tenant ON persona_agent_config USING(organization_id=nullif(current_setting('app.current_org_id',true),''))
 WITH CHECK(organization_id=nullif(current_setting('app.current_org_id',true),''));
DO $$ DECLARE app_role text; BEGIN
 FOREACH app_role IN ARRAY ARRAY['teamspace_app','collabspace_app'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=app_role) THEN
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON persona_agent_config TO %I',app_role);
  END IF;
 END LOOP;
END $$;
