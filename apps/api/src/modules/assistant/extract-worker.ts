// Isolated untrusted document parsing: parent enforces timeout and heap limit.
export {};
import {pdfTextLayout,pdfWordGaps} from './pdf-text-layout';
// Load trusted parser code before requesting any untrusted bytes. Startup has a
// separate bounded budget in the parent; actual parsing still has ten seconds.
const kind = process.argv[2];
const parser=kind==='docx'?require('mammoth'):kind==='pdf'?require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js'):null;
const chunks: Buffer[] = [];
process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
process.stdin.on('end', async () => {
  try {
    const buffer = Buffer.concat(chunks);
    let text: string;
    if (kind === 'docx') {
      // ZIP central directory sizes bound inflated input before Mammoth loads it.
      let total = 0, entries = 0;
      for (let i = 0; i + 46 <= buffer.length; i++) {
        if (buffer.readUInt32LE(i) !== 0x02014b50) continue;
        total += buffer.readUInt32LE(i + 24); entries++;
        if (total > 20 * 1024 * 1024 || entries > 2000) throw new Error('ZIP_LIMIT');
        i += 45 + buffer.readUInt16LE(i + 28) + buffer.readUInt16LE(i + 30) + buffer.readUInt16LE(i + 32);
      }
      if (!entries) throw new Error('INVALID_ZIP');
      text = (await parser.extractRawText({ buffer })).value;
    } else if (kind === 'pdf') {
      // PDF.js expects Uint8Array.slice to copy; Node Buffer.slice aliases memory.
      const pdfjs=parser;
      pdfjs.PDFJS.disableFontFace=true;
      pdfjs.PDFJS.isEvalSupported=false;
      const doc=await pdfjs.getDocument({data:new Uint8Array(buffer),nativeImageDecoderSupport:'none',disableFontFace:true,isEvalSupported:false});
      const pages:string[]=[];
      try{for(let number=1;number<=Math.min(doc.numPages,30);number++){
          const page=await doc.getPage(number);
          const content=await page.getTextContent({normalizeWhitespace:true,disableCombineTextItems:false});
          const ops=await page.getOperatorList();
          const runs=ops.argsArray.filter((_:any,i:number)=>ops.fnArray[i]===pdfjs.OPS.showText).map((args:any)=>args[0]);
          pages.push(pdfTextLayout(content.items,pdfWordGaps(runs)));
      }}finally{await doc.destroy()}
      text=pages.join('\n\n');
    } else text = buffer.toString('utf8');
    process.stdout.write(JSON.stringify({ text: text.slice(0,100000), truncated: text.length > 100000 }));
  } catch { process.exitCode = 1; }
});
process.stderr.write('EXTRACT_READY\n');
