/**
 * Plugin Manager Module
 * 
 * A comprehensive plugin and theme management system that consolidates
 * all plugin-related functionality into a single, modular architecture.
 * 
 * Key Components:
 * - PluginManager: Main orchestrator class
 * - PluginRegistry: Manages premium plugin selections and source detection
 * - PluginInstaller: Handles installation logic via WP-CLI
 * - PluginDownloader: Manages marketplace downloads from GitHub
 * - GitHubClient: Utility for GitHub API interactions
 */

// Main classes
export { PluginManager } from './PluginManager';
export { PluginRegistry } from './PluginRegistry';
export { PluginInstaller } from './PluginInstaller';
export { PluginDownloader } from './PluginDownloader';
export { GitHubClient } from './utils/GitHubClient';

// Types
export * from './types/PluginTypes';
export * from './types/InstallationTypes';

// Re-export PluginDetector from plugin-updater for compatibility
export { PluginDetector } from '../plugin-updater/PluginDetector';
