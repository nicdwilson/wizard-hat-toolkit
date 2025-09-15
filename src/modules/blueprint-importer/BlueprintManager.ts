import * as LocalMain from '@getflywheel/local/main';
import { BlueprintValidator } from './BlueprintValidator';
import { BlueprintImporter } from './BlueprintImporter';
import { ProgressTracker, ImportProgress } from './ProgressTracker';

export interface BlueprintData {
	version: string;
	name: string;
	description?: string;
	plugins: BlueprintPlugin[];
	themes: BlueprintTheme[];
	settings: BlueprintSettings;
	sqlSteps: BlueprintSQLStep[];
	created: string;
	author?: string;
}

export interface BlueprintPlugin {
	name: string;
	slug: string;
	version?: string;
	active: boolean;
	source: 'wordpress.org' | 'github' | 'premium';
	settings?: Record<string, any>;
}

export interface BlueprintTheme {
	name: string;
	slug: string;
	version?: string;
	active: boolean;
	source: 'wordpress.org' | 'github' | 'premium';
	settings?: Record<string, any>;
}

export interface BlueprintSQLStep {
	name: string;
	sql: string;
	description?: string;
}

export interface BlueprintSettings {
	woocommerce: Record<string, any>;
	wordpress: Record<string, any>;
	custom?: Record<string, any>;
}

export interface ImportOptions {
	overwritePlugins: boolean;
	overwriteThemes: boolean;
	overwriteSettings: boolean;
	skipConflicts: boolean;
}

export class BlueprintManager {
	private context: any;
	private validator: BlueprintValidator;
	private importer: BlueprintImporter;

	constructor(context: any) {
		this.context = context;
		this.validator = new BlueprintValidator();
		this.importer = new BlueprintImporter(context);
	}

	/**
	 * Parse and validate a blueprint file
	 */
	async parseBlueprint(blueprintContent: string): Promise<BlueprintData> {
		try {
			console.log('Parsing blueprint content...');
			const blueprintData = JSON.parse(blueprintContent);
			console.log('Blueprint data parsed:', {
				version: blueprintData.version,
				name: blueprintData.name,
				hasPlugins: !!blueprintData.plugins,
				hasThemes: !!blueprintData.themes,
				hasSettings: !!blueprintData.settings,
				hasSteps: !!blueprintData.steps,
				pluginsCount: blueprintData.plugins?.length || 0,
				themesCount: blueprintData.themes?.length || 0,
				stepsCount: blueprintData.steps?.length || 0
			});
			
			// Validate blueprint structure
			console.log('Starting validation...');
			const validationResult = await this.validator.validate(blueprintData);
			console.log('Validation result:', validationResult);
			
			if (!validationResult.isValid) {
				throw new Error(`Blueprint validation failed: ${validationResult.errors.join(', ')}`);
			}

			console.log('Blueprint validation successful');
			
			// Convert WooCommerce blueprint to our format if needed
			if (blueprintData.steps) {
				console.log('Converting WooCommerce blueprint to standard format...');
				return this.convertWooCommerceBlueprint(blueprintData);
			}

			return blueprintData as BlueprintData;
		} catch (error) {
			console.error('Blueprint parsing error:', error);
			throw new Error(`Failed to parse blueprint: ${error.message}`);
		}
	}

