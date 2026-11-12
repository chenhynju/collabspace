// 认证加固测试：JWT_SECRET fail-fast + 登录失败限流
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  path = require('node:path');
require('../node_modules/ts-node').register({
  project: path.join(__dirname, '../tsconfig.json'),
  transpileOnly: true,
});
const { ConfigService } = require('@nestjs/config');
const { requireJwtSecret } = require('../src/modules/auth/jwt-secret');
const { LoginThrottle } = require('../src/modules/auth/login-throttle');

test('requireJwtSecret：缺省/空串/过短一律拒绝，合法值原样返回', () => {
  assert.throws(() => requireJwtSecret(new ConfigService({})), /JWT_SECRET/);
  assert.throws(
    () => requireJwtSecret(new ConfigService({ JWT_SECRET: '' })),
    /JWT_SECRET/,
  );
  assert.throws(
    () => requireJwtSecret(new ConfigService({ JWT_SECRET: 'short' })),
    /JWT_SECRET/,
  );
  assert.throws(
    () => requireJwtSecret(new ConfigService({ JWT_SECRET: 'change-me' })),
    /JWT_SECRET/,
  );
  assert.equal(
    requireJwtSecret(new ConfigService({ JWT_SECRET: 'x'.repeat(32) })),
    'x'.repeat(32),
  );
});

// HttpException 的 payload 在 getResponse() 里，message 不一定含 code
const isThrottled = (err) =>
  err.getStatus?.() === 429 && err.getResponse?.()?.code === 'LOGIN_THROTTLED';

test('LoginThrottle：5 次失败后拒绝，成功清零，不同身份互不影响', () => {
  const t = new LoginThrottle();
  const key = '1.2.3.4|a@b.c';
  for (let i = 0; i < 5; i++) {
    t.assertAllowed(key);
    t.recordFailure(key);
  }
  assert.throws(() => t.assertAllowed(key), isThrottled);
  // 另一个 IP/邮箱不受影响
  t.assertAllowed('5.6.7.8|a@b.c');
  t.assertAllowed('1.2.3.4|other@b.c');
  // 成功清零后可再次尝试
  const key2 = '9.9.9.9|c@d.e';
  for (let i = 0; i < 4; i++) t.recordFailure(key2);
  t.recordSuccess(key2);
  t.assertAllowed(key2);
});

test('LoginThrottle：窗口滑动后旧失败不再计数', () => {
  const t = new LoginThrottle();
  const key = '1.1.1.1|w@x.y';
  for (let i = 0; i < 5; i++) t.recordFailure(key);
  assert.throws(() => t.assertAllowed(key), isThrottled);
  // 把所有失败时间戳拨回 6 分钟前（模拟窗口滑出）
  const arr = t.failures.get(key);
  const past = Date.now() - 6 * 60 * 1000;
  t.failures.set(key, arr.map(() => past));
  t.assertAllowed(key);
});
