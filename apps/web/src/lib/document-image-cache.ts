// Same account/org/document partition and logout erasure as the Yjs draft DB.
async function database(user:string,org:string,doc:string) {
  return new Promise<IDBDatabase>((resolve,reject)=>{
    const r=indexedDB.open(`collabspace:v1:${location.origin}:${user}:${org}:${doc}`,1);
    r.onupgradeneeded=()=>r.result.createObjectStore('data');
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
}
export async function imageCache(user:string,org:string,doc:string,id:string,operation:'read'|'write'|'delete',blob?:Blob):Promise<Blob|undefined> {
  const db=await database(user,org,doc);
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction('data',operation==='read'?'readonly':'readwrite'),store=tx.objectStore('data'),key='image:'+id;
    const r=operation==='read'?store.get(key):operation==='write'?store.put(blob,key):store.delete(key);
    let value:Blob|undefined;r.onsuccess=()=>{if(operation==='read')value=r.result;};
    tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });}finally{db.close();}
}
