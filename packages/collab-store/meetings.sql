-- Additive. First apply to an isolated database, never implicitly to production.
CREATE TABLE IF NOT EXISTS rtc_meeting (
 id uuid PRIMARY KEY,
 organization_id text NOT NULL REFERENCES org_organization(id),
 project_id text NOT NULL,
 host_id text NOT NULL REFERENCES sys_user(id),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
 status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','ENDING','ENDED')),
 media_issued boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 ended_at timestamptz,
 UNIQUE(id,organization_id),
 FOREIGN KEY(project_id,organization_id) REFERENCES prj_project(id,organization_id),
 CHECK((status='ENDED')=(ended_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS rtc_meeting_project ON rtc_meeting(organization_id,project_id,created_at DESC);
ALTER TABLE rtc_meeting ENABLE ROW LEVEL SECURITY;
ALTER TABLE rtc_meeting FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant ON rtc_meeting;
CREATE POLICY tenant ON rtc_meeting USING(organization_id=nullif(current_setting('app.current_org_id',true),'')) WITH CHECK(organization_id=nullif(current_setting('app.current_org_id',true),''));
DO $$ DECLARE app_role text; BEGIN
 FOREACH app_role IN ARRAY ARRAY['teamspace_app','collabspace_app'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=app_role) THEN
   EXECUTE format('GRANT SELECT,INSERT,UPDATE ON rtc_meeting TO %I',app_role);
  END IF;
 END LOOP;
END $$;


-- Messages are authoritative PostgreSQL records, never LiveKit data packets.
CREATE TABLE IF NOT EXISTS rtc_message (
 id uuid PRIMARY KEY,
 organization_id text NOT NULL REFERENCES org_organization(id),
 meeting_id uuid NOT NULL,
 sender_id text NOT NULL REFERENCES sys_user(id),
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(meeting_id,organization_id) REFERENCES rtc_meeting(id,organization_id)
);
CREATE INDEX IF NOT EXISTS rtc_message_history ON rtc_message(organization_id,meeting_id,created_at DESC,id DESC);
ALTER TABLE rtc_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE rtc_message FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant ON rtc_message;
CREATE POLICY tenant ON rtc_message USING(organization_id=nullif(current_setting('app.current_org_id',true),'')) WITH CHECK(organization_id=nullif(current_setting('app.current_org_id',true),''));
DO $$ DECLARE app_role text; BEGIN
 FOREACH app_role IN ARRAY ARRAY['teamspace_app','collabspace_app'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=app_role) THEN
   EXECUTE format('GRANT SELECT,INSERT ON rtc_message TO %I',app_role);
  END IF;
 END LOOP;
END $$;

ALTER TABLE rtc_meeting ADD COLUMN IF NOT EXISTS issued_user_ids text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE rtc_meeting ADD COLUMN IF NOT EXISTS revoked_user_ids text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE rtc_meeting ADD COLUMN IF NOT EXISTS access_checked_at timestamptz;
-- Narrow maintenance enumeration, never exposed by an HTTP endpoint. Ordinary
-- meeting/message queries continue using tenant RLS and server authorization.
CREATE OR REPLACE FUNCTION public.rtc_access_candidates()
RETURNS TABLE(id uuid,organization_id text,project_id text,issued_user_ids text[],revoked_user_ids text[],status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 RETURN QUERY WITH picked AS (
  SELECT m.id FROM public.rtc_meeting m WHERE m.media_issued AND m.status<>'ENDED'
  ORDER BY m.access_checked_at NULLS FIRST,m.id LIMIT 10 FOR UPDATE SKIP LOCKED
 ), touched AS (
  UPDATE public.rtc_meeting m SET access_checked_at=clock_timestamp() FROM picked p WHERE m.id=p.id
  RETURNING m.id,m.organization_id,m.project_id,m.issued_user_ids,m.revoked_user_ids,m.status
 ) SELECT t.id,t.organization_id,t.project_id,t.issued_user_ids,t.revoked_user_ids,t.status::text FROM touched t;
END $$;
REVOKE ALL ON FUNCTION public.rtc_access_candidates() FROM PUBLIC;
DO $$ DECLARE app_role text; BEGIN
 FOREACH app_role IN ARRAY ARRAY['teamspace_app','collabspace_app'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=app_role) THEN
   EXECUTE format('GRANT EXECUTE ON FUNCTION public.rtc_access_candidates() TO %I',app_role);
  END IF;
 END LOOP;
END $$;
