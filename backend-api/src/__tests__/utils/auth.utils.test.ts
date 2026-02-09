import { extractAuthorizationContext } from '../../utils/auth.utils';
import { AuthenticatedRequest } from '../../types/express.types';
import { UserRole } from '@prisma/client';

describe('Authorization Utilities', () => {
    describe('extractAuthorizationContext', () => {
        it('should extract full authorization context from authenticated request', () => {
            const req = {
                user: {
                    userId: 'user-123',
                    email: 'test@example.com',
                    role: UserRole.EDITOR,
                    authorizedAreaIds: ['area-1', 'area-2', 'area-3'],
                    readOnlyAreaIds: [],
                    hasGeographicRestrictions: true,
                },
            } as unknown as AuthenticatedRequest;

            const context = extractAuthorizationContext(req);

            expect(context).toEqual({
                authorizedAreaIds: ['area-1', 'area-2', 'area-3'],
                hasGeographicRestrictions: true,
                userId: 'user-123',
                userRole: UserRole.EDITOR,
            });
        });

        it('should handle missing authorizedAreaIds with empty array default', () => {
            const req = {
                user: {
                    userId: 'user-123',
                    email: 'test@example.com',
                    role: UserRole.ADMINISTRATOR,
                    readOnlyAreaIds: [],
                    hasGeographicRestrictions: false,
                },
            } as unknown as AuthenticatedRequest;

            const context = extractAuthorizationContext(req);

            expect(context.authorizedAreaIds).toEqual([]);
            expect(context.hasGeographicRestrictions).toBe(false);
            expect(context.userId).toBe('user-123');
            expect(context.userRole).toBe(UserRole.ADMINISTRATOR);
        });

        it('should handle missing hasGeographicRestrictions with false default', () => {
            const req = {
                user: {
                    userId: 'user-123',
                    email: 'test@example.com',
                    role: UserRole.READ_ONLY,
                    authorizedAreaIds: ['area-1'],
                    readOnlyAreaIds: [],
                },
            } as unknown as AuthenticatedRequest;

            const context = extractAuthorizationContext(req);

            expect(context.hasGeographicRestrictions).toBe(false);
            expect(context.authorizedAreaIds).toEqual(['area-1']);
            expect(context.userId).toBe('user-123');
            expect(context.userRole).toBe(UserRole.READ_ONLY);
        });

        it('should handle completely missing user object with safe defaults', () => {
            const req = {} as AuthenticatedRequest;

            const context = extractAuthorizationContext(req);

            expect(context).toEqual({
                authorizedAreaIds: [],
                hasGeographicRestrictions: false,
                userId: '',
                userRole: '',
            });
        });

        it('should handle undefined user with safe defaults', () => {
            const req = {
                user: undefined,
            } as AuthenticatedRequest;

            const context = extractAuthorizationContext(req);

            expect(context).toEqual({
                authorizedAreaIds: [],
                hasGeographicRestrictions: false,
                userId: '',
                userRole: '',
            });
        });

        it('should handle empty authorizedAreaIds array', () => {
            const req = {
                user: {
                    userId: 'user-123',
                    email: 'test@example.com',
                    role: UserRole.EDITOR,
                    authorizedAreaIds: [],
                    readOnlyAreaIds: [],
                    hasGeographicRestrictions: false,
                },
            } as unknown as AuthenticatedRequest;

            const context = extractAuthorizationContext(req);

            expect(context.authorizedAreaIds).toEqual([]);
            expect(context.hasGeographicRestrictions).toBe(false);
        });

        it('should extract context for administrator without restrictions', () => {
            const req = {
                user: {
                    userId: 'admin-456',
                    email: 'admin@example.com',
                    role: UserRole.ADMINISTRATOR,
                    authorizedAreaIds: [],
                    readOnlyAreaIds: [],
                    hasGeographicRestrictions: false,
                },
            } as unknown as AuthenticatedRequest;

            const context = extractAuthorizationContext(req);

            expect(context).toEqual({
                authorizedAreaIds: [],
                hasGeographicRestrictions: false,
                userId: 'admin-456',
                userRole: UserRole.ADMINISTRATOR,
            });
        });

        it('should extract context for read-only user with restrictions', () => {
            const req = {
                user: {
                    userId: 'readonly-789',
                    email: 'readonly@example.com',
                    role: UserRole.READ_ONLY,
                    authorizedAreaIds: ['area-5', 'area-6'],
                    readOnlyAreaIds: ['area-5', 'area-6'],
                    hasGeographicRestrictions: true,
                },
            } as unknown as AuthenticatedRequest;

            const context = extractAuthorizationContext(req);

            expect(context).toEqual({
                authorizedAreaIds: ['area-5', 'area-6'],
                hasGeographicRestrictions: true,
                userId: 'readonly-789',
                userRole: UserRole.READ_ONLY,
            });
        });

        it('should always return an object with all required fields', () => {
            const req = {} as AuthenticatedRequest;

            const context = extractAuthorizationContext(req);

            expect(context).toHaveProperty('authorizedAreaIds');
            expect(context).toHaveProperty('hasGeographicRestrictions');
            expect(context).toHaveProperty('userId');
            expect(context).toHaveProperty('userRole');
            expect(Array.isArray(context.authorizedAreaIds)).toBe(true);
            expect(typeof context.hasGeographicRestrictions).toBe('boolean');
            expect(typeof context.userId).toBe('string');
            expect(typeof context.userRole).toBe('string');
        });
    });
});
