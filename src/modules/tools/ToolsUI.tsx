import React, { Component } from 'react';
import {
	Button,
	Card,
	Text,
	Title,
	Checkbox,
	Divider,
	BasicInput,
	Spinner
} from '@getflywheel/local-components';
import { ToolsManager, ToolsSettings } from './ToolsManager';
import { ipcRenderer } from 'electron';

interface ToolsUIState {
	settings: ToolsSettings;
	repositoryPath: string | null;
	lastUpdated: string | null;
	isInitialized: boolean;
	refreshing: boolean;
	editingPath: boolean;
	newPath: string;
	pathError: string | null;
}

export default class ToolsUI extends Component<any, ToolsUIState> {
	constructor(props: any) {
		super(props);

		this.state = {
			settings: ToolsManager.getSettings(),
			repositoryPath: null,
			lastUpdated: null,
			isInitialized: false,
			refreshing: false,
			editingPath: false,
			newPath: '',
			pathError: null
		};

		this.handleSettingsChange = this.handleSettingsChange.bind(this);
		this.handleResetSettings = this.handleResetSettings.bind(this);
		this.handleForceRefresh = this.handleForceRefresh.bind(this);
		this.handleEditPath = this.handleEditPath.bind(this);
		this.handleSavePath = this.handleSavePath.bind(this);
		this.handleCancelEdit = this.handleCancelEdit.bind(this);
		this.handlePathChange = this.handlePathChange.bind(this);
	}

	componentDidMount() {
		// Get initial repository status
		ipcRenderer.send('get-repository-status');

		// Listen for repository status updates
		ipcRenderer.on('repository-status', (event, data) => {
			this.setState({
				repositoryPath: data.path,
				lastUpdated: data.lastUpdated,
				isInitialized: data.isInitialized
			});
		});

		// Listen for refresh completion
		ipcRenderer.on('repository-clone-complete', (event, data) => {
			this.setState({
				refreshing: false,
				lastUpdated: data.lastUpdated
			});
			// Refresh repository status
			ipcRenderer.send('get-repository-status');
		});

		// Listen for refresh errors
		ipcRenderer.on('repository-clone-error', (event, data) => {
			this.setState({
				refreshing: false,
				pathError: data.error
			});
		});

		// Listen for path validation
		ipcRenderer.on('repository-path-validated', (event, data) => {
			if (data.valid) {
				// Save the validated path
				ipcRenderer.send('save-repository-path', this.state.newPath);
			} else {
				this.setState({
					pathError: data.error
				});
			}
		});

		// Listen for path save confirmation
		ipcRenderer.on('repository-path-saved', (event, data) => {
			if (data.success) {
				this.setState({
					editingPath: false,
					pathError: null,
					repositoryPath: this.state.newPath
				});
				// Refresh repository status
				ipcRenderer.send('get-repository-status');
			} else {
				this.setState({
					pathError: data.error
				});
			}
		});
	}

	componentWillUnmount() {
		ipcRenderer.removeAllListeners('repository-status');
		ipcRenderer.removeAllListeners('repository-clone-complete');
		ipcRenderer.removeAllListeners('repository-clone-error');
		ipcRenderer.removeAllListeners('repository-path-validated');
		ipcRenderer.removeAllListeners('repository-path-saved');
	}

	handleSettingsChange(setting: keyof ToolsSettings, value: boolean) {
		const newSettings = { ...this.state.settings, [setting]: value };
		this.setState({ settings: newSettings });
		ToolsManager.updateSettings(newSettings);
	}

	handleResetSettings() {
		const defaultSettings = ToolsManager.getSettings();
		this.setState({ settings: defaultSettings });
		ToolsManager.updateSettings(defaultSettings);
	}

	handleForceRefresh() {
		this.setState({ refreshing: true, pathError: null });
		ipcRenderer.send('force-refresh-repository');
	}

	handleEditPath() {
		this.setState({
			editingPath: true,
			newPath: this.state.repositoryPath || '',
			pathError: null
		});
	}

	handleSavePath() {
		const { newPath } = this.state;
		if (!newPath || newPath.trim() === '') {
			this.setState({ pathError: 'Please enter a valid path' });
			return;
		}
		// Validate the path first
		ipcRenderer.send('validate-repository-path', newPath);
	}

	handleCancelEdit() {
		this.setState({
			editingPath: false,
			newPath: '',
			pathError: null
		});
	}

