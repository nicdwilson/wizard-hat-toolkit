import * as LocalMain from '@getflywheel/local/main';
import { BlueprintData, BlueprintPlugin, BlueprintTheme, ImportOptions } from './BlueprintManager';
import { PluginManager } from '../plugin-manager';
import { Logger } from '../../utils/Logger';

export class BlueprintImporter {
	private context: any;
	private pluginManager: PluginManager;
	private logger: Logger;

	constructor(context: any) {
		this.context = context;
		this.pluginManager = PluginManager.getInstance();
		this.logger = Logger.getInstance(context.environment.userDataPath);
	}

	/**
	 * Install a plugin from blueprint
	 */
	async installPlugin(site: any, plugin: BlueprintPlugin, options: ImportOptions): Promise<void> {
		try {
			// Initialize PluginManager if not already done
			if (!this.pluginManager.isInitialized) {
				await this.pluginManager.initialize(this.context, process.env.GITHUB_TOKEN);
			}

			// Check if plugin is already installed
			const isInstalled = await this.pluginManager.isPluginInstalled(site, plugin.slug);
			
			if (isInstalled && !options.overwritePlugins) {
				if (options.skipConflicts) {
					return; // Skip installation
				} else {
					throw new Error(`Plugin ${plugin.name} is already installed`);
				}
			}

			// Convert BlueprintPlugin to PluginData format
			const pluginData = {
				name: plugin.name,
				slug: plugin.slug,
				version: plugin.version || undefined, // Don't set 'latest' for WordPress.org plugins
				active: plugin.active,
				source: plugin.source as any
			};

			// Use PluginManager to install the plugin
			const results = await this.pluginManager.installPluginsDetailed(site, [pluginData], {
				activate: plugin.active,
				force: options.overwritePlugins || false,
				trackInstallation: true,
				cleanupFiles: true
			});

			if (results.errors.length > 0) {
				throw new Error(results.errors.join(', '));
			}

			// Apply plugin settings if provided
			if (plugin.settings) {
				await this.pluginManager.applyPluginSettings(site, plugin.slug, plugin.settings);
			}

		} catch (error) {
			throw new Error(`Failed to install plugin ${plugin.name}: ${error.message}`);
		}
	}

	/**
	 * Install a theme from blueprint
	 */
	async installTheme(site: any, theme: BlueprintTheme, options: ImportOptions): Promise<void> {
		try {
			// Initialize PluginManager if not already done
			if (!this.pluginManager.isInitialized) {
				await this.pluginManager.initialize(this.context, process.env.GITHUB_TOKEN);
			}

			// Check if theme is already installed
			const isInstalled = await this.pluginManager.isThemeInstalled(site, theme.slug);
			
			if (isInstalled && !options.overwriteThemes) {
				if (options.skipConflicts) {
					return; // Skip installation
				} else {
					throw new Error(`Theme ${theme.name} is already installed`);
				}
			}

			// Convert BlueprintTheme to ThemeData format
			const themeData = {
				name: theme.name,
				slug: theme.slug,
				version: theme.version || undefined, // Don't set 'latest' for WordPress.org themes
				active: theme.active,
				source: theme.source as any
			};

			// Use PluginManager to install the theme
			const results = await this.pluginManager.installThemesDetailed(site, [themeData], {
				activate: theme.active,
				force: options.overwriteThemes || false,
				cleanupFiles: true
			});

			if (results.errors.length > 0) {
				throw new Error(results.errors.join(', '));
			}

			// Apply theme settings if provided
			if (theme.settings) {
				await this.pluginManager.applyThemeSettings(site, theme.slug, theme.settings);
			}

		} catch (error) {
			throw new Error(`Failed to install theme ${theme.name}: ${error.message}`);
		}
	}

	/**
	 * Execute SQL commands on the site
	 */
	async runSQL(site: any, sql: string, options: ImportOptions): Promise<void> {
		this.logger.info('BlueprintImporter', 'Executing SQL command', { 
			sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
			sqlLength: sql.length,
			options 
		});

		// Debug: Log site object to understand MySQL connection details
		this.logger.debug('BlueprintImporter', 'Site object for SQL execution', {
			siteId: site?.id,
			siteName: site?.name,
			sitePath: site?.path,
			siteKeys: Object.keys(site || {}),
			// Check for MySQL-related properties
			mysqlHost: site?.mysqlHost,
			mysqlPort: site?.mysqlPort,
			mysqlSocket: site?.mysqlSocket,
			mysqlUser: site?.mysqlUser,
			mysqlPassword: site?.mysqlPassword ? '[REDACTED]' : undefined,
			mysqlDatabase: site?.mysqlDatabase
		});

		try {
			// Construct the MySQL socket path for LocalWP
			const mysqlSocketPath = `/Users/nicw/Library/Application Support/Local/run/${site.id}/mysql/mysqld.sock`;
			const dbHost = `localhost:${mysqlSocketPath}`;
			
			this.logger.debug('BlueprintImporter', 'Using MySQL connection', {
				siteId: site.id,
				mysqlSocketPath,
				dbHost
			});

			// Try multiple approaches for LocalWP MySQL connection
			// Approach 1: Use --host parameter
			try {
				await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
					'db',
					'query',
					`--host=${dbHost}`,
					sql
				]);
				this.logger.info('BlueprintImporter', 'Successfully executed SQL command with --host parameter');
				return;
			} catch (hostError) {
				this.logger.warn('BlueprintImporter', '--host parameter failed, trying alternative approach', { error: hostError.message });
			}

