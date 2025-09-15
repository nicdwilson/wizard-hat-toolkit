export interface ValidationResult {
	isValid: boolean;
	errors: string[];
	warnings: string[];
}

export class BlueprintValidator {
	private readonly requiredFields = ['version', 'name', 'plugins', 'themes', 'settings'];
	private readonly wooCommerceRequiredFields = ['steps'];
	private readonly supportedVersions = ['1.0'];

	/**
	 * Validate blueprint data structure
	 */
	async validate(blueprintData: any): Promise<ValidationResult> {
		const errors: string[] = [];
		const warnings: string[] = [];

		console.log('Validator received data:', typeof blueprintData, blueprintData);
		console.log('Data keys:', blueprintData ? Object.keys(blueprintData) : 'null/undefined');

		// Check if this is a WooCommerce blueprint format
		if (blueprintData.hasOwnProperty('steps') && Array.isArray(blueprintData.steps)) {
			console.log('Detected WooCommerce blueprint format');
			return this.validateWooCommerceBlueprint(blueprintData);
		}

		// Check required fields for standard format
		for (const field of this.requiredFields) {
			if (!blueprintData.hasOwnProperty(field)) {
				errors.push(`Missing required field: ${field}`);
			}
		}

		// Validate version
		if (blueprintData.version && !this.supportedVersions.includes(blueprintData.version)) {
			warnings.push(`Blueprint version ${blueprintData.version} may not be fully supported`);
		}

		// Validate plugins array structure
		if (blueprintData.plugins) {
			if (!Array.isArray(blueprintData.plugins)) {
				errors.push('Plugins must be an array');
			}
		}

		// Validate themes array structure
		if (blueprintData.themes) {
			if (!Array.isArray(blueprintData.themes)) {
				errors.push('Themes must be an array');
			}
		}

		// Validate settings object structure
		if (blueprintData.settings) {
			if (typeof blueprintData.settings !== 'object' || blueprintData.settings === null) {
				errors.push('Settings must be an object');
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings
		};
	}


	/**
	 * Validate WooCommerce blueprint format
	 */
	private validateWooCommerceBlueprint(blueprintData: any): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Check required fields for WooCommerce format
		if (!blueprintData.hasOwnProperty('steps')) {
			errors.push('Missing required field: steps');
		}

		// Validate steps array structure only
		if (blueprintData.steps) {
			if (!Array.isArray(blueprintData.steps)) {
				errors.push('Steps must be an array');
			} else {
				blueprintData.steps.forEach((step: any, index: number) => {
					this.validateWooCommerceStepStructure(step, index, errors, warnings);
				});
			}
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings
		};
	}

	/**
	 * Validate WooCommerce step structure only
	 */
	private validateWooCommerceStepStructure(step: any, index: number, errors: string[], warnings: string[]): void {
		// Only validate that it's an object
		if (typeof step !== 'object' || step === null) {
			errors.push(`Step ${index}: Must be an object`);
			return;
		}

		// Check for required 'step' field
		if (!step.hasOwnProperty('step')) {
			errors.push(`Step ${index}: Missing required field 'step'`);
		}

		// Basic structure validation - don't validate content values
		if (step.step === 'installPlugin' && !step.hasOwnProperty('pluginData')) {
			errors.push(`Step ${index}: installPlugin step missing 'pluginData' field`);
		}

		if (step.step === 'installTheme' && !step.hasOwnProperty('themeData')) {
			errors.push(`Step ${index}: installTheme step missing 'themeData' field`);
		}

		if (step.step === 'setSiteOptions' && !step.hasOwnProperty('options')) {
			errors.push(`Step ${index}: setSiteOptions step missing 'options' field`);
		}

		if (step.step === 'runSql' && !step.hasOwnProperty('sql')) {
			errors.push(`Step ${index}: runSql step missing 'sql' field`);
		}
	}

	/**
	 * Validate blueprint file size and content
	 */
	validateFile(file: File): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Check file size (max 10MB)
		if (file.size > 10 * 1024 * 1024) {
			errors.push('Blueprint file is too large (max 10MB)');
		}

		// Check file type
		if (!file.name.endsWith('.json')) {
			errors.push('Blueprint file must be a JSON file');
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings
		};
	}
}
