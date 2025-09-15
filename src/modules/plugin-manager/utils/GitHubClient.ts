import * as LocalMain from '@getflywheel/local/main';
import { GitHubRepositoryInfo, DownloadResult } from '../types/PluginTypes';

/**
 * Utility class for GitHub API interactions
 * Handles downloading plugins and themes from WooCommerce repositories
 */
export class GitHubClient {
    private octokit: any;
    private githubToken: string;

    constructor(githubToken: string) {
        this.githubToken = githubToken;
        const { Octokit } = require("@octokit/rest");
        this.octokit = new Octokit({ auth: githubToken });
    }

    /**
     * Get download URL for a plugin from WooCommerce all-plugins repository
     */
    public async getPluginDownloadUrl(pluginSlug: string): Promise<string> {
        const path = `product-packages/${pluginSlug}`;
        
        try {
            const { data } = await this.octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
                owner: 'woocommerce',
                repo: 'all-plugins',
                path: path,
            });

            // Find the zip file with the exact plugin slug name
            const zipFile = data.find((file: any) => file.name === `${pluginSlug}.zip`);
            
            if (!zipFile) {
                throw new Error(`Plugin zip file not found for ${pluginSlug}. Available files: ${data.map((f: any) => f.name).join(', ')}`);
            }

            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                `Found download URL for ${pluginSlug}: ${zipFile.download_url}`
            );

            return zipFile.download_url;
        } catch (error) {
            LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                `Failed to get download URL for ${pluginSlug}: ${error.message}`
            );
            throw error;
        }
    }

    /**
     * Get download URL for a theme from WooCommerce all-themes repository
     */
    public async getThemeDownloadUrl(themeSlug: string): Promise<string> {
        try {
            const { data } = await this.octokit.request('GET /repos/{owner}/{repo}/releases/latest', {
                owner: 'woocommerce',
                repo: themeSlug,
            });

            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                `Found download URL for theme ${themeSlug}: ${data.zipball_url}`
            );

            return data.zipball_url;
        } catch (error) {
            LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                `Failed to get download URL for theme ${themeSlug}: ${error.message}`
            );
            throw error;
        }
    }

    /**
     * Download a file from GitHub to local filesystem
     */
    public async downloadFile(fileUrl: string, outputPath: string): Promise<DownloadResult> {
        const request = require('request');
        const fs = require('fs');

        return new Promise((resolve) => {
            try {
                LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                    `Starting download from ${fileUrl} to ${outputPath}`
                );

                request.get(fileUrl, {
                    'auth': {
                        'bearer': this.githubToken
                    },
                    'headers': {
                        'User-Agent': 'Wizard Hat Toolkit'
                    }
                }).on("error", function (err: any) {
                    LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                        `Download request failed: ${err.message}`
                    );
                    resolve({
                        success: false,
                        error: `Download request failed: ${err.message}`
                    });
                }).pipe(fs.createWriteStream(outputPath))
                .on('finish', () => {
                    LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                        `Download completed: ${outputPath}`
                    );
                    resolve({
                        success: true,
                        filePath: outputPath
                    });
                })
                .on('error', function (err: any) {
                    LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                        `File write failed: ${err.message}`
                    );
                    resolve({
                        success: false,
                        error: `File write failed: ${err.message}`
                    });
                });
            } catch (error) {
                LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                    `Download failed: ${error.message}`
                );
                resolve({
                    success: false,
                    error: `Download failed: ${error.message}`
                });
            }
        });
    }

    /**
     * Download a plugin from GitHub
     */
    public async downloadPlugin(pluginSlug: string, outputPath: string): Promise<DownloadResult> {
        try {
            const downloadUrl = await this.getPluginDownloadUrl(pluginSlug);
            return await this.downloadFile(downloadUrl, outputPath);
        } catch (error) {
            return {
                success: false,
                error: `Failed to download plugin ${pluginSlug}: ${error.message}`
            };
        }
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
     */
    public async getRepositoryInfo(owner: string, repo: string): Promise<any> {
        try {
            const { data } = await this.octokit.request('GET /repos/{owner}/{repo}', {
                owner,
                repo
            });
            return data;
        } catch (error) {
            LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                `Failed to get repository info for ${owner}/${repo}: ${error.message}`
            );
            throw error;
        }
    }

    /**
     * Get latest release for a repository
     */
    public async getLatestRelease(owner: string, repo: string): Promise<any> {
        try {
            const { data } = await this.octokit.request('GET /repos/{owner}/{repo}/releases/latest', {
                owner,
                repo
            });
            return data;
        } catch (error) {
            LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                `Failed to get latest release for ${owner}/${repo}: ${error.message}`
            );
            throw error;
        }
    }

    /**
     * Check if GitHub token is valid
     */
    public async validateToken(): Promise<boolean> {
        try {
            await this.octokit.request('GET /user');
            return true;
        } catch (error) {
            LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                `GitHub token validation failed: ${error.message}`
            );
            return false;
        }
    }
}
