import React, { Component } from "react";
import { ipcRenderer } from "electron";
import {
	Button,
	FlyModal,
	Title,
	Text,
	Card,
	BasicInput,
} from "@getflywheel/local-components";

interface RepositorySetupState {
	isOpen: boolean;
	repositoryPath: string;
	isValidating: boolean;
	validationError: string | null;
	validationSuccess: boolean;
}

export default class RepositorySetup extends Component<any, RepositorySetupState> {
	constructor(props: any) {
		super(props);
		this.state = {
			isOpen: true,
			repositoryPath: "",
			isValidating: false,
			validationError: null,
			validationSuccess: false,
		};
		this.handlePathChange = this.handlePathChange.bind(this);
		this.handleValidate = this.handleValidate.bind(this);
		this.handleSave = this.handleSave.bind(this);
	}

	componentDidMount() {
		ipcRenderer.on("repository-path-validated", (event, data) => {
			if (data.valid) {
				this.setState({
					validationSuccess: true,
					validationError: null,
					isValidating: false,
				});
			} else {
				this.setState({
					validationSuccess: false,
					validationError: data.error || "Invalid repository path",
					isValidating: false,
				});
			}
		});
	}

	componentWillUnmount() {
		ipcRenderer.removeAllListeners("repository-path-validated");
	}

	handlePathChange(event: React.ChangeEvent<HTMLInputElement>) {
		this.setState({
			repositoryPath: event.target.value,
			validationError: null,
			validationSuccess: false,
		});
	}

	handleValidate() {
		if (!this.state.repositoryPath.trim()) {
			this.setState({
				validationError: "Please enter a repository path",
			});
			return;
		}

		this.setState({
			isValidating: true,
			validationError: null,
			validationSuccess: false,
		});

		ipcRenderer.send("validate-repository-path", this.state.repositoryPath);
	}

	handleSave() {
		if (!this.state.validationSuccess) {
			this.setState({
				validationError: "Please validate the repository path first",
			});
			return;
		}

		ipcRenderer.send("save-repository-path", this.state.repositoryPath);
		this.setState({
			isOpen: false,
		});
	}

