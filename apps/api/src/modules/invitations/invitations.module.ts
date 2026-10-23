import { Module } from '@nestjs/common';
import { InvitationsController } from './invitations.controller';
import {InvitationsService} from './invitations.service';
import {NotificationsModule} from '../notifications/notifications.module';
import {MailModule} from '../mail/mail.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule,NotificationsModule,MailModule],
  controllers: [InvitationsController],
  providers:[InvitationsService],exports:[InvitationsService],
})
export class InvitationsModule {}
