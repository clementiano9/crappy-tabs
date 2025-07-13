// src/popup.js
// Popup script for Tab Navigator extension with analytics

class PopupController {
  constructor() {
    this.init();
  }

  async init() {
    // Track popup opened with app view (provides both popup interaction and $pageview for DAU/WAU)
    globalThis.analytics.trackAppView('popup');

    // Set up event listeners
    this.setupEventListeners();
    
    // Load and display current tab history state
    await this.loadHistoryState();
    
    // Check for available updates
    await this.checkForUpdates();
  }

  setupEventListeners() {
    // Track logo interactions
    document.querySelector('.logo').addEventListener('click', (e) => {
      e.preventDefault();
      globalThis.analytics.trackPopupInteraction('logo_clicked');
    });

    // Update notification event listeners
    const downloadButton = document.getElementById('downloadUpdate');
    const dismissButton = document.getElementById('dismissUpdate');

    if (downloadButton) {
      downloadButton.addEventListener('click', async () => {
        await this.handleUpdateDownload();
      });
    }

    if (dismissButton) {
      dismissButton.addEventListener('click', async () => {
        await this.handleUpdateDismiss();
      });
    }
  }

  async loadHistoryState() {
    try {
      // Get current tab history state from background
      const result = await chrome.storage.local.get(['tabHistory', 'currentIndex']);
      
      if (result.tabHistory && result.tabHistory.length > 0) {
        this.updateTimeline(result.tabHistory, result.currentIndex);
        this.updateCounter(result.tabHistory.length);
        
        // Track history state for analytics
        globalThis.analytics.track('popup_history_displayed', {
          history_length: result.tabHistory.length,
          current_index: result.currentIndex,
          has_back: result.currentIndex > 0,
          has_forward: result.currentIndex < result.tabHistory.length - 1
        });
      }
    } catch (error) {
      console.error('Failed to load history state:', error);
      globalThis.analytics.trackError('popup_load_history_failed', 'loadHistoryState', {
        error_message: error.message
      });
    }
  }

  updateTimeline(history, currentIndex) {
    const markers = document.querySelectorAll('.timeline-marker');
    const totalMarkers = markers.length;
    
    // Clear existing classes
    markers.forEach(marker => {
      marker.classList.remove('past', 'current', 'future', 'available');
      marker.innerHTML = '';
    });

    // Set current marker (always in the middle)
    const currentMarkerIndex = Math.floor(totalMarkers / 2);
    markers[currentMarkerIndex].classList.add('current');
    markers[currentMarkerIndex].innerHTML = '<i class=\"ri-focus-2-line\"></i>';

    // Set past markers
    for (let i = 0; i < currentMarkerIndex; i++) {
      const historyIndex = currentIndex - (currentMarkerIndex - i);
      if (historyIndex >= 0) {
        markers[i].classList.add('past', 'available');
        markers[i].title = `${currentMarkerIndex - i} positions back`;
      }
    }

    // Set future markers
    for (let i = currentMarkerIndex + 1; i < totalMarkers; i++) {
      const historyIndex = currentIndex + (i - currentMarkerIndex);
      if (historyIndex < history.length) {
        markers[i].classList.add('future', 'available');
        markers[i].title = `${i - currentMarkerIndex} positions forward`;
      } else {
        markers[i].classList.add('future');
        markers[i].title = 'No more forward positions';
      }
    }
  }

  updateCounter(totalTabs) {
    const counter = document.querySelector('.timeline-counter');
    if (counter) {
      counter.textContent = `${totalTabs} tabs in history`;
    }
  }

  triggerNavigation(command) {
    // Send message to background script to perform navigation
    chrome.runtime.sendMessage({
      action: 'navigate',
      command: command
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Navigation failed:', chrome.runtime.lastError);
        globalThis.analytics.trackError('popup_navigation_failed', 'triggerNavigation', {
          command: command,
          error_message: chrome.runtime.lastError.message
        });
      } else {
        globalThis.analytics.trackPopupInteraction('navigation_triggered', {
          command: command,
          success: true
        });
      }
    });
  }

  showSuccessIndicator() {
    const indicator = document.getElementById('successIndicator');
    if (indicator) {
      indicator.classList.add('show');
      setTimeout(() => {
        indicator.classList.remove('show');
      }, 2000);
      
      globalThis.analytics.trackPopupInteraction('success_indicator_shown');
    }
  }

  async checkForUpdates() {
    try {
      console.log('Popup: Requesting update status from background...');
      
      // Get update status from background script
      chrome.runtime.sendMessage({ action: 'getUpdateStatus' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to get update status:', chrome.runtime.lastError);
          return;
        }

        console.log('Popup: Received update status response:', response);

        // Check if response is valid
        if (!response || typeof response !== 'object') {
          console.error('Invalid response from background script:', response);
          return;
        }

        // Check for error in response
        if (response.error) {
          console.error('Background script returned error:', response.error);
          return;
        }

        // Check if update is available
        if (response.hasUpdate && response.version) {
          console.log('Popup: Update available, showing banner for version:', response.version);
          this.showUpdateBanner(response.version, response.downloadUrl);
          
          // Track update banner shown
          globalThis.analytics.trackPopupInteraction('update_banner_shown', {
            version: response.version
          });
        } else {
          console.log('Popup: No updates available');
        }
      });
    } catch (error) {
      console.error('Failed to check for updates:', error);
      globalThis.analytics.trackError('popup_update_check_failed', 'checkForUpdates', {
        error_message: error.message
      });
    }
  }

  showUpdateBanner(version, downloadUrl) {
    const banner = document.getElementById('updateBanner');
    const versionSpan = document.getElementById('updateVersion');
    
    if (banner && versionSpan) {
      versionSpan.textContent = version;
      banner.classList.remove('hidden');
      banner.dataset.downloadUrl = downloadUrl;
    }
  }

  hideUpdateBanner() {
    const banner = document.getElementById('updateBanner');
    if (banner) {
      banner.classList.add('hidden');
    }
  }

  async handleUpdateDownload() {
    try {
      const banner = document.getElementById('updateBanner');
      const downloadUrl = banner?.dataset.downloadUrl;
      
      if (downloadUrl) {
        // Open download page in new tab
        await chrome.tabs.create({ url: downloadUrl });
        
        // Track download initiated
        globalThis.analytics.trackPopupInteraction('update_download_clicked', {
          download_url: downloadUrl
        });
        
        // Dismiss the update notification
        await this.handleUpdateDismiss();
        
        // Close popup
        window.close();
      }
    } catch (error) {
      console.error('Failed to handle update download:', error);
      globalThis.analytics.trackError('popup_update_download_failed', 'handleUpdateDownload', {
        error_message: error.message
      });
    }
  }

  async handleUpdateDismiss() {
    try {
      // Send dismiss message to background script
      chrome.runtime.sendMessage({ action: 'dismissUpdate' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to dismiss update:', chrome.runtime.lastError);
          return;
        }
        
        if (response && response.success) {
          this.hideUpdateBanner();
          
          // Track dismissal
          globalThis.analytics.trackPopupInteraction('update_dismissed');
        }
      });
    } catch (error) {
      console.error('Failed to dismiss update:', error);
      globalThis.analytics.trackError('popup_update_dismiss_failed', 'handleUpdateDismiss', {
        error_message: error.message
      });
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});

// Track popup close
window.addEventListener('beforeunload', () => {
  globalThis.analytics.trackPopupInteraction('popup_closed');
});
