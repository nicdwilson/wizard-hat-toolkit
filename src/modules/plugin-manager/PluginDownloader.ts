import * as LocalMain from '@getflywheel/local/main';
import { GitHubClient } from './utils/GitHubClient';
import { PluginRegistry } from './PluginRegistry';
import { PluginData, ThemeData, DownloadResult } from './types/PluginTypes';
import { Logger } from '../../utils/Logger';

// File system imports
const fs = require('fs');
const path = require('path');

/**
 * Handles downloading of plugins and themes from various sources
 * Centralizes the download logic for marketplace and GitHub-based resources
 */
export class PluginDownloader {
    private githubClient: GitHubClient;
    private registry: PluginRegistry;
    private userDataPath: string;
    private logger: Logger;

    constructor(userDataPath: string, githubToken: string) {
        this.userDataPath = userDataPath;
        this.githubClient = new GitHubClient(githubToken);
        this.registry = PluginRegistry.getInstance();
        this.logger = Logger.getInstance(userDataPath);
    }

    /**
     * Download multiple plugins
     */
    public async downloadPlugins(plugins: PluginData[]): Promise<string[]> {
        const downloadedFiles: string[] = [];
        
        this.logger.info('PluginDownloader', `Starting download of ${plugins.length} plugins`);

        for (const plugin of plugins) {
            try {
                this.logger.info('PluginDownloader', `Attempting to download plugin: ${plugin.name}`, { source: plugin.source });
                
                const filePath = await this.downloadPlugin(plugin);
                if (filePath) {
                    downloadedFiles.push(filePath);
                    this.logger.info('PluginDownloader', `Successfully downloaded ${plugin.name}`, { filePath });
                } else {
                    this.logger.warn('PluginDownloader', `downloadPlugin returned null for ${plugin.name}`);
                }
            } catch (error) {
                this.logger.error('PluginDownloader', `Failed to download plugin ${plugin.name}`, { error: error.message });
                // Continue with other plugins even if one fails
            }
        }

        this.logger.info('PluginDownloader', `Successfully downloaded ${downloadedFiles.length}/${plugins.length} plugins`);

        return downloadedFiles;
    }

    /**
     * Download multiple themes
     */
    public async downloadThemes(themes: ThemeData[]): Promise<string[]> {
        const downloadedFiles: string[] = [];
        
        this.logger.info('PluginDownloader', `Starting download of ${themes.length} themes`);

        for (const theme of themes) {
            try {
                const filePath = await this.downloadTheme(theme);
                if (filePath) {
                    downloadedFiles.push(filePath);
                }
            } catch (error) {
                this.logger.error('PluginDownloader', `Failed to download theme ${theme.name}`, { error: error.message });
                // Continue with other themes even if one fails
            }
        }

        this.logger.info('PluginDownloader', `Successfully downloaded ${downloadedFiles.length}/${themes.length} themes`);

        return downloadedFiles;
    }

    /**
     * Download a single plugin
     */
    public async downloadPlugin(plugin: PluginData): Promise<string | null> {
        // Use a proper temp directory
        const tempDir = path.join(this.userDataPath, 'addons', 'wizard-hat-toolkit', 'temp');
        
        // Ensure temp directory exists
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Use simple filename without timestamp - WP-CLI expects standard plugin naming
        const outputPath = path.join(tempDir, `${plugin.slug}.zip`);
        
        try {
            this.logger.info('PluginDownloader', `Downloading plugin ${plugin.name}`, { source: plugin.source });

            let result: DownloadResult;

            switch (plugin.source) {
                case 'marketplace':
                case 'premium':
                    result = await this.githubClient.downloadPlugin(plugin.slug, outputPath);
                    break;
                case 'github':
                    // For GitHub plugins, we'd need to implement GitHub-specific logic
                    // For now, treat as marketplace
                    result = await this.githubClient.downloadPlugin(plugin.slug, outputPath);
                    break;
                case 'wordpress.org':
                    // WordPress.org plugins don't need downloading - they're installed directly
                    return null;
                default:
                    throw new Error(`Unsupported plugin source: ${plugin.source}`);
            }

            if (result.success && result.filePath) {
                this.logger.info('PluginDownloader', `Successfully downloaded ${plugin.name}`, { filePath: result.filePath });
                return result.filePath;
            } else {
                throw new Error(result.error || 'Download failed');
            }
        } catch (error) {
            this.logger.error('PluginDownloader', `Failed to download plugin ${plugin.name}`, { error: error.message });
            throw error;
        }
    }

