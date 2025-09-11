import * as LocalMain from '@getflywheel/local/main';
import { UpdateInfo } from './PluginDetector';
import { PluginDetector } from './PluginDetector';

export class PluginUpdater {
    private context: any;
    private premiumPluginSelections: Array<{label: string, value: string}>;

    constructor(context: any, premiumPluginSelections: Array<{label: string, value: string}> = []) {
        this.context = context;
        this.premiumPluginSelections = premiumPluginSelections;
    }

    async updatePlugins(site: any, updates: UpdateInfo[]): Promise<void> {
        LocalMain.getServiceContainer().cradle.localLogger.log('info', `Starting update process for ${updates.length} plugins`);
        
        // Extract plugin slugs from updates
        const pluginSlugs = updates.map(update => update.plugin.name);
        LocalMain.getServiceContainer().cradle.localLogger.log('info', `Plugin slugs to update: ${pluginSlugs.join(', ')}`);
        
        try {
            // Use the existing plugin management system to reinstall/update plugins
            await this.updatePluginsUsingExistingSystem(site, pluginSlugs);
            
            LocalMain.getServiceContainer().cradle.localLogger.log('info', `Successfully updated ${updates.length} plugin(s)`);
        } catch (error) {
            LocalMain.getServiceContainer().cradle.localLogger.log('error', `Failed to update plugins: ${error.message}`);
            throw error;
        }
    }
    
    private async updatePluginsUsingExistingSystem(site: any, pluginSlugs: string[]): Promise<void> {
        LocalMain.getServiceContainer().cradle.localLogger.log('info', `Using existing plugin management system to update plugins`);
        
        // Use the existing installPlugins function by calling it directly
        // This function handles both premium and standard plugins automatically
        return new Promise((resolve, reject) => {
            // We need to access the installPlugins function from the main.ts scope
            // Since it's not exported, we'll recreate the logic here but simpler
            
            // Separate premium and standard plugins
            const premiumPlugins = [];
            const standardPlugins = [];
            
            pluginSlugs.forEach(slug => {
                // Check if this is a premium plugin by looking at our tracked plugins
                if (this.isPremiumPlugin({ name: slug })) {
                    premiumPlugins.push(slug);
                } else {
                    standardPlugins.push(slug);
                }
            });
            
            LocalMain.getServiceContainer().cradle.localLogger.log('info', `Premium plugins: ${premiumPlugins.join(', ')}`);
            LocalMain.getServiceContainer().cradle.localLogger.log('info', `Standard plugins: ${standardPlugins.join(', ')}`);
            
            // Use the existing downloadPlugins function logic
            this.downloadAndInstallPlugins(site, premiumPlugins, standardPlugins)
                .then(() => {
                    LocalMain.getServiceContainer().cradle.localLogger.log('info', `All plugins updated successfully`);
                    resolve();
                })
                .catch((error) => {
                    LocalMain.getServiceContainer().cradle.localLogger.log('error', `Failed to update plugins: ${error.message}`);
                    reject(error);
                });
        });
    }
    
