export type ImagePreset = 'original' | 'balanced' | 'small';

// Local preparation only. Upload remains under the native editor's permissions.
export async function prepareOfficeImage(file: File, preset: ImagePreset): Promise<File> {
  if (preset === 'original') return file;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('仅优化PNG、JPEG、WebP；其他格式请使用原图。');
  if (file.size > 20 * 1024 * 1024) throw new Error('图片超过20MB，请先在本地缩小。');
  const bytes = new Uint8Array(await file.arrayBuffer()), view = new DataView(bytes.buffer);
  const isPng = bytes[0] === 137 && bytes[1] === 80;
  const isWebp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF';
  if (isPng || isWebp) {
    for (let offset = isPng ? 8 : 12; offset + 8 <= bytes.length;) {
      const kind = String.fromCharCode(...bytes.slice(offset + (isPng ? 4 : 0), offset + (isPng ? 8 : 4)));
      if (kind === 'acTL' || kind === 'ANIM' || (kind === 'VP8X' && (bytes[offset + 8] & 2))) {
        throw new Error('动画图片请使用原图，避免丢失动画。');
      }
      const size = view.getUint32(offset + (isPng ? 0 : 4), !isPng);
      offset += isPng ? size + 12 : size + 8 + (size % 2);
    }
  }
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 32_000_000) throw new Error('图片像素过大，请先在本地缩小。');
    const ratio = Math.min(1, (preset === 'small' ? 1280 : 1920) / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('浏览器无法处理图片，请使用原图。');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    // WebP keeps transparency; never flatten transparent diagrams onto white.
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      value => value ? resolve(value) : reject(new Error('图片处理失败，请使用原图。')),
      'image/webp', preset === 'small' ? 0.75 : 0.86,
    ));
    if (blob.type !== 'image/webp' || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '-optimized.webp', {type: blob.type});
  } finally { bitmap.close(); }
}
