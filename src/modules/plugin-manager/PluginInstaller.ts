import * as LocalMain from '@getflywheel/local/main';
import { PluginRegistry } from './PluginRegistry';
import { PluginDownloader } from './PluginDownloader';
import { 
    PluginData, 
    ThemeData, 
    InstallationOptions,
    PluginInstallationOptions,
    ThemeInstallationOptions,
    InstallationContext
} from './types/PluginTypes';
import { InstallationResults, InstallationProgress } from './types/InstallationTypes';
import { Logger } from '../../utils/Logger';

/**
 * Handles installation of plugins and themes
 * Manages the actual WP-CLI commands and installation logic
 */
export class PluginInstaller {
    private registry: PluginRegistry;
    private downloader: PluginDownloader;
    private context: InstallationContext;
    private logger: Logger;

    constructor(context: InstallationContext, githubToken: string) {
        this.context = context;
        this.registry = PluginRegistry.getInstance();
        this.downloader = new PluginDownloader(context.userDataPath, githubToken);
        this.logger = Logger.getInstance(context.userDataPath);
    }

    /**
     * Install multiple plugins
     */
    public async installPlugins(
        plugins: PluginData[], 
        options: PluginInstallationOptions = {}
    ): Promise<InstallationResults> {
        this.logger.info('PluginInstaller', 'installPlugins called', { plugins, options });
        
        const results: InstallationResults = {
            pluginsInstalled: 0,
            themesInstalled: 0,
            settingsApplied: 0,
            errors: [],
            results: []
        };

        this.logger.info('PluginInstaller', `Starting installation of ${plugins.length} plugins`);

        // Separate plugins by source
        const marketplacePlugins = plugins.filter(p => 
            p.source === 'marketplace' || p.source === 'premium'
        );
        const wordpressPlugins = plugins.filter(p => p.source === 'wordpress.org');

        this.logger.info('PluginInstaller', 'Plugin separation', {
            marketplace: marketplacePlugins.length,
            wordpress: wordpressPlugins.length,
            marketplacePlugins: marketplacePlugins.map(p => p.name),
            wordpressPlugins: wordpressPlugins.map(p => p.name)
        });

        // Download marketplace plugins first
        let downloadedFiles: string[] = [];
        if (marketplacePlugins.length > 0) {
            try {
                this.logger.info('PluginInstaller', 'Downloading marketplace plugins...');
                downloadedFiles = await this.downloader.downloadPlugins(marketplacePlugins);
                this.logger.info('PluginInstaller', 'Downloaded files', { downloadedFiles });
            } catch (error) {
                this.logger.error('PluginInstaller', 'Failed to download marketplace plugins', { error: error.message });
                results.errors.push(`Failed to download marketplace plugins: ${error.message}`);
            }
        } else {
            this.logger.info('PluginInstaller', 'No marketplace plugins to download');
        }

        // Combine downloaded files with WordPress.org plugin slugs
        const allPlugins = [...downloadedFiles, ...wordpressPlugins.map(p => p.slug)];
        this.logger.info('PluginInstaller', 'All plugins to install', { allPlugins });

        // Install all plugins
        for (let i = 0; i < allPlugins.length; i++) {
            const plugin = allPlugins[i];
            const originalPlugin = plugins[i];

            this.logger.info('PluginInstaller', `Installing plugin ${i + 1}/${allPlugins.length}`, {
                plugin,
                originalPlugin: originalPlugin.name,
                source: originalPlugin.source
            });

            try {
                await this.installSinglePlugin(plugin, originalPlugin, options);
                results.pluginsInstalled++;
                results.results.push({
                    success: true,
                    item: originalPlugin.name,
                    type: 'plugin',
                    method: this.getInstallationMethod(originalPlugin.source)
                });

                this.logger.info('PluginInstaller', `Successfully installed: ${originalPlugin.name}`);

                // Track marketplace plugin installation
                if (originalPlugin.source === 'marketplace' || originalPlugin.source === 'premium') {
                    this.registry.trackInstalledPlugin(originalPlugin.slug);
                    this.logger.info('PluginInstaller', `Tracked marketplace plugin: ${originalPlugin.slug}`);
                }
            } catch (error) {
                this.logger.error('PluginInstaller', `Failed to install ${originalPlugin.name}`, { error: error.message });
                results.errors.push(`Failed to install plugin ${originalPlugin.name}: ${error.message}`);
                results.results.push({
                    success: false,
                    item: originalPlugin.name,
                    type: 'plugin',
                    error: error.message
                });
            }
        }

        // Clean up downloaded files if requested
        if (options.cleanupFiles !== false && downloadedFiles.length > 0) {
            await this.downloader.cleanupFiles(downloadedFiles);
        }

        this.logger.info('PluginInstaller', `Plugin installation completed: ${results.pluginsInstalled}/${plugins.length} successful`);

        return results;
    }

