import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailWebhookController } from './mail-webhook.controller';
import { MailWebhookService } from './mail-webhook.service';

@Module({
  controllers: [MailWebhookController],
  providers: [MailService, MailWebhookService],
  exports: [MailService],
})
export class MailModule {}
