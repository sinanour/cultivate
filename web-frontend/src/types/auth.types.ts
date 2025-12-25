export type UserRole = 'ADMINISTRATOR' | 'EDITOR' | 'READ_ONLY';

export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface AuthState {
    user: User | null;
    tokens: AuthTokens | null;
    isAuthenticated: boolean;
}
