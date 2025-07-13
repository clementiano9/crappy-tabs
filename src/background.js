// background.js
// Service Worker for Manifest V3

// Import analytics and update modules using importScripts for service worker compatibility
importScripts('analytics-config.js');
importScripts('analytics.js');
importScripts('update-checker.js');
importScripts('update-notification.js');

const storage = chrome.storage.local;

let tabHistory = [];
let currentIndex = -1;
const MAX_HISTORY_SIZE = 60;
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Cache of validated tab IDs to reduce API calls
 * Key: tabId, Value: { exists: boolean, timestamp: number }
 */
let tabValidationCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

// Reduce cleanup interval to be less frequent
const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes

// Initialize update system
const updateChecker = new UpdateChecker();
const updateNotificationManager = new UpdateNotificationManager();

/**
 * Event listener for when the extension starts up.
 * Initializes the tab history when the extension is started.
 */
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started');
  globalThis.analytics.track('extension_startup');
  globalThis.analytics.trackAppView('background_startup');
  initializeTabHistory();
  initializeUpdateSystem();
});

/**
 * Initializes the tab history by retrieving it from storage.
 * If no history exists, it initializes with the current active tab.
 */
function initializeTabHistory() {
  if (typeof storage === 'undefined') {
    console.error('Storage is not available');
    return;
  }
  
  storage.get(['tabHistory', 'currentIndex'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('Error accessing storage:', chrome.runtime.lastError);
      globalThis.analytics.trackError('storage_access_failed', 'initializeTabHistory', {
        error: chrome.runtime.lastError.message
      });
      return;
    }
    
    if (result.tabHistory && result.tabHistory.length > 0) {
      tabHistory = result.tabHistory;
      currentIndex = result.currentIndex;
      console.log('Loaded tab history from storage:', tabHistory);
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          const currentTabId = tabs[0].id;
          tabHistory = [currentTabId];
          currentIndex = 0;
          saveState();
          console.log('Initialized tab history with current tab:', currentTabId);
        }
      });
    }
  });
}

/**
 * Saves the current state of tab history and index to storage.
 * This method is called whenever the tab history is modified.
 */
function saveState() {
  if (typeof storage === 'undefined') {
    console.error('Storage is not available');
    return;
  }
  
  storage.set({ tabHistory, currentIndex }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error saving state:', chrome.runtime.lastError);
      globalThis.analytics.trackError('storage_save_failed', 'saveState', {
        error: chrome.runtime.lastError.message,
        history_length: tabHistory.length
      });
    } else {
      console.log('State saved to storage');
    }
  });
}

/**
 * Event listener for when the extension is installed.
 * Initializes the tab history when the extension is installed.
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Tab History Navigator installed');
  globalThis.analytics.trackInstall(details.reason, details.previousVersion);
  initializeTabHistory();
  initializeUpdateSystem();
});

/**
 * Event listener for when the extension is about to be suspended.
 * Performs cleanup or state-saving operations.
 */
chrome.runtime.onSuspend.addListener(() => {
  console.log('Extension is about to be suspended');
  // Perform any cleanup or state-saving operations here
});

/**
 * Event listener for when a tab is activated.
 * Handles the activation of a tab and updates the tab history.
 */
chrome.tabs.onActivated.addListener((activeInfo) => {
  storage.get(['tabHistory', 'currentIndex'], (result) => {
    if (!tabHistory.length && result.tabHistory && result.tabHistory.length) {
      // Service worker was terminated, recover the history
      tabHistory = result.tabHistory;
      currentIndex = result.currentIndex;
      console.log('Recovered tab history from storage:', tabHistory);
    }

    // Log initial state
    console.log('=== Tab Activation ===');
    console.log('Activated tab:', activeInfo.tabId);
    console.log('Current history:', JSON.stringify(tabHistory));
    console.log('Current index:', currentIndex);

    const existingIndex = tabHistory.indexOf(activeInfo.tabId);
    console.log('Tab exists in history at index:', existingIndex);
    
    if (existingIndex === -1) {
      console.log('New tab - adding to end of history');
      // New tab not in history - add to end
      if (tabHistory.length >= MAX_HISTORY_SIZE) {
        console.log('History full - removing oldest tab:', tabHistory[0]);
        tabHistory.shift();
      }
      tabHistory.push(activeInfo.tabId);
      currentIndex = tabHistory.length - 1;
    } else {
      // Tab exists in history
      if (currentIndex === tabHistory.length - 1) {
        console.log('At end of history - moving existing tab to end');
        // At end of history - move tab to end
        tabHistory.splice(existingIndex, 1);
        tabHistory.push(activeInfo.tabId);
        currentIndex = tabHistory.length - 1;
      } else {
        console.log('In middle of history - updating currentIndex only');
        // In middle of history - just update currentIndex
        currentIndex = existingIndex;
      }
    }
    
    console.log('=== Final State ===');
    console.log('Updated history:', JSON.stringify(tabHistory));
    console.log('New current index:', currentIndex);
    console.log('==================');
    saveState();
  });
});

