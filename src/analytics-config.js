// src/analytics-config.js
const ANALYTICS_CONFIG = {
  projectKey: 'phc_lYOytoSYcrJtMRE5ZLQhhyL7D4J4RMP13MSjK8dWQqy',
  host: 'https://eu.i.posthog.com',
  enabled: true, // Set to false to completely disable analytics
  // Debug mode for development - set to false for production
  debug: true,
  // Event queue settings - optimized for production
  batchSize: 10, // Send events in batches for efficiency
  flushInterval: 30000, // 30 seconds for production
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
  HISTORY_CLEARED: 'history_cleared',
  
  // Activity tracking events for DAU/WAU calculation
  APP_VIEW: '$pageview', // PostHog standard event for page views
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',
  DAILY_HEARTBEAT: 'daily_heartbeat'
};

const USER_PROPERTIES = {
  EXTENSION_VERSION: 'extension_version',
  INSTALL_DATE: 'install_date',
  BROWSER_VERSION: 'browser_version',
  PLATFORM: 'platform'
};
