/**
 * Update Checker for Tab History Navigator
 * Checks GitHub releases for new versions and manages update notifications
 */

class UpdateChecker {
  constructor() {
    this.githubApiUrl = 'https://api.github.com/repos/clementiano9/crappy-tabs/releases/latest';
    this.storageKey = 'updateChecker';
    this.checkIntervalHours = 24; // Check daily
  }

  /**
   * Get current extension version from manifest
   */
  getCurrentVersion() {
    return chrome.runtime.getManifest().version;
  }

  /**
   * Compare two semantic versions
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }
    
    return 0;
  }

  /**
   * Fetch latest release information from GitHub API
   */
  async fetchLatestRelease() {
    try {
      const response = await fetch(this.githubApiUrl);
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }
      
      const release = await response.json();
      return {
        version: release.tag_name.replace('v', ''), // Remove 'v' prefix
        downloadUrl: release.html_url, // Link to GitHub release page
        releaseNotes: release.body,
        publishedAt: release.published_at,
        assets: release.assets
      };
    } catch (error) {
      console.error('Update check failed:', error);
      return null;
    }
  }

  /**
   * Get stored update check data
   */
  async getStoredData() {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      return result[this.storageKey] || {
        lastCheckTime: 0,
        lastNotifiedVersion: null,
        updateAvailable: false,
        latestRelease: null
      };
    } catch (error) {
      console.error('Failed to get stored update data:', error);
      return {
        lastCheckTime: 0,
        lastNotifiedVersion: null,
        updateAvailable: false,
        latestRelease: null
      };
    }
  }

  /**
   * Store update check data
   */
  async storeData(data) {
    try {
      await chrome.storage.local.set({
        [this.storageKey]: data
      });
    } catch (error) {
      console.error('Failed to store update data:', error);
    }
  }

  /**
   * Check if enough time has passed since last check
   */
  shouldCheckForUpdates(lastCheckTime) {
    const now = Date.now();
    const timeSinceLastCheck = now - lastCheckTime;
    const checkIntervalMs = this.checkIntervalHours * 60 * 60 * 1000;
    
    return timeSinceLastCheck >= checkIntervalMs;
  }

  /**
   * Main update check function
   * Returns: { updateAvailable: boolean, release: object|null }
   */
  async checkForUpdates() {
    const storedData = await this.getStoredData();
    const now = Date.now();
    
    // Check if we should fetch new data
    if (!this.shouldCheckForUpdates(storedData.lastCheckTime)) {
      return {
        updateAvailable: storedData.updateAvailable,
        release: storedData.latestRelease
      };
    }

    // Fetch latest release info
    const latestRelease = await this.fetchLatestRelease();
    if (!latestRelease) {
      // Update last check time even if fetch failed
      await this.storeData({
        ...storedData,
        lastCheckTime: now
      });
      return {
        updateAvailable: false,
        release: null
      };
    }

    // Compare versions
    const currentVersion = this.getCurrentVersion();
    const updateAvailable = this.compareVersions(latestRelease.version, currentVersion) > 0;

    // Store updated data
    const newData = {
      lastCheckTime: now,
      lastNotifiedVersion: storedData.lastNotifiedVersion,
      updateAvailable: updateAvailable,
      latestRelease: updateAvailable ? latestRelease : null
    };

    await this.storeData(newData);

    return {
      updateAvailable: updateAvailable,
      release: updateAvailable ? latestRelease : null
    };
  }

  /**
   * Check if user should be notified about this version
   */
  async shouldNotifyUser(version) {
    const storedData = await this.getStoredData();
    return storedData.lastNotifiedVersion !== version;
  }

  /**
   * Mark version as notified to user
   */
  async markVersionNotified(version) {
    const storedData = await this.getStoredData();
    await this.storeData({
      ...storedData,
      lastNotifiedVersion: version
    });
  }

  /**
   * Get update status for UI display
   */
  async getUpdateStatus() {
    const result = await this.checkForUpdates();
    if (!result.updateAvailable) {
      return { hasUpdate: false };
    }

    const shouldNotify = await this.shouldNotifyUser(result.release.version);
    
    return {
      hasUpdate: true,
      version: result.release.version,
      downloadUrl: result.release.downloadUrl,
      releaseNotes: result.release.releaseNotes,
      shouldNotify: shouldNotify
    };
  }

  /**
   * Force immediate update check (for testing or manual refresh)
   */
  async forceUpdateCheck() {
    // Reset last check time to force new check
    const storedData = await this.getStoredData();
    await this.storeData({
      ...storedData,
      lastCheckTime: 0
    });
    
    return await this.checkForUpdates();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UpdateChecker;
}