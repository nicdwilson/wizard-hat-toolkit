# WooCommerce Blueprint Importer

The Blueprint Importer is a new feature in the Wizard Hat Toolkit that allows you to import WooCommerce Blueprint files to quickly configure your site with predefined plugins, themes, and settings.

## Overview

WooCommerce Blueprints are JSON files that define a complete store configuration, including:
- Plugins to install and activate
- Themes to install and activate
- WooCommerce settings
- WordPress settings
- Custom configurations

This feature is inspired by the Studio application's blueprint functionality and provides similar capabilities within the Local environment.

## Features

### File Upload and Validation
- Upload `.json` blueprint files
- Automatic validation of blueprint structure
- Error reporting for invalid files
- Warning notifications for potential issues

### Import Preview
- Preview what will be imported before applying changes
- See plugins, themes, and settings that will be configured
- Review conflicts with existing installations

### Conflict Resolution
- Detect existing plugins, themes, and settings
- Configure how to handle conflicts:
  - Overwrite existing items
  - Skip conflicting items
  - Show warnings for manual review

### Import Settings
- Auto-overwrite plugins
- Auto-overwrite themes
- Auto-overwrite settings
- Skip conflicts automatically
- Backup before import
- Notifications on completion

### Progress Tracking
- Real-time import progress
- Detailed error reporting
- Success/failure notifications

## Blueprint Format

Blueprints are JSON files with the following structure:

```json
{
  "version": "1.0",
  "name": "Blueprint Name",
  "description": "Blueprint description",
  "author": "Author name",
  "created": "2024-01-15T10:00:00Z",
  "plugins": [
    {
      "name": "Plugin Name",
      "slug": "plugin-slug",
      "version": "latest",
      "active": true,
      "source": "wordpress.org",
      "settings": {}
    }
  ],
  "themes": [
    {
      "name": "Theme Name",
      "slug": "theme-slug",
      "version": "latest",
      "active": true,
      "source": "wordpress.org",
      "settings": {}
    }
  ],
  "settings": {
    "woocommerce": {
      "woocommerce_store_address": "123 Main Street",
      "woocommerce_currency": "USD"
    },
    "wordpress": {
      "blogname": "My Store"
    },
    "custom": {}
  }
}
```

### Plugin Sources
- `wordpress.org` - Free plugins from WordPress.org
- `github` - Plugins hosted on GitHub
- `premium` - Premium plugins from WooCommerce marketplace

### Theme Sources
- `wordpress.org` - Free themes from WordPress.org
- `github` - Themes hosted on GitHub
- `premium` - Premium themes from WooCommerce marketplace

## Usage

### 1. Access the Blueprint Importer
1. Open Local and navigate to your site
2. Click on the "Wizard Hat Toolkit" addon
3. Click on the "Blueprint Importer" tab

### 2. Upload a Blueprint
1. Click "Choose File" and select a `.json` blueprint file
2. The file will be automatically validated
3. Review any validation errors or warnings

### 3. Preview the Import
1. Click "Preview Import" to see what will be imported
2. Review the list of plugins, themes, and settings
3. Check for any conflicts with existing installations

### 4. Configure Import Settings
1. Click "Import Settings" to configure how conflicts are handled
2. Set preferences for overwriting existing items
3. Enable/disable backup and notification options

### 5. Import the Blueprint
1. Click "Import Blueprint" to start the import process
2. Monitor the progress in real-time
3. Review any errors that occur during import

## Sample Blueprint

A sample blueprint file (`sample-blueprint.json`) is included with the toolkit. This demonstrates:
- Basic WooCommerce store configuration
- Essential plugins (WooCommerce, Stripe, PayPal)
- Premium plugin examples
- Common WooCommerce settings
- Storefront theme installation

## Error Handling

The importer handles various error scenarios:

### Validation Errors
- Invalid JSON format
- Missing required fields
- Invalid plugin/theme sources
- Invalid setting values

### Import Errors
- Plugin installation failures
- Theme installation failures
- Setting application failures
- Network connectivity issues

### Conflict Resolution
- Existing plugin installations
- Existing theme installations
- Conflicting setting values

## Security Considerations

- Blueprint files are validated before processing
- Only trusted sources are supported for plugin/theme installation
- Settings are sanitized before application
- Import process can be rolled back if errors occur

## Integration with Existing Features

The Blueprint Importer integrates with existing Wizard Hat Toolkit features:

- **Plugin Management**: Uses existing plugin installation logic
- **Theme Management**: Uses existing theme installation logic
- **GitHub Integration**: Leverages existing GitHub token authentication
- **WP-CLI Integration**: Uses existing WP-CLI functionality for settings

## Troubleshooting

### Common Issues

1. **File Upload Fails**
   - Ensure the file is a valid JSON format
   - Check file size (max 10MB)
   - Verify file permissions

2. **Validation Errors**
   - Check blueprint structure against the format specification
   - Ensure all required fields are present
   - Verify plugin/theme sources are valid

3. **Import Failures**
   - Check site is running
   - Verify GitHub token is valid (for premium plugins)
   - Check network connectivity
   - Review error messages for specific issues

4. **Conflict Resolution**
   - Review import settings
   - Manually resolve conflicts if needed
   - Use backup functionality for safety

### Getting Help

- Check the Local logs for detailed error information
- Review the blueprint file format
- Test with the sample blueprint first
- Ensure all dependencies are installed

## Future Enhancements

Planned improvements include:
- Blueprint export functionality
- Blueprint sharing via GitHub integration
- Template library integration
- Automated testing with blueprints
- Advanced conflict resolution options
- Batch import capabilities

## Technical Details

### Architecture
- **BlueprintManager**: Core blueprint handling logic
- **BlueprintValidator**: Validation and conflict detection
- **BlueprintImporter**: Import execution logic
- **BlueprintSettings**: Import settings and preferences
- **BlueprintUI**: React UI components

### Dependencies
- Uses existing Local addon infrastructure
- Integrates with WP-CLI for WordPress operations
- Leverages GitHub API for premium plugin access
- Built with React and TypeScript

### Performance
- Asynchronous processing for better user experience
- Progress tracking for long-running operations
- Error handling with rollback capabilities
- Memory-efficient file processing
