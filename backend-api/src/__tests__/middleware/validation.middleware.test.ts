import { Request, Response, NextFunction } from 'express';
import { ValidationMiddleware } from '../../middleware/validation.middleware';
import { z } from 'zod';

describe('ValidationMiddleware', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockRequest = {
            body: {},
            params: {},
            query: {},
        };

        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        mockNext = jest.fn();
        jest.clearAllMocks();
    });

    describe('validateBody', () => {
        it('should validate valid request body', () => {
            const schema = z.object({
                name: z.string().min(1),
                email: z.string().email(),
            });

            mockRequest.body = { name: 'John Doe', email: 'john@example.com' };

            const handler = ValidationMiddleware.validateBody(schema);
            handler(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockResponse.status).not.toHaveBeenCalled();
        });

        it('should reject invalid request body', () => {
            const schema = z.object({
                name: z.string().min(1),
                email: z.string().email(),
            });

            mockRequest.body = { name: '', email: 'invalid-email' };

            const handler = ValidationMiddleware.validateBody(schema);
            handler(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'VALIDATION_ERROR',
                })
            );
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should provide detailed validation errors', () => {
            const schema = z.object({
                name: z.string().min(1),
                age: z.number().min(0),
            });

            mockRequest.body = { name: '', age: -5 };

            const handler = ValidationMiddleware.validateBody(schema);
            handler(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    details: expect.any(Object),
                })
            );
        });
    });

    describe('validateParams', () => {
        it('should validate valid request params', () => {
            const schema = z.object({
                id: z.string().uuid(),
            });

            mockRequest.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

            const handler = ValidationMiddleware.validateParams(schema);
            handler(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should reject invalid request params', () => {
            const schema = z.object({
                id: z.string().uuid(),
            });

            mockRequest.params = { id: 'not-a-uuid' };

            const handler = ValidationMiddleware.validateParams(schema);
            handler(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe('validateQuery', () => {
        it('should validate valid query parameters', () => {
            const schema = z.object({
                page: z.string().optional(),
                limit: z.string().optional(),
            });

            mockRequest.query = { page: '1', limit: '10' };

            const handler = ValidationMiddleware.validateQuery(schema);
            handler(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should reject invalid query parameters', () => {
            const schema = z.object({
                page: z.string().regex(/^\d+$/),
            });

            mockRequest.query = { page: 'invalid' };

            const handler = ValidationMiddleware.validateQuery(schema);
            handler(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockNext).not.toHaveBeenCalled();
        });
    });
});
