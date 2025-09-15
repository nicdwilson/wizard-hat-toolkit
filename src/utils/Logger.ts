import * as LocalMain from '@getflywheel/local/main';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Centralized logging utility for Wizard Hat Toolkit
 * All logs go to a single wizard-hat-toolkit.log file with caller identification
 */
export class Logger {
    private static instance: Logger;
    private logDir: string;
    private logFile: string;

    private constructor(userDataPath: string) {
        this.logDir = path.join(userDataPath, 'addons', 'wizard-hat-toolkit');
        this.logFile = path.join(this.logDir, 'wizard-hat-toolkit.log');
        
        // Ensure directory exists
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
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
     * Log a message with caller identification
     */
    public log(level: 'info' | 'warn' | 'error' | 'debug', caller: string, message: string, data?: any): void {
        try {
            const timestamp = new Date().toISOString();
            const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
            const logEntry = `[${timestamp}] [${level.toUpperCase()}] [${caller}] ${message}${dataStr}\n`;
            
            // Write to file
            fs.appendFileSync(this.logFile, logEntry);
            
            // Also log to console for development
            console.log(logEntry.trim());
            
            // Also log to LocalWP's logger for integration
            LocalMain.getServiceContainer().cradle.localLogger.log(level, `[${caller}] ${message}`);
            
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
