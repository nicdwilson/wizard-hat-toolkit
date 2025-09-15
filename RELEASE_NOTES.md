# Release Notes - Wizard Hat Toolkit v1.5.0

## 🎉 New Feature: WooCommerce Blueprint Importer

This major release introduces the **WooCommerce Blueprint Importer**, a powerful new feature that allows you to quickly configure WooCommerce stores with predefined setups.

### ✨ What's New

#### Blueprint Importer
- **File Upload & Validation**: Upload and validate JSON blueprint files
- **Import Preview**: Preview what will be imported before applying changes
- **Conflict Resolution**: Handle conflicts with existing installations intelligently
- **Settings Management**: Configure import preferences and conflict handling
- **Progress Tracking**: Real-time import progress with detailed error reporting
- **Sample Blueprint**: Included sample blueprint for testing and reference

#### Enhanced Features
- **Plugin Management**: Improved plugin installation from multiple sources
- **Theme Management**: Enhanced theme installation capabilities
- **Site Configuration**: Streamlined country/locale switching
- **Plugin Updates**: Better automated update handling

### 🔧 Technical Improvements

#### Architecture
- **Modular Design**: Clean separation of concerns with reusable components
- **TypeScript**: Fully typed implementation for better maintainability
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Security**: Validation and sanitization of imported data
- **Performance**: Asynchronous processing with progress tracking

#### Integration
- **Local Addon API**: Seamless integration with Local's addon system
- **WP-CLI Integration**: Leverages existing WP-CLI functionality
- **GitHub Integration**: Uses existing GitHub token authentication
- **Existing Features**: Builds upon current plugin/theme management

### 📋 Blueprint Format

Blueprints are JSON files that define complete store configurations:

```json
{
  "version": "1.0",
  "name": "Store Configuration",
  "plugins": [...],
  "themes": [...],
  "settings": {
    "woocommerce": {...},
    "wordpress": {...},
    "custom": {...}
  }
}
```

### 🚀 Getting Started

1. **Install**: Download the latest version from the releases page
2. **Enable**: Activate the addon in Local
3. **Configure**: Set up your GitHub token for premium plugin access
4. **Import**: Use the Blueprint Importer tab to upload and import blueprints

### 📚 Documentation

- **README**: Updated with comprehensive feature documentation
- **Blueprint Guide**: Detailed guide in `BLUEPRINT_IMPORTER.md`
- **Sample Blueprint**: Example configuration in `sample-blueprint.json`

### 🔄 Migration

This release is fully backward compatible. Existing installations will automatically gain access to the new Blueprint Importer feature.

### 🐛 Bug Fixes

- Fixed TypeScript compilation issues
- Improved error handling in plugin installation
- Enhanced UI component compatibility
- Resolved validation edge cases

### 📦 Installation

#### Pre-built Package
Download `wizard-hat-toolkit-1.5.0.tgz` from the releases page and install via "Install from disk" in Local.

#### Build from Source
```bash
git clone https://github.com/WillBrubaker/wizard-hat-toolkit.git
cd wizard-hat-toolkit
npm install
npm run build
npm run dist
```

### 🎯 Use Cases

- **Team Collaboration**: Share store configurations via blueprint files
- **Development Workflows**: Quickly set up consistent development environments
- **Testing**: Create reproducible test environments
- **Onboarding**: Streamline new team member setup
- **Client Handoffs**: Provide complete store configurations to clients

### 🔮 Future Roadmap

- Blueprint export functionality
- Blueprint sharing via GitHub integration
- Template library integration
- Advanced conflict resolution options
- Batch import capabilities

### 💬 Feedback

We'd love to hear your feedback on this new feature! Please:
- Test the Blueprint Importer with your workflows
- Report any issues or suggestions
- Share your blueprint configurations with the community

### 🙏 Acknowledgments

This feature was inspired by the Studio application's blueprint functionality and brings similar capabilities to the Local environment.

---

**Full Changelog**: https://github.com/WillBrubaker/wizard-hat-toolkit/compare/v1.4.0...v1.5.0
