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

interface BlueprintUIState {
	selectedFile: File | null;
	blueprintData: BlueprintData | null;
	conflicts: any;
	importOptions: ImportOptions;
	importing: boolean;
	importProgress: {
		pluginsInstalled: number;
		themesInstalled: number;
		settingsApplied: number;
		errors: string[];
	};
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
				pluginsInstalled: 0,
				themesInstalled: 0,
				settingsApplied: 0,
				errors: []
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
				importProgress: result.results
			});
		});

		// Listen for import errors
		ipcRenderer.on('blueprint-import-error', (event, error) => {
			this.setState({
				importing: false,
				importProgress: {
					...this.state.importProgress,
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
					<input
						type="file"
						accept=".json"
						onChange={this.handleFileSelect}
						style={{ marginBottom: '10px' }}
					/>
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
		if (!this.state.importing) return null;

		const { importProgress } = this.state;

		return (
			<Card>
				<Title>Importing Blueprint</Title>
				<Spinner />
				
				<div style={{ marginTop: '20px' }}>
					<Text>Plugins installed: {importProgress.pluginsInstalled}</Text>
					<Text>Themes installed: {importProgress.themesInstalled}</Text>
					<Text>Settings applied: {importProgress.settingsApplied}</Text>
					
					{importProgress.errors.length > 0 && (
						<div style={{ color: 'red', marginTop: '10px' }}>
							<Text privateOptions={{ fontWeight: 'bold' }}>
								Errors:
							</Text>
							<ul>
								{importProgress.errors.map((error, index) => (
									<li key={index}>{error}</li>
								))}
							</ul>
						</div>
					)}
				</div>
			</Card>
		);
	}

	renderSettings() {
		return (
			<FlyModal isOpen={this.state.showSettings} onRequestClose={this.closeSettings}>
				<Title>Blueprint Import Settings</Title>
				
				<div style={{ padding: '20px' }}>
					<TableList>
						<TableListRow label="Auto-overwrite plugins">
							<Checkbox
								checked={this.state.settings.autoOverwritePlugins}
								onChange={(checked) => this.handleSettingsChange('autoOverwritePlugins', checked)}
							/>
							<Text>
								Automatically overwrite existing plugins during import
							</Text>
						</TableListRow>
						
						<TableListRow label="Auto-overwrite themes">
							<Checkbox
								checked={this.state.settings.autoOverwriteThemes}
								onChange={(checked) => this.handleSettingsChange('autoOverwriteThemes', checked)}
							/>
							<Text>
								Automatically overwrite existing themes during import
							</Text>
						</TableListRow>
						
						<TableListRow label="Auto-overwrite settings">
							<Checkbox
								checked={this.state.settings.autoOverwriteSettings}
								onChange={(checked) => this.handleSettingsChange('autoOverwriteSettings', checked)}
							/>
							<Text>
								Automatically overwrite existing settings during import
							</Text>
						</TableListRow>
						
						<TableListRow label="Skip conflicts">
							<Checkbox
								checked={this.state.settings.skipConflicts}
								onChange={(checked) => this.handleSettingsChange('skipConflicts', checked)}
							/>
							<Text>
								Skip items that conflict with existing installations
							</Text>
						</TableListRow>
						
						<TableListRow label="Backup before import">
							<Checkbox
								checked={this.state.settings.backupBeforeImport}
								onChange={(checked) => this.handleSettingsChange('backupBeforeImport', checked)}
							/>
							<Text>
								Create a backup before importing blueprint
							</Text>
						</TableListRow>
						
						<TableListRow label="Notify on completion">
							<Checkbox
								checked={this.state.settings.notifyOnCompletion}
								onChange={(checked) => this.handleSettingsChange('notifyOnCompletion', checked)}
							/>
							<Text>
								Show notification when import completes
							</Text>
						</TableListRow>
					</TableList>

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
