import { UserRole } from '@prisma/client';
import { TokenPayload } from '../../types/auth.types';

export const createMockTokenPayload = (
    role: UserRole = UserRole.EDITOR,
    options: Partial<TokenPayload> = {}
): TokenPayload => ({
    userId: 'user-1',
    email: 'test@example.com',
    role,
    authorizedAreaIds: [],
    readOnlyAreaIds: [],
    hasGeographicRestrictions: false,
    ...options,
});
