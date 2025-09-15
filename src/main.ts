// https://getflywheel.github.io/local-addon-api/modules/_local_main_.html
import * as LocalMain from '@getflywheel/local/main';
//import { downloadRelease } from '@terascope/fetch-github-release';
//LocalMain.UserData.remove('ghToken');
process.env.GITHUB_TOKEN = LocalMain.UserData.get('ghToken');
var validToken = false;

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
import { Logger } from './utils/Logger';
export default function (context) {
	console.log('[Wizard Hat Toolkit] Main process starting...');
	
	const { electron } = context;
	const { ipcMain } = electron;
	const { validateGitHubToken, ValidationError } = require('validate-github-token');
	const { downloadRelease } = require('@terascope/fetch-github-release');
	const { Octokit } = require("@octokit/rest");
	const fs = require('fs');
	const request = require('request');
	const path = require('path');

	// Initialize centralized logger
	console.log('[Wizard Hat Toolkit] Initializing logger...');
	const logger = Logger.getInstance(context.environment.userDataPath);
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

	ipcMain.on('get-jtubeStuff', (event, siteId) => {
		const subdomains = LocalMain.UserData.get('subdomains');
		const subdomain = subdomains ? subdomains[siteId] : null;
		LocalMain.sendIPCEvent('jtubeStuff', [{ userDataPath: context.environment.userDataPath }, { jtubeInstalled: fs.existsSync(context.environment.userHome + '/jurassictube/jurassictube.sh') }, {wpUsername: LocalMain.UserData.get('wpuserName')}, {subdomain: subdomain}, {userHome: context.environment.userHome}, {sshkeyCopied: LocalMain.UserData.get('sshkeyCopied')}])
	});

	ipcMain.on('is-token-valid', () => {
		LocalMain.sendIPCEvent('token-is-valid', validToken);
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
			sitePath: site?.path
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
	ipcMain.on('check-plugin-updates', async (event, siteId) => {
		const site = LocalMain.getServiceContainer().cradle.siteData.getSite(siteId);
		
		try {
			const detector = new PluginDetector(premiumPluginSelections);
			const checker = new UpdateChecker();
			const updater = new PluginUpdater(context, premiumPluginSelections);
			
			// Detect marketplace plugins
			const marketplacePlugins = await detector.detectMarketplacePlugins(site);
			
			if (marketplacePlugins.length > 0) {
				// Check for updates
				const availableUpdates = await checker.checkForUpdates(site, marketplacePlugins);
				
				if (availableUpdates.length > 0) {
					// Update plugins if auto-update is enabled
					if (UpdateSettingsManager.isAutoUpdateEnabled()) {
						await updater.updatePlugins(site, availableUpdates);
						
						LocalMain.sendIPCEvent('plugins-updated', {
							siteId,
							updatedCount: availableUpdates.length,
							plugins: availableUpdates.map(u => u.plugin.name)
						});
						return; // Exit early after successful updates
					} else {
						// Just notify about available updates
						LocalMain.sendIPCEvent('updates-available', {
							siteId,
							availableCount: availableUpdates.length,
							plugins: availableUpdates.map(u => u.plugin.name)
						});
						return; // Exit early after notifying about available updates
					}
				} else {
					// No updates available
					LocalMain.sendIPCEvent('no-updates-available', {
						siteId,
						pluginCount: marketplacePlugins.length
					});
				}
			} else {
				// No marketplace plugins found
				LocalMain.sendIPCEvent('no-marketplace-plugins', {
					siteId
				});
			}
			
			// Update last check time
			UpdateSettingsManager.setLastUpdateCheck(new Date());
		} catch (error) {
			LocalMain.getServiceContainer().cradle.localLogger.log('error', error);
			LocalMain.sendIPCEvent('update-error', { siteId, error: error.message });
		}
	});

	ipcMain.on('update-plugin-settings', async (event, settings) => {
		UpdateSettingsManager.updateSettings(settings);
		LocalMain.sendIPCEvent('settings-updated');
	});

	ipcMain.on('get-plugin-settings', () => {
		const settings = UpdateSettingsManager.getSettings();
		LocalMain.sendIPCEvent('plugin-settings', settings);
	});

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
			console.log('Import blueprint IPC received:', { siteId, blueprintData, importOptions });
			
			const site = LocalMain.getServiceContainer().cradle.siteData.getSite(siteId);
			console.log('Site found:', site?.name);
			
			const blueprintManager = new BlueprintManager(context);
			
			// Send initial progress
			LocalMain.sendIPCEvent('blueprint-import-progress', {
				pluginsInstalled: 0,
				themesInstalled: 0,
				settingsApplied: 0,
				errors: []
			});

			console.log('Starting blueprint import...');
			const result = await blueprintManager.importBlueprint(site, blueprintData, importOptions);
			console.log('Blueprint import completed:', result);
			
			LocalMain.sendIPCEvent('blueprint-import-complete', result);
		} catch (error) {
			console.error('Blueprint import error:', error);
			LocalMain.getServiceContainer().cradle.localLogger.log('error', error);
			LocalMain.sendIPCEvent('blueprint-import-error', { error: error.message });
		}
	});

	ipcMain.on('apply-plugin-updates', async (event, siteId) => {
		logger.info('MainProcess', 'apply-plugin-updates IPC event received', { siteId });
		const site = LocalMain.getServiceContainer().cradle.siteData.getSite(siteId);
		
		try {
			console.log('[Main] Creating detector, checker, and updater instances');
			const detector = new PluginDetector(premiumPluginSelections);
			const checker = new UpdateChecker();
			const updater = new PluginUpdater(context, premiumPluginSelections);
			
			// Detect marketplace plugins
			console.log('[Main] Detecting marketplace plugins...');
			const marketplacePlugins = await detector.detectMarketplacePlugins(site);
			console.log('[Main] Found marketplace plugins:', marketplacePlugins.length);
			
			if (marketplacePlugins.length > 0) {
				// Check for updates
				console.log('[Main] Checking for updates...');
				const availableUpdates = await checker.checkForUpdates(site, marketplacePlugins);
				console.log('[Main] Available updates:', availableUpdates.length);
				
				if (availableUpdates.length > 0) {
					// Apply updates
					console.log('[Main] Applying updates...');
					await updater.updatePlugins(site, availableUpdates);
					console.log('[Main] Updates completed, sending success event');
					
					LocalMain.sendIPCEvent('plugins-updated', {
						siteId,
						updatedCount: availableUpdates.length,
						plugins: availableUpdates.map(u => u.plugin.name)
					});
				} else {
					// No updates available
					console.log('[Main] No updates available, sending no-updates event');
					LocalMain.sendIPCEvent('no-updates-available', {
						siteId,
						pluginCount: marketplacePlugins.length
					});
				}
			} else {
				// No marketplace plugins found
				console.log('[Main] No marketplace plugins found, sending no-plugins event');
				LocalMain.sendIPCEvent('no-marketplace-plugins', {
					siteId
				});
			}
			
			// Update last check time
			UpdateSettingsManager.setLastUpdateCheck(new Date());
		} catch (error) {
			console.error('[Main] Error in apply-plugin-updates:', error);
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

	ipcMain.on("get-premium-plugin-selections", async () => {
		try {
			// Initialize PluginManager if not already done
			if (!pluginManager.isInitialized) {
				await pluginManager.initialize(context, process.env.GITHUB_TOKEN);
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
				await pluginManager.initialize(context, process.env.GITHUB_TOKEN);
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
		}, function (err) {
			LocalMain.sendIPCEvent('error');
			LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
			error = true;
		});

		await LocalMain.getServiceContainer().cradle.wpCli.run(site, ["plugin", "install", "wordpress-importer", "--activate", "--force"]).then(function () {
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

	ipcMain.on("set-user-token", (event, token) => {
		process.env.GITHUB_TOKEN = token;
		LocalMain.sendIPCEvent("validate-token");
	});

	ipcMain.on('validate-token', async () => {
		try {
			const validated = await validateGitHubToken(
				process.env.GITHUB_TOKEN,
				{
					scope: {
						// Checks 'repo' scope is added to the token
						included: ['repo']
					}
				}
			);
			LocalMain.UserData.set('ghToken', process.env.GITHUB_TOKEN);
			LocalMain.sendIPCEvent("gh-token", { "valid": true });
			validToken = true;
		} catch (err) {
			if (err instanceof ValidationError) {
				LocalMain.getServiceContainer().cradle.localLogger.log('error', 'error:(');
				LocalMain.getServiceContainer().cradle.localLogger.log('error', err.message);
				LocalMain.sendIPCEvent("gh-token", { "valid": false });
				LocalMain.UserData.remove('ghToken');
			} else {
				LocalMain.sendIPCEvent('error');
				LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
				throw err;
			}
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
				request.get(fileUrl, {
					'auth': {
						'bearer': process.env.GITHUB_TOKEN
					},
					'headers': {
						'User-Agent': 'Wizard Hat Toolkit'
					}
				}).on("error", function (err) {
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
		const path = `product-packages/${pluginSlug}`;
		const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
		return new Promise((resolve, reject) => {
			octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
				owner: 'woocommerce',
				repo: 'all-plugins',
				path: path,
			}).then(async ({ data }) => {
				await data.every(async (element) => {
					if (pluginSlug + '.zip' === element.name) {
						resolve(element.download_url);
					}
				});
			}, function (err) {
				LocalMain.getServiceContainer().cradle.localLogger.log('error', err);
				reject(err);
			});
		});
	}

	const getThemeDownloadUrl = (pluginSlug) => {
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
