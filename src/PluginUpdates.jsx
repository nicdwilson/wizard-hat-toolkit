import React from "react";
import { ipcRenderer } from "electron";
import {
	Button,
	Card,
	Title,
	Text,
	Spinner,
	Checkbox,
	Container,
	Divider,
} from "@getflywheel/local-components";

export default class PluginUpdates extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			siteId: props.match.params.siteID,
			updateStatus: null,
			lastUpdateCheck: null,
			updatedPlugins: [],
			availableUpdates: [],
			updateError: null,
			showSpinner: false,
			statusMessage: '',
			settings: {
				autoUpdate: true,
				updateOnStartup: true,
				notifyOnUpdates: true,
				excludedPlugins: [],
			},
		};
		this.checkUpdates = this.checkUpdates.bind(this);
		this.applyUpdates = this.applyUpdates.bind(this);
		this.updateSettings = this.updateSettings.bind(this);
	}

	componentDidMount() {
		console.log('[PluginUpdates] Component mounted, setting up IPC listeners');
		
		// Listen for update events
		ipcRenderer.on("plugins-updated", (event, data) => {
			console.log('[PluginUpdates] Received plugins-updated event:', data);
			this.setState({
				updateStatus: "updated",
				updatedPlugins: data.plugins,
				showSpinner: false,
				statusMessage: `Successfully updated ${data.updatedCount} plugin(s)`
			});
		});

		ipcRenderer.on("updates-available", (event, data) => {
			console.log('[PluginUpdates] Received updates-available event:', data);
			this.setState({
				updateStatus: "available",
				availableUpdates: data.plugins,
				showSpinner: false,
				statusMessage: `Found ${data.availableCount} plugin(s) with updates available`
			});
		});

		ipcRenderer.on("no-updates-available", (event, data) => {
			console.log('[PluginUpdates] Received no-updates-available event:', data);
			this.setState({
				updateStatus: "no-updates",
				showSpinner: false,
				statusMessage: `No updates available for ${data.pluginCount} marketplace plugin(s)`
			});
		});

		ipcRenderer.on("no-marketplace-plugins", (event, data) => {
			console.log('[PluginUpdates] Received no-marketplace-plugins event:', data);
			this.setState({
				updateStatus: "no-plugins",
				showSpinner: false,
				statusMessage: 'No WooCommerce Marketplace plugins found'
			});
		});

		ipcRenderer.on("update-error", (event, data) => {
			console.error('[PluginUpdates] Received update-error event:', data);
			this.setState({
				updateStatus: "error",
				updateError: data.error,
				showSpinner: false,
				statusMessage: `Error: ${data.error}`
			});
		});

		ipcRenderer.on("settings-updated", () => {
			// Settings were updated, could refresh UI if needed
		});

		// Get current settings
		ipcRenderer.send("get-plugin-settings");
		ipcRenderer.on("plugin-settings", (event, settings) => {
			this.setState({ settings });
			
			// Check for updates when tab is accessed (if enabled and site is running)
			if (settings.updateOnStartup && 
				this.props.siteStatuses && 
				this.props.siteStatuses[this.state.siteId] === "running") {
				setTimeout(() => {
					this.checkUpdates();
				}, 1000); // Small delay to ensure component is fully mounted
			}
		});
	}

	componentWillUnmount() {
		ipcRenderer.removeAllListeners("plugins-updated");
		ipcRenderer.removeAllListeners("updates-available");
		ipcRenderer.removeAllListeners("no-updates-available");
		ipcRenderer.removeAllListeners("no-marketplace-plugins");
		ipcRenderer.removeAllListeners("update-error");
		ipcRenderer.removeAllListeners("settings-updated");
		ipcRenderer.removeAllListeners("plugin-settings");
	}

	checkUpdates() {
		console.log('[PluginUpdates] checkUpdates() called');
		
		// Only allow updates if site is running
		if (this.props.siteStatuses && this.props.siteStatuses[this.state.siteId] !== "running") {
			console.log('[PluginUpdates] Site not running, cannot check updates');
			this.setState({
				updateStatus: "error",
				updateError: "Site must be running to check for plugin updates",
				showSpinner: false
			});
			return;
		}
		
		console.log('[PluginUpdates] Starting update check for site:', this.state.siteId);
		this.setState({ 
			showSpinner: true, 
			updateStatus: null,
			statusMessage: 'Checking for plugin updates...'
		});
		ipcRenderer.send("check-plugin-updates", this.state.siteId);
	}

	applyUpdates() {
		console.log('[PluginUpdates] applyUpdates() called');
		
		// Only allow updates if site is running
		if (this.props.siteStatuses && this.props.siteStatuses[this.state.siteId] !== "running") {
			console.log('[PluginUpdates] Site not running, cannot apply updates');
			this.setState({
				updateStatus: "error",
				updateError: "Site must be running to apply plugin updates",
				showSpinner: false
			});
			return;
		}
		
		console.log('[PluginUpdates] Starting plugin updates for site:', this.state.siteId);
		this.setState({ 
			showSpinner: true, 
			updateStatus: null,
			statusMessage: 'Applying plugin updates...'
		});
		ipcRenderer.send("apply-plugin-updates", this.state.siteId);
	}

	updateSettings(newSettings) {
		const updatedSettings = { ...this.state.settings, ...newSettings };
		this.setState({ settings: updatedSettings });
		ipcRenderer.send("update-plugin-settings", updatedSettings);
	}

	renderUpdateStatus() {
		if (!this.state.updateStatus) return null;

		switch (this.state.updateStatus) {
			case "updated":
				return (
					<Card>
						<Title>Plugins Updated</Title>
						<Text>
							Successfully updated {this.state.updatedPlugins.length} plugins:
						</Text>
						<ul>
							{this.state.updatedPlugins.map((plugin, index) => (
								<li key={index}>{plugin}</li>
							))}
						</ul>
					</Card>
				);
			case "available":
				return (
					<Card>
						<Title>Updates Available</Title>
						<Text>
							{this.state.availableUpdates.length} plugins have updates available:
						</Text>
						<ul>
							{this.state.availableUpdates.map((plugin, index) => (
								<li key={index}>{plugin}</li>
							))}
						</ul>
						<Button onClick={this.applyUpdates} className="woo button">
							Update All Plugins
						</Button>
					</Card>
				);
			case "no-updates":
				return (
					<Card>
						<Title>No Updates Available</Title>
						<Text>
							All WooCommerce Marketplace plugins are up to date.
						</Text>
					</Card>
				);
			case "no-plugins":
				return (
					<Card>
						<Title>No Marketplace Plugins Found</Title>
						<Text>
							No WooCommerce Marketplace plugins were found. Install some plugins via the Plugin Management tab to enable automatic updates.
						</Text>
					</Card>
				);
			case "error":
				return (
					<Card>
						<Title>Update Error</Title>
						<Text color="red">{this.state.updateError}</Text>
						<Button onClick={this.checkUpdates} className="woo button">
							Retry
						</Button>
					</Card>
				);
			default:
				return null;
		}
	}

	renderSettings() {
		return (
			<Card>
				<Title>Update Settings</Title>
				<div style={{ margin: "1em 0" }}>
					<Checkbox
						label="Enable automatic updates"
						checked={this.state.settings.autoUpdate}
						onChange={(value) =>
							this.updateSettings({ autoUpdate: value })
						}
					/>
				</div>
				<div style={{ margin: "1em 0" }}>
					<Checkbox
						label="Check for updates when accessing this tab (if site is running)"
						checked={this.state.settings.updateOnStartup}
						onChange={(value) =>
							this.updateSettings({ updateOnStartup: value })
						}
					/>
					<Text fontSize="s" style={{ marginLeft: "1.5em", color: "#666" }}>
						When enabled, updates will be checked automatically when you visit this tab, but only if the site is running.
					</Text>
				</div>
				<div style={{ margin: "1em 0" }}>
					<Checkbox
						label="Show notifications for available updates"
						checked={this.state.settings.notifyOnUpdates}
						onChange={(value) =>
							this.updateSettings({ notifyOnUpdates: value })
						}
					/>
				</div>
			</Card>
		);
	}

	renderSpinner() {
		if (this.state.showSpinner) {
			return <Spinner />;
		}
		return null;
	}

	render() {
		return (
			<Container>
				<Card>
					<Title>Plugin Updates</Title>
					<Text>
						Manage automatic updates for WooCommerce Marketplace plugins
						installed via the Plugin Management module.
					</Text>
					{this.state.statusMessage && (
						<Text fontSize="s" style={{ 
							color: this.state.updateStatus === "error" ? "#ff6b6b" : "#4CAF50", 
							margin: "0.5em 0",
							fontWeight: "bold"
						}}>
							{this.state.statusMessage}
						</Text>
					)}
					{this.props.siteStatuses && this.props.siteStatuses[this.state.siteId] !== "running" && (
						<Text fontSize="s" style={{ color: "#ff6b6b", margin: "0.5em 0" }}>
							⚠️ Site must be running to check for updates
						</Text>
					)}
					<div style={{ margin: "1em 0" }}>
						<Button
							onClick={this.checkUpdates}
							className="woo button"
							disabled={this.state.showSpinner || (this.props.siteStatuses && this.props.siteStatuses[this.state.siteId] !== "running")}
						>
							Check for Updates
							{this.renderSpinner()}
						</Button>
					</div>
				</Card>

				<Divider />

				{this.renderUpdateStatus()}

				<Divider />

				{this.renderSettings()}
			</Container>
		);
	}
}
