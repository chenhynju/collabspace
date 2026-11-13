// 探针：登录生产环境，打开 /collaboration，盘点关键元素是否存在
const { chromium } = require('@playwright/test');
const config = require('./config.cjs');

(async () => {
  const api = config.NEXT_PUBLIC_API_URL;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1700, height: 1100 } });
  const req = await ctx.request;
  const r = await req.post(api + '/auth/login', { data: { email: config.TEST_OWNER_EMAIL, password: config.TEST_PASSWORD } });
  const { accessToken } = await r.json();
  await ctx.addInitScript(({ token, org }) => { localStorage.setItem('access_token', token); localStorage.setItem('current_org_id', org); }, { token: accessToken, org: config.TEST_ORG });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  await p.goto(config.WEB_URL + '/collaboration', { timeout: 120000 });
  await p.waitForTimeout(12000);
  const report = {};
  report.url = p.url();
  report.title = await p.title();
  report.headings = await p.locator('h1,h2,h3').allTextContents();
  report.hasNewBoardBtn = await p.getByRole('button', { name: '新建 白板 / Mermaid', exact: true }).count();
  report.hasOldHeading = await p.getByRole('heading', { name: '让团队始终编辑同一份文档。' }).count();
  report.hasCollabHeading = await p.getByRole('heading', { name: '协作空间' }).count();
  report.loadingStatus = await p.getByRole('status').filter({ hasText: '正在加载协作内容' }).count();
  report.projectLink = await p.locator(`a[href="/projects/${config.TEST_PROJECT}/content"]`).count();
  report.bodySnippet = (await p.locator('body').innerText()).slice(0, 600);
  // 尝试点新建按钮看对话框
  if (report.hasNewBoardBtn) {
    await p.getByRole('button', { name: '新建 白板 / Mermaid', exact: true }).first().click();
    await p.waitForTimeout(3000);
    report.dialogCount = await p.getByRole('dialog').count();
    report.projectSelect = await p.getByLabel('所属项目', { exact: true }).count();
    report.dialogText = report.dialogCount ? (await p.getByRole('dialog').first().innerText()).slice(0, 400) : null;
  }
  report.pageErrors = errors.slice(0, 10);
  await p.screenshot({ path: '.test-runs/full-regression-20261113/probe-collaboration.png', fullPage: true });
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch(e => { console.error('PROBE_FAIL', e.message); process.exit(1); });
