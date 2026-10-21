// Private synthetic Office development acceptance, never production credentials.
const doc = process.argv[2] || 'word';
const extension = {word:'docx',sheet:'xlsx',slides:'pptx'}[doc];
if (!extension) throw Error('Unknown fixture');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, timeout = 90000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await fn()) return; await sleep(1000); }
  throw new Error('Office acceptance condition timed out');
}
(async () => {
  const config = JSON.parse(fs.readFileSync('.test-runs/office/config.json'));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const contexts = [];
  try {
    const pages = [];
    for (const user of ['alice', 'bob', 'viewer']) {
      const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
      contexts.push(context);
      assert.equal((await context.request.post('http://localhost:3391/manager/login', { data: { token: config.accessToken } })).status(), 200);
      const page = await context.newPage();
      await page.goto('http://localhost:3391/manager/?doc='+doc+'&user=' + user);
      await page.waitForFunction(() => window.officeReady, { timeout: 120000 });
      pages.push(page);
      console.log('Office ready:', user);
    }
    const request = contexts[0].request;
    const state = async () => (await request.get('http://localhost:3391/manager/state?doc='+doc)).json();
    await until(async () => (await state()).editing.length === 2);
    console.log('Two actual editors joined');
    const before = (await state()).revision;
    const markers = ['Alice-' + Date.now(), 'Bob-' + Date.now()];
    for (const [index, page] of pages.slice(0, 2).entries()) {
      const frame = page.frames().find(f => /documenteditor|spreadsheeteditor|presentationeditor/.test(f.url()));
      if (doc === 'sheet') {
        await frame.locator('#ce-cell-name').fill(index === 0 ? 'C4' : 'D4');
        await frame.locator('#ce-cell-name').press('Enter');
      } else if (doc === 'slides') {
        await frame.locator('#id_viewer_overlay').dblclick({ position: { x: 500, y: 125 } });
        await page.keyboard.press('End');
      } else {
        await frame.locator('#id_viewer_overlay').click({ position: { x: 650, y: 220 } });
        await page.keyboard.press('Control+End');
        await page.keyboard.press('End');
        await page.keyboard.press('Enter');
      }
      await sleep(1000);
      await page.keyboard.type(markers[index], { delay: 120 });
      if (doc === 'sheet') await page.keyboard.press('Enter');
      await sleep(2000);
      console.log('Native edit entered:', index);
    }
    assert.equal((await contexts[2].request.post('http://localhost:3391/manager/force?doc='+doc, { data: { user: 'viewer' } })).status(), 400);
    await pages[0].screenshot({ path: '.test-runs/office/'+doc+'-two-editor.png', fullPage: true });
    const checkpoint = await request.post('http://localhost:3391/manager/force?doc='+doc, { data: { user: 'alice' } });
    assert.equal(checkpoint.status(), 200);
    const response = await checkpoint.json();
    console.log('Checkpoint engine response:', response.error);
    assert.equal(response.error, 0, 'native engine must accept checkpoint');
    await until(async () => (await state()).revision > before);
    const revision = (await state()).revision;
    const download = await request.get('http://localhost:3391/manager/download?doc='+doc);
    assert.equal(download.status(), 200);
    fs.writeFileSync('.test-runs/office/'+doc+'-collaborated.'+extension, await download.body());
    fs.writeFileSync('.test-runs/office/'+doc+'-markers.json', JSON.stringify(markers));
    // Close read-only session first, then actual writers; validate final-save separately.
    await pages[2].close(); await pages[1].close(); await pages[0].close();
    await until(async () => (await state()).closed, 120000);
    fs.writeFileSync('.test-runs/office/'+doc+'-final.'+extension, await (await request.get('http://localhost:3391/manager/download?doc='+doc)).body());
    console.log(JSON.stringify({ opened: 3, realEditors: 2, checkpointRevision: revision, final: await state(), markers }));
  } finally { for (const context of contexts) await context.close(); await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
