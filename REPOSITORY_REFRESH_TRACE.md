# Repository Refresh Code Path Trace

This document traces the complete code path taken when refreshing the local plugins repository (all-plugins repository).

## Entry Points

The repository refresh can be triggered from several places:

1. **Plugin Updates Tab** (`src/PluginUpdates.jsx`)
   - When component mounts, sends `"get-premium-plugin-selections"` IPC event
   - When user clicks "Check for Updates", sends `"check-plugin-updates"` IPC event

2. **Plugin Management Tab** (`src/PluginManagement.jsx`)
   - When component mounts, sends `"get-premium-plugin-selections"` IPC event

3. **Plugin Installation** (`src/main.ts`)
   - When installing plugins, if `pluginManager.isInitialized` is false

## Complete Code Path

### 1. IPC Event Handler (`src/main.ts`)

#### Entry: `get-premium-plugin-selections` (line 495)
```typescript
ipcMain.on("get-premium-plugin-selections", async () => {
    // Check if PluginManager is initialized
    if (!pluginManager.isInitialized) {
        // Send progress updates to renderer
        const progressCallback = (status: string) => {
            LocalMain.sendIPCEvent('repository-clone-progress', { status });
        };
        
        // Initialize PluginManager (this triggers repository refresh)
        await pluginManager.initialize(context, process.env.GITHUB_TOKEN, progressCallback);
        LocalMain.sendIPCEvent('repository-clone-complete', { success: true });
    }
    
    // Get premium plugin selections
    const selections = pluginManager.getPremiumPluginSelections();
    LocalMain.sendIPCEvent("premium-plugin-selections", selections);
});
```

#### Entry: `check-plugin-updates` (line 241)
```typescript
ipcMain.on('check-plugin-updates', async (event, siteId) => {
    // Check if PluginManager is initialized
    if (!pluginManager.isInitialized) {
        const progressCallback = (status: string) => {
            LocalMain.sendIPCEvent('repository-clone-progress', { status });
        };
        
        // Initialize PluginManager (this triggers repository refresh)
        await pluginManager.initialize(context, process.env.GITHUB_TOKEN, progressCallback);
        LocalMain.sendIPCEvent('repository-clone-complete', { success: true });
    }
    
    // Continue with update checking...
});
```

### 2. PluginManager.initialize() (`src/modules/plugin-manager/PluginManager.ts`)

**Location:** Line 64

```typescript
public async initialize(context: any, githubToken?: string, progressCallback?: (status: string) => void): Promise<void> {
    // Check if already initialized
    if (this.initialized) {
        return; // Skip if already initialized
    }
    
    this.githubToken = githubToken || process.env.GITHUB_TOKEN || null;
    
    // Initialize registry - this is where repository refresh happens
    await this.registry.initialize(this.githubToken, progressCallback);
    
    this.initialized = true;
}
```

**Key Points:**
- Only initializes if not already initialized (singleton pattern)
- Passes `progressCallback` to registry for status updates
- Sets `initialized` flag to prevent multiple initializations

### 3. PluginRegistry.initialize() (`src/modules/plugin-manager/PluginRegistry.ts`)

**Location:** Line 59

```typescript
public async initialize(githubToken?: string, progressCallback?: (status: string) => void): Promise<void> {
    // Check if repository path is configured
    const userProvidedPath = LocalMain.UserData.get('allPluginsRepositoryPath');
    if (!userProvidedPath) {
        throw new Error('Repository path not configured...');
    }
    
    // Load plugins via Git - this is where refresh happens
    await this.loadPremiumPluginsViaGit(progressCallback);
    
    this.registryData.lastUpdated = new Date();
}
```

**Key Points:**
- Checks for configured repository path in user data
- Calls `loadPremiumPluginsViaGit()` which handles refresh
- Updates `lastUpdated` timestamp

### 4. PluginRegistry.loadPremiumPluginsViaGit() (`src/modules/plugin-manager/PluginRegistry.ts`)

**Location:** Line 861

```typescript
private async loadPremiumPluginsViaGit(progressCallback?: (status: string) => void): Promise<void> {
    const repoPath = this.getRepositoryPath('all-plugins');
    const repoUrl = 'https://github.com/woocommerce/all-plugins.git';
    
    // Check if repository directory exists and has content
    const dirExists = fs.existsSync(repoPath);
    let hasContent = false;
    
    if (dirExists) {
        const entries = fs.readdirSync(repoPath);
        hasContent = entries.length > 0;
    }
    
    if (dirExists && hasContent) {
        // REPOSITORY EXISTS - REFRESH IT
        progressCallback?.('Refreshing repository to ensure it's up to date...');
        
        // Check for updates and refresh
        const hasUpdates = await this.checkForUpdates(repoPath, progressCallback);
        
        if (hasUpdates) {
            progressCallback?.('Repository refreshed successfully');
        } else {
            progressCallback?.('Repository is up to date');
        }
    } else {
        // Repository doesn't exist - clone it
        // (Only for default cache location, not user-provided paths)
        await this.cloneRepository(repoUrl, repoPath, progressCallback);
    }
    
    // Read product-packages directory and load plugin list
    const packagesDir = path.join(repoPath, 'product-packages');
    const entries = fs.readdirSync(packagesDir, { withFileTypes: true });
    
    // Build premium plugins list from directory entries
    this.registryData.premiumPlugins = entries
        .filter(entry => entry.isDirectory() && entry.name !== 'woocommerce-shipstation')
        .map(entry => ({
            label: entry.name,
            value: entry.name,
            name: entry.name
        }));
}
```

