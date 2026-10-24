-- System delivery metadata, deliberately contains no tenant business data or email body.
CREATE TABLE IF NOT EXISTS public.mail_webhook_event (
 event_id text PRIMARY KEY,
 payload_hash text NOT NULL,
 envelope jsonb NOT NULL,
 route text,
 status text NOT NULL CHECK(status IN ('RECORDED','UNROUTED','PENDING','FORWARDED','FAILED')),
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mail_webhook_pending ON public.mail_webhook_event(next_attempt_at) WHERE status='PENDING';
REVOKE ALL ON public.mail_webhook_event FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON public.mail_webhook_event TO collabspace_app;
