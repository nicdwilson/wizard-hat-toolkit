import React, { Component } from 'react';
import {
	Button,
	Card,
	Text,
	Title,
	Checkbox,
	Divider
} from '@getflywheel/local-components';
import { ToolsManager, ToolsSettings } from './ToolsManager';

interface ToolsUIState {
	settings: ToolsSettings;
}

export default class ToolsUI extends Component<any, ToolsUIState> {
	constructor(props: any) {
		super(props);
		
		this.state = {
			settings: ToolsManager.getSettings()
		};

		this.handleSettingsChange = this.handleSettingsChange.bind(this);
		this.handleResetSettings = this.handleResetSettings.bind(this);
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

	render() {
		const { settings } = this.state;

		return (
			<div style={{ padding: '20px' }}>
				<Title>Tools</Title>
				<Text style={{ marginBottom: '20px', color: '#666' }}>
					Configure debugging and utility options for the Wizard Hat Toolkit.
				</Text>

				<Divider />

				<div style={{ marginTop: '20px' }}>
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
