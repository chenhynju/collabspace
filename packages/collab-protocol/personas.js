// Public, application-owned appearance metadata. No user-supplied URLs or credentials.
const entries=require('./persona-catalog.json');
const seen=new Set();
for(const entry of entries){
 if(!/^[a-z][a-z0-9-]{0,79}$/.test(entry.id)||seen.has(entry.id)||!['male','female'].includes(entry.gender)||entry.representation!=='portrait'||entry.modelUrl!==null||!/^\/personas\/[a-z0-9-]+\.png$/.test(entry.poster))throw Error('Invalid character catalog');
 seen.add(entry.id);Object.freeze(entry);
}
const CHARACTER_CATALOG=Object.freeze(entries);
const characterById=id=>CHARACTER_CATALOG.find(character=>character.id===id);
function appearanceInput(body){
 if(!body||typeof body!=='object'||Object.keys(body).some(key=>!['mode','presetId','revision'].includes(key))||body.mode!=='preset'||!characterById(body.presetId))throw Error('请选择已交付的固定形象；捏脸模式尚不可用');
 if(!Number.isSafeInteger(body.revision)||body.revision<0||body.revision>=2147483647)throw Error('需要有效的当前配置版本');
 return {mode:'preset',presetId:body.presetId,revision:body.revision};
}
module.exports={CHARACTER_CATALOG,characterById,appearanceInput};
