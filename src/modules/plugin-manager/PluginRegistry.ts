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
    private cacheBasePath: string;

    private constructor() {
        this.registryData = {
            premiumPlugins: [],
            premiumThemes: [],
            pluginInfo: [],
            themeInfo: [],
            lastUpdated: new Date(0) // Initialize to epoch to force refresh
        };
        this.githubToken = process.env.GITHUB_TOKEN || null;
        
        // Set up persistent cache location
        // Use absolute path to avoid any placeholder issues
        const path = require('path');
        const os = require('os');
        const homeDir = os.homedir();
        
        // Ensure we have a real path, not a placeholder
        if (!homeDir || homeDir.includes('%%') || homeDir.includes('${')) {
            throw new Error('Could not determine home directory for repository cache');
        }
        
        this.cacheBasePath = path.join(homeDir, 'Library', 'Application Support', 'Local', 'addons', 'wizard-hat-toolkit', 'repositories');
        
        // Verify the path was constructed correctly
        if (this.cacheBasePath.includes('%%') || this.cacheBasePath.includes('${')) {
            throw new Error(`Repository cache path contains placeholder: ${this.cacheBasePath}`);
        }
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
     * Uses Git commands only (no token required)
     * Now uses persistent cache and checks for updates
     * Also refreshes the repository to ensure it's up to date
     */
    public async initialize(githubToken?: string, progressCallback?: (status: string) => void): Promise<void> {
        if (githubToken) {
            this.githubToken = githubToken;
        }

        try {
            // Check if repository path is configured
            const userProvidedPath = LocalMain.UserData.get('allPluginsRepositoryPath');
            if (!userProvidedPath) {
                const errorMsg = 'Repository path not configured. Please set up your repository path first. Go to Plugin Management to configure it.';
                LocalMain.getServiceContainer().cradle.localLogger.log('error', errorMsg);
                throw new Error(errorMsg);
            }

            // Try Git-based loading first
            try {
                await this.loadPremiumPluginsViaGit(progressCallback);
            } catch (gitError) {
                // Log full error details
                LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                    `Git method failed: ${gitError.message}. Full error: ${JSON.stringify(gitError)}`
                );
                
                // Don't fall back to API - git should work if it works in terminal
                // The API fallback was causing the token error
                throw new Error(`Git clone failed: ${gitError.message}. Please ensure Git is installed and accessible. If git clone works in your terminal, this may be a PATH or permissions issue.`);
            }
            
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
     * All themes are now from wordpress.org (all-themes repository no longer in use)
     */
    public isMarketplaceTheme(themeSlug: string): boolean {
        return false; // All themes are from wordpress.org
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
     * All themes are from wordpress.org (all-themes repository no longer in use)
     */
    public getThemeSource(themeSlug: string): PluginSource {
        return 'wordpress.org'; // All themes are from wordpress.org
    }

    /**
     * Get all premium plugin selections
     */
    public getPremiumPluginSelections(): PluginSelection[] {
        return [...this.registryData.premiumPlugins];
    }

    /**
     * Get all premium theme selections
     * Note: All themes are now from wordpress.org (all-themes repository no longer in use)
     * This method returns an empty array as there are no premium themes
     */
    public getPremiumThemeSelections(): PluginSelection[] {
        return []; // All themes are from wordpress.org
    }

    /**
     * Get premium plugin info
     */
    public getPremiumPluginInfo(): any[] {
        return [...this.registryData.pluginInfo];
    }

    /**
     * Get premium theme info
     * Note: All themes are now from wordpress.org (all-themes repository no longer in use)
     * This method returns an empty array as there are no premium themes
     */
    public getPremiumThemeInfo(): any[] {
        return []; // All themes are from wordpress.org
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
     * Uses Git only
     */
    public async refresh(): Promise<void> {
        await this.initialize(this.githubToken || undefined);
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
     * Get the path to the cached repository
     * Now checks for user-provided repository path first
     */
    private getRepositoryPath(repoName: string): string {
        const path = require('path');
        const os = require('os');
        
        // Check if user has configured a custom repository path
        const userProvidedPath = LocalMain.UserData.get('allPluginsRepositoryPath');
        
        if (userProvidedPath && repoName === 'all-plugins') {
            // Validate user-provided path
            const fs = require('fs');
            if (fs.existsSync(userProvidedPath)) {
                LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                    `Using user-provided repository path: ${userProvidedPath}`
                );
                return userProvidedPath;
            } else {
                LocalMain.getServiceContainer().cradle.localLogger.log('warn', 
                    `User-provided repository path does not exist: ${userProvidedPath}. Falling back to default cache location.`
                );
            }
        }
        
        // Fall back to default cache location if no user-provided path or for other repos
        // Always reconstruct path from scratch to avoid placeholder issues
        // Don't trust cacheBasePath if it might contain placeholders
        const homeDir = os.homedir();
        
        LocalMain.getServiceContainer().cradle.localLogger.log('info', 
            `getRepositoryPath called for: ${repoName}, homeDir: ${homeDir}`
        );
        
        if (!homeDir || homeDir.includes('%%') || homeDir.includes('${') || homeDir.trim() === '') {
            const errorMsg = `Invalid home directory: "${homeDir}"`;
            LocalMain.getServiceContainer().cradle.localLogger.log('error', errorMsg);
            throw new Error(errorMsg);
        }
        
        const repoPath = path.join(homeDir, 'Library', 'Application Support', 'Local', 'addons', 'wizard-hat-toolkit', 'repositories', repoName);
        
        // Validate that the path doesn't contain placeholders
        if (repoPath.includes('%%') || repoPath.includes('${')) {
            const errorMsg = `Repository path still contains placeholder after reconstruction: ${repoPath}. Home dir: ${homeDir}`;
            LocalMain.getServiceContainer().cradle.localLogger.log('error', errorMsg);
            throw new Error(errorMsg);
        }
        
        // Update cacheBasePath if it was wrong
        if (this.cacheBasePath.includes('%%') || this.cacheBasePath.includes('${')) {
            this.cacheBasePath = path.join(homeDir, 'Library', 'Application Support', 'Local', 'addons', 'wizard-hat-toolkit', 'repositories');
            LocalMain.getServiceContainer().cradle.localLogger.log('warn', 
                `Fixed cacheBasePath that contained placeholder. New path: ${this.cacheBasePath}`
            );
        }
        
        LocalMain.getServiceContainer().cradle.localLogger.log('info', 
            `Repository path resolved to: ${repoPath}`
        );
        
        return repoPath;
    }

    /**
     * Check if repository exists and is valid
     */
    private async repositoryExists(repoPath: string): Promise<boolean> {
        const fs = require('fs');
        const path = require('path');
        
        // Log what we're checking
        LocalMain.getServiceContainer().cradle.localLogger.log('info', 
            `Checking if repository exists: ${repoPath}`
        );
        
        // Check if directory exists
        const dirExists = fs.existsSync(repoPath);
        LocalMain.getServiceContainer().cradle.localLogger.log('info', 
            `Directory exists: ${dirExists}`
        );
        
        if (!dirExists) {
            return false;
        }
        
        // Check if it's a git repository (has .git directory or is a bare repo)
        const gitDir = path.join(repoPath, '.git');
        const hasGitDir = fs.existsSync(gitDir);
        
        // Also check if it has content (not empty directory)
        let hasContent = false;
        try {
            const entries = fs.readdirSync(repoPath);
            hasContent = entries.length > 0;
            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                `Repository has ${entries.length} entries`
            );
        } catch (error) {
            LocalMain.getServiceContainer().cradle.localLogger.log('warn', 
                `Could not read repository directory: ${error.message}`
            );
        }
        
        // Consider it valid if directory exists and has content (even if .git is missing - might be manually cloned)
        const isValid = dirExists && hasContent;
        
        LocalMain.getServiceContainer().cradle.localLogger.log('info', 
            `Repository exists check: dirExists=${dirExists}, hasGitDir=${hasGitDir}, hasContent=${hasContent}, isValid=${isValid}`
        );
        
        return isValid;
    }

    /**
     * Check for updates in existing repository
     */
    private async checkForUpdates(repoPath: string, progressCallback?: (status: string) => void): Promise<boolean> {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        const os = require('os');
        const fs = require('fs');
        const path = require('path');

        try {
            // Check if it's a git repository first
            const gitPath = path.join(repoPath, '.git');
            if (!fs.existsSync(gitPath)) {
                LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                    `Repository at ${repoPath} is not a git repository. Skipping update check.`
                );
                if (progressCallback) {
                    progressCallback('Repository is not a git repository. Using existing files.');
                }
                return false;
            }

            if (progressCallback) {
                progressCallback('Checking for repository updates...');
            }

            // Ensure proper environment for git commands
            const env = {
                ...process.env,
                PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin',
                HOME: process.env.HOME || os.homedir(),
            };
            
            // Fetch latest changes
            await execAsync(`git fetch origin`, {
                cwd: repoPath,
                timeout: 60000,
                env: env
            });

            // Check if local is behind remote
            const { stdout } = await execAsync(`git rev-list HEAD..origin/main --count`, {
                cwd: repoPath,
                timeout: 30000,
                env: env
            });
            
            const commitsBehind = parseInt(stdout.trim(), 10);
            const hasUpdates = commitsBehind > 0;

            if (hasUpdates && progressCallback) {
                progressCallback(`Found ${commitsBehind} new commit(s). Updating repository...`);
            }

            if (hasUpdates) {
                // Pull latest changes
                await execAsync(`git pull origin main`, {
                    cwd: repoPath,
                    timeout: 120000,
                    env: env
                });
                return true;
            }

            return false;
        } catch (error) {
            LocalMain.getServiceContainer().cradle.localLogger.log('warn', 
                `Failed to check for updates: ${error.message}. Will use existing repository.`
            );
            // Don't throw - use existing repository even if update check fails
            if (progressCallback) {
                progressCallback('Update check failed. Using existing repository.');
            }
            return false;
        }
    }

    /**
     * Clone repository with user feedback
     */
    private async cloneRepository(repoUrl: string, repoPath: string, progressCallback?: (status: string) => void): Promise<void> {
        const { spawn, exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        const fs = require('fs');
        const path = require('path');
        const os = require('os');

        // Ensure cache directory exists
        const cacheDir = path.dirname(repoPath);
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }

        if (progressCallback) {
            progressCallback(`Cloning repository from GitHub...`);
        }

        // Build comprehensive PATH for macOS
        // Include common locations where git might be installed
        const commonPaths = [
            '/usr/local/bin',
            '/usr/bin',
            '/bin',
            '/usr/sbin',
            '/sbin',
            '/opt/homebrew/bin',  // Homebrew on Apple Silicon
            '/usr/local/git/bin', // Git installer location
            path.join(os.homedir(), 'bin'), // User bin directory
        ];
        
        // Get user's shell PATH if available
        const userPath = process.env.PATH || '';
        const combinedPath = [...commonPaths, ...userPath.split(':')].filter(Boolean).join(':');

        try {
            
            // Try to find git using multiple methods
            let gitPath = 'git';
            const possibleGitPaths = [
                '/usr/bin/git',  // Most common macOS location
                '/usr/local/bin/git',
                '/opt/homebrew/bin/git',
                '/usr/local/git/bin/git',
                'git' // Try as-is with PATH
            ];
            
            // First, try to verify git works by running git --version
            // This is more reliable than checking file existence
            let gitFound = false;
            const testEnv = {
                ...process.env,
                PATH: combinedPath,
                HOME: process.env.HOME || os.homedir(),
            };
            
            // Try which command first
            try {
                const { stdout: whichResult } = await execAsync('which git', {
                    timeout: 5000,
                    env: testEnv
                });
                const foundPath = whichResult.trim();
                if (foundPath) {
                    // Verify it actually works by running git --version
                    try {
                        await execAsync(`${foundPath} --version`, {
                            timeout: 5000,
                            env: testEnv
                        });
                        gitPath = foundPath;
                        gitFound = true;
                        LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                            `Found git using 'which': ${gitPath}`
                        );
                    } catch (versionError) {
                        LocalMain.getServiceContainer().cradle.localLogger.log('warn', 
                            `Found git at ${foundPath} but it doesn't work: ${versionError.message}`
                        );
                    }
                }
            } catch (whichError) {
                LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                    `'which git' failed: ${whichError.message}, trying direct paths`
                );
            }
            
            // If which didn't work, try common locations directly
            if (!gitFound) {
                for (const possiblePath of possibleGitPaths) {
                    if (possiblePath === 'git') {
                        // Last resort - try with PATH
                        try {
                            await execAsync('git --version', {
                                timeout: 5000,
                                env: testEnv
                            });
                            gitPath = 'git';
                            gitFound = true;
                            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                                `Found git using PATH: ${gitPath}`
                            );
                            break;
                        } catch (gitError) {
                            continue;
                        }
                    }
                    
                    // Check if file exists and is executable
                    if (fs.existsSync(possiblePath)) {
                        try {
                            // Verify it actually works
                            await execAsync(`${possiblePath} --version`, {
                                timeout: 5000,
                                env: testEnv
                            });
                            gitPath = possiblePath;
                            gitFound = true;
                            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                                `Found git at common location: ${gitPath}`
                            );
                            break;
                        } catch (versionError) {
                            LocalMain.getServiceContainer().cradle.localLogger.log('warn', 
                                `Found git at ${possiblePath} but it doesn't work: ${versionError.message}`
                            );
                        }
                    }
                }
            }
            
            if (!gitFound) {
                LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                    `Could not find working git. Tried paths: ${possibleGitPaths.join(', ')}`
                );
            }

            // Use the exact command format that works in terminal (without .git suffix)
            // Remove .git suffix if present to match terminal behavior
            const cleanRepoUrl = repoUrl.replace(/\.git$/, '');
            // Verify repoPath doesn't contain placeholders
            if (repoPath.includes('%%') || repoPath.includes('${')) {
                throw new Error(`Repository path contains placeholder: ${repoPath}. This should not happen.`);
            }
            
            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                `Starting git clone: ${cleanRepoUrl} -> ${repoPath}`
            );
            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                `Using git: ${gitPath}`
            );
            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                `Using PATH: ${combinedPath}`
            );

            // Clone repository shallowly with proper environment and progress reporting
            // Use spawn instead of exec to capture progress output in real-time
            const env = {
                ...process.env,
                PATH: combinedPath,
                HOME: process.env.HOME || os.homedir(),
            };

            // Use spawn to capture progress output in real-time
            return new Promise<void>((resolve, reject) => {
                // For large repositories (8GB+), use sparse checkout to only clone product-packages directory
                // This dramatically reduces clone size and time
                // Strategy: Clone with --filter=blob:none (partial clone) + sparse checkout
                const args = [
                    'clone',
                    '--depth', '1',
                    '--filter=blob:none',  // Partial clone - don't download file contents yet
                    '--sparse',  // Enable sparse checkout
                    '--progress',  // Enable progress reporting
                    cleanRepoUrl,
                    repoPath
                ];

                if (progressCallback) {
                    progressCallback(`🔄 Cloning repository structure... This may take several minutes for large repositories. Please hang in there!`);
                }

                const gitProcess = spawn(gitPath, args, {
                    env: env,
                    stdio: ['ignore', 'pipe', 'pipe'] // stdin: ignore, stdout/stderr: pipe
                });

                let stdoutBuffer = '';
                let stderrBuffer = '';
                let lastProgressUpdate = Date.now();
                const PROGRESS_UPDATE_INTERVAL = 2000; // Update every 2 seconds

                // Capture stdout (progress output)
                gitProcess.stdout.on('data', (data: Buffer) => {
                    const output = data.toString();
                    stdoutBuffer += output;
                    
                    // Parse progress lines (e.g., "Receiving objects: 45% (1234/2745)")
                    const progressMatch = output.match(/(Receiving objects|Counting objects|Compressing objects):\s*(\d+)%/);
                    if (progressMatch && progressCallback) {
                        const now = Date.now();
                        if (now - lastProgressUpdate >= PROGRESS_UPDATE_INTERVAL) {
                            progressCallback(`🔄 Cloning repository: ${progressMatch[1]} ${progressMatch[2]}% - Your packages are coming, hang in there!`);
                            lastProgressUpdate = now;
                        }
                    }
                });

                // Capture stderr (also contains progress on some systems)
                gitProcess.stderr.on('data', (data: Buffer) => {
                    const output = data.toString();
                    stderrBuffer += output;
                    
                    // Git often sends progress to stderr
                    const progressMatch = output.match(/(Receiving objects|Counting objects|Compressing objects):\s*(\d+)%/);
                    if (progressMatch && progressCallback) {
                        const now = Date.now();
                        if (now - lastProgressUpdate >= PROGRESS_UPDATE_INTERVAL) {
                            progressCallback(`🔄 Cloning repository: ${progressMatch[1]} ${progressMatch[2]}% - Your packages are coming, hang in there!`);
                            lastProgressUpdate = now;
                        }
                    }
                    
                    // Also show any other progress indicators
                    if (output.includes('remote:') && progressCallback) {
                        const now = Date.now();
                        if (now - lastProgressUpdate >= PROGRESS_UPDATE_INTERVAL * 2) {
                            progressCallback(`🔄 Still downloading... Your packages are coming, please be patient!`);
                            lastProgressUpdate = now;
                        }
                    }
                });

                // Set a longer timeout for large repositories (30 minutes for 8GB+ repos)
                const cloneTimeout = setTimeout(() => {
                    gitProcess.kill('SIGTERM');
                    const errorMsg = 'Repository clone timed out after 30 minutes. The repository may be very large. Please check your internet connection and try again.';
                    LocalMain.getServiceContainer().cradle.localLogger.log('error', errorMsg);
                    if (progressCallback) {
                        progressCallback(`Clone failed: ${errorMsg}`);
                    }
                    reject(new Error(errorMsg));
                }, 30 * 60 * 1000); // 30 minutes for very large repos

                gitProcess.on('close', async (code: number) => {
                    clearTimeout(cloneTimeout);
                    
                    if (code === 0) {
                        // Clone succeeded, now configure sparse checkout to only checkout product-packages
                        try {
                            if (progressCallback) {
                                progressCallback(`⚙️ Configuring sparse checkout to download only product-packages directory...`);
                            }
                            
                            // Initialize sparse checkout if not already done
                            const initProcess = spawn(gitPath, ['sparse-checkout', 'init', '--cone'], {
                                cwd: repoPath,
                                env: env,
                                stdio: ['ignore', 'pipe', 'pipe']
                            });
                            
                            await new Promise<void>((initResolve) => {
                                initProcess.on('close', () => initResolve());
                                initProcess.on('error', () => initResolve()); // Continue even if init fails
                            });
                            
                            // Configure sparse checkout to only include product-packages
                            const sparseCheckoutProcess = spawn(gitPath, ['sparse-checkout', 'set', 'product-packages'], {
                                cwd: repoPath,
                                env: env,
                                stdio: ['ignore', 'pipe', 'pipe']
                            });
                            
                            let sparseStdout = '';
                            let sparseStderr = '';
                            
                            sparseCheckoutProcess.stdout.on('data', (data: Buffer) => {
                                sparseStdout += data.toString();
                            });
                            
                            sparseCheckoutProcess.stderr.on('data', (data: Buffer) => {
                                sparseStderr += data.toString();
                            });
                            
                            await new Promise<void>((sparseResolve) => {
                                sparseCheckoutProcess.on('close', (sparseCode: number) => {
                                    if (sparseCode === 0) {
                                        sparseResolve();
                                    } else {
                                        LocalMain.getServiceContainer().cradle.localLogger.log('warn', 
                                            `Sparse checkout set failed (code ${sparseCode}), but continuing. stderr: ${sparseStderr}`
                                        );
                                        sparseResolve(); // Continue anyway
                                    }
                                });
                                
                                sparseCheckoutProcess.on('error', (error: Error) => {
                                    LocalMain.getServiceContainer().cradle.localLogger.log('warn', 
                                        `Sparse checkout error: ${error.message}, but continuing.`
                                    );
                                    sparseResolve(); // Continue anyway
                                });
                            });
                            
                            // Now checkout to actually get the files
                            if (progressCallback) {
                                progressCallback(`📦 Downloading product-packages files... This may take a while, but your packages are coming!`);
                            }
                            
                            const checkoutProcess = spawn(gitPath, ['checkout'], {
                                cwd: repoPath,
                                env: env,
                                stdio: ['ignore', 'pipe', 'pipe']
                            });
                            
                            let checkoutStdout = '';
                            let checkoutStderr = '';
                            let lastCheckoutUpdate = Date.now();
                            
                            checkoutProcess.stdout.on('data', (data: Buffer) => {
                                checkoutStdout += data.toString();
                            });
                            
                            checkoutProcess.stderr.on('data', (data: Buffer) => {
                                checkoutStderr += data.toString();
                                // Parse checkout progress if available
                                const progressMatch = data.toString().match(/(\d+)%/);
                                if (progressMatch && progressCallback) {
                                    progressCallback(`📦 Downloading product-packages: ${progressMatch[1]}% - Almost there!`);
                                } else if (data.toString().includes('remote:') && progressCallback) {
                                    // Show encouraging message even without percentage
                                    const now = Date.now();
                                    if (now - lastCheckoutUpdate >= PROGRESS_UPDATE_INTERVAL * 3) {
                                        progressCallback(`📦 Still downloading packages... Hang in there, they're coming!`);
                                        lastCheckoutUpdate = now;
                                    }
                                }
                            });
                            
                            await new Promise<void>((checkoutResolve, checkoutReject) => {
                                checkoutProcess.on('close', (checkoutCode: number) => {
                                    if (checkoutCode === 0) {
                                        checkoutResolve();
                                    } else {
                                        LocalMain.getServiceContainer().cradle.localLogger.log('warn', 
                                            `Git checkout failed (code ${checkoutCode}), but checking if files exist anyway. stderr: ${checkoutStderr.substring(0, 200)}`
                                        );
                                        checkoutResolve(); // Continue to check if files exist
                                    }
                                });
                                
                                checkoutProcess.on('error', (error: Error) => {
                                    LocalMain.getServiceContainer().cradle.localLogger.log('warn', 
                                        `Git checkout error: ${error.message}, but continuing.`
                                    );
                                    checkoutResolve(); // Continue anyway
                                });
                            });
                            
                            // Verify product-packages directory exists and has content
                            const productPackagesPath = path.join(repoPath, 'product-packages');
                            if (!fs.existsSync(productPackagesPath)) {
                                throw new Error(`Product-packages directory not found after clone and checkout at: ${productPackagesPath}`);
                            }
                            
                            // Check if directory has content
                            const packageEntries = fs.readdirSync(productPackagesPath);
                            if (packageEntries.length === 0) {
                                throw new Error(`Product-packages directory exists but is empty at: ${productPackagesPath}`);
                            }
                            
                            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                                `Git clone completed successfully. Product-packages directory has ${packageEntries.length} entries.`
                            );
                            
                            if (progressCallback) {
                                progressCallback(`Repository cloned successfully - found ${packageEntries.length} packages`);
                            }
                            resolve();
                        } catch (sparseError: any) {
                            // Check if product-packages exists anyway (maybe sparse checkout isn't supported)
                            const productPackagesPath = path.join(repoPath, 'product-packages');
                            if (fs.existsSync(productPackagesPath)) {
                                const packageEntries = fs.readdirSync(productPackagesPath);
                                if (packageEntries.length > 0) {
                                    LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                                        `Product-packages directory exists with ${packageEntries.length} entries despite sparse checkout error`
                                    );
                                    if (progressCallback) {
                                        progressCallback(`Repository cloned successfully - found ${packageEntries.length} packages`);
                                    }
                                    resolve();
                                    return;
                                }
                            }
                            
                            // Sparse checkout failed and directory doesn't exist or is empty
                            const errorMsg = `Failed to clone product-packages directory: ${sparseError.message}. Please ensure Git supports sparse checkout (Git 2.25+) or clone the repository manually.`;
                            LocalMain.getServiceContainer().cradle.localLogger.log('error', errorMsg);
                            if (progressCallback) {
                                progressCallback(`Clone failed: ${errorMsg}`);
                            }
                            reject(new Error(errorMsg));
                        }
                    } else {
                        // Error
                        const errorMsg = `Git clone failed with exit code ${code}`;
                        LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                            `${errorMsg}. stdout: ${stdoutBuffer.substring(0, 500)}, stderr: ${stderrBuffer.substring(0, 500)}`
                        );
                        
                        let userFriendlyError = errorMsg;
                        if (stderrBuffer.includes('authentication') || stderrBuffer.includes('permission denied') || stderrBuffer.includes('403')) {
                            userFriendlyError = 'Authentication failed. Please ensure you are logged in to GitHub via Git.';
                        } else if (stderrBuffer.includes('timeout') || stderrBuffer.includes('ETIMEDOUT')) {
                            userFriendlyError = 'Repository clone timed out. Please check your internet connection and try again.';
                        } else if (stderrBuffer) {
                            userFriendlyError = `Git clone failed: ${stderrBuffer.substring(0, 200)}`;
                        }
                        
                        if (progressCallback) {
                            progressCallback(`Clone failed: ${userFriendlyError}`);
                        }
                        reject(new Error(userFriendlyError));
                    }
                });

                gitProcess.on('error', (error: Error) => {
                    clearTimeout(cloneTimeout);
                    const errorMsg = `Failed to start git clone process: ${error.message}`;
                    LocalMain.getServiceContainer().cradle.localLogger.log('error', errorMsg);
                    if (progressCallback) {
                        progressCallback(`Clone failed: ${errorMsg}`);
                    }
                    reject(new Error(errorMsg));
                });
            });
        } catch (error: any) {
            // Log the full error details
            LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                `Git clone failed: ${error.message || error}`
            );

            // Provide helpful error message
            let errorMessage = error.message || String(error);
            if (error.message && (error.message.includes('git') || error.message.includes('command not found') || error.code === 'ENOENT')) {
                errorMessage = `Git command line tools not found in PATH. Tried PATH: ${combinedPath}. ` +
                    `Please ensure Git is installed and accessible. Common locations: /usr/bin/git, /usr/local/bin/git, /opt/homebrew/bin/git`;
            } else if (error.message && (error.message.includes('authentication') || error.message.includes('permission denied') || error.message.includes('403'))) {
                errorMessage = 'Authentication failed. Please ensure you are logged in to GitHub via Git. Run: git config --global user.name "Your Name" and git config --global user.email "your.email@example.com"';
            } else if (error.message && (error.message.includes('timeout') || error.code === 'ETIMEDOUT')) {
                errorMessage = 'Repository clone timed out. Please check your internet connection and try again.';
            }
            
            if (progressCallback) {
                progressCallback(`Clone failed: ${errorMessage}`);
            }
            
            throw new Error(errorMessage);
        }
    }

    /**
     * Load premium plugins using Git (no token required)
     * Now uses persistent cache and checks for updates
     */
    private async loadPremiumPluginsViaGit(progressCallback?: (status: string) => void): Promise<void> {
        const fs = require('fs');
        const path = require('path');
        const repoPath = this.getRepositoryPath('all-plugins');
        const repoUrl = 'https://github.com/woocommerce/all-plugins.git';

        try {
            // Simple check: does directory exist and have content?
            // Skip git-specific checks for now since repos are manually cloned
            const dirExists = fs.existsSync(repoPath);
            let hasContent = false;
            
            if (dirExists) {
                try {
                    const entries = fs.readdirSync(repoPath);
                    hasContent = entries.length > 0;
                    LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                        `Repository directory exists with ${entries.length} entries: ${repoPath}`
                    );
                } catch (readError) {
                    LocalMain.getServiceContainer().cradle.localLogger.log('warn', 
                        `Could not read repository directory: ${readError.message}`
                    );
                }
            } else {
                LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                    `Repository directory does not exist: ${repoPath}`
                );
            }
            
            if (dirExists && hasContent) {
                // Use existing repository - refresh it to ensure it's up to date
                if (progressCallback) {
                    progressCallback(`Refreshing repository to ensure it's up to date...`);
                }
                LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                    `Repository exists, refreshing: ${repoPath}`
                );
                
                // Check for updates and refresh the repository
                const hasUpdates = await this.checkForUpdates(repoPath, progressCallback);
                if (hasUpdates) {
                    LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                        `Repository updated successfully`
                    );
                    if (progressCallback) {
                        progressCallback(`Repository refreshed successfully`);
                    }
            } else {
                    LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                        `Repository is already up to date`
                    );
                    if (progressCallback) {
                        progressCallback(`Repository is up to date`);
                    }
                }
            } else {
                // Repository doesn't exist or is empty
                // For user-provided paths, don't auto-clone - user should clone it themselves
                const userProvidedPath = LocalMain.UserData.get('allPluginsRepositoryPath');
                if (userProvidedPath && repoPath === userProvidedPath) {
                    throw new Error(`Repository path does not exist or is empty: ${repoPath}. Please ensure you have cloned the repository to this location.`);
                }
                
                // For default cache location, try to clone
                LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                    `Repository not found or empty, attempting clone: ${repoPath}`
                );
                await this.cloneRepository(repoUrl, repoPath, progressCallback);
            }

            // Read product-packages directory
            const packagesDir = path.join(repoPath, 'product-packages');
            
            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                `Looking for product-packages directory at: ${packagesDir}`
            );
            
            // List what's actually in the repository root for debugging
            try {
                const rootEntries = fs.readdirSync(repoPath);
                LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                    `Repository root contains: ${rootEntries.join(', ')}`
                );
            } catch (listError) {
                LocalMain.getServiceContainer().cradle.localLogger.log('warn', 
                    `Could not list repository root: ${listError.message}`
                );
            }
            
            if (!fs.existsSync(packagesDir)) {
                const errorMsg = `Product packages directory not found at: ${packagesDir}. Please ensure the repository was cloned correctly and contains a 'product-packages' directory.`;
                LocalMain.getServiceContainer().cradle.localLogger.log('error', errorMsg);
                throw new Error(errorMsg);
            }

            const entries = fs.readdirSync(packagesDir, { withFileTypes: true });
            this.registryData.premiumPlugins = entries
                .filter(entry => entry.isDirectory() && entry.name !== 'woocommerce-shipstation')
                .map(entry => ({
                    label: entry.name,
                    value: entry.name,
                    name: entry.name
                }));

            this.registryData.pluginInfo = entries
                .filter(entry => entry.isDirectory())
                .map(entry => ({ path: entry.name, type: 'tree' }));

            LocalMain.getServiceContainer().cradle.localLogger.log('info', 
                `Loaded ${this.registryData.premiumPlugins.length} premium plugins via Git`
            );
        } catch (error) {
            LocalMain.getServiceContainer().cradle.localLogger.log('error', 
                `Failed to load premium plugins via Git: ${error.message}`
            );
            throw error;
        }
    }


}


