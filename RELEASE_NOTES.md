# Release Notes - Wizard Hat Toolkit v10.11.0

## 🔧 Plugin Update Reliability Fixes

This release fixes three bugs in the plugin update facility that caused it to incorrectly report "All plugins are up to date" even when marketplace plugin updates were available.

### ✨ What's Fixed

#### Marketplace Plugin Detection (Primary Fix)
- **Root Cause Resolved**: The `PluginDetector` was receiving a stale, often-empty premium plugin list, causing every installed plugin to be misidentified as a WordPress.org plugin
- **Fix**: The update checker now always fetches the current premium plugin list live from `PluginManager` at the time of the check, ensuring marketplace plugins are correctly identified and routed to the zip-based version check

#### Inactive Plugin Inclusion
- **Previously**: Inactive plugins were silently skipped during update checks, meaning inactive marketplace plugins with pending updates were never surfaced
- **Fix**: All plugins are now included in update checks regardless of activation status; only the `hello` stub plugin continues to be excluded

#### Version String Matching
- **Previously**: The regex used to extract version numbers from plugin file headers only matched purely numeric versions (e.g. `1.2.3`), silently failing for versions like `9.4.0-rc.1` or `2025.03`
- **Fix**: The regex now captures any non-whitespace version string; the existing normalization logic already handles stripping suffixes for comparison

### 📝 Previous Releases

For information about previous releases, see the [changelog](documentation/changelog.md).
