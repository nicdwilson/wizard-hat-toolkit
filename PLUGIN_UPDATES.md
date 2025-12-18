# Plugin Updates Feature

This document describes the automatic plugin update functionality added to the Wizard Hat Toolkit.

## Overview

The plugin update system automatically detects, checks, and updates WooCommerce Marketplace plugins that were installed via the Plugin Management module. This ensures that developers always have the latest versions of their plugins without manual intervention.

## Features

### Automatic Detection
- Detects WooCommerce Marketplace plugins installed via the Plugin Management module
- Tracks installed plugins using Local's user data storage
- Distinguishes between premium marketplace plugins and standard WordPress.org plugins

### Update Checking
- Checks for available updates using WordPress's built-in update mechanisms
- For premium plugins, checks GitHub releases for newer versions
- Compares current plugin versions with available updates

### Automated Updates
- Automatically updates plugins when updates are available (configurable)
- Downloads latest versions from GitHub for premium plugins
- Uses WP-CLI for standard plugin updates
- Provides detailed logging of update operations

### User Control
- Configurable settings for update behavior
- Option to enable/disable automatic updates
- Option to check for updates when accessing the Plugin Updates tab
- Option to show notifications for available updates
- Ability to exclude specific plugins from updates

## Implementation

### Core Modules

#### PluginDetector (`src/modules/plugin-updater/PluginDetector.ts`)
- Detects marketplace plugins installed via the plugin management system
- Tracks installed plugins in Local's user data
- Provides methods to identify marketplace vs standard plugins

#### UpdateChecker (`src/modules/plugin-updater/UpdateChecker.ts`)
- Checks for available updates using WordPress functions
- Handles both standard WordPress.org plugins and premium GitHub plugins
- Compares version numbers to determine if updates are available

#### PluginUpdater (`src/modules/plugin-updater/PluginUpdater.ts`)
- Downloads and installs plugin updates
- Uses existing GitHub download mechanisms for premium plugins
- Uses WP-CLI for standard plugin updates
- Provides comprehensive logging

#### UpdateSettingsManager (`src/modules/plugin-updater/UpdateSettings.ts`)
- Manages user preferences for update behavior
- Stores settings in Local's user data
- Provides methods to check and update settings

### Frontend Components

#### PluginUpdates (`src/PluginUpdates.jsx`)
- React component providing UI for plugin update management
- Shows update status and available updates
- Provides settings interface for update preferences
- Handles user interactions for manual update checks

### Integration Points

#### Main Process (`src/main.ts`)
- IPC handlers for update operations
- Integration with existing plugin installation system
- Automatic tracking of installed marketplace plugins
- Settings management

#### Wizardhat Component (`src/Wizardhat.jsx`)
- Added Plugin Updates tab to navigation
- Integration with existing tab system

## Usage

### Accessing Plugin Updates
1. Open Local by Flywheel
2. Navigate to a site's WooCommerce tab
3. Click on the "Plugin Updates" tab

### Checking for Updates
- Updates are automatically checked when accessing the Plugin Updates tab (if enabled in settings)
- Manual update checks can be triggered using the "Check for Updates" button

### Settings Configuration
- **Enable automatic updates**: When enabled, plugins are automatically updated when updates are available
- **Check for updates on tab access**: When enabled, updates are checked automatically when accessing the Plugin Updates tab
- **Show notifications for available updates**: When enabled, notifications are shown for available updates

### Update Process
1. System detects marketplace plugins installed via Plugin Management
2. Checks for available updates using WordPress functions and GitHub API
3. If updates are available and auto-update is enabled, downloads and installs updates
4. If auto-update is disabled, shows available updates for manual installation
5. Provides feedback on update success or failure

## Technical Details

### Plugin Tracking
- Marketplace plugins are tracked when installed via the Plugin Management module
- Tracking information is stored in Local's user data using `installedMarketplacePlugins`
- Plugin detection uses WP-CLI to get installed plugin information
- **Plugin Identification:**
  - Uses dynamic detection: If plugin is in premium selections, it's a marketplace plugin
  - Otherwise, it's treated as a WordPress.org plugin
  - No hardcoded plugin lists - uses actual premium plugin selections as source of truth
  - Properly normalizes identifiers (case-insensitive) for accurate matching

