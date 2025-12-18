import React from "react";
import { ipcRenderer } from "electron";
// https://github.com/getflywheel/local-components
import {
	Button,
	FlyModal,
	Title,
	Text,
	Spinner,
	Card,
	Divider,
} from "@getflywheel/local-components";
import Select from "react-select";
import RepositorySetup from "./components/RepositorySetup";

export default class PluginManagement extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			siteId: props.match.params.siteID,
			showInstructions: false,
			showError: false,
			showSpinner: false,
			premiumPluginSelections: [],
			pluginsToInstall: [],
			selectedPlugins: null,
			cloneStatus: null,
			cloneError: null,
			cloneHelpText: null,
			repositoryConfigured: null, // null = checking, true = configured, false = not configured
		};
		this.hideInstructions = this.hideInstructions.bind(this);
		this.hideError = this.hideError.bind(this);
		this.showSpinner = this.showSpinner.bind(this);
		this.handlePluginSelectionChange =
			this.handlePluginSelectionChange.bind(this);
		this.installPlugins = this.installPlugins.bind(this);
	}

	componentDidMount() {
		// Check if repository is configured
		ipcRenderer.send("check-repository-configured");
		ipcRenderer.on("repository-configured-status", (event, data) => {
			this.setState({
				repositoryConfigured: data.configured,
			});
		});

		ipcRenderer.on("repository-path-saved", (event, data) => {
			if (data.success) {
				this.setState({
					repositoryConfigured: true,
				});
				// Trigger repository initialization
				ipcRenderer.send("get-premium-plugin-selections");
			}
		});

		ipcRenderer.on("instructions", (event) => {
			this.setState({
				showInstructions: true,
			});
			this.setState({
				showSpinner: false,
			});
		});

		ipcRenderer.on("error", (event) => {
			this.setState({
				showError: true,
			});
			this.setState({
				showSpinner: false,
			});
		});

		ipcRenderer.on("premium-plugin-selections", (event, args) => {
			this.setState({
				premiumPluginSelections: args,
			});
		});

		ipcRenderer.on("premium-theme-selections", (event, args) => {
			this.setState({
				premiumThemeSelections: args,
			});
		});

		ipcRenderer.on("debug-message", (event, args) => {
			console.info(args);
		});

		ipcRenderer.on("spinner-done", () => {
			this.setState({
				showSpinner: false,
			});
			this.setState({
				selectedPlugins: null,
			});
			this.setState({
				pluginsToInstall: [],
			});
			this.setState({
				switchingTo: null,
			});
			this.setState({
				installingThemes: false,
			});
			this.setState({
				installingPlugins: false,
			});
		});

		ipcRenderer.on("plugin-install-done", () => {
			this.setState({
				showSpinner: false,
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

		// Trigger repository initialization when component mounts (only if configured)
		// Wait for repository configuration check to complete
		const checkInterval = setInterval(() => {
			if (this.state.repositoryConfigured !== null) {
				clearInterval(checkInterval);
				if (this.state.repositoryConfigured) {
		ipcRenderer.send("get-premium-plugin-selections");
				}
			}
		}, 100);
	}

	componentWillUnmount() {
		ipcRenderer.removeAllListeners("instructions");
		ipcRenderer.removeAllListeners("error");
		ipcRenderer.removeAllListeners("repository-clone-progress");
		ipcRenderer.removeAllListeners("repository-clone-complete");
		ipcRenderer.removeAllListeners("repository-clone-error");
		ipcRenderer.removeAllListeners("repository-configured-status");
		ipcRenderer.removeAllListeners("repository-path-saved");
	}

	hideInstructions() {
		this.setState({
			showInstructions: false,
		});
	}

	hideError() {
		this.setState({
			showError: false,
		});
	}

	renderInstructions() {
		return (
			<FlyModal
				isOpen={this.state.showInstructions}
				onRequestClose={this.hideInstructions}
			>
				<Title fontSize="l">Great Success!</Title>
				<div style={{ padding: "20px" }}>
					<Text
						fontSize="l"
						privateOptions={{
							fontWeight: "medium",
						}}
					>
						Site locale switcheroo to {this.localeSwitchedTo}{" "}
						happened without incident!
					</Text>
				</div>
			</FlyModal>
		);
	}

	renderError() {
		return (
			<FlyModal
				isOpen={this.state.showError}
				onRequestClose={this.hideError}
			>
				<Title fontSize="l">Much Sadness :(</Title>
				<div style={{ padding: "20px" }}>
					<Text
						fontSize="l"
						privateOptions={{
							fontWeight: "medium",
						}}
					>
						There was some sort of an error. Check the logs maybe.
					</Text>
				</div>
			</FlyModal>
		);
	}

	showSpinner() {
		return this.state.showSpinner;
	}

	renderSpinner() {
		if (this.state.showSpinner) {
			return <Spinner />;
		} else {
			return null;
		}
	}

	handlePluginSelectionChange(value, action) {
		this.setState({
			selectedPlugins: value,
		});
		let pluginsToInstall = this.state.pluginsToInstall;
		if ("select-option" == action.action) {
			pluginsToInstall.push(action.option.label);
			this.setState({
				installPluginButton: false,
			});
			this.setState({
				pluginsToInstall: pluginsToInstall,
			});
		} else if ("remove-value" === action.action) {
			const index = pluginsToInstall.indexOf(action.removedValue.label);
			pluginsToInstall.splice(index, 1);
			this.setState({
				installPluginButton: false,
			});
			this.setState({
				pluginsToInstall: pluginsToInstall,
			});
		} else {
			pluginsToInstall = [];
			this.setState({
				installPluginButton: true,
			});
			this.setState({
				pluginsToInstall: pluginsToInstall,
			});
		}
	}

	installPlugins() {
		this.setState({
			showSpinner: true,
		});
		ipcRenderer.send(
			"install-plugins",
			this.state.pluginsToInstall,
			this.state.siteId
		);
	}

	installAndActivatePlugins(pluginsToInstall) {
		this.setState({
			showSpinner: true,
		});
		this.setState({
			installingPlugins: true,
		});
		ipcRenderer.send(
			"install-plugins",
			pluginsToInstall,
			this.state.siteId
		);
	}

	getPluginSelections() {
		ipcRenderer.send("get-premium-plugin-selections");
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
		// Show repository setup if not configured
		if (this.state.repositoryConfigured === false) {
			return <RepositorySetup />;
		}

		// Show loading state while checking repository configuration
		if (this.state.repositoryConfigured === null) {
			return (
				<Card style={{ zIndex: 9999, overflow: "visible" }}>
					<Text>Checking repository configuration...</Text>
					{this.renderSpinner()}
				</Card>
			);
		}

		return (
			<div
				style={{
					flexGrow: "1",
					position: "relative",
				}}
				class="woo"
			>
				{this.renderCloneStatus()}
				<Card style={{ zIndex: 9999, overflow: "visible" }}>
					<Title>Plugin Installer</Title>
					<Text>
						Select and install WordPress plugins on this site.
					</Text>
					{!this.state.cloneStatus && (
						<div style={{ margin: "1em 0" }}>
							<div style={{ width: "90%", marginBottom: "1em" }}>
								<Select
									options={this.state.premiumPluginSelections}
									placeholder={"Select plugin(s) to install..."}
									onChange={this.handlePluginSelectionChange}
									name="plugin_slug"
									style={{
										zIndex: 9999,
										flexGrow: "1",
										overflow: "visible",
									}}
									className="plugin-select"
									value={this.state.selectedPlugins}
									isMulti
								/>
							</div>
							<Button
								className="woo button"
								//disabled={this.state.installPluginButton}
								onClick={this.installPlugins}
							>
								Install
								{this.renderSpinner()}
							</Button>
						</div>
					)}
				</Card>
				<Divider />
				{/**<Card>
			Install & Activate Popular Extensions
			<Button className="woo button">Install</Button>
				</Card>*/}
			</div>
		);
	}
}
