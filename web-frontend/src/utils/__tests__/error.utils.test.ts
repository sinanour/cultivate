import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorHandler } from '../error.utils';

describe('ErrorHandler', () => {
    let consoleErrorSpy: any;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('handleError', () => {
        it('should handle Error objects', () => {
            const error = new Error('Test error');
            const result = ErrorHandler.handleError(error);

            expect(result.message).toBe('Test error');
            expect(result.severity).toBe('transient');
            expect(result.timestamp).toBeDefined();
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('should handle string errors', () => {
            const result = ErrorHandler.handleError('String error');

            expect(result.message).toBe('String error');
            expect(result.severity).toBe('transient');
        });

        it('should handle unknown errors', () => {
            const result = ErrorHandler.handleError({ unknown: 'object' });

            expect(result.message).toBe('An unexpected error occurred');
            expect(result.severity).toBe('transient');
        });

        it('should identify critical errors', () => {
            const error = new Error('500 Internal Server Error');
            const result = ErrorHandler.handleError(error);

            expect(result.severity).toBe('critical');
        });

        it('should identify critical database errors', () => {
            const error = new Error('Database connection failed');
            const result = ErrorHandler.handleError(error);

            expect(result.severity).toBe('critical');
        });

        it('should log with context', () => {
            const error = new Error('Test error');
            ErrorHandler.handleError(error, 'TestContext');

            expect(consoleErrorSpy).toHaveBeenCalled();
            const logCall = consoleErrorSpy.mock.calls[0][0];
            expect(logCall).toContain('TestContext');
        });
    });

    describe('getUserFriendlyMessage', () => {
        it('should return friendly message for network errors', () => {
            const error = new Error('Network request failed');
            const message = ErrorHandler.getUserFriendlyMessage(error);

            expect(message).toBe('Unable to connect to the server. Please check your internet connection.');
        });

        it('should return friendly message for 401 errors', () => {
            const error = new Error('401 Unauthorized');
            const message = ErrorHandler.getUserFriendlyMessage(error);

            expect(message).toBe('Your session has expired. Please log in again.');
        });

        it('should return friendly message for 403 errors', () => {
            const error = new Error('403 Forbidden');
            const message = ErrorHandler.getUserFriendlyMessage(error);

            expect(message).toBe('You do not have permission to perform this action.');
        });

        it('should return friendly message for 404 errors', () => {
            const error = new Error('404 Not Found');
            const message = ErrorHandler.getUserFriendlyMessage(error);

            expect(message).toBe('The requested resource was not found.');
        });

        it('should return friendly message for 500 errors', () => {
            const error = new Error('500 Internal Server Error');
            const message = ErrorHandler.getUserFriendlyMessage(error);

            expect(message).toBe('A server error occurred. Please try again later.');
        });

        it('should return original message for unknown errors', () => {
            const error = new Error('Custom error message');
            const message = ErrorHandler.getUserFriendlyMessage(error);

            expect(message).toBe('Custom error message');
        });

        it('should return generic message for non-Error objects', () => {
            const message = ErrorHandler.getUserFriendlyMessage('string error');

            expect(message).toBe('An unexpected error occurred. Please try again.');
        });
    });

    describe('logError', () => {
        it('should log error with timestamp', () => {
            const errorInfo = {
                message: 'Test error',
                severity: 'transient' as const,
                timestamp: Date.now(),
            };

            ErrorHandler.logError(errorInfo);

            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('should log error with details', () => {
            const errorInfo = {
                message: 'Test error',
                severity: 'critical' as const,
                details: 'Stack trace here',
                timestamp: Date.now(),
            };

            ErrorHandler.logError(errorInfo);

            expect(consoleErrorSpy).toHaveBeenCalledTimes(2); // Once for message, once for details
        });

        it('should include context in log', () => {
            const errorInfo = {
                message: 'Test error',
                severity: 'transient' as const,
                timestamp: Date.now(),
            };

            ErrorHandler.logError(errorInfo, 'TestContext');

            const logCall = consoleErrorSpy.mock.calls[0][0];
            expect(logCall).toContain('TestContext');
            expect(logCall).toContain('TRANSIENT');
        });
    });
});
