import React from "react";
import { ipcRenderer } from "electron";
import PluginManagement from "./PluginManagement";
import PluginUpdates from "./PluginUpdates";
import BlueprintUI from "./modules/blueprint-importer/BlueprintUI";
import ToolsUI from "./modules/tools/ToolsUI";

const { exec } = require("child_process");
// https://github.com/getflywheel/local-components
import {
	Button,
	FlyModal,
	Title,
	Text,
	Spinner,
	TertiaryNav,
	TertiaryNavItem,
	Card,
	Divider,
} from "@getflywheel/local-components";
import Select from "react-select";
export default class Wizardhat extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			siteId: props.match.params.siteID,
			showInstructions: false,
			showError: false,
			localeSwitchedTo: "",
			showSpinner: false,
			day: null,
			rootPath: props.sites[props.match.params.siteID].path,
			premiumPluginSelections: [],
			premiumThemeSelections: [],
			installPluginButton: true,
			pluginsToInstall: [],
			selectedPlugins: null,
			switchingTo: null,
			installingPlugins: false,
			installingThemes: false,
		};
		this.hideInstructions = this.hideInstructions.bind(this);
		this.hideError = this.hideError.bind(this);
		this.showSpinner = this.showSpinner.bind(this);
		this.testRequest = this.testRequest.bind(this);
		this.launchPostman = this.launchPostman.bind(this);
		this.handlePluginSelectionChange =
			this.handlePluginSelectionChange.bind(this);
		this.installPlugins = this.installPlugins.bind(this);
		this.pluginManagementContent = this.pluginManagementContent.bind(this);
		this.pluginUpdatesContent = this.pluginUpdatesContent.bind(this);
		this.blueprintImporterContent = this.blueprintImporterContent.bind(this);
		this.toolsContent = this.toolsContent.bind(this);
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

	}

	componentWillUnmount() {
		ipcRenderer.removeAllListeners("instructions");
		ipcRenderer.removeAllListeners("error");
		ipcRenderer.removeAllListeners("debug-message");
		ipcRenderer.removeAllListeners("premium-plugin-selections");
		ipcRenderer.removeAllListeners("plugin-install-done");
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

	switchCountry(newLocale, optionsToSet) {
		this.setState({
			showSpinner: true,
		});
		this.setState({
			switchingTo: newLocale,
		});
		ipcRenderer.send("switch-country", this.state.siteId, optionsToSet);
		this.localeSwitchedTo = newLocale;
	}

	testRequest() {
		ipcRenderer.send("test-request");
	}

	launchPostman() {
		exec("open -a Postman");
	}

	renderInstructions() {
		return (
			<FlyModal
				isOpen={this.state.showInstructions}
				onRequestClose={this.hideInstructions}
			>
				<Title fontSize="l">Great Success!</Title>
				<div style={{ padding: "20px " }}>
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

	storeConfig = () => (
		<ul style={{ listStyle: "none" }} class="wizard-hat">
			<li>
				<Button
					onClick={this.switchCountry.bind(this, "United States", {
						woocommerce_store_address: "537 Paper Street",
						woocommerce_store_address_2: "#34",
						woocommerce_store_city: "Wilmington",
						woocommerce_default_country: "US:DE",
						woocommerce_store_postcode: "19806",
						woocommerce_currency: "USD",
						woocommerce_price_thousand_sep: ",",
						woocommerce_price_decimal_sep: ".",
						woocommerce_weight_unit: "lbs",
						woocommerce_dimension_unit: "in",
					})}
					className="woo button"
					disabled={this.state.showSpinner}
				>
					Switch
					{"United States" === this.state.switchingTo
						? "ing"
						: null}{" "}
					Site to United States
					{"United States" === this.state.switchingTo
						? this.renderSpinner()
						: null}
				</Button>
			</li>
			<li>
				<Button
					onClick={this.switchCountry.bind(this, "Europe", {
						woocommerce_store_address: "Brederopad 77",
						woocommerce_store_address_2: "",
						woocommerce_store_city: "Delft",
						woocommerce_default_country: "NL",
						woocommerce_store_postcode: "2624 XR",
						woocommerce_currency: "EUR",
						woocommerce_price_thousand_sep: " ",
						woocommerce_price_decimal_sep: ",",
						woocommerce_weight_unit: "kg",
						woocommerce_dimension_unit: "cm",
					})}
					className="woo button"
					disabled={this.state.showSpinner}
				>
					Switch{"Europe" === this.state.switchingTo ? "ing" : null}{" "}
					Site to Europe
					{"Europe" === this.state.switchingTo
						? this.renderSpinner()
						: null}
				</Button>
			</li>
			<li>
				<Button
					onClick={this.switchCountry.bind(this, "Australia", {
						woocommerce_store_address: "28 Kaesler Road",
						woocommerce_store_address_2: "",
						woocommerce_store_city: "Mount Burr",
						woocommerce_default_country: "AU:SA",
						woocommerce_store_postcode: "5279",
						woocommerce_currency: "AUD",
						woocommerce_price_thousand_sep: " ",
						woocommerce_price_decimal_sep: ",",
						woocommerce_weight_unit: "kg",
						woocommerce_dimension_unit: "cm",
						woocommerce_dimension_unit: "in",
					})}
					className="woo button"
					disabled={this.state.showSpinner}
				>
					Switch
					{"Australia" === this.state.switchingTo ? "ing" : null} Site
					to Australia
					{"Australia" === this.state.switchingTo
						? this.renderSpinner()
						: null}
				</Button>
			</li>
			<li>
				<Button
					onClick={this.switchCountry.bind(this, "Canada", {
						woocommerce_store_address: "40 Bay St",
						woocommerce_store_address_2: "",
						woocommerce_store_city: "Toronto",
						woocommerce_default_country: "CA:ON",
						woocommerce_store_postcode: "M5J 2X2",
						woocommerce_currency: "CAD",
						woocommerce_price_thousand_sep: " ",
						woocommerce_price_decimal_sep: ",",
						woocommerce_weight_unit: "kg",
						woocommerce_dimension_unit: "cm",
					})}
					className="woo button"
					disabled={this.state.showSpinner}
				>
					Switch{"Canada" === this.state.switchingTo ? "ing" : null}{" "}
					Site to Canada
					{"Canada" === this.state.switchingTo
						? this.renderSpinner()
						: null}
				</Button>
			</li>
			<li>
				<Button
					onClick={this.switchCountry.bind(this, "U.K.", {
						woocommerce_store_address: "828 Church Lane",
						woocommerce_store_address_2: "",
						woocommerce_store_city: "London",
						woocommerce_default_country: "GB",
						woocommerce_store_postcode: "N86 2VU",
						woocommerce_currency: "GBP",
						woocommerce_price_thousand_sep: " ",
						woocommerce_price_decimal_sep: ",",
						woocommerce_weight_unit: "kg",
						woocommerce_dimension_unit: "cm",
					})}
					className="woo button"
					disabled={this.state.showSpinner}
				>
					Switch{"U.K." === this.state.switchingTo ? "ing" : null}{" "}
					Site to United Kingdom
					{"U.K." === this.state.switchingTo
						? this.renderSpinner()
						: null}
				</Button>
			</li>
			<li>
				<Button
					onClick={this.switchCountry.bind(this, "South Africa", {
						woocommerce_store_address: "2160 South St",
						woocommerce_store_address_2: "",
						woocommerce_store_city: "Voortrekkerhoogte",
						woocommerce_default_country: "ZA:GP",
						woocommerce_store_postcode: "0187",
						woocommerce_currency: "ZAR",
						woocommerce_price_thousand_sep: " ",
						woocommerce_price_decimal_sep: ",",
						woocommerce_weight_unit: "kg",
						woocommerce_dimension_unit: "cm",
					})}
					className="woo button"
					disabled={this.state.showSpinner}
				>
					Switch{"South Africa" === this.state.switchingTo ? "ing" : null}{" "}
					Site to South Africa
					{"South Africa" === this.state.switchingTo
						? this.renderSpinner()
						: null}
				</Button>
			</li>
		</ul>
	);

	Tools = () => (
		<ul style={{ listStyle: "none" }} class="wizard-hat">
			<li>
				<Button onClick={this.launchPostman} className="woo button">
					Launch Postman
				</Button>
			</li>
		</ul>
	);

	getPluginSelections() {
		ipcRenderer.send("get-premium-plugin-selections");
	}

	pluginManagementContent() {
		return new PluginManagement(this.props);
	}

	pluginUpdatesContent() {
		return new PluginUpdates(this.props);
	}

	blueprintImporterContent() {
		return <BlueprintUI {...this.props} />;
	}

	toolsContent() {
		return <ToolsUI {...this.props} />;
	}

	render() {
		if (
			"running" ===
			this.props.siteStatuses[this.props.match.params.siteID]
		) {
			return (
				<div style={{ flex: "1", overflowY: "auto", margin: "10px" }}>
					{this.renderInstructions()}
					{this.renderError()}
					<div id="wootertiarynav">
						<TertiaryNav>
							<TertiaryNavItem path="/title">
								<Title>Utilities</Title>
							</TertiaryNavItem>
							<TertiaryNavItem
								path="/shop-config"
								component={this.storeConfig}
							>
								Shop Base Address
							</TertiaryNavItem>
							<TertiaryNavItem
								path="/plugin-management"
								component={this.pluginManagementContent}
							>
								Plugin Installer
							</TertiaryNavItem>
							<TertiaryNavItem
								path="/plugin-updates"
								component={this.pluginUpdatesContent}
							>
								Plugin Updater
							</TertiaryNavItem>
							<TertiaryNavItem
								path="/blueprint-importer"
								component={this.blueprintImporterContent}
							>
								Blueprint Importer
							</TertiaryNavItem>
							<TertiaryNavItem
								path="/tools"
								component={this.toolsContent}
							>
								Tools
							</TertiaryNavItem>
						</TertiaryNav>
					</div>
				</div>
			);
		} else {
			return (
				<div style={{ flex: "1", overflowY: "auto", margin: "10px" }}>
					<Card>No interface while site not running.</Card>
				</div>
			);
		}
	}
}
