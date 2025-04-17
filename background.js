// background.js
// Service Worker for Manifest V3

const storage = chrome.storage.local;

let tabHistory = [];
let currentIndex = -1;
const MAX_HISTORY_SIZE = 60;
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Event listener for when the extension starts up.
 * Initializes the tab history when the extension is started.
 */
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started');
  initializeTabHistory();
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
    } else {
      console.log('State saved to storage');
    }
  });
}

/**
 * Event listener for when the extension is installed.
 * Initializes the tab history when the extension is installed.
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('Tab History Navigator installed');
  initializeTabHistory();
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
 * Listener for command events triggered by keyboard shortcuts.
 * This method handles navigation through the tab history based on user commands.
 * 
 * Supported commands:
 * - "go-back": Navigates to the previous tab in the history.
 * - "go-forward": Navigates to the next tab in the history.
 * 
 * It also recovers the tab history if the service worker was terminated.
 */
chrome.commands.onCommand.addListener((command) => {
  storage.get(['tabHistory', 'currentIndex'], (result) => {
    if (!tabHistory.length && result.tabHistory && result.tabHistory.length) {
      // Service worker was terminated, recover the history
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

    if (command === "go-back") {
      if (currentIndex > 0) {
        console.log('Moving back from index', currentIndex, 'to', currentIndex - 1);
        currentIndex--;
        chrome.tabs.update(tabHistory[currentIndex], { active: true });
      } else {
        console.log('Already at start of history');
      }
    } else if (command === "go-forward") {
      if (currentIndex < tabHistory.length - 1) {
        console.log('Moving forward from index', currentIndex, 'to', currentIndex + 1);
        currentIndex++;
        chrome.tabs.update(tabHistory[currentIndex], { active: true });
      } else {
        console.log('Already at end of history');
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
  tabHistory = [];
  currentIndex = -1;
  saveState();
  console.log('Tab history cleared');
}

/**
 * Event listener for messages from the popup.
 * Handles the clearing of the tab history.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "clearHistory") {
    clearTabHistory();
    sendResponse({message: "History cleared successfully"});
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