	handlePathChange(event: React.ChangeEvent<HTMLInputElement>) {
		this.setState({ newPath: event.target.value, pathError: null });
	}

	formatDate(dateString: string | null): string {
		if (!dateString) return 'Never';
		try {
			const date = new Date(dateString);
			const now = new Date();
			const diffMs = now.getTime() - date.getTime();
			const diffMins = Math.floor(diffMs / 60000);
			const diffHours = Math.floor(diffMs / 3600000);
			const diffDays = Math.floor(diffMs / 86400000);

			if (diffMins < 1) return 'Just now';
			if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
			if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
			if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
			return date.toLocaleString();
		} catch (error) {
			return 'Unknown';
		}
	}

	render() {
		const { settings, repositoryPath, lastUpdated, refreshing, editingPath, newPath, pathError } = this.state;

		return (
			<div style={{ padding: '20px' }}>
				<Title>Tools</Title>
				<Text style={{ marginBottom: '20px', color: '#666' }}>
					Configure debugging and utility options for the Wizard Hat Toolkit.
				</Text>

				<Divider />

				{/* Repository Configuration Section */}
				<div style={{ marginTop: '20px', marginBottom: '30px' }}>
					<Title size="s" style={{ marginBottom: '15px' }}>Repository Configuration</Title>

					<div style={{ marginBottom: '15px' }}>
						<Text style={{ fontWeight: 'bold', marginBottom: '5px' }}>
							All-Plugins Repository Path
						</Text>
						{!editingPath ? (
							<div>
								<div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
									<Text style={{ fontFamily: 'monospace', fontSize: '12px', color: '#555', flex: 1 }}>
										{repositoryPath || 'Not configured'}
									</Text>
									<Button onClick={this.handleEditPath} className="woo button" style={{ fontSize: '12px', padding: '4px 12px' }}>
										Edit Path
									</Button>
								</div>
								{repositoryPath && (
									<>
										<Text style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
											Last updated: {this.formatDate(lastUpdated)}
										</Text>
										<Button
											onClick={this.handleForceRefresh}
											disabled={refreshing}
											className="woo button"
											style={{ marginTop: '8px' }}
										>
											{refreshing ? (
												<span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
													<Spinner />
													Refreshing...
												</span>
											) : (
												'Refresh Repository'
											)}
										</Button>
									</>
								)}
							</div>
						) : (
							<div>
								<Text style={{ fontSize: '11px', color: '#666', marginBottom: '0.25em' }}>
									Example: /Users/yourname/all-plugins
								</Text>
								<BasicInput
									value={newPath}
									onChange={this.handlePathChange}
									style={{ width: '100%', marginBottom: '10px', fontFamily: 'monospace' }}
								/>
								{pathError && (
									<Text style={{ color: 'red', fontSize: '12px', marginBottom: '10px' }}>
										{pathError}
									</Text>
								)}
								<div style={{ display: 'flex', gap: '10px' }}>
									<Button onClick={this.handleSavePath} className="woo button">
										Save
									</Button>
									<Button onClick={this.handleCancelEdit} className="woo button">
										Cancel
									</Button>
								</div>
							</div>
						)}
						<Text style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
							This is the path to your local clone of the all-plugins repository.
							This repository must be cloned and maintained separately. The toolkit will use
							this path to access marketplace plugins.
						</Text>
					</div>
				</div>

				<Divider />

				{/* Debug Settings Section */}
				<div style={{ marginTop: '20px' }}>
					<Title size="s" style={{ marginBottom: '15px' }}>Debug Settings</Title>

					<div style={{ marginBottom: '20px' }}>
						<div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
							<Checkbox
								checked={settings.enableDebugLog}
								onChange={(checked) => this.handleSettingsChange('enableDebugLog', checked)}
							/>
							<Text style={{ marginLeft: '8px', marginBottom: '0' }}>
								Enable debug log
							</Text>
						</div>
						<Text style={{ fontSize: '12px', color: '#666', marginLeft: '24px' }}>
							Enable detailed logging to the wizard-hat-toolkit.log file for troubleshooting
						</Text>
					</div>

					<div style={{ marginTop: '30px' }}>
						<Button onClick={this.handleResetSettings} className="woo button">
							Reset to Defaults
						</Button>
					</div>
				</div>
			</div>
		);
	}
}
