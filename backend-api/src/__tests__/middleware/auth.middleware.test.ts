import { Request, Response, NextFunction } from 'express';
import { AuthMiddleware } from '../../middleware/auth.middleware';
import { AuthService } from '../../services/auth.service';
import { UserRepository } from '../../repositories/user.repository';

jest.mock('../../services/auth.service');
jest.mock('../../repositories/user.repository');

describe('AuthMiddleware', () => {
    let middleware: AuthMiddleware;
    let mockAuthService: jest.Mocked<AuthService>;
    let mockUserRepository: jest.Mocked<UserRepository>;
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockAuthService = new AuthService(null as any) as jest.Mocked<AuthService>;
        mockUserRepository = new UserRepository(null as any) as jest.Mocked<UserRepository>;
        middleware = new AuthMiddleware(mockAuthService, mockUserRepository);

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
        it('should authenticate valid token', async () => {
            const token = 'valid-token';
            const payload = { userId: 'user-123', email: 'test@example.com', role: 'EDITOR', authorizedAreaIds: [], readOnlyAreaIds: [], hasGeographicRestrictions: false };
            const mockUser = { id: 'user-123', email: 'test@example.com', role: 'EDITOR' };

            mockRequest.headers = { authorization: `Bearer ${token}` };
            mockAuthService.validateAccessToken = jest.fn().mockReturnValue(payload);
            mockUserRepository.findById = jest.fn().mockResolvedValue(mockUser);

            const handler = middleware.authenticate();
            await handler(mockRequest as any, mockResponse as Response, mockNext);

            expect(mockAuthService.validateAccessToken).toHaveBeenCalledWith(token);
            expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
            expect(mockNext).toHaveBeenCalled();
            expect((mockRequest as any).user).toEqual(payload);
        });

        it('should reject request without authorization header', async () => {
            const handler = middleware.authenticate();
            await handler(mockRequest as any, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'UNAUTHORIZED',
                })
            );
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should reject request with invalid token format', async () => {
            mockRequest.headers = { authorization: 'InvalidFormat token' };

            const handler = middleware.authenticate();
            await handler(mockRequest as any, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should reject request with invalid token', async () => {
            mockRequest.headers = { authorization: 'Bearer invalid-token' };
            mockAuthService.validateAccessToken = jest.fn().mockImplementation(() => {
                throw new Error('Invalid token');
            });

            const handler = middleware.authenticate();
            await handler(mockRequest as any, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should reject request when user no longer exists', async () => {
            const token = 'valid-token';
            const payload = { userId: 'user-123', email: 'test@example.com', role: 'EDITOR', authorizedAreaIds: [], readOnlyAreaIds: [], hasGeographicRestrictions: false };

            mockRequest.headers = { authorization: `Bearer ${token}` };
            mockAuthService.validateAccessToken = jest.fn().mockReturnValue(payload);
            mockUserRepository.findById = jest.fn().mockResolvedValue(null);

            const handler = middleware.authenticate();
            await handler(mockRequest as any, mockResponse as Response, mockNext);

            expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'UNAUTHORIZED',
                    message: 'User no longer exists',
                })
            );
            expect(mockNext).not.toHaveBeenCalled();
        });
    });
});
