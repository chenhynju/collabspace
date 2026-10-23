-- Compatible addition; run as DB administrator, separately from application traffic.
ALTER TYPE "InviteStatus" ADD VALUE IF NOT EXISTS 'DECLINED';
CREATE INDEX IF NOT EXISTS invitation_pending_email ON org_invitation(lower(email),expires_at) WHERE status='PENDING';
CREATE TABLE IF NOT EXISTS personal_notification (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 organization_id text NOT NULL REFERENCES org_organization(id) ON DELETE CASCADE,
 recipient_id text NOT NULL REFERENCES sys_user(id) ON DELETE CASCADE,
 invitation_id text NOT NULL REFERENCES org_invitation(id) ON DELETE CASCADE,
 event text NOT NULL CHECK(event IN ('RECEIVED','ACCEPTED','DECLINED','REVOKED')),
 title text NOT NULL, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz,
 UNIQUE(invitation_id,event,recipient_id)
);
CREATE INDEX IF NOT EXISTS personal_notification_recipient ON personal_notification(recipient_id,created_at DESC);
ALTER TABLE personal_notification ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_notification FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_recipient ON personal_notification;
CREATE POLICY notification_recipient ON personal_notification USING(recipient_id=NULLIF(current_setting('app.current_user_id',true),'')) WITH CHECK(recipient_id=NULLIF(current_setting('app.current_user_id',true),''));
CREATE TABLE IF NOT EXISTS invitation_delivery (
 invitation_id text PRIMARY KEY REFERENCES org_invitation(id) ON DELETE CASCADE,
 organization_id text NOT NULL REFERENCES org_organization(id) ON DELETE CASCADE,
 payload text NOT NULL, status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENDING','RETRY','SENT','SIMULATED','FAILED','CANCELLED')),
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(), lease text, lease_until timestamptz,
 provider_id text, last_error text, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE invitation_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_delivery FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invitation_delivery_scope ON invitation_delivery;
CREATE POLICY invitation_delivery_scope ON invitation_delivery USING(organization_id=NULLIF(current_setting('app.current_org_id',true),'') OR current_setting('app.invite_delivery',true)='on') WITH CHECK(organization_id=NULLIF(current_setting('app.current_org_id',true),'') OR current_setting('app.invite_delivery',true)='on');
CREATE OR REPLACE FUNCTION public.invitation_notify(inv_id text, ev text) RETURNS TABLE(recipient text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE i public.org_invitation%ROWTYPE; actor text; target text; org_name text; role_name text;
BEGIN
 actor:=NULLIF(current_setting('app.current_user_id',true),'');
 SELECT * INTO i FROM public.org_invitation WHERE id=inv_id;
 IF NOT FOUND OR actor IS NULL OR i.organization_id IS DISTINCT FROM NULLIF(current_setting('app.current_org_id',true),'') THEN RAISE EXCEPTION 'notification context denied'; END IF;
 IF ev='RECEIVED' THEN
  IF actor<>i.invited_by OR i.status::text<>'PENDING' THEN RAISE EXCEPTION 'notification actor denied'; END IF;
  SELECT id INTO target FROM public.sys_user WHERE lower(email)=lower(i.email) AND status::text='NORMAL';
 ELSIF ev='REVOKED' THEN
  IF i.status::text<>'REVOKED' OR NOT EXISTS(SELECT 1 FROM public.org_membership WHERE organization_id=i.organization_id AND user_id=actor AND status::text='ACTIVE') THEN RAISE EXCEPTION 'notification actor denied'; END IF;
  SELECT id INTO target FROM public.sys_user WHERE lower(email)=lower(i.email) AND status::text='NORMAL';
 ELSIF ev IN ('ACCEPTED','DECLINED') THEN
  IF i.status::text<>ev OR NOT EXISTS(SELECT 1 FROM public.sys_user WHERE id=actor AND lower(email)=lower(i.email) AND status::text='NORMAL') THEN RAISE EXCEPTION 'notification result denied'; END IF;
  target:=i.invited_by;
 ELSE RAISE EXCEPTION 'invalid notification event'; END IF;
 IF target IS NULL THEN RETURN; END IF;
 SELECT name INTO org_name FROM public.org_organization WHERE id=i.organization_id;
 SELECT name INTO role_name FROM public.sys_role WHERE id=i.role_id;
 INSERT INTO public.personal_notification(organization_id,recipient_id,invitation_id,event,title,body)
 VALUES(i.organization_id,target,i.id,ev,CASE ev WHEN 'RECEIVED' THEN '你收到一份组织邀请' WHEN 'ACCEPTED' THEN '组织邀请已接受' WHEN 'DECLINED' THEN '组织邀请已拒绝' ELSE '组织邀请已撤销' END,
 CASE WHEN ev='RECEIVED' THEN org_name||' 邀请你加入，角色：'||role_name ELSE org_name||' · '||i.email||' · '||CASE ev WHEN 'ACCEPTED' THEN '已接受' WHEN 'DECLINED' THEN '已拒绝' ELSE '已撤销' END END)
 ON CONFLICT(invitation_id,event,recipient_id) DO NOTHING;
 RETURN QUERY SELECT target;
END $$;
CREATE OR REPLACE FUNCTION public.invitation_sync_inbox() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor text;
BEGIN
 actor:=NULLIF(current_setting('app.current_user_id',true),'');
 IF actor IS NULL THEN RAISE EXCEPTION 'identity required'; END IF;
 INSERT INTO public.personal_notification(organization_id,recipient_id,invitation_id,event,title,body)
 SELECT i.organization_id,u.id,i.id,'RECEIVED','你收到一份组织邀请',o.name||' 邀请你加入，角色：'||r.name
 FROM public.sys_user u JOIN public.org_invitation i ON lower(i.email)=lower(u.email)
 JOIN public.org_organization o ON o.id=i.organization_id JOIN public.sys_role r ON r.id=i.role_id
 WHERE u.id=actor AND u.status::text='NORMAL' AND u.email_verified_at IS NOT NULL AND i.status::text='PENDING' AND i.expires_at>timezone('UTC',now()) AND o.status::text='ACTIVE'
 ON CONFLICT(invitation_id,event,recipient_id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.invitation_notify(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invitation_sync_inbox() FROM PUBLIC;
-- Grants are applied by apply-invitations.cjs to the verified runtime role only.
