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

    async detectMarketplacePlugins(site: any): Promise<PluginInfo[]> {
        try {
            // Use WP-CLI to get installed plugins
            const result = await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                'plugin', 'list', '--format=json'
            ]);
            
            const plugins = JSON.parse(result);
            const marketplacePlugins: PluginInfo[] = [];
            
            for (const plugin of plugins) {
                if (this.isMarketplacePlugin(plugin)) {
                    // Get the actual plugin version from WordPress
                    const versionResult = await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
                        'plugin', 'get', plugin.name, '--field=version'
                    ]);
                    
                    marketplacePlugins.push({
                        name: plugin.name,
                        slug: plugin.slug,
                        version: versionResult.trim(),
                        status: plugin.status,
                        mainFile: plugin.name + '.php', // Default main file
                        isMarketplace: true
                    });
                }
            }
            
            return marketplacePlugins;
        } catch (error) {
            LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                `Failed to detect marketplace plugins: ${error.message}`
            );
            return [];
        }
    }
    
    private isMarketplacePlugin(plugin: any): boolean {
        // Check if plugin was installed via our plugin management system
        // This could be tracked by:
        // 1. Plugin author (WooCommerce)
        // 2. Custom meta data we add during installation
        // 3. Plugin slug matching our premium plugin list
        
        return this.premiumPluginSelections.some(premium => 
            premium.label === plugin.name || premium.label === plugin.slug
        );
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
