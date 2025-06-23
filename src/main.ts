// https://getflywheel.github.io/local-addon-api/modules/_local_main_.html
import * as LocalMain from '@getflywheel/local/main';
//import { downloadRelease } from '@terascope/fetch-github-release';
//LocalMain.UserData.remove('ghToken');
process.env.GITHUB_TOKEN = LocalMain.UserData.get('ghToken');
var validToken = false;
export default function (context) {
	const { electron } = context;
	const { ipcMain } = electron;
	const { validateGitHubToken, ValidationError } = require('validate-github-token');
	const { downloadRelease } = require('@terascope/fetch-github-release');
	const { Octokit } = require("@octokit/rest");
	const fs = require('fs');
	const request = require('request');
	let premiumPluginInfo = {};
	let premiumPluginSelections = [];
	let premiumThemeInfo = {};
	let premiumThemeSelections = [];

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

	ipcMain.on("install-plugins", async (event, pluginsToInstall, siteId) => {
		const site = LocalMain.getServiceContainer().cradle.siteData.getSite(siteId);
		installPlugins(pluginsToInstall, site);
	});

	ipcMain.on("install-themes", async (event, themesToInstall, siteId) => {
		const site = LocalMain.getServiceContainer().cradle.siteData.getSite(siteId);
		installThemes(themesToInstall, site);
	});

	ipcMain.on("get-order-id", async (event, siteId) => {
		const site = LocalMain.getServiceContainer().cradle.siteData.getSite(siteId);
		await LocalMain.getServiceContainer().cradle.wpCli.run(site, ["post", "list", "--post_type=shop_order", "--posts_per_page=1", "--fields=ID", "--format=json"]).then(function (result) {
			LocalMain.sendIPCEvent('got-order-id', result);
		});
	});

	ipcMain.on("get-premium-plugin-selections", async () => {
		if (validToken && !premiumPluginSelections.length) {
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
							if ("tree" === data.tree[index].type && "woocommerce-shipstation" != data.tree[index].path ) {
								premiumPluginSelections.push({ label: data.tree[index].path, value: index });
							}
						}
						premiumPluginInfo = data.tree;
					}, function (err) {
						LocalMain.getServiceContainer().cradle.localLogger.log("error", err)
						LocalMain.sendIPCEvent('error');
						LocalMain.sendIPCEvent('spinner-done');
					});
				}, function (err) {
					LocalMain.getServiceContainer().cradle.localLogger.log("error", err)
					LocalMain.sendIPCEvent('error');
					LocalMain.sendIPCEvent('spinner-done');
				});
			}, function (err) {
				LocalMain.getServiceContainer().cradle.localLogger.log("error", err)
				LocalMain.sendIPCEvent('error');
				LocalMain.sendIPCEvent('spinner-done');
			});
		}
		LocalMain.sendIPCEvent("premium-plugin-selections", premiumPluginSelections);
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
		if (validToken && !premiumThemeSelections.length) {
			const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
			await octokit.request('GET /repos/{owner}/{repo}/commits', {
				owner: 'woocommerce',
				repo: 'all-themes',
			}).then(async ({ data }) => {
				await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
					owner: 'woocommerce',
					repo: 'all-themes',
					tree_sha: data[0].commit.tree.sha,
				}).then(async ({ data }) => {
					for (var index in data.tree) {
						if ("tree" === data.tree[index].type) {
							premiumThemeSelections.push({ label: data.tree[index].path, value: index });
						}
					}
					premiumThemeInfo = data.tree;
				}, function (err) {
					LocalMain.getServiceContainer().cradle.localLogger.log("error", err)
					LocalMain.sendIPCEvent('error');
					LocalMain.sendIPCEvent('spinner-done');
				});
			}, function (err) {
				LocalMain.getServiceContainer().cradle.localLogger.log("error", err)
				LocalMain.sendIPCEvent('error');
				LocalMain.sendIPCEvent('spinner-done');
			});
		}
		LocalMain.sendIPCEvent("premium-theme-selections", premiumThemeSelections);
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
		// Get site object.
		const site = LocalMain.getServiceContainer().cradle.siteData.getSite(siteId);
		var error = false;
		for (var option in options) {
			await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
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

		if (!error) {
			LocalMain.sendIPCEvent('instructions');
		}

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
