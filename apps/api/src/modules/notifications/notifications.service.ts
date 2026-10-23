import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService, TxClient } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
@Injectable()
export class NotificationsService {
    private running = false;
    constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly mail: MailService, private readonly events: RealtimeEventsService) { }
    private key() { return createHash('sha256').update('collabspace:invitation-delivery:v1:' + this.config.getOrThrow<string>('JWT_SECRET')).digest(); }
    encrypt(value: unknown) { const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', this.key(), iv), data = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()]); return Buffer.concat([iv, c.getAuthTag(), data]).toString('base64'); }
    private decrypt(value: string) { const b = Buffer.from(value, 'base64'), d = createDecipheriv('aes-256-gcm', this.key(), b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8')); }
    notify(tx: TxClient, id: string, event: string) { return tx.$queryRaw<Array<{
        recipient: string;
    }>> `SELECT recipient FROM public.invitation_notify(${id},${event})`; }
    publish(rows: Array<{
        recipient: string;
    }>) { for (const r of rows)
        this.events.emitToUser(r.recipient, 'notifications:changed', { refresh: true }); }
    async list(user: string) { return this.prisma.withUser(user, async (tx) => { await tx.$executeRaw `SELECT public.invitation_sync_inbox()`; await tx.$executeRaw `SELECT set_config('app.invite_lookup','on',true)`; return tx.$queryRaw `SELECT n.id,n.invitation_id,n.event,n.title,n.body,n.created_at,n.read_at,i.status::text AS invitation_status,i.expires_at FROM personal_notification n JOIN org_invitation i ON i.id=n.invitation_id WHERE n.recipient_id=${user} ORDER BY n.created_at DESC LIMIT 100`; }); }
    async unread(user: string) { return this.prisma.withUser(user, async (tx) => { await tx.$executeRaw `SELECT public.invitation_sync_inbox()`; const rows = await tx.$queryRaw<Array<{
        count: number;
    }>> `SELECT count(*)::int AS count FROM personal_notification WHERE recipient_id=${user} AND read_at IS NULL`; return rows[0]; }); }
    async read(user: string, id: string) { return this.prisma.withUser(user, async (tx) => { const rows = await tx.$queryRaw<Array<{
        id: string;
    }>> `UPDATE personal_notification SET read_at=COALESCE(read_at,now()) WHERE id=${id} AND recipient_id=${user} RETURNING id`; if (!rows.length)
        throw new NotFoundException('通知不存在'); return { ok: true }; }); }
    async workerTx<T>(fn: (tx: TxClient) => Promise<T>) { return this.prisma.$transaction(async (tx) => { await tx.$executeRaw `SELECT set_config('app.invite_delivery','on',true)`; return fn(tx); }); }
    @Interval(15000)
    async dispatch() { if (this.running)
        return; this.running = true; try {
        await this.workerTx(tx => tx.$executeRaw `UPDATE invitation_delivery SET status='FAILED',last_error='LEASE_EXHAUSTED',updated_at=now() WHERE status='SENDING' AND attempts>=5 AND lease_until<now()`);
        for (let n = 0; n < 10; n++) {
            const lease = randomUUID();
            const rows = await this.workerTx(tx => tx.$queryRaw<any[]> `UPDATE invitation_delivery SET status='SENDING',lease=${lease},lease_until=now()+interval '90 seconds',attempts=attempts+1,updated_at=now() WHERE invitation_id=(SELECT invitation_id FROM invitation_delivery WHERE ((status IN ('PENDING','RETRY') AND next_attempt_at<=now()) OR (status='SENDING' AND lease_until<now())) AND attempts<5 ORDER BY next_attempt_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`);
            if (!rows.length)
                break;
            const r = rows[0];
            try {
                const i = await this.prisma.withInviteLookup(tx => tx.invitation.findUnique({ where: { id: r.invitation_id } }));
                if (!i || i.status !== 'PENDING' || i.expiresAt < new Date()) {
                    await this.finish(r.invitation_id, lease, 'CANCELLED');
                    continue;
                }
                const p = this.decrypt(r.payload);
                const sent = await this.mail.sendInvitationEmail(p.email, p.url, p.organization, r.invitation_id);
                await this.finish(r.invitation_id, lease, sent.provider === 'console' ? 'SIMULATED' : 'SENT', sent.id);
            }
            catch {
                await this.workerTx(tx => tx.$executeRaw `UPDATE invitation_delivery SET status=CASE WHEN attempts>=5 THEN 'FAILED' ELSE 'RETRY' END,next_attempt_at=now()+interval '1 minute',last_error='DELIVERY_FAILED',lease=NULL,lease_until=NULL,updated_at=now() WHERE invitation_id=${r.invitation_id} AND lease=${lease}`);
            }
        }
    }
    finally {
        this.running = false;
    } }
    private finish(id: string, lease: string, status: string, providerId?: string) { return this.workerTx(tx => tx.$executeRaw `UPDATE invitation_delivery SET status=${status},payload='',provider_id=${providerId || null},last_error=NULL,lease=NULL,lease_until=NULL,updated_at=now() WHERE invitation_id=${id} AND lease=${lease}`); }
}
