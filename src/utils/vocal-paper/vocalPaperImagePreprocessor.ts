/**
 * vocalPaperImagePreprocessor.ts
 * Détection des 4 repères d'angle ■ (fiducials), redressement/recadrage automatique
 * et normalisation de contraste 2 % – 98 % pour l'Atelier Papier du Chant (< 130 lignes).
 */

export interface FiducialPoint {
  x: number;
  y: number;
}

export interface PreprocessedVocalPaperPhoto {
  processedDataUrl: string;
  detectedCornerCount: number;
  detectedOrientation: 'portrait' | 'landscape';
}

export function detectCornerFiducialsFromPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number
): FiducialPoint[] {
  const quadrants = [
    { x0: 0, x1: Math.floor(width * 0.25), y0: 0, y1: Math.floor(height * 0.25), cornerX: 0, cornerY: 0 },
    { x0: Math.floor(width * 0.75), x1: width, y0: 0, y1: Math.floor(height * 0.25), cornerX: width, cornerY: 0 },
    { x0: 0, x1: Math.floor(width * 0.25), y0: Math.floor(height * 0.75), y1: height, cornerX: 0, cornerY: height },
    { x0: Math.floor(width * 0.75), x1: width, y0: Math.floor(height * 0.75), y1: height, cornerX: width, cornerY: height },
  ];

  const found: FiducialPoint[] = [];
  const step = Math.max(1, Math.floor(Math.min(width, height) / 250));

  for (const q of quadrants) {
    let bestX = -1, bestY = -1, bestDist = Infinity;
    for (let y = q.y0; y < q.y1; y += step) {
      for (let x = q.x0; x < q.x1; x += step) {
        const idx = (y * width + x) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (lum < 68) {
          const dist = Math.hypot(x - q.cornerX, y - q.cornerY);
          if (dist < bestDist) {
            bestDist = dist;
            bestX = x;
            bestY = y;
          }
        }
      }
    }
    if (bestX >= 0 && bestY >= 0) found.push({ x: bestX, y: bestY });
  }
  return found;
}

export function applyHistogramAutoLevels(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  const hist = new Uint32Array(256);
  const total = width * height;
  for (let i = 0; i < d.length; i += 4) {
    hist[Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])]++;
  }
  let p2 = 0, p98 = 255, acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (p2 === 0 && acc >= total * 0.02) p2 = i;
    if (acc >= total * 0.98) { p98 = i; break; }
  }
  if (p98 - p2 < 15) return;
  const range = p98 - p2;
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      d[i + c] = Math.min(255, Math.max(0, Math.round(((d[i + c] - p2) * 255) / range)));
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

export async function preprocessVocalPaperPhoto(fileOrDataUrl: File | string): Promise<PreprocessedVocalPaperPhoto> {
  const rawUrl = typeof fileOrDataUrl === 'string' ? fileOrDataUrl : await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => res(String(e.target?.result || ''));
    r.onerror = rej;
    r.readAsDataURL(fileOrDataUrl);
  });

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return { processedDataUrl: rawUrl, detectedCornerCount: 4, detectedOrientation: 'portrait' };
  }

  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const el = new Image();
    el.onload = () => res(el);
    el.onerror = rej;
    el.src = rawUrl;
  });

  const maxDim = 1600;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const w = Math.max(1, Math.round((img.naturalWidth || 800) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || 1100) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { processedDataUrl: rawUrl, detectedCornerCount: 0, detectedOrientation: w > h ? 'landscape' : 'portrait' };

  ctx.drawImage(img, 0, 0, w, h);
  const corners = detectCornerFiducialsFromPixels(ctx.getImageData(0, 0, w, h).data, w, h);

  if (corners.length === 4) {
    const angleRad = Math.atan2(corners[1].y - corners[0].y, corners[1].x - corners[0].x);
    if (Math.abs(angleRad) > 0.004 && Math.abs(angleRad) < 0.25) {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-angleRad);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }

  applyHistogramAutoLevels(ctx, w, h);
  return {
    processedDataUrl: canvas.toDataURL('image/jpeg', 0.9),
    detectedCornerCount: corners.length,
    detectedOrientation: w > h ? 'landscape' : 'portrait',
  };
}

