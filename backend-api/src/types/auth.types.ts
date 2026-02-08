import { UserRole } from '@prisma/client';

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface TokenPayload {
    userId: string;
    email: string;
    role: UserRole;
    authorizedAreaIds: string[];
    readOnlyAreaIds: string[];
    hasGeographicRestrictions: boolean;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    user: {
        id: string;
        email: string;
        role: UserRole;
        displayName: string | null;
    };
}

export interface RefreshTokenPayload {
    userId: string;
    tokenVersion?: number;
}

export interface UserInfo {
    id: string;
    displayName?: string | null;
    email: string;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
}

export interface PasswordResetTokenPayload {
    email: string;
    userId: string;
    purpose: 'password_reset';
    iat?: number; // Issued at (added by JWT)
    exp?: number; // Expiration (added by JWT)
}
