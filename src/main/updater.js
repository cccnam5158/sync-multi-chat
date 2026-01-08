/**
 * Auto Updater Module for Sync Multi Chat
 * 
 * Uses electron-updater with GitHub Releases as the update server.
 * Provides user-controlled update flow with download confirmation.
 */

const { autoUpdater } = require('electron-updater');
const { dialog, ipcMain, BrowserWindow } = require('electron');
const log = require('electron-log');

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
 * Initialize the auto updater with event handlers
 * @param {BrowserWindow} mainWindow - The main application window
 */
function initAutoUpdater(mainWindow) {
  mainWindowRef = mainWindow;

  // Checking for update
  autoUpdater.on('checking-for-update', () => {
    log.info('[Updater] Checking for updates...');
    sendStatusToRenderer({ status: 'checking', message: '업데이트 확인 중...' });
  });

  // Update available
  autoUpdater.on('update-available', (info) => {
    log.info('[Updater] Update available:', info.version);
    sendStatusToRenderer({ 
      status: 'available', 
      version: info.version,
      message: `새 버전 ${info.version}이 사용 가능합니다.`
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
      message: '최신 버전을 사용 중입니다.'
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
      message: `다운로드 중: ${percent}%`
    });
  });

  // Update downloaded
  autoUpdater.on('update-downloaded', (info) => {
    log.info('[Updater] Update downloaded:', info.version);
    sendStatusToRenderer({ 
      status: 'downloaded', 
      version: info.version,
      message: '업데이트 다운로드 완료'
    });

    // Show install dialog
    showUpdateReadyDialog(info);
  });

  // Error handling
  autoUpdater.on('error', (err) => {
    log.error('[Updater] Error:', err);
    
    // Close progress window on error
    closeDownloadProgressWindow();
    
    sendStatusToRenderer({ 
      status: 'error', 
      error: err.message,
      message: `업데이트 오류: ${err.message}`
    });
    
    // Show error dialog
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      dialog.showMessageBox(mainWindowRef, {
        type: 'error',
        title: '업데이트 오류',
        message: '업데이트 중 오류가 발생했습니다.',
        detail: err.message,
        buttons: ['확인']
      });
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

  const result = await dialog.showMessageBox(mainWindowRef, {
    type: 'info',
    title: '업데이트 가능',
    message: `새 버전이 사용 가능합니다!`,
    detail: `현재 버전: ${require('electron').app.getVersion()}\n새 버전: ${info.version}\n\n${cleanReleaseNotes ? '변경 사항:\n' + cleanReleaseNotes.substring(0, 500) : '업데이트를 다운로드하시겠습니까?'}`,
    buttons: ['지금 업데이트', '나중에'],
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
      <h3>업데이트 다운로드 중...</h3>
      <div class="progress-container">
        <div class="progress-bar" id="progressBar"></div>
      </div>
      <div class="status" id="status">준비 중...</div>
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
    title: '업데이트 준비 완료',
    message: '업데이트가 다운로드되었습니다.',
    detail: `버전 ${info.version}을 설치할 준비가 되었습니다.\n앱을 재시작하여 업데이트를 적용하시겠습니까?\n\n(\"나중에\"를 선택하면 앱 종료 시 자동으로 설치됩니다)`,
    buttons: ['지금 재시작', '나중에'],
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
  log.info('[Updater] Starting update check...');
  log.info('[Updater] Current version:', require('electron').app.getVersion());
  
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
      log.error('[Updater] Failed to check for updates:', err);
      log.error('[Updater] Error details:', err.message, err.stack);
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


