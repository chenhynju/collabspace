const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');
const config = require('./config.cjs');

test('two IM accounts exchange one bubble per message and retain exact history after reload', async ({ browser, request }) => {
  const login = await request.post(`${config.NEXT_PUBLIC_API_URL}/auth/login`, {
    data: { email: config.TEST_OWNER_EMAIL, password: config.TEST_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const headers = { Authorization: `Bearer ${(await login.json()).accessToken}`, 'x-organization-id': config.TEST_ORG };
  const created = await request.post(`${config.NEXT_PUBLIC_API_URL}/conversations/direct`, {
    headers, data: { userId: config.TEST_MEMBER },
  });
  expect(created.ok()).toBeTruthy();
  const conversation = await created.json();
  const contexts = [];
  const sockets = [];
  async function open(email) {
    const context = await browser.newContext();
    contexts.push(context);
    const page = await context.newPage();
    let resolveConnected;
    const connected = new Promise(resolve => resolveConnected = resolve);
    page.on('websocket', socket => {
      if (!socket.url().includes('/socket.io/')) return;
      sockets.push(socket);
      socket.on('framereceived', ({ payload }) => {
        if (String(payload).startsWith('40')) resolveConnected();
      });
    });
    await page.goto(`${config.WEB_URL}/login`);
    await page.locator('input[type=email]').fill(email);
    await page.locator('input[type=password]').fill(config.TEST_PASSWORD);
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await page.waitForURL('**/dashboard');
    await page.goto(`${config.WEB_URL}/im?c=${conversation.id}`);
    await expect(page.getByPlaceholder('输入消息...')).toBeVisible();
    await Promise.race([connected, new Promise((_, reject) => setTimeout(() => reject(Error('IM socket did not authenticate')), 15000))]);
    return page;
  }
  const bubble = (page, text) => page.locator('.whitespace-pre-wrap').filter({ hasText: text });
  const prefix = `im-${randomUUID().slice(0,8)}`;
  const sent = [];
  try {
    const a = await open(config.TEST_OWNER_EMAIL);
    const b = await open(config.TEST_MEMBER_EMAIL);
    for (const [sender, label] of [[a, 'owner'], [b, 'member']]) {
      const text = `${prefix}-${label}`;
      sent.push(text);
      const response = sender.waitForResponse(r => r.url().endsWith(`/conversations/${conversation.id}/messages`) && r.request().method() === 'POST');
      await sender.getByPlaceholder('输入消息...').fill(text);
      await sender.getByRole('button', { name: '发送', exact: true }).click();
      expect((await response).ok()).toBeTruthy();
      for (const page of [a, b]) await expect(bubble(page, text)).toHaveCount(1);
    }
    // Distinct messages with identical content must remain distinct.
    const identical = `${prefix}-same-content`;
    sent.push(identical, identical);
    for (let i = 0; i < 2; i++) {
      await a.getByPlaceholder('输入消息...').fill(identical);
      await a.getByRole('button', { name: '发送', exact: true }).click();
      await expect(a.getByPlaceholder('输入消息...')).toHaveValue('');
      for (const page of [a, b]) await expect(bubble(page, identical)).toHaveCount(i + 1);
    }
    // Hold the first request while Enter is pressed again: only one POST is allowed.
    const rapid = `${prefix}-rapid-enter`;
    sent.push(rapid);
    let releasePost, reachedPost;
    const blocked = new Promise(resolve => releasePost = resolve);
    const reached = new Promise(resolve => reachedPost = resolve);
    let rapidPosts = 0;
    const routeHandler = async route => {
      if (route.request().method() === 'POST') {
        rapidPosts++;
        reachedPost();
        await blocked;
      }
      await route.continue();
    };
    await a.route(`**/conversations/${conversation.id}/messages`, routeHandler);
    await a.getByPlaceholder('输入消息...').fill(rapid);
    await a.getByPlaceholder('输入消息...').press('Enter');
    await reached;
    await a.getByPlaceholder('输入消息...').press('Enter');
    releasePost();
    await expect(a.getByPlaceholder('输入消息...')).toHaveValue('');
    for (const page of [a, b]) await expect(bubble(page, rapid)).toHaveCount(1);
    expect(rapidPosts).toBe(1);
    await a.unroute(`**/conversations/${conversation.id}/messages`, routeHandler);
    const history = await request.get(`${config.NEXT_PUBLIC_API_URL}/conversations/${conversation.id}/messages?limit=50`, { headers });
    expect(history.ok()).toBeTruthy();
    const rows = (await history.json()).filter(m => m.content.startsWith(prefix));
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map(m => m.id)).size).toBe(5);
    for (const page of [a, b]) {
      await page.reload();
      for (const text of new Set(sent)) await expect(bubble(page, text)).toHaveCount(sent.filter(t => t === text).length);
    }
    expect(sockets.length).toBeGreaterThanOrEqual(2);
    await a.screenshot({ path: 'evidence/collaboration/im-owner.png', fullPage: true });
    await b.screenshot({ path: 'evidence/collaboration/im-member.png', fullPage: true });
  } finally {
    for (const context of contexts) await context.close();
  }
});
