import { HttpException, HttpStatus } from '@nestjs/common';

const WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILURES = 5;
// 定期清扫间隔，避免 Map 无界增长
const SWEEP_INTERVAL_MS = 60 * 1000;

/**
 * 登录失败限流：按「IP + 邮箱」滑动窗口计数，5 分钟内失败 5 次即拒绝。
 * 内存实现，适用单实例部署（当前形态）；水平扩容时需换成 Redis 计数。
 * 只计失败：成功登录立即清零，不影响正常用户。
 */
export class LoginThrottle {
  private failures = new Map<string, number[]>();
  private lastSweep = Date.now();

  /** 窗口内失败未超限则放行；超限抛 429 */
  assertAllowed(key: string): void {
    this.sweep();
    const arr = this.prune(key);
    if (arr.length >= MAX_FAILURES) {
      const retryAfterSec = Math.ceil(
        (WINDOW_MS - (Date.now() - arr[0])) / 1000,
      );
      throw new HttpException(
        {
          code: 'LOGIN_THROTTLED',
          message: `尝试过于频繁，请 ${Math.max(1, retryAfterSec)} 秒后再试`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordFailure(key: string): void {
    this.sweep();
    const arr = this.prune(key);
    arr.push(Date.now());
    this.failures.set(key, arr);
  }

  recordSuccess(key: string): void {
    this.failures.delete(key);
  }

  /** 剔除窗口外的旧记录，返回当前窗口内的失败时间戳 */
  private prune(key: string): number[] {
    const cutoff = Date.now() - WINDOW_MS;
    const arr = (this.failures.get(key) ?? []).filter((t) => t > cutoff);
    if (arr.length === 0) this.failures.delete(key);
    else this.failures.set(key, arr);
    return this.failures.get(key) ?? [];
  }

  private sweep(): void {
    if (Date.now() - this.lastSweep < SWEEP_INTERVAL_MS) return;
    this.lastSweep = Date.now();
    const cutoff = Date.now() - WINDOW_MS;
    for (const [key, arr] of this.failures) {
      const kept = arr.filter((t) => t > cutoff);
      if (kept.length === 0) this.failures.delete(key);
      else this.failures.set(key, kept);
    }
  }
}
