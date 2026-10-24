import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { createHash, createHmac } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

const types = new Set(['email.sent','email.delivered','email.delivery_delayed','email.failed','email.bounced','email.complained']);
const localModules = new Set(['verification','password_reset','invitation','notification']);
type Envelope = { eventId: string; app: string; module: string; type: string; emailId: string; occurredAt: string };
type Route = { url: string; secretEnv: string };

// Only metadata is retained. No recipient, message body, verification URL or tenant ID from callbacks.
export function mailEnvelope(eventId: string, event: any): Envelope | null {
  if (!types.has(event?.type)) return null;
  const tags = Array.isArray(event?.data?.tags)
    ? Object.fromEntries(event.data.tags.map((t: any) => [t.name, t.value])) : event?.data?.tags ?? {};
  const valid = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9_-]{1,64}$/.test(v);
  const time = new Date(event?.created_at);
  if (!eventId || eventId.length > 256 || typeof event?.data?.email_id !== 'string' || event.data.email_id.length > 256 || !event.data.email_id || !Number.isFinite(time.getTime()))
    throw new BadRequestException('INVALID_MAIL_EVENT');
  return { eventId, app: valid(tags.app) ? tags.app : 'unclassified', module: valid(tags.module) ? tags.module : 'unclassified', type: event.type, emailId: event.data.email_id, occurredAt: time.toISOString() };
}

@Injectable()
export class MailWebhookService {
  private busy = false;
  private readonly logger = new Logger(MailWebhookService.name);
  private routes(): Record<string, Route> {
    const routes = JSON.parse(this.config.get<string>('MAIL_WEBHOOK_ROUTES') || '{}');
    if (!routes || Array.isArray(routes) || typeof routes !== 'object') throw new Error('INVALID_MAIL_ROUTES');
    for (const [key, r] of Object.entries(routes) as [string, Route][]) {
      const u = new URL(r.url);
      if (!/^[a-z0-9_-]+\.[a-z0-9_*-]+$/.test(key) || u.protocol !== 'https:' || u.username || u.password || u.hash || u.search || !/^[A-Z][A-Z0-9_]+$/.test(r.secretEnv) || (this.config.get<string>(r.secretEnv)?.length ?? 0) < 32)
        throw new Error('INVALID_MAIL_ROUTE');
    }
    return routes;
  }
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}
  async receive(id: string, event: unknown) {
    const e = mailEnvelope(id, event);
    if (!e) return { received: true, ignored: true };
    const route = `${e.app}.${e.module}`, routes = this.routes();
    const target = routes[route] ? route : routes[`${e.app}.*`] ? `${e.app}.*` : null;
    const local = !target && e.app === 'collabspace' && localModules.has(e.module);
    const body = JSON.stringify(e), hash = createHash('sha256').update(body).digest('hex');
    // Duplicate comparison and insertion are serialized by the unique event ID.
    const rows = await this.prisma.$queryRaw<Array<{ payload_hash: string }>>`
      INSERT INTO public.mail_webhook_event(event_id,payload_hash,envelope,route,status)
      VALUES (${id},${hash},${body}::jsonb,${local ? null : target},${local ? 'RECORDED' : target ? 'PENDING' : 'UNROUTED'})
      ON CONFLICT(event_id) DO UPDATE SET event_id=EXCLUDED.event_id RETURNING payload_hash`;
    if (rows[0]?.payload_hash !== hash) throw new ConflictException('MAIL_EVENT_ID_CONFLICT');
    return { received: true };
  }
  // Resend is acknowledged only after PostgreSQL commits. Destinations retry independently.
  @Interval(5000)
  async dispatch() {
    if (this.busy || !this.config.get<string>('RESEND_WEBHOOK_SECRET')) return;
    this.busy = true;
    try {
      const routes = this.routes();
      const rows = await this.prisma.$queryRaw<Array<{event_id:string;envelope:Envelope;route:string;attempts:number}>>`
        WITH claimed AS (SELECT event_id FROM public.mail_webhook_event
          WHERE status='PENDING' AND next_attempt_at<=now() ORDER BY next_attempt_at LIMIT 10 FOR UPDATE SKIP LOCKED)
        UPDATE public.mail_webhook_event e SET next_attempt_at=now()+interval '120 seconds',attempts=attempts+1
        FROM claimed c WHERE e.event_id=c.event_id RETURNING e.event_id,e.envelope,e.route,e.attempts`;
      for (const row of rows) {
        try {
          const route = routes[row.route];
          if (!route) throw new Error('ROUTE_REMOVED');
          const body = JSON.stringify(row.envelope), time = String(Math.floor(Date.now()/1000));
          const signature = createHmac('sha256', this.config.getOrThrow<string>(route.secretEnv)).update(`${time}.${row.event_id}.${body}`).digest('hex');
          const r = await fetch(route.url, { method:'POST', body, redirect:'error', signal:AbortSignal.timeout(10000), headers:{'content-type':'application/json','x-mail-event-id':row.event_id,'x-mail-timestamp':time,'x-mail-signature':signature} });
          await r.body?.cancel();
          if (!r.ok) throw new Error('DESTINATION_REJECTED');
          await this.prisma.$executeRaw`UPDATE public.mail_webhook_event SET status='FORWARDED' WHERE event_id=${row.event_id} AND status='PENDING' AND attempts=${row.attempts}`;
        } catch {
          await this.prisma.$executeRaw`UPDATE public.mail_webhook_event SET status=${row.attempts>=12?'FAILED':'PENDING'},next_attempt_at=now()+interval '5 minutes' WHERE event_id=${row.event_id} AND status='PENDING' AND attempts=${row.attempts}`;
        }
      }
    } catch { this.logger.error('Mail webhook dispatch unavailable; queued events retained'); }
    finally { this.busy = false; }
  }
}