    private async downloadAndInstallPlugins(site: any, premiumPlugins: string[], standardPlugins: string[]): Promise<void> {
        // Download premium plugins first - this returns zip file paths
        const zipFiles = await this.downloadPlugins(premiumPlugins);
        
        // Combine zip files (for premium plugins) with slugs (for standard plugins)
        const allPlugins = zipFiles.concat(standardPlugins);
        
        LocalMain.getServiceContainer().cradle.localLogger.log('info', `Installing ${allPlugins.length} plugins: ${allPlugins.join(', ')}`);
        
        // Install all plugins using the same WP-CLI command as the existing system
        for (const plugin of allPlugins) {
            LocalMain.getServiceContainer().cradle.localLogger.log('info', `Installing plugin: ${plugin}`);
            
            try {
                await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                    "plugin", "install", plugin, "--activate", "--force"
                ]);
                
                LocalMain.getServiceContainer().cradle.localLogger.log('info', `Successfully installed: ${plugin}`);
                
                // Clean up downloaded files for premium plugins (zip files)
                if (zipFiles.includes(plugin)) {
                    const fs = require('fs');
                    fs.unlink(plugin, (err: any) => {
                        if (err) {
                            LocalMain.getServiceContainer().cradle.localLogger.log('error', `Failed to clean up ${plugin}: ${err.message}`);
                        } else {
                            LocalMain.getServiceContainer().cradle.localLogger.log('info', `Cleaned up ${plugin}`);
                        }
                    });
                }
            } catch (error) {
                LocalMain.getServiceContainer().cradle.localLogger.log('error', `Failed to install ${plugin}: ${error.message}`);
                throw error;
            }
        }
    }
    
    private async downloadPlugins(pluginsToInstall: string[]): Promise<string[]> {
        const zipFiles = [];
        
        LocalMain.getServiceContainer().cradle.localLogger.log('info', `Starting download of ${pluginsToInstall.length} premium plugins: ${pluginsToInstall.join(', ')}`);
        
        for (const pluginSlug of pluginsToInstall) {
            const outputFile = this.context.environment.userDataPath + `/addons/wizard-hat-toolkit/${pluginSlug}.zip`;
            
            try {
                LocalMain.getServiceContainer().cradle.localLogger.log('info', `Getting download URL for ${pluginSlug}`);
                const fileUrl = await this.getDownloadUrl(pluginSlug);
                LocalMain.getServiceContainer().cradle.localLogger.log('info', `Downloading ${pluginSlug} from: ${fileUrl}`);
                
                const result = await this.downloadZipFromGitHub(fileUrl, outputFile);
                zipFiles.push(result);
                LocalMain.getServiceContainer().cradle.localLogger.log('info', `Successfully downloaded ${pluginSlug} to: ${result}`);
            } catch (error) {
                LocalMain.getServiceContainer().cradle.localLogger.log('error', `Failed to download ${pluginSlug}: ${error.message}`);
                throw error;
            }
        }
        
        LocalMain.getServiceContainer().cradle.localLogger.log('info', `Downloaded ${zipFiles.length} plugin zip files`);
        return zipFiles;
    }
    
    private async getDownloadUrl(pluginSlug: string): Promise<string> {
        const { Octokit } = require("@octokit/rest");
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
        
        const path = `product-packages/${pluginSlug}`;
        
        return new Promise((resolve, reject) => {
            octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
                owner: 'woocommerce',
                repo: 'all-plugins',
                path: path,
            }).then(async ({ data }) => {
                // Look for the zip file with the exact plugin slug name
                for (const element of data) {
                    if (pluginSlug + '.zip' === element.name) {
                        LocalMain.getServiceContainer().cradle.localLogger.log('info', `Found zip file for ${pluginSlug}: ${element.name}`);
                        resolve(element.download_url);
                        return;
                    }
                }
                // If no zip file found, reject
                reject(new Error(`Plugin zip file not found for ${pluginSlug}`));
            }, function (err) {
                LocalMain.getServiceContainer().cradle.localLogger.log('error', `Failed to get download URL for ${pluginSlug}: ${err.message}`);
                reject(err);
            });
        });
    }
    
    private async downloadZipFromGitHub(fileUrl: string, outputFile: string): Promise<string> {
        const request = require('request');
        const fs = require('fs');
        
        return new Promise((resolve, reject) => {
            request.get(fileUrl, {
                'auth': {
                    'bearer': process.env.GITHUB_TOKEN
                },
                'headers': {
                    'User-Agent': 'Wizard Hat Toolkit'
                }
            }).on("error", function (err: any) {
                LocalMain.getServiceContainer().cradle.localLogger.log('error', `Download request failed: ${err.message}`);
                reject(err);
            }).pipe(fs.createWriteStream(outputFile)).on('finish', () => {
                LocalMain.getServiceContainer().cradle.localLogger.log('info', `Download completed: ${outputFile}`);
                resolve(outputFile);
            }).on('error', function (err: any) {
                LocalMain.getServiceContainer().cradle.localLogger.log('error', `File write failed: ${err.message}`);
                reject(err);
            });
        });
    }
    
    private async updatePremiumPlugin(site: any, update: UpdateInfo): Promise<void> {
        // For marketplace plugins, we need to use our GitHub repository access
        // since WooCommerce Helper can't download to local sites
        await this.updatePremiumPluginFromGitHub(site, update);
    }

    private async updatePremiumPluginFromGitHub(site: any, update: UpdateInfo): Promise<void> {
        // Download latest version from GitHub using our repository access
        const outputFile = `${this.context.environment.userDataPath}/addons/wizard-hat-toolkit/${update.plugin.name}-update.zip`;
        
        try {
            // Download from GitHub repository
            await this.downloadLatestVersion(update.plugin.name, outputFile);
            
            // Deactivate the plugin first
            LocalMain.getServiceContainer().cradle.localLogger.log('info', `Deactivating plugin: ${update.plugin.name}`);
            await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                'plugin', 'deactivate', update.plugin.name
            ]);
            
            // Install the update (this will overwrite the existing plugin)
            LocalMain.getServiceContainer().cradle.localLogger.log('info', `Installing plugin update from: ${outputFile}`);
            await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                'plugin', 'install', outputFile, '--force'
            ]);
            
            // Reactivate the plugin
            LocalMain.getServiceContainer().cradle.localLogger.log('info', `Reactivating plugin: ${update.plugin.name}`);
            await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                'plugin', 'activate', update.plugin.name
            ]);
            
            // Clear WordPress caches and refresh update information
            await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                'eval', `
                    // Clear all caches
                    wp_cache_flush();
                    delete_site_transient('update_plugins');
                    
                    // Refresh plugin information
                    wp_update_plugins();
                    
                    // Clear WooCommerce Helper cache if available
                    if (class_exists('WC_Helper_Updater')) {
                        WC_Helper_Updater::check_updates();
                    }
                `
            ]);
            
            // Verify the plugin was actually updated
            await this.verifyPluginUpdate(site, update.plugin.name, update.updateInfo.new_version);
            
            // Clean up the downloaded file
            const fs = require('fs');
            fs.unlink(outputFile, (err: any) => {
                if (err) {
                    LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                        `Failed to clean up ${outputFile}: ${err.message}`
                    );
                }
            });
            
        } catch (error) {
            throw new Error(`Failed to update premium plugin ${update.plugin.name} from GitHub: ${error.message}`);
        }
    }

    private async updatePremiumPluginManually(site: any, update: UpdateInfo): Promise<void> {
        // Download latest version from GitHub
        const outputFile = `${this.context.environment.userDataPath}/addons/wizard-hat-toolkit/${update.plugin.name}-update.zip`;
        
        try {
            await this.downloadLatestVersion(update.plugin.name, outputFile);
            
            // First, deactivate the plugin
            await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                'plugin', 'deactivate', update.plugin.name
            ]);
            
            // Install the update (this will overwrite the existing plugin)
            await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                'plugin', 'install', outputFile, '--force'
            ]);
            
            // Reactivate the plugin
            await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                'plugin', 'activate', update.plugin.name
            ]);
            
            // Clear WordPress caches to ensure plugin info is refreshed
            await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                'cache', 'flush'
            ]);
            
            // Force WordPress to refresh plugin information
            await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                'eval', 'wp_cache_flush(); delete_site_transient("update_plugins");'
            ]);
            
            // Verify the plugin was actually updated by checking its version
            await this.verifyPluginUpdate(site, update.plugin.name, update.updateInfo.new_version);
            
            // Clean up
            const fs = require('fs');
            fs.unlink(outputFile, (err: any) => {
                if (err) {
                    LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                        `Failed to clean up ${outputFile}: ${err.message}`
                    );
                }
            });
        } catch (error) {
            throw new Error(`Failed to update premium plugin ${update.plugin.name}: ${error.message}`);
        }
    }
    
    private async updateStandardPlugin(site: any, update: UpdateInfo): Promise<void> {
        // Update the plugin
        await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
            'plugin', 'update', update.plugin.name
        ]);
        
        // Clear WordPress caches to ensure plugin info is refreshed
        await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
            'cache', 'flush'
        ]);
        
        // Force WordPress to refresh plugin information
        await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
            'eval', 'wp_cache_flush(); delete_site_transient("update_plugins");'
        ]);
    }

    private async downloadLatestVersion(pluginName: string, outputFile: string): Promise<void> {
        const { Octokit } = require("@octokit/rest");
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
        
        try {
            LocalMain.getServiceContainer().cradle.localLogger.log('info', `Attempting to download ${pluginName} from GitHub`);
            
            // Get the plugin zip file from the all-plugins repository's product-packages directory
            const { data } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
                owner: 'woocommerce',
                repo: 'all-plugins',
                path: `product-packages/${pluginName}`,
            });
            
            LocalMain.getServiceContainer().cradle.localLogger.log('info', `Found ${data.length} files in product-packages/${pluginName}`);
            
            // Find the zip file for this plugin
            const zipFile = data.find((file: any) => file.name === `${pluginName}.zip`);
            
            if (!zipFile) {
                LocalMain.getServiceContainer().cradle.localLogger.log('error', `Plugin zip file not found for ${pluginName}. Available files: ${data.map((f: any) => f.name).join(', ')}`);
                throw new Error(`Plugin zip file not found for ${pluginName}`);
            }
            
            LocalMain.getServiceContainer().cradle.localLogger.log('info', `Found zip file: ${zipFile.name}, downloading to ${outputFile}`);
            
            // Download the zip file
            const request = require('request');
            const fs = require('fs');
            
            return new Promise((resolve, reject) => {
                request.get(zipFile.download_url, {
                    'auth': {
                        'bearer': process.env.GITHUB_TOKEN
                    },
                    'headers': {
                        'User-Agent': 'Wizard Hat Toolkit'
                    }
                }).on("error", function (err: any) {
                    LocalMain.getServiceContainer().cradle.localLogger.log('error', `Download error for ${pluginName}: ${err.message}`);
                    reject(err);
                }).pipe(fs.createWriteStream(outputFile)).on('finish', () => {
                    LocalMain.getServiceContainer().cradle.localLogger.log('info', `Successfully downloaded ${pluginName} to ${outputFile}`);
                    resolve();
                });
            });
        } catch (error) {
            throw new Error(`Failed to download plugin ${pluginName} from GitHub: ${error.message}`);
        }
    }

    private isPremiumPlugin(plugin: any): boolean {
        // Use the same logic as the existing system - check against premiumPluginSelections
        const isPremium = (obj: any) => obj.label === plugin.name;
        return this.premiumPluginSelections.some(isPremium);
    }

    private logUpdateAttempt(siteId: string, pluginName: string): void {
        LocalMain.getServiceContainer().cradle.localLogger.log('info', 
            `Attempting to update ${pluginName} on site ${siteId}`
        );
    }
    
    private logUpdateSuccess(siteId: string, pluginName: string, version: string): void {
        LocalMain.getServiceContainer().cradle.localLogger.log('info', 
            `Successfully updated ${pluginName} to version ${version} on site ${siteId}`
        );
    }
    
    private logUpdateError(siteId: string, pluginName: string, error: Error): void {
        LocalMain.getServiceContainer().cradle.localLogger.log('error', 
            `Failed to update ${pluginName} on site ${siteId}: ${error.message}`
        );
    }

    private async verifyPluginUpdate(site: any, pluginName: string, expectedVersion: string): Promise<void> {
        try {
            // Get the current plugin version after update
            const result = await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                'plugin', 'get', pluginName, '--field=version'
            ]);
            
            const actualVersion = result.trim();
            
            if (actualVersion === expectedVersion) {
                LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                    `Plugin ${pluginName} successfully updated to version ${actualVersion}`
                );
            } else {
                LocalMain.getServiceContainer().cradle.localLogger.log('warning', 
                    `Plugin ${pluginName} version mismatch: expected ${expectedVersion}, got ${actualVersion}`
                );
            }
        } catch (error) {
            LocalMain.getServiceContainer().cradle.localLogger.log('warning', 
                `Could not verify plugin ${pluginName} version: ${error.message}`
            );
        }
    }
}
