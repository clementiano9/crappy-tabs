// src/analytics-config.js
const ANALYTICS_CONFIG = {
  projectKey: 'phc_lYOytoSYcrJtMRE5ZLQhhyL7D4J4RMP13MSjK8dWQqy',
  host: 'https://eu.i.posthog.com',
  enabled: true, // Set to false to completely disable analytics
  // Debug mode for development - set to false for production
  debug: true,
  // Event queue settings - optimized for testing
  batchSize: 1, // Send events immediately for testing
  flushInterval: 10000, // 10 seconds for faster testing
  maxQueueSize: 100,
  retryInterval: 30000, // 30 seconds
  maxRetries: 3
};

// Extension-specific constants
const EVENTS = {
  // Navigation events
  NAVIGATION: 'navigation',
  NAVIGATION_PERFORMANCE: 'navigation_performance',
  
  // Lifecycle events
  EXTENSION_INSTALL: 'extension_install',
  EXTENSION_UPDATE: 'extension_update',
  EXTENSION_STARTUP: 'extension_startup',
  
  // UI events
  POPUP_OPENED: 'popup_opened',
  POPUP_INTERACTION: 'popup_interaction',
  KEYBOARD_SHORTCUT: 'keyboard_shortcut',
  
  // Performance events
  PERFORMANCE_METRIC: 'performance_metric',
  
  // Error events
  EXTENSION_ERROR: 'extension_error',
  
  // History management
  HISTORY_CLEANUP: 'history_cleanup',
  HISTORY_CLEARED: 'history_cleared'
};

const USER_PROPERTIES = {
  EXTENSION_VERSION: 'extension_version',
  INSTALL_DATE: 'install_date',
  BROWSER_VERSION: 'browser_version',
  PLATFORM: 'platform'
};