			// Approach 2: Use environment variables (if LocalWP supports it)
			try {
				const env = {
					...process.env,
					MYSQL_UNIX_PORT: mysqlSocketPath,
					MYSQL_HOST: 'localhost'
				};
				
				await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
					'db',
					'query',
					sql
				], { env });
				this.logger.info('BlueprintImporter', 'Successfully executed SQL command with environment variables');
				return;
			} catch (envError) {
				this.logger.warn('BlueprintImporter', 'Environment variables approach failed', { error: envError.message });
			}

			// Approach 3: Use direct MySQL command as fallback
			this.logger.warn('BlueprintImporter', 'WP-CLI db query failed, this is a known issue with LocalWP', {
				issue: 'https://github.com/wp-cli/db-command/issues/185',
				suggestion: 'SQL steps may need to be executed manually or through alternative methods'
			});
			
			throw new Error('WP-CLI db query command is not compatible with LocalWP MySQL socket configuration');
			
		} catch (error) {
			this.logger.error('BlueprintImporter', 'Failed to execute SQL command', { 
				error: error.message, 
				sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : '')
			});
			
			// Check if this is a MySQL connection issue
			if (error.message.includes('Can\'t connect to local MySQL server')) {
				this.logger.warn('BlueprintImporter', 'MySQL connection issue detected. This may be a LocalWP environment problem.', {
					suggestion: 'Ensure LocalWP MySQL server is running and accessible'
				});
			}
			
			throw new Error(`Failed to execute SQL: ${error.message}`);
		}
	}

	/**
	 * Apply a setting to the site using WP-CLI's JSON format support
	 */
	async applySetting(site: any, key: string, value: any, options: ImportOptions): Promise<void> {
		this.logger.info('BlueprintImporter', `Applying setting: ${key}`, { 
			value, 
			valueType: typeof value,
			isArray: Array.isArray(value),
			options 
		});

		try {
			// Check if setting already exists
			const currentValue = await this.getSetting(site, key);
			this.logger.debug('BlueprintImporter', `Current value for ${key}`, { currentValue });
			
			if (currentValue !== null && currentValue !== value && !options.overwriteSettings) {
				if (options.skipConflicts) {
					this.logger.info('BlueprintImporter', `Skipping setting ${key} due to conflict`, { currentValue, newValue: value });
					return; // Skip setting
				} else {
					throw new Error(`Setting ${key} already exists with different value`);
				}
			}

			// Use WP-CLI's JSON format support for proper serialization
			await this.setOptionWithJson(site, key, value);
			this.logger.info('BlueprintImporter', `Successfully applied setting: ${key}`);

		} catch (error) {
			this.logger.error('BlueprintImporter', `Failed to apply setting ${key}`, { error: error.message, value });
			throw new Error(`Failed to apply setting ${key}: ${error.message}`);
		}
	}


	/**
	 * Get current setting value
	 */
	private async getSetting(site: any, key: string): Promise<any> {
		try {
			const result = await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
				'option',
				'get',
				key
			]);
			return result.trim();
		} catch (error) {
			return null;
		}
	}

	/**
	 * Set a WordPress option using WP-CLI's JSON format support
	 * This leverages WP-CLI's built-in serialization instead of manual string conversion
	 */
	private async setOptionWithJson(site: any, key: string, value: any): Promise<void> {
		this.logger.debug('BlueprintImporter', `Setting option with JSON format: ${key}`, { value, valueType: typeof value });

		try {
			// For simple values, use the standard approach
			if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
				this.logger.debug('BlueprintImporter', `Using standard approach for simple value: ${key}`, { value });
				await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
					'option',
					'set',
					key,
					String(value)
				]);
				this.logger.info('BlueprintImporter', `Successfully set simple option: ${key} = ${String(value)}`);
				return;
			}

			// For complex values (objects, arrays), use WP-CLI's JSON format
			const jsonValue = JSON.stringify(value);
			this.logger.debug('BlueprintImporter', `Using JSON format for complex value: ${key}`, { jsonValue });
			
			// Use WP-CLI's --format=json flag with the JSON value as the last argument
			await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
				'option',
				'set',
				key,
				'--format=json',
				jsonValue
			]);
			this.logger.info('BlueprintImporter', `Successfully set complex option with JSON format: ${key}`);

		} catch (error) {
			// Fallback to standard approach if JSON format fails
			this.logger.warn('BlueprintImporter', `JSON format failed for ${key}, falling back to string conversion`, { error: error.message });
			await LocalMain.getServiceContainer().cradle.wpCli.run(site, [
				'option',
				'set',
				key,
				JSON.stringify(value)
			]);
			this.logger.info('BlueprintImporter', `Successfully set option with fallback method: ${key}`);
		}
	}
}
