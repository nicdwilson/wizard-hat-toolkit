import * as LocalMain from '@getflywheel/local/main';
import { PluginInfo, UpdateInfo } from './PluginDetector';

export class UpdateChecker {
    async checkForUpdates(site: any, plugins: PluginInfo[]): Promise<UpdateInfo[]> {
        try {
            // Clear WordPress update transients and force update check
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
            
            // Get update information from WordPress
            const updateData = await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                'eval', 'echo json_encode(get_site_transient("update_plugins"));'
            ]);
            
            const updates = JSON.parse(updateData);
            const availableUpdates: UpdateInfo[] = [];
            
            LocalMain.getServiceContainer().cradle.localLogger.log('debug', 
                `Checking ${plugins.length} plugins for updates. Update data keys: ${updates.response ? Object.keys(updates.response).join(', ') : 'none'}`
            );
            
            // Check each plugin for updates
            for (const plugin of plugins) {
                // Construct the update key in WordPress format: plugin-folder/main-file.php
                const updateKey = `${plugin.name}/${plugin.mainFile}`;
                
                LocalMain.getServiceContainer().cradle.localLogger.log('debug', 
                    `Checking plugin: ${plugin.name}, updateKey: ${updateKey}, isMarketplace: ${plugin.isMarketplace}, currentVersion: ${plugin.version}`
                );
                
                if (plugin.isMarketplace) {
                    // For marketplace plugins, check GitHub/repository for updates
                    LocalMain.getServiceContainer().cradle.localLogger.log('debug', 
                        `Checking marketplace plugin ${plugin.name} for GitHub updates`
                    );
                    const latestGitHubVersion = await this.getLatestGitHubVersion(plugin.name);
                    if (latestGitHubVersion) {
                        LocalMain.getServiceContainer().cradle.localLogger.log('debug', 
                            `Found GitHub version ${latestGitHubVersion} for ${plugin.name}, comparing with current ${plugin.version}`
                        );
                        if (this.isNewerVersion(latestGitHubVersion, plugin.version)) {
                            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                                `Update available for marketplace plugin ${plugin.name}: ${plugin.version} -> ${latestGitHubVersion}`
                            );
                            availableUpdates.push({
                                plugin,
                                updateInfo: {
                                    new_version: latestGitHubVersion,
                                    package: '', // We'll download from GitHub
                                    url: ''
                                }
                            });
                        } else {
                            LocalMain.getServiceContainer().cradle.localLogger.log('debug', 
                                `No update needed for ${plugin.name} (${plugin.version} >= ${latestGitHubVersion})`
                            );
                        }
                    } else {
                        LocalMain.getServiceContainer().cradle.localLogger.log('warn', 
                            `Could not get GitHub version for marketplace plugin ${plugin.name}`
                        );
                    }
                } else {
                    // For .org plugins, check WordPress update system
                    // Try the exact update key first
                    let updateInfo = updates.response && updates.response[updateKey] 
                        ? updates.response[updateKey] 
                        : null;
                    
                    // If not found, try to find it by iterating through all update keys
                    // Sometimes the key format might be slightly different
                    if (!updateInfo && updates.response) {
                        for (const key in updates.response) {
                            if (key.startsWith(`${plugin.name}/`)) {
                                updateInfo = updates.response[key];
                                LocalMain.getServiceContainer().cradle.localLogger.log('debug', 
                                    `Found update for ${plugin.name} using alternative key: ${key}`
                                );
                                break;
                            }
                        }
                    }
                    
                    if (updateInfo) {
                        const newVersion = updateInfo.new_version;
                        if (this.isNewerVersion(newVersion, plugin.version)) {
                            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                                `Update available for .org plugin ${plugin.name}: ${plugin.version} -> ${newVersion}`
                            );
                            availableUpdates.push({
                                plugin,
                                updateInfo: {
                                    new_version: newVersion,
                                    package: updateInfo.package,
                                    url: updateInfo.url
                                }
                            });
                        } else {
                            LocalMain.getServiceContainer().cradle.localLogger.log('debug', 
                                `No update needed for ${plugin.name} (${plugin.version} >= ${newVersion})`
                            );
                        }
                    } else {
                        LocalMain.getServiceContainer().cradle.localLogger.log('debug', 
                            `No update info found in WordPress for .org plugin ${plugin.name} (key: ${updateKey})`
                        );
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

    /**
     * Get the latest version of a plugin from the local repository
     * Extracts version from the plugin's main PHP file inside the zip
     */
    private async getLatestGitHubVersion(pluginName: string): Promise<string | null> {
        const fs = require('fs');
        const path = require('path');
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        const os = require('os');

        try {
            // Get the user-configured repository path
            const repositoryPath = LocalMain.UserData.get('allPluginsRepositoryPath');
            if (!repositoryPath) {
                LocalMain.getServiceContainer().cradle.localLogger.log('warn', 
                    'Repository path not configured. Cannot check for plugin updates.'
                );
                return null;
            }

            if (!fs.existsSync(repositoryPath)) {
                LocalMain.getServiceContainer().cradle.localLogger.log('warn', 
                    `Repository path does not exist: ${repositoryPath}`
                );
                return null;
            }

            // Construct the path to the plugin zip file
            const pluginZipPath = path.join(repositoryPath, 'product-packages', pluginName, `${pluginName}.zip`);
            
            if (!fs.existsSync(pluginZipPath)) {
                LocalMain.getServiceContainer().cradle.localLogger.log('warn', 
                    `Plugin zip file not found at ${pluginZipPath}`
                );
                return null;
            }

            // Create a temporary directory to extract the zip
            const tempDir = path.join(os.tmpdir(), `wizard-hat-version-check-${Date.now()}`);
            fs.mkdirSync(tempDir, { recursive: true });

            try {
                // Extract the zip file using unzip command
                const env = {
                    ...process.env,
                    PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin',
                };

                await execAsync(`unzip -q "${pluginZipPath}" -d "${tempDir}"`, {
                    timeout: 30000,
                    env: env
                });

                // Find the main plugin file (usually {pluginName}.php in the root or in a subdirectory)
                const possiblePaths = [
                    path.join(tempDir, `${pluginName}.php`),
                    path.join(tempDir, pluginName, `${pluginName}.php`)
                ];

                let mainFilePath: string | null = null;
                for (const possiblePath of possiblePaths) {
                    if (fs.existsSync(possiblePath)) {
                        mainFilePath = possiblePath;
                        break;
                    }
                }

                // If not found in expected locations, search for it
                if (!mainFilePath) {
                    const files = fs.readdirSync(tempDir);
                    for (const file of files) {
                        const filePath = path.join(tempDir, file);
                        const stat = fs.statSync(filePath);
                        if (stat.isDirectory()) {
                            const subFilePath = path.join(filePath, `${pluginName}.php`);
                            if (fs.existsSync(subFilePath)) {
                                mainFilePath = subFilePath;
                                break;
                            }
                        } else if (file === `${pluginName}.php`) {
                            mainFilePath = filePath;
                            break;
                        }
                    }
                }

                if (!mainFilePath) {
                    LocalMain.getServiceContainer().cradle.localLogger.log('warn', 
                        `Main plugin file not found in zip for ${pluginName}`
                    );
                    return null;
                }

                // Read the main plugin file content
                const fileContent = fs.readFileSync(mainFilePath, 'utf8');
                
                // Extract version using regex (matches "Version: x.x.x" in plugin header)
                const versionMatch = fileContent.match(/Version:\s*([0-9.]+)/i);
                if (versionMatch && versionMatch[1]) {
                    return versionMatch[1].trim();
                }

                LocalMain.getServiceContainer().cradle.localLogger.log('warn', 
                    `Could not extract version from plugin file for ${pluginName}`
                );
                return null;

            } finally {
                // Cleanup temp directory
                try {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                } catch (cleanupError) {
                    // Ignore cleanup errors
                }
            }

        } catch (error) {
            LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                `Failed to get latest version for ${pluginName}: ${error.message}`
            );
            return null;
        }
    }

    private isNewerVersion(newVersion: string, currentVersion: string): boolean {
        // Normalize versions by removing any non-numeric suffixes (e.g., "1.2.3-beta" -> "1.2.3")
        const normalizeVersion = (version: string): string => {
            // Remove any trailing non-numeric characters and whitespace
            return version.trim().replace(/[^0-9.].*$/, '');
        };
        
        const normalizedNew = normalizeVersion(newVersion);
        const normalizedCurrent = normalizeVersion(currentVersion);
        
        // Split into parts and convert to numbers
        const newParts = normalizedNew.split('.').map(part => {
            const num = parseInt(part, 10);
            return isNaN(num) ? 0 : num;
        });
        const currentParts = normalizedCurrent.split('.').map(part => {
            const num = parseInt(part, 10);
            return isNaN(num) ? 0 : num;
        });
        
        // Compare version parts
        const maxLength = Math.max(newParts.length, currentParts.length);
        for (let i = 0; i < maxLength; i++) {
            const newPart = newParts[i] || 0;
            const currentPart = currentParts[i] || 0;
            
            if (newPart > currentPart) return true;
            if (newPart < currentPart) return false;
        }
        
        // Versions are equal
        return false;
    }
}
