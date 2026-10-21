const params=new URLSearchParams(location.search),doc=params.get('doc')||'word',user=params.get('user')||'viewer';
fetch(`config?doc=${encodeURIComponent(doc)}&user=${encodeURIComponent(user)}`).then(r=>r.json()).then(config=>{
  if(config.error)throw Error(config.error);
  config.events={onDocumentReady(){window.officeReady=true;document.querySelector('#status').textContent='Office 已打开';},onError(e){document.querySelector('#error').textContent='Editor error '+e.data.errorCode;}};
  window.officeEditor=new DocsAPI.DocEditor('editor',config);
}).catch(e=>document.querySelector('#error').textContent=e.message);
document.querySelector('#save').disabled=user==='viewer';
document.querySelector('#save').onclick=()=>fetch('force?doc='+doc,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user})}).then(r=>r.json()).then(r=>{document.querySelector('#status').textContent=r.error===0?'等待持久化检查点':r.error===4?'没有新增更改':'保存失败 '+r.error;});
setInterval(()=>fetch('state?doc='+doc).then(r=>r.json()).then(s=>{document.querySelector('#people').textContent='正在编辑：'+s.editing.join('、');window.officeState=s;}),1000);
