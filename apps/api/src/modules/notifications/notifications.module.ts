import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
@Module({ imports: [MailModule, RealtimeModule], providers: [NotificationsService], controllers: [NotificationsController], exports: [NotificationsService] })
export class NotificationsModule {
}
