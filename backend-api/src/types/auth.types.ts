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
}

export interface RefreshTokenPayload {
    userId: string;
    tokenVersion?: number;
}

export interface UserInfo {
    id: string;
    email: string;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
}
