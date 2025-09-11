import * as LocalMain from '@getflywheel/local/main';
import { PluginInfo, UpdateInfo } from './PluginDetector';

export class UpdateChecker {
    async checkForUpdates(site: any, plugins: PluginInfo[]): Promise<UpdateInfo[]> {
        try {
            // Use WooCommerce Helper to detect available updates
            // This works even for local sites that aren't connected to woocommerce.com
            await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                'eval', `
                    // Clear any existing update transients
                    delete_site_transient('update_plugins');
                    
                    // Force WordPress to check for updates
                    wp_update_plugins();
                    
                    // Trigger WooCommerce Helper updates to detect marketplace plugin updates
                    if (class_exists('WC_Helper_Updater')) {
                        WC_Helper_Updater::check_updates();
                    }
                `
            ]);
            
            // Get update information from WordPress (this includes WooCommerce Helper detected updates)
            const updateData = await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                'eval', 'echo json_encode(get_site_transient("update_plugins"));'
            ]);
            
            const updates = JSON.parse(updateData);
            const availableUpdates: UpdateInfo[] = [];
            
            // Check each marketplace plugin for updates
            for (const plugin of plugins) {
                const updateKey = `${plugin.name}/${plugin.mainFile}`;
                
                // Check if WordPress/WooCommerce Helper detected an update
                if (updates.response && updates.response[updateKey]) {
                    const updateInfo = updates.response[updateKey];
                    
                    // Verify this is actually a newer version by checking GitHub
                    const latestGitHubVersion = await this.getLatestGitHubVersion(plugin.name);
                    
                    if (latestGitHubVersion && this.isNewerVersion(latestGitHubVersion, plugin.version)) {
                        availableUpdates.push({
                            plugin,
                            updateInfo: {
                                new_version: latestGitHubVersion,
                                package: '', // We'll download from GitHub
                                url: ''
                            }
                        });
                    }
                } else {
                    // Fallback: check GitHub directly for updates
                    const latestGitHubVersion = await this.getLatestGitHubVersion(plugin.name);
                    if (latestGitHubVersion && this.isNewerVersion(latestGitHubVersion, plugin.version)) {
                        availableUpdates.push({
                            plugin,
                            updateInfo: {
                                new_version: latestGitHubVersion,
                                package: '', // We'll download from GitHub
                                url: ''
                            }
                        });
                    }
                }
            }
            
            return availableUpdates;
        } catch (error) {
            LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                `Failed to check for updates: ${error.message}`
            );
            return [];
        }
    }

    async checkPremiumPluginUpdates(site: any, plugins: PluginInfo[]): Promise<UpdateInfo[]> {
        const availableUpdates: UpdateInfo[] = [];
        
        for (const plugin of plugins) {
            try {
                // For premium plugins, we need to check GitHub releases
                const latestVersion = await this.getLatestGitHubVersion(plugin.name);
                if (latestVersion && this.isNewerVersion(latestVersion, plugin.version)) {
                    availableUpdates.push({
                        plugin,
                        updateInfo: {
                            new_version: latestVersion,
                            package: '', // Will be filled during download
                            url: ''
                        }
                    });
                }
            } catch (error) {
                LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                    `Failed to check updates for ${plugin.name}: ${error.message}`
                );
            }
        }
        
        return availableUpdates;
    }

    private async getLatestGitHubVersion(pluginName: string): Promise<string | null> {
        try {
            const { Octokit } = require("@octokit/rest");
            const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
            
            const { data } = await octokit.request('GET /repos/{owner}/{repo}/releases/latest', {
                owner: 'woocommerce',
                repo: pluginName,
            });
            
            return data.tag_name.replace('v', ''); // Remove 'v' prefix if present
        } catch (error) {
            LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                `Failed to get latest version for ${pluginName}: ${error.message}`
            );
            return null;
        }
    }

    private isNewerVersion(newVersion: string, currentVersion: string): boolean {
        // Simple version comparison - could be enhanced with proper semver parsing
        const newParts = newVersion.split('.').map(Number);
        const currentParts = currentVersion.split('.').map(Number);
        
        for (let i = 0; i < Math.max(newParts.length, currentParts.length); i++) {
            const newPart = newParts[i] || 0;
            const currentPart = currentParts[i] || 0;
            
            if (newPart > currentPart) return true;
            if (newPart < currentPart) return false;
        }
        
        return false;
    }
}
