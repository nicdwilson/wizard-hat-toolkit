export interface BlueprintImportSettings {
	autoOverwritePlugins: boolean;
	autoOverwriteThemes: boolean;
	autoOverwriteSettings: boolean;
	skipConflicts: boolean;
	backupBeforeImport: boolean;
	notifyOnCompletion: boolean;
}

export class BlueprintSettingsManager {
	private static readonly SETTINGS_KEY = 'blueprint-import-settings';

	/**
	 * Get current import settings
	 */
	static getSettings(): BlueprintImportSettings {
		const defaultSettings: BlueprintImportSettings = {
			autoOverwritePlugins: false,
			autoOverwriteThemes: false,
			autoOverwriteSettings: false,
			skipConflicts: false,
			backupBeforeImport: true,
			notifyOnCompletion: true
		};

		try {
			// Use localStorage for renderer process
			const savedSettings = localStorage.getItem(this.SETTINGS_KEY);
			if (savedSettings) {
				return { ...defaultSettings, ...JSON.parse(savedSettings) };
			}
		} catch (error) {
			console.warn('Failed to load blueprint settings, using defaults:', error);
		}

		return defaultSettings;
	}

	/**
	 * Update import settings
	 */
	static updateSettings(settings: Partial<BlueprintImportSettings>): void {
		try {
			const currentSettings = this.getSettings();
			const updatedSettings = { ...currentSettings, ...settings };
			localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(updatedSettings));
		} catch (error) {
			console.error('Failed to save blueprint settings:', error);
			throw new Error('Failed to save blueprint settings');
		}
	}

	/**
	 * Reset settings to defaults
	 */
	static resetSettings(): void {
		try {
			localStorage.removeItem(this.SETTINGS_KEY);
		} catch (error) {
			console.error('Failed to reset blueprint settings:', error);
			throw new Error('Failed to reset blueprint settings');
		}
	}

	/**
	 * Get import options based on current settings
	 */
	static getImportOptions(): {
		overwritePlugins: boolean;
		overwriteThemes: boolean;
		overwriteSettings: boolean;
		skipConflicts: boolean;
	} {
		const settings = this.getSettings();
		return {
			overwritePlugins: settings.autoOverwritePlugins,
			overwriteThemes: settings.autoOverwriteThemes,
			overwriteSettings: settings.autoOverwriteSettings,
			skipConflicts: settings.skipConflicts
		};
	}

	/**
	 * Check if backup is enabled
	 */
	static isBackupEnabled(): boolean {
		return this.getSettings().backupBeforeImport;
	}

	/**
	 * Check if notifications are enabled
	 */
	static isNotificationEnabled(): boolean {
		return this.getSettings().notifyOnCompletion;
	}
}