### Update Sources
- **Standard Plugins**: Uses WordPress's built-in update mechanism via `wp_update_plugins()`
  - Correctly identifies plugin main files using WordPress `get_plugins()` function
  - Constructs update keys in format `{plugin-folder}/{main-file.php}` to match WordPress transient format
  - Falls back to alternative key matching if exact key not found
- **Premium Plugins**: Checks all-plugins repository for newer versions
  - Extracts version from plugin's main PHP file inside the zip
  - Downloads from local all-plugins repository path
  - Uses dynamic detection based on premium plugin selections (no hardcoded lists)

### Error Handling
- Comprehensive error handling for network issues, permission problems, and plugin conflicts
- Detailed logging of all update operations
- Graceful fallback when updates fail
- **Activation State Preservation:**
  - Checks plugin activation status before updating
  - Only deactivates/reactivates plugins that were active
  - Leaves inactive plugins inactive after update
- **WP-CLI Options:**
  - Passes `skipPlugins: false` and `skipThemes: false` to all WP-CLI commands
  - Ensures WooCommerce and other dependencies are available during activation

### Security
- Uses existing GitHub token authentication
- Validates plugin sources before installation
- Maintains existing security measures from the plugin management system

## Configuration

### Default Settings
```typescript
{
    autoUpdate: true,
    updateOnStartup: true,
    notifyOnUpdates: true,
    excludedPlugins: [],
    lastUpdateCheck: null
}
```

### Settings Storage
- Settings are stored in Local's user data under `pluginUpdateSettings`
- Settings persist across Local sessions
- Can be modified via the Plugin Updates UI

## Future Enhancements

### Potential Improvements
- Scheduled update checks (e.g., daily, weekly)
- Update rollback functionality
- Bulk update operations
- Update notifications in Local's main interface
- Integration with Local's site startup events (when API becomes available)

### Additional Features
- Plugin dependency checking
- Update compatibility validation
- Custom update schedules per plugin
- Update history tracking

## Troubleshooting

### Common Issues
1. **Updates not detected**: 
   - Ensure plugins were installed via Plugin Management module
   - Check that plugin main file is correctly identified (check browser console logs)
   - Verify update key matches WordPress format: `{plugin-folder}/{main-file.php}`
2. **Repository refresh issues**:
   - Check browser console for detailed git operation logs
   - Verify repository branch (master vs main) is correctly detected
   - Ensure repository path is correctly configured
   - Check that git is accessible in PATH
3. **Plugin activation errors**:
   - Verify WooCommerce is installed and active for dependent plugins
   - Check that `skipPlugins: false` is being passed (check logs)
   - Ensure plugin was active before update if expecting reactivation
4. **Update failures**: Check Local logs and browser console for detailed error information
5. **Settings not saving**: Ensure Local has proper file system permissions

### Debug Information
- All update operations are logged to Local's logger
- Error details are provided in the Plugin Updates UI
- Update status is displayed in real-time
- **Repository Refresh Logging:**
  - All git operations (fetch, pull, rev-list) are logged with detailed output
  - Git command stdout/stderr is captured and displayed in browser console
  - Branch detection and remote branch information is logged
  - Commit counts and update status are logged at each step
  - Logs are sent to browser console via IPC events for easy debugging

## Dependencies

### Required Packages
- `@octokit/rest`: GitHub API integration
- `request`: HTTP requests for downloads
- `fs-extra`: File system operations
- `@getflywheel/local`: Local API integration

### WordPress Functions Used
- `wp_update_plugins()`: Check for plugin updates
- `get_site_transient('update_plugins')`: Get update information
- WP-CLI commands for plugin management

This implementation provides a robust, user-friendly system for managing WooCommerce Marketplace plugin updates while maintaining the security and reliability of the existing plugin management infrastructure.
