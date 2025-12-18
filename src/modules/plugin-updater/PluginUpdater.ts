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

    async updateSelectedPlugins(site: any, updates: UpdateInfo[]): Promise<void> {
        LocalMain.getServiceContainer().cradle.localLogger.log('info', `Starting update process for ${updates.length} selected plugins`);
        
        // First, get the actual activation status for each plugin from WordPress
        // This ensures we preserve the plugin's state after update
        for (const update of updates) {
            try {
                const pluginStatusResult = await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                    'plugin', 'get', update.plugin.name, '--field=status'
                ]);
                const pluginStatus = pluginStatusResult.trim().toLowerCase();
                update.plugin.status = pluginStatus; // Update with actual status
                LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                    `Plugin ${update.plugin.name} current status: ${pluginStatus}`
                );
            } catch (statusError) {
                LocalMain.getServiceContainer().cradle.localLogger.log('warn', 
                    `Could not get plugin status for ${update.plugin.name}: ${statusError.message}. Assuming inactive.`
                );
                update.plugin.status = 'inactive'; // Default to inactive if we can't determine
            }
        }
        
        // Separate updates by source (marketplace vs WordPress.org)
        const marketplaceUpdates: UpdateInfo[] = [];
        const orgUpdates: UpdateInfo[] = [];
        
        // Separate updates by source using the isMarketplace flag from detection phase
        // The flag is determined during update checking and should be accurate
        for (const update of updates) {
            // Use the isMarketplace flag that was determined during update checking
            // This ensures consistency between check and update phases
            if (update.plugin.isMarketplace) {
                marketplaceUpdates.push(update);
                LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                    `Plugin ${update.plugin.name} (v${update.plugin.version} -> v${update.updateInfo.new_version}, status: ${update.plugin.status}) ` +
                    `will be updated from marketplace repository (all-plugins)`
                );
            } else {
                orgUpdates.push(update);
                LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                    `Plugin ${update.plugin.name} (v${update.plugin.version} -> v${update.updateInfo.new_version}, status: ${update.plugin.status}) ` +
                    `will be updated from WordPress.org`
                );
            }
        }
        
        try {
            // Update marketplace plugins from repository
            for (const update of marketplaceUpdates) {
                await this.updatePremiumPluginFromGitHub(site, update);
            }
            
            // Update WordPress.org plugins using WP-CLI
            for (const update of orgUpdates) {
                await this.updateStandardPlugin(site, update);
            }
            
            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                `Successfully updated ${marketplaceUpdates.length} marketplace plugin(s) and ${orgUpdates.length} WordPress.org plugin(s)`
            );
        } catch (error) {
            LocalMain.getServiceContainer().cradle.localLogger.log('error', `Failed to update plugins: ${error.message}`);
            throw error;
        }
    }
    

    private async updatePremiumPluginFromGitHub(site: any, update: UpdateInfo): Promise<void> {
        LocalMain.getServiceContainer().cradle.localLogger.log('info', 
            `Starting marketplace plugin update for ${update.plugin.name} from all-plugins repository`
        );
        
        // Download latest version from all-plugins repository
        const outputFile = `${this.context.environment.userDataPath}/addons/wizard-hat-toolkit/${update.plugin.name}-update.zip`;
        
        try {
            // Use the plugin's status from the update object (set in updateSelectedPlugins)
            // We need to preserve this state after the update
            const wasActive = update.plugin.status === 'active';
            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                `Plugin ${update.plugin.name} current status: ${update.plugin.status} (will ${wasActive ? 'reactivate' : 'leave inactive'} after update)`
            );
            
            // Download from all-plugins repository (local repository path)
            await this.downloadLatestVersion(update.plugin.name, outputFile);
            
            // Only deactivate if the plugin is currently active
            if (wasActive) {
                LocalMain.getServiceContainer().cradle.localLogger.log('info', `Deactivating plugin: ${update.plugin.name}`);
                await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                    'plugin', 'deactivate', update.plugin.name
                ], {
                    skipPlugins: false, // Don't skip plugins - we need WooCommerce to be available
                    skipThemes: false
                });
            } else {
                LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                    `Plugin ${update.plugin.name} is not active, skipping deactivation`
                );
            }
            
            // Install the update (this will overwrite the existing plugin)
            LocalMain.getServiceContainer().cradle.localLogger.log('info', `Installing plugin update from: ${outputFile}`);
            await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                'plugin', 'install', outputFile, '--force'
            ]);
            
            // Only reactivate if the plugin was active before the update
            if (wasActive) {
                LocalMain.getServiceContainer().cradle.localLogger.log('info', `Reactivating plugin: ${update.plugin.name}`);
                await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                    'plugin', 'activate', update.plugin.name
                ], {
                    skipPlugins: false, // Don't skip plugins - we need WooCommerce to be available for dependent plugins
                    skipThemes: false
                });
            } else {
                LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                    `Plugin ${update.plugin.name} was inactive before update, leaving it inactive`
                );
            }
            
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
        LocalMain.getServiceContainer().cradle.localLogger.log('info', 
            `Starting WordPress.org plugin update for ${update.plugin.name}`
        );
        
        try {
            // Update the plugin using WP-CLI (this will download from WordPress.org)
            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                `Updating ${update.plugin.name} from WordPress.org to version ${update.updateInfo.new_version}`
            );
            
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
            
            // Verify the update was successful
            await this.verifyPluginUpdate(site, update.plugin.name, update.updateInfo.new_version);
            
            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                `Successfully updated WordPress.org plugin ${update.plugin.name}`
            );
        } catch (error) {
            LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                `Failed to update WordPress.org plugin ${update.plugin.name}: ${error.message}`
            );
            throw new Error(`Failed to update WordPress.org plugin ${update.plugin.name}: ${error.message}`);
        }
    }

    private async downloadLatestVersion(pluginName: string, outputFile: string): Promise<void> {
        const fs = require('fs');
        const path = require('path');

        try {
            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                `Attempting to download ${pluginName} from all-plugins repository`
            );
            
            // Get the user-configured repository path
            const repositoryPath = LocalMain.UserData.get('allPluginsRepositoryPath');
            if (!repositoryPath) {
                throw new Error(
                    'All-plugins repository path not configured. ' +
                    'Please set up your repository path in the Plugin Management settings first. ' +
                    'Marketplace plugins must be updated from the all-plugins repository.'
                );
            }

            if (!fs.existsSync(repositoryPath)) {
                throw new Error(
                    `All-plugins repository path does not exist: ${repositoryPath}. ` +
                    'Please verify your repository path in the Plugin Management settings.'
                );
            }

            // Construct the path to the plugin zip file
            // Marketplace plugins are stored in: {repository}/product-packages/{pluginName}/{pluginName}.zip
            const pluginZipPath = path.join(repositoryPath, 'product-packages', pluginName, `${pluginName}.zip`);
            
            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                `Looking for marketplace plugin at: ${pluginZipPath}`
            );

            if (!fs.existsSync(pluginZipPath)) {
                throw new Error(
                    `Marketplace plugin zip file not found at ${pluginZipPath}. ` +
                    'This plugin may not be available in the all-plugins repository, or the repository may need to be updated. ' +
                    'Please ensure the repository is up to date and contains this plugin.'
                );
            }

            // Ensure output directory exists
            const outputDir = path.dirname(outputFile);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // Copy the plugin zip file to the output path
            fs.copyFileSync(pluginZipPath, outputFile);

            LocalMain.getServiceContainer().cradle.localLogger.log('info', `Successfully copied ${pluginName} from local repository to ${outputFile}`);
        } catch (error) {
            throw new Error(`Failed to download plugin ${pluginName} from local repository: ${error.message}`);
        }
    }

    /**
     * Check if a plugin is a premium/marketplace plugin
     * Note: This method is kept for backward compatibility but the main update flow
     * now uses the isMarketplace flag from UpdateInfo which is determined during update checking.
     * This ensures consistency between check and update phases.
     * 
     * The logic is now simplified: if a plugin is in premium selections, it's a marketplace plugin.
     * Otherwise, it's assumed to be a WordPress.org plugin.
     */
    private isPremiumPlugin(plugin: any): boolean {
        // Normalize plugin identifiers for comparison (case-insensitive)
        const normalizeIdentifier = (id: string): string => id.toLowerCase().trim();
        const pluginNameNormalized = normalizeIdentifier(plugin.name || '');
        const pluginSlugNormalized = normalizeIdentifier(plugin.slug || '');
        
        // Check if plugin was installed via our plugin management system
        // If it's in our premium selections, it's a marketplace plugin
        return this.premiumPluginSelections.some(premium => {
            const premiumLabelNormalized = normalizeIdentifier(premium.label || '');
            const premiumValueNormalized = normalizeIdentifier(premium.value || '');
            
            return premiumLabelNormalized === pluginNameNormalized || 
                   premiumLabelNormalized === pluginSlugNormalized ||
                   premiumValueNormalized === pluginNameNormalized ||
                   premiumValueNormalized === pluginSlugNormalized;
        });
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
