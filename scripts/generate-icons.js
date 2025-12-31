/* eslint-disable no-console */
/**
 * Generates Electron-friendly icons from `assets/sync-multi-chat.svg`.
 *
 * Output (gitignored):
 * - build/icon.png  (256x256)
 * - build/icon-512.png (512x512)
 * - build/icon.ico  (multi-size)
 */

const fs = require('fs');
const path = require('path');

async function main() {
  const sharp = require('sharp');
  const toIco = require('to-ico');

  const repoRoot = path.join(__dirname, '..');
  const inputSvgPath = path.join(repoRoot, 'assets', 'sync-multi-chat.svg');
  const outDir = path.join(repoRoot, 'build');

  if (!fs.existsSync(inputSvgPath)) {
    throw new Error(`Input SVG not found: ${inputSvgPath}`);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const svg = fs.readFileSync(inputSvgPath);

  // Increase density so small icons stay crisp.
  const base = sharp(svg, { density: 512 });

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBuffers = await Promise.all(
    sizes.map((size) =>
      base
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer()
    )
  );

  const png256 = pngBuffers[sizes.indexOf(256)];
  fs.writeFileSync(path.join(outDir, 'icon.png'), png256);

  const png512 = await base
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(outDir, 'icon-512.png'), png512);

  const ico = await toIco(pngBuffers);
  fs.writeFileSync(path.join(outDir, 'icon.ico'), ico);

  console.log('[generate-icons] Done:', outDir);
}

main().catch((err) => {
  console.error('[generate-icons] Failed:', err);
  process.exit(1);
});




