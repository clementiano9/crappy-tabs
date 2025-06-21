// src/analytics.js
// Lightweight PostHog analytics implementation for Chrome extensions
// Zero dependencies, ~3KB total size

// Configuration and constants are imported via importScripts from analytics-config.js

class ExtensionAnalytics {
  constructor() {
    this.config = ANALYTICS_CONFIG;
    this.eventQueue = [];
    this.distinctId = null;
    this.isInitialized = false;
    this.flushTimer = null;
    this.retryTimer = null;
    this.isOnline = navigator.onLine;
    
    this.init();
  }

  async init() {
    if (!this.config.enabled) {
      this.log('Analytics disabled');
      return;
    }

    try {
      // Get or generate distinct ID
      await this.initializeDistinctId();
      
      // Load queued events from storage
      await this.loadEventQueue();
      
      // Set up browser online/offline handlers
      this.setupNetworkHandlers();
      
      // Start flush timer
      this.startFlushTimer();
      
      this.isInitialized = true;
      this.log('Analytics initialized successfully');
      
      // Process any queued events
      if (this.eventQueue.length > 0) {
        this.log(`Processing ${this.eventQueue.length} queued events`);
        this.flush();
      }
    } catch (error) {
      this.logError('Failed to initialize analytics', error);
    }
  }

  async initializeDistinctId() {
    try {
      const result = await chrome.storage.local.get(['analytics_distinct_id']);
      
      if (result.analytics_distinct_id) {
        this.distinctId = result.analytics_distinct_id;
        this.log('Loaded existing distinct ID:', this.distinctId);
      } else {
        // Generate anonymous distinct ID
        this.distinctId = 'ext_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await chrome.storage.local.set({ analytics_distinct_id: this.distinctId });
        this.log('Generated new distinct ID:', this.distinctId);
      }
    } catch (error) {
      // Fallback if storage fails
      this.distinctId = 'ext_fallback_' + Date.now();
      this.logError('Failed to initialize distinct ID, using fallback', error);
    }
  }

  async loadEventQueue() {
    try {
      const result = await chrome.storage.local.get(['analytics_event_queue']);
      if (result.analytics_event_queue && Array.isArray(result.analytics_event_queue)) {
        this.eventQueue = result.analytics_event_queue;
        this.log(`Loaded ${this.eventQueue.length} events from storage`);
      }
    } catch (error) {
      this.logError('Failed to load event queue', error);
      this.eventQueue = [];
    }
  }

  async saveEventQueue() {
    try {
      await chrome.storage.local.set({ analytics_event_queue: this.eventQueue });
    } catch (error) {
      this.logError('Failed to save event queue', error);
    }
  }

