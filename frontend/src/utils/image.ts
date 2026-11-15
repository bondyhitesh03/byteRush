// Prepares a photo for upload: fixes rotation, shrinks it and turns it into a compact JPEG data URL.
export function fitSize(w: number, h: number, max = 1600): { w: number; h: number } {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bmp, width: bmp.width, height: bmp.height };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('decode')); i.src = url; });
      return { source: img, width: img.naturalWidth, height: img.naturalHeight };
    } finally { URL.revokeObjectURL(url); }
  }
}

export async function prepareImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.');
  if (file.size > 20 * 1024 * 1024) throw new Error('That image is over 20 MB. Please choose a smaller one.');
  let decoded;
  try { decoded = await decode(file); } catch { throw new Error("This image format can't be opened. Try a JPG or PNG photo."); }
  const { w, h } = fitSize(decoded.width, decoded.height);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Your browser can't process images.");
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(decoded.source, 0, 0, w, h);
  let quality = 0.85;
  let url = canvas.toDataURL('image/jpeg', quality);
  while (url.length > 4_500_000 && quality > 0.4) { quality -= 0.15; url = canvas.toDataURL('image/jpeg', quality); }
  return url;
}
