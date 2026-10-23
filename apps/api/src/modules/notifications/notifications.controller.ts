import { Controller, Get, Post, Param } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
@Controller('notifications')
export class NotificationsController {
    constructor(private readonly service: NotificationsService) { }
    @Get()
    list(
    @CurrentUser()
    u: {
        id: string;
    }) { return this.service.list(u.id); }
    @Get('unread-count')
    unread(
    @CurrentUser()
    u: {
        id: string;
    }) { return this.service.unread(u.id); }
    @Post(':id/read')
    read(
    @CurrentUser()
    u: {
        id: string;
    },
    @Param('id')
    id: string) { return this.service.read(u.id, id); }
}
