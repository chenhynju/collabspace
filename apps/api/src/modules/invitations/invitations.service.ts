import { Injectable, BadRequestException, ConflictException, GoneException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { hasPermission } from '../../common/util/perms';
import { nanoid } from 'nanoid';
import { PrismaService, TxClient } from '../../prisma/prisma.service';
import { AuditService, BusinessType } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
type User = {
    id: string;
    email: string;
};
type Meta = {
    traceId: string;
    ip?: string;
};
@Injectable()
export class InvitationsService {
    constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly audit: AuditService, private readonly notifications: NotificationsService, private readonly mail: MailService) { }
    private hash(token: string) { if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{20,128}$/.test(token))
        throw new BadRequestException({ code: 'TOKEN_INVALID', message: '邀请凭证无效' }); return createHash('sha256').update(token).digest('hex'); }
    async locate(token: string) { const tokenHash = this.hash(token), i = await this.prisma.withInviteLookup(tx => tx.invitation.findUnique({ where: { tokenHash } })); if (!i)
        throw new NotFoundException({ code: 'INVITE_NOT_FOUND', message: '邀请不存在或链接无效' }); return i; }
    private pending(i: any) { if (i.status !== 'PENDING')
        throw new GoneException({ code: 'INVITE_' + i.status, message: '邀请已处理或撤销' }); if (i.expiresAt <= new Date())
        throw new GoneException({ code: 'INVITE_EXPIRED', message: '邀请已过期' }); }
    async validateRegistration(token: string, email: string) { const i = await this.locate(token); this.pending(i); if (i.email.toLowerCase() !== email.trim().toLowerCase())
        throw new BadRequestException({ code: 'EMAIL_MISMATCH', message: '注册邮箱与受邀邮箱不一致' }); return i; }
    async preview(token: string) { const i = await this.locate(token); return this.details(i); }
    async detailForUser(id: string, user: User) { const i = await this.prisma.withInviteLookup(tx => tx.invitation.findUnique({ where: { id } })); if (!i || i.email.toLowerCase() !== user.email.toLowerCase())
        throw new NotFoundException('邀请不存在'); return this.details(i); }
    private details(i: any) { return this.prisma.withOrg(i.organizationId, async (tx) => { const [organization, role] = await Promise.all([tx.organization.findUnique({ where: { id: i.organizationId }, select: { id: true, name: true, status: true } }), tx.role.findFirst({ where: { id: i.roleId, organizationId: i.organizationId }, select: { id: true, name: true, key: true } })]); const inviter = await tx.user.findUnique({ where: { id: i.invitedById }, select: { name: true } }); return { id: i.id, inviter, email: i.email, status: i.status === 'PENDING' && i.expiresAt <= new Date() ? 'EXPIRED' : i.status, expiresAt: i.expiresAt, organization, role }; }); }
    async list(org: string) { return this.prisma.withOrg(org, async (tx) => { await tx.invitation.updateMany({ where: { organizationId: org, status: 'PENDING', expiresAt: { lt: new Date() } }, data: { status: 'EXPIRED' } }); const list = await tx.invitation.findMany({ where: { organizationId: org }, include: { role: { select: { id: true, name: true, key: true } } }, orderBy: { createdAt: 'desc' } }); const d = await tx.$queryRaw<any[]> `SELECT invitation_id,status,attempts FROM invitation_delivery WHERE organization_id=${org}`; return list.map(i => ({ ...i, delivery: d.find(r => r.invitation_id === i.id) || { status: 'IN_APP' } })); }); }
    private async lockOrg(tx: TxClient, org: string) { const r = await tx.$queryRaw<any[]> `SELECT id,status::text FROM org_organization WHERE id=${org} FOR UPDATE`; if (!r.length || r[0].status !== 'ACTIVE')
        throw new ForbiddenException('组织不可用'); }
    async create(org: string, user: User, dto: {
        email: string;
        roleId: string;
    }, meta: Meta) {
        const email = dto.email.trim().toLowerCase(), raw = nanoid(32), url = this.config.get<string>('WEB_URL', 'http://localhost:3000') + '/invite/accept?token=' + raw;
        const result = await this.prisma.withOrgUser(org, user.id, async (tx) => {
            await this.lockOrg(tx, org);
            const role = await tx.role.findFirst({ where: { id: dto.roleId, organizationId: org } });
            if (!role || role.status !== 'NORMAL' || role.key === 'OWNER')
                throw new BadRequestException('邀请角色无效；所有者转让请使用成员管理');
            const targets = await tx.user.findMany({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true, status: true }, take: 2 });
            if (targets.length > 1)
                throw new ConflictException('受邀邮箱匹配多个旧账号，请先联系管理员处理');
            const target = targets[0];
            if (target?.status === 'DISABLED')
                throw new BadRequestException('受邀账号不可用');
            if (target && await tx.membership.findFirst({ where: { organizationId: org, userId: target.id, status: 'ACTIVE' } }))
                throw new ConflictException({ code: 'ALREADY_MEMBER', message: '该邮箱已是组织成员' });
            if (await tx.invitation.findFirst({ where: { organizationId: org, email: { equals: email, mode: 'insensitive' }, status: 'PENDING', expiresAt: { gt: new Date() } } }))
                throw new ConflictException({ code: 'INVITE_EXISTS', message: '已有有效邀请，请撤销后再发送' });
            const i = await tx.invitation.create({ data: { organizationId: org, email, roleId: role.id, tokenHash: this.hash(raw), expiresAt: new Date(Date.now() + 7 * 86400000), invitedById: user.id, status: 'PENDING' } });
            let recipients: Array<{
                recipient: string;
            }> = [];
            if (target)
                recipients = await this.notifications.notify(tx, i.id, 'RECEIVED');
            else {
                const organization = await tx.organization.findUnique({ where: { id: org }, select: { name: true } });
                const payload = this.notifications.encrypt({ email, url, organization: organization!.name });
                await tx.$executeRaw `INSERT INTO invitation_delivery(invitation_id,organization_id,payload) VALUES(${i.id},${org},${payload})`;
            }
            await this.audit.record(tx, { organizationId: org, actorId: user.id, title: '发送组织邀请', businessType: BusinessType.INSERT, action: 'invite:send', resourceType: 'Invitation', resourceId: i.id, after: { email, role: role.key, channel: target ? 'IN_APP' : 'EMAIL' }, traceId: meta.traceId, ip: meta.ip, requestMethod: 'POST' });
            return { id: i.id, email, status: i.status, expiresAt: i.expiresAt, delivery: target ? 'IN_APP' : 'QUEUED', ...(!target && (!this.mail.isLive || email.endsWith('@example.invalid')) ? { inviteUrl: url, simulation: true } : {}), recipients };
        });
        this.notifications.publish(result.recipients);
        const { recipients, ...visible } = result;
        return visible;
    }
    async respondByToken(token: string, user: User, accept: boolean, meta: Meta) { const i = await this.locate(token); return this.respond(i.id, user, accept, meta); }
    async respond(id: string, user: User, accept: boolean, meta: Meta) {
        const found = await this.prisma.withInviteLookup(tx => tx.invitation.findUnique({ where: { id } }));
        if (!found || found.email.toLowerCase() !== user.email.toLowerCase())
            throw new NotFoundException('邀请不存在或邮箱不匹配');
        const status = accept ? 'ACCEPTED' : 'DECLINED';
        const result = await this.prisma.withOrgUser(found.organizationId, user.id, async (tx) => {
            await this.lockOrg(tx, found.organizationId);
            await tx.$queryRaw `SELECT id FROM org_invitation WHERE id=${id} AND organization_id=${found.organizationId} FOR UPDATE`;
            const i = await tx.invitation.findFirst({ where: { id, organizationId: found.organizationId } });
            if (!i)
                throw new NotFoundException();
            if (i.email.toLowerCase() !== user.email.toLowerCase())
                throw new ForbiddenException();
            const actor = await tx.user.findUnique({ where: { id: user.id }, select: { email: true, emailVerifiedAt: true, status: true } });
            if (!actor || actor.status !== 'NORMAL' || !actor.emailVerifiedAt || actor.email.toLowerCase() !== i.email.toLowerCase())
                throw new ForbiddenException({ code: 'EMAIL_NOT_VERIFIED', message: '请验证受邀邮箱后再处理邀请' });
            if (i.status === status)
                return { accepted: accept, declined: !accept, organizationId: i.organizationId, recipients: [] };
            this.pending(i);
            const role = await tx.role.findFirst({ where: { id: i.roleId, organizationId: i.organizationId } });
            if (accept && (!role || role.status !== 'NORMAL' || role.key === 'OWNER'))
                throw new BadRequestException('受邀角色已不可用');
            if (accept) {
                const inviter = await tx.membership.findUnique({ where: { organizationId_userId: { organizationId: i.organizationId, userId: i.invitedById } }, include: { user: { select: { status: true } }, roles: { include: { role: { include: { menus: { include: { menu: true } } } } } } } });
                const roles = inviter?.roles.map(r => r.role).filter(r => r.status === 'NORMAL' && r.organizationId === i.organizationId) || [];
                const perms = roles.flatMap(r => r.menus.filter(m => m.menu.status === 'NORMAL').map(m => m.menu.perms || ''));
                if (inviter?.user.status !== 'NORMAL' || inviter?.status !== 'ACTIVE' || (!roles.some(r => r.key === 'OWNER') && !hasPermission(perms, 'invite:send')))
                    throw new ForbiddenException({ code: 'INVITER_UNAVAILABLE', message: '邀请者权限已失效，请联系组织管理员重新邀请' });
                const existing = await tx.membership.findUnique({ where: { organizationId_userId: { organizationId: i.organizationId, userId: user.id } } });
                if (existing?.status === 'ACTIVE')
                    throw new ConflictException({ code: 'ALREADY_MEMBER', message: '已是组织成员，请管理员撤销多余邀请' });
                const entitlement = await tx.entitlement.findUnique({ where: { organizationId: i.organizationId } }), active = await tx.membership.count({ where: { organizationId: i.organizationId, status: 'ACTIVE' } });
                if(!entitlement)throw new ForbiddenException('组织权益未就绪，请联系管理员');
                if (entitlement.seatsIncluded >= 0 && active >= entitlement.seatsIncluded)
                    throw new ConflictException({ code: 'SEAT_LIMIT', message: '组织席位已满，请邀请者处理后重试' });
                const dept = await tx.dept.findFirst({ where: { organizationId: i.organizationId, parentId: null } });
                const m = existing ? await tx.membership.update({ where: { id: existing.id }, data: { status: 'ACTIVE', deptId: dept?.id } }) : await tx.membership.create({ data: { organizationId: i.organizationId, userId: user.id, status: 'ACTIVE', deptId: dept?.id } });
                await tx.membershipRole.deleteMany({ where: { membershipId: m.id } });
                await tx.membershipRole.create({ data: { membershipId: m.id, roleId: i.roleId } });
            }
            await tx.invitation.update({ where: { id: i.id }, data: { status, ...(accept ? { acceptedById: user.id, acceptedAt: new Date() } : {}) } });
            const recipients = await this.notifications.notify(tx, i.id, status);
            await this.audit.record(tx, { organizationId: i.organizationId, actorId: user.id, title: accept ? '接受组织邀请' : '拒绝组织邀请', businessType: BusinessType.STATUS, action: accept ? 'invite:accept' : 'invite:decline', resourceType: 'Invitation', resourceId: i.id, before: { status: 'PENDING' }, after: { status }, traceId: meta.traceId, ip: meta.ip, requestMethod: 'POST' });
            return { accepted: accept, declined: !accept, organizationId: i.organizationId, recipients };
        });
        this.notifications.publish(result.recipients);
        const { recipients, ...visible } = result;
        return visible;
    }
    async revoke(org: string, user: User, id: string, meta: Meta) { const result = await this.prisma.withOrgUser(org, user.id, async (tx) => { await this.lockOrg(tx, org); const i = await tx.invitation.findFirst({ where: { id, organizationId: org } }); if (!i)
        throw new NotFoundException(); if (i.status === 'REVOKED')
        return { ok: true, recipients: [] }; this.pending(i); await tx.invitation.update({ where: { id }, data: { status: 'REVOKED' } }); await tx.$executeRaw `UPDATE invitation_delivery SET status='CANCELLED',updated_at=now() WHERE invitation_id=${id} AND organization_id=${org} AND status IN ('PENDING','RETRY')`; const recipients = await this.notifications.notify(tx, id, 'REVOKED'); await this.audit.record(tx, { organizationId: org, actorId: user.id, title: '撤销组织邀请', businessType: BusinessType.STATUS, action: 'invite:revoke', resourceType: 'Invitation', resourceId: id, before: { status: i.status }, after: { status: 'REVOKED' }, traceId: meta.traceId, ip: meta.ip, requestMethod: 'POST' }); return { ok: true, recipients }; }); this.notifications.publish(result.recipients); return { ok: true }; }
}
