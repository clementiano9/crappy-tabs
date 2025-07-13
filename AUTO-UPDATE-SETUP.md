# Chrome Extension Auto-Update Setup Guide

## Overview
Your Chrome extension now supports automatic updates! Users will receive updates automatically without needing to manually download and install new versions.

## Setup Requirements

### 1. GitHub Repository Setup
- ✅ Extension code in GitHub repository
- ✅ GitHub Actions workflows configured
- ✅ GitHub Pages enabled

### 2. Required GitHub Secrets
Add this secret to your GitHub repository:

**`CHROME_EXTENSION_KEY`** (Required)
```bash
# Base64 encode your private key
base64 -i /Users/clementozemoya/WebProjects/tab-navigator-keys/tab-navigator-key.pem

# Add the output to GitHub Secrets
```

### 3. Enable GitHub Pages
1. Go to your GitHub repository settings
2. Navigate to "Pages" section
3. Set source to "GitHub Actions"
4. Save settings

## How It Works

### Automatic Release Process
1. **Code Change**: Push changes to main branch
2. **Version Detection**: GitHub Actions reads version from `manifest.json`
3. **Package Extension**: Creates CRX and ZIP files
4. **GitHub Release**: Publishes release with assets
5. **Update Server**: Deploys `updates.xml` to GitHub Pages
6. **Chrome Auto-Update**: Chrome checks for updates every ~5 hours

### Update Flow
```
Developer Push → GitHub Actions → GitHub Pages → Chrome Updates
     ↓              ↓               ↓              ↓
  Code change → Build & Sign → Host files → User updates
```

## Testing the Setup

### Manual Testing
1. **Install Current Version**: Load the extension with new `update_url`
2. **Increment Version**: Update version in `manifest.json` (e.g., 1.1.0 → 1.1.1)
3. **Push Changes**: Commit and push to trigger release
4. **Verify Release**: Check GitHub releases for new version
5. **Test Update**: Chrome should detect and install update within 5 hours

### Force Update Check (Testing)
```javascript
// In Chrome DevTools console for extension background script
chrome.runtime.requestUpdateCheck((status) => {
  console.log('Update check status:', status);
});
```

## File Structure
```
tab-navigator/
├── manifest.json           # Contains update_url
├── updates.xml            # Update manifest (auto-generated)
├── .github/workflows/
│   ├── auto-release.yml   # Main automation workflow
│   └── pages.yml          # GitHub Pages deployment
└── AUTO-UPDATE-SETUP.md   # This guide
```

## URLs
- **Update Check**: `https://clementozemoya.github.io/tab-navigator/updates.xml`
- **CRX Download**: `https://clementozemoya.github.io/tab-navigator/tab-navigator.crx`

## Version Management
- **Current**: 1.1.0
- **Next**: Increment version in `manifest.json` and push
- **Automatic**: GitHub Actions handles packaging and deployment

## Security Notes
- ✅ Private key stored securely in GitHub Secrets
- ✅ HTTPS-only update URLs
- ✅ Signed CRX packages prevent tampering
- ✅ Extension ID remains constant for updates

## Troubleshooting
- **Updates not working**: Check GitHub Pages deployment status
- **Build failures**: Verify `CHROME_EXTENSION_KEY` secret is set correctly
- **Chrome not updating**: Extensions update every ~5 hours, force check in `chrome://extensions/`