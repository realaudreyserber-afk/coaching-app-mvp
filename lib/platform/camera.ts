/**
 * Camera abstraction for web (PWA) and future Capacitor wrap.
 * Web: <input type="file" capture> + getUserMedia for live preview.
 * Native (TODO Phase 2): @capacitor/camera plugin swap.
 */
import { isNativePlatform } from '@/lib/platform';

export interface CapturedPhoto {
  blob: Blob;
  dataUrl: string;
  width?: number;
  height?: number;
  source: 'camera' | 'gallery';
}

export interface PickPhotoOptions {
  source?: 'camera' | 'gallery';
  quality?: number;
  maxDimension?: number;
}

async function downscaleImage(file: File, maxDim: number, quality: number): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const ratio = width > height ? maxDim / width : maxDim / height;
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Blob conversion failed'))),
      'image/jpeg',
      quality
    );
  });
}

export async function pickPhoto(opts: PickPhotoOptions = {}): Promise<CapturedPhoto> {
  const { source = 'camera', quality = 0.85, maxDimension = 1600 } = opts;

  if (isNativePlatform()) {
    throw new Error('Capacitor camera plugin not wired yet — Phase 2 wrap');
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') input.capture = 'environment';

    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocusBack, true);
      input.onchange = null;
      fn();
    };

    const onFocusBack = () => {
      setTimeout(() => {
        if (!input.files || input.files.length === 0) {
          settle(() => reject(new Error('Sélection annulée.')));
        }
      }, 500);
    };

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        settle(() => reject(new Error('Aucune image sélectionnée.')));
        return;
      }
      try {
        const compressed = await downscaleImage(file, maxDimension, quality);
        const dataUrl = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.onerror = rej;
          r.readAsDataURL(compressed);
        });
        settle(() => resolve({ blob: compressed, dataUrl, source }));
      } catch (err) {
        settle(() => reject(err));
      }
    };

    window.addEventListener('focus', onFocusBack, { capture: true, once: true });
    input.click();
  });
}
