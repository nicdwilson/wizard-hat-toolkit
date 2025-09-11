import * as LocalMain from '@getflywheel/local/main';

export interface UpdateSettings {
    autoUpdate: boolean;
    updateOnStartup: boolean;
    notifyOnUpdates: boolean;
    excludedPlugins: string[];
    lastUpdateCheck: string | null;
}

export class UpdateSettingsManager {
    private static readonly DEFAULT_SETTINGS: UpdateSettings = {
        autoUpdate: true,
        updateOnStartup: true,
        notifyOnUpdates: true,
        excludedPlugins: [],
        lastUpdateCheck: null
    };

    static getSettings(): UpdateSettings {
        const settings = LocalMain.UserData.get('pluginUpdateSettings');
        return settings ? { ...this.DEFAULT_SETTINGS, ...settings } : this.DEFAULT_SETTINGS;
    }

    static updateSettings(newSettings: Partial<UpdateSettings>): void {
        const currentSettings = this.getSettings();
        const updatedSettings = { ...currentSettings, ...newSettings };
        LocalMain.UserData.set('pluginUpdateSettings', updatedSettings);
    }

    static isAutoUpdateEnabled(): boolean {
        return this.getSettings().autoUpdate;
    }

    static isUpdateOnStartupEnabled(): boolean {
        return this.getSettings().updateOnStartup;
    }

    static isNotifyOnUpdatesEnabled(): boolean {
        return this.getSettings().notifyOnUpdates;
    }

    static isPluginExcluded(pluginName: string): boolean {
        return this.getSettings().excludedPlugins.includes(pluginName);
    }

    static excludePlugin(pluginName: string): void {
        const settings = this.getSettings();
        if (!settings.excludedPlugins.includes(pluginName)) {
            settings.excludedPlugins.push(pluginName);
            this.updateSettings(settings);
        }
    }

    static includePlugin(pluginName: string): void {
        const settings = this.getSettings();
        settings.excludedPlugins = settings.excludedPlugins.filter(name => name !== pluginName);
        this.updateSettings(settings);
    }

    static setLastUpdateCheck(date: Date): void {
        this.updateSettings({ lastUpdateCheck: date.toISOString() });
    }

    static getLastUpdateCheck(): Date | null {
        const lastCheck = this.getSettings().lastUpdateCheck;
        return lastCheck ? new Date(lastCheck) : null;
    }
}
