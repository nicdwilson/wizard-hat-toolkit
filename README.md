# WooCommerce Wizard Hat Toolkit

This [Local addon](https://localwp.com) provides a home base for learning how to troubleshoot and support WooCommerce. 

## Installation

### Pre built

Download the .tgz file from the most recent release tag and "Install from disk" on your instance of local.

## Post Install

### Setting Up the All-Plugins Repository

The Wizard Hat Toolkit requires access to the plugins repository to install WooCommerce Marketplace plugins. Follow these steps to set it up:

1. **Clone the plugins repository** to a location on your local machine:
   ```bash
   git clone <repository-url> /path/to/your/all-plugins
   ```
   Replace `<repository-url>` with the actual repository URL and `/path/to/your/all-plugins` with your desired local path.

   You can also use Github Desktop.

2. **Open the Wizard Hat Toolkit** in Local by navigating to any site and opening the "Plugin Installer" or "Plugin Updater" tab.

3. **Configure the repository path**:
   - If this is your first time, you'll be prompted to enter the repository path
   - Enter the full path to the cloned all-plugins repository directory
   - The toolkit will validate the path and initialize the repository

4. **Repository refresh**: On first launch of the installer or updater tabs, the toolkit will automatically refresh the repository to ensure you have the latest plugin information. This may take a moment, and you'll see a progress indicator.

**Note**: The repository path is saved and will be remembered for future use. You can update it at any time by accessing the repository setup interface.

## Features

### Blueprint Importer
Import WooCommerce Blueprint files to quickly configure your site with predefined plugins, themes, and settings. This feature allows you to:
- Upload and validate blueprint JSON files
- Preview what will be imported before applying changes
- Handle conflicts with existing installations
- Configure import settings and preferences
- Track import progress and handle errors

### Plugin Management
Install and manage WooCommerce plugins from various sources:
- WordPress.org plugins
- Premium WooCommerce marketplace plugins

### Theme Management
Install and manage WooCommerce themes from only one source:
- WordPress.org themes

### Site Configuration
Quickly switch between different country/locale configurations for WooCommerce settings.

### Plugin Updates
Automated updates for marketplace plugins with conflict detection and resolution.

## Blueprint Format

WooCommerce Blueprints are JSON files that define a complete WooCommerce store configuration.
## License

GPL
