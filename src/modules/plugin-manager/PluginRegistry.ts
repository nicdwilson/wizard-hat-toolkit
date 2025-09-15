import * as LocalMain from '@getflywheel/local/main';
import { PluginSelection, PluginRegistryData, PluginSource } from './types/PluginTypes';

/**
 * Manages the registry of premium plugins and themes
 * Centralizes the logic for determining plugin sources and managing marketplace selections
 */
export class PluginRegistry {
    private static instance: PluginRegistry;
    private registryData: PluginRegistryData;
    private githubToken: string | null = null;

    private constructor() {
        this.registryData = {
            premiumPlugins: [],
            premiumThemes: [],
            pluginInfo: [],
            themeInfo: [],
            lastUpdated: new Date(0) // Initialize to epoch to force refresh
        };
        this.githubToken = process.env.GITHUB_TOKEN || null;
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): PluginRegistry {
        if (!PluginRegistry.instance) {
            PluginRegistry.instance = new PluginRegistry();
        }
        return PluginRegistry.instance;
    }

    /**
     * Initialize the registry with premium plugin and theme data
     */
    public async initialize(githubToken?: string): Promise<void> {
        if (githubToken) {
            this.githubToken = githubToken;
        }

        if (!this.githubToken) {
            throw new Error('GitHub token is required to initialize plugin registry');
        }

        try {
            await Promise.all([
                this.loadPremiumPlugins(),
                this.loadPremiumThemes()
            ]);
            
            this.registryData.lastUpdated = new Date();
            LocalMain.getServiceContainer().cradle.localLogger.log('info', 'Plugin registry initialized successfully');
        } catch (error) {
            LocalMain.getServiceContainer().cradle.localLogger.log('error', `Failed to initialize plugin registry: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check if a plugin is a marketplace/premium plugin
     */
    public isMarketplacePlugin(pluginSlug: string): boolean {
        const isMarketplace = this.registryData.premiumPlugins.some(plugin => 
            plugin.label === pluginSlug || plugin.name === pluginSlug
        );
        console.log(`[PluginRegistry] isMarketplacePlugin(${pluginSlug}): ${isMarketplace}`);
        console.log(`[PluginRegistry] Available premium plugins:`, this.registryData.premiumPlugins.map(p => p.label));
        return isMarketplace;
    }

    /**
     * Check if a theme is a marketplace/premium theme
     */
    public isMarketplaceTheme(themeSlug: string): boolean {
        return this.registryData.premiumThemes.some(theme => 
            theme.label === themeSlug || theme.name === themeSlug
        );
    }

    /**
     * Determine the source of a plugin
     */
    public getPluginSource(pluginSlug: string): PluginSource {
        const source = this.isMarketplacePlugin(pluginSlug) ? 'marketplace' : 'wordpress.org';
        console.log(`[PluginRegistry] getPluginSource(${pluginSlug}): ${source}`);
        return source;
    }

    /**
     * Determine the source of a theme
     */
    public getThemeSource(themeSlug: string): PluginSource {
        if (this.isMarketplaceTheme(themeSlug)) {
            return 'marketplace';
        }
        return 'wordpress.org';
    }

    /**
     * Get all premium plugin selections
     */
    public getPremiumPluginSelections(): PluginSelection[] {
        return [...this.registryData.premiumPlugins];
    }

    /**
     * Get all premium theme selections
     */
    public getPremiumThemeSelections(): PluginSelection[] {
        return [...this.registryData.premiumThemes];
    }

    /**
     * Get premium plugin info
     */
    public getPremiumPluginInfo(): any[] {
        return [...this.registryData.pluginInfo];
    }

    /**
     * Get premium theme info
     */
    public getPremiumThemeInfo(): any[] {
        return [...this.registryData.themeInfo];
    }

    /**
     * Check if registry needs refresh (older than 1 hour)
     */
    public needsRefresh(): boolean {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return this.registryData.lastUpdated < oneHourAgo;
    }

    /**
     * Force refresh of registry data
     */
    public async refresh(): Promise<void> {
        if (!this.githubToken) {
            throw new Error('GitHub token is required to refresh plugin registry');
        }

        await this.initialize(this.githubToken);
    }

    /**
     * Track a plugin installation for marketplace detection
     */
    public trackInstalledPlugin(pluginName: string): void {
        const installedPlugins = LocalMain.UserData.get('installedMarketplacePlugins') || [];
        if (!installedPlugins.includes(pluginName)) {
            installedPlugins.push(pluginName);
            LocalMain.UserData.set('installedMarketplacePlugins', installedPlugins);
        }
    }

    /**
     * Get tracked marketplace plugins
     */
    public getTrackedPlugins(): string[] {
        return LocalMain.UserData.get('installedMarketplacePlugins') || [];
    }

    /**
     * Load premium plugins from GitHub repository
     */
    private async loadPremiumPlugins(): Promise<void> {
        const { Octokit } = require("@octokit/rest");
        const octokit = new Octokit({ auth: this.githubToken });

        try {
            // Get latest commit
            const { data: commits } = await octokit.request('GET /repos/{owner}/{repo}/commits', {
                owner: 'woocommerce',
                repo: 'all-plugins',
            });

            // Get tree for latest commit
            const { data: tree } = await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
                owner: 'woocommerce',
                repo: 'all-plugins',
                tree_sha: commits[0].commit.tree.sha,
            });

            // Find product-packages directory
            const productPackages = tree.tree.find((item: any) => item.path === 'product-packages');
            if (!productPackages) {
                throw new Error('Product packages directory not found');
            }

            // Get product packages tree
            const { data: packagesTree } = await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
                owner: 'woocommerce',
                repo: 'all-plugins',
                tree_sha: productPackages.sha,
            });

            // Build plugin selections (exclude woocommerce-shipstation as per original logic)
            this.registryData.premiumPlugins = packagesTree.tree
                .filter((item: any) => item.type === 'tree' && item.path !== 'woocommerce-shipstation')
                .map((item: any) => ({
                    label: item.path,
                    value: item.sha,
                    name: item.path
                }));

            this.registryData.pluginInfo = packagesTree.tree;

            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                `Loaded ${this.registryData.premiumPlugins.length} premium plugins`
            );
        } catch (error) {
            LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                `Failed to load premium plugins: ${error.message}`
            );
            throw error;
        }
    }

    /**
     * Load premium themes from GitHub repository
     */
    private async loadPremiumThemes(): Promise<void> {
        const { Octokit } = require("@octokit/rest");
        const octokit = new Octokit({ auth: this.githubToken });

        try {
            // Get latest commit
            const { data: commits } = await octokit.request('GET /repos/{owner}/{repo}/commits', {
                owner: 'woocommerce',
                repo: 'all-themes',
            });

            // Get tree for latest commit
            const { data: tree } = await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
                owner: 'woocommerce',
                repo: 'all-themes',
                tree_sha: commits[0].commit.tree.sha,
            });

            // Build theme selections
            this.registryData.premiumThemes = tree.tree
                .filter((item: any) => item.type === 'tree')
                .map((item: any) => ({
                    label: item.path,
                    value: item.sha,
                    name: item.path
                }));

            this.registryData.themeInfo = tree.tree;

            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                `Loaded ${this.registryData.premiumThemes.length} premium themes`
            );
        } catch (error) {
            LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                `Failed to load premium themes: ${error.message}`
            );
            throw error;
        }
    }
}
