type TextItem={str?:string;transform?:number[];width?:number;height?:number;hasEOL?:boolean};
type Glyph={unicode?:string;isSpace?:boolean};
export function pdfWordGaps(runs:(Glyph|number)[][]):Map<string,string>{
 const replacements=new Map<string,string>();
 for(const run of runs){
  const shifts=run.filter((x):x is number=>typeof x==='number').map(Math.abs).sort((a,b)=>a-b);
  const glyphs=run.filter(x=>typeof x!=='number').length;
  const tracking=shifts.length>=Math.max(1,glyphs-1)*.7;
  const threshold=Math.max(120,tracking?(shifts[Math.floor((shifts.length-1)/2)]||0)*3:0);
  let original='',spaced='';
  for(const value of run){
   if(typeof value==='number'){if(value < -threshold&&spaced&&!/\s$/.test(spaced))spaced+=' ';}
   else{const str=value.unicode||(value.isSpace?' ':'');original+=str;spaced+=str;}
  }
  if(original&&original!==spaced.trim())replacements.set(original,spaced.trim());
 }
 return replacements;
}
// PDF text items often contain words without literal spaces. Keep geometric word gaps.
export function pdfTextLayout(items:TextItem[],replacements=new Map<string,string>()):string{
 let text='',previous:TextItem|undefined;
 for(const item of items){
  if(typeof item.str!=='string'||!item.str)continue;
  const x=item.transform?.[4],y=item.transform?.[5],px=previous?.transform?.[4],py=previous?.transform?.[5];
  const size=Math.max(1,Math.abs(previous?.height||previous?.transform?.[3]||10));
  if(previous&&[x,y,px,py].every(Number.isFinite)){
   if(previous.hasEOL||Math.abs(y!-py!)>Math.max(1,size*.3))text+='\n';
   else if(x!-(px!+Math.abs(previous.width||0))>Math.max(.5,size*.12)&&!/[\s]$/.test(text)&&!/^\s/.test(item.str))text+=' ';
  }
  text+=replacements.get(item.str)||item.str;previous=item;
 }
 return text;
}