	/**
	 * Analyze blueprint for conflicts with existing site configuration
	 */
	async analyzeConflicts(site: any, blueprintData: BlueprintData): Promise<{
		pluginConflicts: Array<{plugin: BlueprintPlugin, conflict: string}>;
		themeConflicts: Array<{theme: BlueprintTheme, conflict: string}>;
		settingConflicts: Array<{setting: string, current: any, blueprint: any}>;
	}> {
		const conflicts = {
			pluginConflicts: [],
			themeConflicts: [],
			settingConflicts: []
		};

		// Check plugin conflicts
		for (const plugin of blueprintData.plugins) {
			try {
				const isInstalled = await this.checkPluginInstalled(site, plugin.slug);
				if (isInstalled) {
					conflicts.pluginConflicts.push({
						plugin,
						conflict: 'Plugin already installed'
					});
				}
			} catch (error) {
				// Plugin check failed, assume no conflict
			}
		}

		// Check theme conflicts
		for (const theme of blueprintData.themes) {
			try {
				const isInstalled = await this.checkThemeInstalled(site, theme.slug);
				if (isInstalled) {
					conflicts.themeConflicts.push({
						theme,
						conflict: 'Theme already installed'
					});
				}
			} catch (error) {
				// Theme check failed, assume no conflict
			}
		}

		// Check setting conflicts
		for (const [key, value] of Object.entries(blueprintData.settings.woocommerce)) {
			try {
				const currentValue = await this.getWooCommerceSetting(site, key);
				if (currentValue !== null && currentValue !== value) {
					conflicts.settingConflicts.push({
						setting: key,
						current: currentValue,
						blueprint: value
					});
				}
			} catch (error) {
				// Setting check failed, assume no conflict
			}
		}

		return conflicts;
	}

	/**
	 * Import blueprint to site with progress tracking
	 */
	async importBlueprint(site: any, blueprintData: BlueprintData, options: ImportOptions, onProgress?: (progress: ImportProgress) => void): Promise<{
		success: boolean;
		results: {
			pluginsInstalled: number;
			themesInstalled: number;
			settingsApplied: number;
			sqlStepsExecuted: number;
			errors: string[];
		};
	}> {
		const results = {
			pluginsInstalled: 0,
			themesInstalled: 0,
			settingsApplied: 0,
			sqlStepsExecuted: 0,
			errors: []
		};

		// Initialize progress tracker if callback provided
		let progressTracker: ProgressTracker | null = null;
		if (onProgress) {
			progressTracker = new ProgressTracker(onProgress);
			progressTracker.initialize(
				blueprintData.plugins.length,
				blueprintData.themes.length,
				Object.keys(blueprintData.settings.woocommerce).length,
				blueprintData.sqlSteps.length
			);
		}

		try {
			// Install plugins
			for (let i = 0; i < blueprintData.plugins.length; i++) {
				const plugin = blueprintData.plugins[i];
				try {
					await this.importer.installPlugin(site, plugin, options);
					results.pluginsInstalled++;
					progressTracker?.updatePluginProgress(results.pluginsInstalled);
				} catch (error) {
					const errorMsg = `Failed to install plugin ${plugin.name}: ${error.message}`;
					results.errors.push(errorMsg);
					progressTracker?.updatePluginProgress(results.pluginsInstalled, errorMsg);
				}
			}

			// Install themes
			for (let i = 0; i < blueprintData.themes.length; i++) {
				const theme = blueprintData.themes[i];
				try {
					await this.importer.installTheme(site, theme, options);
					results.themesInstalled++;
					progressTracker?.updateThemeProgress(results.themesInstalled);
				} catch (error) {
					const errorMsg = `Failed to install theme ${theme.name}: ${error.message}`;
					results.errors.push(errorMsg);
					progressTracker?.updateThemeProgress(results.themesInstalled, errorMsg);
				}
			}

			// Apply settings
			const settingsEntries = Object.entries(blueprintData.settings.woocommerce);
			for (let i = 0; i < settingsEntries.length; i++) {
				const [key, value] = settingsEntries[i];
				try {
					await this.importer.applySetting(site, key, value, options);
					results.settingsApplied++;
					progressTracker?.updateSettingsProgress(results.settingsApplied);
				} catch (error) {
					const errorMsg = `Failed to apply setting ${key}: ${error.message}`;
					results.errors.push(errorMsg);
					progressTracker?.updateSettingsProgress(results.settingsApplied, errorMsg);
				}
			}

			// Execute SQL steps
			for (let i = 0; i < blueprintData.sqlSteps.length; i++) {
				const sqlStep = blueprintData.sqlSteps[i];
				try {
					await this.importer.runSQL(site, sqlStep.sql, options);
					results.sqlStepsExecuted++;
					progressTracker?.updateSqlProgress(results.sqlStepsExecuted);
				} catch (error) {
					const errorMsg = `Failed to execute SQL step ${sqlStep.name}: ${error.message}`;
					results.errors.push(errorMsg);
					progressTracker?.updateSqlProgress(results.sqlStepsExecuted, errorMsg);
				}
			}

			// Mark as complete
			progressTracker?.complete();

			return {
				success: results.errors.length === 0,
				results
			};
		} catch (error) {
			const errorMsg = `Import failed: ${error.message}`;
			progressTracker?.fail(errorMsg);
			return {
				success: false,
				results: {
					...results,
					errors: [...results.errors, errorMsg]
				}
			};
		}
	}