    /**
     * Install multiple themes
     */
    public async installThemes(
        themes: ThemeData[], 
        options: ThemeInstallationOptions = {}
    ): Promise<InstallationResults> {
        const results: InstallationResults = {
            pluginsInstalled: 0,
            themesInstalled: 0,
            settingsApplied: 0,
            errors: [],
            results: []
        };

        this.logger.info('PluginInstaller', `Starting installation of ${themes.length} themes`);

        // Separate themes by source
        const marketplaceThemes = themes.filter(t => 
            t.source === 'marketplace' || t.source === 'premium'
        );
        const wordpressThemes = themes.filter(t => t.source === 'wordpress.org');

        // Download marketplace themes first
        let downloadedFiles: string[] = [];
        if (marketplaceThemes.length > 0) {
            try {
                downloadedFiles = await this.downloader.downloadThemes(marketplaceThemes);
            } catch (error) {
                results.errors.push(`Failed to download marketplace themes: ${error.message}`);
            }
        }

        // Combine downloaded files with WordPress.org theme slugs
        const allThemes = [...downloadedFiles, ...wordpressThemes.map(t => t.slug)];

        // Install all themes
        for (let i = 0; i < allThemes.length; i++) {
            const theme = allThemes[i];
            const originalTheme = themes[i];

            try {
                await this.installSingleTheme(theme, originalTheme, options);
                results.themesInstalled++;
                results.results.push({
                    success: true,
                    item: originalTheme.name,
                    type: 'theme',
                    method: this.getInstallationMethod(originalTheme.source)
                });
            } catch (error) {
                results.errors.push(`Failed to install theme ${originalTheme.name}: ${error.message}`);
                results.results.push({
                    success: false,
                    item: originalTheme.name,
                    type: 'theme',
                    error: error.message
                });
            }
        }

        // Clean up downloaded files if requested
        if (options.cleanupFiles !== false && downloadedFiles.length > 0) {
            await this.downloader.cleanupFiles(downloadedFiles);
        }

        this.logger.info('PluginInstaller', `Theme installation completed: ${results.themesInstalled}/${themes.length} successful`);

        return results;
    }

    /**
     * Install a single plugin
     */
    private async installSinglePlugin(
        plugin: string, 
        originalPlugin: PluginData, 
        options: PluginInstallationOptions
    ): Promise<void> {
        this.logger.info('PluginInstaller', 'installSinglePlugin called', {
            plugin,
            originalPlugin: originalPlugin.name,
            options
        });

        // Debug: Log the site object to understand its structure
        this.logger.debug('PluginInstaller', 'Site object', {
            siteId: this.context.site?.id,
            siteName: this.context.site?.name,
            sitePath: this.context.site?.path,
            siteKeys: Object.keys(this.context.site || {})
        });

        const command = ['plugin', 'install'];

        // Handle file paths with spaces by properly escaping them
        if (this.isFilePath(plugin)) {
            // For file paths, we need to ensure they're properly handled
            command.push(this.escapePath(plugin));
        } else {
            // For plugin slugs, use as-is
            command.push(plugin);
        }

        if (options.activate !== false) {
            command.push('--activate');
        }

        if (options.force !== false) {
            command.push('--force');
        }

        if (originalPlugin.version && originalPlugin.source === 'wordpress.org') {
            command.push('--version', originalPlugin.version);
        }

        // Debug: Log the final command array
        this.logger.debug('PluginInstaller', 'Final command array', { command });

        this.logger.info('PluginInstaller', `WP-CLI command: ${command.join(' ')}`, { plugin: originalPlugin.name });

        try {
            await LocalMain.getServiceContainer().cradle.wpCli.run(this.context.site, command);
            this.logger.info('PluginInstaller', `WP-CLI command completed successfully for: ${originalPlugin.name}`);
        } catch (error) {
            this.logger.error('PluginInstaller', `WP-CLI command failed for ${originalPlugin.name}`, { error: error.message });
            throw error;
        }

        this.logger.info('PluginInstaller', `Successfully installed plugin: ${originalPlugin.name}`);
    }

    /**
     * Install a single theme
     */
    private async installSingleTheme(
        theme: string, 
        originalTheme: ThemeData, 
        options: ThemeInstallationOptions
    ): Promise<void> {
        const command = ['theme', 'install', theme];

        if (originalTheme.version && originalTheme.source === 'wordpress.org') {
            command.push('--version', originalTheme.version);
        }

        this.logger.info('PluginInstaller', `Installing theme: ${originalTheme.name} with command: ${command.join(' ')}`);

        await LocalMain.getServiceContainer().cradle.wpCli.run(this.context.site, command);

        // Activate theme if specified
        if (originalTheme.active && options.activate !== false) {
            await LocalMain.getServiceContainer().cradle.wpCli.run(this.context.site, [
                'theme', 'activate', originalTheme.slug
            ]);
        }

        this.logger.info('PluginInstaller', `Successfully installed theme: ${originalTheme.name}`);
    }