  setupNetworkHandlers() {
    if (typeof self !== 'undefined' && self.addEventListener) {
      // Service worker environment
      self.addEventListener('online', () => {
        this.isOnline = true;
        this.log('Network back online, flushing events');
        this.flush();
      });
    } else if (typeof window !== 'undefined') {
      // Regular window environment (popup)
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.log('Network back online, flushing events');
        this.flush();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.log('Network offline, events will be queued');
      });
    }
  }

  startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    this.flushTimer = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flush();
      }
    }, this.config.flushInterval);
  }

  // Core tracking methods
  track(eventName, properties = {}, options = {}) {
    if (!this.config.enabled) return;

    // Ensure distinct_id is available before tracking
    if (!this.distinctId) {
      this.log('Warning: distinct_id not initialized, queueing event for later');
      // Queue the event to be sent after initialization
      setTimeout(() => this.track(eventName, properties, options), 100);
      return;
    }

    const event = {
      event: eventName,
      properties: {
        ...properties,
        $lib: 'tab-navigator-extension',
        $lib_version: '1.0.0',
        ...this.getDefaultProperties()
      },
      distinct_id: this.distinctId,
      timestamp: new Date().toISOString() // PostHog expects ISO 8601 format
    };

    this.enqueueEvent(event);
    this.log('Tracked event:', eventName, properties);

    // Auto-flush if queue is getting full
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  identify(properties = {}) {
    if (!this.config.enabled) return;

    // Ensure distinct_id is available before identifying
    if (!this.distinctId) {
      this.log('Warning: distinct_id not initialized, skipping identify');
      return;
    }

    const event = {
      event: '$identify',
      properties: {
        $set: properties,
        ...this.getDefaultProperties()
      },
      distinct_id: this.distinctId,
      timestamp: new Date().toISOString()
    };

    this.enqueueEvent(event);
    this.log('Identified user with properties:', properties);
  }

  // Extension-specific tracking methods
  trackNavigation(direction, properties = {}) {
    const startTime = Date.now();
    
    this.track(EVENTS.NAVIGATION, {
      direction: direction, // 'back' or 'forward'
      timestamp: startTime,
      ...properties
    });

    return startTime; // Return for performance tracking
  }

  trackPerformance(action, startTime, properties = {}) {
    const duration = Date.now() - startTime;
    
    this.track(EVENTS.PERFORMANCE_METRIC, {
      action: action,
      duration_ms: duration,
      ...properties
    });
  }

  trackInstall(reason, previousVersion = null) {
    const eventName = reason === 'install' ? EVENTS.EXTENSION_INSTALL : EVENTS.EXTENSION_UPDATE;
    
    this.track(eventName, {
      reason: reason,
      previous_version: previousVersion,
      install_timestamp: Date.now()
    });

    // Set user properties on install
    if (reason === 'install') {
      this.identify({
        [USER_PROPERTIES.INSTALL_DATE]: new Date().toISOString(),
        [USER_PROPERTIES.EXTENSION_VERSION]: chrome.runtime.getManifest().version
      });
    }
  }

  trackPopupInteraction(action, properties = {}) {
    this.track(EVENTS.POPUP_INTERACTION, {
      action: action,
      ...properties
    });
  }

  trackKeyboardShortcut(command, success = true, properties = {}) {
    this.track(EVENTS.KEYBOARD_SHORTCUT, {
      command: command,
      success: success,
      ...properties
    });
  }

  trackError(errorMessage, context = '', properties = {}) {
    this.track(EVENTS.EXTENSION_ERROR, {
      error_message: errorMessage,
      error_context: context,
      timestamp: Date.now(),
      ...properties
    });
  }

  trackHistoryCleanup(removedCount, totalCount) {
    this.track(EVENTS.HISTORY_CLEANUP, {
      removed_count: removedCount,
      total_count: totalCount,
      cleanup_timestamp: Date.now()
    });
  }

  // Internal methods
  enqueueEvent(event) {
    this.eventQueue.push(event);
    
    // Limit queue size
    if (this.eventQueue.length > this.config.maxQueueSize) {
      this.eventQueue.shift(); // Remove oldest event
      this.log('Queue full, removed oldest event');
    }

    // Save to storage for persistence
    this.saveEventQueue();
  }

  async flush() {
    if (this.eventQueue.length === 0) return;
    if (!this.isOnline) {
      this.log('Offline, skipping flush');
      return;
    }

    // Filter out events with null distinct_id
    const validEvents = this.eventQueue.filter(event => event.distinct_id);
    if (validEvents.length === 0) {
      this.log('No valid events to send (all missing distinct_id)');
      return;
    }

    if (validEvents.length < this.eventQueue.length) {
      this.log(`Filtered out ${this.eventQueue.length - validEvents.length} events with missing distinct_id`);
    }

    const eventsToSend = [...validEvents];
    this.log(`Flushing ${eventsToSend.length} events to PostHog`);

    try {
      // Try PostHog's batch endpoint first
      const requestPayload = {
        api_key: this.config.projectKey,
        batch: eventsToSend
      };

      this.log('Sending batch request to PostHog:', {
        url: `${this.config.host}/batch/`,
        eventCount: eventsToSend.length,
        hasApiKey: !!this.config.projectKey,
        firstEventSample: eventsToSend[0]
      });

      const response = await fetch(`${this.config.host}/batch/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      });

      if (response.ok) {
        // Remove only the events that were successfully sent (valid events)
        this.eventQueue = this.eventQueue.filter(event => !validEvents.includes(event));
        await this.saveEventQueue();
        this.log(`Successfully sent ${eventsToSend.length} events`);
        
        // Clear retry timer if it was running
        if (this.retryTimer) {
          clearTimeout(this.retryTimer);
          this.retryTimer = null;
        }
      } else {
        const errorText = await response.text();
        this.logError(`PostHog Batch API Error: HTTP ${response.status}`, {
          status: response.status,
          statusText: response.statusText,
          responseBody: errorText
        });
        
        // Try individual capture endpoint as fallback
        await this.flushIndividual(eventsToSend);
      }
    } catch (error) {
      this.logError('Failed to send batch events to PostHog', error);
      // Try individual capture as fallback
      try {
        await this.flushIndividual(eventsToSend);
      } catch (fallbackError) {
        this.logError('Fallback individual capture also failed', fallbackError);
        this.scheduleRetry();
      }
    }
  }

  async flushIndividual(eventsToSend) {
    this.log(`Trying individual capture for ${eventsToSend.length} events`);
    
    for (const event of eventsToSend) {
      try {
        const requestPayload = {
          api_key: this.config.projectKey,
          event: event.event,
          distinct_id: event.distinct_id,
          properties: event.properties,
          timestamp: event.timestamp
        };
        
        this.log(`Sending individual event ${event.event}:`, requestPayload);
        
        const response = await fetch(`${this.config.host}/i/v0/e/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestPayload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          this.logError(`Individual capture failed for event ${event.event}:`, {
            status: response.status,
            responseBody: errorText
          });
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        this.logError(`Failed to send individual event ${event.event}:`, error);
        throw error;
      }
    }

    // If we get here, all events were sent successfully
    // Remove only the events that were successfully sent
    this.eventQueue = this.eventQueue.filter(event => !eventsToSend.includes(event));
    await this.saveEventQueue();
    this.log(`Successfully sent ${eventsToSend.length} events individually`);
    
    // Clear retry timer if it was running
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  scheduleRetry() {
    if (this.retryTimer) return; // Already scheduled

    this.retryTimer = setTimeout(() => {
      this.log('Retrying event flush...');
      this.retryTimer = null;
      this.flush();
    }, this.config.retryInterval);
  }

  getDefaultProperties() {
    const manifest = chrome.runtime.getManifest();
    
    // Extract Chrome version from user agent
    const chromeMatch = navigator.userAgent.match(/Chrome\/([0-9.]+)/);
    const browserVersion = chromeMatch ? chromeMatch[1] : 'unknown';
    
    return {
      [USER_PROPERTIES.EXTENSION_VERSION]: manifest.version,
      [USER_PROPERTIES.BROWSER_VERSION]: browserVersion,
      [USER_PROPERTIES.PLATFORM]: navigator.platform,
      session_id: this.getSessionId()
    };
  }

  getSessionId() {
    // Simple session ID based on extension startup
    if (!this.sessionId) {
      this.sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }
    return this.sessionId;
  }


  log(...args) {
    if (this.config.debug) {
      console.log('[Analytics]', ...args);
    }
  }

  logError(...args) {
    if (this.config.debug) {
      console.error('[Analytics Error]', ...args);
    }
  }

  // Public method to disable analytics
  disable() {
    this.config.enabled = false;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.log('Analytics disabled');
  }

  // Public method to enable analytics
  enable() {
    this.config.enabled = true;
    this.startFlushTimer();
    this.log('Analytics enabled');
  }

  // Get analytics status
  getStatus() {
    return {
      enabled: this.config.enabled,
      initialized: this.isInitialized,
      distinctId: this.distinctId,
      queueLength: this.eventQueue.length,
      isOnline: this.isOnline
    };
  }
}

// Create singleton instance
const analytics = new ExtensionAnalytics();

// Make it globally available for Chrome extension context
if (typeof globalThis !== 'undefined') {
  globalThis.analytics = analytics;
}
