/**
 * macOS update path for Sync Multi Chat
 *
 * electron-updater installs macOS updates through Squirrel.Mac, which requires the
 * running app to carry a valid code signature. Our macOS builds are not signed with
 * a Developer ID, so Squirrel fails with "Could not get code signature for running
 * application" (Intel builds have no signature at all; arm64 builds only carry the
 * linker's ad-hoc signature, which cannot validate a newer build either).
 *
 * Instead, download the DMG that matches the running CPU architecture, verify it
 * against the sha512 published in latest-mac.yml, and open it so the user can
 * replace the app in /Applications.
 */

const { net } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const GITHUB_OWNER = 'cccnam5158';
const GITHUB_REPO = 'sync-multi-chat';

function getReleasePageUrl(version) {
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/v${version}`;
}

/**
 * Resolve the DMG asset for the running architecture.
 * @param {string} version - Release version without the leading "v"
 * @param {Array<{url: string, sha512?: string, size?: number}>} files - updateInfo.files
 * @param {string} arch - process.arch
 */
function getMacDmgAsset(version, files = [], arch = process.arch) {
  const dmgArch = arch === 'arm64' ? 'arm64' : 'x64';
  const entry = (files || []).find(
    (f) => f && typeof f.url === 'string' && f.url.endsWith(`-${dmgArch}.dmg`)
  );
  const fileName = entry
    ? path.basename(entry.url)
    : `Sync-Multi-Chat-Setup-${version}-${dmgArch}.dmg`;
  return {
    arch: dmgArch,
    fileName,
    url: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${version}/${fileName}`,
    sha512: entry && entry.sha512 ? entry.sha512 : null,
    size: entry && entry.size ? entry.size : 0,
  };
}

/**
 * Download a file with progress reporting and optional sha512 (base64) verification.
 * Writes to "<destPath>.part" first and renames on success.
 * @returns {Promise<string>} destPath
 */
function downloadFile(url, destPath, { sha512 = null, expectedSize = 0, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const tempPath = `${destPath}.part`;
    const hash = crypto.createHash('sha512');
    let settled = false;
    let file = null;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      if (file) file.destroy();
      fs.promises.rm(tempPath, { force: true })
        .catch(() => {})
        .finally(() => reject(err));
    };

    const request = net.request({ url, redirect: 'follow' });

    request.on('response', (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        fail(new Error(`Download failed with HTTP ${response.statusCode}`));
        return;
      }

      const headerLength = Number(response.headers['content-length']);
      const total = Number.isFinite(headerLength) && headerLength > 0 ? headerLength : expectedSize;
      let transferred = 0;
      const startedAt = Date.now();

      file = fs.createWriteStream(tempPath);
      file.on('error', fail);

      response.on('data', (chunk) => {
        hash.update(chunk);
        transferred += chunk.length;
        if (!file.write(chunk)) {
          response.pause();
          file.once('drain', () => response.resume());
        }
        if (onProgress) {
          const elapsedSec = Math.max((Date.now() - startedAt) / 1000, 0.001);
          onProgress({
            percent: total ? (transferred / total) * 100 : 0,
            transferred,
            total,
            bytesPerSecond: transferred / elapsedSec,
          });
        }
      });

      response.on('error', fail);

      response.on('end', () => {
        file.end(async () => {
          if (settled) return;
          try {
            if (sha512) {
              const actual = hash.digest('base64');
              if (actual !== sha512) {
                throw new Error('Downloaded file failed sha512 verification');
              }
            }
            await fs.promises.rename(tempPath, destPath);
            settled = true;
            resolve(destPath);
          } catch (err) {
            fail(err);
          }
        });
      });
    });

    request.on('error', fail);
    request.end();
  });
}

module.exports = {
  getMacDmgAsset,
  getReleasePageUrl,
  downloadFile,
};
