# Installation Guide - Wizard Hat Toolkit v1.5.0

## Quick Installation

### Method 1: Install from Disk (Recommended)

1. **Download** the `wizard-hat-toolkit-1.5.0.tgz` file
2. **Open Local** and navigate to your site
3. **Go to Add-ons** in the left sidebar
4. **Click "Install from disk"**
5. **Select** the `wizard-hat-toolkit-1.5.0.tgz` file
6. **Enable** the addon when prompted

### Method 2: Manual Installation

1. **Extract** the `wizard-hat-toolkit-1.5.0.tgz` file
2. **Copy** the extracted folder to your Local addons directory:
   - **macOS**: `~/Library/Application Support/Local/addons`
   - **Windows**: `C:\Users\username\AppData\Roaming\Local\addons`
   - **Linux**: `~/.config/Local/addons`
3. **Rename** the folder to `wizard-hat-toolkit`
4. **Restart Local**
5. **Enable** the addon in Local

## Post-Installation Setup

### 1. GitHub Token Configuration

Some features require access to private GitHub repositories:

1. **Go to** [GitHub Settings > Tokens](https://github.com/settings/tokens)
2. **Create a new token** with the `repo` scope
3. **Open Local** and navigate to your site
4. **Click on "Wizard Hat Toolkit"** in the addons section
5. **Enter your GitHub token** when prompted

### 2. Verify Installation

1. **Navigate** to your site in Local
2. **Click on "Wizard Hat Toolkit"** in the addons section
3. **Verify** you can see all tabs:
   - Utilities
   - Jurassic Tube
   - Shop Config Options
   - Plugin Management
   - Plugin Updates
   - **Blueprint Importer** (New!)

## New Feature: Blueprint Importer

### Getting Started with Blueprints

1. **Click on "Blueprint Importer"** tab
2. **Upload** a blueprint file (use `sample-blueprint.json` for testing)
3. **Preview** what will be imported
4. **Configure** import settings if needed
5. **Import** the blueprint

### Sample Blueprint

Use the included `sample-blueprint.json` to test the new functionality:

- **WooCommerce** plugin installation
- **Payment gateways** (Stripe, PayPal)
- **Storefront theme**
- **Basic store settings**

## Troubleshooting

### Common Issues

#### Installation Fails
- Ensure Local is closed during manual installation
- Check file permissions on the addons directory
- Verify the extracted folder structure is correct

#### Addon Not Appearing
- Restart Local completely
- Check the addons directory path
- Verify the folder name is exactly `wizard-hat-toolkit`

#### GitHub Token Issues
- Ensure token has `repo` scope
- Check token hasn't expired
- Verify token is valid in GitHub settings

#### Blueprint Import Errors
- Validate JSON format of blueprint files
- Check file size (max 10MB)
- Ensure site is running before importing
- Review error messages for specific issues

### Getting Help

- **Check logs** in Local for detailed error information
- **Review documentation** in `BLUEPRINT_IMPORTER.md`
- **Test with sample blueprint** first
- **Report issues** on the GitHub repository

## System Requirements

- **Local** 5.x or higher
- **Node.js** (for building from source)
- **GitHub account** (for premium plugin access)

## Features Overview

### Core Features
- **Plugin Management**: Install WooCommerce plugins from multiple sources
- **Theme Management**: Install WooCommerce themes
- **Site Configuration**: Quick country/locale switching
- **Plugin Updates**: Automated marketplace plugin updates

### New in v1.5.0
- **Blueprint Importer**: Import complete store configurations
- **Conflict Resolution**: Handle installation conflicts intelligently
- **Import Preview**: See what will be imported before applying
- **Settings Management**: Configure import preferences
- **Progress Tracking**: Real-time import progress

## Uninstallation

1. **Disable** the addon in Local
2. **Delete** the `wizard-hat-toolkit` folder from your addons directory
3. **Restart Local**

## Support

For support and feature requests:
- **GitHub Issues**: Report bugs and request features
- **Documentation**: Check included documentation files
- **Community**: Join the Local community for help

---

**Version**: 1.5.0  
**Release Date**: September 2024  
**Compatibility**: Local 5.x+
