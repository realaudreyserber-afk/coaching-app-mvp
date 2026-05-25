import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'public', 'icons');
const source = join(iconsDir, 'icon-source.png');

if (!existsSync(source)) {
  console.error(`Source missing: ${source}`);
  console.error('Drop a 1024x1024 PNG at this path and re-run.');
  process.exit(1);
}

const sizes = [192, 512];
const bg = { r: 10, g: 10, b: 10, alpha: 1 };

const meta = await sharp(source).metadata();
console.log(`source: ${meta.width}x${meta.height} ${meta.format}`);
if (meta.width !== meta.height) {
  console.warn('warning: source is not square — output will be cropped to center');
}

for (const size of sizes) {
  await sharp(source)
    .resize(size, size, { fit: 'cover', position: 'center' })
    .png({ compressionLevel: 9 })
    .toFile(join(iconsDir, `icon-${size}.png`));
  console.log(`ok icon-${size}.png`);

  const innerSize = Math.round(size * 0.8);
  const inner = await sharp(source)
    .resize(innerSize, innerSize, { fit: 'cover', position: 'center' })
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: inner, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(join(iconsDir, `icon-maskable-${size}.png`));
  console.log(`ok icon-maskable-${size}.png`);
}

console.log('done.');
