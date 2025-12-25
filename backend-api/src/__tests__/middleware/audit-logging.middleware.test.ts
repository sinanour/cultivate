import { Response, NextFunction } from 'express';
import { AuditLoggingMiddleware } from '../../middleware/audit-logging.middleware';
import { AuditLogRepository } from '../../repositories/audit-log.repository';
import { AuthenticatedRequest } from '../../types/express.types';

jest.mock('../../repositories/audit-log.repository');

describe('AuditLoggingMiddleware', () => {
    let middleware: AuditLoggingMiddleware;
    let mockAuditRepo: jest.Mocked<AuditLogRepository>;
    let mockRequest: Partial<AuthenticatedRequest>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockAuditRepo = new AuditLogRepository(null as any) as jest.Mocked<AuditLogRepository>;
        middleware = new AuditLoggingMiddleware(mockAuditRepo);

        mockRequest = {
            method: 'POST',
            path: '/api/activities',
            body: { name: 'Test Activity' },
            params: { id: 'activity-1' },
            user: { userId: 'user-1', email: 'test@example.com', role: 'EDITOR' },
            ip: '127.0.0.1',
        };

        const sendFn = jest.fn();
        mockResponse = {
            statusCode: 200,
            send: sendFn,
        };

        mockNext = jest.fn();
        jest.clearAllMocks();
    });

    describe('logEntityModification', () => {
        it('should log successful entity modifications', (done) => {
            mockAuditRepo.create = jest.fn().mockResolvedValue({});

            const handler = middleware.logEntityModification('ACTIVITY');
            handler(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();

            // Simulate response being sent
            const originalSend = mockResponse.send as jest.Mock;
            mockResponse.statusCode = 201;
            originalSend('response data');

            // Give async logging time to complete
            setTimeout(() => {
                expect(mockAuditRepo.create).toHaveBeenCalledWith(
                    expect.objectContaining({
                        userId: 'user-1',
                        actionType: 'POST_ACTIVITY',
                        entityType: 'ACTIVITY',
                    })
                );
                done();
            }, 100);
        });

        it('should not log failed requests', (done) => {
            mockAuditRepo.create = jest.fn().mockResolvedValue({});

            const handler = middleware.logEntityModification('ACTIVITY');
            handler(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();

            // Simulate error response
            const originalSend = mockResponse.send as jest.Mock;
            mockResponse.statusCode = 400;
            originalSend('error data');

            // Audit log should not be created for failed requests
            setTimeout(() => {
                expect(mockAuditRepo.create).not.toHaveBeenCalled();
                done();
            }, 100);
        });

        it('should not log unauthenticated requests', (done) => {
            mockRequest.user = undefined;
            mockAuditRepo.create = jest.fn().mockResolvedValue({});

            const handler = middleware.logEntityModification('ACTIVITY');
            handler(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();

            const originalSend = mockResponse.send as jest.Mock;
            mockResponse.statusCode = 200;
            originalSend('response data');

            setTimeout(() => {
                expect(mockAuditRepo.create).not.toHaveBeenCalled();
                done();
            }, 100);
        });
    });

    describe('logAuthenticationEvent', () => {
        it('should log successful authentication events', (done) => {
            mockAuditRepo.create = jest.fn().mockResolvedValue({});

            const handler = middleware.logAuthenticationEvent('LOGIN');
            handler(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();

            const originalSend = mockResponse.send as jest.Mock;
            mockResponse.statusCode = 200;
            originalSend('response data');

            setTimeout(() => {
                expect(mockAuditRepo.create).toHaveBeenCalledWith(
                    expect.objectContaining({
                        actionType: 'LOGIN',
                        entityType: 'AUTH',
                    })
                );
                done();
            }, 100);
        });

        it('should not log failed authentication attempts', (done) => {
            mockAuditRepo.create = jest.fn().mockResolvedValue({});

            const handler = middleware.logAuthenticationEvent('LOGIN');
            handler(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();

            const originalSend = mockResponse.send as jest.Mock;
            mockResponse.statusCode = 401;
            originalSend('error data');

            setTimeout(() => {
                expect(mockAuditRepo.create).not.toHaveBeenCalled();
                done();
            }, 100);
        });
    });

    describe('logRoleChange', () => {
        it('should log role changes', (done) => {
            mockRequest.body = { role: 'ADMINISTRATOR', oldRole: 'EDITOR' };
            mockAuditRepo.create = jest.fn().mockResolvedValue({});

            const handler = middleware.logRoleChange();
            handler(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalled();

            const originalSend = mockResponse.send as jest.Mock;
            mockResponse.statusCode = 200;
            originalSend('response data');

            setTimeout(() => {
                expect(mockAuditRepo.create).toHaveBeenCalledWith(
                    expect.objectContaining({
                        actionType: 'ROLE_CHANGE',
                        entityType: 'USER',
                    })
                );
                done();
            }, 100);
        });
    });
});
