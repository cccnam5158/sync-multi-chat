/**
 * Auto Updater Module for Sync Multi Chat
 * 
 * Uses electron-updater with GitHub Releases as the update server.
 * Provides user-controlled update flow with download confirmation.
 */

const { autoUpdater } = require('electron-updater');
const { dialog, ipcMain, BrowserWindow, app } = require('electron');
const log = require('electron-log');
const os = require('os');

// Configure logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// Disable auto download - let user decide
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Reference to main window for sending IPC messages
let mainWindowRef = null;

// Progress window for download status
let progressWindow = null;

/**
 * Get current platform info for logging and user display
 */
function getPlatformInfo() {
  const platform = process.platform; // darwin, win32, linux
  const arch = process.arch;         // x64, arm64
  const platformName = platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : 'Linux';
  const archName = arch === 'arm64' ? 'Apple Silicon' : arch === 'x64' ? 'Intel (x64)' : arch;
  return { platform, arch, platformName, archName };
}

/**
 * Determine if an update error is due to missing platform release
 */
function isMissingPlatformRelease(err) {
  const msg = (err.message || '').toLowerCase();
  return msg.includes('cannot find')
    || msg.includes('no published versions')
    || msg.includes('404')
    || msg.includes('net::err')
    || msg.includes('enotfound')
    || msg.includes('cannot download')
    || (msg.includes('latest') && msg.includes('not found'));
}

/**
 * Initialize the auto updater with event handlers
 * @param {BrowserWindow} mainWindow - The main application window
 */
function initAutoUpdater(mainWindow) {
  mainWindowRef = mainWindow;

  // Checking for update
  autoUpdater.on('checking-for-update', () => {
    log.info('[Updater] Checking for updates...');
    sendStatusToRenderer({ status: 'checking', message: 'Checking for updates...' });
  });

  // Update available
  autoUpdater.on('update-available', (info) => {
    log.info('[Updater] Update available:', info.version);
    sendStatusToRenderer({ 
      status: 'available', 
      version: info.version,
      message: `New version ${info.version} is available.`
    });

    // Show update dialog
    showUpdateAvailableDialog(info);
  });

  // No update available (already on latest version)
  autoUpdater.on('update-not-available', (info) => {
    log.info('[Updater] Already on latest version:', info.version);
    sendStatusToRenderer({ 
      status: 'latest', 
      version: info.version,
      message: 'You are using the latest version.'
    });
  });

  // Download progress
  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.round(progressObj.percent);
    const speed = (progressObj.bytesPerSecond / 1024 / 1024).toFixed(2);
    const transferred = (progressObj.transferred / 1024 / 1024).toFixed(2);
    const total = (progressObj.total / 1024 / 1024).toFixed(2);
    
    log.info(`[Updater] Download progress: ${percent}% (${transferred}MB / ${total}MB @ ${speed}MB/s)`);
    
    // Update progress window
    const statusText = `${percent}% (${transferred}MB / ${total}MB) - ${speed}MB/s`;
    updateDownloadProgress(percent, statusText);
    
    sendStatusToRenderer({ 
      status: 'downloading', 
      percent,
      speed,
      transferred,
      total,
      message: `Downloading: ${percent}%`
    });
  });

  // Update downloaded
  autoUpdater.on('update-downloaded', (info) => {
    log.info('[Updater] Update downloaded:', info.version);
    sendStatusToRenderer({ 
      status: 'downloaded', 
      version: info.version,
      message: 'Update download complete'
    });

    // Show install dialog
    showUpdateReadyDialog(info);
  });

  // Error handling
  autoUpdater.on('error', (err) => {
    const { platformName, archName } = getPlatformInfo();
    log.error(`[Updater] Error (${platformName} ${archName}):`, err);

    // Close progress window on error
    closeDownloadProgressWindow();

    sendStatusToRenderer({
      status: 'error',
      error: err.message,
      message: `업데이트 확인 실패`
    });

    // Show user-friendly notification instead of alarming error dialog
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      if (isMissingPlatformRelease(err)) {
        // Platform-specific release not yet available — not a real error
        log.info(`[Updater] No ${platformName} (${archName}) release found — skipping update`);
        dialog.showMessageBox(mainWindowRef, {
          type: 'info',
          title: 'Update',
          message: `Currently running the latest available version.`,
          detail: `No update for ${platformName} (${archName}) has been published yet.\nYou can continue using the app without any issues.\n\nVersion: ${app.getVersion()}`,
          buttons: ['OK'],
          noLink: true
        });
      } else {
        // Genuine error (network issue, etc.)
        dialog.showMessageBox(mainWindowRef, {
          type: 'warning',
          title: 'Update Check Failed',
          message: `Could not check for updates.`,
          detail: `The app will continue to work normally.\nYou can try again later or check manually.\n\nReason: ${err.message}`,
          buttons: ['OK'],
          noLink: true
        });
      }
    }
  });

  // Register IPC handlers
  registerIpcHandlers();
}

