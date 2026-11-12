import { ConfigService } from '@nestjs/config';

/**
 * 读取 JWT_SECRET：未配置或过短时直接抛错，让进程在启动期 fail-fast。
 * 不允许任何兜底值（历史上的 'change-me' 会让伪造 token 成为可能）；
 * 本地一次性环境（scripts/local-up.cjs）显式注入合成密钥，不受影响。
 */
export function requireJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET')?.trim() ?? '';
  if (secret.length < 16) {
    throw new Error(
      'JWT_SECRET 未配置或长度不足 16 字符，拒绝启动（历史兜底值已禁用）',
    );
  }
  return secret;
}
