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
	InputPasswordToggle,
	Divider,
} from "@getflywheel/local-components";
import Select from "react-select";
export default class PluginManagement extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			siteId: props.match.params.siteID,
			showInstructions: false,
			showError: false,
			showSpinner: false,
			tokenIsValid: false,
			premiumPluginSelections: [],
			pluginsToInstall: [],
			selectedPlugins: null,
		};
		this.hideInstructions = this.hideInstructions.bind(this);
		this.hideError = this.hideError.bind(this);
		this.showSpinner = this.showSpinner.bind(this);
		this.handlePluginSelectionChange =
			this.handlePluginSelectionChange.bind(this);
		this.installPlugins = this.installPlugins.bind(this);
	}

	componentDidMount() {
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

		ipcRenderer.send("is-token-valid");
		ipcRenderer.on("gh-token", (event, args) => {
			this.setState({
				tokenIsValid: args.valid,
			});
		});

		ipcRenderer.on("token-is-valid", (event, tokenIsValid) => {
			this.setState({
				tokenIsValid: tokenIsValid,
			});
		});

		ipcRenderer.send("validate-token");

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

		ipcRenderer.send("validate-token");

		ipcRenderer.on("is-token-valid", () => {
			ipcRenderer.send("token-is-valid", this.state.tokenIsValid);
		});
	}

	componentWillUnmount() {
		ipcRenderer.removeAllListeners("instructions");
		ipcRenderer.removeAllListeners("error");
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

	maybeSaveToken(token) {
		ipcRenderer.send("set-user-token", token);
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

	tokenInput = () => (
		<div
			style={{
				flexGrow: "1",
				position: "relative",
			}}
			class="woo gh-token"
		>
			<p>
				This content requires a valid{" "}
				<a href="https://github.com/settings/tokens">GitHub token</a>{" "}
				with 'repo' scope enabled.
			</p>
			<p>Please enter a valid token to continue.</p>
			<p>
				<InputPasswordToggle
					onChange={(event) =>
						this.maybeSaveToken(event.target.value)
					}
					onBlur={(event) => this.maybeSaveToken(event.target.value)}
				/>
			</p>
		</div>
	);

	getPluginSelections() {
		ipcRenderer.send("get-premium-plugin-selections");
	}

	render() {
		if (this.state.tokenIsValid) {
			return (
				<div
					style={{
						flexGrow: "1",
						position: "relative",
					}}
					class="woo"
				>
					<Card style={{ zIndex: 9999, overflow: "visible" }}>
						A la Carte plugin installation
						<div style={{ width: "90%", margin: "1em" }}>
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
						<p></p>
					</Card>
					<Divider />
					{/**<Card>
				Install & Activate Popular Extensions
				<Button className="woo button">Install</Button>
					</Card>*/}
				</div>
			);
		} else {
			return ( <Card style={{ zIndex: 9999, overflow: "visible" }}><p>{this.tokenInput()} </p></Card> );
		}
	}
}
