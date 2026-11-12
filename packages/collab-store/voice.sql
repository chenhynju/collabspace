-- Additive only. Apply to an isolated local database first.
CREATE TABLE IF NOT EXISTS voice_job (
 id uuid PRIMARY KEY, organization_id text NOT NULL REFERENCES org_organization(id),
 actor_id text NOT NULL REFERENCES sys_user(id), project_id text, conversation_id text,
 kind text NOT NULL CHECK(kind IN ('STT','TTS')), locale text NOT NULL CHECK(locale IN ('zh-CN','en-US')),
 input_hash text NOT NULL, input_text text, input_audio bytea, result_text text, result_audio bytea,
 status text NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','RUNNING','SUCCEEDED','UNKNOWN','CANCELLED')),
 error text, trace_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',
 CHECK((project_id IS NULL)<>(conversation_id IS NULL)),
 CHECK(octet_length(input_audio)<=10485760), CHECK(octet_length(result_audio)<=16777216),
 CHECK(length(input_text)<=4000), CHECK(length(result_text)<=4000),
 FOREIGN KEY(project_id,organization_id) REFERENCES prj_project(id,organization_id)
);
CREATE INDEX IF NOT EXISTS voice_job_budget ON voice_job(organization_id,actor_id,created_at);
ALTER TABLE voice_job ADD COLUMN IF NOT EXISTS result_visemes jsonb;
ALTER TABLE voice_job ADD COLUMN IF NOT EXISTS speech_route text;
CREATE UNIQUE INDEX IF NOT EXISTS im_conversation_id_org_voice ON im_conversation(id,organization_id);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='voice_conversation_scope' AND conrelid='voice_job'::regclass) THEN
  ALTER TABLE voice_job ADD CONSTRAINT voice_conversation_scope FOREIGN KEY(conversation_id,organization_id) REFERENCES im_conversation(id,organization_id);
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS persona_profile (
 organization_id text NOT NULL REFERENCES org_organization(id), actor_id text NOT NULL REFERENCES sys_user(id),
 style text NOT NULL CHECK(style IN ('cartoon','realistic')), locale text NOT NULL CHECK(locale IN ('zh-CN','en-US')),
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,actor_id)
);
DO $$ DECLARE tab text; app_role text; BEGIN
 FOREACH tab IN ARRAY ARRAY['voice_job','persona_profile'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('DROP POLICY IF EXISTS tenant_actor ON %I',tab);
  EXECUTE format('CREATE POLICY tenant_actor ON %I USING(organization_id=nullif(current_setting(''app.current_org_id'',true),'''') AND actor_id=nullif(current_setting(''app.current_user_id'',true),'''')) WITH CHECK(organization_id=nullif(current_setting(''app.current_org_id'',true),'''') AND actor_id=nullif(current_setting(''app.current_user_id'',true),''''))',tab);
  FOREACH app_role IN ARRAY ARRAY['teamspace_app','collabspace_app'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=app_role) THEN
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I TO %I',tab,app_role);
   END IF;
  END LOOP;
 END LOOP;
END $$;
