// https://getflywheel.github.io/local-addon-api/modules/_local_main_.html
import * as LocalMain from '@getflywheel/local/main';
//import { downloadRelease } from '@terascope/fetch-github-release';
//LocalMain.UserData.remove('ghToken');
// Import plugin update modules
import { PluginDetector } from './modules/plugin-updater/PluginDetector';
import { UpdateChecker } from './modules/plugin-updater/UpdateChecker';
import { PluginUpdater } from './modules/plugin-updater/PluginUpdater';
import { UpdateSettingsManager } from './modules/plugin-updater/UpdateSettings';

// Import new plugin manager
import { PluginManager } from './modules/plugin-manager';

// Import blueprint importer modules
import { BlueprintManager } from './modules/blueprint-importer/BlueprintManager';
import { BlueprintValidator } from './modules/blueprint-importer/BlueprintValidator';

// Import centralized logger
import { SimpleLogger } from './utils/SimpleLogger';

/**
 * Get helpful installation instructions based on error message
 */
function getGitInstallationHelp(errorMessage: string): string {
	if (errorMessage.includes('Git command line tools are not installed') || errorMessage.includes('command not found')) {
		return `Git is not installed or not accessible. Please install Git:
		
macOS: Install Xcode Command Line Tools by running: xcode-select --install
Or download Git from: https://git-scm.com/download/mac

After installation, verify by running: git --version`;
	} else if (errorMessage.includes('authentication') || errorMessage.includes('permission denied')) {
		return `Git authentication failed. Please configure Git with your credentials:

1. Set your name: git config --global user.name "Your Name"
2. Set your email: git config --global user.email "your.email@example.com"

For private repositories, you may need to set up SSH keys or use a personal access token.`;
	} else if (errorMessage.includes('timeout')) {
		return `The repository clone timed out. Please check your internet connection and try again.`;
	}
	return `Please check the error message above and ensure Git is properly installed and configured.`;
}