	/**
	 * Check if plugin is installed
	 */
	private async checkPluginInstalled(site: any, pluginSlug: string): Promise<boolean> {
		try {
			const result = await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
				'plugin',
				'list',
				'--format=json'
			]);
			
			const plugins = JSON.parse(result);
			return plugins.some((plugin: any) => plugin.name === pluginSlug);
		} catch (error) {
			return false;
		}
	}

	/**
	 * Check if theme is installed
	 */
	private async checkThemeInstalled(site: any, themeSlug: string): Promise<boolean> {
		try {
			const result = await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
				'theme',
				'list',
				'--format=json'
			]);
			
			const themes = JSON.parse(result);
			return themes.some((theme: any) => theme.name === themeSlug);
		} catch (error) {
			return false;
		}
	}

	/**
	 * Get WooCommerce setting value
	 */
	private async getWooCommerceSetting(site: any, settingKey: string): Promise<any> {
		try {
			const result = await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
				'option',
				'get',
				settingKey
			]);
			return result.trim();
		} catch (error) {
			return null;
		}
	}

	/**
	 * Convert WooCommerce blueprint format to standard format
	 */
	private convertWooCommerceBlueprint(wooBlueprint: any): BlueprintData {
		const plugins: BlueprintPlugin[] = [];
		const themes: BlueprintTheme[] = [];
		const sqlSteps: BlueprintSQLStep[] = [];
		const settings: BlueprintSettings = {
			woocommerce: {},
			wordpress: {},
			custom: {}
		};

		// Process each step
		for (const step of wooBlueprint.steps) {
			switch (step.step) {
				case 'installPlugin':
					if (step.pluginData) {
						plugins.push({
							name: step.pluginData.slug, // Use slug as name for now
							slug: step.pluginData.slug,
							version: undefined, // Don't set 'latest' for WordPress.org plugins
							active: step.options?.activate || true,
							source: this.mapResourceToSource(step.pluginData.resource)
						});
					}
					break;

				case 'installTheme':
					if (step.themeData) {
						themes.push({
							name: step.themeData.slug, // Use slug as name for now
							slug: step.themeData.slug,
							version: undefined, // Don't set 'latest' for WordPress.org themes
							active: step.options?.activate || true,
							source: this.mapResourceToSource(step.themeData.resource)
						});
					}
					break;

				case 'setSiteOptions':
					if (step.options) {
						// Merge all options into WooCommerce settings for now
						Object.assign(settings.woocommerce, step.options);
					}
					break;

				case 'runSql':
					if (step.sql && step.sql.contents) {
						sqlSteps.push({
							name: step.sql.name || 'unnamed-sql',
							sql: step.sql.contents,
							description: `SQL step: ${step.sql.name || 'unnamed'}`
						});
					}
					break;
			}
		}

		return {
			version: '1.0',
			name: 'WooCommerce Blueprint',
			plugins,
			themes,
			settings,
			sqlSteps,
			created: new Date().toISOString(),
			author: 'Wizard Hat Toolkit'
		};
	}

	/**
	 * Map WooCommerce resource to our source format
	 */
	private mapResourceToSource(resource: string): 'wordpress.org' | 'github' | 'premium' {
		switch (resource) {
			case 'wordpress.org/plugins':
			case 'wordpress.org/themes':
				return 'wordpress.org';
			case 'self/plugins':
			case 'self/themes':
				return 'premium'; // Assume self-hosted are premium
			default:
				return 'premium';
		}
	}
}