/**
 * Event listener for when a tab is removed.
 * Removes the tab from the history when it is closed.
 */
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // When a tab is removed, remove it from the history
  const index = tabHistory.indexOf(tabId);
  if (index > -1) {
    // Remove the tab from history
    tabHistory.splice(index, 1);
    
    // Adjust currentIndex based on removal position
    if (index < currentIndex) {
      // If removed tab was before current, decrease currentIndex
      currentIndex--;
    } else if (index === currentIndex) {
      // If removed tab was current, move to previous tab
      currentIndex = Math.max(currentIndex - 1, tabHistory.length - 1);
    }
    
    // If history is empty, reset currentIndex
    if (tabHistory.length === 0) {
      currentIndex = -1;
    }
    
    console.log('Removed tab from history:', tabId);
    console.log('Updated tab history:', tabHistory);
    console.log('New current index:', currentIndex);
    saveState();
  }
});

/**
 * Validates if a tab exists in Chrome with caching
 * @param {number} tabId - The ID of the tab to check
 * @returns {Promise<boolean>} - True if tab exists, false otherwise
 */
async function tabExists(tabId) {
  const now = Date.now();
  const cached = tabValidationCache.get(tabId);
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.exists;
  }
  
  try {
    await chrome.tabs.get(tabId);
    tabValidationCache.set(tabId, { exists: true, timestamp: now });
    return true;
  } catch (e) {
    tabValidationCache.set(tabId, { exists: false, timestamp: now });
    return false;
  }
}

/**
 * Cleans up non-existent tabs from history
 * @returns {Promise<void>}
 */
async function cleanupNonExistentTabs() {
  // Skip cleanup if no changes likely needed
  if (tabHistory.length === 0) return;
  
  // Batch validate all tabs at once
  const validationPromises = tabHistory.map(tabId => tabExists(tabId));
  const validationResults = await Promise.all(validationPromises);
  
  const validTabs = tabHistory.filter((_, index) => validationResults[index]);
  
  // Only update if changes needed
  if (validTabs.length !== tabHistory.length) {
    const oldCurrentTab = tabHistory[currentIndex];
    const removedCount = tabHistory.length - validTabs.length;
    
    tabHistory = validTabs;
    currentIndex = Math.max(0, tabHistory.indexOf(oldCurrentTab));
    if (tabHistory.length === 0) currentIndex = -1;
    
    console.log('Cleaned up history:', tabHistory, 'new currentIndex:', currentIndex);
    saveState();
    
    // Track cleanup analytics
    globalThis.analytics.trackHistoryCleanup(removedCount, validTabs.length);
  }
}

/**
 * Listener for command events triggered by keyboard shortcuts.
 * This method handles navigation through the tab history based on user commands.
 * 
 * Supported commands:
 * - "go-back": Navigates to the previous tab in the history.
 * - "go-forward": Navigates to the next tab in the history.
 * 
 * It also recovers the tab history if the service worker was terminated.
 */