export default function (context) {
	console.log('[Wizard Hat Toolkit] Main process starting...');
	
	const { electron } = context;
	const { ipcMain } = electron;
	const { downloadRelease } = require('@terascope/fetch-github-release');
	const { Octokit } = require("@octokit/rest");
	const fs = require('fs');
	const request = require('request');
	const path = require('path');

	// Initialize centralized logger
	console.log('[Wizard Hat Toolkit] Initializing logger...');
	const logger = SimpleLogger.getInstance(context.environment.userDataPath);
	console.log('[Wizard Hat Toolkit] Logger initialized successfully');
	let premiumPluginInfo = {};
	let premiumPluginSelections = [];
	let premiumThemeInfo = {};
	let premiumThemeSelections = [];
	
	// Initialize PluginManager
	const pluginManager = PluginManager.getInstance();

	ipcMain.on('set-options', async (event, options, siteId) => {
		const site = LocalMain.getServiceContainer().cradle.siteData.getSite(siteId);
		for (var option in options) {
			LocalMain.getServiceContainer().cradle.wpCli.run(site, [
				'option',
				'set',
				option,
				options[option],
			]).then(function () {
				LocalMain.sendIPCEvent('spinner-done');
			 }, function (err) {
				LocalMain.sendIPCEvent('error');
				LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
				LocalMain.sendIPCEvent('spinner-done');
			});
		}
	});

	ipcMain.on('enable-paypal-standard', async (event, siteId) => {
		const site = LocalMain.getServiceContainer().cradle.siteData.getSite(siteId);
			LocalMain.getServiceContainer().cradle.wpCli.run(site, [
				'option',
				'patch',
				'update',
				'woocommerce_paypal_settings',
				'_should_load',
				'yes',
			]).then(function () { 
				LocalMain.sendIPCEvent('spinner-done');
			}, function (err) {
				LocalMain.sendIPCEvent('error');
				LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
				LocalMain.sendIPCEvent('spinner-done');				
			});
	});

	ipcMain.on('test-request', async () => {
		download("", "");
	});

	ipcMain.on('save-username', (event, username) => {
		LocalMain.UserData.set('wpuserName', username);
		LocalMain.UserData.set('sshkeyCopied', true);
	});

	ipcMain.on('save-subdomain', (event, subdomain, siteId) => {
		const subdomains = LocalMain.UserData.get('subdomains');
		subdomains[siteId] = subdomain;
		LocalMain.UserData.set('subdomains', subdomains);
	});

	// Debug IPC handler to test if IPC is working
	ipcMain.on('debug-test', (event, data) => {
		logger.info('MainProcess', 'DEBUG TEST IPC received', data);
		LocalMain.sendIPCEvent('debug-test-response', { received: data, timestamp: new Date().toISOString() });
	});

	// Handle debug logging toggle
	ipcMain.on('toggle-debug-logging', (event, enabled) => {
		logger.setDebugLoggingEnabled(enabled);
		logger.info('MainProcess', `Debug logging ${enabled ? 'enabled' : 'disabled'}`);
	});

	ipcMain.on("install-plugins", async (event, pluginsToInstall, siteId) => {
		logger.info('MainProcess', 'install-plugins IPC received', { pluginsToInstall, siteId });
		
		const site = LocalMain.getServiceContainer().cradle.siteData.getSite(siteId);
		logger.info('MainProcess', 'Site found', { 
			siteId: site?.id, 
			siteName: site?.name,
			sitePath: site?.path,
			fullSiteObject: site
		});
		
		try {
			// Initialize PluginManager if not already done
			if (!pluginManager.isInitialized) {
				logger.info('MainProcess', 'Initializing PluginManager...');
				await pluginManager.initialize(context, process.env.GITHUB_TOKEN);
				logger.info('MainProcess', 'PluginManager initialized successfully');
			} else {
				logger.info('MainProcess', 'PluginManager already initialized');
			}
			
			// Use new PluginManager
			logger.info('MainProcess', 'Calling installPluginsLegacy...');
			await pluginManager.installPluginsLegacy(pluginsToInstall, site);
			logger.info('MainProcess', 'Plugin installation completed successfully');
			
			LocalMain.sendIPCEvent('spinner-done');
		} catch (error) {
			logger.error('MainProcess', 'Plugin installation failed', { error: error.message });
			LocalMain.sendIPCEvent('error');
			LocalMain.sendIPCEvent('spinner-done');
		}
	});

	// Plugin Update Handlers


	// Blueprint Import Handlers
	ipcMain.on('validate-blueprint-content', async (event, blueprintContent) => {
		try {
			console.log('Received blueprint content, length:', blueprintContent.length);
			
			// Parse JSON first to check if it's valid
			const parsedData = JSON.parse(blueprintContent);
			console.log('JSON parsed successfully:', Object.keys(parsedData));
			
			const blueprintManager = new BlueprintManager(context);
			const blueprintData = await blueprintManager.parseBlueprint(blueprintContent);
			
			console.log('Blueprint validation successful');
			LocalMain.sendIPCEvent('blueprint-validated', {
				blueprintData,
				errors: [],
				warnings: []
			});
		} catch (error) {
			console.error('Blueprint validation error:', error);
			LocalMain.sendIPCEvent('blueprint-validation-error', {
				errors: [error.message],
				warnings: []
			});
		}
	});

	ipcMain.on('analyze-blueprint-conflicts', async (event, siteId, blueprintData) => {
		try {
			const site = LocalMain.getServiceContainer().cradle.siteData.getSite(siteId);
			const blueprintManager = new BlueprintManager(context);
			const conflicts = await blueprintManager.analyzeConflicts(site, blueprintData);
			
			LocalMain.sendIPCEvent('blueprint-conflicts-analyzed', conflicts);
		} catch (error) {
			LocalMain.getServiceContainer().cradle.localLogger.log('error', error);
			LocalMain.sendIPCEvent('blueprint-analysis-error', { error: error.message });
		}
	});

	ipcMain.on('import-blueprint', async (event, siteId, blueprintData, importOptions) => {
		try {
			logger.info('MainProcess', 'Import blueprint IPC received', { siteId, importOptions });
			
			const site = LocalMain.getServiceContainer().cradle.siteData.getSite(siteId);
			logger.info('MainProcess', 'Site found', { siteName: site?.name });
			
			const blueprintManager = new BlueprintManager(context);
			
			// Create progress callback to send updates to renderer
			const onProgress = (progress: any) => {
				logger.debug('MainProcess', 'Blueprint import progress update', progress);
				LocalMain.sendIPCEvent('blueprint-import-progress', progress);
			};

			logger.info('MainProcess', 'Starting blueprint import with progress tracking');
			const result = await blueprintManager.importBlueprint(site, blueprintData, importOptions, onProgress);
			logger.info('MainProcess', 'Blueprint import completed', { 
				success: result.success, 
				pluginsInstalled: result.results.pluginsInstalled,
				themesInstalled: result.results.themesInstalled,
				settingsApplied: result.results.settingsApplied,
				sqlStepsExecuted: result.results.sqlStepsExecuted,
				errorsCount: result.results.errors.length
			});
			
			LocalMain.sendIPCEvent('blueprint-import-complete', result);
		} catch (error) {
			logger.error('MainProcess', 'Blueprint import error', { error: error.message });
			LocalMain.sendIPCEvent('blueprint-import-error', { error: error.message });
		}
	});

	ipcMain.on('check-plugin-updates', async (event, siteId) => {
		logger.info('MainProcess', 'check-plugin-updates IPC event received', { siteId });
		const site = LocalMain.getServiceContainer().cradle.siteData.getSite(siteId);
		
		try {
			// Initialize PluginManager if not already done (for repository access)
			if (!pluginManager.isInitialized) {
				// Send progress updates to renderer
				const progressCallback = (status: string) => {
					LocalMain.sendIPCEvent('repository-clone-progress', { status });
				};
				
				try {
					await pluginManager.initialize(context, process.env.GITHUB_TOKEN, progressCallback);
					LocalMain.sendIPCEvent('repository-clone-complete', { success: true });
				} catch (error) {
					LocalMain.sendIPCEvent('repository-clone-error', { 
						error: error.message,
						helpText: getGitInstallationHelp(error.message)
					});
					throw error;
				}
			}
			
			console.log('[Main] Creating detector and checker instances');
			const detector = new PluginDetector(premiumPluginSelections);
			const checker = new UpdateChecker();
			
			// Detect all plugins
			console.log('[Main] Detecting all plugins...');
			const allPlugins = await detector.detectAllPlugins(site);
			console.log('[Main] Found plugins:', allPlugins.length);
			
			if (allPlugins.length > 0) {
				// Check for updates
				console.log('[Main] Checking for updates...');
				const availableUpdates = await checker.checkForUpdates(site, allPlugins);
				console.log('[Main] Available updates:', availableUpdates.length);
				
				if (availableUpdates.length > 0) {
					// Send available updates to UI for selection
					console.log('[Main] Sending available updates to UI');
					LocalMain.sendIPCEvent('updates-available', {
						siteId,
						availableCount: availableUpdates.length,
						updates: availableUpdates.map(update => ({
							name: update.plugin.name,
							currentVersion: update.plugin.version,
							newVersion: update.updateInfo.new_version,
							isMarketplace: update.plugin.isMarketplace
						}))
					});
				} else {
					// No updates available
					console.log('[Main] No updates available, sending no-updates event');
					LocalMain.sendIPCEvent('no-updates-available', {
						siteId,
						pluginCount: allPlugins.length
					});
				}
			} else {
				// No plugins found
				console.log('[Main] No plugins found, sending no-plugins event');
				LocalMain.sendIPCEvent('no-plugins-found', {
					siteId
				});
			}
			
			// Update last check time
			UpdateSettingsManager.setLastUpdateCheck(new Date());
		} catch (error) {
			console.error('[Main] Error in check-plugin-updates:', error);
			LocalMain.getServiceContainer().cradle.localLogger.log('error', error);
			LocalMain.sendIPCEvent('update-error', { siteId, error: error.message });
		}
	});

	ipcMain.on('apply-selected-updates', async (event, siteId, selectedUpdates) => {
		logger.info('MainProcess', 'apply-selected-updates IPC event received', { siteId, selectedUpdates });
		const site = LocalMain.getServiceContainer().cradle.siteData.getSite(siteId);
		
		try {
			console.log('[Main] Creating updater instance');
			const updater = new PluginUpdater(context, premiumPluginSelections);
			
			// Convert selected updates back to UpdateInfo format
			// Note: We need to preserve the isMarketplace flag that was determined during update checking
			// This flag determines whether to update from WordPress.org or the all-plugins repository
			const updatesToApply = selectedUpdates.map(selected => {
				const updateInfo = {
					plugin: {
						name: selected.name,
						slug: selected.name,
						version: selected.currentVersion,
						status: 'active',
						mainFile: selected.name + '.php', // Not used during updates, but kept for consistency
						isMarketplace: selected.isMarketplace // This is the key flag that determines update source
					},
					updateInfo: {
						new_version: selected.newVersion,
						package: '',
						url: ''
					}
				};
				
				logger.info('MainProcess', 'Preparing update', {
					plugin: selected.name,
					currentVersion: selected.currentVersion,
					newVersion: selected.newVersion,
					updateSource: selected.isMarketplace ? 'all-plugins repository' : 'WordPress.org'
				});
				
				return updateInfo;
			});
			
			console.log('[Main] Updates to apply:', updatesToApply.map(u => ({
				name: u.plugin.name,
				currentVersion: u.plugin.version,
				newVersion: u.updateInfo.new_version,
				updateSource: u.plugin.isMarketplace ? 'all-plugins repository' : 'WordPress.org',
				isMarketplace: u.plugin.isMarketplace
			})));
			
			// Apply selected updates
			console.log('[Main] Applying selected updates...');
			await updater.updateSelectedPlugins(site, updatesToApply);
			console.log('[Main] Updates completed, sending success event');
			
			LocalMain.sendIPCEvent('plugins-updated', {
				siteId,
				updatedCount: updatesToApply.length,
				plugins: updatesToApply.map(u => u.plugin.name)
			});
		} catch (error) {
			console.error('[Main] Error in apply-selected-updates:', error);
			LocalMain.getServiceContainer().cradle.localLogger.log('error', error);
			LocalMain.sendIPCEvent('update-error', { siteId, error: error.message });
		}
	});

	// Hook into site startup to check for plugin updates
	// Note: Using a different approach since siteData.on is not available
	// We'll check for updates when the plugin update tab is accessed instead

	ipcMain.on("install-themes", async (event, themesToInstall, siteId) => {
		const site = LocalMain.getServiceContainer().cradle.siteData.getSite(siteId);
		try {
			// Initialize PluginManager if not already done
			if (!pluginManager.isInitialized) {
				await pluginManager.initialize(context, process.env.GITHUB_TOKEN);
			}
			
			// Use new PluginManager
			await pluginManager.installThemesLegacy(themesToInstall, site);
			LocalMain.sendIPCEvent('spinner-done');
		} catch (error) {
			LocalMain.getServiceContainer().cradle.localLogger.log('error', error);
			LocalMain.sendIPCEvent('error');
			LocalMain.sendIPCEvent('spinner-done');
		}
	});

	ipcMain.on("get-order-id", async (event, siteId) => {
		const site = LocalMain.getServiceContainer().cradle.siteData.getSite(siteId);
		await LocalMain.getServiceContainer().cradle.wpCli.run(site, ["post", "list", "--post_type=shop_order", "--posts_per_page=1", "--fields=ID", "--format=json"]).then(function (result) {
			LocalMain.sendIPCEvent('got-order-id', result);
		});
	});

	// Repository setup handlers
	ipcMain.on('check-repository-configured', (event) => {
		const repositoryPath = LocalMain.UserData.get('allPluginsRepositoryPath');
		LocalMain.sendIPCEvent('repository-configured-status', {
			configured: !!repositoryPath,
			path: repositoryPath || null
		});
	});

	ipcMain.on('validate-repository-path', async (event, repositoryPath: string) => {
		try {
			const fs = require('fs');
			const path = require('path');
			
			// Check if path exists
			if (!fs.existsSync(repositoryPath)) {
				LocalMain.sendIPCEvent('repository-path-validated', {
					valid: false,
					error: 'Path does not exist. Please check the path and try again.'
				});
				return;
			}

			// Check if it's a directory
			const stats = fs.statSync(repositoryPath);
			if (!stats.isDirectory()) {
				LocalMain.sendIPCEvent('repository-path-validated', {
					valid: false,
					error: 'Path is not a directory. Please provide the path to the repository folder.'
				});
				return;
			}

			// Check if product-packages directory exists (for all-plugins repo)
			const productPackagesPath = path.join(repositoryPath, 'product-packages');
			if (!fs.existsSync(productPackagesPath)) {
				LocalMain.sendIPCEvent('repository-path-validated', {
					valid: false,
					error: 'Repository does not contain a "product-packages" directory. Please ensure this is the correct all-plugins repository.'
				});
				return;
			}

			// Check if it's a git repository (optional but recommended)
			const gitPath = path.join(repositoryPath, '.git');
			if (!fs.existsSync(gitPath)) {
				LocalMain.getServiceContainer().cradle.localLogger.log('warn', 
					`Repository path ${repositoryPath} does not appear to be a git repository`
				);
				// Don't fail validation, but log a warning
			}

			LocalMain.sendIPCEvent('repository-path-validated', {
				valid: true,
				path: repositoryPath
			});
		} catch (error) {
			LocalMain.getServiceContainer().cradle.localLogger.log('error', 
				`Error validating repository path: ${error.message}`
			);
			LocalMain.sendIPCEvent('repository-path-validated', {
				valid: false,
				error: `Error validating path: ${error.message}`
			});
		}
	});

	ipcMain.on('save-repository-path', (event, repositoryPath: string) => {
		try {
			LocalMain.UserData.set('allPluginsRepositoryPath', repositoryPath);
			LocalMain.getServiceContainer().cradle.localLogger.log('info',
				`Saved repository path: ${repositoryPath}`
			);
			LocalMain.sendIPCEvent('repository-path-saved', { success: true });
		} catch (error) {
			LocalMain.getServiceContainer().cradle.localLogger.log('error',
				`Error saving repository path: ${error.message}`
			);
			LocalMain.sendIPCEvent('repository-path-saved', {
				success: false,
				error: error.message
			});
		}
	});

	// Force refresh repository
	ipcMain.on('force-refresh-repository', async (event) => {
		try {
			const progressCallback = (status: string) => {
				LocalMain.sendIPCEvent('repository-clone-progress', { status });
			};

			await pluginManager.forceRefresh(progressCallback);

			// Get updated repository status
			const registry = pluginManager.getRegistry();
			const lastUpdated = registry.getLastUpdated();

			LocalMain.sendIPCEvent('repository-clone-complete', {
				success: true,
				lastUpdated: lastUpdated.toISOString()
			});
		} catch (error) {
			LocalMain.getServiceContainer().cradle.localLogger.log('error',
				`Error forcing repository refresh: ${error.message}`
			);
			LocalMain.sendIPCEvent('repository-clone-error', {
				error: error.message,
				helpText: getGitInstallationHelp(error.message)
			});
		}
	});

	// Get repository status (path, last updated, etc.)
	ipcMain.on('get-repository-status', async (event) => {
		try {
			const registry = pluginManager.getRegistry();
			const repositoryPath = registry.getConfiguredRepositoryPath();
			const lastUpdated = registry.getLastUpdated();
			const isInitialized = pluginManager.isInitialized;

			LocalMain.sendIPCEvent('repository-status', {
				path: repositoryPath,
				lastUpdated: lastUpdated.toISOString(),
				isInitialized: isInitialized
			});
		} catch (error) {
			LocalMain.getServiceContainer().cradle.localLogger.log('error',
				`Error getting repository status: ${error.message}`
			);
			LocalMain.sendIPCEvent('repository-status', {
				path: null,
				lastUpdated: null,
				isInitialized: false,
				error: error.message
			});
		}
	});

	ipcMain.on("get-premium-plugin-selections", async () => {
		try {
			// Initialize PluginManager if not already done
			if (!pluginManager.isInitialized) {
				// Send progress updates to renderer
				const progressCallback = (status: string) => {
					LocalMain.sendIPCEvent('repository-clone-progress', { status });
				};
				
				try {
					await pluginManager.initialize(context, process.env.GITHUB_TOKEN, progressCallback);
					LocalMain.sendIPCEvent('repository-clone-complete', { success: true });
				} catch (error) {
					LocalMain.sendIPCEvent('repository-clone-error', { 
						error: error.message,
						helpText: getGitInstallationHelp(error.message)
					});
					throw error;
				}
			}
			
			// Get premium plugin selections from PluginManager
			const selections = pluginManager.getPremiumPluginSelections();
			premiumPluginSelections = selections; // Keep for backward compatibility
			
			LocalMain.sendIPCEvent("premium-plugin-selections", selections);
		} catch (error) {
			LocalMain.getServiceContainer().cradle.localLogger.log("error", error);
			LocalMain.sendIPCEvent('error');
			LocalMain.sendIPCEvent('spinner-done');
		}
	});

	ipcMain.on("install-wc-dev-tools", async (event, siteId) => {
		const site = LocalMain.getServiceContainer().cradle.siteData.getSite(siteId);
		const outputFile = context.environment.userDataPath + `/addons/wizard-hat-toolkit/woocommerce-payments-dev-tools.zip`;
		await downloadZipFromGitHub("https://github.com/Automattic/woocommerce-payments-dev-tools/archive/refs/heads/trunk.zip", outputFile).then((result) => {
		}, function (err) {
			LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
		}).then(async () => {
			await LocalMain.getServiceContainer().cradle.wpCli.run(site, ["plugin", "install", outputFile, "--activate", "--force"]).then(function () {
				LocalMain.getServiceContainer().cradle.localLogger.log('info', `Successfully installed plugin: ${outputFile} on site: ${site.id}`);
				const options = {
					wcpaydev_proxy: false,
					wcpaydev_redirect: false,
					wcpaydev_redirect_localhost: false,
					wcpaydev_display_notice: true,
				}
				for (var option in options) {
					LocalMain.getServiceContainer().cradle.wpCli.run(site, [
						'option',
						'set',
						option,
						options[option],
					]).then(function () { }, function (err) {
						LocalMain.sendIPCEvent('error');
						LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
					});
				}
			}).then(function () {

				fs.unlink(outputFile, (err) => {
					if (err) {
						LocalMain.getServiceContainer().cradle.localLogger.log("error", err)
					}
				});
			}, function (err) {
				LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
				LocalMain.sendIPCEvent('spinner-done');
			});
		});
	})

	ipcMain.on("get-premium-theme-selections", async () => {
		try {
			// Initialize PluginManager if not already done
			if (!pluginManager.isInitialized) {
				// Send progress updates to renderer
				const progressCallback = (status: string) => {
					LocalMain.sendIPCEvent('repository-clone-progress', { status });
				};
				
				try {
					await pluginManager.initialize(context, process.env.GITHUB_TOKEN, progressCallback);
					LocalMain.sendIPCEvent('repository-clone-complete', { success: true });
				} catch (error) {
					LocalMain.sendIPCEvent('repository-clone-error', { 
						error: error.message,
						helpText: getGitInstallationHelp(error.message)
					});
					throw error;
				}
			}
			
			// Get premium theme selections from PluginManager
			const selections = pluginManager.getPremiumThemeSelections();
			premiumThemeSelections = selections; // Keep for backward compatibility
			
			LocalMain.sendIPCEvent("premium-theme-selections", selections);
		} catch (error) {
			LocalMain.getServiceContainer().cradle.localLogger.log("error", error);
			LocalMain.sendIPCEvent('error');
			LocalMain.sendIPCEvent('spinner-done');
		}
	});

	ipcMain.on("install-woocommerce", async (event, siteId, path) => {
		var error = false;
		const site = LocalMain.getServiceContainer().cradle.siteData.getSite(siteId);
		const options = {
			woocommerce_store_address: "537 Paper Street",
			woocommerce_store_address_2: "#34",
			woocommerce_store_city: "Wilmington",
			woocommerce_default_country: "US:DE",
			woocommerce_store_postcode: "19806",
			woocommerce_currency: "USD",
			woocommerce_price_thousand_sep: ",",
			woocommerce_price_decimal_sep: ".",
			woocommerce_weight_unit: "lbs",
			woocommerce_dimension_unit: "in",
			woocommerce_calc_taxes: "yes",
		}

		const commands = [
			["wc", "--user=1", "tool", "run", "install_pages"],
		];

		await LocalMain.getServiceContainer().cradle.wpCli.run(site, ["plugin", "install", "woocommerce", "--activate", "--force"]).then(function () {
			LocalMain.getServiceContainer().cradle.localLogger.log('info', `Successfully installed plugin: woocommerce on site: ${site.id}`);
		}, function (err) {
			LocalMain.sendIPCEvent('error');
			LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
			error = true;
		});

		await LocalMain.getServiceContainer().cradle.wpCli.run(site, ["plugin", "install", "wordpress-importer", "--activate", "--force"]).then(function () {
			LocalMain.getServiceContainer().cradle.localLogger.log('info', `Successfully installed plugin: wordpress-importer on site: ${site.id}`);
			LocalMain.getServiceContainer().cradle.wpCli.run(site, ["import", path + "/app/public/wp-content/plugins/woocommerce/sample-data/sample_products.xml", "--authors=skip"], { skipPlugins: false }).then(function () {
			}, function (err) {
				LocalMain.sendIPCEvent('error');
				LocalMain.sendIPCEvent('spinner-done');
				LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
			});
		}, function (err) {
			LocalMain.sendIPCEvent('error');
			LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
			error = true;
		});

		if (!error) {
			commands.forEach(command => {
				LocalMain.getServiceContainer().cradle.wpCli.run(site, command, { skipPlugins: false }).then(function () {
				}, function (err) {
					error = true;
					LocalMain.sendIPCEvent('error');
					LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
				});
			});


			for (var option in options) {
				LocalMain.getServiceContainer().cradle.wpCli.run(site, [
					'option',
					'set',
					option,
					options[option],
				]).then(function () { }, function (err) {
					LocalMain.sendIPCEvent('error');
					LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
					error = true;
				});
			}
		}


		if (!error) {
			LocalMain.sendIPCEvent("spinner-done");
		}

	});

	ipcMain.on('switch-country', async (event, siteId, options) => {
		console.log('[Main] switch-country IPC received:', { siteId, options });
		LocalMain.getServiceContainer().cradle.localLogger.log('info', `switch-country IPC received for site ${siteId}`);
		
		// Get site object.
		const site = LocalMain.getServiceContainer().cradle.siteData.getSite(siteId);
		var error = false;
		
		for (var option in options) {
			try {
				await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
					'option',
					'set',
					option,
					options[option],
				]);
				console.log(`[Main] Set option ${option} = ${options[option]}`);
			} catch (err) {
				console.error(`[Main] Failed to set option ${option}:`, err);
				LocalMain.sendIPCEvent('error');
				LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
				error = true;
			}
		}

		if (!error) {
			console.log('[Main] Country switch completed successfully');
			LocalMain.sendIPCEvent('instructions');
		} else {
			console.error('[Main] Country switch failed');
		}
		
		// Always send spinner-done to stop the spinner
		LocalMain.sendIPCEvent('spinner-done');
	});

	/**
	 * Downloads file from remote HTTP[S] host and puts its contents to the
	 * specified location.
	 */
	async function download(url, filePath) {
		const user = 'woocommerce';
		const repo = 'automatewoo';
		const outputdir = context.environment.userDataPath + '/addons/wizard-hat-toolkit/';
		const leaveZipped = true;
		const disableLogging = false;

		// Define a function to filter releases.
		function filterRelease(release) {
			// Filter out prereleases.
			return release.prerelease === false;
		}


		downloadRelease(user, repo, outputdir, filterRelease, () => { return true; }, leaveZipped, disableLogging)
			.then(function () {
				LocalMain.getServiceContainer().cradle.localLogger.log('info', "All done");
			})
			.catch(function (err) {
				LocalMain.sendIPCEvent('error');
				LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
				LocalMain.getServiceContainer().cradle.localLogger.log('error', err.message);
			});
	}

	function installPlugins(pluginsToInstall, site) {
		let dotOrgPlugins = [];
		let premiumPlugins = [];
		pluginsToInstall.forEach((slug: string) => {
			const isPremium = obj => obj.label === slug;
			if (premiumPluginSelections.some(isPremium)) {
				premiumPlugins.push(slug);
				// Track installed marketplace plugin
				PluginDetector.trackInstalledPlugin(slug);
			} else {
				dotOrgPlugins.push(slug);
			}
		});
		downloadPlugins(premiumPlugins).then(async (zipFiles) => {
			zipFiles = zipFiles.concat(dotOrgPlugins)
			for (const zipFile of zipFiles) {
				await LocalMain.getServiceContainer().cradle.wpCli.run(site, ["plugin", "install", zipFile, "--activate", "--force"]).then(function () {
					LocalMain.getServiceContainer().cradle.localLogger.log('info', `Successfully installed plugin: ${zipFile} on site: ${site.id}`);
					if (!dotOrgPlugins.includes(zipFile)) {
						fs.unlink(zipFile, (err) => {
							if (err) {
								LocalMain.getServiceContainer().cradle.localLogger.log("error", err)
							}
						});
					}
				}, function (err) {
					LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
					LocalMain.sendIPCEvent('spinner-done');
				});
			}
		}).then(() => {
			LocalMain.sendIPCEvent('spinner-done');
		});
	}

	function installThemes(themesToInstall, site) {
		let dotOrgThemes = [];
		let premiumThemes = [];
		themesToInstall.forEach((slug: string) => {
			const isPremium = obj => obj.label === slug;
			if (premiumThemeSelections.some(isPremium)) {
				premiumThemes.push(slug);
			} else {
				dotOrgThemes.push(slug);
			}
		});

		downloadThemes(premiumThemes).then(async (zipFiles) => {
			zipFiles = zipFiles.concat(dotOrgThemes)
			for (const zipFile of zipFiles) {
				await LocalMain.getServiceContainer().cradle.wpCli.run(site, ["theme", "install", zipFile]).then(function () {
					if (!dotOrgThemes.includes(zipFile)) {
						fs.unlink(zipFile, (err) => {
							if (err) {
								LocalMain.getServiceContainer().cradle.localLogger.log("error", err)
							}
						});
					}
				}, function (err) {
					LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
					LocalMain.sendIPCEvent('spinner-done');
				});
			}
		}).then(() => {
			LocalMain.sendIPCEvent('spinner-done');
		});
	}

	/**
	 * Downloads file from remote HTTP[S] host and puts its contents to the
	 * specified location.
	 */
	async function getPremiumPluginsData() {
		if (!process.env.GITHUB_TOKEN) {
			LocalMain.sendIPCEvent("debug-message", new Error('GitHub token is required to access private repository'));
			return;
		}

		// Authentication is required for private repos
		const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
		await octokit.request('GET /repos/{owner}/{repo}/commits', {
			owner: 'woocommerce',
			repo: 'all-plugins',
		}).then(async ({ data }) => {
			await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
				owner: 'woocommerce',
				repo: 'all-plugins',
				tree_sha: data[0].commit.tree.sha,
			}).then(async ({ data }) => {
				var targetSha;
				for (var index in data.tree) {
					if ("undefined" != typeof data.tree[index] && "product-packages" === data.tree[index].path) {
						targetSha = data.tree[index].sha;
						break;
					}
				}
				await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
					owner: 'woocommerce',
					repo: 'all-plugins',
					tree_sha: targetSha,
				}).then(async ({ data }) => {
					for (var index in data.tree) {
						if ("tree" === data.tree[index].type) {
							premiumPluginSelections.push({ name: data.tree[index].path, value: index });
						}
					}
					premiumPluginInfo = data.tree;
				}, function (err) {
					LocalMain.sendIPCEvent("debug-message", err);
				});
			}, function (err) {
				LocalMain.sendIPCEvent("debug-message", err);
			});
		}, function (err) {
			LocalMain.sendIPCEvent("debug-message", err);
		});
	}

	const downloadZipFromGitHub = (fileUrl: string, outputFile: string) => {
		return new Promise((resolve, reject) => {
			try {
				if (!process.env.GITHUB_TOKEN) {
					reject(new Error('GitHub token is required to download from private repository'));
					return;
				}

				// Build request options with authentication required for private repos
				const requestOptions: any = {
					'auth': {
						'bearer': process.env.GITHUB_TOKEN
					},
					'headers': {
						'User-Agent': 'Wizard Hat Toolkit'
					}
				};

				request.get(fileUrl, requestOptions)
				.on("error", function (err) {
					LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
					reject(err);
				}).pipe(fs.createWriteStream(outputFile)).on('finish', () => {
					resolve(outputFile);
				});
			} catch (err) {
				LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
				reject(err);
			}
		});
	};

	const sortSlugs = (slug) => {
		return new Promise((resolve, reject) => {
			const isPremium = obj => obj.label === slug;
			resolve(premiumPluginSelections.some(isPremium))
		});
	}

	const getDownloadUrl = (pluginSlug) => {
		if (!process.env.GITHUB_TOKEN) {
			return Promise.reject(new Error('GitHub token is required to get download URL for private repository'));
		}

		const path = `product-packages/${pluginSlug}`;
		const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
		return new Promise((resolve, reject) => {
			octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
				owner: 'woocommerce',
				repo: 'all-plugins',
				path: path,
			}).then(async ({ data }) => {
				// Handle both array and single file responses
				const fileList = Array.isArray(data) ? data : [data];
				for (const element of fileList) {
					if (pluginSlug + '.zip' === element.name) {
						resolve(element.download_url);
						return;
					}
				}
				reject(new Error(`Plugin zip file not found for ${pluginSlug}`));
			}, function (err) {
				LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
				reject(err);
			});
		});
	}

	const getThemeDownloadUrl = (pluginSlug) => {
		if (!process.env.GITHUB_TOKEN) {
			return Promise.reject(new Error('GitHub token is required to get theme download URL for private repository'));
		}

		const path = pluginSlug;
		const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
		return new Promise((resolve, reject) => {
			octokit.request('GET /repos/{owner}/{repo}/releases/latest', {
				owner: 'woocommerce',
				repo: pluginSlug,
			}).then(async ({ data }) => {
				resolve(data.zipball_url);
			}, function (err) {
				LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
				reject(err);
			});
		});
	}

	const downloadPlugins = async (pluginsToInstall) => {
		let zipFiles = [];
		for (const pluginSlug of pluginsToInstall) {
			const outputFile = context.environment.userDataPath + `/addons/wizard-hat-toolkit/${pluginSlug}.zip`;
			await getDownloadUrl(pluginSlug).then(async (fileUrl: string) => {
				await downloadZipFromGitHub(fileUrl, outputFile).then((result) => {
					zipFiles.push(result);
				}, function (err) {
					LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
				});
			}, function (err) {
				LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
			});

		}
		return zipFiles;
	};

	const downloadThemes = async (pluginsToInstall) => {

		let zipFiles = [];
		for (const pluginSlug of pluginsToInstall) {
			const outputFile = context.environment.userDataPath + `/addons/wizard-hat-toolkit/${pluginSlug}.zip`;
			await getThemeDownloadUrl(pluginSlug).then(async (fileUrl: string) => {
				await downloadZipFromGitHub(fileUrl, outputFile).then((result) => {
					zipFiles.push(result);
				}, function (err) {
					LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
				});
			}, function (err) {
				LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
			});

		}
		return zipFiles;
	};
}
