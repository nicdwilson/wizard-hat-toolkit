import * as LocalMain from '@getflywheel/local/main';
import { PluginRegistry } from './PluginRegistry';
import { PluginInstaller } from './PluginInstaller';
import { PluginDownloader } from './PluginDownloader';
import { Logger } from '../../utils/Logger';
import { 
    PluginData, 
    ThemeData, 
    PluginSelection,
    InstallationContext,
    PluginSource
} from './types/PluginTypes';
import { 
    InstallationResults, 
    BatchInstallationRequest, 
    BatchInstallationOptions,
    PluginInstallationRequest,
    ThemeInstallationRequest
} from './types/InstallationTypes';

const path = require('path');

/**
 * Main orchestrator for plugin and theme management
 * Provides a unified interface for all plugin-related operations
 */
export class PluginManager {
    private static instance: PluginManager;
    private registry: PluginRegistry;
    private installer: PluginInstaller | null = null;
    private downloader: PluginDownloader | null = null;
    private githubToken: string | null = null;
    private initialized: boolean = false;
    private currentSiteId: string | null = null;
    private logger: Logger;

    private constructor() {
        this.registry = PluginRegistry.getInstance();
        this.logger = Logger.getInstance();
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): PluginManager {
        if (!PluginManager.instance) {
            PluginManager.instance = new PluginManager();
        }
        return PluginManager.instance;
    }

