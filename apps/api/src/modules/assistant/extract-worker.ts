// Isolated untrusted document parsing: parent enforces timeout and heap limit.
export {};
const chunks: Buffer[] = [];
process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
process.stdin.on('end', async () => {
  try {
    const buffer = Buffer.concat(chunks);
    const kind = process.argv[2];
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
      text = (await require('mammoth').extractRawText({ buffer })).value;
    } else if (kind === 'pdf') {
      // PDF.js expects Uint8Array.slice to copy; Node Buffer.slice aliases memory.
      text = (await require('pdf-parse/lib/pdf-parse.js')(new Uint8Array(buffer), { max: 30 })).text;
    } else text = buffer.toString('utf8');
    process.stdout.write(JSON.stringify({ text: text.slice(0,100000), truncated: text.length > 100000 }));
  } catch { process.exitCode = 1; }
});
