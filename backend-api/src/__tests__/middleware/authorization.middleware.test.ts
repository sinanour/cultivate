import { Response, NextFunction } from 'express';
import { AuthorizationMiddleware } from '../../middleware/authorization.middleware';
import { AuthenticatedRequest } from '../../types/express.types';
import { UserRole } from '@prisma/client';

describe('AuthorizationMiddleware', () => {
    let middleware: AuthorizationMiddleware;
    let mockRequest: Partial<AuthenticatedRequest>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        middleware = new AuthorizationMiddleware();

        mockRequest = {
            user: undefined,
        };

        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        mockNext = jest.fn();
        jest.clearAllMocks();
    });

    describe('requireAuthenticated', () => {
        it('should allow authenticated users', () => {
            mockRequest.user = { userId: 'user-1', email: 'test@example.com', role: UserRole.READ_ONLY };

            const handler = middleware.requireAuthenticated();
            handler(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should reject unauthenticated users', () => {
            mockRequest.user = undefined;

            const handler = middleware.requireAuthenticated();
            handler(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe('requireEditor', () => {
        it('should allow EDITOR role', () => {
            mockRequest.user = { userId: 'user-1', email: 'test@example.com', role: UserRole.EDITOR };

            const handler = middleware.requireEditor();
            handler(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow ADMINISTRATOR role', () => {
            mockRequest.user = { userId: 'user-1', email: 'test@example.com', role: UserRole.ADMINISTRATOR };

            const handler = middleware.requireEditor();
            handler(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should reject READ_ONLY role', () => {
            mockRequest.user = { userId: 'user-1', email: 'test@example.com', role: UserRole.READ_ONLY };

            const handler = middleware.requireEditor();
            handler(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should reject unauthenticated users', () => {
            mockRequest.user = undefined;

            const handler = middleware.requireEditor();
            handler(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe('requireAdmin', () => {
        it('should allow ADMINISTRATOR role', () => {
            mockRequest.user = { userId: 'user-1', email: 'test@example.com', role: UserRole.ADMINISTRATOR };

            const handler = middleware.requireAdmin();
            handler(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should reject EDITOR role', () => {
            mockRequest.user = { userId: 'user-1', email: 'test@example.com', role: UserRole.EDITOR };

            const handler = middleware.requireAdmin();
            handler(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should reject READ_ONLY role', () => {
            mockRequest.user = { userId: 'user-1', email: 'test@example.com', role: UserRole.READ_ONLY };

            const handler = middleware.requireAdmin();
            handler(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should reject unauthenticated users', () => {
            mockRequest.user = undefined;

            const handler = middleware.requireAdmin();
            handler(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe('requirePermission', () => {
        it('should allow users with required permission', () => {
            mockRequest.user = { userId: 'user-1', email: 'test@example.com', role: UserRole.EDITOR };

            const handler = middleware.requirePermission('write');
            handler(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should reject users without required permission', () => {
            mockRequest.user = { userId: 'user-1', email: 'test@example.com', role: UserRole.READ_ONLY };

            const handler = middleware.requirePermission('write');
            handler(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe('requireRole', () => {
        it('should allow users with required role', () => {
            mockRequest.user = { userId: 'user-1', email: 'test@example.com', role: UserRole.EDITOR };

            const handler = middleware.requireRole(UserRole.EDITOR);
            handler(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow users with one of multiple required roles', () => {
            mockRequest.user = { userId: 'user-1', email: 'test@example.com', role: UserRole.EDITOR };

            const handler = middleware.requireRole([UserRole.ADMINISTRATOR, UserRole.EDITOR]);
            handler(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should reject users without required role', () => {
            mockRequest.user = { userId: 'user-1', email: 'test@example.com', role: UserRole.READ_ONLY };

            const handler = middleware.requireRole(UserRole.ADMINISTRATOR);
            handler(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockNext).not.toHaveBeenCalled();
        });
    });
});
