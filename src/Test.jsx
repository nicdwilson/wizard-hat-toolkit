import React, { Component } from "react";
import { ipcRenderer } from "electron";
//import Select from "react-select";
//const { exec } = require("child_process");
// https://getflywheel.github.io/local-addon-api/modules/_local_renderer_.html
import * as LocalRenderer from '@getflywheel/local/renderer';
// https://github.com/getflywheel/local-components
/*import {
	Button,
	FlyModal,
	Title,
	Text,
	Spinner,
	TertiaryNav,
	TertiaryNavItem,
	Card,
	InputPasswordToggle,
	Divider,
	List,
	TextButton,
	Banner,
	AdvancedToggle,
	Stepper,
	Step,
} from "@getflywheel/local-components";*/

import {LoadingIndicator, TableList, TableListRow, Text, TextButton} from '@getflywheel/local-components';

export default class Wizardhat extends Component {
	constructor(props) {
		super(props);
		this.state = {
			siteId: props.match.params.siteID,
			showInstructions: false,
			showError: false,
			localeSwitchedTo: "",
			showSpinner: false,
			tokenIsValid: false,
			dayContent: 1,
			rootPath: props.sites[props.match.params.siteID].path,
			premiumPluginSelections: [],
			installPluginButton: true,
			pluginsToInstall: [],
			selectedPlugins: null,
		};

		/*this.hideInstructions = this.hideInstructions.bind(this);
		this.hideError = this.hideError.bind(this);
		this.showSpinner = this.showSpinner.bind(this);
		this.testRequest = this.testRequest.bind(this);
		this.launchPostman = this.launchPostman.bind(this);
		this.installWoocommerce = this.installWoocommerce.bind(this);
		this.handlePluginSelectionChange =
			this.handlePluginSelectionChange.bind(this);
		this.installPlugins = this.installPlugins.bind(this);
		this.installBundleAddonPlugins =
			this.installBundleAddonPlugins.bind(this);*/
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

		ipcRenderer.on("gh-token", (event, args) => {
			this.setState({
				tokenIsValid: args.valid,
			});
			ipcRenderer.send("get-premium-plugin-selections");
		});

		ipcRenderer.on("premium-plugin-selections", (event, args) => {
			this.setState({
				premiumPluginSelections: args,
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
		});

		ipcRenderer.on("plugin-install-done", () => {
			this.setState({
				showSpinner: false,
			});
		});
		
		ipcRenderer.send("validate-token");
	}

	componentWillUnmount() {
		ipcRenderer.removeAllListeners("instructions");
		ipcRenderer.removeAllListeners("error");
		ipcRenderer.removeAllListeners("gh-token");
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

	weekContent(week) {
		let weekContent;
		if (2 === week) {
			weekContent = () => (
				<div>
					<div id="week-1-content">
						<TextButton
							onClick={() => {
								this.setState({ dayContent: 1 });
							}}
						>
							Day One
						</TextButton>
						<TextButton
							onClick={() => {
								this.setState({ dayContent: 2 });
							}}
						>
							Day Two
						</TextButton>
						<TextButton
							onClick={() => {
								this.setState({ dayContent: 3 });
							}}
						>
							Day Three
						</TextButton>
						<TextButton
							onClick={() => {
								this.setState({ dayContent: 4 });
							}}
						>
							Day Four
						</TextButton>
						<TextButton
							onClick={() => {
								this.setState({ dayContent: 5 });
							}}
						>
							Day Five
						</TextButton>
						{this.dayContent(2)}
					</div>
				</div>
			);
			return weekContent;
		}
		return null;
	}

	installBundleAddonPlugins() {
		console.info("isntalling bundle plugins I guess");
		this.setState({
			showSpinner: true,
		});
		ipcRenderer.send("install-bundle-addon-plugins", this.state.siteId);
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

	installWoocommerce() {
		this.setState({
			showSpinner: true,
		});
		ipcRenderer.send(
			"install-woocommerce",
			this.state.siteId,
			this.state.rootPath
		);
	}

	dayContent(week) {
		let todayContent;
		switch (week) {
			case 2:
				switch (this.state.dayContent) {
					case 1:
						return (
							<Card
								title={
									<Title style={{ margin: "1em" }}>
										Day 1
									</Title>
								}
								content={
									<div>
										<p>
											Today you will be installing
											WooCommerce and demo content and
											becoming familiar with the settings.
										</p>
										<p>
											If you haven't already installed
											WooCommerce or imported the demo
											content, you can use the button
											below.
										</p>
										<Divider
											style={{
												width: "100%",
												float: "left",
												margin: "1em",
											}}
										/>

										<p>
											<Button
												className="woo button"
												onClick={
													this.installWoocommerce
												}
											>
												Install WooCommerce & Demo
												Content
												{this.renderSpinner()}
											</Button>
										</p>
										<Divider
											style={{
												width: "100%",
												float: "left",
												margin: "1em",
											}}
										/>

										<div
											id="list"
											style={{
												width: "100%",
												float: "left",
											}}
										>
											<List
												style={{ width: "100%" }}
												bullets={true}
												headerHasDivider={true}
												headerText={
													<a
														href={`http://${
															this.props.sites[
																this.props.match
																	.params
																	.siteID
															].domain
														}/wp-admin/admin.php?page=wc-settings`}
													>
														Visit WooCommerce
														Settings Page
													</a>
												}
												listItemFontWeight="300"
											>
												<li>
													<a href="https://woocommerce.com/document/configuring-woocommerce-settings/#general-settings">
														General Settings
														Documentation
													</a>
												</li>
												<li>
													<a href="https://wooniversity.wordpress.com/onboarding/woo-crash-course-woocommerce-101/#review-general-settings">
														Review General Settings
													</a>
												</li>
											</List>
											<List
												style={{ width: "100%" }}
												bullets={true}
												headerHasDivider={true}
												headerText={
													<a
														href={`http://${
															this.props.sites[
																this.props.match
																	.params
																	.siteID
															].domain
														}/wp-admin/admin.php?page=wc-settings&tab=products`}
													>
														Visit WooCommerce
														Product Settings Page
													</a>
												}
												listItemFontWeight="300"
											>
												<li>
													<a href="https://woocommerce.com/document/configuring-woocommerce-settings/#product-settings">
														Products Settings
														Documentation
													</a>
												</li>
												<li>
													<a href="https://wooniversity.wordpress.com/onboarding/woo-crash-course-woocommerce-101/#review-product-settings">
														Review Product Settings
													</a>
												</li>
											</List>
											<List
												style={{ width: "100%" }}
												bullets={true}
												headerHasDivider={true}
												headerText={
													<a
														href={`http://${
															this.props.sites[
																this.props.match
																	.params
																	.siteID
															].domain
														}/wp-admin/admin.php?page=wc-settings&tab=products&section=inventory`}
													>
														Visit Inventory Options
														Page
													</a>
												}
												listItemFontWeight="300"
											>
												<li>
													<a href="https://woocommerce.com/document/configuring-woocommerce-settings/#products-inventory-options">
														Inventory Options
														Documentation
													</a>
												</li>
												<li>
													<a href="https://wooniversity.wordpress.com/onboarding/woo-crash-course-woocommerce-101/#review-inventory-options">
														Review Inventory Options
													</a>
												</li>
											</List>
											<List
												style={{ width: "100%" }}
												bullets={true}
												headerHasDivider={true}
												headerText={
													<a
														href={`http://${
															this.props.sites[
																this.props.match
																	.params
																	.siteID
															].domain
														}/wp-admin/admin.php?page=wc-settings&tab=products&section=downloadable`}
													>
														Visit Downloadable
														Products Settings
													</a>
												}
												listItemFontWeight="300"
											>
												<li>
													<a href="https://woocommerce.com/document/configuring-woocommerce-settings/#products-downloadable-products">
														Downloadable Products
														Documentation
													</a>
												</li>
												<li>
													<a href="https://wooniversity.wordpress.com/onboarding/woo-crash-course-woocommerce-101/#review-downloadable-product-settings">
														Review Downloadable
														Products Settings
													</a>
												</li>
											</List>
											<List
												style={{ width: "100%" }}
												bullets={true}
												headerHasDivider={true}
												headerText={
													<a
														href={`http://${
															this.props.sites[
																this.props.match
																	.params
																	.siteID
															].domain
														}/wp-admin/admin.php?page=wc-settings&tab=tax`}
													>
														Visit Tax Settings
													</a>
												}
												listItemFontWeight="300"
											>
												<li>
													<a href="https://woocommerce.com/document/setting-up-taxes-in-woocommerce/">
														Tax Settings
														Documentation
													</a>
												</li>
												<li>
													<a href="https://wooniversity.wordpress.com/onboarding/woo-crash-course-woocommerce-101/#review-tax-settings">
														Review Tax Settings
													</a>
												</li>
											</List>
										</div>
									</div>
								}
							/>
						);
					case 2:
						return (
							<Card
								title={
									<Title style={{ margin: "1em" }}>
										Day 2
									</Title>
								}
								content={
									<div>
										<p>
											Today you will be reviewing the
											WooCommerce system status report and
											the system tools included with
											WooCommerce.
										</p>
										<Divider
											style={{
												width: "100%",
												float: "left",
												margin: "1em",
											}}
										/>

										<div
											id="list"
											style={{
												width: "100%",
												float: "left",
											}}
										>
											<List
												style={{ width: "100%" }}
												bullets={true}
												headerHasDivider={true}
												headerText={
													<a
														href={`http://${
															this.props.sites[
																this.props.match
																	.params
																	.siteID
															].domain
														}/wp-admin/admin.php?page=wc-status`}
													>
														Visit WooCommerce System
														Status Report
													</a>
												}
												listItemFontWeight="300"
											>
												<li>
													<a href="https://woocommerce.com/document/understanding-the-woocommerce-system-status-report/">
														Understanding the
														WooCommerce System
														Status Report
													</a>
												</li>
												<li>
													<a href="https://wooniversity.wordpress.com/troubleshooting/the-system-status-report-ssr/">
														The System Status Report
														(SSR)
													</a>
												</li>
											</List>
											<List
												style={{ width: "100%" }}
												bullets={true}
												headerHasDivider={true}
												headerText={
													<a
														href={`http://${
															this.props.sites[
																this.props.match
																	.params
																	.siteID
															].domain
														}/wp-admin/admin.php?page=wc-status&tab=tools`}
													>
														Visit WooCommerce System
														Tools
													</a>
												}
												listItemFontWeight="300"
											>
												<li>
													<a href="https://woocommerce.com/document/understanding-the-woocommerce-system-status-report/#section-16">
														System Tools
														Documentation
													</a>
												</li>
												<li>
													<a href="https://wooniversity.wordpress.com/troubleshooting/woocommerce-system-tools/">
														WooCommerce System Tools
													</a>
												</li>
											</List>
										</div>
									</div>
								}
							/>
						);
					case 3:
						return (
							<Card
								title={
									<Title style={{ margin: "1em" }}>
										Day 3
									</Title>
								}
								content={
									<div>
										<p>
											Today you will be diving into
											extensions on the WooCommerce
											Marketplace with a focus on bundles
											and add-ons.
										</p>
										<p>
											Use the button below to install all
											of the necessary plugins for today's
											agenda.
											<Banner
												variant="warning"
												icon="warning"
											>
												<strong>Note:</strong> Gravity
												Forms Product Add-ons requires
												the premium Gravity Forms
												plugin. See{" "}
												<a href="https://mc.a8c.com/secret-store/?secret_id=4889">
													here
												</a>
												. This will need to be installed
												manually.
											</Banner>
										</p>
										<Divider
											style={{
												width: "100%",
												float: "left",
												margin: "1em",
											}}
										/>

										<p>
											<Button
												onClick={this.installAndActivatePlugins.bind(
													this,
													[
														"woocommerce-chained-products",
														"woocommerce-product-bundles",
														"woocommerce-force-sells",
														"woocommerce-composite-products",
														"woocommerce-mix-and-match-products",
														"woocommerce-product-addons",
														"woocommerce-checkout-add-ons",
														"woocommerce-gravityforms-product-addons",
														"woocommerce-ninjaforms-product-addons",
														"ninja-forms",
													]
												)}
												className="woo button"
											>
												Install Plugins
												{this.renderSpinner()}
											</Button>
										</p>
									</div>
								}
							/>
						);
					case 4:
						return (
							<Card
								title={
									<Title style={{ margin: "1em" }}>
										Day 4
									</Title>
								}
								content={
									<div>
										<p>
											You'll be working with
											WooCommerce.com accounts today. The
											most relevant part of your test site
											would be the WooCommerce.com
											extensions tab and subscription
											management.
										</p>
										<div>
											<List
												style={{ width: "100%" }}
												bullets={true}
												headerHasDivider={true}
												headerText={
													<a
														href={`http://${
															this.props.sites[
																this.props.match
																	.params
																	.siteID
															].domain
														}/wp-admin/admin.php?page=wc-addons&section=helper`}
													>
														Visit 'My Subscriptions'
													</a>
												}
												listItemFontWeight="300"
											>
												<li>
													<a href="https://woocommerce.com/document/managing-woocommerce-com-subscriptions/">
														Managing WooCommerce.com
														Subscriptions
													</a>
												</li>
												<li>
													<a href="https://wooniversity.wordpress.com/woocommerce-com/woocommerce-accounts/extending-subscriptions/customer-options-for-managing-wccom-subscriptions/">
														Customer Options for
														Managing WCcom
														Subscriptions
													</a>
												</li>
											</List>
										</div>
									</div>
								}
							/>
						);
					case 5:
						return (
							<Card
								title={
									<Title style={{ margin: "1em" }}>
										Day 5
									</Title>
								}
								content={
									<div>
										<p>
											Today you will be working with the
											Storefront theme, child themes, and
											associated plugins as well as
											importing/exporting.
										</p>
										<p>
											Use the button below to install all
											of the necessary plugins for today's
											agenda.
										</p>
										<Divider
											style={{
												width: "100%",
												float: "left",
												margin: "1em",
											}}
										/>

										<p>
											<Button
												onClick={this.installAndActivatePlugins.bind(
													this,
													[
														"storefront-homepage-contact-section",
														"storefront-hamburger-menu",
														"storefront-product-sharing",
														"storefront-footer-bar",
														"storefront-powerpack",
														"storefront-mega-menus",
														"storefront-reviews",
														"storefront-pricing-tables",
														"storefront-product-hero",
														"storefront-blog-customiser",
														"storefront-parallax-hero",
														"woocommerce-product-csv-import-suite",
													]
												)}
												className="woo button"
											>
												Install Plugins
												{this.renderSpinner()}
											</Button>
										</p>
									</div>
								}
							/>
						);
					default:
						return null;
				}
		}
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
				>
					Switch Site to United States
					{this.renderSpinner()}
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
				>
					Switch Site to Europe
					{this.renderSpinner()}
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
				>
					Switch Site to Australia
					{this.renderSpinner()}
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
				>
					Switch Site to Canada
					{this.renderSpinner()}
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

	Excercises = () => (
		<div
			style={{
				flexGrow: "1",
				overflow: "auto",
				position: "relative",
			}}
			class="woo"
		>
			<Card
				style={{ zIndex: 9999, flexGrow: "1", overflow: "visible" }}
			></Card>
			<Divider />
			<Card style={{ zIndex: 9999, flexGrow: "1", overflow: "visible" }}>
				<ul style={{ listStyle: "none" }} class="wizard-hat">
					<li>
						<Button
							onClick={this.testRequest}
							className="woo button"
						>
							Test d/l install plugin
						</Button>
					</li>
				</ul>
			</Card>
			<Divider />

			<Card style={{ zIndex: 9999, flexGrow: "1", overflow: "visible" }}>
				<p>
					<h2>Email Troubleshooting</h2>
				</p>
				<p>
					A WooCommerce user has submitted a ticket letting us know
					that the WooCommerce order emails are not being sent as
					expected.
				</p>
				<AdvancedToggle
					headingText="Step 1"
				>
					<h3>Are WordPress emails working?</h3>
					<p>
						Is this a case of not sending emails or not receiving
						emails? At the same time, is WordPress sending emails?
						We can check this by using the{" "}
						<a href="https://wordpress.org/plugins/wp-test-email/">
							test email plugin
						</a>{" "}
						in conjunction with an{" "}
						<a href="https://wordpress.org/plugins/wp-mail-logging/">
							email logging plugin
						</a>
						. You can press the button below to install both of
						those plugins.
					</p>
					<p>
						<Button
							onClick={() => {console.info("button clickt")}}
							className="woo button"
						>
							{this.renderSpinner()}
							Install Plugins
						</Button>
					</p>
				</AdvancedToggle>

				<Stepper>
					<Step
						number={1}
						done={false}
						active={this.stepIsActive("email")}
					/>
					<Step number={2} done={false} active={false} />
					<Step number={3} done={false}>
						Setup WordPress
					</Step>
				</Stepper>
			</Card>
			<Divider />
			{/*<Card>
				Install & Activate Popular Extensions
				<Button className="woo button">Install</Button>
		</Card>*/}
		</div>
	);

	tokenInput = () => (
		<div
			style={{
				flexGrow: "1",
				overflow: "auto",
				position: "relative",
			}}
			class="woo gh-token"
		>
			<Card>
				<p>
					This content requires a valid{" "}
					<a href="https://github.com/settings/tokens">
						GitHub token
					</a>{" "}
					with 'repo' scope enabled.
				</p>
				<p>Please enter a valid token to continue.</p>
				<InputPasswordToggle
					onChange={(event) =>
						this.maybeSaveToken(event.target.value)
					}
					onBlur={(event) => this.maybeSaveToken(event.target.value)}
				/>
			</Card>
		</div>
	);

	getPluginSelections() {
		ipcRenderer.send("get-premium-plugin-selections");
	}

	pluginManagement = () => (
		<div
			style={{
				flexGrow: "1",
				overflow: "auto",
				position: "relative",
			}}
			class="woo"
		>
			<Card style={{ zIndex: 9999, flexGrow: "1", overflow: "visible" }}>
				A la Carte plugin installation
				<p style={{ width: "90%", margin: "1em" }}>
					<Select
						options={this.state.premiumPluginSelections}
						placeholder={"Select plugin to install..."}
						onChange={this.handlePluginSelectionChange}
						name="plugin_slug"
						style={{
							zIndex: 9999,
							flexGrow: "1",
							overflow: "visible",
						}}
						value={this.state.selectedPlugins}
						isMulti
					/>
				</p>
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
			{/*<Card>
				Install & Activate Popular Extensions
				<Button className="woo button">Install</Button>
					</Card>*/}
		</div>
	);

	render() {
		return( <div>hello world<p>Hello button</p></div>);
	}
}