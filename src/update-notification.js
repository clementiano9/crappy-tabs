/**
 * Update Notification Manager for Tab History Navigator
 * Handles user notifications about available updates
 */

class UpdateNotificationManager {
  constructor() {
    this.notificationId = 'tab-navigator-update';
    this.badgeStorageKey = 'updateBadge';
  }

  /**
   * Show browser notification about available update
   */
  async showUpdateNotification(version, downloadUrl) {
    try {
      await chrome.notifications.create(this.notificationId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('img/icon48.png'),
        title: 'Tab History Navigator Update Available',
        message: `Version ${version} is now available. Click to download.`,
        buttons: [
          { title: 'Download Update' },
          { title: 'Remind Later' }
        ],
        requireInteraction: true
      });

      // Store the download URL for when user clicks notification
      await chrome.storage.local.set({
        pendingUpdateUrl: downloadUrl,
        pendingUpdateVersion: version
      });

      return true;
    } catch (error) {
      console.error('Failed to show update notification:', error);
      return false;
    }
  }

  /**
   * Set badge on extension icon to indicate update available
   */
  async setBadge(show = true) {
    try {
      if (show) {
        await chrome.action.setBadgeText({ text: '●' });
        await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
        await chrome.action.setTitle({ title: 'Tab History Navigator - Update Available' });
        
        // Store badge state
        await chrome.storage.local.set({
          [this.badgeStorageKey]: true
        });
      } else {
        await chrome.action.setBadgeText({ text: '' });
        await chrome.action.setTitle({ title: 'Tab History Navigator' });
        
        // Clear badge state
        await chrome.storage.local.set({
          [this.badgeStorageKey]: false
        });
      }
    } catch (error) {
      console.error('Failed to set badge:', error);
    }
  }

  /**
   * Clear all update notifications and badges
   */
  async clearNotifications() {
    try {
      // Clear browser notification
      await chrome.notifications.clear(this.notificationId);
      
      // Clear badge
      await this.setBadge(false);
      
      // Clear stored notification data
      await chrome.storage.local.remove(['pendingUpdateUrl', 'pendingUpdateVersion']);
      
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }

  /**
   * Handle notification click events
   */
  setupNotificationHandlers() {
    // Handle notification button clicks
    chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
      if (notificationId !== this.notificationId) return;

      try {
        const result = await chrome.storage.local.get(['pendingUpdateUrl', 'pendingUpdateVersion']);
        
        if (buttonIndex === 0) { // Download Update
          if (result.pendingUpdateUrl) {
            await chrome.tabs.create({ url: result.pendingUpdateUrl });
            await this.clearNotifications();
          }
        } else if (buttonIndex === 1) { // Remind Later
          await chrome.notifications.clear(this.notificationId);
          // Keep badge but clear notification
        }
      } catch (error) {
        console.error('Failed to handle notification click:', error);
      }
    });

    // Handle notification click (main body)
    chrome.notifications.onClicked.addListener(async (notificationId) => {
      if (notificationId !== this.notificationId) return;

      try {
        const result = await chrome.storage.local.get('pendingUpdateUrl');
        if (result.pendingUpdateUrl) {
          await chrome.tabs.create({ url: result.pendingUpdateUrl });
          await this.clearNotifications();
        }
      } catch (error) {
        console.error('Failed to handle notification click:', error);
      }
    });

    // Handle notification close
    chrome.notifications.onClosed.addListener((notificationId, byUser) => {
      if (notificationId === this.notificationId && byUser) {
        // User dismissed notification, but keep badge
        console.log('Update notification dismissed by user');
      }
    });
  }

  /**
   * Check if badge should be shown on startup
   */
  async restoreBadgeState() {
    try {
      const result = await chrome.storage.local.get(this.badgeStorageKey);
      if (result[this.badgeStorageKey]) {
        await this.setBadge(true);
      }
    } catch (error) {
      console.error('Failed to restore badge state:', error);
    }
  }

  /**
   * Get current notification state for popup display
   */
  async getNotificationState() {
    try {
      const result = await chrome.storage.local.get([
        'pendingUpdateUrl', 
        'pendingUpdateVersion',
        this.badgeStorageKey
      ]);
      
      return {
        hasUpdate: !!result.pendingUpdateUrl,
        version: result.pendingUpdateVersion,
        downloadUrl: result.pendingUpdateUrl,
        badgeVisible: result[this.badgeStorageKey] || false
      };
    } catch (error) {
      console.error('Failed to get notification state:', error);
      return {
        hasUpdate: false,
        version: null,
        downloadUrl: null,
        badgeVisible: false
      };
    }
  }

  /**
   * Dismiss update notification (user acknowledged)
   */
  async dismissUpdate() {
    await this.clearNotifications();
  }

  /**
   * Show update in popup instead of notification
   */
  async showInPopup(version, downloadUrl) {
    try {
      await chrome.storage.local.set({
        pendingUpdateUrl: downloadUrl,
        pendingUpdateVersion: version
      });
      
      await this.setBadge(true);
      return true;
    } catch (error) {
      console.error('Failed to show update in popup:', error);
      return false;
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UpdateNotificationManager;
}