    /**
     * Download a single theme
     */
    public async downloadTheme(theme: ThemeData): Promise<string | null> {
        // Use a proper temp directory
        const tempDir = path.join(this.userDataPath, 'addons', 'wizard-hat-toolkit', 'temp');
        
        // Ensure temp directory exists
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Use simple filename without timestamp - WP-CLI expects standard theme naming
        const outputPath = path.join(tempDir, `${theme.slug}.zip`);
        
        try {
            this.logger.info('PluginDownloader', `Downloading theme ${theme.name}`, { source: theme.source });

            let result: DownloadResult;

            switch (theme.source) {
                case 'marketplace':
                case 'premium':
                    result = await this.githubClient.downloadTheme(theme.slug, outputPath);
                    break;
                case 'github':
                    // For GitHub themes, we'd need to implement GitHub-specific logic
                    // For now, treat as marketplace
                    result = await this.githubClient.downloadTheme(theme.slug, outputPath);
                    break;
                case 'wordpress.org':
                    // WordPress.org themes don't need downloading - they're installed directly
                    return null;
                default:
                    throw new Error(`Unsupported theme source: ${theme.source}`);
            }

            if (result.success && result.filePath) {
                this.logger.info('PluginDownloader', `Successfully downloaded ${theme.name}`, { filePath: result.filePath });
                return result.filePath;
            } else {
                throw new Error(result.error || 'Download failed');
            }
        } catch (error) {
            this.logger.error('PluginDownloader', `Failed to download theme ${theme.name}`, { error: error.message });
            throw error;
        }
    }

    /**
     * Download plugins by slug (legacy method for compatibility)
     */
    public async downloadPluginsBySlug(pluginSlugs: string[]): Promise<string[]> {
        const plugins: PluginData[] = pluginSlugs.map(slug => ({
            name: slug,
            slug: slug,
            version: 'latest',
            active: true,
            source: this.registry.getPluginSource(slug)
        }));

        return await this.downloadPlugins(plugins);
    }

    /**
     * Download themes by slug (legacy method for compatibility)
     */
    public async downloadThemesBySlug(themeSlugs: string[]): Promise<string[]> {
        const themes: ThemeData[] = themeSlugs.map(slug => ({
            name: slug,
            slug: slug,
            version: 'latest',
            active: true,
            source: this.registry.getThemeSource(slug)
        }));

        return await this.downloadThemes(themes);
    }

    /**
     * Clean up downloaded files
     */
    public async cleanupFiles(filePaths: string[]): Promise<void> {
        const fs = require('fs');
        
        for (const filePath of filePaths) {
            try {
                await fs.promises.unlink(filePath);
                this.logger.info('PluginDownloader', `Cleaned up file: ${filePath}`);
            } catch (error) {
                this.logger.warn('PluginDownloader', `Failed to clean up file ${filePath}`, { error: error.message });
            }
        }
    }

    /**
     * Get download path for a plugin
     */
    public getPluginDownloadPath(pluginSlug: string): string {
        const tempDir = path.join(this.userDataPath, 'addons', 'wizard-hat-toolkit', 'temp');
        return path.join(tempDir, `${pluginSlug}.zip`);
    }

    /**
     * Get download path for a theme
     */
    public getThemeDownloadPath(themeSlug: string): string {
        const tempDir = path.join(this.userDataPath, 'addons', 'wizard-hat-toolkit', 'temp');
        return path.join(tempDir, `${themeSlug}.zip`);
    }
}
