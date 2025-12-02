import * as LocalMain from '@getflywheel/local/main';
import { GitHubRepositoryInfo, DownloadResult } from '../types/PluginTypes';

/**
 * Utility class for GitHub interactions
 * Handles downloading plugins and themes from WooCommerce repositories
 * Uses Git commands only (no token required)
 */
export class GitHubClient {
    private githubToken: string | null;

    constructor(githubToken?: string | null) {
        this.githubToken = githubToken || null;
        // Token is stored but not used - Git commands are used exclusively
    }

    /**
     * Download a plugin from the local repository
     * Uses the user-configured local repository path instead of cloning
     */
    public async downloadPlugin(pluginSlug: string, outputPath: string): Promise<DownloadResult> {
        const fs = require('fs');
        const path = require('path');

        try {
            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                `Downloading plugin ${pluginSlug} from local repository`
            );

            // Get the user-configured repository path
            const repositoryPath = LocalMain.UserData.get('allPluginsRepositoryPath');
            if (!repositoryPath) {
                throw new Error('Repository path not configured. Please set up your repository path first.');
            }

            if (!fs.existsSync(repositoryPath)) {
                throw new Error(`Repository path does not exist: ${repositoryPath}`);
            }

            // Construct the path to the plugin zip file
            const pluginPath = path.join(repositoryPath, 'product-packages', pluginSlug, `${pluginSlug}.zip`);
            
            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                `Looking for plugin at: ${pluginPath}`
            );

            if (!fs.existsSync(pluginPath)) {
                throw new Error(`Plugin zip file not found at ${pluginPath}. Please ensure the repository is up to date and contains the plugin.`);
            }

            // Ensure output directory exists
            const outputDir = path.dirname(outputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // Copy the plugin zip file to the output path
            fs.copyFileSync(pluginPath, outputPath);

            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                `Successfully downloaded ${pluginSlug} from local repository`
            );
            return { success: true, filePath: outputPath };

        } catch (error) {
            LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                `Failed to download plugin ${pluginSlug}: ${error.message}`
            );
            return {
                success: false,
                error: `Failed to download plugin ${pluginSlug}: ${error.message}`
            };
        }
    }


    /**
     * Get download URL for a theme
     * Note: All themes are now from wordpress.org (all-themes repository no longer in use)
     */
    public async getThemeDownloadUrl(themeSlug: string): Promise<string> {
        throw new Error('All themes are from wordpress.org. Theme download via API is not available.');
    }

    /**
     * Download a file from GitHub to local filesystem
     * Note: API methods are not available - files should be downloaded via Git
     */
    public async downloadFile(fileUrl: string, outputPath: string): Promise<DownloadResult> {
        return {
            success: false,
            error: 'File download via API is not available. Please use Git-based download methods.'
        };
    }


    /**
     * Download a theme from GitHub
     */
    public async downloadTheme(themeSlug: string, outputPath: string): Promise<DownloadResult> {
        try {
            const downloadUrl = await this.getThemeDownloadUrl(themeSlug);
            return await this.downloadFile(downloadUrl, outputPath);
        } catch (error) {
            return {
                success: false,
                error: `Failed to download theme ${themeSlug}: ${error.message}`
            };
        }
    }

    /**
     * Get repository information
     * Note: API methods are not available
     */
    public async getRepositoryInfo(owner: string, repo: string): Promise<any> {
        throw new Error('Repository info via API is not available. Please use Git-based methods.');
    }

    /**
     * Get latest release for a repository
     * Note: API methods are not available
     */
    public async getLatestRelease(owner: string, repo: string): Promise<any> {
        throw new Error('Latest release via API is not available. Please use Git-based methods.');
    }

    /**
     * Check if GitHub token is valid
     * Note: Token validation via API is not available
     */
    public async validateToken(): Promise<boolean> {
        // Always return false since API is not available
        return false;
    }
}
