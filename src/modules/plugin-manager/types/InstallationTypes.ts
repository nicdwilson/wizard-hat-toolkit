/**
 * Installation-specific types and interfaces
 */

import { PluginData, ThemeData, InstallationOptions, PluginInstallationOptions, ThemeInstallationOptions, InstallationContext } from './PluginTypes';

export interface InstallationProgress {
    total: number;
    completed: number;
    current: string;
    errors: string[];
}

export interface InstallationResults {
    pluginsInstalled: number;
    themesInstalled: number;
    settingsApplied: number;
    errors: string[];
    results: InstallationResult[];
}

export interface InstallationResult {
    success: boolean;
    item: string;
    type: 'plugin' | 'theme' | 'setting';
    method?: string;
    error?: string;
}

export interface BatchInstallationOptions {
    plugins: PluginInstallationOptions;
    themes: ThemeInstallationOptions;
    settings: {
        overwrite: boolean;
        skipConflicts: boolean;
    };
}


export interface PluginInstallationRequest {
    plugins: PluginData[];
    options: PluginInstallationOptions;
}

export interface ThemeInstallationRequest {
    themes: ThemeData[];
    options: ThemeInstallationOptions;
}

export interface BatchInstallationRequest {
    plugins?: PluginData[];
    themes?: ThemeData[];
    settings?: Record<string, any>;
    options: BatchInstallationOptions;
}