	render() {
		return (
			<FlyModal
				isOpen={this.state.isOpen}
				onRequestClose={() => {}} // Prevent closing until setup is complete
			>
				<Title>Repository Setup Required</Title>
				<div style={{ padding: "20px", maxWidth: "600px" }}>
					<Text style={{ marginBottom: "1em", fontSize: "14px" }}>
						Before using the plugin manager, you need to set up your local copy of the all-plugins repository.
					</Text>

					<Card style={{ backgroundColor: "#e8ffe8", padding: "1em", marginBottom: "1em" }}>
						<Title style={{ marginBottom: "0.5em", fontSize: "16px" }}>
							Option 1: GitHub Desktop (Recommended for Beginners)
						</Title>
						<ol style={{ paddingLeft: "1.5em", lineHeight: "1.6" }}>
							<li style={{ marginBottom: "0.5em" }}>
								<Text style={{ fontSize: "12px" }}>
									<strong>Download GitHub Desktop:</strong> Go to{" "}
									<a href="https://desktop.github.com" target="_blank" style={{ color: "#0066cc" }}>
										desktop.github.com
									</a>{" "}
									and download the app for Mac.
								</Text>
							</li>
							<li style={{ marginBottom: "0.5em" }}>
								<Text style={{ fontSize: "12px" }}>
									<strong>Install and open GitHub Desktop:</strong> Install the app and launch it.
								</Text>
							</li>
							<li style={{ marginBottom: "0.5em" }}>
								<Text style={{ fontSize: "12px" }}>
									<strong>Sign in to GitHub:</strong> When prompted, click "Sign in to GitHub.com" and follow the prompts to connect your GitHub account.
								</Text>
							</li>
							<li style={{ marginBottom: "0.5em" }}>
								<Text style={{ fontSize: "12px" }}>
									<strong>Clone the repository:</strong> Click "Clone a Repository from the Internet..." (or File &gt; Clone Repository).
									<br />
									In the URL tab, enter:{" "}
									<code style={{ backgroundColor: "#e8e8e8", padding: "0.2em 0.4em", borderRadius: "3px" }}>
										https://github.com/woocommerce/all-plugins.git
									</code>
									<br />
									Choose where to save it on your computer (note this location!), then click "Clone".
								</Text>
							</li>
							<li style={{ marginBottom: "0.5em" }}>
								<Text style={{ fontSize: "12px" }}>
									<strong>Find the repository path:</strong> In GitHub Desktop, go to Repository &gt; "Show in Finder" to see where it was saved.
									<br />
									Right-click the "all-plugins" folder and select "Get Info" to see the full path.
									<br />
									Example: <code style={{ backgroundColor: "#e8e8e8", padding: "0.2em 0.4em", borderRadius: "3px" }}>/Users/yourname/Documents/GitHub/all-plugins</code>
								</Text>
							</li>
							<li>
								<Text style={{ fontSize: "12px" }}>
									<strong>Enter the path below:</strong> Paste the full path to your local all-plugins repository.
								</Text>
							</li>
						</ol>
					</Card>

					<Card style={{ backgroundColor: "#f0f8ff", padding: "1em", marginBottom: "1em" }}>
						<Title style={{ marginBottom: "0.5em", fontSize: "16px" }}>
							Option 2: Command Line (For Advanced Users)
						</Title>
						<ol style={{ paddingLeft: "1.5em", lineHeight: "1.6" }}>
							<li style={{ marginBottom: "0.5em" }}>
								<Text style={{ fontSize: "12px" }}>
									<strong>Open Terminal:</strong> Open the Terminal application on your Mac.
								</Text>
							</li>
							<li style={{ marginBottom: "0.5em" }}>
								<Text style={{ fontSize: "12px" }}>
									<strong>Clone the repository:</strong> Navigate to where you want to clone the repository, then run:
									<br />
									<code style={{ backgroundColor: "#e8e8e8", padding: "0.2em 0.4em", borderRadius: "3px", display: "block", marginTop: "0.5em" }}>
										git clone https://github.com/woocommerce/all-plugins.git
									</code>
								</Text>
							</li>
							<li style={{ marginBottom: "0.5em" }}>
								<Text style={{ fontSize: "12px" }}>
									<strong>Note the repository path:</strong> After cloning, note the full path to the repository folder.
									<br />
									Example: <code style={{ backgroundColor: "#e8e8e8", padding: "0.2em 0.4em", borderRadius: "3px" }}>/Users/yourname/all-plugins</code>
								</Text>
							</li>
							<li>
								<Text style={{ fontSize: "12px" }}>
									<strong>Enter the path below:</strong> Paste the full path to your local all-plugins repository.
								</Text>
							</li>
						</ol>
					</Card>

					<div style={{ marginBottom: "1em" }}>
						<Text style={{ marginBottom: "0.5em", fontWeight: "medium", fontSize: "12px" }}>
							Repository Path:
						</Text>
						<Text style={{ fontSize: "11px", color: "#666", marginBottom: "0.25em" }}>
							Example: /Users/yourname/all-plugins
						</Text>
						<BasicInput
							value={this.state.repositoryPath}
							onChange={this.handlePathChange}
							style={{ width: "100%" }}
						/>
					</div>

					{this.state.validationError && (
						<Card style={{ backgroundColor: "#fff5f5", padding: "0.75em", marginBottom: "1em" }}>
							<Text style={{ color: "#cc0000", fontSize: "12px" }}>
								{this.state.validationError}
							</Text>
						</Card>
					)}

					{this.state.validationSuccess && (
						<Card style={{ backgroundColor: "#f0fff4", padding: "0.75em", marginBottom: "1em" }}>
							<Text style={{ color: "#006600", fontSize: "12px" }}>
								✓ Repository path is valid! You can now save and continue.
							</Text>
						</Card>
					)}

					<div style={{ display: "flex", gap: "0.5em", justifyContent: "flex-end" }}>
						<Button
							onClick={this.handleValidate}
							disabled={this.state.isValidating || !this.state.repositoryPath.trim()}
						>
							{this.state.isValidating ? "Validating..." : "Validate Path"}
						</Button>
						<Button
							onClick={this.handleSave}
							disabled={!this.state.validationSuccess}
							style={{ backgroundColor: "#0066cc", color: "white" }}
						>
							Save & Continue
						</Button>
					</div>
				</div>
			</FlyModal>
		);
	}
}

