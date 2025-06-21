# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Tab History Navigator is a Chrome extension (Manifest V3) that enables browser-like back/forward navigation through tab history using keyboard shortcuts. The extension tracks tab visits chronologically and provides seamless navigation with automatic cleanup of closed tabs.

## Architecture

### Core Components
- **Background Service Worker** (`src/background.js`): Main extension logic handling tab history management, navigation commands, and analytics
- **Popup Interface** (`src/popup.js`): Visual timeline interface for tab history with interactive controls
- **Analytics System** (`src/analytics.js`, `src/analytics-config.js`): Privacy-first usage tracking with PostHog integration

### Key Data Structures
- `tabHistory`: Array of tab IDs in chronological visit order (max 60 entries)
- `currentIndex`: Current position in history array
- Tab validation cache: Performance optimization for checking tab existence

### Navigation Logic
The extension implements sophisticated tab navigation logic:
- **Manual navigation**: When users click tabs or use system shortcuts, tabs are either added to history end or moved to end if existing
- **Shortcut navigation**: Back/forward commands move through history without modifying the array
- **Smart cleanup**: Automatically removes closed tabs from history with position adjustment

## Development Commands

### Loading the Extension
Since this is a Chrome extension with no build process:
1. Load unpacked extension in Chrome from project root directory
2. Refresh extension in `chrome://extensions/` after code changes

### Testing
- Test manually by using keyboard shortcuts: `Ctrl+Shift+Left` (back), `Ctrl+Shift+Right` (forward)
- Open popup by clicking extension icon in toolbar
- Check background script logs in extension service worker devtools
- Analytics events visible in browser console when `debug: true` in analytics config

### Analytics Setup
1. Replace `YOUR_POSTHOG_PROJECT_KEY` in `src/analytics-config.js` with actual PostHog API key
2. Set `debug: false` for production builds
3. Set `enabled: false` to completely disable analytics

## Key Implementation Details

### State Management
- All state persisted to `chrome.storage.local` for service worker restarts
- Periodic state validation every 5 minutes
- Tab validation results cached for 30 seconds to reduce API calls

### Performance Optimizations
- Batch tab validation for cleanup operations
- Reduced cleanup frequency (15 minutes) with last-cleanup tracking
- Smart navigation that skips cleanup if performed recently
- Automatic cache cleanup to prevent memory leaks

### Error Handling
- Graceful recovery from service worker restarts
- Automatic reinitializion when history becomes invalid
- Tab existence validation before navigation attempts
- Comprehensive error tracking through analytics

### Chrome Extension Permissions
- `storage`: For persisting tab history state
- `tabs`: For reading tab information and switching tabs
- `host_permissions`: PostHog analytics endpoint access

## File Structure Significance
- `src/`: All source files (moved from root for organization) 
- `img/`: Extension icons in required sizes
- `manifest.json`: Extension configuration and permissions
- Analytics documentation files provide setup guidance for PostHog integration