    /**
     * Apply plugin settings using WP-CLI's JSON format support
     */
    public async applyPluginSettings(
        pluginSlug: string, 
        settings: Record<string, any>
    ): Promise<void> {
        for (const [key, value] of Object.entries(settings)) {
            try {
                await this.setOptionWithJson(key, value);
                this.logger.info('PluginInstaller', `Applied setting ${key} for plugin ${pluginSlug}`);
            } catch (error) {
                this.logger.warn('PluginInstaller', `Failed to apply plugin setting ${key} for ${pluginSlug}`, { error: error.message });
            }
        }
    }

    /**
     * Apply theme settings using WP-CLI's JSON format support
     */
    public async applyThemeSettings(
        themeSlug: string, 
        settings: Record<string, any>
    ): Promise<void> {
        for (const [key, value] of Object.entries(settings)) {
            try {
                await this.setOptionWithJson(key, value);
                this.logger.info('PluginInstaller', `Applied setting ${key} for theme ${themeSlug}`);
            } catch (error) {
                this.logger.warn('PluginInstaller', `Failed to apply theme setting ${key} for ${themeSlug}`, { error: error.message });
            }
        }
    }

    /**
     * Check if plugin is installed
     */
    public async isPluginInstalled(pluginSlug: string): Promise<boolean> {
        try {
            const result = await LocalMain.getServiceContainer().cradle.wpCli.run(this.context.site, [
                'plugin', 'list', '--format=json'
            ]);
            
            const plugins = JSON.parse(result);
            return plugins.some((plugin: any) => plugin.name === pluginSlug);
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if theme is installed
     */
    public async isThemeInstalled(themeSlug: string): Promise<boolean> {
        try {
            const result = await LocalMain.getServiceContainer().cradle.wpCli.run(this.context.site, [
                'theme', 'list', '--format=json'
            ]);
            
            const themes = JSON.parse(result);
            return themes.some((theme: any) => theme.name === themeSlug);
        } catch (error) {
            return false;
        }
    }

    /**
     * Get installation method string
     */
    private getInstallationMethod(source: string): string {
        switch (source) {
            case 'marketplace':
            case 'premium':
                return 'marketplace';
            case 'github':
                return 'github';
            case 'wordpress.org':
                return 'wordpress.org';
            default:
                return 'unknown';
        }
    }

    /**
     * Check if a string is a file path (contains path separators or file extension)
     */
    private isFilePath(input: string): boolean {
        return input.includes('/') || input.includes('\\') || input.endsWith('.zip');
    }

    /**
     * Escape a file path for use in WP-CLI commands
     * This handles spaces and special characters in paths
     */
    private escapePath(filePath: string): string {
        // Don't add quotes - LocalWP's wpCli.run() should handle the escaping internally
        // The quotes were causing WP-CLI to treat it as a plugin slug instead of a file path
        return filePath;
    }

    /**
     * Set a WordPress option using WP-CLI's JSON format support
     * This leverages WP-CLI's built-in serialization instead of manual string conversion
     */
    private async setOptionWithJson(key: string, value: any): Promise<void> {
        try {
            // For simple values, use the standard approach
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                await LocalMain.getServiceContainer().cradle.wpCli.run(this.context.site, [
                    'option',
                    'set',
                    key,
                    String(value)
                ]);
                return;
            }

            // For complex values (objects, arrays), use WP-CLI's JSON format
            const jsonValue = JSON.stringify(value);
            
            // Use WP-CLI's --format=json flag with the JSON value as the last argument
            await LocalMain.getServiceContainer().cradle.wpCli.run(this.context.site, [
                'option',
                'set',
                key,
                '--format=json',
                jsonValue
            ]);

        } catch (error) {
            // Fallback to standard approach if JSON format fails
            this.logger.warn('PluginInstaller', `JSON format failed for ${key}, falling back to string conversion`, { error: error.message });
            await LocalMain.getServiceContainer().cradle.wpCli.run(this.context.site, [
                'option',
                'set',
                key,
                JSON.stringify(value)
            ]);
        }
    }

    /**
     * Legacy method for installing plugins by slug (compatibility with existing code)
     */
    public async installPluginsBySlug(
        pluginSlugs: string[], 
        options: PluginInstallationOptions = {}
    ): Promise<InstallationResults> {
        const plugins: PluginData[] = pluginSlugs.map(slug => ({
            name: slug,
            slug: slug,
            version: 'latest',
            active: true,
            source: this.registry.getPluginSource(slug)
        }));

        return await this.installPlugins(plugins, options);
    }

    /**
     * Legacy method for installing themes by slug (compatibility with existing code)
     */
    public async installThemesBySlug(
        themeSlugs: string[], 
        options: ThemeInstallationOptions = {}
    ): Promise<InstallationResults> {
        const themes: ThemeData[] = themeSlugs.map(slug => ({
            name: slug,
            slug: slug,
            version: 'latest',
            active: true,
            source: this.registry.getThemeSource(slug)
        }));

        return await this.installThemes(themes, options);
    }
}