/**
 * Send update status to renderer process
 * @param {Object} data - Status data to send
 */
function sendStatusToRenderer(data) {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send('update-status', data);
  }
}

/**
 * Strip all HTML tags and convert to plain text
 * @param {string} html - HTML string to clean
 * @returns {string} Plain text
 */
function stripHtmlTags(html) {
  if (!html || typeof html !== 'string') return '';
  
  return html
    // Remove opening/closing p tags (they add unwanted newlines)
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '\n')
    // Convert br to single newline
    .replace(/<br\s*\/?>/gi, '\n')
    // Convert other block elements to newlines
    .replace(/<\/?(div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<\/?(ul|ol|table|tbody|thead)>/gi, '')
    // Remove all other HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode common HTML entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    // Clean up whitespace - reduce multiple newlines to single
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n /g, '\n')
    .trim();
}

/**
 * Show dialog when update is available
 * @param {Object} info - Update info from electron-updater
 */
async function showUpdateAvailableDialog(info) {
  log.info('[Updater] showUpdateAvailableDialog called with version:', info.version);
  
  if (!mainWindowRef || mainWindowRef.isDestroyed()) {
    log.warn('[Updater] Cannot show dialog: mainWindow is null or destroyed');
    return;
  }

  const releaseNotes = typeof info.releaseNotes === 'string' 
    ? info.releaseNotes 
    : info.releaseNotes?.map(note => note.note || note).join('\n') || '';

  log.info('[Updater] Release notes length:', releaseNotes.length);
  
  // Remove HTML tags from release notes for plain text display
  const cleanReleaseNotes = stripHtmlTags(releaseNotes);
  
  log.info('[Updater] Clean release notes preview:', cleanReleaseNotes.substring(0, 100));
  log.info('[Updater] Showing update dialog...');

  const { platformName, archName } = getPlatformInfo();
  const result = await dialog.showMessageBox(mainWindowRef, {
    type: 'info',
    title: 'Update Available',
    message: `A new version is available!`,
    detail: `Current: ${app.getVersion()} (${platformName} ${archName})\nNew: ${info.version}\n\n${cleanReleaseNotes ? 'Changes:\n' + cleanReleaseNotes.substring(0, 500) : 'Would you like to download the update?'}`,
    buttons: ['Update Now', 'Later'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  });

  if (result.response === 0) {
    log.info('[Updater] User chose to download update');
    showDownloadProgressWindow();
    autoUpdater.downloadUpdate();
  } else {
    log.info('[Updater] User postponed update');
  }
}

/**
 * Create and show download progress window
 */
function showDownloadProgressWindow() {
  if (progressWindow && !progressWindow.isDestroyed()) {
    progressWindow.focus();
    return;
  }

  progressWindow = new BrowserWindow({
    width: 400,
    height: 150,
    parent: mainWindowRef,
    modal: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    frame: false,
    transparent: false,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #1a1a2e;
          color: #eee;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100vh;
          padding: 20px;
          -webkit-app-region: drag;
        }
        h3 { margin-bottom: 15px; font-weight: 500; }
        .progress-container {
          width: 100%;
          height: 8px;
          background: #333;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 10px;
        }
        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #6366f1, #8b5cf6);
          width: 0%;
          transition: width 0.3s ease;
        }
        .status {
          font-size: 13px;
          color: #aaa;
        }
      </style>
    </head>
    <body>
      <h3>Downloading update...</h3>
      <div class="progress-container">
        <div class="progress-bar" id="progressBar"></div>
      </div>
      <div class="status" id="status">Preparing...</div>
    </body>
    </html>
  `;

  progressWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
  progressWindow.center();
}

/**
 * Update download progress in progress window
 * @param {number} percent - Download percentage
 * @param {string} status - Status message
 */
function updateDownloadProgress(percent, status) {
  if (progressWindow && !progressWindow.isDestroyed()) {
    progressWindow.webContents.executeJavaScript(`
      document.getElementById('progressBar').style.width = '${percent}%';
      document.getElementById('status').textContent = '${status}';
    `).catch(() => {});
  }
  
  // Also update taskbar progress
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.setProgressBar(percent / 100);
  }
}

/**
 * Close download progress window
 */
function closeDownloadProgressWindow() {
  if (progressWindow && !progressWindow.isDestroyed()) {
    progressWindow.close();
    progressWindow = null;
  }
  
  // Reset taskbar progress
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.setProgressBar(-1);
  }
}

/**
 * Show dialog when update is downloaded and ready to install
 * @param {Object} info - Update info from electron-updater
 */
async function showUpdateReadyDialog(info) {
  // Close progress window first
  closeDownloadProgressWindow();
  
  if (!mainWindowRef || mainWindowRef.isDestroyed()) return;

  const result = await dialog.showMessageBox(mainWindowRef, {
    type: 'info',
    title: 'Update Ready',
    message: 'Update has been downloaded.',
    detail: `Version ${info.version} is ready to install.\nRestart the app to apply the update?\n\n(Selecting "Later" will install automatically when you close the app)`,
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  });

  if (result.response === 0) {
    log.info('[Updater] User chose to restart and install');
    // isSilent: false - show installer UI
    // isForceRunAfter: true - restart app after install
    autoUpdater.quitAndInstall(false, true);
  } else {
    log.info('[Updater] User chose to install later (will install on quit)');
  }
}

/**
 * Register IPC handlers for renderer communication
 */
function registerIpcHandlers() {
  // Manual update check from renderer
  ipcMain.handle('check-for-updates', async () => {
    log.info('[Updater] Manual update check requested');
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: result?.updateInfo };
    } catch (error) {
      log.error('[Updater] Manual check failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Download update manually
  ipcMain.handle('download-update', async () => {
    log.info('[Updater] Manual download requested');
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      log.error('[Updater] Manual download failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Install update (quit and install)
  ipcMain.handle('install-update', () => {
    log.info('[Updater] Install requested');
    autoUpdater.quitAndInstall(false, true);
  });

  // Get current version
  ipcMain.handle('get-app-version', () => {
    return require('electron').app.getVersion();
  });
}

/**
 * Check for updates (called on app start)
 */
function checkForUpdates() {
  const { platform, arch, platformName, archName } = getPlatformInfo();
  log.info(`[Updater] Starting update check... (${platformName} ${archName})`);
  log.info('[Updater] Current version:', app.getVersion());
  log.info(`[Updater] Platform: ${platform}, Arch: ${arch}`);

  autoUpdater.checkForUpdates()
    .then((result) => {
      if (result) {
        log.info('[Updater] Check result:', JSON.stringify({
          version: result.updateInfo?.version,
          releaseDate: result.updateInfo?.releaseDate,
          files: result.updateInfo?.files?.length
        }));
      }
    })
    .catch((err) => {
      log.error(`[Updater] Failed to check for updates (${platformName} ${archName}):`, err.message);
    });
}

/**
 * Check for updates silently (no dialogs on error or if up-to-date)
 */
async function checkForUpdatesSilent() {
  log.info('[Updater] Starting silent update check...');
  try {
    const result = await autoUpdater.checkForUpdates();
    if (result?.updateInfo) {
      log.info('[Updater] Silent check found version:', result.updateInfo.version);
    }
    return result;
  } catch (err) {
    log.error('[Updater] Silent check failed:', err);
    return null;
  }
}

module.exports = { 
  initAutoUpdater, 
  checkForUpdates,
  checkForUpdatesSilent
};


