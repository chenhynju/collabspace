import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { IsString, Length } from 'class-validator';
import { OrgContextGuard } from '../../common/guards/org-context.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentOrg, OrgContext } from '../../common/decorators/current-org.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CreateInvitationDto } from './dto/invitation.dto';
import { InvitationsService } from './invitations.service';
class TokenDto {
    @IsString()
    @Length(20, 128)
    token: string;
}
type User = {
    id: string;
    email: string;
};
@Controller('invitations')
export class InvitationsController {
    constructor(private readonly service: InvitationsService) { }
    @Public()
    @Get('preview')
    preview(
    @Query('token')
    token: string) { return this.service.preview(token); }
    @Get(':id/details')
    details(
    @Param('id')
    id: string,
    @CurrentUser()
    u: User) { return this.service.detailForUser(id, u); }
    @Get()
    @UseGuards(OrgContextGuard, PermissionsGuard)
    @RequirePermissions('invite:list')
    list(
    @CurrentOrg()
    o: OrgContext) { return this.service.list(o.organizationId); }
    @Post()
    @UseGuards(OrgContextGuard, PermissionsGuard)
    @RequirePermissions('invite:send')
    create(
    @Body()
    dto: CreateInvitationDto,
    @CurrentOrg()
    o: OrgContext,
    @CurrentUser()
    u: User,
    @Req()
    r: Request) { return this.service.create(o.organizationId, u, dto, { traceId: r.traceId, ip: r.ip }); }
    @Post('accept')
    accept(
    @Body()
    dto: TokenDto,
    @CurrentUser()
    u: User,
    @Req()
    r: Request) { return this.service.respondByToken(dto.token, u, true, { traceId: r.traceId, ip: r.ip }); }
    @Post('decline')
    decline(
    @Body()
    dto: TokenDto,
    @CurrentUser()
    u: User,
    @Req()
    r: Request) { return this.service.respondByToken(dto.token, u, false, { traceId: r.traceId, ip: r.ip }); }
    @Post(':id/accept')
    acceptId(
    @Param('id')
    id: string,
    @CurrentUser()
    u: User,
    @Req()
    r: Request) { return this.service.respond(id, u, true, { traceId: r.traceId, ip: r.ip }); }
    @Post(':id/decline')
    declineId(
    @Param('id')
    id: string,
    @CurrentUser()
    u: User,
    @Req()
    r: Request) { return this.service.respond(id, u, false, { traceId: r.traceId, ip: r.ip }); }
    @Post(':id/revoke')
    @UseGuards(OrgContextGuard, PermissionsGuard)
    @RequirePermissions('invite:revoke')
    revoke(
    @Param('id')
    id: string,
    @CurrentOrg()
    o: OrgContext,
    @CurrentUser()
    u: User,
    @Req()
    r: Request) { return this.service.revoke(o.organizationId, u, id, { traceId: r.traceId, ip: r.ip }); }
}
