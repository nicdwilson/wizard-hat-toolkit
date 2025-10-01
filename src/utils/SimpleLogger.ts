import * as fs from 'fs';
import * as path from 'path';

// Conditionally import LocalMain only in main process
let LocalMain: any = null;
try {
    // Try to require LocalMain - it will only work in main process
    LocalMain = require('@getflywheel/local/main');
} catch (error) {
    // LocalMain not available in renderer process
    console.log('[SimpleLogger] LocalMain not available in renderer process');
}

/**
 * Simple logging utility that uses only built-in Node.js modules
 */
export class SimpleLogger {
    private static instance: SimpleLogger;
    private logPath: string;
    private maxLogSize: number = 10 * 1024 * 1024; // 10MB
    private maxLogFiles: number = 5;

    private constructor(userDataPath: string) {
        this.logPath = path.join(userDataPath, 'pressable-sync.log');
    }

    public static getInstance(userDataPath: string): SimpleLogger {
        if (!SimpleLogger.instance) {
            SimpleLogger.instance = new SimpleLogger(userDataPath);
        }
        return SimpleLogger.instance;
    }

    private formatMessage(level: string, caller: string, message: string, data?: any): string {
        const timestamp = new Date().toISOString();
        const dataStr = data ? ` ${JSON.stringify(data)}` : '';
        return `[${timestamp}] [${level}] [${caller}] ${message}${dataStr}\n`;
    }

    private writeToFile(message: string): void {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.logPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Append to log file
            fs.appendFileSync(this.logPath, message);

            // Check if we need to rotate logs
            this.rotateLogsIfNeeded();
        } catch (error) {
            console.error('[SimpleLogger] Failed to write to log file:', error);
        }
    }

    private rotateLogsIfNeeded(): void {
        try {
            if (!fs.existsSync(this.logPath)) {
                return;
            }

            const stats = fs.statSync(this.logPath);
            if (stats.size > this.maxLogSize) {
                // Rotate logs
                for (let i = this.maxLogFiles - 1; i > 0; i--) {
                    const oldFile = `${this.logPath}.${i}`;
                    const newFile = `${this.logPath}.${i + 1}`;
                    
                    if (fs.existsSync(oldFile)) {
                        if (i === this.maxLogFiles - 1) {
                            fs.unlinkSync(oldFile);
                        } else {
                            fs.renameSync(oldFile, newFile);
                        }
                    }
                }

                // Move current log to .1
                fs.renameSync(this.logPath, `${this.logPath}.1`);

                // Create new log file
                fs.writeFileSync(this.logPath, '');
            }
        } catch (error) {
            console.error('[SimpleLogger] Failed to rotate logs:', error);
        }
    }

    public info(caller: string, message: string, data?: any): void {
        const formattedMessage = this.formatMessage('INFO', caller, message, data);
        console.log(formattedMessage.trim());
        this.writeToFile(formattedMessage);
    }

    public warn(caller: string, message: string, data?: any): void {
        const formattedMessage = this.formatMessage('WARN', caller, message, data);
        console.warn(formattedMessage.trim());
        this.writeToFile(formattedMessage);
    }

    public error(caller: string, message: string, data?: any): void {
        const formattedMessage = this.formatMessage('ERROR', caller, message, data);
        console.error(formattedMessage.trim());
        this.writeToFile(formattedMessage);
    }

    public debug(caller: string, message: string, data?: any): void {
        const formattedMessage = this.formatMessage('DEBUG', caller, message, data);
        console.debug(formattedMessage.trim());
        this.writeToFile(formattedMessage);
    }

    public setDebugLoggingEnabled(enabled: boolean): void {
        // SimpleLogger doesn't need debug logging toggle since it always logs everything
        // This method exists for compatibility with the existing Logger interface
    }
}
