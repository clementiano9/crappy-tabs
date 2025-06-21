// src/popup.js
// Popup script for Tab Navigator extension with analytics

class PopupController {
  constructor() {
    this.init();
  }

  async init() {
    // Track popup opened
    globalThis.analytics.trackPopupInteraction('popup_opened');

    // Set up event listeners
    this.setupEventListeners();
    
    // Load and display current tab history state
    await this.loadHistoryState();
  }

  setupEventListeners() {

    // Track logo interactions
    document.querySelector('.logo').addEventListener('click', (e) => {
      e.preventDefault();
      globalThis.analytics.trackPopupInteraction('logo_clicked');
    });
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
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});

// Track popup close
window.addEventListener('beforeunload', () => {
  globalThis.analytics.trackPopupInteraction('popup_closed');
});
