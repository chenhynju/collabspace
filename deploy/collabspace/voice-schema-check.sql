\set ON_ERROR_STOP on
CREATE ROLE collabspace_app;
CREATE TABLE org_organization(id text PRIMARY KEY);
CREATE TABLE sys_user(id text PRIMARY KEY);
CREATE TABLE prj_project(id text, organization_id text REFERENCES org_organization(id),PRIMARY KEY(id,organization_id));
CREATE TABLE im_conversation(id text PRIMARY KEY,organization_id text REFERENCES org_organization(id));
\i /tmp/voice.sql
INSERT INTO org_organization VALUES('a'),('b');
INSERT INTO sys_user VALUES('alice'),('bob');
INSERT INTO prj_project VALUES('pa','a'),('pb','b');
INSERT INTO im_conversation VALUES('ca','a'),('cb','b');
SET ROLE collabspace_app;
SELECT set_config('app.current_org_id','a',false),set_config('app.current_user_id','alice',false);
INSERT INTO persona_profile VALUES('a','alice','cartoon','zh-CN',now());
INSERT INTO voice_job(id,organization_id,actor_id,project_id,kind,locale,input_hash,trace_id) VALUES('11111111-1111-4111-8111-111111111111','a','alice','pa','STT','zh-CN','synthetic','schema-check');
DO $$ BEGIN
 BEGIN
  INSERT INTO voice_job(id,organization_id,actor_id,conversation_id,kind,locale,input_hash,trace_id) VALUES('22222222-2222-4222-8222-222222222222','a','alice','cb','STT','zh-CN','synthetic','cross-org');
  RAISE EXCEPTION 'Cross-organization conversation accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;
SELECT set_config('app.current_org_id','b',false);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM voice_job) OR EXISTS(SELECT 1 FROM persona_profile) THEN RAISE EXCEPTION 'Tenant RLS leaked';END IF;END $$;
SELECT set_config('app.current_org_id','a',false),set_config('app.current_user_id','bob',false);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM voice_job) OR EXISTS(SELECT 1 FROM persona_profile) THEN RAISE EXCEPTION 'Actor RLS leaked';END IF;END $$;
RESET ROLE;
SELECT 'PASSED schema composite FK and non-owner organization/actor RLS' AS result;
