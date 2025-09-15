export interface ImportProgress {
	// Overall progress
	overallProgress: number; // 0-100
	currentStep: string;
	
	// Detailed counts
	pluginsInstalled: number;
	pluginsTotal: number;
	themesInstalled: number;
	themesTotal: number;
	settingsApplied: number;
	settingsTotal: number;
	sqlStepsExecuted: number;
	sqlStepsTotal: number;
	
	// Error tracking
	errors: string[];
	warnings: string[];
	
	// Status
	isComplete: boolean;
	isError: boolean;
}

export interface ProgressStep {
	name: string;
	total: number;
	completed: number;
	errors: string[];
}

export class ProgressTracker {
	private progress: ImportProgress;
	private steps: Map<string, ProgressStep>;
	private onProgressUpdate: (progress: ImportProgress) => void;

	constructor(onProgressUpdate: (progress: ImportProgress) => void) {
		this.onProgressUpdate = onProgressUpdate;
		this.steps = new Map();
		this.progress = {
			overallProgress: 0,
			currentStep: 'Initializing...',
			pluginsInstalled: 0,
			pluginsTotal: 0,
			themesInstalled: 0,
			themesTotal: 0,
			settingsApplied: 0,
			settingsTotal: 0,
			sqlStepsExecuted: 0,
			sqlStepsTotal: 0,
			errors: [],
			warnings: [],
			isComplete: false,
			isError: false
		};
	}

	/**
	 * Initialize progress tracking with total counts
	 */
	initialize(pluginsTotal: number, themesTotal: number, settingsTotal: number, sqlStepsTotal: number): void {
		this.progress.pluginsTotal = pluginsTotal;
		this.progress.themesTotal = themesTotal;
		this.progress.settingsTotal = settingsTotal;
		this.progress.sqlStepsTotal = sqlStepsTotal;
		
		// Initialize steps
		this.steps.set('plugins', { name: 'Installing Plugins', total: pluginsTotal, completed: 0, errors: [] });
		this.steps.set('themes', { name: 'Installing Themes', total: themesTotal, completed: 0, errors: [] });
		this.steps.set('settings', { name: 'Applying Settings', total: settingsTotal, completed: 0, errors: [] });
		this.steps.set('sql', { name: 'Executing SQL Commands', total: sqlStepsTotal, completed: 0, errors: [] });
		
		this.updateOverallProgress();
		this.emitProgress();
	}

	/**
	 * Update plugin installation progress
	 */
	updatePluginProgress(installed: number, error?: string): void {
		this.progress.pluginsInstalled = installed;
		this.progress.currentStep = `Installing plugins (${installed}/${this.progress.pluginsTotal})`;
		
		const step = this.steps.get('plugins');
		if (step) {
			step.completed = installed;
			if (error) {
				step.errors.push(error);
				this.progress.errors.push(error);
			}
		}
		
		this.updateOverallProgress();
		this.emitProgress();
	}

	/**
	 * Update theme installation progress
	 */
	updateThemeProgress(installed: number, error?: string): void {
		this.progress.themesInstalled = installed;
		this.progress.currentStep = `Installing themes (${installed}/${this.progress.themesTotal})`;
		
		const step = this.steps.get('themes');
		if (step) {
			step.completed = installed;
			if (error) {
				step.errors.push(error);
				this.progress.errors.push(error);
			}
		}
		
		this.updateOverallProgress();
		this.emitProgress();
	}

	/**
	 * Update settings application progress
	 */
	updateSettingsProgress(applied: number, error?: string): void {
		this.progress.settingsApplied = applied;
		this.progress.currentStep = `Applying settings (${applied}/${this.progress.settingsTotal})`;
		
		const step = this.steps.get('settings');
		if (step) {
			step.completed = applied;
			if (error) {
				step.errors.push(error);
				this.progress.errors.push(error);
			}
		}
		
		this.updateOverallProgress();
		this.emitProgress();
	}

	/**
	 * Update SQL execution progress
	 */
	updateSqlProgress(executed: number, error?: string): void {
		this.progress.sqlStepsExecuted = executed;
		this.progress.currentStep = `Executing SQL commands (${executed}/${this.progress.sqlStepsTotal})`;
		
		const step = this.steps.get('sql');
		if (step) {
			step.completed = executed;
			if (error) {
				step.errors.push(error);
				this.progress.errors.push(error);
			}
		}
		
		this.updateOverallProgress();
		this.emitProgress();
	}

	/**
	 * Add a warning
	 */
	addWarning(warning: string): void {
		this.progress.warnings.push(warning);
		this.emitProgress();
	}

	/**
	 * Mark import as complete
	 */
	complete(): void {
		this.progress.isComplete = true;
		this.progress.currentStep = 'Import completed successfully';
		this.progress.overallProgress = 100;
		this.emitProgress();
	}

	/**
	 * Mark import as failed
	 */
	fail(error: string): void {
		this.progress.isError = true;
		this.progress.isComplete = true;
		this.progress.currentStep = 'Import failed';
		this.progress.errors.push(error);
		this.emitProgress();
	}

	/**
	 * Get current progress
	 */
	getProgress(): ImportProgress {
		return { ...this.progress };
	}

	/**
	 * Get progress steps
	 */
	getSteps(): Map<string, ProgressStep> {
		return new Map(this.steps);
	}

	/**
	 * Update overall progress percentage
	 */
	private updateOverallProgress(): void {
		const totalItems = this.progress.pluginsTotal + this.progress.themesTotal + this.progress.settingsTotal + this.progress.sqlStepsTotal;
		const completedItems = this.progress.pluginsInstalled + this.progress.themesInstalled + this.progress.settingsApplied + this.progress.sqlStepsExecuted;
		
		if (totalItems > 0) {
			this.progress.overallProgress = Math.round((completedItems / totalItems) * 100);
		}
	}

	/**
	 * Emit progress update
	 */
	private emitProgress(): void {
		this.onProgressUpdate({ ...this.progress });
	}
}
