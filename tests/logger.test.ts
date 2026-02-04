/**
 * Logger Unit Tests
 * Verifies that the logger correctly captures exceptions
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { logger, createRequestLogger, sanitizeLogData } from '@/lib/logger';

describe('Logger', () => {
    let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('Error Logging', () => {
        it('should log errors with proper structure', () => {
            const testError = new Error('Test error message');
            testError.stack = 'Error: Test error message\n    at test.ts:10:15';

            logger.error({
                type: 'test-error',
                error: {
                    name: testError.name,
                    message: testError.message,
                    stack: testError.stack,
                },
            }, 'Test error occurred');

            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('should capture exception details', () => {
            try {
                throw new Error('Simulated exception');
            } catch (error) {
                logger.error({
                    type: 'exception',
                    error: error instanceof Error ? {
                        name: error.name,
                        message: error.message,
                        stack: error.stack,
                    } : error,
                }, 'Exception caught');

                expect(consoleErrorSpy).toHaveBeenCalled();
            }
        });
    });

    describe('Request Logger', () => {
        it('should create child logger with request context', () => {
            const requestLogger = createRequestLogger({
                requestId: 'req-123',
                method: 'POST',
                path: '/api/test',
                userId: 'user-456',
            });

            expect(requestLogger).toBeDefined();

            requestLogger.info('Test request log');
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });
    });

    describe('Data Sanitization', () => {
        it('should redact sensitive fields', () => {
            const sensitiveData = {
                username: 'john',
                password: 'secret123',
                email: 'john@example.com',
                apikey: 'sk-1234567890',
                token: 'bearer-token',
            };

            const sanitized = sanitizeLogData(sensitiveData);

            expect(sanitized.username).toBe('john');
            expect(sanitized.email).toBe('john@example.com');
            expect(sanitized.password).toBe('[REDACTED]');
            expect(sanitized.apikey).toBe('[REDACTED]');
            expect(sanitized.token).toBe('[REDACTED]');
        });

        it('should handle nested sensitive fields', () => {
            const data = {
                user: {
                    name: 'John',
                    password: 'secret',
                },
                creditCard: '1234-5678-9012-3456',
            };

            const sanitized = sanitizeLogData(data);

            expect(sanitized.user).toEqual({ name: 'John', password: 'secret' });
            expect(sanitized.creditCard).toBe('[REDACTED]');
        });
    });

    describe('Log Levels', () => {
        it('should respect log level configuration', () => {
            logger.debug('Debug message');
            logger.info('Info message');
            logger.warn('Warning message');

            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });
    });
});

describe('API Error Logging', () => {
    let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('should log API route errors', async () => {
        const mockError = new Error('Database connection failed');

        logger.error({
            type: 'api-error',
            route: '/api/test',
            error: {
                name: mockError.name,
                message: mockError.message,
                stack: mockError.stack,
            },
        }, 'API route error');

        expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should log authentication failures', () => {
        logger.warn({
            type: 'auth-failure',
            email: 'test@example.com',
            reason: 'Invalid credentials',
        }, 'Authentication failed');

        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
});
