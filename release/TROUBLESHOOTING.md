# Troubleshooting - Blueprint Importer Tab Not Appearing

## Issue: Blueprint Importer tab is not visible in Local

### Possible Causes and Solutions

#### 1. Addon Not Properly Installed/Updated

**Solution**: Reinstall the addon
1. **Disable** the Wizard Hat Toolkit addon in Local
2. **Delete** the addon folder from your Local addons directory:
   - macOS: `~/Library/Application Support/Local/addons/wizard-hat-toolkit`
   - Windows: `C:\Users\username\AppData\Roaming\Local\addons\wizard-hat-toolkit`
   - Linux: `~/.config/Local/addons/wizard-hat-toolkit`
3. **Restart Local** completely
4. **Reinstall** using "Install from disk" with the latest `.tgz` file
5. **Enable** the addon

#### 2. Site Not Running

**Check**: Ensure your site is in "Running" state
- The addon interface only appears when the site is running
- Start your site if it's stopped

#### 3. Caching Issues

**Solution**: Clear Local cache
1. **Close Local** completely
2. **Clear Local cache** (if applicable)
3. **Restart Local**
4. **Navigate** to your site and check the addon

#### 4. Addon Version Mismatch

**Check**: Verify you're using the latest version
- The Blueprint Importer was added in v1.5.0
- Ensure you have the latest package installed

#### 5. Manual Installation Issues

**Solution**: Use "Install from disk" method
1. **Download** the latest `wizard-hat-toolkit-1.5.0.tgz`
2. **Use "Install from disk"** instead of manual installation
3. **Enable** the addon after installation

#### 6. Development Installation

If you're running from source:
1. **Ensure** you've run `npm run build`
2. **Check** that the `lib/` directory contains compiled files
3. **Verify** the `lib/modules/blueprint-importer/` directory exists
4. **Restart Local** after building

### Debugging Steps

#### Step 1: Verify Installation
Check if the addon files are present:
```bash
# Check if the addon directory exists
ls -la ~/Library/Application\ Support/Local/addons/wizard-hat-toolkit/

# Check if compiled files exist
ls -la ~/Library/Application\ Support/Local/addons/wizard-hat-toolkit/lib/modules/blueprint-importer/
```

#### Step 2: Check Local Logs
1. **Open Local**
2. **Go to Help > Show Logs**
3. **Look for errors** related to the Wizard Hat Toolkit
4. **Check for JavaScript errors** in the console

#### Step 3: Verify Tab Structure
The tab should appear in this order:
1. Utilities
2. Jurassic Tube
3. Shop Config Options
4. Plugin Management
5. **Blueprint Importer** (should be here)
6. Plugin Updates

#### Step 4: Test with Simple Content
If the tab still doesn't appear, the issue might be with the component itself. The current implementation uses a simple test content to verify the tab appears.

### Alternative Installation Method

#### Method 1: Fresh Installation
1. **Completely remove** the existing addon
2. **Restart Local**
3. **Install fresh** from the `.tgz` file
4. **Enable** the addon

#### Method 2: Manual File Copy
1. **Extract** the `.tgz` file
2. **Copy** the extracted folder to the addons directory
3. **Rename** to `wizard-hat-toolkit`
4. **Restart Local**

### Verification Checklist

- [ ] Site is running
- [ ] Addon is enabled in Local
- [ ] Latest version (1.5.0) is installed
- [ ] Compiled files exist in `lib/modules/blueprint-importer/`
- [ ] No JavaScript errors in Local logs
- [ ] Local has been restarted after installation

### Still Not Working?

If the tab still doesn't appear after trying all solutions:

1. **Check Local version** - Ensure you're using Local 5.x or higher
2. **Try a different site** - Test with a fresh site
3. **Check permissions** - Ensure Local has proper file permissions
4. **Report the issue** - Include:
   - Local version
   - Operating system
   - Steps taken
   - Any error messages from logs

### Contact Information

For additional support:
- **GitHub Issues**: Report bugs with detailed information
- **Local Community**: Check Local community forums
- **Documentation**: Review all included documentation files
