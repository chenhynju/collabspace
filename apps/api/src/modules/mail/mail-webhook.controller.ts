import { Controller, Post, Req, RawBodyRequest, HttpCode, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { Public } from '../../common/decorators/public.decorator';
import { MailWebhookService } from './mail-webhook.service';

@Controller('webhooks/resend')
export class MailWebhookController {
  constructor(private readonly config: ConfigService, private readonly router: MailWebhookService) {}
  @Public()
  @Post()
  @HttpCode(200)
  async receive(@Req() req: RawBodyRequest<Request>) {
    const secret = this.config.get<string>('RESEND_WEBHOOK_SECRET');
    if (!secret) throw new ServiceUnavailableException('MAIL_WEBHOOK_NOT_CONFIGURED');
    const id = req.header('svix-id'), timestamp = req.header('svix-timestamp'), signature = req.header('svix-signature');
    if (!req.rawBody || !id || !timestamp || !signature) throw new UnauthorizedException('INVALID_MAIL_SIGNATURE');
    let event: unknown;
    try {
      event = new Resend('verification-only').webhooks.verify({
        payload: req.rawBody.toString('utf8'), headers: { id, timestamp, signature }, webhookSecret: secret,
      });
    } catch { throw new UnauthorizedException('INVALID_MAIL_SIGNATURE'); }
    return this.router.receive(id, event);
  }
}
