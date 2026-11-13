// 探针：生产环境 docx 编辑器就绪诊断
const { chromium } = require('@playwright/test');
const config = require('./config.cjs');

(async () => {
  const api = config.NEXT_PUBLIC_API_URL;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1050 } });
  const req = await ctx.request;
  const r = await req.post(api + '/auth/login', { data: { email: config.TEST_OWNER_EMAIL, password: config.TEST_PASSWORD } });
  const { accessToken } = await r.json();
  const headers = { Authorization: 'Bearer ' + accessToken, 'x-organization-id': config.TEST_ORG };
  // 找测试项目下的 docx 文档
  const docs = await (await req.get(api + '/documents?projectId=' + config.TEST_PROJECT, { headers })).json();
  const list = Array.isArray(docs) ? docs : docs.items || [];
  const docx = list.find(d => (d.kind === 'OFFICE' || d.kind === 'WORD' || /docx/i.test(d.title || '')) && /docx/i.test(d.title || '')) || list.find(d => d.kind !== 'BOARD' && d.kind !== 'MARKDOWN');
  console.log('docx candidate:', docx ? { id: docx.id, title: docx.title, kind: docx.kind } : null, 'total docs:', list.length);
  if (!docx) { await browser.close(); return; }
  await ctx.addInitScript(({ token, org }) => { localStorage.setItem('access_token', token); localStorage.setItem('current_org_id', org); }, { token: accessToken, org: config.TEST_ORG });
  const p = await ctx.newPage();
  const logs = [];
  p.on('pageerror', e => logs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('requestfailed', rq => logs.push('reqfail: ' + rq.url().slice(0, 160) + ' ' + (rq.failure() || {}).errorText));
  p.on('response', rs => { if (rs.status() >= 400) logs.push('http' + rs.status() + ': ' + rs.url().slice(0, 160)); });
  await p.goto(config.WEB_URL + '/office/' + docx.id, { timeout: 120000 });
  // 等最多 90 秒看 ready
  let ready = false;
  for (let i = 0; i < 18 && !ready; i++) {
    await p.waitForTimeout(5000);
    ready = await p.locator('[data-office-ready="true"]').count() > 0;
  }
  const report = {
    ready,
    readyAttr: await p.locator('[data-office-ready]').first().getAttribute('data-office-ready').catch(() => null),
    editorChildren: await p.locator('#office-editor').evaluate(el => el.innerHTML.slice(0, 300)).catch(e => 'n/a'),
    bodyText: (await p.locator('body').innerText()).slice(0, 500),
    logs: logs.slice(0, 25),
  };
  await p.screenshot({ path: '.test-runs/full-regression-20261113/probe-docx.png', fullPage: false });
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch(e => { console.error('PROBE_FAIL', e.message); process.exit(1); });
