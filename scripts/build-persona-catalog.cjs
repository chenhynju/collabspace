// Check or rebuild the shared fixed appearance catalog from delivered portrait assets.
// This tool never generates images and never promotes a portrait to an animated model.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'apps/web/public/personas');
const female=['小岚','知夏','沐晴','书宁','若溪','明悦','安雅','可乔','乔伊','思衡'],male=['知行','亦辰','景川','予安','承远','泽言','睿文','诺亚','艾文','时序'];
const list=[];for(const [gender,names]of[['female',female],['male',male]])for(let i=0;i<names.length;i++){
 const id=gender==='female'&&i===0?'lan-v1':`${gender}-${String(i+1).padStart(2,'0')}-v1`,poster=`/personas/agent-${id}.png`,file=path.join(assets,`agent-${id}.png`),bytes=fs.readFileSync(file),p=JSON.parse(fs.readFileSync(path.join(assets,'provenance',id+'.json'),'utf8'));
 if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.length<1000||p.id!==id||p.tool!=='built-in image_gen'||!p.prompt)throw Error('Missing or invalid delivered portrait '+id);
 list.push({id,name:names[i],gender,description:'原创职场助手 · 固定静态外观',revision:'1',poster,representation:'portrait',modelUrl:null});
}
const hashes=list.map(c=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'apps/web/public',c.poster))).digest('hex'));if(new Set(hashes).size!==20)throw Error('Duplicate portrait bytes');
const catalog=JSON.stringify(list,null,2)+'\n',destination=path.join(root,'packages/collab-protocol/persona-catalog.json');
const manifest=JSON.stringify(list.map((c,i)=>({...c,sha256:hashes[i]})),null,2)+'\n',manifestPath=path.join(assets,'manifest.json');
if(process.argv.includes('--write')){fs.writeFileSync(destination,catalog);fs.writeFileSync(manifestPath,manifest);}else if(fs.readFileSync(destination,'utf8')!==catalog||fs.readFileSync(manifestPath,'utf8')!==manifest)throw Error('Catalog or manifest differs from delivered assets; run --write after review');
console.log(JSON.stringify({status:'PASSED',portraits:list.length,male:10,female:10,uniqueHashes:20,animatedModels:0,mode:process.argv.includes('--write')?'write':'check'}));
