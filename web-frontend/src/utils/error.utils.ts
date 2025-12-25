export type ErrorSeverity = 'transient' | 'critical';

export interface ErrorInfo {
    message: string;
    severity: ErrorSeverity;
    details?: string;
    timestamp: number;
}

export class ErrorHandler {
    static handleError(error: unknown, context?: string): ErrorInfo {
        const timestamp = Date.now();
        let message = 'An unexpected error occurred';
        let details = '';
        let severity: ErrorSeverity = 'transient';

        if (error instanceof Error) {
            message = error.message;
            details = error.stack || '';

            // Determine severity based on error type
            if (this.isCriticalError(error)) {
                severity = 'critical';
            }
        } else if (typeof error === 'string') {
            message = error;
        }

        // Log to console
        this.logError({
            message,
            severity,
            details,
            timestamp,
        }, context);

        return {
            message,
            severity,
            details,
            timestamp,
        };
    }

    static logError(errorInfo: ErrorInfo, context?: string): void {
        const logMessage = [
            `[${new Date(errorInfo.timestamp).toISOString()}]`,
            context ? `[${context}]` : '',
            `[${errorInfo.severity.toUpperCase()}]`,
            errorInfo.message,
        ].filter(Boolean).join(' ');

        console.error(logMessage);

        if (errorInfo.details) {
            console.error('Details:', errorInfo.details);
        }
    }

    static getUserFriendlyMessage(error: unknown): string {
        if (error instanceof Error) {
            // Map common error messages to user-friendly versions
            if (error.message.includes('Network') || error.message.includes('fetch')) {
                return 'Unable to connect to the server. Please check your internet connection.';
            }
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                return 'Your session has expired. Please log in again.';
            }
            if (error.message.includes('403') || error.message.includes('Forbidden')) {
                return 'You do not have permission to perform this action.';
            }
            if (error.message.includes('404') || error.message.includes('Not Found')) {
                return 'The requested resource was not found.';
            }
            if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
                return 'A server error occurred. Please try again later.';
            }

            return error.message;
        }

        return 'An unexpected error occurred. Please try again.';
    }

    private static isCriticalError(error: Error): boolean {
        const criticalPatterns = [
            '500',
            'Internal Server Error',
            'Database',
            'Fatal',
            'Critical',
        ];

        return criticalPatterns.some((pattern) =>
            error.message.includes(pattern)
        );
    }
}
