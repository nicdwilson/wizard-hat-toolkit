import React, { Component } from 'react';
import { ipcRenderer } from 'electron';
import {
	Button,
	Card,
	Text,
	Title,
	Spinner,
	InputPasswordToggle,
	Divider,
	TableList,
	TableListRow,
	TextButton,
	FlyModal,
	Checkbox
} from '@getflywheel/local-components';
import { BlueprintData, ImportOptions } from './BlueprintManager';
import { BlueprintSettingsManager } from './BlueprintSettings';
import { ImportProgress } from './ProgressTracker';

interface BlueprintUIState {
	selectedFile: File | null;
	blueprintData: BlueprintData | null;
	conflicts: any;
	importOptions: ImportOptions;
	importing: boolean;
	importProgress: ImportProgress;
	showPreview: boolean;
	showSettings: boolean;
	settings: any;
	validationErrors: string[];
	validationWarnings: string[];
}

export default class BlueprintUI extends Component<any, BlueprintUIState> {
	constructor(props: any) {
		super(props);
		
		this.state = {
			selectedFile: null,
			blueprintData: null,
			conflicts: null,
			importOptions: BlueprintSettingsManager.getImportOptions(),
			importing: false,
			importProgress: {
				overallProgress: 0,
				currentStep: 'Ready to import',
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
			},
			showPreview: false,
			showSettings: false,
			settings: BlueprintSettingsManager.getSettings(),
			validationErrors: [],
			validationWarnings: []
		};

		this.handleFileSelect = this.handleFileSelect.bind(this);
		this.handleImport = this.handleImport.bind(this);
		this.handlePreview = this.handlePreview.bind(this);
		this.handleSettingsChange = this.handleSettingsChange.bind(this);
		this.closePreview = this.closePreview.bind(this);
		this.closeSettings = this.closeSettings.bind(this);
	}

	componentDidMount() {
		// Listen for blueprint validation
		ipcRenderer.on('blueprint-validated', (event, data) => {
			console.log('Blueprint validated successfully:', data);
			this.setState({
				blueprintData: data.blueprintData,
				validationErrors: data.errors,
				validationWarnings: data.warnings
			});
		});

		ipcRenderer.on('blueprint-validation-error', (event, data) => {
			console.log('Blueprint validation error:', data);
			this.setState({
				blueprintData: null,
				validationErrors: data.errors,
				validationWarnings: data.warnings
			});
		});

		// Listen for import progress updates
		ipcRenderer.on('blueprint-import-progress', (event, progress) => {
			this.setState({
				importProgress: progress
			});
		});

		// Listen for import completion
		ipcRenderer.on('blueprint-import-complete', (event, result) => {
			this.setState({
				importing: false,
				importProgress: {
					...this.state.importProgress,
					isComplete: true,
					currentStep: result.success ? 'Import completed successfully' : 'Import completed with errors'
				}
			});
		});

		// Listen for import errors
		ipcRenderer.on('blueprint-import-error', (event, error) => {
			this.setState({
				importing: false,
				importProgress: {
					...this.state.importProgress,
					isError: true,
					isComplete: true,
					currentStep: 'Import failed',
					errors: [...this.state.importProgress.errors, error.message]
				}
			});
		});
	}

	componentWillUnmount() {
		ipcRenderer.removeAllListeners('blueprint-validated');
		ipcRenderer.removeAllListeners('blueprint-validation-error');
		ipcRenderer.removeAllListeners('blueprint-import-progress');
		ipcRenderer.removeAllListeners('blueprint-import-complete');
		ipcRenderer.removeAllListeners('blueprint-import-error');
	}

	handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		if (file) {
			console.log('File selected:', file.name, file.type, file.size);
			this.setState({ selectedFile: file });
			this.validateAndParseFile(file);
		}
	}

	async validateAndParseFile(file: File) {
		try {
			console.log('Starting file validation...');
			// Read file content
			const fileContent = await this.readFileContent(file);
			console.log('File content read, length:', fileContent.length);
			
			// Send file content to main process for validation and parsing
			ipcRenderer.send('validate-blueprint-content', fileContent);
			console.log('Validation request sent to main process');
		} catch (error) {
			console.error('File validation error:', error);
			this.setState({
				validationErrors: [`Failed to process file: ${error.message}`]
			});
		}
	}

	readFileContent(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				resolve(e.target?.result as string);
			};
			reader.onerror = (e) => {
				reject(new Error('Failed to read file'));
			};
			reader.readAsText(file);
		});
	}

	handlePreview() {
		if (this.state.blueprintData) {
			this.setState({ showPreview: true });
		}
	}

	handleImport() {
		console.log('Import button clicked');
		console.log('Blueprint data:', this.state.blueprintData);
		console.log('Props:', this.props);
		console.log('Site ID:', this.props.match?.params?.siteID);
		
		if (this.state.blueprintData) {
			console.log('Starting import process...');
			this.setState({ importing: true });
			ipcRenderer.send('import-blueprint', this.props.match.params.siteID, this.state.blueprintData, this.state.importOptions);
		} else {
			console.log('No blueprint data available for import');
		}
	}

	handleSettingsChange(setting: string, value: boolean) {
		const newSettings = { ...this.state.settings, [setting]: value };
		this.setState({ settings: newSettings });
		BlueprintSettingsManager.updateSettings(newSettings);
	}

	closePreview() {
		this.setState({ showPreview: false });
	}

	closeSettings() {
		this.setState({ showSettings: false });
	}

	renderFileUpload() {
		return (
			<Card>
				<Title>Import WooCommerce Blueprint</Title>
				<Text>
					Upload a WooCommerce Blueprint file to quickly configure your site with predefined plugins, themes, and settings.
				</Text>
				
				<div style={{ margin: '20px 0' }}>
					<div style={{ position: 'relative', display: 'inline-block' }}>
						<input
							type="file"
							accept=".json"
							onChange={this.handleFileSelect}
							style={{
								position: 'absolute',
								left: '-9999px',
								opacity: 0,
								pointerEvents: 'none'
							}}
							id="blueprint-file-input"
						/>
						<label
							htmlFor="blueprint-file-input"
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								padding: '12px 24px',
								backgroundColor: 'var(--woo-blueberry)',
								color: 'white',
								borderRadius: '4px',
								cursor: 'pointer',
								fontFamily: 'var(--woo-font-family)',
								fontSize: '14px',
								fontWeight: '500',
								border: 'none',
								transition: 'background-color 0.2s ease',
								textDecoration: 'none',
								marginBottom: '10px'
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.backgroundColor = 'var(--woo-blueberry-70)';
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.backgroundColor = 'var(--woo-blueberry)';
							}}
						>
							<svg 
								width="16" 
								height="16" 
								viewBox="0 0 24 24" 
								fill="none" 
								stroke="currentColor" 
								strokeWidth="2" 
								strokeLinecap="round" 
								strokeLinejoin="round"
								style={{ marginRight: '8px' }}
							>
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
								<polyline points="14,2 14,8 20,8"></polyline>
								<line x1="16" y1="13" x2="8" y2="13"></line>
								<line x1="16" y1="17" x2="8" y2="17"></line>
								<polyline points="10,9 9,9 8,9"></polyline>
							</svg>
							Choose Blueprint File
						</label>
					</div>
					{this.state.selectedFile && (
						<div style={{ 
							marginTop: '8px', 
							padding: '8px 12px', 
							backgroundColor: '#f0f8ff', 
							borderRadius: '4px',
							border: '1px solid #e0e8f0'
						}}>
							<Text style={{ fontSize: '12px', color: '#666' }}>
								Selected: {this.state.selectedFile.name}
							</Text>
						</div>
					)}
				</div>

				{this.state.validationErrors.length > 0 && (
					<div style={{ color: 'red', marginBottom: '10px' }}>
						<Text privateOptions={{ fontWeight: 'bold' }}>
							Validation Errors:
						</Text>
						<ul>
							{this.state.validationErrors.map((error, index) => (
								<li key={index}>{error}</li>
							))}
						</ul>
					</div>
				)}

				{this.state.validationWarnings.length > 0 && (
					<div style={{ color: 'orange', marginBottom: '10px' }}>
						<Text privateOptions={{ fontWeight: 'bold' }}>
							Warnings:
						</Text>
						<ul>
							{this.state.validationWarnings.map((warning, index) => (
								<li key={index}>{warning}</li>
							))}
						</ul>
					</div>
				)}

				{this.state.selectedFile && this.state.blueprintData && (
					<div style={{ marginTop: '20px' }}>
						<Button onClick={this.handlePreview} className="woo button">
							Preview Import
						</Button>
						<Button onClick={this.handleImport} className="woo button" disabled={this.state.importing}>
							{this.state.importing ? 'Importing...' : 'Import Blueprint'}
						</Button>
					</div>
				)}
			</Card>
		);
	}

	renderPreview() {
		if (!this.state.blueprintData) return null;

		const { blueprintData } = this.state;

		return (
			<FlyModal isOpen={this.state.showPreview} onRequestClose={this.closePreview}>
				<Title>Blueprint Import Preview</Title>
				
				<div style={{ padding: '20px', maxHeight: '500px', overflowY: 'auto' }}>
					<Text privateOptions={{ fontWeight: 'bold' }}>
						{blueprintData.name}
					</Text>
					{blueprintData.description && (
						<Text>
							{blueprintData.description}
						</Text>
					)}

					<Divider />

					<Text privateOptions={{ fontWeight: 'bold' }}>
						Plugins ({blueprintData.plugins.length})
					</Text>
					<ul>
						{blueprintData.plugins.map((plugin, index) => (
							<li key={index}>
								{plugin.name} ({plugin.source}) {plugin.active ? '- Active' : ''}
							</li>
						))}
					</ul>

					<Text privateOptions={{ fontWeight: 'bold' }}>
						Themes ({blueprintData.themes.length})
					</Text>
					<ul>
						{blueprintData.themes.map((theme, index) => (
							<li key={index}>
								{theme.name} ({theme.source}) {theme.active ? '- Active' : ''}
							</li>
						))}
					</ul>

					<Text privateOptions={{ fontWeight: 'bold' }}>
						Settings ({Object.keys(blueprintData.settings.woocommerce).length} WooCommerce settings)
					</Text>

					<div style={{ marginTop: '20px' }}>
						<Button onClick={this.handleImport} className="woo button">
							Confirm Import
						</Button>
						<Button onClick={this.closePreview} className="woo button">
							Cancel
						</Button>
					</div>
				</div>
			</FlyModal>
		);
	}

	renderImportProgress() {
		if (!this.state.importing && !this.state.importProgress.isComplete) return null;

		const { importProgress } = this.state;

		return (
			<Card>
				<Title>Import Progress</Title>
				
				{/* Overall Progress Bar */}
				<div style={{ marginBottom: '20px' }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
						<Text privateOptions={{ fontWeight: 'bold' }}>
							{importProgress.currentStep}
						</Text>
						<Text>
							{importProgress.overallProgress}%
						</Text>
					</div>
					<div style={{ 
						width: '100%', 
						height: '8px', 
						backgroundColor: '#e0e0e0', 
						borderRadius: '4px',
						overflow: 'hidden'
					}}>
						<div style={{
							width: `${importProgress.overallProgress}%`,
							height: '100%',
							backgroundColor: importProgress.isError ? '#ff4444' : '#4CAF50',
							transition: 'width 0.3s ease'
						}} />
					</div>
				</div>

				{/* Detailed Progress */}
				<div style={{ marginBottom: '20px' }}>
					<div style={{ marginBottom: '12px' }}>
						<Text privateOptions={{ fontWeight: 'bold' }}>
							Detailed Progress:
						</Text>
					</div>
					
					{/* Plugins Progress */}
					<div style={{ marginBottom: '12px' }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
							<Text>Plugins</Text>
							<Text>{importProgress.pluginsInstalled}/{importProgress.pluginsTotal}</Text>
						</div>
						<div style={{ 
							width: '100%', 
							height: '4px', 
							backgroundColor: '#f0f0f0', 
							borderRadius: '2px',
							overflow: 'hidden'
						}}>
							<div style={{
								width: `${importProgress.pluginsTotal > 0 ? (importProgress.pluginsInstalled / importProgress.pluginsTotal) * 100 : 0}%`,
								height: '100%',
								backgroundColor: '#2196F3',
								transition: 'width 0.3s ease'
							}} />
						</div>
					</div>

					{/* Themes Progress */}
					<div style={{ marginBottom: '12px' }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
							<Text>Themes</Text>
							<Text>{importProgress.themesInstalled}/{importProgress.themesTotal}</Text>
						</div>
						<div style={{ 
							width: '100%', 
							height: '4px', 
							backgroundColor: '#f0f0f0', 
							borderRadius: '2px',
							overflow: 'hidden'
						}}>
							<div style={{
								width: `${importProgress.themesTotal > 0 ? (importProgress.themesInstalled / importProgress.themesTotal) * 100 : 0}%`,
								height: '100%',
								backgroundColor: '#FF9800',
								transition: 'width 0.3s ease'
							}} />
						</div>
					</div>

					{/* Settings Progress */}
					<div style={{ marginBottom: '12px' }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
							<Text>Settings</Text>
							<Text>{importProgress.settingsApplied}/{importProgress.settingsTotal}</Text>
						</div>
						<div style={{ 
							width: '100%', 
							height: '4px', 
							backgroundColor: '#f0f0f0', 
							borderRadius: '2px',
							overflow: 'hidden'
						}}>
							<div style={{
								width: `${importProgress.settingsTotal > 0 ? (importProgress.settingsApplied / importProgress.settingsTotal) * 100 : 0}%`,
								height: '100%',
								backgroundColor: '#9C27B0',
								transition: 'width 0.3s ease'
							}} />
						</div>
					</div>

					{/* SQL Steps Progress */}
					<div style={{ marginBottom: '12px' }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
							<Text>SQL Commands</Text>
							<Text>{importProgress.sqlStepsExecuted}/{importProgress.sqlStepsTotal}</Text>
						</div>
						<div style={{ 
							width: '100%', 
							height: '4px', 
							backgroundColor: '#f0f0f0', 
							borderRadius: '2px',
							overflow: 'hidden'
						}}>
							<div style={{
								width: `${importProgress.sqlStepsTotal > 0 ? (importProgress.sqlStepsExecuted / importProgress.sqlStepsTotal) * 100 : 0}%`,
								height: '100%',
								backgroundColor: '#607D8B',
								transition: 'width 0.3s ease'
							}} />
						</div>
					</div>
				</div>

				{/* Errors */}
				{importProgress.errors.length > 0 && (
					<div style={{ marginBottom: '20px' }}>
						<div style={{ marginBottom: '8px' }}>
							<Text privateOptions={{ fontWeight: 'bold' }} style={{ color: '#ff4444' }}>
								Errors ({importProgress.errors.length}):
							</Text>
						</div>
						<div style={{ 
							maxHeight: '150px', 
							overflowY: 'auto', 
							backgroundColor: '#ffeaea', 
							padding: '12px', 
							borderRadius: '4px',
							border: '1px solid #ffcccc'
						}}>
							{importProgress.errors.map((error, index) => (
								<div key={index} style={{ marginBottom: '4px', fontSize: '12px' }}>
									• {error}
								</div>
							))}
						</div>
					</div>
				)}

				{/* Warnings */}
				{importProgress.warnings.length > 0 && (
					<div style={{ marginBottom: '20px' }}>
						<div style={{ marginBottom: '8px' }}>
							<Text privateOptions={{ fontWeight: 'bold' }} style={{ color: '#ff9800' }}>
								Warnings ({importProgress.warnings.length}):
							</Text>
						</div>
						<div style={{ 
							maxHeight: '150px', 
							overflowY: 'auto', 
							backgroundColor: '#fff8e1', 
							padding: '12px', 
							borderRadius: '4px',
							border: '1px solid #ffcc80'
						}}>
							{importProgress.warnings.map((warning, index) => (
								<div key={index} style={{ marginBottom: '4px', fontSize: '12px' }}>
									• {warning}
								</div>
							))}
						</div>
					</div>
				)}

				{/* Completion Actions */}
				{importProgress.isComplete && (
					<div style={{ marginTop: '20px' }}>
						<Button 
							onClick={() => this.setState({ 
								importing: false,
								importProgress: {
									overallProgress: 0,
									currentStep: 'Ready to import',
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
								}
							})} 
							className="woo button"
						>
							{importProgress.isError ? 'Try Again' : 'Import Another Blueprint'}
						</Button>
					</div>
				)}
			</Card>
		);
	}

	renderSettings() {
		return (
			<FlyModal isOpen={this.state.showSettings} onRequestClose={this.closeSettings}>
				<Title>Blueprint Import Settings</Title>
				
				<div style={{ padding: '20px' }}>
					<div style={{ marginBottom: '20px' }}>
						<div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
							<Checkbox
								checked={this.state.settings.autoOverwritePlugins}
								onChange={(checked) => this.handleSettingsChange('autoOverwritePlugins', checked)}
							/>
							<Text style={{ marginLeft: '8px', marginBottom: '0' }}>
								Auto-overwrite plugins
							</Text>
						</div>
						<Text style={{ fontSize: '12px', color: '#666', marginLeft: '24px' }}>
							Automatically overwrite existing plugins during import
						</Text>
					</div>
					
					<div style={{ marginBottom: '20px' }}>
						<div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
							<Checkbox
								checked={this.state.settings.autoOverwriteThemes}
								onChange={(checked) => this.handleSettingsChange('autoOverwriteThemes', checked)}
							/>
							<Text style={{ marginLeft: '8px', marginBottom: '0' }}>
								Auto-overwrite themes
							</Text>
						</div>
						<Text style={{ fontSize: '12px', color: '#666', marginLeft: '24px' }}>
							Automatically overwrite existing themes during import
						</Text>
					</div>
					
					<div style={{ marginBottom: '20px' }}>
						<div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
							<Checkbox
								checked={this.state.settings.autoOverwriteSettings}
								onChange={(checked) => this.handleSettingsChange('autoOverwriteSettings', checked)}
							/>
							<Text style={{ marginLeft: '8px', marginBottom: '0' }}>
								Auto-overwrite settings
							</Text>
						</div>
						<Text style={{ fontSize: '12px', color: '#666', marginLeft: '24px' }}>
							Automatically overwrite existing settings during import
						</Text>
					</div>
					
					<div style={{ marginBottom: '20px' }}>
						<div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
							<Checkbox
								checked={this.state.settings.skipConflicts}
								onChange={(checked) => this.handleSettingsChange('skipConflicts', checked)}
							/>
							<Text style={{ marginLeft: '8px', marginBottom: '0' }}>
								Skip conflicts
							</Text>
						</div>
						<Text style={{ fontSize: '12px', color: '#666', marginLeft: '24px' }}>
							Skip items that conflict with existing installations
						</Text>
					</div>
					
					<div style={{ marginBottom: '20px' }}>
						<div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
							<Checkbox
								checked={this.state.settings.backupBeforeImport}
								onChange={(checked) => this.handleSettingsChange('backupBeforeImport', checked)}
							/>
							<Text style={{ marginLeft: '8px', marginBottom: '0' }}>
								Backup before import
							</Text>
						</div>
						<Text style={{ fontSize: '12px', color: '#666', marginLeft: '24px' }}>
							Create a backup before importing blueprint
						</Text>
					</div>
					
					<div style={{ marginBottom: '20px' }}>
						<div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
							<Checkbox
								checked={this.state.settings.notifyOnCompletion}
								onChange={(checked) => this.handleSettingsChange('notifyOnCompletion', checked)}
							/>
							<Text style={{ marginLeft: '8px', marginBottom: '0' }}>
								Notify on completion
							</Text>
						</div>
						<Text style={{ fontSize: '12px', color: '#666', marginLeft: '24px' }}>
							Show notification when import completes
						</Text>
					</div>

					<div style={{ marginTop: '20px' }}>
						<Button onClick={this.closeSettings} className="woo button">
							Save Settings
						</Button>
					</div>
				</div>
			</FlyModal>
		);
	}

	render() {
		return (
			<div style={{ flex: '1', overflowY: 'auto', margin: '10px' }}>
				{this.renderFileUpload()}
				{this.renderImportProgress()}
				{this.renderPreview()}
				{this.renderSettings()}
				
				<div style={{ marginTop: '20px' }}>
					<TextButton onClick={() => this.setState({ showSettings: true })}>
						Import Settings
					</TextButton>
				</div>
			</div>
		);
	}
}
