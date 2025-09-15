/**
 * Tools Manager - Handles tool settings and configurations
 */

import { Logger } from '../../utils/Logger';

export interface ToolsSettings {
	enableDebugLog: boolean;
}

export class ToolsManager {
	private static readonly STORAGE_KEY = 'wizard-hat-tools-settings';
	private static readonly DEFAULT_SETTINGS: ToolsSettings = {
		enableDebugLog: false
	};

	/**
	 * Get current tools settings
	 */
	static getSettings(): ToolsSettings {
		try {
			const stored = localStorage.getItem(this.STORAGE_KEY);
			if (stored) {
				return { ...this.DEFAULT_SETTINGS, ...JSON.parse(stored) };
			}
		} catch (error) {
			console.error('Error loading tools settings:', error);
		}
		return { ...this.DEFAULT_SETTINGS };
	}

	/**
	 * Update tools settings
	 */
	static updateSettings(newSettings: Partial<ToolsSettings>): void {
		try {
			const currentSettings = this.getSettings();
			const updatedSettings = { ...currentSettings, ...newSettings };
			localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedSettings));
			
			// Apply debug logging setting immediately
			if (newSettings.enableDebugLog !== undefined) {
				this.applyDebugLogging(newSettings.enableDebugLog);
			}
		} catch (error) {
			console.error('Error saving tools settings:', error);
		}
	}

	/**
	 * Apply debug logging setting
	 */
	private static applyDebugLogging(enable: boolean): void {
		try {
			// Update the Logger instance
			const logger = Logger.getInstance();
			logger.setDebugLoggingEnabled(enable);
			
			// Send IPC message to main process to update logging
			const { ipcRenderer } = require('electron');
			ipcRenderer.send('toggle-debug-logging', enable);
			
			// Log the change
			logger.info('ToolsManager', `Debug logging ${enable ? 'enabled' : 'disabled'}`);
		} catch (error) {
			console.error('Error applying debug logging setting:', error);
		}
	}

	/**
	 * Check if debug logging is enabled
	 */
	static isDebugLoggingEnabled(): boolean {
		return this.getSettings().enableDebugLog;
	}
}
