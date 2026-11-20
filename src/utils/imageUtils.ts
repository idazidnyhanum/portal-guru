export async function compressImageFile(
  file: File,
  options: { maxDim?: number; quality?: number; preserveTransparency?: boolean; maxBytes?: number } = {},
): Promise<string> {
  const {
    maxDim = 560,
    quality = 0.82,
    preserveTransparency = file.type === 'image/png',
    maxBytes = 78_000,
  } = options;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Gagal membaca file gambar.'));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Format gambar tidak didukung browser.'));
    image.src = dataUrl;
  });

  let width = img.naturalWidth || img.width || 300;
  let height = img.naturalHeight || img.height || 300;

  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.max(24, Math.round(width * ratio));
    height = Math.max(24, Math.round(height * ratio));
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas tidak tersedia di browser.');
  }

  if (!preserveTransparency) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);

  if (preserveTransparency) {
    let output = canvas.toDataURL('image/png');
    if (output.length <= maxBytes) return output;
    // Shrink dimensions cleanly if transparent PNG exceeds limit
    let scale = 0.78;
    for (let i = 0; i < 3 && output.length > maxBytes; i++) {
      const nextW = Math.max(32, Math.round(width * scale));
      const nextH = Math.max(32, Math.round(height * scale));
      canvas.width = nextW;
      canvas.height = nextH;
      const c2 = canvas.getContext('2d');
      if (c2) {
        c2.clearRect(0, 0, nextW, nextH);
        c2.drawImage(img, 0, 0, nextW, nextH);
        output = canvas.toDataURL('image/png');
      }
      scale *= 0.78;
    }
    if (output.length <= maxBytes) return output;
    // Fallback to white-backed JPEG if still above budget
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  }

  let currentQuality = quality;
  let output = canvas.toDataURL('image/jpeg', currentQuality);
  while (output.length > maxBytes && currentQuality > 0.4) {
    currentQuality = Number((currentQuality - 0.1).toFixed(2));
    output = canvas.toDataURL('image/jpeg', currentQuality);
  }
  return output;
}

export function getPdfImageFormat(dataUrl: string): 'PNG' | 'JPEG' {
  return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
}