chrome.commands.onCommand.addListener(async (command) => {
  const startTime = globalThis.analytics.trackNavigation(command === 'go-back' ? 'back' : 'forward', {
    tab_count: tabHistory.length,
    current_index: currentIndex
  });
  
  storage.get(['tabHistory', 'currentIndex'], async (result) => {
    if (!tabHistory.length && result.tabHistory && result.tabHistory.length) {
      tabHistory = result.tabHistory;
      currentIndex = result.currentIndex;
      console.log('Recovered tab history from storage:', tabHistory);
    }

    if (tabHistory.length === 0) {
      console.log('History empty - reinitializing');
      initializeTabHistory();
      return;
    }

    console.log('=== Navigation Command ===');
    console.log('Command:', command);
    console.log('Current history:', JSON.stringify(tabHistory));
    console.log('Current index:', currentIndex);

    // Only clean up if we haven't done so recently
    const lastCleanupResult = await storage.get('lastCleanupTime');
    const now = Date.now();
    if (!lastCleanupResult.lastCleanupTime || (now - lastCleanupResult.lastCleanupTime) > CLEANUP_INTERVAL) {
      await cleanupNonExistentTabs();
      storage.set({ lastCleanupTime: now });
    }

    if (command === "go-back") {
      if (currentIndex > 0) {
        console.log('Moving back from index', currentIndex, 'to', currentIndex - 1);
        let targetIndex = currentIndex - 1;
        let navigationSuccess = false;
        
        // Use cached validation when possible
        while (targetIndex >= 0) {
          if (await tabExists(tabHistory[targetIndex])) {
            currentIndex = targetIndex;
            await chrome.tabs.update(tabHistory[currentIndex], { active: true });
            navigationSuccess = true;
            break;
          }
          targetIndex--;
        }
        
        if (targetIndex < 0) {
          console.log('No valid tabs found when going back');
          await cleanupNonExistentTabs();
        }
        
        // Track performance and success
        globalThis.analytics.trackPerformance('navigation_back', startTime, {
          success: navigationSuccess,
          target_index: targetIndex,
          tabs_validated: Math.abs(currentIndex - targetIndex)
        });
        
        globalThis.analytics.trackKeyboardShortcut('go-back', navigationSuccess, {
          history_length: tabHistory.length,
          starting_index: currentIndex + (navigationSuccess ? 1 : 0)
        });
      } else {
        console.log('Already at start of history');
        globalThis.analytics.trackKeyboardShortcut('go-back', false, {
          reason: 'at_start_of_history',
          history_length: tabHistory.length
        });
      }
    } else if (command === "go-forward") {
      if (currentIndex < tabHistory.length - 1) {
        console.log('Moving forward from index', currentIndex, 'to', currentIndex + 1);
        let targetIndex = currentIndex + 1;
        let navigationSuccess = false;
        
        // Use cached validation when possible
        while (targetIndex < tabHistory.length) {
          if (await tabExists(tabHistory[targetIndex])) {
            currentIndex = targetIndex;
            await chrome.tabs.update(tabHistory[currentIndex], { active: true });
            navigationSuccess = true;
            break;
          }
          targetIndex++;
        }
        
        if (targetIndex >= tabHistory.length) {
          console.log('No valid tabs found when going forward');
          await cleanupNonExistentTabs();
        }
        
        // Track performance and success
        globalThis.analytics.trackPerformance('navigation_forward', startTime, {
          success: navigationSuccess,
          target_index: targetIndex,
          tabs_validated: targetIndex - currentIndex
        });
        
        globalThis.analytics.trackKeyboardShortcut('go-forward', navigationSuccess, {
          history_length: tabHistory.length,
          starting_index: currentIndex - (navigationSuccess ? 1 : 0)
        });
      } else {
        console.log('Already at end of history');
        globalThis.analytics.trackKeyboardShortcut('go-forward', false, {
          reason: 'at_end_of_history',
          history_length: tabHistory.length
        });
      }
    }

    console.log('=== Final State ===');
    console.log('History:', JSON.stringify(tabHistory));
    console.log('New current index:', currentIndex);
    console.log('==================');
    saveState();
  });
});

/**
 * Clears the tab history and resets the current index.
 * This method is called when the user requests to clear the history.
 */
function clearTabHistory() {
  const previousLength = tabHistory.length;
  tabHistory = [];
  currentIndex = -1;
  saveState();
  console.log('Tab history cleared');
  
  // Track history clearing
  globalThis.analytics.track('history_cleared', {
    previous_length: previousLength,
    cleared_timestamp: Date.now()
  });
}

