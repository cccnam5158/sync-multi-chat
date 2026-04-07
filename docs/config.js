/**
 * Configuration for Sync Multi Chat Website
 * Centralized version and download information
 */

const SMC_CONFIG = {
    // Current version
    version: 'v0.10.1',

    // Release date
    releaseDate: '2026-04-07',

    // Download URLs (artifact names follow package.json electron-builder artifactName)
    downloads: {
        windows: {
            installer:
                'https://github.com/cccnam5158/sync-multi-chat/releases/download/v0.10.1/Sync-Multi-Chat-Setup-0.10.1-x64.exe',
        },
        macos: {
            intelDmg:
                'https://github.com/cccnam5158/sync-multi-chat/releases/download/v0.10.1/Sync-Multi-Chat-Setup-0.10.1-x64.dmg',
            arm64Dmg:
                'https://github.com/cccnam5158/sync-multi-chat/releases/download/v0.10.1/Sync-Multi-Chat-Setup-0.10.1-arm64.dmg',
        },
        linux: null,
    },

    // GitHub repository
    github: {
        url: 'https://github.com/cccnam5158/sync-multi-chat',
        releases: 'https://github.com/cccnam5158/sync-multi-chat/releases',
    },
};

/**
 * Apply version information to all elements with data-version attribute
 */
function applyVersionInfo() {
    // Update version badges in navigation
    document.querySelectorAll('.nav-logo span[style*="border"]').forEach((el) => {
        el.textContent = SMC_CONFIG.version;
    });

    // Update elements with data-version attribute
    document.querySelectorAll('[data-version]').forEach((el) => {
        el.textContent = SMC_CONFIG.version;
    });

    // Update download links
    document.querySelectorAll('[data-download="windows-installer"]').forEach((el) => {
        if (SMC_CONFIG.downloads.windows.installer) {
            el.href = SMC_CONFIG.downloads.windows.installer;
            el.removeAttribute('disabled');
        }
    });

    document.querySelectorAll('[data-download="mac-dmg-intel"]').forEach((el) => {
        if (SMC_CONFIG.downloads.macos?.intelDmg) {
            el.href = SMC_CONFIG.downloads.macos.intelDmg;
            el.removeAttribute('disabled');
        }
    });

    document.querySelectorAll('[data-download="mac-dmg-arm64"]').forEach((el) => {
        if (SMC_CONFIG.downloads.macos?.arm64Dmg) {
            el.href = SMC_CONFIG.downloads.macos.arm64Dmg;
            el.removeAttribute('disabled');
        }
    });

    // Update version description text (e.g., "v0.5.13 | Installer & Auto-update")
    document.querySelectorAll('[data-version-desc]').forEach((el) => {
        const descType = el.getAttribute('data-version-desc');
        if (descType === 'windows') {
            el.setAttribute('data-i18n', 'download.windowsDesc');
            // Will be translated by i18n system
        }
    });
}

/**
 * Initialize config
 */
function initConfig() {
    applyVersionInfo();
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConfig);
} else {
    initConfig();
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SMC_CONFIG;
}
