const {test,expect}=require('@playwright/test');
const {randomUUID,createHash}=require('node:crypto');
const fs=require('node:fs');
const config=require('./config.cjs');
const Y=require('../../packages/collab-store/node_modules/yjs');
const body=c=>c.editor.evaluate(el=>{const copy=el.cloneNode(true);copy.querySelectorAll('.collab-caret').forEach(n=>n.remove());return copy.textContent||'';});
test('two accounts concurrently insert at the same position and converge after an offline partition',async({browser,request})=>{
  const api=config.NEXT_PUBLIC_API_URL,contexts=[];
  async function token(email){const r=await request.post(`${api}/auth/login`,{data:{email,password:config.TEST_PASSWORD}});expect(r.ok()).toBeTruthy();return (await r.json()).accessToken;}
  const owner=await token(config.TEST_OWNER_EMAIL),member=await token(config.TEST_MEMBER_EMAIL);
  const headers={Authorization:`Bearer ${owner}`,'x-organization-id':config.TEST_ORG};
  const created=await request.post(`${api}/documents`,{headers,data:{projectId:config.TEST_PROJECT,title:'Convergence '+randomUUID().slice(0,8)}});expect(created.ok()).toBeTruthy();const d=await created.json();
  expect((await request.put(`${api}/documents/${d.id}/grants`,{headers,data:{userId:config.TEST_MEMBER,role:'EDITOR'}})).ok()).toBeTruthy();
  async function client(t){const c=await browser.newContext();contexts.push(c);await c.addInitScript(({t,org})=>{localStorage.setItem('access_token',t);localStorage.setItem('current_org_id',org);},{t,org:config.TEST_ORG});const p=await c.newPage();await p.goto(`${config.WEB_URL}/projects/${config.TEST_PROJECT}/documents/${d.id}`);const editor=p.getByRole('textbox',{name:'协作文档正文'});await expect(editor).toBeVisible();await expect(p.getByText('已保存到服务器',{exact:false})).toBeVisible();return{c,p,editor};}
  const saved=c=>expect(c.p.getByText('已保存到服务器',{exact:false})).toBeVisible({timeout:60000});
  const evidence={url:config.WEB_URL,documentId:d.id,accounts:2,phases:[]};
  try{
    const a=await client(owner),b=await client(member);
    await a.editor.fill('Base');await saved(a);await expect.poll(()=>body(b)).toBe('Base');
    // Both cursors start at index zero before either user inserts.
    await a.editor.click();await a.p.keyboard.press('Control+Home');await b.editor.click();await b.p.keyboard.press('Control+Home');
    await Promise.all([a.p.keyboard.type('Alpha '),b.p.keyboard.type('Beta ')]);await saved(a);await saved(b);
    await expect.poll(async()=>(await body(a))===(await body(b))).toBe(true);
    let text=await body(a);for(const word of ['Alpha','Beta','Base'])expect(text.split(word).length-1).toBe(1);
    evidence.phases.push({name:'same-position online inserts',text,converged:true});
    await a.c.setOffline(true);await b.c.setOffline(true);
    await a.editor.press('Control+End');await b.editor.press('Control+End');
    await Promise.all([a.p.keyboard.type(' offline-A'),b.p.keyboard.type(' offline-B')]);
    for(const c of [a,b])await expect(c.p.getByText('已保存到此设备 · 离线',{exact:false})).toBeVisible();
    evidence.phases.push({name:'partition',a:await body(a),b:await body(b)});
    const reconnectAt=Date.now();await Promise.all([a.c.setOffline(false),b.c.setOffline(false)]);await saved(a);await saved(b);
    await expect.poll(async()=>(await body(a))===(await body(b))).toBe(true);text=await body(a);
    for(const word of ['Alpha','Beta','Base','offline-A','offline-B'])expect(text.split(word).length-1).toBe(1);
    const hash=createHash('sha256').update(text).digest('hex');
    evidence.phases.push({name:'reconnected',text,sha256:hash,durableAcknowledged:true,reconnectMs:Date.now()-reconnectAt});
    await a.p.reload();await b.p.reload();await saved(a);await saved(b);await expect.poll(()=>body(a)).toBe(text);await expect.poll(()=>body(b)).toBe(text);
    const versionId=randomUUID();expect((await request.post(`${api}/documents/${d.id}/versions`,{headers,data:{id:versionId,name:'Convergence proof'}})).ok()).toBeTruthy();
    const snapshot=await request.get(`${api}/documents/${d.id}/versions/${versionId}`,{headers});expect(snapshot.ok()).toBeTruthy();
    const y=new Y.Doc();Y.applyUpdate(y,Buffer.from((await snapshot.json()).state,'base64'));
    const content=n=>n instanceof Y.XmlText?n.toString():(n.toArray?.()||[]).map(content).join('');
    const persisted=content(y.getXmlFragment('default'));expect(persisted).toBe(text);y.destroy();
    evidence.status='PASSED';evidence.refreshedBoth=true;evidence.persistedSnapshotMatches=true;
    fs.writeFileSync(process.env.COLLAB_CONFLICT_EVIDENCE||'evidence/collaboration/conflict-proof.json',JSON.stringify(evidence,null,2));
    await a.p.screenshot({path:'evidence/collaboration/conflict-owner.png',fullPage:true});await b.p.screenshot({path:'evidence/collaboration/conflict-member.png',fullPage:true});
  }finally{for(const c of contexts)await c.close();}
});