**Key Points:**
- Gets repository path (either user-provided or default cache location)
- Checks if repository exists and has content
- If exists: calls `checkForUpdates()` to refresh
- If not exists: calls `cloneRepository()` to clone
- After refresh/clone: reads `product-packages` directory and builds plugin list

### 5. PluginRegistry.checkForUpdates() (`src/modules/plugin-manager/PluginRegistry.ts`)

**Location:** Line 316

```typescript
private async checkForUpdates(repoPath: string, progressCallback?: (status: string) => void): Promise<boolean> {
    // Check if it's a git repository
    const gitPath = path.join(repoPath, '.git');
    if (!fs.existsSync(gitPath)) {
        // Not a git repository - skip update check
        progressCallback?.('Repository is not a git repository. Using existing files.');
        return false;
    }
    
    // Set up environment for git commands
    const env = {
        ...process.env,
        PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin',
        HOME: process.env.HOME || os.homedir(),
    };
    
    // STEP 1: Fetch latest changes from remote
    progressCallback?.('Checking for repository updates...');
    await execAsync(`git fetch origin`, {
        cwd: repoPath,
        timeout: 60000,
        env: env
    });
    
    // STEP 2: Check if local is behind remote
    const { stdout } = await execAsync(`git rev-list HEAD..origin/main --count`, {
        cwd: repoPath,
        timeout: 30000,
        env: env
    });
    
    const commitsBehind = parseInt(stdout.trim(), 10);
    const hasUpdates = commitsBehind > 0;
    
    // STEP 3: If updates available, pull latest changes
    if (hasUpdates) {
        progressCallback?.(`Found ${commitsBehind} new commit(s). Updating repository...`);
        
        await execAsync(`git pull origin main`, {
            cwd: repoPath,
            timeout: 120000,
            env: env
        });
        
        return true; // Repository was updated
    }
    
    return false; // No updates available
}
```

**Key Steps:**
1. **Verify Git Repository**: Checks if `.git` directory exists
2. **Fetch Remote Changes**: Runs `git fetch origin` to get latest remote state
3. **Check for Updates**: Uses `git rev-list HEAD..origin/main --count` to count commits behind
4. **Pull Updates**: If behind, runs `git pull origin main` to update local repository
5. **Return Status**: Returns `true` if updated, `false` if already up to date

**Error Handling:**
- If update check fails, logs warning but doesn't throw (uses existing repository)
- Progress callback receives status updates throughout

### 6. Progress Callbacks → UI Updates

**Progress Events Sent:**
- `'repository-clone-progress'` - Status updates during refresh
- `'repository-clone-complete'` - Refresh completed successfully
- `'repository-clone-error'` - Error occurred during refresh

**UI Components Listening:**
- `PluginUpdates.jsx` (lines 90-113)
- `PluginManagement.jsx` (lines 120-143)

**UI Display:**
- Shows spinner and status message during refresh
- Displays error message if refresh fails
- Hides status when complete

## Summary Flow Diagram

```
User Action (Open Tab / Click Check Updates)
    ↓
IPC Event: "get-premium-plugin-selections" or "check-plugin-updates"
    ↓
main.ts: Check if pluginManager.isInitialized
    ↓
If NOT initialized:
    ↓
PluginManager.initialize()
    ↓
PluginRegistry.initialize()
    ↓
PluginRegistry.loadPremiumPluginsViaGit()
    ↓
Check if repository exists
    ↓
If EXISTS:
    ↓
PluginRegistry.checkForUpdates()
    ├─→ git fetch origin
    ├─→ git rev-list HEAD..origin/main --count
    └─→ If behind: git pull origin main
    ↓
Read product-packages directory
    ↓
Build premiumPlugins list
    ↓
Return plugin selections
    ↓
UI displays plugins / updates
```

## Key Configuration

**Repository Path:**
- Stored in: `LocalMain.UserData.get('allPluginsRepositoryPath')`
- Can be user-provided or default cache location
- Default cache: `~/Library/Application Support/Local/addons/wizard-hat-toolkit/repositories/all-plugins`

**Repository URL:**
- Hardcoded: `https://github.com/woocommerce/all-plugins.git`
- Branch: `main`

**Timeouts:**
- `git fetch`: 60 seconds
- `git rev-list`: 30 seconds
- `git pull`: 120 seconds

## Notes

1. **Singleton Pattern**: PluginManager and PluginRegistry use singleton pattern, so initialization only happens once per session
2. **Progress Feedback**: All refresh operations support progress callbacks for UI updates
3. **Error Handling**: Refresh failures don't crash the app - it falls back to using existing repository
4. **User-Provided Paths**: If user provides a custom path and it doesn't exist, the system won't auto-clone (user must clone manually)
5. **Git Requirements**: Repository must be a valid git repository (have `.git` directory) for refresh to work
