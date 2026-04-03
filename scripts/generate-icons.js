/* eslint-disable no-console */
/**
 * Generates Electron-friendly icons from `assets/sync-multi-chat.svg`.
 *
 * Output (gitignored):
 * - build/icon.png  (256x256)
 * - build/icon-512.png (512x512)
 * - build/icon.ico  (multi-size)
 * - build/icon.icns (macOS, only on darwin)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

  // Generate macOS .icns (only on macOS where iconutil is available)
  if (process.platform === 'darwin') {
    await generateIcns(base, outDir);
  } else {
    console.log('[generate-icons] Skipping .icns generation (not macOS)');
  }

  console.log('[generate-icons] Done:', outDir);
}

async function generateIcns(base, outDir) {
  const iconsetDir = path.join(outDir, 'icon.iconset');
  fs.mkdirSync(iconsetDir, { recursive: true });

  // macOS iconset requires specific sizes: 16, 32, 128, 256, 512 (1x and 2x)
  const iconsetSizes = [
    { name: 'icon_16x16.png', size: 16 },
    { name: 'icon_16x16@2x.png', size: 32 },
    { name: 'icon_32x32.png', size: 32 },
    { name: 'icon_32x32@2x.png', size: 64 },
    { name: 'icon_128x128.png', size: 128 },
    { name: 'icon_128x128@2x.png', size: 256 },
    { name: 'icon_256x256.png', size: 256 },
    { name: 'icon_256x256@2x.png', size: 512 },
    { name: 'icon_512x512.png', size: 512 },
    { name: 'icon_512x512@2x.png', size: 1024 },
  ];

  await Promise.all(
    iconsetSizes.map(({ name, size }) =>
      base
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toFile(path.join(iconsetDir, name))
    )
  );

  const icnsPath = path.join(outDir, 'icon.icns');
  execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`);

  // Clean up iconset directory
  fs.rmSync(iconsetDir, { recursive: true, force: true });
  console.log('[generate-icons] Generated .icns:', icnsPath);
}

main().catch((err) => {
  console.error('[generate-icons] Failed:', err);
  process.exit(1);
});










