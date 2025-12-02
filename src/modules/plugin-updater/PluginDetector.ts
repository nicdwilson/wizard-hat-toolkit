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
                
                const isMarketplace = this.isMarketplacePlugin(plugin);
                
                allPlugins.push({
                    name: plugin.name,
                    slug: plugin.slug,
                    version: versionResult.trim(),
                    status: plugin.status,
                    mainFile: plugin.name + '.php', // Default main file
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
    
    private isMarketplacePlugin(plugin: any): boolean {
        // Core WordPress/WooCommerce plugins that should always be treated as WordPress.org plugins
        const corePlugins = [
            'woocommerce', // WooCommerce core should be updated via WordPress.org
            'woocommerce-admin',
            'woocommerce-blocks',
            'woocommerce-payments', // WooPayments should be updated via WordPress.org
            'woocommerce-gateway-stripe',
            'woocommerce-gateway-paypal',
            'woocommerce-shipping-fedex',
            'woocommerce-shipping-ups',
            'woocommerce-shipping-usps',
            'woocommerce-tax',
            'woocommerce-bookings',
            'woocommerce-subscriptions',
            'woocommerce-memberships',
            'woocommerce-product-bundles',
            'woocommerce-composite-products',
            'woocommerce-min-max-quantities',
            'woocommerce-product-add-ons',
            'woocommerce-table-rate-shipping',
            'woocommerce-conditional-shipping-and-payments',
            'woocommerce-checkout-field-editor'
        ];
        
        // If it's a core plugin, it's NOT a marketplace plugin
        if (corePlugins.includes(plugin.name) || corePlugins.includes(plugin.slug)) {
            return false;
        }
        
        // Check if plugin was installed via our plugin management system
        // Only consider it marketplace if it's in our premium selections AND not a core plugin
        return this.premiumPluginSelections.some(premium => 
            (premium.label === plugin.name || premium.label === plugin.slug) &&
            !corePlugins.includes(plugin.name) &&
            !corePlugins.includes(plugin.slug)
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
