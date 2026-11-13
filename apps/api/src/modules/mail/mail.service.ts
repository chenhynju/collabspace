import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface SendResult {
  provider: 'resend' | 'console';
  id?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    const provider = this.config.get<string>('EMAIL_PROVIDER') ?? 'resend';
    this.resend = provider === 'resend' && apiKey ? new Resend(apiKey) : null;
    this.from =
      this.config.get<string>('EMAIL_FROM') ?? 'CollabSpace <contact@purelamp.uk>';
  }

  /** 是否走真实发信（否则 console 兜底，本地无 key 时仍可开发调试） */
  get isLive(): boolean {
    return this.resend !== null;
  }

  /** 注册验证邮件 */
  async sendVerificationEmail(to: string, url: string, name?: string): Promise<SendResult> {
    const hi = name ? `，${name}` : '';
    const html = `<!doctype html>
<html lang="zh-CN">
  <body style="margin:0;background:#f1f5f9;padding:32px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:40px;">
      <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;">欢迎加入 CollabSpace${hi}</h1>
      <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.7;">
        请点击下方按钮验证你的邮箱，完成注册。链接有效期为 24 小时。
      </p>
      <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;">验证邮箱</a>
      <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;word-break:break-all;">
        如果按钮无法点击，请复制此链接：<br />${url}
      </p>
    </div>
  </body>
</html>`;

    return this.send(to, '【CollabSpace】请验证你的邮箱', html, `[verify] ${to} -> ${url}`, undefined, 'verification');
  }

  /** 密码重置邮件 */
  async sendPasswordResetEmail(to: string, url: string, name?: string): Promise<SendResult> {
    const hi = name ? `，${name}` : '';
    const html = `<!doctype html>
<html lang="zh-CN">
  <body style="margin:0;background:#f1f5f9;padding:32px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:40px;">
      <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;">重置你的 CollabSpace 密码${hi}</h1>
      <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.7;">
        我们收到了重置密码的请求。请点击下方按钮设置新密码，链接有效期为 1 小时。<br />
        如果这不是你本人的操作，请忽略此邮件，你的密码不会改变。
      </p>
      <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;">重置密码</a>
      <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;word-break:break-all;">
        如果按钮无法点击，请复制此链接：<br />${url}
      </p>
    </div>
  </body>
</html>`;

    return this.send(to, '【CollabSpace】重置你的密码', html, `[reset] ${to} -> ${url}`, undefined, 'password_reset');
  }

  async sendInvitationEmail(to:string,url:string,organization:string,id:string){
    const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
    return this.send(to,'【CollabSpace】组织协作邀请',`<h1>加入 ${escape(organization)}</h1><p>请核对受邀邮箱与组织，登录或注册后选择接受或拒绝。邀请7天有效。</p><a href="${escape(url)}">查看组织邀请</a>`,`[invite] ${to} -> ${url}`,'collabspace-invitation-'+id, 'invitation');
  }

  async sendProjectEmail(to:string,subject:string,text:string,key:string) {
    const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
    return this.send(to,subject,`<div style="white-space:pre-wrap">${escape(text)}</div>`,'[project mail content omitted]',key,'project_mail');
  }

  private async send(to: string, subject: string, html: string, consolePreview: string, idempotencyKey?:string, module = 'notification') {
    // RFC 2606 保留域名的合成测试邮箱：永不真实外发，始终落容器日志供验收工装读取
    if (to.endsWith('@example.invalid')) {
      this.logger.warn(`合成测试邮箱，邮件未真实发出：\n${consolePreview}`);
      return { provider: 'console' as const };
    }
    if (!this.resend) {
      this.logger.warn(`未配置 RESEND_API_KEY，邮件未真实发出：\n${consolePreview}`);
      return { provider: 'console' as const };
    }
    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject,
      html,
      tags: [{name:'app',value:'collabspace'}, {name:'module',value:module}],
    },{...(idempotencyKey?{idempotencyKey}:{}),signal:AbortSignal.timeout(20000)});
    if (error || !data?.id) {
      this.logger.error(`Resend 发信失败: ${JSON.stringify(error)}`);
      throw new Error(`email provider error: ${error?.message ?? 'missing receipt'}`);
    }
    this.logger.log(`邮件已发送 via Resend id=${data?.id} to=${to}`);
    return { provider: 'resend' as const, id: data?.id };
  }
}