    /**
     * Check if manager is initialized
     */
    public get isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Initialize the plugin manager
     * GitHub token is required for private repositories
     * @param progressCallback Optional callback for progress updates
     */
    public async initialize(context: any, githubToken?: string, progressCallback?: (status: string) => void): Promise<void> {
        console.log('[PluginManager] initialize called with:', { 
            hasContext: !!context, 
            hasGithubToken: !!githubToken,
            envToken: !!process.env.GITHUB_TOKEN 
        });

        if (this.initialized) {
            console.log('[PluginManager] Already initialized, skipping');
            return;
        }

        this.githubToken = githubToken || process.env.GITHUB_TOKEN || null;
        console.log('[PluginManager] GitHub token available:', !!this.githubToken);
        console.log('[PluginManager] Using Git-based access (no token required if git clone works)');
        
        // Token is optional - we'll use Git commands first, API as fallback
        
        try {
            console.log('[PluginManager] Initializing registry...');
            // Initialize registry - token is required for private repos
            await this.registry.initialize(this.githubToken, progressCallback);
            console.log('[PluginManager] Registry initialized successfully');
            
            this.initialized = true;
            console.log('[PluginManager] PluginManager initialization complete');
            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                'PluginManager initialized successfully'
            );
        } catch (error) {
            console.error('[PluginManager] Initialization failed:', error);
            LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                `Failed to initialize PluginManager: ${error.message}`
            );
            throw error;
        }
    }

    /**
     * Install plugins (main entry point)
     */
    public async installPlugins(
        site: any, 
        pluginSlugs: string[], 
        options: any = {}
    ): Promise<InstallationResults> {
        this.logger.info('PluginManager', 'installPlugins called', { pluginSlugs, options });
        
        try {
            await this.ensureInitialized(site);
            this.logger.info('PluginManager', 'PluginManager initialized successfully');

            const plugins: PluginData[] = pluginSlugs.map(slug => {
                const source = this.registry.getPluginSource(slug);
                this.logger.info('PluginManager', `Plugin ${slug} detected as source: ${source}`);
                return {
                    name: slug,
                    slug: slug,
                    version: 'latest',
                    active: true,
                    source: source
                };
            });

            this.logger.info('PluginManager', 'Mapped plugins', { plugins });

            this.logger.info('PluginManager', 'About to call installer.installPlugins...');

            const results = await this.installer!.installPlugins(plugins, {
                activate: options.activate !== false,
                force: options.force !== false,
                trackInstallation: true,
                cleanupFiles: true
            });

            this.logger.info('PluginManager', 'Installation results', { results });
            return results;
        } catch (error) {
            // Provide more helpful error messages for common issues
            if (error.message.includes('WordPress is not properly installed')) {
                this.logger.error('PluginManager', 'WordPress installation validation failed', { 
                    error: error.message,
                    siteId: site?.id,
                    sitePath: site?.path
                });
                throw new Error(`Cannot install plugins: ${error.message}`);
            } else if (error.message.includes('This does not seem to be a WordPress installation')) {
                this.logger.error('PluginManager', 'WP-CLI detected invalid WordPress installation', { 
                    error: error.message,
                    siteId: site?.id,
                    sitePath: site?.path
                });
                throw new Error(`Cannot install plugins: WordPress installation appears to be incomplete or corrupted at ${site?.path}. Please check the site in LocalWP and ensure WordPress is properly installed.`);
            } else {
                this.logger.error('PluginManager', 'Error in installPlugins', { error: error.message });
                throw error;
            }
        }
    }

    /**
     * Install themes (main entry point)
     */
    public async installThemes(
        site: any, 
        themeSlugs: string[], 
        options: any = {}
    ): Promise<InstallationResults> {
        await this.ensureInitialized(site);

        const themes: ThemeData[] = themeSlugs.map(slug => ({
            name: slug,
            slug: slug,
            version: 'latest',
            active: true,
            source: this.registry.getThemeSource(slug)
        }));

        return await this.installer!.installThemes(themes, {
            activate: options.activate !== false,
            force: options.force !== false,
            cleanupFiles: true
        });
    }

    /**
     * Install plugins with detailed configuration
     */
    public async installPluginsDetailed(
        site: any, 
        plugins: PluginData[], 
        options: any = {}
    ): Promise<InstallationResults> {
        await this.ensureInitialized(site);
        return await this.installer!.installPlugins(plugins, options);
    }

    /**
     * Install themes with detailed configuration
     */
    public async installThemesDetailed(
        site: any, 
        themes: ThemeData[], 
        options: any = {}
    ): Promise<InstallationResults> {
        await this.ensureInitialized(site);
        return await this.installer!.installThemes(themes, options);
    }

    /**
     * Batch install plugins and themes
     */
    public async batchInstall(
        site: any, 
        request: BatchInstallationRequest
    ): Promise<InstallationResults> {
        await this.ensureInitialized(site);

        const results: InstallationResults = {
            pluginsInstalled: 0,
            themesInstalled: 0,
            settingsApplied: 0,
            errors: [],
            results: []
        };

        // Install plugins
        if (request.plugins && request.plugins.length > 0) {
            const pluginResults = await this.installer!.installPlugins(
                request.plugins, 
                request.options.plugins
            );
            this.mergeResults(results, pluginResults);
        }

        // Install themes
        if (request.themes && request.themes.length > 0) {
            const themeResults = await this.installer!.installThemes(
                request.themes, 
                request.options.themes
            );
            this.mergeResults(results, themeResults);
        }

        // Apply settings using WP-CLI's JSON format support
        if (request.settings) {
            for (const [key, value] of Object.entries(request.settings)) {
                try {
                    await this.setOptionWithJson(site, key, value);
                    results.settingsApplied++;
                    results.results.push({
                        success: true,
                        item: key,
                        type: 'setting'
                    });
                } catch (error) {
                    results.errors.push(`Failed to apply setting ${key}: ${error.message}`);
                    results.results.push({
                        success: false,
                        item: key,
                        type: 'setting',
                        error: error.message
                    });
                }
            }
        }

        return results;
    }

    /**
     * Check if plugin is marketplace/premium
     */
    public isMarketplacePlugin(pluginSlug: string): boolean {
        return this.registry.isMarketplacePlugin(pluginSlug);
    }

    /**
     * Check if theme is marketplace/premium
     */
    public isMarketplaceTheme(themeSlug: string): boolean {
        return this.registry.isMarketplaceTheme(themeSlug);
    }

    /**
     * Get plugin source
     */
    public getPluginSource(pluginSlug: string): PluginSource {
        return this.registry.getPluginSource(pluginSlug);
    }

    /**
     * Get theme source
     */
    public getThemeSource(themeSlug: string): PluginSource {
        return this.registry.getThemeSource(themeSlug);
    }

    /**
     * Get premium plugin selections
     */
    public getPremiumPluginSelections(): PluginSelection[] {
        return this.registry.getPremiumPluginSelections();
    }

    /**
     * Get premium theme selections
     */
    public getPremiumThemeSelections(): PluginSelection[] {
        return this.registry.getPremiumThemeSelections();
    }

    /**
     * Get premium plugin info
     */
    public getPremiumPluginInfo(): any[] {
        return this.registry.getPremiumPluginInfo();
    }

    /**
     * Get premium theme info
     */
    public getPremiumThemeInfo(): any[] {
        return this.registry.getPremiumThemeInfo();
    }

    /**
     * Track installed plugin
     */
    public trackInstalledPlugin(pluginName: string): void {
        this.registry.trackInstalledPlugin(pluginName);
    }

    /**
     * Get tracked plugins
     */
    public getTrackedPlugins(): string[] {
        return this.registry.getTrackedPlugins();
    }

    /**
     * Refresh registry data
     */
    public async refreshRegistry(): Promise<void> {
        await this.registry.refresh();
    }

    /**
     * Force refresh registry data with progress callback
     */
    public async forceRefresh(progressCallback?: (status: string) => void): Promise<void> {
        await this.registry.forceRefresh(progressCallback);
    }

    /**
     * Get the plugin registry instance
     */
    public getRegistry(): PluginRegistry {
        return this.registry;
    }

    /**
     * Check if registry needs refresh
     */
    public needsRefresh(): boolean {
        return this.registry.needsRefresh();
    }

    /**
     * Download plugins without installing
     */
    public async downloadPlugins(site: any, pluginSlugs: string[]): Promise<string[]> {
        await this.ensureInitialized(site);
        return await this.downloader!.downloadPluginsBySlug(pluginSlugs);
    }

    /**
     * Download themes without installing
     */
    public async downloadThemes(site: any, themeSlugs: string[]): Promise<string[]> {
        await this.ensureInitialized(site);
        return await this.downloader!.downloadThemesBySlug(themeSlugs);
    }

    /**
     * Apply plugin settings
     */
    public async applyPluginSettings(
        site: any, 
        pluginSlug: string, 
        settings: Record<string, any>
    ): Promise<void> {
        await this.ensureInitialized(site);
        await this.installer!.applyPluginSettings(pluginSlug, settings);
    }

    /**
     * Apply theme settings
     */
    public async applyThemeSettings(
        site: any, 
        themeSlug: string, 
        settings: Record<string, any>
    ): Promise<void> {
        await this.ensureInitialized(site);
        await this.installer!.applyThemeSettings(themeSlug, settings);
    }

    /**
     * Check if plugin is installed
     */
    public async isPluginInstalled(site: any, pluginSlug: string): Promise<boolean> {
        await this.ensureInitialized(site);
        return await this.installer!.isPluginInstalled(pluginSlug);
    }

    /**
     * Check if theme is installed
     */
    public async isThemeInstalled(site: any, themeSlug: string): Promise<boolean> {
        await this.ensureInitialized(site);
        return await this.installer!.isThemeInstalled(themeSlug);
    }

    /**
     * Ensure the manager is initialized for a site
     */
    private async ensureInitialized(site: any): Promise<void> {
        if (!this.initialized) {
            throw new Error('PluginManager must be initialized before use');
        }

        // Check if we need to recreate installer/downloader for a different site
        const siteId = site?.id;
        if (!this.installer || !this.downloader || this.currentSiteId !== siteId) {
            this.logger.info('PluginManager', 'Creating installer and downloader for site', { 
                siteId, 
                previousSiteId: this.currentSiteId,
                hasInstaller: !!this.installer,
                hasDownloader: !!this.downloader
            });

            // Get the correct user data path - use the same path as our logging
            const userDataPath = path.join(process.env.HOME || '', 'Library', 'Application Support', 'Local');
            
            const context: InstallationContext = {
                site,
                context: null, // Will be set by caller if needed
                userDataPath: userDataPath,
                githubToken: this.githubToken || undefined
            };

            // Token is optional - Git will be used first, API as fallback
            this.installer = new PluginInstaller(context, this.githubToken || undefined);
            this.downloader = new PluginDownloader(context.userDataPath, this.githubToken || undefined);
            this.currentSiteId = siteId;

            this.logger.info('PluginManager', 'Installer and downloader created for site', { siteId });
        }
    }

    /**
     * Merge installation results
     */
    private mergeResults(target: InstallationResults, source: InstallationResults): void {
        target.pluginsInstalled += source.pluginsInstalled;
        target.themesInstalled += source.themesInstalled;
        target.settingsApplied += source.settingsApplied;
        target.errors.push(...source.errors);
        target.results.push(...source.results);
    }

    /**
     * Set a WordPress option using WP-CLI's JSON format support
     * This leverages WP-CLI's built-in serialization instead of manual string conversion
     */
    private async setOptionWithJson(site: any, key: string, value: any): Promise<void> {
        this.logger.info('PluginManager', `Setting option: ${key}`, { 
            value, 
            valueType: typeof value,
            isArray: Array.isArray(value)
        });

        try {
            // For simple values, use the standard approach
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                this.logger.debug('PluginManager', `Using standard approach for simple value: ${key}`, { value });
                await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                    'option',
                    'set',
                    key,
                    String(value)
                ]);
                this.logger.info('PluginManager', `Successfully set simple option: ${key} = ${String(value)}`);
                return;
            }

            // For complex values (objects, arrays), use WP-CLI's JSON format
            const jsonValue = JSON.stringify(value);
            this.logger.debug('PluginManager', `Using JSON format for complex value: ${key}`, { jsonValue });
            
            // Use WP-CLI's --format=json flag with the JSON value as the last argument
            await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                'option',
                'set',
                key,
                '--format=json',
                jsonValue
            ]);
            this.logger.info('PluginManager', `Successfully set complex option with JSON format: ${key}`);

        } catch (error) {
            // Fallback to standard approach if JSON format fails
            this.logger.warn('PluginManager', `JSON format failed for ${key}, falling back to string conversion`, { error: error.message });
            await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                'option',
                'set',
                key,
                JSON.stringify(value)
            ]);
            this.logger.info('PluginManager', `Successfully set option with fallback method: ${key}`);
        }
    }

    /**
     * Legacy method for compatibility with existing installPlugins function
     */
    public async installPluginsLegacy(pluginsToInstall: string[], site: any): Promise<void> {
        this.logger.info('PluginManager', 'installPluginsLegacy called', { pluginsToInstall, siteId: site?.id });
        
        try {
            this.logger.info('PluginManager', 'About to call installPlugins', { siteId: site?.id });
            
            const results = await this.installPlugins(site, pluginsToInstall);
            
            this.logger.info('PluginManager', 'Legacy installation completed', { results });
            
            this.logger.info('PluginManager', 'Results breakdown', { 
                pluginsInstalled: results.pluginsInstalled, 
                errors: results.errors.length, 
                results: results.results.length 
            });
            
            // Log each individual result
            results.results.forEach((result, index) => {
                this.logger.info('PluginManager', `Result ${index}`, { result });
            });
            
            if (results.errors.length > 0) {
                this.logger.error('PluginManager', 'Installation completed with errors', { errors: results.errors });
            } else {
                this.logger.info('PluginManager', `Successfully installed ${results.pluginsInstalled} plugins`);
            }
        } catch (error) {
            this.logger.error('PluginManager', 'Legacy installation failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Legacy method for compatibility with existing installThemes function
     */
    public async installThemesLegacy(themesToInstall: string[], site: any): Promise<void> {
        try {
            const results = await this.installThemes(site, themesToInstall);
            
            if (results.errors.length > 0) {
                LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                    `Theme installation completed with errors: ${results.errors.join(', ')}`
                );
            } else {
                LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                    `Successfully installed ${results.themesInstalled} themes`
                );
            }
        } catch (error) {
            LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                `Theme installation failed: ${error.message}`
            );
            throw error;
        }
    }
}
