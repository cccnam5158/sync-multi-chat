/**
 * Auto Updater Module for Sync Multi Chat
 * 
 * Uses electron-updater with GitHub Releases as the update server.
 * Provides user-controlled update flow with download confirmation.
 */

const { autoUpdater } = require('electron-updater');
const { dialog, ipcMain } = require('electron');
const log = require('electron-log');

// Configure logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// Disable auto download - let user decide
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Reference to main window for sending IPC messages
let mainWindowRef = null;

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
    sendStatusToRenderer({ 
      status: 'error', 
      error: err.message,
      message: `업데이트 오류: ${err.message}`
    });
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
 * Show dialog when update is available
 * @param {Object} info - Update info from electron-updater
 */
async function showUpdateAvailableDialog(info) {
  if (!mainWindowRef || mainWindowRef.isDestroyed()) return;

  const releaseNotes = typeof info.releaseNotes === 'string' 
    ? info.releaseNotes 
    : info.releaseNotes?.map(note => note.note || note).join('\n') || '';

  // Remove HTML tags from release notes for plain text display
  const cleanReleaseNotes = releaseNotes
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<strong>/gi, '')
    .replace(/<\/strong>/gi, '')
    .replace(/<em>/gi, '')
    .replace(/<\/em>/gi, '')
    .replace(/<[^>]+>/g, '') // Remove any remaining HTML tags
    .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newline
    .trim();

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
    autoUpdater.downloadUpdate();
  } else {
    log.info('[Updater] User postponed update');
  }
}

/**
 * Show dialog when update is downloaded and ready to install
 * @param {Object} info - Update info from electron-updater
 */
async function showUpdateReadyDialog(info) {
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
  autoUpdater.checkForUpdates().catch((err) => {
    log.error('[Updater] Failed to check for updates:', err);
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