/**
 * Event listener for messages from the popup.
 * Handles the clearing of the tab history and navigation requests.
 */
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "clearHistory") {
    clearTabHistory();
    sendResponse({message: "History cleared successfully"});
  } else if (request.action === "navigate") {
    // Handle navigation requests from popup
    const command = request.command;
    globalThis.analytics.trackPopupInteraction('navigation_triggered_from_popup', {
      command: command
    });
    
    // Trigger the same navigation logic as keyboard shortcuts
    chrome.commands.onCommand.dispatch(command);
    sendResponse({message: "Navigation triggered"});
  } else if (request.action === "getHistoryState") {
    // Return current history state for popup
    sendResponse({
      tabHistory: tabHistory,
      currentIndex: currentIndex,
      totalTabs: tabHistory.length
    });
  } else if (request.action === "getUpdateStatus") {
    // Return update status for popup
    try {
      const updateStatus = await updateChecker.getUpdateStatus();
      const notificationState = await updateNotificationManager.getNotificationState();
      sendResponse({
        ...updateStatus,
        ...notificationState
      });
    } catch (error) {
      console.error('Failed to get update status:', error);
      sendResponse({ hasUpdate: false, error: error.message });
    }
    return true; // Keep message channel open for async response
  } else if (request.action === "dismissUpdate") {
    // User dismissed update notification
    try {
      await updateNotificationManager.dismissUpdate();
      sendResponse({ success: true });
    } catch (error) {
      console.error('Failed to dismiss update:', error);
      sendResponse({ success: false, error: error.message });
    }
  } else if (request.action === "checkForUpdates") {
    // Manual update check from popup
    try {
      const result = await updateChecker.forceUpdateCheck();
      if (result.updateAvailable && result.release) {
        await updateNotificationManager.showInPopup(result.release.version, result.release.downloadUrl);
      }
      sendResponse({ 
        success: true, 
        updateAvailable: result.updateAvailable,
        version: result.release?.version 
      });
    } catch (error) {
      console.error('Failed to check for updates:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep message channel open for async response
  }
});

/**
 * Periodically checks the state of tab history against the stored values.
 * If a mismatch is detected, it recovers the tab history from storage.
 */
function periodicStateCheck() {
  storage.get(['tabHistory', 'currentIndex'], (result) => {
    if (result.tabHistory && result.tabHistory.length > 0 &&
        (tabHistory.length === 0 || !arraysEqual(tabHistory, result.tabHistory))) {
      console.log('Detected state mismatch, recovering from storage');
      tabHistory = result.tabHistory;
      currentIndex = result.currentIndex;
    }
  });
}

/**
 * Helper function to compare arrays.
 * Checks if two arrays are equal by comparing their length and elements.
 */
function arraysEqual(a, b) {
  return a.length === b.length && a.every((val, index) => val === b[index]);
}

/**
 * Starts the periodic check of the tab history state.
 * Checks the state of tab history against the stored values every 5 minutes.
 */
setInterval(periodicStateCheck, CHECK_INTERVAL);

// Add helper function to get tab info for logging
async function getTabInfo(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    return `${tabId} (${tab.title})`;
  } catch (e) {
    return `${tabId} (unknown)`;
  }
}

// Update logTabHistory function to be more detailed
const logTabHistory = async (tabHistory) => {
  console.log('=== Detailed Tab History ===');
  for (let i = 0; i < tabHistory.length; i++) {
    const tabInfo = await getTabInfo(tabHistory[i]);
    console.log(`[${i}]: ${tabInfo}`);
  }
  console.log('=========================');
};

// Clear validation cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [tabId, data] of tabValidationCache.entries()) {
    if (now - data.timestamp > CACHE_DURATION) {
      tabValidationCache.delete(tabId);
    }
  }
}, CACHE_DURATION);

// Update cleanup interval
setInterval(cleanupNonExistentTabs, CLEANUP_INTERVAL);

/**
 * Initialize update system
 */
async function initializeUpdateSystem() {
  try {
    // Setup notification handlers
    updateNotificationManager.setupNotificationHandlers();
    
    // Restore badge state if needed
    await updateNotificationManager.restoreBadgeState();
    
    // Set up periodic update checks (every 24 hours)
    chrome.alarms.create('updateCheck', { 
      delayInMinutes: 1, // First check after 1 minute
      periodInMinutes: 24 * 60 // Then every 24 hours
    });
    
    console.log('Update system initialized');
  } catch (error) {
    console.error('Failed to initialize update system:', error);
  }
}

/**
 * Handle periodic update checks
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'updateCheck') {
    try {
      console.log('Performing scheduled update check');
      const updateStatus = await updateChecker.getUpdateStatus();
      
      if (updateStatus.hasUpdate && updateStatus.shouldNotify) {
        // Show notification for new update
        const success = await updateNotificationManager.showUpdateNotification(
          updateStatus.version, 
          updateStatus.downloadUrl
        );
        
        if (success) {
          // Mark this version as notified
          await updateChecker.markVersionNotified(updateStatus.version);
          
          // Track update notification
          globalThis.analytics.track('update_notification_shown', {
            version: updateStatus.version,
            current_version: updateChecker.getCurrentVersion()
          });
        }
      }
    } catch (error) {
      console.error('Scheduled update check failed:', error);
    }
  }
});
