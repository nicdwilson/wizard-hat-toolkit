/**
 * Core plugin types and interfaces for the plugin management system
 */

export interface PluginInfo {
    name: string;
    slug: string;
    version: string;
    status: string;
    mainFile: string;
    isMarketplace: boolean;
    source: PluginSource;
}

export interface PluginSelection {
    label: string;
    value: string;
    name?: string;
}

export interface PluginData {
    name: string;
    slug: string;
    version?: string;
    active: boolean;
    source: PluginSource;
    settings?: Record<string, any>;
}

export interface ThemeData {
    name: string;
    slug: string;
    version?: string;
    active: boolean;
    source: PluginSource;
    settings?: Record<string, any>;
}

export type PluginSource = 'wordpress.org' | 'github' | 'premium' | 'marketplace';

export interface UpdateInfo {
    plugin: PluginInfo;
    updateInfo: {
        new_version: string;
        package: string;
        url: string;
    };
}


export interface InstallationOptions {
    activate?: boolean;
    force?: boolean;
    overwrite?: boolean;
    skipConflicts?: boolean;
}

export interface PluginInstallationOptions extends InstallationOptions {
    trackInstallation?: boolean;
    cleanupFiles?: boolean;
}

export interface ThemeInstallationOptions extends InstallationOptions {
    cleanupFiles?: boolean;
}

export interface InstallationContext {
    site: any;
    context: any;
    userDataPath: string;
    githubToken?: string;
}

export interface PluginRegistryData {
    premiumPlugins: PluginSelection[];
    premiumThemes: PluginSelection[];
    pluginInfo: any[];
    themeInfo: any[];
    lastUpdated: Date;
}

export interface GitHubRepositoryInfo {
    owner: string;
    repo: string;
    path: string;
}

export interface DownloadResult {
    success: boolean;
    filePath?: string;
    error?: string;
}
