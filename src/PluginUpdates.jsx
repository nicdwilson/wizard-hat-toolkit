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
			availableUpdates: [],
			selectedUpdates: [],
			updateError: null,
			showSpinner: false,
			statusMessage: '',
			cloneStatus: null,
			cloneError: null,
			cloneHelpText: null,
		};
		this.checkUpdates = this.checkUpdates.bind(this);
		this.applySelectedUpdates = this.applySelectedUpdates.bind(this);
		this.toggleUpdateSelection = this.toggleUpdateSelection.bind(this);
		this.selectAllUpdates = this.selectAllUpdates.bind(this);
		this.deselectAllUpdates = this.deselectAllUpdates.bind(this);
	}

	componentDidMount() {
		console.log('[PluginUpdates] Component mounted, setting up IPC listeners');
		
		// Listen for update events
		ipcRenderer.on("plugins-updated", (event, data) => {
			console.log('[PluginUpdates] Received plugins-updated event:', data);
			this.setState({
				updateStatus: "updated",
				showSpinner: false,
				statusMessage: `Successfully updated ${data.updatedCount} plugin(s)`,
				availableUpdates: [],
				selectedUpdates: []
			});
		});

		ipcRenderer.on("updates-available", (event, data) => {
			console.log('[PluginUpdates] Received updates-available event:', data);
			this.setState({
				updateStatus: "available",
				availableUpdates: data.updates,
				selectedUpdates: [], // Reset selections
				showSpinner: false,
				statusMessage: `Found ${data.availableCount} plugin(s) with updates available`
			});
		});

		ipcRenderer.on("no-updates-available", (event, data) => {
			console.log('[PluginUpdates] Received no-updates-available event:', data);
			this.setState({
				updateStatus: "no-updates",
				showSpinner: false,
				statusMessage: `No updates available for ${data.pluginCount} plugin(s)`
			});
		});

		ipcRenderer.on("no-plugins-found", (event, data) => {
			console.log('[PluginUpdates] Received no-plugins-found event:', data);
			this.setState({
				updateStatus: "no-plugins",
				showSpinner: false,
				statusMessage: 'No plugins found'
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

		// Listen for repository clone progress
		ipcRenderer.on("repository-clone-progress", (event, data) => {
			this.setState({
				cloneStatus: data.status,
				cloneError: null,
				cloneHelpText: null,
			});
		});

		ipcRenderer.on("repository-clone-complete", (event, data) => {
			this.setState({
				cloneStatus: null,
				cloneError: null,
				cloneHelpText: null,
			});
		});

		ipcRenderer.on("repository-clone-error", (event, data) => {
			this.setState({
				cloneStatus: null,
				cloneError: data.error,
				cloneHelpText: data.helpText,
			});
		});

		// Trigger repository initialization when component mounts (tab is opened)
		// This ensures the repository is ready when user clicks "Check for Updates"
		ipcRenderer.send("get-premium-plugin-selections");
	}

	componentWillUnmount() {
		ipcRenderer.removeAllListeners("plugins-updated");
		ipcRenderer.removeAllListeners("updates-available");
		ipcRenderer.removeAllListeners("no-updates-available");
		ipcRenderer.removeAllListeners("no-plugins-found");
		ipcRenderer.removeAllListeners("update-error");
		ipcRenderer.removeAllListeners("repository-clone-progress");
		ipcRenderer.removeAllListeners("repository-clone-complete");
		ipcRenderer.removeAllListeners("repository-clone-error");
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
			statusMessage: 'Checking for plugin updates...',
			availableUpdates: [],
			selectedUpdates: []
		});
		ipcRenderer.send("check-plugin-updates", this.state.siteId);
	}

	applySelectedUpdates() {
		console.log('[PluginUpdates] applySelectedUpdates() called');
		
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
		
		if (this.state.selectedUpdates.length === 0) {
			this.setState({
				updateStatus: "error",
				updateError: "Please select at least one plugin to update",
				showSpinner: false
			});
			return;
		}
		
		console.log('[PluginUpdates] Starting plugin updates for site:', this.state.siteId);
		this.setState({ 
			showSpinner: true, 
			updateStatus: null,
			statusMessage: `Applying updates to ${this.state.selectedUpdates.length} plugin(s)...`
		});
		ipcRenderer.send("apply-selected-updates", this.state.siteId, this.state.selectedUpdates);
	}

	toggleUpdateSelection(update) {
		const selectedUpdates = [...this.state.selectedUpdates];
		const index = selectedUpdates.findIndex(selected => selected.name === update.name);
		
		if (index >= 0) {
			selectedUpdates.splice(index, 1);
		} else {
			selectedUpdates.push(update);
		}
		
		this.setState({ selectedUpdates });
	}

	selectAllUpdates() {
		this.setState({ selectedUpdates: [...this.state.availableUpdates] });
	}

	deselectAllUpdates() {
		this.setState({ selectedUpdates: [] });
	}

	isUpdateSelected(update) {
		return this.state.selectedUpdates.some(selected => selected.name === update.name);
	}

	renderUpdateSelection() {
		if (this.state.updateStatus !== "available") return null;

		return (
			<Card>
				<Title>Available Updates</Title>
				<Text>
					Select the plugins you want to update:
				</Text>
				
				<div style={{ margin: "1em 0" }}>
					<Button
						onClick={this.selectAllUpdates}
						className="woo button"
						style={{ marginRight: "0.5em" }}
					>
						Select All
					</Button>
					<Button
						onClick={this.deselectAllUpdates}
						className="woo button"
					>
						Deselect All
					</Button>
				</div>

				<div style={{ margin: "1em 0" }}>
					{this.state.availableUpdates.map((update, index) => (
						<div key={index} style={{ margin: "0.5em 0", padding: "0.5em", border: "1px solid #ddd", borderRadius: "4px" }}>
							<Checkbox
								label={`${update.name} (${update.isMarketplace ? 'Marketplace' : 'WordPress.org'})`}
								checked={this.isUpdateSelected(update)}
								onChange={() => this.toggleUpdateSelection(update)}
							/>
							<Text fontSize="s" style={{ marginLeft: "1.5em", color: "#666" }}>
								{update.currentVersion} → {update.newVersion}
							</Text>
						</div>
					))}
				</div>

				<div style={{ margin: "1em 0" }}>
					<Button
						onClick={this.applySelectedUpdates}
						className="woo button"
						disabled={this.state.selectedUpdates.length === 0 || this.state.showSpinner}
					>
						Update Selected Plugins ({this.state.selectedUpdates.length})
						{this.state.showSpinner && <Spinner />}
					</Button>
				</div>
			</Card>
		);
	}

	renderUpdateStatus() {
		if (!this.state.updateStatus) return null;

		switch (this.state.updateStatus) {
			case "updated":
				return (
					<Card>
						<Title>Plugins Updated Successfully</Title>
						<Text>
							{this.state.statusMessage}
						</Text>
					</Card>
				);
			case "no-updates":
				return (
					<Card>
						<Title>No Updates Available</Title>
						<Text>
							All plugins are up to date.
						</Text>
					</Card>
				);
			case "no-plugins":
				return (
					<Card>
						<Title>No Plugins Found</Title>
						<Text>
							No plugins were found on this site.
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

	renderSpinner() {
		if (this.state.showSpinner) {
			return <Spinner />;
		}
		return null;
	}

	renderCloneStatus() {
		if (this.state.cloneStatus) {
			return (
				<Card style={{ marginBottom: "1em", backgroundColor: "#f0f8ff" }}>
					<div style={{ display: "flex", alignItems: "center", gap: "0.5em" }}>
						<Spinner />
						<Text fontSize="s" style={{ color: "#0066cc" }}>
							{this.state.cloneStatus}
						</Text>
					</div>
				</Card>
			);
		}
		if (this.state.cloneError) {
			return (
				<Card style={{ marginBottom: "1em", backgroundColor: "#fff5f5" }}>
					<Text fontSize="s" style={{ color: "#cc0000", fontWeight: "bold", marginBottom: "0.5em" }}>
						Repository Error: {this.state.cloneError}
					</Text>
					{this.state.cloneHelpText && (
						<Text fontSize="s" style={{ color: "#666", whiteSpace: "pre-line" }}>
							{this.state.cloneHelpText}
						</Text>
					)}
				</Card>
			);
		}
		return null;
	}

	render() {
		return (
			<Container>
				{this.renderCloneStatus()}
				<Card>
					<Title>Plugin Updates</Title>
					<Text>
						Check for and update WordPress plugins on this site.
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
					{!this.state.cloneStatus && (
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
					)}
				</Card>

				<Divider />

				{this.renderUpdateSelection()}

				<Divider />

				{this.renderUpdateStatus()}
			</Container>
		);
	}
}
