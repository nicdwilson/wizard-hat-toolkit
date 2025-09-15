import * as fs from 'fs';
import * as path from 'path';

// Conditionally import LocalMain only in main process
let LocalMain: any = null;
try {
    // Try to require LocalMain - it will only work in main process
    LocalMain = require('@getflywheel/local/main');
} catch (error) {
    // LocalMain not available in renderer process
    console.log('[Logger] LocalMain not available in renderer process');
}

/**
 * Centralized logging utility for Wizard Hat Toolkit
 * All logs go to a single wizard-hat-toolkit.log file with caller identification
 * Respects the debug logging setting from Tools module
 */
export class Logger {
    private static instance: Logger;
    private logDir: string;
    private logFile: string;
    private debugLoggingEnabled: boolean = false;

    private constructor(userDataPath: string) {
        this.logDir = path.join(userDataPath, 'addons', 'wizard-hat-toolkit');
        this.logFile = path.join(this.logDir, 'wizard-hat-toolkit.log');
        
        // Ensure directory exists
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }

        // Load debug logging setting from localStorage
        this.loadDebugLoggingSetting();
    }

    public static getInstance(userDataPath?: string): Logger {
        if (!Logger.instance) {
            if (!userDataPath) {
                // Fallback to default path
                userDataPath = path.join(process.env.HOME || '', 'Library', 'Application Support', 'Local');
            }
            Logger.instance = new Logger(userDataPath);
        }
        return Logger.instance;
    }

    /**
     * Load debug logging setting from localStorage (only in renderer process)
     */
    private loadDebugLoggingSetting(): void {
        try {
            // Only try to access localStorage if we're in the renderer process
            if (typeof localStorage !== 'undefined') {
                const stored = localStorage.getItem('wizard-hat-tools-settings');
                if (stored) {
                    const settings = JSON.parse(stored);
                    this.debugLoggingEnabled = settings.enableDebugLog || false;
                }
            }
        } catch (error) {
            console.error('Error loading debug logging setting:', error);
        }
    }

    /**
     * Update debug logging setting
     */
    public setDebugLoggingEnabled(enabled: boolean): void {
        this.debugLoggingEnabled = enabled;
    }

    /**
     * Check if debug logging is enabled
     */
    public isDebugLoggingEnabled(): boolean {
        return this.debugLoggingEnabled;
    }

    /**
     * Log a message with caller identification
     * Respects debug logging setting - only writes to file if debug is enabled or level is error
     */
    public log(level: 'info' | 'warn' | 'error' | 'debug', caller: string, message: string, data?: any): void {
        try {
            const timestamp = new Date().toISOString();
            const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
            const logEntry = `[${timestamp}] [${level.toUpperCase()}] [${caller}] ${message}${dataStr}\n`;
            
            // Always log to console for development
            console.log(logEntry.trim());
            
            // Write to file only if debug logging is enabled or it's an error
            if (this.debugLoggingEnabled || level === 'error') {
                fs.appendFileSync(this.logFile, logEntry);
            }
            
            // Also log to LocalWP's logger for integration (only in main process)
            if (LocalMain) {
                try {
                    LocalMain.getServiceContainer().cradle.localLogger.log(level, `[${caller}] ${message}`);
                } catch (localError) {
                    // LocalWP logger might not be available during initialization
                    console.log(`[LocalWP Logger Unavailable] [${caller}] ${message}`);
                }
            }
            
        } catch (error) {
            // Fallback to console if file logging fails
            console.error('Failed to write to log file:', error);
            console.log(`[${caller}] ${message}`);
        }
    }

    /**
     * Log info message
     */
    public info(caller: string, message: string, data?: any): void {
        this.log('info', caller, message, data);
    }

    /**
     * Log warning message
     */
    public warn(caller: string, message: string, data?: any): void {
        this.log('warn', caller, message, data);
    }

    /**
     * Log error message
     */
    public error(caller: string, message: string, data?: any): void {
        this.log('error', caller, message, data);
    }

    /**
     * Log debug message
     */
    public debug(caller: string, message: string, data?: any): void {
        this.log('debug', caller, message, data);
    }

    /**
     * Get the log file path
     */
    public getLogFilePath(): string {
        return this.logFile;
    }
}
