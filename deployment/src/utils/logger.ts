/**
 * Winston logger configuration
 * Provides structured logging with timestamps to both console and file
 * 
 * Requirements:
 * - 15.1: Log all deployment steps with timestamps
 * - 15.5: Support verbose mode for detailed diagnostic output
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Singleton logger instance
let loggerInstance: winston.Logger | null = null;

/**
 * Create and configure Winston logger
 * Logs to both console and file with ISO 8601 timestamps
 * Returns singleton instance to ensure consistent logging across modules
 */
export function createLogger(): winston.Logger {
    // Return existing instance if already created
    if (loggerInstance) {
        return loggerInstance;
    }

    // Define log format with timestamps
    const logFormat = winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' // ISO 8601 format
        }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    );

    // Console format for human-readable output
    const consoleFormat = winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DDTHH:mm:ss.SSSZ'
        }),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...metadata }) => {
            let msg = `${timestamp} [${level}]: ${message}`;

            // Add metadata if present
            if (Object.keys(metadata).length > 0) {
                msg += ` ${JSON.stringify(metadata)}`;
            }

            return msg;
        })
    );

    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create logger instance
    loggerInstance = winston.createLogger({
        level: 'info', // Default level, can be changed to 'debug' for verbose mode
        format: logFormat,
        transports: [
            // Console transport with colored output
            new winston.transports.Console({
                format: consoleFormat
            }),

            // File transport for all logs
            new winston.transports.File({
                filename: path.join(logsDir, 'deployment.log'),
                maxsize: 10485760, // 10MB
                maxFiles: 5,
                tailable: true
            }),

            // Separate file for errors only
            new winston.transports.File({
                filename: path.join(logsDir, 'deployment-error.log'),
                level: 'error',
                maxsize: 10485760, // 10MB
                maxFiles: 5,
                tailable: true
            })
        ],
        // Handle exceptions and rejections
        exceptionHandlers: [
            new winston.transports.File({
                filename: path.join(logsDir, 'exceptions.log')
            })
        ],
        rejectionHandlers: [
            new winston.transports.File({
                filename: path.join(logsDir, 'rejections.log')
            })
        ]
    });

    return loggerInstance;
}

/**
 * Create a child logger with additional context
 * Useful for adding module-specific or operation-specific metadata
 */
export function createChildLogger(
    parent: winston.Logger,
    context: Record<string, unknown>
): winston.Logger {
    return parent.child(context);
}
