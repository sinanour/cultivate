import { Request, Response, NextFunction } from 'express';
import { ErrorHandlerMiddleware } from '../../middleware/error-handler.middleware';
import { Prisma } from '@prisma/client';

describe('ErrorHandlerMiddleware', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockRequest = {
            method: 'GET',
            path: '/api/test',
        };

        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        mockNext = jest.fn();
        jest.clearAllMocks();
    });

    describe('handle', () => {
        it('should handle Prisma not found errors', () => {
            const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
                code: 'P2025',
                clientVersion: '5.0.0',
            });

            const handler = ErrorHandlerMiddleware.handle();
            handler(error, mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'NOT_FOUND',
                })
            );
        });

        it('should handle Prisma unique constraint errors', () => {
            const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
                code: 'P2002',
                clientVersion: '5.0.0',
            });

            const handler = ErrorHandlerMiddleware.handle();
            handler(error, mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'DUPLICATE_NAME',
                })
            );
        });

        it('should handle Prisma foreign key constraint errors', () => {
            const error = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
                code: 'P2003',
                clientVersion: '5.0.0',
            });

            const handler = ErrorHandlerMiddleware.handle();
            handler(error, mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'INVALID_REFERENCE',
                })
            );
        });

        it('should handle Prisma validation errors', () => {
            const error = new Prisma.PrismaClientValidationError('Validation failed', { clientVersion: '5.0.0' });

            const handler = ErrorHandlerMiddleware.handle();
            handler(error, mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'VALIDATION_ERROR',
                })
            );
        });

        it('should handle generic errors', () => {
            const error = new Error('Something went wrong');

            const handler = ErrorHandlerMiddleware.handle();
            handler(error, mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'INTERNAL_ERROR',
                })
            );
        });

        it('should log errors with stack traces', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const error = new Error('Test error');

            const handler = ErrorHandlerMiddleware.handle();
            handler(error, mockRequest as Request, mockResponse as Response, mockNext);

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('notFound', () => {
        it('should return 404 for undefined routes', () => {
            const handler = ErrorHandlerMiddleware.notFound();
            handler(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'NOT_FOUND',
                    message: expect.stringContaining('not found'),
                })
            );
        });
    });
});
