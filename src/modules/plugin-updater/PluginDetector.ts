import * as LocalMain from '@getflywheel/local/main';

export interface PluginInfo {
    name: string;
    slug: string;
    version: string;
    status: string;
    mainFile: string;
    isMarketplace: boolean;
}

export interface UpdateInfo {
    plugin: PluginInfo;
    updateInfo: {
        new_version: string;
        package: string;
        url: string;
    };
}

export class PluginDetector {
    private premiumPluginSelections: Array<{label: string, value: string}> = [];

    constructor(premiumPluginSelections: Array<{label: string, value: string}>) {
        this.premiumPluginSelections = premiumPluginSelections;
    }

    async detectAllPlugins(site: any): Promise<PluginInfo[]> {
        try {
            // Use WP-CLI to get installed plugins
            const result = await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                'plugin', 'list', '--format=json'
            ]);
            
            const plugins = JSON.parse(result);
            
            // Get all plugins with their main file paths from WordPress
            // This returns an array keyed by plugin file path (e.g., "woocommerce/woocommerce.php")
            const pluginsDataResult = await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                'eval', `
                    require_once ABSPATH . 'wp-admin/includes/plugin.php';
                    echo json_encode(get_plugins());
                `
            ]);
            
            const pluginsData = JSON.parse(pluginsDataResult);
            
            // Create a map of plugin folder name to main file path
            const pluginFileMap: { [key: string]: string } = {};
            for (const filePath in pluginsData) {
                const folderName = filePath.split('/')[0];
                pluginFileMap[folderName] = filePath;
            }
            
            const allPlugins: PluginInfo[] = [];
            
            for (const plugin of plugins) {
                // Skip inactive plugins and core WordPress plugins
                if (plugin.status === 'inactive' || plugin.name === 'hello') {
                    continue;
                }
                
                // Get the actual plugin version from WordPress
                const versionResult = await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                    'plugin', 'get', plugin.name, '--field=version'
                ]);
                
                // Get the actual main file path from our map, or fall back to default
                const mainFilePath = pluginFileMap[plugin.name] || `${plugin.name}/${plugin.name}.php`;
                // Extract just the filename (e.g., "woocommerce.php" from "woocommerce/woocommerce.php")
                const mainFile = mainFilePath.includes('/') 
                    ? mainFilePath.split('/')[1] 
                    : mainFilePath;
                
                const isMarketplace = this.isMarketplacePlugin(plugin);
                
                LocalMain.getServiceContainer().cradle.localLogger.log('debug', 
                    `Detected plugin: ${plugin.name}, mainFile: ${mainFile}, isMarketplace: ${isMarketplace}, version: ${versionResult.trim()}`
                );
                
                allPlugins.push({
                    name: plugin.name,
                    slug: plugin.slug,
                    version: versionResult.trim(),
                    status: plugin.status,
                    mainFile: mainFile,
                    isMarketplace: isMarketplace
                });
            }
            
            return allPlugins;
        } catch (error) {
            LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                `Failed to detect plugins: ${error.message}`
            );
            return [];
        }
    }
    
    public isMarketplacePlugin(plugin: any): boolean {
        // Normalize plugin identifiers for comparison (case-insensitive)
        const normalizeIdentifier = (id: string): string => id.toLowerCase().trim();
        const pluginNameNormalized = normalizeIdentifier(plugin.name || '');
        const pluginSlugNormalized = normalizeIdentifier(plugin.slug || '');
        
        // Check if plugin was installed via our plugin management system
        // If it's in our premium selections, it's a marketplace plugin
        const isInPremiumSelections = this.premiumPluginSelections.some(premium => {
            const premiumLabelNormalized = normalizeIdentifier(premium.label || '');
            const premiumValueNormalized = normalizeIdentifier(premium.value || '');
            
            return premiumLabelNormalized === pluginNameNormalized || 
                   premiumLabelNormalized === pluginSlugNormalized ||
                   premiumValueNormalized === pluginNameNormalized ||
                   premiumValueNormalized === pluginSlugNormalized;
        });
        
        if (isInPremiumSelections) {
            LocalMain.getServiceContainer().cradle.localLogger.log('debug', 
                `Plugin ${plugin.name} identified as marketplace plugin (found in premium selections)`
            );
            return true;
        }
        
        // If not in premium selections, assume it's a WordPress.org plugin
        // WordPress will handle updates for WordPress.org plugins via its update system
        LocalMain.getServiceContainer().cradle.localLogger.log('debug', 
            `Plugin ${plugin.name} identified as WordPress.org plugin (not in premium selections)`
        );
        return false;
    }

    // Method to track plugins installed via our system
    static trackInstalledPlugin(pluginName: string): void {
        const installedPlugins = LocalMain.UserData.get('installedMarketplacePlugins') || [];
        if (!installedPlugins.includes(pluginName)) {
            installedPlugins.push(pluginName);
            LocalMain.UserData.set('installedMarketplacePlugins', installedPlugins);
        }
    }

    // Method to get tracked plugins
    static getTrackedPlugins(): string[] {
        return LocalMain.UserData.get('installedMarketplacePlugins') || [];
    }
}
