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

### Update Sources
- **Standard Plugins**: Uses WordPress's built-in update mechanism via `wp_update_plugins()`
- **Premium Plugins**: Checks GitHub releases using the Octokit library
- **Download**: Uses existing GitHub download mechanisms from the plugin management system

### Error Handling
- Comprehensive error handling for network issues, permission problems, and plugin conflicts
- Detailed logging of all update operations
- Graceful fallback when updates fail

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
1. **Updates not detected**: Ensure plugins were installed via Plugin Management module
2. **GitHub API errors**: Verify GitHub token has proper permissions
3. **Update failures**: Check Local logs for detailed error information
4. **Settings not saving**: Ensure Local has proper file system permissions

### Debug Information
- All update operations are logged to Local's logger
- Error details are provided in the Plugin Updates UI
- Update status is displayed in real-time

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
