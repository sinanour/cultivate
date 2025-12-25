import { Request, Response, NextFunction } from 'express';
import { AuthMiddleware } from '../../middleware/auth.middleware';
import { AuthService } from '../../services/auth.service';

jest.mock('../../services/auth.service');

describe('AuthMiddleware', () => {
    let middleware: AuthMiddleware;
    let mockAuthService: jest.Mocked<AuthService>;
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockAuthService = new AuthService(null as any) as jest.Mocked<AuthService>;
        middleware = new AuthMiddleware(mockAuthService);

        mockRequest = {
            headers: {},
        };

        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        mockNext = jest.fn();
        jest.clearAllMocks();
    });

    describe('authenticate', () => {
        it('should authenticate valid token', () => {
            const token = 'valid-token';
            const payload = { userId: 'user-123', email: 'test@example.com', role: 'EDITOR' };

            mockRequest.headers = { authorization: `Bearer ${token}` };
            mockAuthService.validateAccessToken = jest.fn().mockReturnValue(payload);

            const handler = middleware.authenticate();
            handler(mockRequest as any, mockResponse as Response, mockNext);

            expect(mockAuthService.validateAccessToken).toHaveBeenCalledWith(token);
            expect(mockNext).toHaveBeenCalled();
            expect((mockRequest as any).user).toEqual(payload);
        });

        it('should reject request without authorization header', () => {
            const handler = middleware.authenticate();
            handler(mockRequest as any, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'UNAUTHORIZED',
                })
            );
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should reject request with invalid token format', () => {
            mockRequest.headers = { authorization: 'InvalidFormat token' };

            const handler = middleware.authenticate();
            handler(mockRequest as any, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should reject request with invalid token', () => {
            mockRequest.headers = { authorization: 'Bearer invalid-token' };
            mockAuthService.validateAccessToken = jest.fn().mockImplementation(() => {
                throw new Error('Invalid token');
            });

            const handler = middleware.authenticate();
            handler(mockRequest as any, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockNext).not.toHaveBeenCalled();
        });
    });
});
